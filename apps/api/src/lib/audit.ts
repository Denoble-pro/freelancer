import { Prisma } from "@dlp/db";
import { db } from "../db.js";
import { clientIp, userAgent } from "./http.js";

type AuditRequest = {
  ip?: string;
  headers: Record<string, unknown>;
};

type AuditInput = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  request?: AuditRequest;
  impersonatedById?: string | null;
};

const jsonValue = (value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull => {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
};

export async function writeAudit(input: AuditInput): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: jsonValue(input.before),
      after: jsonValue(input.after),
      ip: input.request ? clientIp(input.request) : null,
      userAgent: input.request ? userAgent(input.request) : null,
      impersonatedById: input.impersonatedById ?? null,
    },
  });
}
