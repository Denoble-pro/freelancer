import { hash, verify } from "@node-rs/argon2";
import type { FastifyRequest } from "fastify";
import { db } from "../db.js";
import { env } from "../env.js";
import { forbidden, notFound, unauthorized } from "../lib/errors.js";
import { clientIp, userAgent } from "../lib/http.js";
import { randomToken, safeEqual, sha256 } from "../lib/crypto.js";
import { signAccessToken, verifyAccessToken } from "../lib/tokens.js";
import { getSettingValue } from "./settings.js";

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatarUrl: string | null;
  locale: string;
  timezone: string;
  emailVerifiedAt: Date | null;
  mustChangePassword: boolean;
  createdAt: Date;
};

export type Principal = {
  user: SafeUser;
  permissions: string[];
  sessionId: string;
};

const safeUserSelect = {
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
} as const;

export function landingPathForUser(user: Pick<SafeUser, "role" | "mustChangePassword">): string {
  if (user.mustChangePassword) return "/account/password";
  return user.role === "admin" ? "/admin" : "/workspace";
}

let dummyHashPromise: Promise<string> | null = null;
const dummyHash = () => {
  dummyHashPromise ??= hash("not-a-real-password-timing-guard");
  return dummyHashPromise;
};

export async function permissionsForRole(role: string): Promise<string[]> {
  const record = await db.role.findUnique({
    where: { key: role },
    select: { permissions: { select: { permission: { select: { key: true } } } } },
  });
  return record?.permissions.map((entry) => entry.permission.key) ?? [];
}

export async function loadUser(userId: string): Promise<SafeUser | null> {
  return db.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: safeUserSelect,
  });
}

async function sessionSettings() {
  const [sessionDays, accessMinutes] = await Promise.all([
    getSettingValue<number>("security.sessionDays", 30),
    getSettingValue<number>("security.accessTokenMinutes", 15),
  ]);
  return {
    sessionDays: Math.min(Math.max(sessionDays, 1), 365),
    accessMinutes: Math.min(Math.max(accessMinutes, 5), 120),
  };
}

export type LoginResult = {
  user: SafeUser;
  permissions: string[];
  accessToken: string;
  refreshToken: string;
  accessSeconds: number;
  refreshSeconds: number;
};

export async function loginWithPassword(input: {
  email: string;
  password: string;
  request: FastifyRequest;
}): Promise<LoginResult> {
  const userRecord = await db.user.findUnique({
    where: { email: input.email },
    select: { ...safeUserSelect, passwordHash: true, suspendedReason: true, deletedAt: true },
  });

  const passwordHash = userRecord?.passwordHash ?? (await dummyHash());
  const validPassword = await verify(passwordHash, input.password).catch(() => false);

  if (!userRecord || !validPassword || userRecord.deletedAt) {
    throw unauthorized(
      "That email and password combination does not match our records.",
      "INVALID_CREDENTIALS",
    );
  }

  if (userRecord.status !== "active") {
    throw forbidden(
      userRecord.suspendedReason ||
        "This account is not active yet. Please contact management for help.",
      "ACCOUNT_INACTIVE",
    );
  }

  const { sessionDays, accessMinutes } = await sessionSettings();
  const sessionId = crypto.randomUUID();
  const refreshSecret = randomToken(48);
  const refreshToken = `${sessionId}.${refreshSecret}`;
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: {
      id: sessionId,
      userId: userRecord.id,
      tokenHash: sha256(refreshSecret),
      expiresAt,
      ip: clientIp(input.request),
      userAgent: userAgent(input.request),
    },
  });

  await db.user.update({ where: { id: userRecord.id }, data: { lastLoginAt: new Date() } });

  const permissions = await permissionsForRole(userRecord.role);
  const accessToken = await signAccessToken({
    userId: userRecord.id,
    role: userRecord.role,
    sessionId,
    lifetimeMinutes: accessMinutes,
  });

  const {
    passwordHash: _passwordHash,
    suspendedReason: _reason,
    deletedAt: _deleted,
    ...user
  } = userRecord;

  void _passwordHash;
  void _reason;
  void _deleted;

  return {
    user,
    permissions,
    accessToken,
    refreshToken,
    accessSeconds: accessMinutes * 60,
    refreshSeconds: sessionDays * 24 * 60 * 60,
  };
}

export type RefreshResult = {
  user: SafeUser;
  permissions: string[];
  accessToken: string;
  refreshToken: string;
  accessSeconds: number;
  refreshSeconds: number;
};

