import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { writeAudit } from "../../lib/audit.js";
import { notFound } from "../../lib/errors.js";
import { parseInput } from "../../lib/http.js";
import { authenticate, authorize, currentPrincipal } from "../../middleware/auth.js";
import { effectiveTheme, presentThemeToken, validateThemeValue } from "../../services/theme.js";

const patchSchema = z.object({
  value: z.string().max(2000),
  note: z.string().max(500).optional(),
});
const paramsSchema = z.object({ key: z.string().min(1) });
const versionParamsSchema = z.object({ key: z.string().min(1), versionId: z.string().uuid() });

export const adminThemeRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/theme", { preHandler: [authenticate, authorize("theme.read")] }, async () => {
    const tokens = await db.themeToken.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] });
    const groups = [...new Set(tokens.map((token) => token.group))];
    return {
      data: {
        items: tokens.map(presentThemeToken),
        groups,
        effective: await effectiveTheme(),
      },
    };
  });

  app.patch(
    "/admin/theme/:key",
    { preHandler: [authenticate, authorize("theme.write")] },
    async (request) => {
      const principal = currentPrincipal(request);
      const params = parseInput(paramsSchema, request.params);
      const input = parseInput(patchSchema, request.body);
      const token = await db.themeToken.findUnique({ where: { key: params.key } });
      if (!token) throw notFound("That theme token does not exist.");
      const value = validateThemeValue(token, input.value);
      const oldValue = token.value ?? token.defaultValue;

      const [updated] = await db.$transaction([
        db.themeToken.update({
          where: { id: token.id },
          data: { value, updatedById: principal.user.id },
        }),
        db.themeVersion.create({
          data: {
            tokenId: token.id,
            oldValue,
            newValue: value,
            changedById: principal.user.id,
          },
        }),
      ]);

      await writeAudit({
        actorId: principal.user.id,
        action: "theme.update",
        entityType: "theme_token",
        entityId: token.id,
        before: { key: token.key, value: oldValue },
        after: { key: token.key, value },
        request,
      });

      return { data: { item: presentThemeToken(updated) } };
    },
  );

  app.post(
    "/admin/theme/:key/reset",
    { preHandler: [authenticate, authorize("theme.write")] },
    async (request) => {
      const principal = currentPrincipal(request);
      const params = parseInput(paramsSchema, request.params);
      const token = await db.themeToken.findUnique({ where: { key: params.key } });
      if (!token) throw notFound("That theme token does not exist.");
      const oldValue = token.value ?? token.defaultValue;

      const [updated] = await db.$transaction([
        db.themeToken.update({
          where: { id: token.id },
          data: { value: null, updatedById: principal.user.id },
        }),
        db.themeVersion.create({
          data: {
            tokenId: token.id,
            oldValue,
            newValue: token.defaultValue,
            changedById: principal.user.id,
          },
        }),
      ]);

      await writeAudit({
        actorId: principal.user.id,
        action: "theme.reset",
        entityType: "theme_token",
        entityId: token.id,
        before: { key: token.key, value: oldValue },
        after: { key: token.key, value: token.defaultValue },
        request,
      });

      return { data: { item: presentThemeToken(updated) } };
    },
  );

  app.get(
    "/admin/theme/:key/versions",
    { preHandler: [authenticate, authorize("theme.read")] },
    async (request) => {
      const params = parseInput(paramsSchema, request.params);
      const token = await db.themeToken.findUnique({ where: { key: params.key } });
      if (!token) throw notFound("That theme token does not exist.");
      const versions = await db.themeVersion.findMany({
        where: { tokenId: token.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return { data: { items: versions } };
    },
  );

  app.post(
    "/admin/theme/:key/rollback",
    { preHandler: [authenticate, authorize("theme.write")] },
    async (request) => {
      const principal = currentPrincipal(request);
      const params = parseInput(versionParamsSchema, request.params);
      const token = await db.themeToken.findUnique({ where: { key: params.key } });
      if (!token) throw notFound("That theme token does not exist.");
      const version = await db.themeVersion.findFirst({
        where: { id: params.versionId, tokenId: token.id },
      });
      if (!version) throw notFound("That version does not exist.");

      const targetValue = version.oldValue ?? token.defaultValue;
      const currentValue = token.value ?? token.defaultValue;
      const validated = validateThemeValue(token, targetValue);

      const [updated] = await db.$transaction([
        db.themeToken.update({
          where: { id: token.id },
          data: { value: version.oldValue, updatedById: principal.user.id },
        }),
        db.themeVersion.create({
          data: {
            tokenId: token.id,
            oldValue: currentValue,
            newValue: validated,
            changedById: principal.user.id,
          },
        }),
      ]);

      await writeAudit({
        actorId: principal.user.id,
        action: "theme.rollback",
        entityType: "theme_token",
        entityId: token.id,
        before: { key: token.key, value: currentValue },
        after: { key: token.key, value: validated },
        request,
      });

      return { data: { item: presentThemeToken(updated) } };
    },
  );
};
