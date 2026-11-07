import type { Principal } from "../services/auth.js";

declare module "fastify" {
  interface FastifyRequest {
    principal?: Principal;
  }
}
