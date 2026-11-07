import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@dlp/db";
import { z } from "zod";
import { db } from "../db.js";
import { randomToken, sha256 } from "../lib/crypto.js";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { parseInput } from "../lib/http.js";
import { authenticate, currentPrincipal } from "../middleware/auth.js";
import { getSettingValue } from "../services/settings.js";
import { writeAudit } from "../lib/audit.js";

const idParams = z.object({ id: z.string().uuid() });

const personSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatarUrl: true,
} as const;

const messageSchema = z.object({
  body: z.string().trim().min(1, "Write a message first.").max(5000),
});

const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
  all: z.boolean().optional(),
});

const offerCreateSchema = z.object({
  gigId: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional(),
  price: z.number().positive().max(100_000_000),
  deliveryDays: z.number().int().min(1).max(365),
  revisions: z.number().int().min(0).max(50).default(1),
  expiresInDays: z.number().int().min(1).max(60).default(7),
});

const offerRespondSchema = z.object({
  action: z.enum(["accept", "cancel"]),
  reason: z.string().trim().max(1000).optional(),
});

const orderActionSchema = z.object({
  action: z.enum(["pay", "deliver", "complete", "revise", "cancel", "requirements"]),
  note: z.string().trim().max(5000).optional(),
  requirements: z.record(z.string()).optional(),
});

const reviewCreateSchema = z.object({
  quality: z.number().int().min(1).max(5),
  communication: z.number().int().min(1).max(5),
  delivery: z.number().int().min(1).max(5),
  comment: z.string().trim().max(3000).optional(),
});

const reviewReplySchema = z.object({
  body: z.string().trim().min(1, "Write a reply first.").max(3000),
});

const gigCreateSchema = z.object({
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(20).max(10000),
  categoryId: z.string().uuid().optional(),
  price: z.number().positive().max(100_000_000),
  deliveryDays: z.number().int().min(1).max(365),
  revisions: z.number().int().min(0).max(50).default(2),
  publish: z.boolean().default(false),
});

const invitationCreateSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  message: z.string().trim().max(2000).optional(),
});

const money = (value: unknown) => Number(value ?? 0);

function participant(
  conversation: {
    relationship: { staff: { id: string }; client: { id: string } };
  },
  meId: string,
) {
  return conversation.relationship.staff.id === meId
    ? conversation.relationship.client
    : conversation.relationship.staff;
}

async function orderForUser(id: string, userId: string, isAdmin: boolean) {
  const order = await db.order.findFirst({
    where: {
      id,
      ...(isAdmin ? {} : { OR: [{ staffId: userId }, { clientId: userId }] }),
    },
    include: {
      offer: true,
      gig: { select: { id: true, title: true, description: true } },
      staff: { select: personSelect },
      client: { select: personSelect },
      deliveries: { orderBy: { createdAt: "desc" } },
      revisions: { orderBy: { createdAt: "desc" } },
      payments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          provider: true,
          amount: true,
          currency: true,
          status: true,
          paidAt: true,
          createdAt: true,
        },
      },
      invoices: {
        orderBy: { issuedAt: "desc" },
        select: {
          id: true,
          number: true,
          type: true,
          amount: true,
          tax: true,
          total: true,
          currency: true,
          pdfUrl: true,
          issuedAt: true,
        },
      },
      events: { orderBy: { createdAt: "desc" }, take: 20 },
      review: true,
    },
  });
  if (!order) throw notFound("That order does not exist.");
  return order;
}

async function notify(
  userId: string,
  type: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  await db.notification.create({
    data: { userId, type, title, body, ...(data ? { data: data as Prisma.InputJsonValue } : {}) },
  });
}

