import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { writeAudit } from "../../lib/audit.js";
import { notFound } from "../../lib/errors.js";
import { paginationSchema, parseInput } from "../../lib/http.js";
import { authenticate, authorize, currentPrincipal } from "../../middleware/auth.js";

const querySchema = z.object({
  search: z.string().trim().max(200).optional(),
  visible: z.enum(["true", "false"]).optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

const paramsSchema = z.object({ id: z.string().uuid() });

const patchSchema = z.object({
  visible: z.boolean(),
});

export const adminReviewRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/admin/reviews",
    { preHandler: [authenticate, authorize("reviews.moderate")] },
    async (request) => {
      const query = parseInput(querySchema, request.query);
      const page = paginationSchema.page(query.page);
      const pageSize = paginationSchema.pageSize(query.pageSize, 100, 25);
      const where = {
        ...(query.visible ? { visible: query.visible === "true" } : {}),
        ...(query.search
          ? {
              OR: [
                { comment: { contains: query.search, mode: "insensitive" as const } },
                { staffReply: { contains: query.search, mode: "insensitive" as const } },
                { order: { number: { contains: query.search, mode: "insensitive" as const } } },
                {
                  order: {
                    staff: { name: { contains: query.search, mode: "insensitive" as const } },
                  },
                },
                {
                  order: {
                    client: { name: { contains: query.search, mode: "insensitive" as const } },
                  },
                },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        db.review.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            order: {
              select: {
                id: true,
                number: true,
                status: true,
                staff: { select: { id: true, name: true, email: true, avatarUrl: true } },
                client: { select: { id: true, name: true, email: true, avatarUrl: true } },
              },
            },
          },
        }),
        db.review.count({ where }),
      ]);

      return {
        data: {
          items,
          meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        },
      };
    },
  );

  app.patch(
    "/admin/reviews/:id",
    { preHandler: [authenticate, authorize("reviews.moderate")] },
    async (request) => {
      const principal = currentPrincipal(request);
      const params = parseInput(paramsSchema, request.params);
      const input = parseInput(patchSchema, request.body);
      const review = await db.review.findUnique({ where: { id: params.id } });
      if (!review) throw notFound("That review does not exist.");

      const updated = await db.review.update({
        where: { id: review.id },
        data: { visible: input.visible },
      });
      await writeAudit({
        actorId: principal.user.id,
        action: "review.moderate",
        entityType: "review",
        entityId: review.id,
        request,
        before: { visible: review.visible },
        after: { visible: updated.visible },
      });

      return { data: { item: updated } };
    },
  );
};
