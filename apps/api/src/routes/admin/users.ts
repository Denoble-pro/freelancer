import { hash } from "@node-rs/argon2";
import { emailSchema } from "@dlp/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { writeAudit } from "../../lib/audit.js";
import { randomToken } from "../../lib/crypto.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { paginationSchema, parseInput } from "../../lib/http.js";
import { authenticate, authorize, currentPrincipal } from "../../middleware/auth.js";

const querySchema = z.object({
  search: z.string().trim().max(200).optional(),
  role: z.enum(["admin", "staff", "client"]).optional(),
  status: z.enum(["active", "pending", "suspended"]).optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

const paramsSchema = z.object({ id: z.string().uuid() });

const patchSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    role: z.enum(["admin", "staff", "client"]).optional(),
    status: z.enum(["active", "pending", "suspended"]).optional(),
    suspendedReason: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, "Provide at least one change.");

const createStaffSchema = z.object({
  name: z.string().trim().min(2, "Enter the staff member's name.").max(160),
  email: emailSchema,
  title: z.string().trim().max(120).nullable().optional(),
  department: z.string().trim().max(120).nullable().optional(),
});

export const adminUserRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/admin/users",
    { preHandler: [authenticate, authorize("users.read")] },
    async (request) => {
      const query = parseInput(querySchema, request.query);
      const page = paginationSchema.page(query.page);
      const pageSize = paginationSchema.pageSize(query.pageSize, 100, 25);
      const where = {
        deletedAt: null,
        ...(query.role ? { role: query.role } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" as const } },
                { email: { contains: query.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        db.user.findMany({
          where,
          orderBy: [{ role: "asc" }, { name: "asc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            avatarUrl: true,
            emailVerifiedAt: true,
            lastLoginAt: true,
            suspendedReason: true,
            createdAt: true,
            clientProfile: { select: { company: true, country: true, blockedAt: true } },
            staffProfile: { select: { title: true, availability: true } },
            _count: {
              select: {
                staffRelationships: true,
                clientRelationships: true,
                ordersAsStaff: true,
                ordersAsClient: true,
              },
            },
          },
        }),
        db.user.count({ where }),
      ]);

      return {
        data: {
          items,
          meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        },
      };
    },
  );

  app.post(
    "/admin/users",
    { preHandler: [authenticate, authorize("users.write")] },
    async (request, reply) => {
      const principal = currentPrincipal(request);
      const input = parseInput(createStaffSchema, request.body);

      const existing = await db.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (existing) {
        throw conflict("An account with that email already exists.", "EMAIL_IN_USE");
      }

      const temporaryPassword = randomToken(24);
      const passwordHash = await hash(temporaryPassword);

      let created;
      try {
        created = await db.user.create({
          data: {
            name: input.name,
            email: input.email,
            passwordHash,
            role: "staff",
            status: "active",
            emailVerifiedAt: new Date(),
            mustChangePassword: true,
            staffProfile: {
              create: {
                title: input.title ?? null,
                department: input.department ?? null,
                inviteCode: randomToken(12),
                approvalStatus: "approved",
              },
            },
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
            staffProfile: {
              select: {
                id: true,
                title: true,
                department: true,
                approvalStatus: true,
              },
            },
          },
        });
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error ? String(error.code) : "";
        if (code === "P2002") {
          const target =
            error &&
            typeof error === "object" &&
            "meta" in error &&
            error.meta &&
            typeof error.meta === "object" &&
            "target" in error.meta
              ? String(error.meta.target)
              : "";
          if (target.includes("invite_code")) {
            throw conflict(
              "A unique staff invite code could not be generated. Please try again.",
              "INVITE_CODE_CONFLICT",
            );
          }
          throw conflict("An account with that email already exists.", "EMAIL_IN_USE");
        }
        throw error;
      }

      await writeAudit({
        actorId: principal.user.id,
        action: "user.create",
        entityType: "user",
        entityId: created.id,
        request,
        after: {
          role: created.role,
          status: created.status,
          email: created.email,
        },
      });

      reply.header("Cache-Control", "no-store");
      return { data: { item: created, temporaryPassword } };
    },
  );

  app.patch(
    "/admin/users/:id",
    { preHandler: [authenticate, authorize("users.write")] },
    async (request) => {
      const principal = currentPrincipal(request);
      const params = parseInput(paramsSchema, request.params);
      const input = parseInput(patchSchema, request.body);

      const user = await db.user.findUnique({ where: { id: params.id } });
      if (!user || user.deletedAt) throw notFound("That user does not exist.");
      if (user.id === principal.user.id && (input.role || input.status)) {
        throw badRequest("You cannot change your own role or account status.");
      }

      const losingAdmin =
        user.role === "admin" &&
        ((input.role && input.role !== "admin") || (input.status && input.status !== "active"));
      if (losingAdmin) {
        const otherAdmins = await db.user.count({
          where: { role: "admin", status: "active", deletedAt: null, NOT: { id: user.id } },
        });
        if (otherAdmins === 0) {
          throw badRequest("Keep at least one active administrator.");
        }
      }

      const updated = await db.$transaction(async (tx) => {
        const result = await tx.user.update({
          where: { id: user.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.role !== undefined ? { role: input.role } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.suspendedReason !== undefined
              ? { suspendedReason: input.suspendedReason }
              : {}),
          },
        });

        if (input.status === "suspended" || (input.role && input.role !== user.role)) {
          await tx.session.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }

        return result;
      });

      await writeAudit({
        actorId: principal.user.id,
        action: "user.update",
        entityType: "user",
        entityId: user.id,
        before: {
          name: user.name,
          role: user.role,
          status: user.status,
          suspendedReason: user.suspendedReason,
        },
        after: {
          name: updated.name,
          role: updated.role,
          status: updated.status,
          suspendedReason: updated.suspendedReason,
        },
        request,
      });

      return {
        data: {
          item: {
            id: updated.id,
            name: updated.name,
            email: updated.email,
            role: updated.role,
            status: updated.status,
            suspendedReason: updated.suspendedReason,
          },
        },
      };
    },
  );

  app.post(
    "/admin/users/:id/reset-password",
    { preHandler: [authenticate, authorize("users.write")] },
    async (request, reply) => {
      const principal = currentPrincipal(request);
      const params = parseInput(paramsSchema, request.params);

      const user = await db.user.findFirst({
        where: { id: params.id, deletedAt: null },
        select: { id: true, name: true, email: true, role: true, status: true },
      });
      if (!user) throw notFound("That user does not exist.");
      if (user.role !== "staff" && user.role !== "client") {
        throw badRequest("Temporary passwords can only be reset for staff or client accounts.");
      }
      if (user.id === principal.user.id) {
        throw badRequest("Use account settings to change your own password.");
      }

      const temporaryPassword = randomToken(24);
      const passwordHash = await hash(temporaryPassword);
      const revoked = await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { passwordHash, mustChangePassword: true },
        });
        const result = await tx.session.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return result.count;
      });

      await writeAudit({
        actorId: principal.user.id,
        action: "user.password.reset",
        entityType: "user",
        entityId: user.id,
        after: { sessionsRevoked: revoked },
        request,
      });

      reply.header("Cache-Control", "no-store");
      return {
        data: {
          item: user,
          temporaryPassword,
          sessionsRevoked: revoked,
        },
      };
    },
  );

  app.delete(
    "/admin/users/:id",
    { preHandler: [authenticate, authorize("users.write")] },
    async (request) => {
      const principal = currentPrincipal(request);
      const params = parseInput(paramsSchema, request.params);

      const user = await db.user.findFirst({
        where: { id: params.id, deletedAt: null },
        select: { id: true, name: true, email: true, role: true, status: true },
      });
      if (!user) throw notFound("That user does not exist.");
      if (user.role === "admin") {
        throw badRequest("Administrator accounts cannot be deleted.");
      }

      const now = new Date();
      const revoked = await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            deletedAt: now,
            status: "suspended",
            suspendedReason: "Account deleted by management.",
          },
        });
        const result = await tx.session.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: now },
        });
        return result.count;
      });

      await writeAudit({
        actorId: principal.user.id,
        action: "user.delete",
        entityType: "user",
        entityId: user.id,
        before: { name: user.name, email: user.email, role: user.role, status: user.status },
        after: { deletedAt: now.toISOString(), sessionsRevoked: revoked },
        request,
      });

      return { data: { success: true, sessionsRevoked: revoked } };
    },
  );

  app.post(
    "/admin/users/:id/revoke-sessions",
    { preHandler: [authenticate, authorize("users.write")] },
    async (request) => {
      const principal = currentPrincipal(request);
      const params = parseInput(paramsSchema, request.params);
      const user = await db.user.findUnique({ where: { id: params.id }, select: { id: true } });
      if (!user) throw notFound("That user does not exist.");

      const result = await db.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await writeAudit({
        actorId: principal.user.id,
        action: "user.sessions.revoke",
        entityType: "user",
        entityId: user.id,
        after: { revokedSessions: result.count },
        request,
      });

      return { data: { success: true, revoked: result.count } };
    },
  );
};