async function nextSequence(
  tx: Prisma.TransactionClient,
  key: string,
  prefix: string,
): Promise<string> {
  const sequence = await tx.sequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${new Date().getFullYear()}-${String(sequence.value).padStart(5, "0")}`;
}

export const workspaceRoutes: FastifyPluginAsync = async (app) => {
  app.get("/workspace", { preHandler: [authenticate] }, async (request, reply) => {
    const principal = currentPrincipal(request);
    const me = principal.user;
    const isAdmin = me.role === "admin";

    const relationships = await db.relationship.findMany({
      where: {
        deletedAt: null,
        ...(isAdmin ? {} : { OR: [{ staffId: me.id }, { clientId: me.id }] }),
      },
      include: {
        staff: { select: personSelect },
        client: { select: personSelect },
        conversation: { select: { id: true, lastMessageAt: true, locked: true } },
      },
      orderBy: { lastInteractionAt: "desc" },
      take: 100,
    });

    const relationshipIds = relationships.map((relationship) => relationship.id);
    const orderScope = isAdmin ? {} : { OR: [{ staffId: me.id }, { clientId: me.id }] };
    const offerScope = isAdmin
      ? {}
      : {
          relationshipId: {
            in: relationshipIds.length ? relationshipIds : ["00000000-0000-4000-8000-000000000000"],
          },
        };

    const [
      conversations,
      offers,
      orders,
      gigs,
      categories,
      notifications,
      notificationCount,
      invitations,
    ] = await Promise.all([
      db.conversation.findMany({
        where: {
          relationshipId: {
            in: relationshipIds.length ? relationshipIds : ["00000000-0000-4000-8000-000000000000"],
          },
        },
        include: {
          relationship: {
            include: {
              staff: { select: personSelect },
              client: { select: personSelect },
            },
          },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { sender: { select: personSelect } },
          },
          _count: {
            select: {
              messages: { where: { senderId: { not: me.id }, readAt: null, deletedAt: null } },
            },
          },
        },
        orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      }),
      db.offer.findMany({
        where: offerScope,
        include: {
          relationship: {
            include: {
              staff: { select: personSelect },
              client: { select: personSelect },
            },
          },
          createdBy: { select: personSelect },
          order: { select: { id: true, number: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.order.findMany({
        where: orderScope,
        include: {
          staff: { select: personSelect },
          client: { select: personSelect },
          gig: { select: { id: true, title: true } },
          review: {
            select: {
              id: true,
              visible: true,
              quality: true,
              communication: true,
              delivery: true,
              comment: true,
              staffReply: true,
              repliedAt: true,
              createdAt: true,
            },
          },
          payments: { select: { id: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.gig.findMany({
        where: {
          deletedAt: null,
          ...(me.role === "staff"
            ? { staffId: me.id }
            : me.role === "client"
              ? {
                  status: { in: ["published", "live"] },
                  staffId: { in: relationships.map((relationship) => relationship.staffId) },
                }
              : {}),
        },
        include: {
          staff: {
            select: {
              ...personSelect,
              staffProfile: {
                select: {
                  title: true,
                  department: true,
                  bio: true,
                  skills: true,
                  availability: true,
                },
              },
            },
          },
          category: { select: { id: true, name: true, slug: true } },
          packages: { where: { active: true }, orderBy: { sortOrder: "asc" } },
          media: { orderBy: { sortOrder: "asc" }, take: 1 },
          _count: { select: { orders: true } },
        },
        orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
        take: 60,
      }),
      db.category.findMany({
        where: { archivedAt: null },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      db.notification.findMany({
        where: { userId: me.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      db.notification.count({ where: { userId: me.id, readAt: null } }),
      db.invitation.findMany({
        where:
          me.role === "staff" ? { staffId: me.id } : { id: "00000000-0000-4000-8000-000000000000" },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    const ratingRows = await db.review.groupBy({
      by: ["staffId"],
      where: { visible: true },
      _avg: { quality: true, communication: true, delivery: true },
      _count: { id: true },
    });
    const ratings = new Map(
      ratingRows.map((row) => [
        row.staffId,
        {
          count: row._count.id,
          average:
            (Number(row._avg.quality ?? 0) +
              Number(row._avg.communication ?? 0) +
              Number(row._avg.delivery ?? 0)) /
            3,
        },
      ]),
    );

    reply.header("Cache-Control", "no-store");
    return {
      data: {
        me: { ...principal, user: me },
        relationships,
        conversations: conversations.map((conversation) => ({
          id: conversation.id,
          relationshipId: conversation.relationshipId,
          locked: conversation.locked,
          lastMessageAt: conversation.lastMessageAt,
          unread: conversation._count.messages,
          participant: participant(conversation, me.id),
          lastMessage: conversation.messages[0] ?? null,
        })),
        offers: offers.map((offer) => ({
          ...offer,
          price: money(offer.price),
          canRespond:
            offer.relationship.clientId === me.id && ["sent", "viewed"].includes(offer.status),
          isMine: offer.createdById === me.id,
        })),
        orders: orders.map((order) => ({
          ...order,
          price: money(order.price),
          total: money(order.total),
          fee: money(order.fee),
          tax: money(order.tax),
        })),
        gigs: gigs.map((gig) => ({
          ...gig,
          packages: gig.packages.map((pkg) => ({ ...pkg, price: money(pkg.price) })),
          startingPrice: gig.packages.length
            ? Math.min(...gig.packages.map((pkg) => money(pkg.price)))
            : 0,
          rating: ratings.get(gig.staffId) ?? { count: 0, average: 0 },
        })),
        categories,
        notifications,
        unreadNotifications: notificationCount,
        invitations: invitations.map(({ tokenHash: _tokenHash, ...invitation }) => {
          void _tokenHash;
          return invitation;
        }),
        stats: {
          activeOrders: orders.filter((order) => !["completed", "cancelled"].includes(order.status))
            .length,
          unreadMessages: conversations.reduce(
            (total, conversation) => total + conversation._count.messages,
            0,
          ),
          pendingOffers: offers.filter(
            (offer) => ["sent", "viewed"].includes(offer.status) && offer.createdById !== me.id,
          ).length,
          completedOrders: orders.filter((order) => order.status === "completed").length,
          earnings: money(
            orders
              .filter((order) => order.status === "completed" && order.staffId === me.id)
              .reduce((total, order) => total + money(order.price), 0),
          ),
          spend: money(
            orders
              .filter((order) => order.status !== "cancelled" && order.clientId === me.id)
              .reduce((total, order) => total + money(order.total), 0),
          ),
        },
      },
    };
  });

  app.get("/workspace/orders/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const principal = currentPrincipal(request);
    const params = parseInput(idParams, request.params);
    const order = await orderForUser(params.id, principal.user.id, principal.user.role === "admin");
    const { price, fee, tax, total, offer, payments, invoices, ...rest } = order;

    reply.header("Cache-Control", "no-store");
    return {
      data: {
        item: {
          ...rest,
          price: money(price),
          fee: money(fee),
          tax: money(tax),
          total: money(total),
          offer: offer ? { ...offer, price: money(offer.price) } : null,
          payments: payments.map((payment) => ({ ...payment, amount: money(payment.amount) })),
          invoices: invoices.map((invoice) => ({
            ...invoice,
            amount: money(invoice.amount),
            tax: money(invoice.tax),
            total: money(invoice.total),
          })),
        },
      },
    };
  });

  app.get(
    "/workspace/conversations/:id/messages",
    { preHandler: [authenticate] },
    async (request) => {
      const principal = currentPrincipal(request);
      const params = parseInput(idParams, request.params);
      const conversation = await db.conversation.findFirst({
        where: {
          id: params.id,
          relationship: {
            OR: [{ staffId: principal.user.id }, { clientId: principal.user.id }],
            deletedAt: null,
          },
        },
        include: {
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
            take: 300,
            include: { sender: { select: personSelect } },
          },
        },
      });
      if (!conversation) throw notFound("That conversation does not exist.");
      return { data: { items: conversation.messages, locked: conversation.locked } };
    },
  );

  app.post(
    "/workspace/conversations/:id/messages",
    { preHandler: [authenticate] },
    async (request) => {
      const principal = currentPrincipal(request);
      const params = parseInput(idParams, request.params);
      const input = parseInput(messageSchema, request.body);
      const conversation = await db.conversation.findFirst({
        where: {
          id: params.id,
          relationship: {
            OR: [{ staffId: principal.user.id }, { clientId: principal.user.id }],
            deletedAt: null,
          },
        },
        include: {
          relationship: { select: { staffId: true, clientId: true } },
        },
      });
      if (!conversation) throw notFound("That conversation does not exist.");
      if (conversation.locked) throw forbidden("This conversation is locked.");

      const message = await db.message.create({
        data: {
          conversationId: conversation.id,
          senderId: principal.user.id,
          type: "text",
          body: input.body,
        },
        include: { sender: { select: personSelect } },
      });
      await db.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });
      await db.relationship.update({
        where: { id: conversation.relationshipId },
        data: { lastInteractionAt: new Date() },
      });
      const other =
        conversation.relationship.staffId === principal.user.id
          ? conversation.relationship.clientId
          : conversation.relationship.staffId;
      await notify(
        other,
        "message.received",
        `New message from ${principal.user.name}`,
        input.body.slice(0, 160),
        {
          conversationId: conversation.id,
        },
      );
      return { data: { item: message } };
    },
  );

  app.post("/workspace/conversations/:id/read", { preHandler: [authenticate] }, async (request) => {
    const principal = currentPrincipal(request);
    const params = parseInput(idParams, request.params);
    const conversation = await db.conversation.findFirst({
      where: {
        id: params.id,
        relationship: { OR: [{ staffId: principal.user.id }, { clientId: principal.user.id }] },
      },
      select: { id: true },
    });
    if (!conversation) throw notFound("That conversation does not exist.");
    await db.message.updateMany({
      where: {
        conversationId: conversation.id,
        senderId: { not: principal.user.id },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { data: { success: true } };
  });

  app.post(
    "/workspace/conversations/:id/offers",
    { preHandler: [authenticate] },
    async (request) => {
      const principal = currentPrincipal(request);
      const params = parseInput(idParams, request.params);
      const input = parseInput(offerCreateSchema, request.body);
      const conversation = await db.conversation.findFirst({
        where: {
          id: params.id,
          relationship: {
            OR: [{ staffId: principal.user.id }, { clientId: principal.user.id }],
            deletedAt: null,
          },
        },
        include: {
          relationship: { select: { id: true, staffId: true, clientId: true } },
        },
      });
      if (!conversation) throw notFound("That conversation does not exist.");
      if (conversation.relationship.staffId !== principal.user.id) {
        throw forbidden("Only the staff member can send an offer in this conversation.");
      }
      if (conversation.locked) throw forbidden("This conversation is locked.");

      if (input.gigId) {
        const gig = await db.gig.findFirst({
          where: {
            id: input.gigId,
            staffId: conversation.relationship.staffId,
            deletedAt: null,
            status: { in: ["published", "live"] },
          },
          select: { id: true },
        });
        if (!gig) throw notFound("That gig does not exist.");
      }

      const currency = await getSettingValue("branding.currency", "NGN");
      const now = new Date();
      const result = await db.$transaction(async (tx) => {
        const offer = await tx.offer.create({
          data: {
            relationshipId: conversation.relationship.id,
            gigId: input.gigId,
            createdById: principal.user.id,
            title: input.title,
            description: input.description,
            price: input.price,
            currency,
            deliveryDays: input.deliveryDays,
            revisions: input.revisions,
            status: "sent",
            expiresAt: new Date(now.getTime() + input.expiresInDays * 86_400_000),
          },
        });
        const message = await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderId: principal.user.id,
            type: "offer",
            body: input.title,
            attachments: {
              offerId: offer.id,
              title: input.title,
              price: input.price,
              currency,
              deliveryDays: input.deliveryDays,
              revisions: input.revisions,
            },
          },
          include: { sender: { select: personSelect } },
        });
        await tx.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: message.createdAt },
        });
        await tx.relationship.update({
          where: { id: conversation.relationship.id },
          data: { lastInteractionAt: message.createdAt },
        });
        return { offer, message };
      });

      await notify(
        conversation.relationship.clientId,
        "offer.received",
        "A new offer is waiting",
        input.title,
        { offerId: result.offer.id, conversationId: conversation.id },
      );
      await writeAudit({
        actorId: principal.user.id,
        action: "offer.create",
        entityType: "offer",
        entityId: result.offer.id,
        request,
        after: {
          relationshipId: conversation.relationship.id,
          conversationId: conversation.id,
          price: input.price,
          title: input.title,
        },
      });
      return {
        data: {
          item: { ...result.offer, price: money(result.offer.price) },
          message: result.message,
        },
      };
    },
  );

  app.post("/workspace/offers/:id/respond", { preHandler: [authenticate] }, async (request) => {
    const principal = currentPrincipal(request);
    const params = parseInput(idParams, request.params);
    const input = parseInput(offerRespondSchema, request.body);
    const offer = await db.offer.findFirst({
      where: { id: params.id },
      include: {
        relationship: {
          include: { staff: { select: personSelect }, client: { select: personSelect } },
        },
      },
    });
    if (!offer) throw notFound("That offer does not exist.");
    const isParticipant = [offer.relationship.staffId, offer.relationship.clientId].includes(
      principal.user.id,
    );
    if (!isParticipant) throw notFound("That offer does not exist.");
    if (offer.relationship.clientId !== principal.user.id)
      throw forbidden("Only the client can accept or cancel this offer.");
    if (!["sent", "viewed"].includes(offer.status))
      throw conflict("This offer has already been answered.");
    if (offer.expiresAt && offer.expiresAt.getTime() < Date.now())
      throw conflict("This offer has expired.");

    if (input.action === "cancel") {
      const updated = await db.offer.update({
        where: { id: offer.id },
        data: { status: "cancelled", declinedAt: new Date(), declineReason: input.reason },
      });
      await notify(offer.createdById, "offer.cancelled", "Offer cancelled", offer.title, {
        offerId: offer.id,
      });
      return { data: { item: { ...updated, price: money(updated.price) } } };
    }

    const result = await db.$transaction(async (tx) => {
      const accepted = await tx.offer.updateMany({
        where: { id: offer.id, status: { in: ["sent", "viewed"] } },
        data: { status: "accepted", acceptedAt: new Date() },
      });
      if (accepted.count !== 1) throw conflict("This offer has already been answered.");
      const number = await nextSequence(tx, "order", "DNP");
      const order = await tx.order.create({
        data: {
          number,
          relationshipId: offer.relationshipId,
          offerId: offer.id,
          gigId: offer.gigId,
          staffId: offer.relationship.staffId,
          clientId: offer.relationship.clientId,
          status: "awaiting_payment",
          price: offer.price,
          fee: 0,
          tax: 0,
          total: offer.price,
          currency: offer.currency,
          dueAt: new Date(Date.now() + offer.deliveryDays * 86_400_000),
          createdById: principal.user.id,
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "order.created",
          actorId: principal.user.id,
          data: { offerId: offer.id },
        },
      });
      return order;
    });

    await notify(
      offer.createdById,
      "offer.accepted",
      "Offer accepted",
      `${offer.title} is now an order.`,
      {
        orderId: result.id,
      },
    );
    await writeAudit({
      actorId: principal.user.id,
      action: "offer.accept",
      entityType: "offer",
      entityId: offer.id,
      request,
      after: { orderId: result.id, orderNumber: result.number },
    });
    return {
      data: { order: { ...result, price: money(result.price), total: money(result.total) } },
    };
  });

  app.post("/workspace/orders/:id/actions", { preHandler: [authenticate] }, async (request) => {
    const principal = currentPrincipal(request);
    const params = parseInput(idParams, request.params);
    const input = parseInput(orderActionSchema, request.body);
    const order = await orderForUser(params.id, principal.user.id, principal.user.role === "admin");
    const isStaff = order.staffId === principal.user.id;
    const isClient = order.clientId === principal.user.id;
    const isAdmin = principal.user.role === "admin";
    const now = new Date();

    if (order.status === "cancelled") throw conflict("This order has been cancelled.");

    if (input.action === "pay") {
      if (!isClient && !isAdmin) throw forbidden("Only the client can pay for this order.");
      if (order.status !== "awaiting_payment")
        throw conflict("This order is not waiting for payment.");
      const autoCompleteDays = await getSettingValue("marketplace.autoCompleteDays", 7);
      const invoicePrefix = await getSettingValue("branding.invoicePrefix", "INV");
      const updated = await db.$transaction(async (tx) => {
        const number = await nextSequence(tx, "invoice", invoicePrefix);
        await tx.payment.create({
          data: {
            orderId: order.id,
            provider: "manual",
            providerRef: `manual-${Date.now()}`,
            amount: order.total,
            currency: order.currency,
            status: "paid",
            paidAt: now,
            rawPayload: { method: "manual", recordedBy: principal.user.id },
          },
        });
        await tx.invoice.create({
          data: {
            number,
            orderId: order.id,
            userId: order.clientId,
            type: "invoice",
            amount: order.price,
            tax: order.tax,
            total: order.total,
            currency: order.currency,
          },
        });
        await tx.ledgerEntry.create({
          data: {
            account: "escrow",
            orderId: order.id,
            type: "payment_received",
            debit: 0,
            credit: order.total,
            currency: order.currency,
            metadata: { orderNumber: order.number },
          },
        });
        const next = await tx.order.update({
          where: { id: order.id },
          data: {
            status: "in_progress",
            dueAt: new Date(now.getTime() + (order.offer?.deliveryDays ?? 7) * 86_400_000),
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: "order.paid",
            actorId: principal.user.id,
            data: { amount: money(order.total) },
          },
        });
        return { order: next, invoiceNumber: number };
      });
      await notify(
        order.staffId,
        "order.paid",
        "Payment received",
        `${order.number} is now in progress.`,
        {
          orderId: order.id,
        },
      );
      return {
        data: {
          item: {
            ...updated.order,
            price: money(updated.order.price),
            total: money(updated.order.total),
          },
          invoiceNumber: updated.invoiceNumber,
        },
      };
    }

    if (input.action === "requirements") {
      if (!isClient && !isAdmin) throw forbidden("Only the client can submit requirements.");
      if (!input.requirements) throw badRequest("Add the requirements first.");
      const updated = await db.order.update({
        where: { id: order.id },
        data: { requirements: input.requirements, requirementsSubmittedAt: now },
      });
      await db.orderEvent.create({
        data: {
          orderId: order.id,
          type: "order.requirements_submitted",
          actorId: principal.user.id,
        },
      });
      await notify(
        order.staffId,
        "order.requirements",
        "Requirements submitted",
        `Requirements for ${order.number} are ready.`,
        {
          orderId: order.id,
        },
      );
      return {
        data: { item: { ...updated, price: money(updated.price), total: money(updated.total) } },
      };
    }

    if (input.action === "deliver") {
      if (!isStaff && !isAdmin) throw forbidden("Only the staff member can deliver this order.");
      if (!["in_progress", "revision_requested"].includes(order.status)) {
        throw conflict("This order cannot be delivered in its current state.");
      }
      const autoCompleteDays = await getSettingValue("marketplace.autoCompleteDays", 7);
      const revisionNumber = order.revisions.length + 1;
      const updated = await db.$transaction(async (tx) => {
        await tx.orderDelivery.create({
          data: {
            orderId: order.id,
            staffId: order.staffId,
            message: input.note || "Your delivery is ready.",
            revisionNumber,
          },
        });
        const next = await tx.order.update({
          where: { id: order.id },
          data: {
            status: "delivered",
            deliveredAt: now,
            autoCompleteAt: new Date(now.getTime() + autoCompleteDays * 86_400_000),
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: "order.delivered",
            actorId: principal.user.id,
            data: { revisionNumber },
          },
        });
        return next;
      });
      await notify(
        order.clientId,
        "order.delivered",
        "Your delivery is ready",
        `${order.number} has been delivered.`,
        {
          orderId: order.id,
        },
      );
      return {
        data: { item: { ...updated, price: money(updated.price), total: money(updated.total) } },
      };
    }

    if (input.action === "revise") {
      if (!isClient && !isAdmin) throw forbidden("Only the client can request a revision.");
      if (order.status !== "delivered")
        throw conflict("A revision can only be requested after delivery.");
      const updated = await db.$transaction(async (tx) => {
        await tx.orderRevision.create({
          data: {
            orderId: order.id,
            requestedById: principal.user.id,
            notes: input.note || "Revision requested.",
          },
        });
        const next = await tx.order.update({
          where: { id: order.id },
          data: { status: "revision_requested" },
        });
        await tx.orderEvent.create({
          data: { orderId: order.id, type: "order.revision_requested", actorId: principal.user.id },
        });
        return next;
      });
      await notify(
        order.staffId,
        "order.revision",
        "Revision requested",
        `${order.number} needs a revision.`,
        {
          orderId: order.id,
        },
      );
      return {
        data: { item: { ...updated, price: money(updated.price), total: money(updated.total) } },
      };
    }

    if (input.action === "complete") {
      if (!isClient && !isAdmin) throw forbidden("Only the client can complete this order.");
      if (!["delivered", "in_progress"].includes(order.status))
        throw conflict("This order cannot be completed yet.");
      const updated = await db.$transaction(async (tx) => {
        const next = await tx.order.update({
          where: { id: order.id },
          data: { status: "completed", completedAt: now },
        });
        await tx.orderEvent.create({
          data: { orderId: order.id, type: "order.completed", actorId: principal.user.id },
        });
        await tx.ledgerEntry.create({
          data: {
            account: "staff_earnings",
            orderId: order.id,
            type: "order_completed",
            debit: 0,
            credit: order.price,
            currency: order.currency,
            metadata: { staffId: order.staffId },
          },
        });
        return next;
      });
      await notify(
        order.staffId,
        "order.completed",
        "Order completed",
        `${order.number} was completed.`,
        {
          orderId: order.id,
        },
      );
      return {
        data: { item: { ...updated, price: money(updated.price), total: money(updated.total) } },
      };
    }

    if (input.action === "cancel") {
      if (
        !["awaiting_payment", "in_progress", "revision_requested", "delivered"].includes(
          order.status,
        )
      ) {
        throw conflict("This order cannot be cancelled now.");
      }
      const updated = await db.order.update({
        where: { id: order.id },
        data: {
          status: "cancelled",
          cancelledAt: now,
          cancellationReason: input.note || "Cancelled by participant.",
          cancelledById: principal.user.id,
        },
      });
      await db.orderEvent.create({
        data: {
          orderId: order.id,
          type: "order.cancelled",
          actorId: principal.user.id,
          data: { reason: input.note },
        },
      });
      const other = isStaff ? order.clientId : order.staffId;
      await notify(other, "order.cancelled", "Order cancelled", `${order.number} was cancelled.`, {
        orderId: order.id,
      });
      return {
        data: { item: { ...updated, price: money(updated.price), total: money(updated.total) } },
      };
    }

    throw badRequest("That order action is not supported.");
  });

  app.post("/workspace/orders/:id/review", { preHandler: [authenticate] }, async (request) => {
    const principal = currentPrincipal(request);
    const params = parseInput(idParams, request.params);
    const input = parseInput(reviewCreateSchema, request.body);
    const order = await orderForUser(params.id, principal.user.id, principal.user.role === "admin");

    if (order.clientId !== principal.user.id) {
      throw forbidden("Only the client can review a completed order.");
    }
    if (order.status !== "completed") {
      throw conflict("You can review an order after it is completed.");
    }
    if (order.review) {
      throw conflict("This order already has a review.");
    }

    const review = await db.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          orderId: order.id,
          relationshipId: order.relationshipId,
          clientId: order.clientId,
          staffId: order.staffId,
          quality: input.quality,
          communication: input.communication,
          delivery: input.delivery,
          comment: input.comment || null,
          visible: true,
        },
      });
      await tx.order.update({
        where: { id: order.id },
        data: { reviewedAt: new Date() },
      });
      await tx.relationship.update({
        where: { id: order.relationshipId },
        data: { lastInteractionAt: new Date() },
      });
      await tx.orderEvent.create({
        data: { orderId: order.id, type: "order.reviewed", actorId: principal.user.id },
      });
      return created;
    });

    await notify(
      order.staffId,
      "order.reviewed",
      "You received a new review",
      `${order.number} was reviewed by your client.`,
      { orderId: order.id, reviewId: review.id },
    );

    await writeAudit({
      actorId: principal.user.id,
      action: "review.create",
      entityType: "review",
      entityId: review.id,
      request,
      after: {
        orderId: order.id,
        quality: review.quality,
        communication: review.communication,
        delivery: review.delivery,
      },
    });

    return { data: { item: review } };
  });

  app.post("/workspace/reviews/:id/reply", { preHandler: [authenticate] }, async (request) => {
    const principal = currentPrincipal(request);
    const params = parseInput(idParams, request.params);
    const input = parseInput(reviewReplySchema, request.body);
    const review = await db.review.findUnique({
      where: { id: params.id },
      include: {
        order: { select: { id: true, number: true, staffId: true, clientId: true } },
      },
    });
    if (!review) throw notFound("That review does not exist.");
    if (review.order.staffId !== principal.user.id) {
      throw forbidden("Only the specialist who received the review can reply.");
    }
    if (review.staffReply) {
      throw conflict("You have already replied to this review.");
    }

    const updated = await db.review.update({
      where: { id: review.id },
      data: { staffReply: input.body, repliedAt: new Date() },
    });

    await notify(
      review.order.clientId,
      "review.replied",
      "Your specialist replied",
      `There is a new reply on your review for ${review.order.number}.`,
      { orderId: review.order.id, reviewId: review.id },
    );

    await writeAudit({
      actorId: principal.user.id,
      action: "review.reply",
      entityType: "review",
      entityId: review.id,
      request,
    });

    return { data: { item: updated } };
  });

  app.post("/workspace/notifications/read", { preHandler: [authenticate] }, async (request) => {
    const principal = currentPrincipal(request);
    const input = parseInput(markReadSchema, request.body);
    await db.notification.updateMany({
      where: {
        userId: principal.user.id,
        readAt: null,
        ...(input.all ? {} : { id: { in: input.ids ?? [] } }),
      },
      data: { readAt: new Date() },
    });
    return { data: { success: true } };
  });

  app.post("/workspace/gigs", { preHandler: [authenticate] }, async (request) => {
    const principal = currentPrincipal(request);
    if (principal.user.role !== "staff" && principal.user.role !== "admin") {
      throw forbidden("Only staff can create gigs.");
    }
    const input = parseInput(gigCreateSchema, request.body);
    const maxGigs = await getSettingValue("marketplace.gigsPerStaff", 1);
    if (principal.user.role === "staff") {
      const count = await db.gig.count({ where: { staffId: principal.user.id, deletedAt: null } });
      if (count >= maxGigs)
        throw conflict(`Your plan allows ${maxGigs} gig${maxGigs === 1 ? "" : "s"}.`);
    }
    const gig = await db.gig.create({
      data: {
        staffId: principal.user.id,
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        status: input.publish ? "live" : "draft",
        publishedAt: input.publish ? new Date() : null,
        prices: undefined,
      } as never,
    });
    await db.gigPackage.create({
      data: {
        gigId: gig.id,
        key: "standard",
        name: "Standard",
        price: input.price,
        deliveryDays: input.deliveryDays,
        revisions: input.revisions,
        sortOrder: 0,
      },
    });
    await writeAudit({
      actorId: principal.user.id,
      action: "gig.create",
      entityType: "gig",
      entityId: gig.id,
      request,
      after: { title: input.title, status: gig.status },
    });
    return { data: { item: gig } };
  });

  app.patch("/workspace/gigs/:id", { preHandler: [authenticate] }, async (request) => {
    const principal = currentPrincipal(request);
    if (principal.user.role !== "staff" && principal.user.role !== "admin") {
      throw forbidden("Only staff can edit gigs.");
    }
    const params = parseInput(idParams, request.params);
    const input = parseInput(gigCreateSchema, request.body);
    const gig = await db.gig.findFirst({
      where: {
        id: params.id,
        deletedAt: null,
        ...(principal.user.role === "staff" ? { staffId: principal.user.id } : {}),
      },
    });
    if (!gig) throw notFound("That gig does not exist.");
    const now = new Date();

    const updated = await db.$transaction(async (tx) => {
      const item = await tx.gig.update({
        where: { id: gig.id },
        data: {
          categoryId: input.categoryId ?? null,
          title: input.title,
          description: input.description,
          status: input.publish ? "live" : "draft",
          publishedAt: input.publish ? (gig.publishedAt ?? now) : null,
        },
      });
      const existingPackage = await tx.gigPackage.findFirst({
        where: { gigId: gig.id, key: "standard" },
        select: { id: true },
      });
      if (existingPackage) {
        await tx.gigPackage.update({
          where: { id: existingPackage.id },
          data: {
            price: input.price,
            deliveryDays: input.deliveryDays,
            revisions: input.revisions,
          },
        });
      } else {
        await tx.gigPackage.create({
          data: {
            gigId: gig.id,
            key: "standard",
            name: "Standard",
            price: input.price,
            deliveryDays: input.deliveryDays,
            revisions: input.revisions,
            sortOrder: 0,
          },
        });
      }
      return item;
    });

    await writeAudit({
      actorId: principal.user.id,
      action: "gig.update",
      entityType: "gig",
      entityId: gig.id,
      request,
      before: { title: gig.title, status: gig.status, categoryId: gig.categoryId },
      after: { title: updated.title, status: updated.status, categoryId: updated.categoryId },
    });
    return { data: { item: updated } };
  });

  app.get("/workspace/invitations", { preHandler: [authenticate] }, async (request) => {
    const principal = currentPrincipal(request);
    if (principal.user.role !== "staff") throw forbidden("Only staff can manage invitations.");
    const items = await db.invitation.findMany({
      where: { staffId: principal.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return {
      data: {
        items: items.map(({ tokenHash: _tokenHash, ...item }) => {
          void _tokenHash;
          return item;
        }),
      },
    };
  });

  app.post("/workspace/invitations/:id/revoke", { preHandler: [authenticate] }, async (request) => {
    const principal = currentPrincipal(request);
    if (principal.user.role !== "staff") throw forbidden("Only staff can manage invitations.");
    const params = parseInput(idParams, request.params);
    const invitation = await db.invitation.findFirst({
      where: { id: params.id, staffId: principal.user.id },
    });
    if (!invitation) throw notFound("That invitation does not exist.");
    if (
      !["sent", "opened"].includes(invitation.status) ||
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      throw conflict("Only an active pending invitation can be revoked.");
    }

    const updated = await db.invitation.update({
      where: { id: invitation.id },
      data: { status: "revoked" },
    });
    await writeAudit({
      actorId: principal.user.id,
      action: "invitation.revoke",
      entityType: "invitation",
      entityId: invitation.id,
      request,
      before: { status: invitation.status },
      after: { status: updated.status },
    });
    return { data: { item: { id: updated.id, status: updated.status } } };
  });

  app.post("/workspace/invitations", { preHandler: [authenticate] }, async (request) => {
    const principal = currentPrincipal(request);
    if (principal.user.role !== "staff") throw forbidden("Only staff can invite clients.");
    const input = parseInput(invitationCreateSchema, request.body);
    const existingAccount = await db.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existingAccount) {
      throw conflict(
        "That email already belongs to an account. Use a new email, or ask management to connect the existing client.",
      );
    }
    const pending = await db.invitation.findFirst({
      where: {
        staffId: principal.user.id,
        email: input.email,
        status: { in: ["sent", "opened"] },
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (pending) throw conflict("An active invitation already exists for that email.");
    const inviteExpiryDays = await getSettingValue("marketplace.inviteExpiryDays", 14);
    const secret = randomToken(32);
    const invitation = await db.invitation.create({
      data: {
        staffId: principal.user.id,
        email: input.email,
        tokenHash: sha256(secret),
        message: input.message,
        expiresAt: new Date(Date.now() + inviteExpiryDays * 86_400_000),
      },
    });
    await writeAudit({
      actorId: principal.user.id,
      action: "invitation.create",
      entityType: "invitation",
      entityId: invitation.id,
      request,
      after: { email: input.email },
    });
    return {
      data: {
        item: {
          id: invitation.id,
          email: invitation.email,
          expiresAt: invitation.expiresAt,
          status: invitation.status,
          invitePath: `/invite/${secret}`,
        },
      },
    };
  });
};
