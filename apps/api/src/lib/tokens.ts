import { jwtVerify, SignJWT } from "jose";
import { env } from "../env.js";
import { unauthorized } from "./errors.js";

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export type AccessTokenPayload = {
  sub: string;
  role: string;
  sid: string;
  typ: "access";
};

export async function signAccessToken(input: {
  userId: string;
  role: string;
  sessionId: string;
  lifetimeMinutes: number;
}): Promise<string> {
  return new SignJWT({ role: input.role, sid: input.sessionId, typ: "access" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(input.userId)
    .setIssuer(env.JWT_ISSUER)
    .setAudience("denobelpro-web")
    .setIssuedAt()
    .setExpirationTime(`${input.lifetimeMinutes}m`)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: env.JWT_ISSUER,
      audience: "denobelpro-web",
    });
    if (
      payload.typ !== "access" ||
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string" ||
      typeof payload.role !== "string"
    ) {
      throw new Error("Unexpected token shape");
    }
    return {
      sub: payload.sub,
      role: payload.role,
      sid: payload.sid,
      typ: "access",
    };
  } catch {
    throw unauthorized("Your session has expired. Please sign in again.", "TOKEN_INVALID");
  }
}
