import { hash, verify } from "@node-rs/argon2";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { writeAudit } from "../lib/audit.js";
import { randomToken } from "../lib/crypto.js";
import { badRequest } from "../lib/errors.js";
import { parseInput } from "../lib/http.js";
import { authenticate, currentPrincipal } from "../middleware/auth.js";
import { landingPathForUser } from "../services/auth.js";

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    phone: optionalText(40),
    avatarUrl: z.string().trim().url().max(2000).nullable().optional(),
    locale: z
      .string()
      .trim()
      .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/, "Use a valid language code.")
      .optional(),
    timezone: z.string().trim().min(1).max(60).optional(),
    company: optionalText(160),
    title: optionalText(160),
    department: optionalText(160),
    bio: optionalText(5000),
    availability: z.enum(["available", "busy", "unavailable"]).optional(),
    skills: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, "Provide at least one change.");

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(200),
  newPassword: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(200)
    .refine((value) => /[a-zA-Z]/.test(value) && /\d/.test(value), {
      message: "Include at least one letter and one number.",
    }),
});

const profileSelect = {
  phone: true,
  clientProfile: { select: { company: true, country: true } },
  staffProfile: {
    select: { title: true, department: true, bio: true, skills: true, availability: true },
  },
} as const;

export const accountRoutes: FastifyPluginAsync = async (app) => {
  app.get("/account/profile", { preHandler: [authenticate] }, async (request, reply) => {
    const principal = currentPrincipal(request);
    const user = await db.user.findUniqueOrThrow({
      where: { id: principal.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatarUrl: true,
        locale: true,
        timezone: true,
        emailVerifiedAt: true,
        mustChangePassword: true,
        createdAt: true,
        ...profileSelect,
      },
    });
    reply.header("Cache-Control", "no-store");
    return { data: { user } };
  });

  app.patch("/account/profile", { preHandler: [authenticate] }, async (request) => {
    const principal = currentPrincipal(request);
    const input = parseInput(profileSchema, request.body);
    const profileFields = {
      ...(input.company !== undefined ? { company: input.company } : {}),
    };
    const staffFields = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.department !== undefined ? { department: input.department } : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.skills !== undefined ? { skills: input.skills } : {}),
      ...(input.availability !== undefined ? { availability: input.availability } : {}),
    };

    const updated = await db.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: principal.user.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
          ...(input.locale !== undefined ? { locale: input.locale } : {}),
          ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          avatarUrl: true,
          locale: true,
          timezone: true,
          emailVerifiedAt: true,
          mustChangePassword: true,
          createdAt: true,
          ...profileSelect,
        },
      });

      if (input.company !== undefined && principal.user.role === "client") {
        await tx.clientProfile.upsert({
          where: { userId: principal.user.id },
          update: profileFields,
          create: { userId: principal.user.id, ...profileFields },
        });
      }

      if (Object.keys(staffFields).length > 0 && principal.user.role === "staff") {
        await tx.staffProfile.upsert({
          where: { userId: principal.user.id },
          update: staffFields,
          create: { userId: principal.user.id, inviteCode: randomToken(12), ...staffFields },
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          avatarUrl: true,
          locale: true,
          timezone: true,
          emailVerifiedAt: true,
          mustChangePassword: true,
          createdAt: true,
          ...profileSelect,
        },
      });
    });

    await writeAudit({
      actorId: principal.user.id,
      action: "account.profile.update",
      entityType: "user",
      entityId: principal.user.id,
      before: {
        name: principal.user.name,
        avatarUrl: principal.user.avatarUrl,
        locale: principal.user.locale,
        timezone: principal.user.timezone,
      },
      after: {
        name: updated.name,
        avatarUrl: updated.avatarUrl,
        locale: updated.locale,
        timezone: updated.timezone,
      },
      request,
    });

    return { data: { user: updated } };
  });

  app.post(
    "/account/password",
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (request) => {
      const principal = currentPrincipal(request);
      const input = parseInput(passwordSchema, request.body);

      if (input.currentPassword === input.newPassword) {
        throw badRequest("Choose a new password that is different from your current one.");
      }

      const user = await db.user.findUnique({
        where: { id: principal.user.id },
        select: { passwordHash: true },
      });
      if (!user) throw badRequest("Your account could not be found.");

      const valid = await verify(user.passwordHash, input.currentPassword).catch(() => false);
      if (!valid) throw badRequest("Your current password is incorrect.");

      const passwordHash = await hash(input.newPassword);
      const revoked = await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: principal.user.id },
          data: { passwordHash, mustChangePassword: false },
        });
        const result = await tx.session.updateMany({
          where: {
            userId: principal.user.id,
            id: { not: principal.sessionId },
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
        return result.count;
      });

      await writeAudit({
        actorId: principal.user.id,
        action: "account.password.change",
        entityType: "user",
        entityId: principal.user.id,
        after: { sessionsRevoked: revoked, forced: principal.user.mustChangePassword },
        request,
      });

      return {
        data: {
          success: true,
          sessionsRevoked: revoked,
          redirectTo: landingPathForUser({ role: principal.user.role, mustChangePassword: false }),
        },
      };
    },
  );
};
