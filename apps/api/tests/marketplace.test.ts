import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { db } from "../src/db.js";
import { buildApp } from "../src/app.js";

const staffEmail = "amara.okafor@denobelpro.com";
const adminEmail = "admin@denobelpro.local";
const demoPassword = "Denobelpro!2026";
const invitePassword = "PrivateInvite!2026";
const changedStaffPassword = "IntegrationStaff!2026";
const testEmail = `integration.invite.${Date.now()}@example.com`;
const staffTestEmail = "integration.staff@example.com";

let app: FastifyInstance;
let staffCookie = "";
let adminCookie = "";
let invitationToken = "";
let clientCookie = "";
let createdStaffId = "";
let createdStaffTemporaryPassword = "";
let resetStaffTemporaryPassword = "";
let resetClientTemporaryPassword = "";
let createdStaffCookie = "";
let createdStaffSecondCookie = "";

function cookiesFrom(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers["set-cookie"];
  const values = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  return values.map((value) => value.split(";")[0]).join("; ");
}

async function login(email: string, password = demoPassword): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });
  expect(response.statusCode, response.body).toBe(200);
  const cookie = cookiesFrom(response);
  expect(cookie).toContain("dlp_access=");
  expect(cookie).toContain("dlp_refresh=");
  return cookie;
}

async function cleanupTestData(): Promise<void> {
  const user = await db.user.findUnique({
    where: { email: testEmail },
    select: { id: true },
  });
  const relationshipIds = user
    ? (
        await db.relationship.findMany({
          where: { clientId: user.id },
          select: { id: true },
        })
      ).map((relationship) => relationship.id)
    : [];
  const orderIds = relationshipIds.length
    ? (
        await db.order.findMany({
          where: { relationshipId: { in: relationshipIds } },
          select: { id: true },
        })
      ).map((order) => order.id)
    : [];

  await db.notification.deleteMany({
    where: {
      OR: [
        ...(user ? [{ userId: user.id }] : []),
        ...(relationshipIds.length
          ? [{ data: { path: ["relationshipId"], equals: relationshipIds[0] } }]
          : []),
        ...orderIds.map((orderId) => ({ data: { path: ["orderId"], equals: orderId } })),
      ],
    },
  });
  await db.invitation.deleteMany({
    where: {
      OR: [
        { email: testEmail },
        ...(relationshipIds.length ? [{ relationshipId: { in: relationshipIds } }] : []),
      ],
    },
  });
  if (orderIds.length) {
    await db.ledgerEntry.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.dispute.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.refund.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await db.order.deleteMany({ where: { id: { in: orderIds } } });
  }
  if (relationshipIds.length) {
    await db.relationship.deleteMany({ where: { id: { in: relationshipIds } } });
  }
  if (user) {
    await db.user.delete({ where: { id: user.id } });
  }

  const testStaff = await db.user.findUnique({
    where: { email: staffTestEmail },
    select: { id: true },
  });
  if (testStaff) {
    await db.auditLog.deleteMany({
      where: { OR: [{ actorId: testStaff.id }, { entityId: testStaff.id }] },
    });
    await db.user.delete({ where: { id: testStaff.id } });
  }
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  await cleanupTestData();
  staffCookie = await login(staffEmail);
  adminCookie = await login(adminEmail);
});

afterAll(async () => {
  await cleanupTestData();
  await app.close();
});

