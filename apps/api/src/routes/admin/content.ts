import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { writeAudit } from "../../lib/audit.js";
import { notFound } from "../../lib/errors.js";
import { parseInput } from "../../lib/http.js";
import { authenticate, authorize, currentPrincipal } from "../../middleware/auth.js";
import { db } from "../../db.js";

const patchSchema = z.object({
  value: z.string().max(50000).nullable(),
  note: z.string().max(500).optional(),
});

const listQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  group: z.string().trim().max(100).optional(),
});

const versionParamsSchema = z.object({ key: z.string().min(1), versionId: z.string().uuid() });
const paramsSchema = z.object({ key: z.string().min(1) });

const present = (item: {
  id: string;
  key: string;
  group: string;
  label: string;
  defaultValue: string;
  value: string | null;
  description: string | null;
  updatedAt: Date;
}) => ({
  ...item,
  effectiveValue: item.value ?? item.defaultValue,
  isOverridden: item.value !== null,
});

export const adminContentRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/admin/content",
    { preHandler: [authenticate, authorize("content.read")] },
    async (request) => {
      const query = parseInput(listQuerySchema, request.query);
      const items = await db.contentString.findMany({
        where: {
          ...(query.group ? { group: query.group } : {}),
          ...(query.search
            ? {
                OR: [
                  { key: { contains: query.search, mode: "insensitive" } },
                  { label: { contains: query.search, mode: "insensitive" } },
                  { defaultValue: { contains: query.search, mode: "insensitive" } },
                  { value: { contains: query.search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: [{ group: "asc" }, { key: "asc" }],
      });
      const groups = await db.contentString.findMany({
        distinct: ["group"],
        select: { group: true },
        orderBy: { group: "asc" },
      });
      return {
        data: {
          items: items.map(present),
          groups: groups.map((entry) => entry.group),
        },
      };
    },
  );

  app.patch(
    "/admin/content/:key",
    { preHandler: [authenticate, authorize("content.write")] },
    async (request) => {
      const principal = currentPrincipal(request);
      const params = parseInput(paramsSchema, request.params);
      const input = parseInput(patchSchema, request.body);
      const content = await db.contentString.findUnique({ where: { key: params.key } });
      if (!content) throw notFound("That content key does not exist.");

      const oldValue = content.value ?? content.defaultValue;
      const newValue = input.value ?? content.defaultValue;

      const [updated] = await db.$transaction([
        db.contentString.update({
          where: { id: content.id },
          data: { value: input.value, updatedById: principal.user.id },
        }),
        db.contentVersion.create({
          data: {
            contentId: content.id,
            oldValue,
            newValue,
            changedById: principal.user.id,
            note: input.note,
          },
        }),
      ]);

      await writeAudit({
        actorId: principal.user.id,
        action: "content.update",
        entityType: "content_string",
        entityId: content.id,
        before: { key: content.key, value: oldValue },
        after: { key: content.key, value: newValue },
        request,
      });

      return { data: { item: present(updated) } };
    },
  );

  app.post(
    "/admin/content/:key/reset",
    { preHandler: [authenticate, authorize("content.write")] },
    async (request) => {
      const principal = currentPrincipal(request);
      const params = parseInput(paramsSchema, request.params);
      const content = await db.contentString.findUnique({ where: { key: params.key } });
      if (!content) throw notFound("That content key does not exist.");

      const oldValue = content.value ?? content.defaultValue;
      const [updated] = await db.$transaction([
        db.contentString.update({
          where: { id: content.id },
          data: { value: null, updatedById: principal.user.id },
        }),
        db.contentVersion.create({
          data: {
            contentId: content.id,
            oldValue,
            newValue: content.defaultValue,
            changedById: principal.user.id,
            note: "Reset to default",
          },
        }),
      ]);

      await writeAudit({
        actorId: principal.user.id,
        action: "content.reset",
        entityType: "content_string",
        entityId: content.id,
        before: { key: content.key, value: oldValue },
        after: { key: content.key, value: content.defaultValue },
        request,
      });

      return { data: { item: present(updated) } };
    },
  );

  app.get(
    "/admin/content/:key/versions",
    { preHandler: [authenticate, authorize("content.read")] },
    async (request) => {
      const params = parseInput(paramsSchema, request.params);
      const content = await db.contentString.findUnique({ where: { key: params.key } });
      if (!content) throw notFound("That content key does not exist.");
      const versions = await db.contentVersion.findMany({
        where: { contentId: content.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return { data: { items: versions } };
    },
  );

  app.post(
    "/admin/content/:key/rollback",
    { preHandler: [authenticate, authorize("content.write")] },
    async (request) => {
      const principal = currentPrincipal(request);
      const params = parseInput(versionParamsSchema, request.params);
      const content = await db.contentString.findUnique({ where: { key: params.key } });
      if (!content) throw notFound("That content key does not exist.");
      const version = await db.contentVersion.findFirst({
        where: { id: params.versionId, contentId: content.id },
      });
      if (!version) throw notFound("That version does not exist.");

      const currentEffective = content.value ?? content.defaultValue;
      const targetValue = version.oldValue;
      const targetEffective = targetValue ?? content.defaultValue;

      const [updated] = await db.$transaction([
        db.contentString.update({
          where: { id: content.id },
          data: { value: targetValue, updatedById: principal.user.id },
        }),
        db.contentVersion.create({
          data: {
            contentId: content.id,
            oldValue: currentEffective,
            newValue: targetEffective,
            changedById: principal.user.id,
            note: `Rolled back to version ${version.id}`,
          },
        }),
      ]);

      await writeAudit({
        actorId: principal.user.id,
        action: "content.rollback",
        entityType: "content_string",
        entityId: content.id,
        before: { value: currentEffective },
        after: { value: targetEffective },
        request,
      });

      return { data: { item: present(updated) } };
    },
  );
};
