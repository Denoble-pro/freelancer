import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { writeAudit } from "../../lib/audit.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { parseInput } from "../../lib/http.js";
import { authenticate, authorize, currentPrincipal } from "../../middleware/auth.js";

const paramsSchema = z.object({ key: z.string().min(1) });

const permissionsSchema = z.object({
  permissions: z.array(z.string().min(1)).max(200),
});

const rolePatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
});

export const adminRoleRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/roles", { preHandler: [authenticate, authorize("roles.write")] }, async () => {
    const [roles, permissions] = await Promise.all([
      db.role.findMany({
        orderBy: { key: "asc" },
        include: {
          permissions: { include: { permission: true } },
        },
      }),
      db.permission.findMany({ orderBy: [{ group: "asc" }, { label: "asc" }] }),
    ]);

    return {
      data: {
        roles: roles.map((role) => ({
          id: role.id,
          key: role.key,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
          permissionKeys: role.permissions.map((entry) => entry.permission.key),
        })),
        permissions: permissions.map((permission) => ({
          id: permission.id,
          key: permission.key,
          label: permission.label,
          group: permission.group,
          description: permission.description,
        })),
      },
    };
  });

  app.put(
    "/admin/roles/:key/permissions",
    { preHandler: [authenticate, authorize("roles.write")] },
    async (request) => {
      const principal = currentPrincipal(request);
      const params = parseInput(paramsSchema, request.params);
      const input = parseInput(permissionsSchema, request.body);
      const keys = [...new Set(input.permissions)];

      const role = await db.role.findUnique({
        where: { key: params.key },
        include: { permissions: { include: { permission: true } } },
      });
      if (!role) throw notFound("That role does not exist.");

      if (role.key === "admin") {
        for (const required of ["roles.write", "settings.write", "content.write"]) {
          if (!keys.includes(required)) {
            throw badRequest(
              `The management role must keep ${required} to avoid locking everyone out of the back office.`,
            );
          }
        }
      }

      const permissionRecords = await db.permission.findMany({
        where: { key: { in: keys } },
        select: { id: true, key: true },
      });
      if (permissionRecords.length !== keys.length) {
        const known = new Set(permissionRecords.map((permission) => permission.key));
        const unknown = keys.filter((key) => !known.has(key));
        throw badRequest(`Unknown permissions: ${unknown.join(", ")}`);
      }

      const before = role.permissions.map((entry) => entry.permission.key).sort();

      await db.$transaction([
        db.rolePermission.deleteMany({ where: { roleId: role.id } }),
        db.rolePermission.createMany({
          data: permissionRecords.map((permission) => ({
            roleId: role.id,
            permissionId: permission.id,
          })),
        }),
      ]);

      await writeAudit({
        actorId: principal.user.id,
        action: "role.permissions.update",
        entityType: "role",
        entityId: role.id,
        before: { key: role.key, permissions: before },
        after: { key: role.key, permissions: keys.sort() },
        request,
      });

      return { data: { success: true, permissions: keys.sort() } };
    },
  );

  app.patch(
    "/admin/roles/:key",
    { preHandler: [authenticate, authorize("roles.write")] },
    async (request) => {
      const principal = currentPrincipal(request);
      const params = parseInput(paramsSchema, request.params);
      const input = parseInput(rolePatchSchema, request.body);
      const role = await db.role.findUnique({ where: { key: params.key } });
      if (!role) throw notFound("That role does not exist.");

      const updated = await db.role.update({
        where: { id: role.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        },
      });

      await writeAudit({
        actorId: principal.user.id,
        action: "role.update",
        entityType: "role",
        entityId: role.id,
        before: { name: role.name, description: role.description },
        after: { name: updated.name, description: updated.description },
        request,
      });

      return {
        data: {
          item: {
            id: updated.id,
            key: updated.key,
            name: updated.name,
            description: updated.description,
          },
        },
      };
    },
  );
};