describe("public API", () => {
  it("serves bootstrap content and returns 404 for a missing page", async () => {
    const bootstrap = await app.inject({
      method: "GET",
      url: "/api/v1/public/bootstrap",
    });
    expect(bootstrap.statusCode).toBe(200);
    const payload = bootstrap.json() as { data: { content: Record<string, string> } };
    expect(payload.data.content["home.hero.titleLead"]).toBeTruthy();

    const missing = await app.inject({
      method: "GET",
      url: "/api/v1/public/pages/definitely-not-a-page",
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });
});

describe("invitation lifecycle", () => {
  it("requires authentication for workspace access", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/workspace" });
    expect(response.statusCode).toBe(401);
  });

  it("returns the staff workspace", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/workspace",
      headers: { cookie: staffCookie },
    });
    expect(response.statusCode).toBe(200);
    const payload = response.json() as {
      data: { me: { user: { email: string; role: string } }; gigs: unknown[] };
    };
    expect(payload.data.me.user.email).toBe(staffEmail);
    expect(payload.data.me.user.role).toBe("staff");
    expect(payload.data.gigs.length).toBeGreaterThan(0);
  });

  it("rejects invitations for an existing account", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/workspace/invitations",
      headers: { cookie: staffCookie },
      payload: { email: "grace@acme.test" },
    });
    expect(response.statusCode).toBe(409);
  });

  it("creates an invitation with a working public link", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/workspace/invitations",
      headers: { cookie: staffCookie },
      payload: { email: testEmail, message: "Let us work together." },
    });
    expect(response.statusCode, response.body).toBe(200);
    const payload = response.json() as { data: { item: { invitePath: string } } };
    expect(payload.data.item.invitePath).toMatch(/^\/invite\/[A-Za-z0-9_-]+$/);
    invitationToken = payload.data.item.invitePath.split("/").pop() ?? "";
    expect(invitationToken.length).toBeGreaterThan(20);

    const lookup = await app.inject({
      method: "GET",
      url: `/api/v1/public/invitations/${invitationToken}`,
    });
    expect(lookup.statusCode).toBe(200);
    const invitation = lookup.json() as {
      data: { email: string; staff: { name: string }; message: string };
    };
    expect(invitation.data.email).toBe(testEmail);
    expect(invitation.data.staff.name).toBeTruthy();
    expect(invitation.data.message).toBe("Let us work together.");
  });

  it("accepts the invitation, creates the relationship and signs the client in", async () => {
    const invalid = await app.inject({
      method: "POST",
      url: `/api/v1/public/invitations/${invitationToken}/accept`,
      payload: { name: "Integration Client", password: "short" },
    });
    expect(invalid.statusCode).toBe(400);

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/public/invitations/${invitationToken}/accept`,
      payload: {
        name: "Integration Client",
        password: invitePassword,
        company: "Integration Co",
      },
    });
    expect(response.statusCode, response.body).toBe(200);
    const payload = response.json() as {
      data: { user: { email: string; role: string }; redirectTo: string };
    };
    expect(payload.data.user.email).toBe(testEmail);
    expect(payload.data.user.role).toBe("client");
    expect(payload.data.redirectTo).toBe("/workspace");

    clientCookie = cookiesFrom(response);
    expect(clientCookie).toContain("dlp_access=");

    const workspace = await app.inject({
      method: "GET",
      url: "/api/v1/workspace",
      headers: { cookie: clientCookie },
    });
    expect(workspace.statusCode).toBe(200);
    const data = workspace.json() as {
      data: { relationships: unknown[]; conversations: unknown[]; gigs: unknown[] };
    };
    expect(data.data.relationships).toHaveLength(1);
    expect(data.data.conversations).toHaveLength(1);
    expect(data.data.gigs.length).toBeGreaterThan(0);

    const reused = await app.inject({
      method: "POST",
      url: `/api/v1/public/invitations/${invitationToken}/accept`,
      payload: { name: "Someone Else", password: "AnotherPassword!2026" },
    });
    expect(reused.statusCode).toBe(409);
  });

  it("updates the client profile and changes the password", async () => {
    const profile = await app.inject({
      method: "PATCH",
      url: "/api/v1/account/profile",
      headers: { cookie: clientCookie },
      payload: {
        name: "Integration Client Updated",
        phone: "+234 800 000 0000",
        company: "Updated Integration Co",
        timezone: "Africa/Lagos",
      },
    });
    expect(profile.statusCode, profile.body).toBe(200);
    const updated = profile.json() as {
      data: { user: { name: string; phone: string; clientProfile: { company: string } } };
    };
    expect(updated.data.user.name).toBe("Integration Client Updated");
    expect(updated.data.user.clientProfile.company).toBe("Updated Integration Co");

    const wrong = await app.inject({
      method: "POST",
      url: "/api/v1/account/password",
      headers: { cookie: clientCookie },
      payload: { currentPassword: "wrong-password", newPassword: "ChangedInvite!2026" },
    });
    expect(wrong.statusCode).toBe(400);

    const changed = await app.inject({
      method: "POST",
      url: "/api/v1/account/password",
      headers: { cookie: clientCookie },
      payload: { currentPassword: invitePassword, newPassword: "ChangedInvite!2026" },
    });
    expect(changed.statusCode, changed.body).toBe(200);
    expect((changed.json() as { data: { success: boolean } }).data.success).toBe(true);

    const relogin = await login(testEmail, "ChangedInvite!2026");
    expect(relogin).toContain("dlp_access=");
  });

  it("completes an order and captures a review with a staff reply", async () => {
    const client = await db.user.findUnique({ where: { email: testEmail }, select: { id: true } });
    const relationship = await db.relationship.findFirst({
      where: { clientId: client?.id },
      select: { id: true, staffId: true, clientId: true },
    });
    expect(relationship).toBeTruthy();
    if (!relationship) throw new Error("Test relationship was not created.");

    const conversation = await db.conversation.findUnique({
      where: { relationshipId: relationship.id },
      select: { id: true },
    });
    expect(conversation).toBeTruthy();
    if (!conversation) throw new Error("Test conversation was not created.");

    const clientAttempt = await app.inject({
      method: "POST",
      url: `/api/v1/workspace/conversations/${conversation.id}/offers`,
      headers: { cookie: clientCookie },
      payload: {
        title: "Client should not send this",
        price: 10000,
        deliveryDays: 1,
        revisions: 0,
      },
    });
    expect(clientAttempt.statusCode).toBe(403);

    const offerCreated = await app.inject({
      method: "POST",
      url: `/api/v1/workspace/conversations/${conversation.id}/offers`,
      headers: { cookie: staffCookie },
      payload: {
        title: "Integration review order",
        description: "A complete order lifecycle for review coverage.",
        price: 50000,
        deliveryDays: 2,
        revisions: 1,
      },
    });
    expect(offerCreated.statusCode, offerCreated.body).toBe(200);
    const createdOffer = (
      offerCreated.json() as {
        data: {
          item: { id: string };
          message: { type: string; attachments: { offerId: string } };
        };
      }
    ).data;
    expect(createdOffer.message.type).toBe("offer");
    expect(createdOffer.message.attachments.offerId).toBe(createdOffer.item.id);
    const offerId = createdOffer.item.id;

    const staffAttempt = await app.inject({
      method: "POST",
      url: `/api/v1/workspace/offers/${offerId}/respond`,
      headers: { cookie: staffCookie },
      payload: { action: "accept" },
    });
    expect(staffAttempt.statusCode).toBe(403);

    const cancellable = await app.inject({
      method: "POST",
      url: `/api/v1/workspace/conversations/${conversation.id}/offers`,
      headers: { cookie: staffCookie },
      payload: { title: "Offer to cancel", price: 25000, deliveryDays: 2, revisions: 1 },
    });
    expect(cancellable.statusCode, cancellable.body).toBe(200);
    const cancellableId = (cancellable.json() as { data: { item: { id: string } } }).data.item.id;
    const cancelled = await app.inject({
      method: "POST",
      url: `/api/v1/workspace/offers/${cancellableId}/respond`,
      headers: { cookie: clientCookie },
      payload: { action: "cancel", reason: "Scope changed" },
    });
    expect(cancelled.statusCode, cancelled.body).toBe(200);
    expect((cancelled.json() as { data: { item: { status: string } } }).data.item.status).toBe(
      "cancelled",
    );

    const accepted = await app.inject({
      method: "POST",
      url: `/api/v1/workspace/offers/${offerId}/respond`,
      headers: { cookie: clientCookie },
      payload: { action: "accept" },
    });
    expect(accepted.statusCode, accepted.body).toBe(200);
    const orderId = (accepted.json() as { data: { order: { id: string } } }).data.order.id;

    for (const [cookie, action] of [
      [clientCookie, "pay"],
      [staffCookie, "deliver"],
      [clientCookie, "complete"],
    ] as const) {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/workspace/orders/${orderId}/actions`,
        headers: { cookie },
        payload: { action },
      });
      expect(response.statusCode, `${action}: ${response.body}`).toBe(200);
    }

    const created = await app.inject({
      method: "POST",
      url: `/api/v1/workspace/orders/${orderId}/review`,
      headers: { cookie: clientCookie },
      payload: {
        quality: 5,
        communication: 4,
        delivery: 5,
        comment: "Thoughtful work and a clear process.",
      },
    });
    expect(created.statusCode, created.body).toBe(200);
    const reviewId = (created.json() as { data: { item: { id: string } } }).data.item.id;

    const duplicate = await app.inject({
      method: "POST",
      url: `/api/v1/workspace/orders/${orderId}/review`,
      headers: { cookie: clientCookie },
      payload: { quality: 5, communication: 5, delivery: 5 },
    });
    expect(duplicate.statusCode).toBe(409);

    const reply = await app.inject({
      method: "POST",
      url: `/api/v1/workspace/reviews/${reviewId}/reply`,
      headers: { cookie: staffCookie },
      payload: { body: "Thank you. It was a pleasure working together." },
    });
    expect(reply.statusCode, reply.body).toBe(200);
    expect(
      (reply.json() as { data: { item: { staffReply: string } } }).data.item.staffReply,
    ).toContain("pleasure");
  });
});

