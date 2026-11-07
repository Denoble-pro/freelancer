import type { FastifyPluginAsync } from "fastify";
import { db } from "../db.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => ({
    status: "ok",
    service: "denobelpro-marketplace-api",
    version: "0.1.0",
    time: new Date().toISOString(),
  }));

  app.get("/health/ready", async (_request, reply) => {
    try {
      await db.$queryRaw`SELECT 1`;
      return {
        status: "ready",
        database: "up",
        time: new Date().toISOString(),
      };
    } catch {
      reply.status(503);
      return {
        status: "degraded",
        database: "down",
        time: new Date().toISOString(),
      };
    }
  });
};
