import { db } from "./db.js";
import { env } from "./env.js";
import { buildApp } from "./app.js";

async function start() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down");
    await app.close();
    await db.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
    app.log.info(`API listening on ${env.API_PUBLIC_URL}`);
  } catch (error) {
    app.log.error(error);
    await db.$disconnect();
    process.exit(1);
  }
}

void start();
