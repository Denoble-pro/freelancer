import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { writeAudit } from "../../lib/audit.js";
import { notFound } from "../../lib/errors.js";
import { parseInput } from "../../lib/http.js";
import { authenticate, authorize, currentPrincipal } from "../../middleware/auth.js";

const paramsSchema = z.object({ key: z.string().min(1) });
const patchSchema = z.object({ enabled: z.boolean() });

export const adminFeatureRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/admin/feature-flags",
    { preHandler: [authenticate, authorize("settings.read")] },
    async () => {
      const flags = await db.featureFlag.findMany({ orderBy: { key: "asc" } });
      return { data: { items: flags } };
    },
  );

  app.patch(
    "/admin/feature-flags/:key",
    { preHandler: [authenticate, authorize("flags.write")] },
    async (request) => {
      const principal = currentPrincipal(request);
      const params = parseInput(paramsSchema, request.params);
      const input = parseInput(patchSchema, request.body);
      const flag = await db.featureFlag.findUnique({ where: { key: params.key } });
      if (!flag) throw notFound("That feature flag does not exist.");

      const updated = await db.featureFlag.update({
        where: { id: flag.id },
        data: { enabled: input.enabled, updatedById: principal.user.id },
      });

      await writeAudit({
        actorId: principal.user.id,
        action: "feature_flag.update",
        entityType: "feature_flag",
        entityId: flag.id,
        before: { key: flag.key, enabled: flag.enabled },
        after: { key: flag.key, enabled: updated.enabled },
        request,
      });

      return { data: { item: updated } };
    },
  );
};