function parseRefreshToken(raw: string | undefined): { sessionId: string; secret: string } | null {
  if (!raw) return null;
  const separator = raw.indexOf(".");
  if (separator <= 0 || separator === raw.length - 1) return null;
  return { sessionId: raw.slice(0, separator), secret: raw.slice(separator + 1) };
}

export async function refreshSession(rawToken: string | undefined): Promise<RefreshResult> {
  const parsed = parseRefreshToken(rawToken);
  if (!parsed)
    throw unauthorized("Your session has ended. Please sign in again.", "REFRESH_INVALID");

  const session = await db.session.findUnique({
    where: { id: parsed.sessionId },
    include: { user: { select: { ...safeUserSelect, deletedAt: true } } },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt.getTime() <= Date.now() ||
    session.user.deletedAt ||
    !safeEqual(session.tokenHash, sha256(parsed.secret))
  ) {
    throw unauthorized("Your session has ended. Please sign in again.", "REFRESH_INVALID");
  }

  if (session.user.status !== "active") {
    throw forbidden(
      "This account is currently unavailable. Please contact management.",
      "ACCOUNT_INACTIVE",
    );
  }

  const { accessMinutes } = await sessionSettings();
  const newSecret = randomToken(48);
  const refreshToken = `${session.id}.${newSecret}`;
  await db.session.update({
    where: { id: session.id },
    data: { tokenHash: sha256(newSecret), lastUsedAt: new Date() },
  });

  const accessToken = await signAccessToken({
    userId: session.user.id,
    role: session.user.role,
    sessionId: session.id,
    lifetimeMinutes: accessMinutes,
  });

  const permissions = await permissionsForRole(session.user.role);
  const { deletedAt: _deletedAt, ...user } = session.user;
  void _deletedAt;
  const refreshSeconds = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));

  return {
    user,
    permissions,
    accessToken,
    refreshToken,
    accessSeconds: accessMinutes * 60,
    refreshSeconds,
  };
}

export async function resolvePrincipalFromToken(token: string | undefined): Promise<Principal> {
  if (!token) throw unauthorized();
  const payload = await verifyAccessToken(token);
  const session = await db.session.findFirst({
    where: {
      id: payload.sid,
      userId: payload.sub,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (!session)
    throw unauthorized("Your session has ended. Please sign in again.", "SESSION_REVOKED");

  const user = await loadUser(payload.sub);
  if (!user) throw unauthorized("Your account is no longer available.", "USER_NOT_FOUND");
  if (user.status !== "active") {
    throw forbidden("This account is currently unavailable.", "ACCOUNT_INACTIVE");
  }

  const permissions = await permissionsForRole(user.role);
  return { user, permissions, sessionId: session.id };
}

export async function revokeRefreshToken(rawToken: string | undefined): Promise<string | null> {
  const parsed = parseRefreshToken(rawToken);
  if (!parsed) return null;
  const session = await db.session.findUnique({
    where: { id: parsed.sessionId },
    select: { id: true, userId: true, tokenHash: true },
  });
  if (!session) return null;
  if (rawToken && session.tokenHash !== sha256(parsed.secret)) return session.userId;
  await db.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  return session.userId;
}

export async function revokeSessionForUser(sessionId: string, userId: string): Promise<void> {
  const result = await db.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) throw notFound("That session could not be found.");
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const result = await db.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

export async function listSessions(userId: string, currentSessionId: string) {
  const sessions = await db.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
    select: {
      id: true,
      ip: true,
      userAgent: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
    },
  });
  return sessions.map((session) => ({
    ...session,
    current: session.id === currentSessionId,
    device: describeUserAgent(session.userAgent),
  }));
}

function describeUserAgent(value: string | null): string {
  if (!value) return "Unknown device";
  if (/iphone|ipad|ipod/i.test(value)) return "Apple mobile device";
  if (/android/i.test(value)) return "Android device";
  if (/edg\//i.test(value)) return "Microsoft Edge";
  if (/chrome\//i.test(value)) return "Chrome";
  if (/safari\//i.test(value)) return "Safari";
  if (/firefox\//i.test(value)) return "Firefox";
  return "Web browser";
}

export const cookieNames = {
  access: env.ACCESS_COOKIE_NAME,
  refresh: env.REFRESH_COOKIE_NAME,
};

export async function permissionsForCurrentRole(): Promise<Record<string, string[]>> {
  const roles = await db.role.findMany({
    select: { key: true, permissions: { select: { permission: { select: { key: true } } } } },
  });
  return Object.fromEntries(
    roles.map((role) => [role.key, role.permissions.map((entry) => entry.permission.key)]),
  );
}
