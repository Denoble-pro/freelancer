import { hash } from "@node-rs/argon2";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { writeAudit } from "../lib/audit.js";
import { setAuthCookies } from "../lib/cookies.js";
import { sha256 } from "../lib/crypto.js";
import { conflict, notFound } from "../lib/errors.js";
import { parseInput } from "../lib/http.js";
import { loginWithPassword } from "../services/auth.js";
import { effectiveContent } from "../services/content.js";
import { publicSettings } from "../services/settings.js";
import { effectiveTheme } from "../services/theme.js";

const pageParamsSchema = z.object({ slug: z.string().min(1).max(140) });
const inviteParamsSchema = z.object({ token: z.string().min(20).max(200) });
const inviteAcceptSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name.").max(160),
  password: z.string().min(10, "Use at least 10 characters.").max(200),
  company: z.string().trim().max(160).optional(),
});

export const publicRoutes: FastifyPluginAsync = async (app) => {
  app.get("/public/bootstrap", async (_request, reply) => {
    const [content, theme, settings, featureRows, menus, languages] = await Promise.all([
      effectiveContent(),
      effectiveTheme(),
      publicSettings(),
      db.featureFlag.findMany({
        where: { isPublic: true },
        select: { key: true, enabled: true },
        orderBy: { key: "asc" },
      }),
      db.menu.findMany({
        where: { key: { in: ["header", "footer"] } },
        orderBy: { key: "asc" },
        include: {
          items: {
            where: { visible: true, roleVisibility: { has: "guest" } },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              label: true,
              labelKey: true,
              url: true,
              icon: true,
              sortOrder: true,
            },
          },
        },
      }),
      db.language.findMany({
        where: { enabled: true },
        select: { code: true, name: true, direction: true, isDefault: true },
        orderBy: { name: "asc" },
      }),
    ]);

    reply.header("Cache-Control", "no-store, max-age=0");
    return {
      data: {
        content,
        theme,
        settings,
        features: Object.fromEntries(featureRows.map((flag) => [flag.key, flag.enabled])),
        menus: Object.fromEntries(
          menus.map((menu) => [menu.key, menu.items.map(({ id, ...item }) => ({ id, ...item }))]),
        ),
        languages,
      },
    };
  });

  app.get("/public/pages/:slug", async (request, reply) => {
    const params = parseInput(pageParamsSchema, request.params);
    const page = await db.page.findFirst({
      where: { slug: params.slug, status: "published", deletedAt: null },
      include: {
        blocks: {
          where: { visible: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, type: true, sortOrder: true, content: true },
        },
      },
    });
    if (!page) throw notFound("That page does not exist.");

    reply.header("Cache-Control", "no-store, max-age=0");
    return {
      data: {
        slug: page.slug,
        title: page.title,
        seo: page.seo,
        updatedAt: page.updatedAt,
        blocks: page.blocks,
      },
    };
  });

  app.get("/public/invitations/:token", async (request, reply) => {
    const params = parseInput(inviteParamsSchema, request.params);
    const invitation = await db.invitation.findUnique({
      where: { tokenHash: sha256(params.token) },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            staffProfile: { select: { title: true, bio: true, skills: true } },
          },
        },
      },
    });

    if (!invitation || invitation.status === "revoked") {
      throw notFound("This invitation link is not valid.");
    }
    if (invitation.status === "accepted") {
      throw conflict("This invitation has already been accepted. Sign in to continue.");
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw conflict("This invitation has expired. Ask your contact for a new link.");
    }

    if (!invitation.openedAt) {
      await db.invitation.update({
        where: { id: invitation.id },
        data: { openedAt: new Date(), status: "opened" },
      });
    }

    reply.header("Cache-Control", "no-store, max-age=0");
    return {
      data: {
        email: invitation.email,
        message: invitation.message,
        expiresAt: invitation.expiresAt,
        staff: {
          id: invitation.staff.id,
          name: invitation.staff.name,
          avatarUrl: invitation.staff.avatarUrl,
          title: invitation.staff.staffProfile?.title ?? null,
          bio: invitation.staff.staffProfile?.bio ?? null,
          skills: invitation.staff.staffProfile?.skills ?? [],
        },
      },
    };
  });

  app.post(
    "/public/invitations/:token/accept",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const params = parseInput(inviteParamsSchema, request.params);
      const input = parseInput(inviteAcceptSchema, request.body);
      const invitation = await db.invitation.findUnique({
        where: { tokenHash: sha256(params.token) },
      });

      if (!invitation || invitation.status === "revoked") {
        throw notFound("This invitation link is not valid.");
      }
      if (invitation.status === "accepted") {
        throw conflict("This invitation has already been accepted. Sign in to continue.");
      }
      if (invitation.expiresAt.getTime() <= Date.now()) {
        throw conflict("This invitation has expired. Ask your contact for a new link.");
      }

      const existing = await db.user.findUnique({
        where: { email: invitation.email },
        select: { id: true },
      });
      if (existing) {
        throw conflict("This email already has an account. Sign in instead of accepting again.");
      }

      const passwordHash = await hash(input.password);
      const now = new Date();

      await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: invitation.email,
            name: input.name,
            passwordHash,
            role: "client",
            status: "active",
            emailVerifiedAt: now,
          },
        });

        await tx.clientProfile.create({
          data: { userId: user.id, company: input.company || null, country: "Nigeria" },
        });

        const relationship = await tx.relationship.create({
          data: {
            staffId: invitation.staffId,
            clientId: user.id,
            status: "active",
            invitedVia: "invitation",
            sourceInvitation: invitation.id,
            lastInteractionAt: now,
          },
        });

        const conversation = await tx.conversation.create({
          data: {
            relationshipId: relationship.id,
            lastMessageAt: now,
          },
        });

        const openingMessage =
          invitation.message?.trim() ||
          `Hi ${input.name.split(" ")[0]}, thanks for accepting my invitation. Tell me what you are working on and I will help you find the right package.`;

        await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderId: invitation.staffId,
            type: "text",
            body: openingMessage,
          },
        });

        const claimed = await tx.invitation.updateMany({
          where: { id: invitation.id, status: { in: ["sent", "opened"] } },
          data: {
            status: "accepted",
            acceptedAt: now,
            openedAt: invitation.openedAt ?? now,
            relationshipId: relationship.id,
          },
        });
        if (claimed.count !== 1) {
          throw conflict("This invitation has already been used.");
        }

        await tx.notification.createMany({
          data: [
            {
              userId: invitation.staffId,
              type: "invitation.accepted",
              title: "Invitation accepted",
              body: `${input.name} accepted your invitation and is now connected with you.`,
              data: { relationshipId: relationship.id },
            },
            {
              userId: user.id,
              type: "invitation.welcome",
              title: "Welcome to Denobelpro",
              body: "Your private workspace is ready. Start by sending a message or reviewing offers.",
              data: { relationshipId: relationship.id },
            },
          ],
        });
      });

      const result = await loginWithPassword({
        email: invitation.email,
        password: input.password,
        request,
      });
      setAuthCookies(reply, result);

      await writeAudit({
        actorId: result.user.id,
        action: "invitation.accept",
        entityType: "invitation",
        entityId: invitation.id,
        request,
        after: { email: invitation.email, staffId: invitation.staffId },
      });

      reply.header("Cache-Control", "no-store");
      return {
        data: {
          user: result.user,
          permissions: result.permissions,
          redirectTo: "/workspace",
        },
      };
    },
  );
};
