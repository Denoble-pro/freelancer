import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { paginationSchema, parseInput } from "../../lib/http.js";
import { authenticate, authorize } from "../../middleware/auth.js";

const querySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  action: z.string().max(80).optional(),
  entityType: z.string().max(60).optional(),
  actorId: z.string().uuid().optional(),
});

export const adminAuditRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/admin/audit-logs",
    { preHandler: [authenticate, authorize("audit.read")] },
    async (request) => {
      const query = parseInput(querySchema, request.query);
      const page = paginationSchema.page(query.page);
      const pageSize = paginationSchema.pageSize(query.pageSize, 100, 25);

      const where = {
        ...(query.action
          ? { action: { contains: query.action, mode: "insensitive" as const } }
          : {}),
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.actorId ? { actorId: query.actorId } : {}),
      };

      const [items, total] = await Promise.all([
        db.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            actor: { select: { id: true, name: true, email: true, role: true } },
          },
        }),
        db.auditLog.count({ where }),
      ]);

      return {
        data: {
          items,
          meta: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        },
      };
    },
  );
};