describe("admin API", () => {
  it("exposes users, roles, settings, content, theme, flags and audit", async () => {
    const requests = [
      ["/api/v1/admin/users?pageSize=5", "users"],
      ["/api/v1/admin/roles", "roles"],
      ["/api/v1/admin/settings", "settings"],
      ["/api/v1/admin/content", "content"],
      ["/api/v1/admin/theme", "theme"],
      ["/api/v1/admin/feature-flags", "flags"],
      ["/api/v1/admin/audit-logs?pageSize=5", "audit"],
    ] as const;

    for (const [url] of requests) {
      const response = await app.inject({
        method: "GET",
        url,
        headers: { cookie: adminCookie },
      });
      expect(response.statusCode, `${url}: ${response.body}`).toBe(200);
      const payload = response.json() as { data?: unknown };
      expect(payload.data).toBeTruthy();
    }
  });

  it("does not allow an admin to change their own role", async () => {
    const me = await db.user.findUnique({
      where: { email: adminEmail },
      select: { id: true },
    });
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/users/${me?.id}`,
      headers: { cookie: adminCookie },
      payload: { role: "staff" },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe("staff provisioning and forced password change", () => {
  it("creates an approved staff account with a one-time temporary password", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/users",
      headers: { cookie: adminCookie },
      payload: {
        name: "Integration Staff",
        email: staffTestEmail,
        title: "Quality Lead",
        department: "Testing",
      },
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");

    const payload = response.json() as {
      data: {
        item: {
          id: string;
          name: string;
          email: string;
          role: string;
          status: string;
          staffProfile: { approvalStatus: string } | null;
        };
        temporaryPassword: string;
      };
    };
    createdStaffId = payload.data.item.id;
    createdStaffTemporaryPassword = payload.data.temporaryPassword;

    expect(payload.data.item).toMatchObject({
      name: "Integration Staff",
      email: staffTestEmail,
      role: "staff",
      status: "active",
      staffProfile: { approvalStatus: "approved" },
    });
    expect(createdStaffTemporaryPassword.length).toBeGreaterThan(20);

    const record = await db.user.findUnique({
      where: { email: staffTestEmail },
      select: {
        passwordHash: true,
        mustChangePassword: true,
        role: true,
        status: true,
        staffProfile: { select: { approvalStatus: true, inviteCode: true } },
      },
    });
    expect(record?.role).toBe("staff");
    expect(record?.status).toBe("active");
    expect(record?.mustChangePassword).toBe(true);
    expect(record?.passwordHash).not.toBe(createdStaffTemporaryPassword);
    expect(record?.passwordHash).toContain("$argon2");
    expect(record?.staffProfile?.approvalStatus).toBe("approved");
    expect(record?.staffProfile?.inviteCode.length).toBeGreaterThan(10);

    const list = await app.inject({
      method: "GET",
      url: `/api/v1/admin/users?search=${encodeURIComponent(staffTestEmail)}`,
      headers: { cookie: adminCookie },
    });
    expect(list.statusCode, list.body).toBe(200);
    expect(list.body).not.toContain(createdStaffTemporaryPassword);
  });

  it("rejects duplicate emails and staff attempts to create accounts", async () => {
    const duplicate = await app.inject({
      method: "POST",
      url: "/api/v1/admin/users",
      headers: { cookie: adminCookie },
      payload: { name: "Duplicate Staff", email: staffTestEmail },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ error: { code: "EMAIL_IN_USE" } });

    const forbidden = await app.inject({
      method: "POST",
      url: "/api/v1/admin/users",
      headers: { cookie: staffCookie },
      payload: { name: "Forbidden Staff", email: staffTestEmail },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it("forces a password change before allowing workspace access", async () => {
    const firstLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: staffTestEmail, password: createdStaffTemporaryPassword },
    });
    expect(firstLogin.statusCode, firstLogin.body).toBe(200);
    createdStaffCookie = cookiesFrom(firstLogin);
    expect((firstLogin.json() as { data: { redirectTo: string } }).data.redirectTo).toBe(
      "/account/password",
    );
    expect(
      (firstLogin.json() as { data: { user: { mustChangePassword: boolean } } }).data.user
        .mustChangePassword,
    ).toBe(true);

    const secondLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: staffTestEmail, password: createdStaffTemporaryPassword },
    });
    expect(secondLogin.statusCode, secondLogin.body).toBe(200);
    createdStaffSecondCookie = cookiesFrom(secondLogin);

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: createdStaffCookie },
    });
    expect(me.statusCode, me.body).toBe(200);
    expect(
      (me.json() as { data: { user: { mustChangePassword: boolean } } }).data.user
        .mustChangePassword,
    ).toBe(true);

    const workspace = await app.inject({
      method: "GET",
      url: "/api/v1/workspace",
      headers: { cookie: createdStaffCookie },
    });
    expect(workspace.statusCode).toBe(403);
    expect(workspace.json()).toMatchObject({
      error: { code: "PASSWORD_CHANGE_REQUIRED" },
    });
  });

  it("clears the flag, revokes other sessions, and restores workspace access", async () => {
    const changed = await app.inject({
      method: "POST",
      url: "/api/v1/account/password",
      headers: { cookie: createdStaffCookie },
      payload: {
        currentPassword: createdStaffTemporaryPassword,
        newPassword: changedStaffPassword,
      },
    });
    expect(changed.statusCode, changed.body).toBe(200);
    const changedPayload = changed.json() as {
      data: { redirectTo: string; sessionsRevoked: number };
    };
    expect(changedPayload.data.redirectTo).toBe("/workspace");
    expect(changedPayload.data.sessionsRevoked).toBe(1);

    const secondSession = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: createdStaffSecondCookie },
    });
    expect(secondSession.statusCode).toBe(401);

    const workspace = await app.inject({
      method: "GET",
      url: "/api/v1/workspace",
      headers: { cookie: createdStaffCookie },
    });
    expect(workspace.statusCode, workspace.body).toBe(200);

    const oldPassword = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: staffTestEmail, password: createdStaffTemporaryPassword },
    });
    expect(oldPassword.statusCode).toBe(401);
  });

  it("lets an admin reset a staff password and revokes every session", async () => {
    const reset = await app.inject({
      method: "POST",
      url: `/api/v1/admin/users/${createdStaffId}/reset-password`,
      headers: { cookie: adminCookie },
    });
    expect(reset.statusCode, reset.body).toBe(200);
    expect(reset.headers["cache-control"]).toBe("no-store");

    const payload = reset.json() as {
      data: { temporaryPassword: string; sessionsRevoked: number };
    };
    resetStaffTemporaryPassword = payload.data.temporaryPassword;
    expect(resetStaffTemporaryPassword.length).toBeGreaterThan(20);
    expect(payload.data.sessionsRevoked).toBeGreaterThanOrEqual(1);

    const record = await db.user.findUnique({
      where: { id: createdStaffId },
      select: { mustChangePassword: true, passwordHash: true },
    });
    expect(record?.mustChangePassword).toBe(true);
    expect(record?.passwordHash).not.toBe(resetStaffTemporaryPassword);

    const activeSessions = await db.session.count({
      where: { userId: createdStaffId, revokedAt: null },
    });
    expect(activeSessions).toBe(0);

    const previousCookie = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: createdStaffCookie },
    });
    expect(previousCookie.statusCode).toBe(401);

    const oldPassword = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: staffTestEmail, password: changedStaffPassword },
    });
    expect(oldPassword.statusCode).toBe(401);

    const newLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: staffTestEmail, password: resetStaffTemporaryPassword },
    });
    expect(newLogin.statusCode, newLogin.body).toBe(200);
    expect((newLogin.json() as { data: { redirectTo: string } }).data.redirectTo).toBe(
      "/account/password",
    );
  });

  it("lets an admin reset a client password and forces a change", async () => {
    const client = await db.user.findUnique({
      where: { email: testEmail },
      select: { id: true },
    });
    expect(client).toBeTruthy();
    if (!client) throw new Error("Test client was not created.");

    const reset = await app.inject({
      method: "POST",
      url: `/api/v1/admin/users/${client.id}/reset-password`,
      headers: { cookie: adminCookie },
    });
    expect(reset.statusCode, reset.body).toBe(200);
    expect(reset.headers["cache-control"]).toBe("no-store");

    const payload = reset.json() as {
      data: { temporaryPassword: string; sessionsRevoked: number };
    };
    resetClientTemporaryPassword = payload.data.temporaryPassword;
    expect(resetClientTemporaryPassword.length).toBeGreaterThan(20);
    expect(payload.data.sessionsRevoked).toBeGreaterThanOrEqual(1);

    const record = await db.user.findUnique({
      where: { id: client.id },
      select: { mustChangePassword: true, passwordHash: true },
    });
    expect(record?.mustChangePassword).toBe(true);
    expect(record?.passwordHash).not.toBe(resetClientTemporaryPassword);

    const activeSessions = await db.session.count({
      where: { userId: client.id, revokedAt: null },
    });
    expect(activeSessions).toBe(0);

    const previousCookie = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: clientCookie },
    });
    expect(previousCookie.statusCode).toBe(401);

    const oldPassword = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: testEmail, password: "ChangedInvite!2026" },
    });
    expect(oldPassword.statusCode).toBe(401);

    const newLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: testEmail, password: resetClientTemporaryPassword },
    });
    expect(newLogin.statusCode, newLogin.body).toBe(200);
    expect((newLogin.json() as { data: { redirectTo: string } }).data.redirectTo).toBe(
      "/account/password",
    );
  });

  it("requires user administration permission and rejects admin resets", async () => {
    const staffAttempt = await app.inject({
      method: "POST",
      url: `/api/v1/admin/users/${createdStaffId}/reset-password`,
      headers: { cookie: staffCookie },
    });
    expect(staffAttempt.statusCode).toBe(403);

    const admin = await db.user.findUnique({
      where: { email: adminEmail },
      select: { id: true },
    });
    const adminReset = await app.inject({
      method: "POST",
      url: `/api/v1/admin/users/${admin?.id}/reset-password`,
      headers: { cookie: adminCookie },
    });
    expect(adminReset.statusCode).toBe(400);
  });

  it("never writes temporary passwords to audit records", async () => {
    const client = await db.user.findUnique({
      where: { email: testEmail },
      select: { id: true },
    });
    const audits = await db.auditLog.findMany({
      where: { entityId: { in: [createdStaffId, client?.id ?? ""] } },
      select: { action: true, before: true, after: true },
    });
    expect(audits.some((entry) => entry.action === "user.create")).toBe(true);
    expect(audits.some((entry) => entry.action === "user.password.reset")).toBe(true);
    const serialized = JSON.stringify(audits);
    expect(serialized).not.toContain(createdStaffTemporaryPassword);
    expect(serialized).not.toContain(resetStaffTemporaryPassword);
    expect(serialized).not.toContain(resetClientTemporaryPassword);
  });
});
