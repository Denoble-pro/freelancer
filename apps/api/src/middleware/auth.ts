import type { preHandlerHookHandler } from "fastify";
import { forbidden, unauthorized } from "../lib/errors.js";
import { cookieNames, resolvePrincipalFromToken, type Principal } from "../services/auth.js";

const passwordChangePaths = new Set([
  "GET /api/v1/auth/me",
  "POST /api/v1/account/password",
  "POST /api/v1/auth/logout",
  "POST /api/v1/auth/logout-all",
]);

export const authenticate: preHandlerHookHandler = async (request) => {
  const token = request.cookies[cookieNames.access];
  const principal = await resolvePrincipalFromToken(token);
  const path = request.url.split("?")[0] ?? request.url;

  if (principal.user.mustChangePassword && !passwordChangePaths.has(`${request.method} ${path}`)) {
    throw forbidden("Choose a new password before continuing.", "PASSWORD_CHANGE_REQUIRED");
  }

  request.principal = principal;
};

export function authorize(permission: string): preHandlerHookHandler {
  return async (request) => {
    if (!request.principal) {
      throw unauthorized();
    }
    if (!request.principal.permissions.includes(permission)) {
      throw forbidden("Your role does not include permission to do that.");
    }
  };
}

export function currentPrincipal(request: { principal?: Principal }): Principal {
  if (!request.principal) throw unauthorized();
  return request.principal;
}
