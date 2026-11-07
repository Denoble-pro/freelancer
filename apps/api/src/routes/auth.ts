import type { FastifyPluginAsync } from "fastify";
import { loginSchema, sessionIdSchema } from "@dlp/shared";
import { z } from "zod";
import { env } from "../env.js";
import { writeAudit } from "../lib/audit.js";
import { clearAuthCookies, setAuthCookies } from "../lib/cookies.js";
import { notFound } from "../lib/errors.js";
import { parseInput } from "../lib/http.js";
import { authenticate, currentPrincipal } from "../middleware/auth.js";
import {
  cookieNames,
  landingPathForUser,
  listSessions,
  loginWithPassword,
  refreshSession,
  revokeAllSessions,
  revokeRefreshToken,
  revokeSessionForUser,
} from "../services/auth.js";

const sessionParamsSchema = z.object({ id: sessionIdSchema });

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/auth/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const input = parseInput(loginSchema, request.body);
      const result = await loginWithPassword({ ...input, request });

      setAuthCookies(reply, result);

      await writeAudit({
        actorId: result.user.id,
        action: "auth.login",
        entityType: "user",
        entityId: result.user.id,
        request,
        after: { role: result.user.role, email: result.user.email },
      });

      reply.header("Cache-Control", "no-store");
      return {
        data: {
          user: result.user,
          permissions: result.permissions,
          redirectTo: landingPathForUser(result.user),
        },
      };
    },
  );

  app.post(
    "/auth/refresh",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      try {
        const result = await refreshSession(request.cookies[cookieNames.refresh]);
        setAuthCookies(reply, result);
        reply.header("Cache-Control", "no-store");
        return {
          data: {
            user: result.user,
            permissions: result.permissions,
            redirectTo: landingPathForUser(result.user),
          },
        };
      } catch (error) {
        clearAuthCookies(reply);
        throw error;
      }
    },
  );

  app.post("/auth/logout", async (request, reply) => {
    const userId = await revokeRefreshToken(request.cookies[cookieNames.refresh]);
    if (userId) {
      await writeAudit({
        actorId: userId,
        action: "auth.logout",
        entityType: "session",
        request,
      });
    }
    clearAuthCookies(reply);
    reply.header("Cache-Control", "no-store");
    return { data: { success: true } };
  });

  app.get("/auth/me", { preHandler: [authenticate] }, async (request, reply) => {
    const principal = currentPrincipal(request);
    reply.header("Cache-Control", "no-store");
    return {
      data: {
        user: principal.user,
        permissions: principal.permissions,
        sessionId: principal.sessionId,
        environment: env.NODE_ENV,
      },
    };
  });

  app.get("/auth/sessions", { preHandler: [authenticate] }, async (request) => {
    const principal = currentPrincipal(request);
    const sessions = await listSessions(principal.user.id, principal.sessionId);
    return { data: { items: sessions } };
  });

  app.delete("/auth/sessions/:id", { preHandler: [authenticate] }, async (request) => {
    const principal = currentPrincipal(request);
    const params = sessionParamsSchema.safeParse(request.params);
    if (!params.success) throw notFound("That session could not be found.");
    await revokeSessionForUser(params.data.id, principal.user.id);
    return { data: { success: true } };
  });

  app.post("/auth/logout-all", { preHandler: [authenticate] }, async (request, reply) => {
    const principal = currentPrincipal(request);
    const count = await revokeAllSessions(principal.user.id);
    await writeAudit({
      actorId: principal.user.id,
      action: "auth.logout_all",
      entityType: "user",
      entityId: principal.user.id,
      request,
      after: { sessionsRevoked: count },
    });
    clearAuthCookies(reply);
    return { data: { success: true, sessionsRevoked: count } };
  });
};
