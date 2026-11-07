import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@dlp/db";
import { z } from "zod";
import { db } from "../../db.js";
import { writeAudit } from "../../lib/audit.js";
import { notFound } from "../../lib/errors.js";
import { parseInput } from "../../lib/http.js";
import { authenticate, authorize, currentPrincipal } from "../../middleware/auth.js";
import {
  getSettingRaw,
  prepareSettingValue,
  presentSetting,
  presentSettingVersion,
  requireSetting,
} from "../../services/settings.js";

const settingPatchSchema = z
  .object({
    value: z.unknown(),
    note: z.string().max(500).optional(),
  })
  .refine((input) => input.value !== undefined, { message: "A value is required." });

const paramsSchema = z.object({ key: z.string().min(1) });
const versionParamsSchema = z.object({ key: z.string().min(1), versionId: z.string().uuid() });

const jsonValue = (value: unknown) =>
  value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);

const auditValue = (isSecret: boolean, value: unknown) => (isSecret ? "••••••••" : value);

export const adminSettingsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/admin/settings",
    { preHandler: [authenticate, authorize("settings.read")] },
    async () => {
      const settings = await db.setting.findMany({ orderBy: [{ group: "asc" }, { key: "asc" }] });
      const groups = [...new Set(settings.map((setting) => setting.group))];
      return {
        data: {
          items: settings.map(presentSetting),
          groups,
        },
      };
    },
  );

  app.patch(
    "/admin/settings/:key",
    { preHandler: [authenticate, authorize("settings.write")] },
    async (request) => {
      const principal = currentPrincipal(request);
      const params = parseInput(paramsSchema, request.params);
      const input = parseInput(settingPatchSchema, request.body);
      const setting = await requireSetting(params.key);
      const prepared = prepareSettingValue(setting, input.value);
      const oldValue = setting.value;

      const [updated] = await db.$transaction([
        db.setting.update({
          where: { id: setting.id },
          data: { value: jsonValue(prepared), updatedById: principal.user.id },
        }),
        db.settingVersion.create({
          data: {
            settingId: setting.id,
            oldValue: jsonValue(oldValue),
            newValue: jsonValue(prepared),
            changedById: principal.user.id,
            note: input.note,
          },
        }),
      ]);

      await writeAudit({
        actorId: principal.user.id,
        action: "setting.update",
        entityType: "setting",
        entityId: setting.id,
        before: { key: setting.key, value: auditValue(setting.isSecret, oldValue) },
        after: { key: setting.key, value: auditValue(setting.isSecret, prepared) },
        request,
      });

      return { data: { item: presentSetting(updated) } };
    },
  );

  app.post(
    "/admin/settings/:key/reset",
    { preHandler: [authenticate, authorize("settings.write")] },
    async (request) => {
      const principal = currentPrincipal(request);
      const params = parseInput(paramsSchema, request.params);
      const setting = await requireSetting(params.key);
      const prepared = prepareSettingValue(setting, setting.defaultValue);
      const oldValue = setting.value;

      const [updated] = await db.$transaction([
        db.setting.update({
          where: { id: setting.id },
          data: { value: jsonValue(prepared), updatedById: principal.user.id },
        }),
        db.settingVersion.create({
          data: {
            settingId: setting.id,
            oldValue: jsonValue(oldValue),
            newValue: jsonValue(prepared),
            changedById: principal.user.id,
            note: "Reset to default",
          },
        }),
      ]);

      await writeAudit({
        actorId: principal.user.id,
        action: "setting.reset",
        entityType: "setting",
        entityId: setting.id,
        before: { key: setting.key, value: auditValue(setting.isSecret, oldValue) },
        after: { key: setting.key, value: auditValue(setting.isSecret, prepared) },
        request,
      });

      return { data: { item: presentSetting(updated) } };
    },
  );

  app.get(
    "/admin/settings/:key/versions",
    { preHandler: [authenticate, authorize("settings.read")] },
    async (request) => {
      const params = parseInput(paramsSchema, request.params);
      const setting = await getSettingRaw(params.key);
      if (!setting) throw notFound("That setting does not exist.");
      const versions = await db.settingVersion.findMany({
        where: { settingId: setting.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return {
        data: {
          items: versions.map((version) => presentSettingVersion(setting, version)),
        },
      };
    },
  );

  app.post(
    "/admin/settings/:key/rollback",
    { preHandler: [authenticate, authorize("settings.write")] },
    async (request) => {
      const principal = currentPrincipal(request);
      const params = parseInput(versionParamsSchema, request.params);
      const setting = await requireSetting(params.key);
      const version = await db.settingVersion.findFirst({
        where: { id: params.versionId, settingId: setting.id },
      });
      if (!version) throw notFound("That version does not exist.");

      const target = version.oldValue;
      const oldValue = setting.value;

      const [updated] = await db.$transaction([
        db.setting.update({
          where: { id: setting.id },
          data: {
            value: target === null ? Prisma.JsonNull : (target as Prisma.InputJsonValue),
            updatedById: principal.user.id,
          },
        }),
        db.settingVersion.create({
          data: {
            settingId: setting.id,
            oldValue: jsonValue(oldValue),
            newValue: target === null ? Prisma.JsonNull : (target as Prisma.InputJsonValue),
            changedById: principal.user.id,
            note: `Rolled back to version ${version.id}`,
          },
        }),
      ]);

      await writeAudit({
        actorId: principal.user.id,
        action: "setting.rollback",
        entityType: "setting",
        entityId: setting.id,
        before: { key: setting.key, value: auditValue(setting.isSecret, oldValue) },
        after: { key: setting.key, value: auditValue(setting.isSecret, target) },
        request,
      });

      return { data: { item: presentSetting(updated) } };
    },
  );
};
