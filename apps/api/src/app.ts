import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { env, isProduction } from "./env.js";
import { ApiError } from "./lib/errors.js";
import { accountRoutes } from "./routes/account.js";
import { authRoutes } from "./routes/auth.js";
import { publicRoutes } from "./routes/public.js";
import { healthRoutes } from "./routes/health.js";
import { adminContentRoutes } from "./routes/admin/content.js";
import { adminSettingsRoutes } from "./routes/admin/settings.js";
import { adminThemeRoutes } from "./routes/admin/theme.js";
import { adminFeatureRoutes } from "./routes/admin/features.js";
import { adminReviewRoutes } from "./routes/admin/reviews.js";
import { adminRoleRoutes } from "./routes/admin/roles.js";
import { adminAuditRoutes } from "./routes/admin/audit.js";
import { adminUserRoutes } from "./routes/admin/users.js";
import { workspaceRoutes } from "./routes/workspace.js";

const allowedOrigins = new Set(
  [env.APP_URL, env.API_PUBLIC_URL, ...env.CORS_ORIGIN.split(",")]
    .map((origin) => origin.trim())
    .filter(Boolean),
);

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.NODE_ENV === "test"
        ? false
        : {
            level: env.NODE_ENV === "development" ? "info" : "warn",
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "res.headers.set-cookie",
                "req.body.password",
              ],
              censor: "[redacted]",
            },
          },
    trustProxy: true,
    bodyLimit: 1024 * 1024,
  });

  await app.register(cookie);
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
  });

  app.addHook("onRequest", async (request) => {
    const method = request.method.toUpperCase();
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return;
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      throw new ApiError(403, "ORIGIN_NOT_ALLOWED", "This request origin is not allowed.");
    }
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: `No route matches ${request.method} ${request.url}.`,
      },
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      });
    }

    const statusCode = (error as { statusCode?: unknown }).statusCode;
    const message = error instanceof Error ? error.message : "That request could not be processed.";

    if (statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Please wait a moment and try again.",
        },
      });
    }

    if (typeof statusCode === "number" && statusCode < 500) {
      return reply.status(statusCode).send({
        error: {
          code: "BAD_REQUEST",
          message: isProduction ? "That request could not be processed." : message,
        },
      });
    }

    request.log.error({ err: error }, "Unhandled API error");
    return reply.status(500).send({
      error: {
        code: "SERVER_ERROR",
        message: "Something went wrong on our side. Please try again.",
      },
    });
  });

  await app.register(healthRoutes, { prefix: "/api/v1" });
  await app.register(publicRoutes, { prefix: "/api/v1" });
  await app.register(authRoutes, { prefix: "/api/v1" });
  await app.register(accountRoutes, { prefix: "/api/v1" });
  await app.register(adminContentRoutes, { prefix: "/api/v1" });
  await app.register(adminSettingsRoutes, { prefix: "/api/v1" });
  await app.register(adminThemeRoutes, { prefix: "/api/v1" });
  await app.register(adminFeatureRoutes, { prefix: "/api/v1" });
  await app.register(adminRoleRoutes, { prefix: "/api/v1" });
  await app.register(adminReviewRoutes, { prefix: "/api/v1" });
  await app.register(adminAuditRoutes, { prefix: "/api/v1" });
  await app.register(adminUserRoutes, { prefix: "/api/v1" });
  await app.register(workspaceRoutes, { prefix: "/api/v1" });

  return app;
}
