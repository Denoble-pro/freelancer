"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Ban,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Copy,
  Inbox,
  LayoutDashboard,
  Loader2,
  Mail,
  MessageSquare,
  PackageCheck,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Star,
  Store,
  UserPlus,
  X,
} from "lucide-react";
import { formatDate, formatMoney, humanStatus } from "@dlp/shared";
import { makeT } from "@/lib/content";
import type {
  WsConversation,
  WsGig,
  WsMessage,
  WsOffer,
  WsOrderDetail,
  WorkspaceData,
} from "@/lib/workspace";
import { Avatar } from "./avatar";

type Tab = "overview" | "messages" | "offers" | "orders" | "storefront";

const tabs: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "messages", label: "Messages", icon: MessageSquare },
  { key: "offers", label: "Offers", icon: CircleDollarSign },
  { key: "orders", label: "Orders", icon: PackageCheck },
  { key: "storefront", label: "Storefront", icon: Store },
];

function tone(status: string): string {
  if (["completed", "accepted", "paid", "live", "active"].includes(status)) return "badge-success";
  if (["declined", "cancelled", "rejected", "overdue"].includes(status)) return "badge-danger";
  if (["sent", "awaiting_payment", "pending_review", "revision_requested"].includes(status))
    return "badge-warning";
  return "badge-primary";
}

const orderActions: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  in_progress: "In progress",
  revision_requested: "Revision requested",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

function OfferCard({
  offer,
  viewer,
  busy,
  onAccept,
  onCancel,
  onPay,
  onOpenOrders,
  showRelationship = false,
}: {
  offer: WsOffer;
  viewer: string;
  busy: boolean;
  onAccept: (id: string) => void;
  onCancel: (id: string) => void;
  onPay: (orderId: string) => void;
  onOpenOrders: () => void;
  showRelationship?: boolean;
}) {
  const isClient = viewer === "client";
  const pending = ["sent", "viewed"].includes(offer.status);
  return (
    <article className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow text-primary">Offer</span>
            <span className={`badge py-0.5 ${tone(offer.status)}`}>
              {humanStatus(offer.status)}
            </span>
            {offer.isMine ? <span className="badge py-0.5">Sent by you</span> : null}
          </div>
          <h3 className="mt-2 text-sm font-semibold text-ink">{offer.title}</h3>
          {offer.description ? (
            <p className="mt-1 max-w-xl whitespace-pre-wrap text-xs leading-6 text-muted">
              {offer.description}
            </p>
          ) : null}
          <p className="mt-2 text-[0.66rem] text-muted">
            {showRelationship
              ? `${offer.relationship.staff.name} → ${offer.relationship.client.name} · `
              : ""}
            sent {formatDate(offer.createdAt)}
            {offer.expiresAt ? ` · expires ${formatDate(offer.expiresAt)}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-semibold tracking-[-0.03em]">
            {formatMoney(offer.price, offer.currency)}
          </p>
          <p className="mt-1 text-[0.66rem] text-muted">
            {offer.deliveryDays} days · {offer.revisions} revisions
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {offer.canRespond && isClient ? (
          <>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onAccept(offer.id)}
              disabled={busy}
            >
              <Check className="h-3.5 w-3.5" /> Accept &amp; pay
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onCancel(offer.id)}
              disabled={busy}
            >
              <Ban className="h-3.5 w-3.5" /> Cancel offer
            </button>
          </>
        ) : null}
        {offer.order ? (
          <>
            <span className="text-xs text-muted">
              Order {offer.order.number} · {humanStatus(offer.order.status)}
            </span>
            {isClient && offer.order.status === "awaiting_payment" ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onPay(offer.order!.id)}
                disabled={busy}
              >
                Pay now
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenOrders}>
              View order <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </>
        ) : null}
        {!offer.order && !(offer.canRespond && isClient) ? (
          <span className="text-xs text-muted">
            {pending
              ? isClient
                ? "Awaiting your response"
                : "Waiting for the client"
              : "This offer is closed."}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export function WorkspaceClient({
  data,
  currency,
  content,
}: {
  data: WorkspaceData;
  currency: string;
  content: Record<string, string>;
}) {
  const router = useRouter();
  const t = makeT(content);
  const me = data.me.user;
  const isStaff = me.role === "staff";
  const isClient = me.role === "client";
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [activeConversation, setActiveConversation] = useState<string | null>(
    data.conversations[0]?.id ?? null,
  );
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerForm, setOfferForm] = useState({
    conversationId: data.conversations[0]?.id ?? "",
    title: "",
    price: "",
    deliveryDays: "7",
    revisions: "2",
    description: "",
  });
  const [inviteForm, setInviteForm] = useState({ email: "", message: "" });
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [gigForm, setGigForm] = useState({
    title: "",
    description: "",
    categoryId: "",
    price: "",
    deliveryDays: "7",
    revisions: "2",
    published: true,
  });
  const [showGigForm, setShowGigForm] = useState(false);
  const [editingGigId, setEditingGigId] = useState<string | null>(null);
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState({
    quality: "5",
    communication: "5",
    delivery: "5",
    comment: "",
  });
  const [replyReviewId, setReplyReviewId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<WsOrderDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const messageEnd = useRef<HTMLDivElement>(null);

  const active =
    data.conversations.find((conversation) => conversation.id === activeConversation) ?? null;
  const offerConversation =
    data.conversations.find((conversation) => conversation.id === offerForm.conversationId) ?? null;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!activeConversation) return;
    let cancelled = false;
    setLoadingMessages(true);
    fetch(`/api/v1/workspace/conversations/${activeConversation}/messages`, {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as { data?: { items: WsMessage[] } };
        if (!cancelled && response.ok) setMessages(payload.data?.items ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });
    fetch(`/api/v1/workspace/conversations/${activeConversation}/read`, {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeConversation]);

  useEffect(() => {
    messageEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const relationships = useMemo(
    () =>
      data.relationships.map((relationship) => ({
        ...relationship,
        other: relationship.staffId === me.id ? relationship.client : relationship.staff,
      })),
    [data.relationships, me.id],
  );

  async function post(
    path: string,
    body: unknown,
    key: string,
  ): Promise<Record<string, unknown> | null> {
    setBusy(key);
    try {
      const response = await fetch(`/api/v1${path}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        data?: Record<string, unknown>;
        error?: { message?: string };
      };
      if (!response.ok) {
        setToast({
          type: "error",
          text: payload.error?.message ?? "That action could not be completed.",
        });
        return null;
      }
      router.refresh();
      return payload.data ?? {};
    } catch {
      setToast({ type: "error", text: "Network error. Please try again." });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function patch(
    path: string,
    body: unknown,
    key: string,
  ): Promise<Record<string, unknown> | null> {
    setBusy(key);
    try {
      const response = await fetch(`/api/v1${path}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        data?: Record<string, unknown>;
        error?: { message?: string };
      };
      if (!response.ok) {
        setToast({
          type: "error",
          text: payload.error?.message ?? "That change could not be saved.",
        });
        return null;
      }
      router.refresh();
      return payload.data ?? {};
    } catch {
      setToast({ type: "error", text: "Network error. Please try again." });
      return null;
    } finally {
      setBusy(null);
    }
  }

  function ok(text: string) {
    setToast({ type: "ok", text });
  }

  async function sendMessage() {
    if (!activeConversation || !draft.trim()) return;
    const body = draft.trim();
    setDraft("");
    const result = await post(
      `/workspace/conversations/${activeConversation}/messages`,
      { body },
      "send-message",
    );
    if (result) {
      const item = result.item as WsMessage | undefined;
      if (item) setMessages((current) => [...current, item]);
      ok("Message sent");
    }
  }

  function openOffer(prefill?: {
    conversationId?: string;
    title?: string;
    price?: number;
    days?: number;
  }) {
    setOfferForm({
      conversationId:
        prefill?.conversationId ?? activeConversation ?? data.conversations[0]?.id ?? "",
      title: prefill?.title ?? "",
      price: prefill?.price !== undefined ? String(prefill.price) : "",
      deliveryDays: String(prefill?.days ?? 7),
      revisions: "2",
      description: "",
    });
    setOfferOpen(true);
  }

  function openOfferConversation(relationshipId: string) {
    const conversation = data.conversations.find(
      (candidate) => candidate.relationshipId === relationshipId,
    );
    if (!conversation) {
      setToast({ type: "error", text: "That conversation is not available yet." });
      return;
    }
    setActiveConversation(conversation.id);
    setTab("messages");
  }

  async function createOffer() {
    const price = Number(offerForm.price);
    if (!offerForm.conversationId) {
      setToast({ type: "error", text: "Open a conversation before sending an offer." });
      return;
    }
    if (!offerForm.title.trim() || !Number.isFinite(price) || price <= 0) {
      setToast({ type: "error", text: "Add a title and a valid price." });
      return;
    }
    const result = await post(
      `/workspace/conversations/${offerForm.conversationId}/offers`,
      {
        title: offerForm.title.trim(),
        description: offerForm.description.trim() || undefined,
        price,
        deliveryDays: Number(offerForm.deliveryDays) || 7,
        revisions: Number(offerForm.revisions) || 0,
      },
      "create-offer",
    );
    if (result) {
      const message = result.message as WsMessage | undefined;
      if (message) setMessages((current) => [...current, message]);
      setOfferOpen(false);
      setActiveConversation(offerForm.conversationId);
      setTab("messages");
      ok("Offer sent in the conversation");
    }
  }

  async function acceptAndPayOffer(id: string) {
    const result = await post(
      `/workspace/offers/${id}/respond`,
      { action: "accept" },
      `offer-${id}`,
    );
    if (!result) return;
    const order = result.order as { id: string } | undefined;
    if (!order) {
      ok("Offer accepted");
      return;
    }
    const paid = await post(
      `/workspace/orders/${order.id}/actions`,
      { action: "pay" },
      `offer-pay-${id}`,
    );
    setTab("orders");
    if (paid) ok("Offer accepted and payment recorded");
  }

  async function cancelOffer(id: string) {
    const result = await post(
      `/workspace/offers/${id}/respond`,
      { action: "cancel" },
      `offer-${id}`,
    );
    if (result) ok("Offer cancelled");
  }

  async function actOnOrder(id: string, action: string) {
    let note: string | undefined;
    if (action === "revise" || action === "cancel" || action === "deliver") {
      const entered = window.prompt(
        action === "revise"
          ? "What should be revised?"
          : action === "cancel"
            ? "Why are you cancelling this order?"
            : "Add a delivery note (optional)",
        action === "deliver" ? "Your delivery is ready." : "",
      );
      if (entered === null) return;
      note = entered;
    }
    const result = await post(
      `/workspace/orders/${id}/actions`,
      { action, ...(note ? { note } : {}) },
      `order-${id}`,
    );
    if (result) {
      if (action === "pay")
        setToast({
          type: "ok",
          text: "Payment recorded. Flutterwave checkout will replace this step later.",
        });
      else ok(`Order ${humanStatus(action)}`);
    }
  }

  async function submitReview() {
    if (!reviewOrderId) return;
    const result = await post(
      `/workspace/orders/${reviewOrderId}/review`,
      {
        quality: Number(reviewForm.quality),
        communication: Number(reviewForm.communication),
        delivery: Number(reviewForm.delivery),
        comment: reviewForm.comment.trim() || undefined,
      },
      `review-${reviewOrderId}`,
    );
    if (result) {
      setReviewOrderId(null);
      setReviewForm({ quality: "5", communication: "5", delivery: "5", comment: "" });
      ok("Review submitted");
    }
  }

  async function submitReviewReply() {
    if (!replyReviewId || !replyBody.trim()) return;
    const result = await post(
      `/workspace/reviews/${replyReviewId}/reply`,
      { body: replyBody.trim() },
      `reply-${replyReviewId}`,
    );
    if (result) {
      setReplyReviewId(null);
      setReplyBody("");
      ok(t("workspace.review.replySuccess"));
    }
  }

  async function openOrderDetail(id: string) {
    setDetailOrderId(id);
    setDetailOrder(null);
    setDetailError(null);
    setLoadingDetail(true);
    try {
      const response = await fetch(`/api/v1/workspace/orders/${id}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        data?: { item: WsOrderDetail };
        error?: { message?: string };
      };
      if (!response.ok) {
        setDetailError(payload.error?.message ?? "That order could not be loaded.");
        return;
      }
      setDetailOrder(payload.data?.item ?? null);
    } catch {
      setDetailError("Network error. Please try again.");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function revokeInvitation(id: string, email: string) {
    if (!window.confirm(t("workspace.invitations.revokeConfirm", { email }))) return;
    const result = await post(`/workspace/invitations/${id}/revoke`, {}, `revoke-${id}`);
    if (result) ok(t("workspace.invitations.revokeSuccess"));
  }

  async function sendInvite() {
    if (!inviteForm.email.trim()) return;
    const result = await post(
      "/workspace/invitations",
      { email: inviteForm.email.trim(), message: inviteForm.message.trim() || undefined },
      "invite",
    );
    if (result?.item) {
      const item = result.item as { invitePath: string };
      setInviteLink(`${window.location.origin}${item.invitePath}`);
      setInviteForm({ email: "", message: "" });
      ok("Invitation created");
    }
  }

  function openGigForm(gig?: WsGig) {
    const pkg = gig?.packages[0];
    setEditingGigId(gig?.id ?? null);
    setGigForm({
      title: gig?.title ?? "",
      description: gig?.description ?? "",
      categoryId: gig?.category?.id ?? "",
      price: pkg ? String(pkg.price) : "",
      deliveryDays: String(pkg?.deliveryDays ?? 7),
      revisions: String(pkg?.revisions ?? 2),
      published: gig ? ["live", "published"].includes(gig.status) : true,
    });
    setShowGigForm(true);
  }

  async function saveGig() {
    const price = Number(gigForm.price);
    if (gigForm.title.trim().length < 5 || gigForm.description.trim().length < 20) {
      setToast({
        type: "error",
        text: "Use a clear title and at least 20 characters of description.",
      });
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setToast({ type: "error", text: "Enter a valid gig price." });
      return;
    }
    const payload = {
      title: gigForm.title.trim(),
      description: gigForm.description.trim(),
      ...(gigForm.categoryId ? { categoryId: gigForm.categoryId } : {}),
      price,
      deliveryDays: Number(gigForm.deliveryDays) || 7,
      revisions: Number(gigForm.revisions) || 0,
      publish: gigForm.published,
    };
    const result = editingGigId
      ? await patch(`/workspace/gigs/${editingGigId}`, payload, `gig-${editingGigId}`)
      : await post("/workspace/gigs", payload, "create-gig");
    if (result) {
      setShowGigForm(false);
      setEditingGigId(null);
      setGigForm({
        title: "",
        description: "",
        categoryId: "",
        price: "",
        deliveryDays: "7",
        revisions: "2",
        published: true,
      });
      ok(editingGigId ? t("workspace.gig.updateSuccess") : t("workspace.gig.createSuccess"));
    }
  }

  async function markNotifications() {
    const result = await post("/workspace/notifications/read", { all: true }, "notifications");
    if (result) {
      setShowNotifications(false);
      ok("Notifications marked as read");
    }
  }

  const statCards = [
    {
      label: isClient ? "Active orders" : "Active work",
      value: String(data.stats.activeOrders),
      icon: PackageCheck,
    },
    {
      label: "Unread messages",
      value: String(data.stats.unreadMessages),
      icon: MessageSquare,
    },
    {
      label: "Offers awaiting you",
      value: String(data.stats.pendingOffers),
      icon: CircleDollarSign,
    },
    {
      label: isStaff ? "Earned" : "Committed spend",
      value: formatMoney(isStaff ? data.stats.earnings : data.stats.spend, currency),
      icon: CircleDollarSign,
    },
  ];

  return (
    <main className="container-page py-8 sm:py-10">
      {toast ? (
        <div
          className={`fixed right-4 top-20 z-[70] flex max-w-sm items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-xl ${
            toast.type === "ok"
              ? "border-success/20 bg-[color-mix(in_srgb,var(--color-success)_12%,white)] text-ink"
              : "border-danger/20 bg-[color-mix(in_srgb,var(--color-danger)_10%,white)] text-ink"
          }`}
          role="status"
        >
          {toast.type === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
          )}
          <span>{toast.text}</span>
        </div>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {isStaff ? "Staff workspace" : isClient ? "Client workspace" : "Management workspace"}
          </p>
          <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.03] tracking-[-0.04em]">
            Good{" "}
            {new Date().getHours() < 12
              ? "morning"
              : new Date().getHours() < 17
                ? "afternoon"
                : "evening"}
            , {me.name.split(" ")[0]}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Your private place for conversations, offers and delivery.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary relative"
            onClick={() => setShowNotifications((current) => !current)}
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            Notifications
            {data.unreadNotifications > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[0.62rem] font-bold text-white">
                {data.unreadNotifications}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      {showNotifications ? (
        <section className="card mt-5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <button
              type="button"
              className="text-xs font-semibold text-primary"
              onClick={markNotifications}
            >
              Mark all as read
            </button>
          </div>
          <div className="max-h-80 overflow-auto">
            {data.notifications.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-muted">Nothing new yet.</p>
            ) : (
              data.notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex gap-3 border-b border-border px-5 py-4 last:border-0 ${notification.readAt ? "opacity-60" : ""}`}
                >
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-ink">{notification.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{notification.body}</p>
                    <p className="mt-1 text-[0.65rem] text-muted">
                      {formatDate(notification.createdAt, {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="card-flat px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-muted">
                {stat.label}
              </p>
              <stat.icon className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <p className="mt-3 font-display text-2xl font-semibold tracking-[-0.03em]">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <nav
        className="mt-7 flex gap-1 overflow-x-auto border-b border-border"
        aria-label="Workspace sections"
      >
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`relative inline-flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors ${
              tab === item.key ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
            {item.key === "messages" && data.stats.unreadMessages > 0 ? (
              <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.6rem] text-white">
                {data.stats.unreadMessages}
              </span>
            ) : null}
            {tab === item.key ? (
              <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />
            ) : null}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "overview" ? (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="card p-6 sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">
                    Recent conversations
                  </h2>
                  <p className="mt-1 text-xs text-muted">Continue where you left off.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setTab("messages")}
                >
                  View all <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-4">
                {data.conversations.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border py-10 text-center text-xs text-muted">
                    No conversations yet.
                  </p>
                ) : (
                  data.conversations.slice(0, 4).map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      className="flex w-full items-center gap-3 border-b border-border py-3 text-left last:border-0"
                      onClick={() => {
                        setActiveConversation(conversation.id);
                        setTab("messages");
                      }}
                    >
                      <Avatar
                        name={conversation.participant.name}
                        src={conversation.participant.avatarUrl}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-semibold text-ink">
                            {conversation.participant.name}
                          </p>
                          {conversation.unread > 0 ? (
                            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.6rem] text-white">
                              {conversation.unread}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-[0.72rem] text-muted">
                          {conversation.lastMessage?.body ?? "Start the conversation"}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="card p-6 sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">
                    {isStaff ? "Your clients" : "Your Denobelpro specialist"}
                  </h2>
                  <p className="mt-1 text-xs text-muted">Invitation-only and private.</p>
                </div>
                {isStaff ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowInvite(true)}
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Invite
                  </button>
                ) : null}
              </div>
              <div className="mt-4">
                {relationships.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border py-10 text-center text-xs text-muted">
                    No active relationships yet.
                  </p>
                ) : (
                  relationships.slice(0, 5).map((relationship) => (
                    <div
                      key={relationship.id}
                      className="flex items-center gap-3 border-b border-border py-3 last:border-0"
                    >
                      <Avatar
                        name={relationship.other.name}
                        src={relationship.other.avatarUrl}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-ink">
                          {relationship.other.name}
                        </p>
                        <p className="mt-0.5 truncate text-[0.7rem] text-muted">
                          {relationship.other.email}
                        </p>
                      </div>
                      <span className="badge badge-success py-1">Active</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="card p-6 sm:p-8 lg:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">
                    Latest offers
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    Clear scope, timeline and price before work starts.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setTab("offers")}
                >
                  View all <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {data.offers.slice(0, 2).map((offer) => (
                  <div
                    key={offer.id}
                    className="rounded-lg border border-border bg-surface-muted p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-semibold text-ink">{offer.title}</p>
                      <span className={`badge py-1 ${tone(offer.status)}`}>
                        {humanStatus(offer.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-lg font-semibold tracking-[-0.02em]">
                      {formatMoney(offer.price, offer.currency)}
                    </p>
                    <p className="mt-1 text-[0.7rem] text-muted">
                      {offer.deliveryDays} day delivery · {offer.revisions} revisions
                    </p>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm mt-4 px-0"
                      onClick={() => openOfferConversation(offer.relationshipId)}
                    >
                      Open conversation <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {data.offers.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border py-10 text-center text-xs text-muted md:col-span-2">
                    No offers yet.
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        {tab === "messages" ? (
          <div className="grid min-h-[620px] gap-4 lg:grid-cols-[320px_1fr]">
            <section className="card flex flex-col overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold">Conversations</h2>
              </div>
              <div className="flex-1 overflow-auto">
                {data.conversations.length === 0 ? (
                  <p className="p-6 text-xs text-muted">No conversations yet.</p>
                ) : (
                  data.conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setActiveConversation(conversation.id)}
                      className={`flex w-full items-start gap-3 border-b border-border px-4 py-4 text-left transition-colors ${
                        activeConversation === conversation.id
                          ? "bg-primary/5"
                          : "hover:bg-surface-muted"
                      }`}
                    >
                      <Avatar
                        name={conversation.participant.name}
                        src={conversation.participant.avatarUrl}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-semibold text-ink">
                            {conversation.participant.name}
                          </p>
                          {conversation.unread > 0 ? (
                            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.6rem] text-white">
                              {conversation.unread}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-1 text-[0.72rem] text-muted">
                          {conversation.lastMessage?.body ?? "No messages yet"}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="card flex min-h-[620px] flex-col overflow-hidden">
              {active ? (
                <>
                  <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                    <Avatar
                      name={active.participant.name}
                      src={active.participant.avatarUrl}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{active.participant.name}</p>
                      <p className="text-[0.68rem] text-muted">
                        {active.locked ? "Conversation locked" : "Private conversation"}
                      </p>
                    </div>
                    {isStaff && !active.locked ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openOffer({ conversationId: active.id })}
                      >
                        <CircleDollarSign className="h-3.5 w-3.5" />
                        Send offer
                      </button>
                    ) : null}
                  </div>
                  <div className="flex-1 space-y-3 overflow-auto bg-surface-muted/40 p-5">
                    {loadingMessages ? (
                      <div className="grid place-items-center py-16">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    ) : messages.length === 0 ? (
                      <p className="py-16 text-center text-xs text-muted">
                        Start the conversation below.
                      </p>
                    ) : (
                      messages.map((message) => {
                        const mine = message.senderId === me.id;
                        if (message.type === "offer") {
                          const offerId =
                            typeof message.attachments?.offerId === "string"
                              ? message.attachments.offerId
                              : null;
                          const offer = offerId
                            ? data.offers.find((candidate) => candidate.id === offerId)
                            : null;
                          if (!offer) {
                            return (
                              <div
                                key={message.id}
                                className="rounded-xl border border-border bg-surface p-4 text-sm"
                              >
                                <p className="eyebrow text-muted">Offer</p>
                                <p className="mt-2 font-semibold">
                                  {message.body ?? "Offer details unavailable"}
                                </p>
                              </div>
                            );
                          }
                          return (
                            <div key={message.id} className="w-full">
                              <OfferCard
                                offer={offer}
                                viewer={me.role}
                                busy={!!busy}
                                onAccept={acceptAndPayOffer}
                                onCancel={cancelOffer}
                                onPay={(orderId) => void actOnOrder(orderId, "pay")}
                                onOpenOrders={() => setTab("orders")}
                              />
                            </div>
                          );
                        }
                        return (
                          <div
                            key={message.id}
                            className={`flex ${mine ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                                mine
                                  ? "rounded-br-md bg-primary text-white"
                                  : "rounded-bl-md border border-border bg-surface text-ink"
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{message.body}</p>
                              <p
                                className={`mt-1.5 text-[0.62rem] ${mine ? "text-white/60" : "text-muted"}`}
                              >
                                {formatDate(message.createdAt, {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messageEnd} />
                  </div>
                  <div className="border-t border-border p-4">
                    <div className="flex gap-2">
                      <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void sendMessage();
                          }
                        }}
                        rows={2}
                        placeholder="Write a message…"
                        className="input min-h-[52px] flex-1 resize-none"
                        disabled={active.locked}
                      />
                      <button
                        type="button"
                        className="btn btn-primary px-4"
                        onClick={sendMessage}
                        disabled={!!busy || active.locked || !draft.trim()}
                      >
                        {busy === "send-message" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid flex-1 place-items-center p-10 text-center">
                  <div>
                    <Inbox className="mx-auto h-8 w-8 text-muted" />
                    <p className="mt-3 text-sm font-semibold">Select a conversation</p>
                    <p className="mt-1 text-xs text-muted">Your private messages appear here.</p>
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : null}

        {tab === "offers" ? (
          <section className="card p-6 sm:p-8">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">Offers</h2>
              <p className="mt-1 text-xs text-muted">
                Staff send offers inside a conversation. Clients accept and pay or cancel here.
              </p>
            </div>
            <div className="mt-5 grid gap-3">
              {data.offers.length === 0 ? (
                <p className="rounded-md border border-dashed border-border py-14 text-center text-xs text-muted">
                  No offers yet. Start a conversation and your specialist can send one.
                </p>
              ) : (
                data.offers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    viewer={me.role}
                    busy={!!busy}
                    onAccept={acceptAndPayOffer}
                    onCancel={cancelOffer}
                    onPay={(orderId) => void actOnOrder(orderId, "pay")}
                    onOpenOrders={() => setTab("orders")}
                    showRelationship
                  />
                ))
              )}
            </div>
          </section>
        ) : null}

        {tab === "orders" ? (
          <section className="card p-6 sm:p-8">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">Orders</h2>
              <p className="mt-1 text-xs text-muted">
                Payment is recorded manually for now; Flutterwave checkout will be added later.
              </p>
            </div>
            <div className="mt-5 grid gap-3">
              {data.orders.length === 0 ? (
                <p className="rounded-md border border-dashed border-border py-14 text-center text-xs text-muted">
                  No orders yet. Accept an offer or wait for your client to accept one.
                </p>
              ) : (
                data.orders.map((order) => (
                  <article key={order.id} className="rounded-lg border border-border p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold">{order.number}</h3>
                          <span className={`badge py-1 ${tone(order.status)}`}>
                            {orderStatus(order.status)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted">
                          {order.gig?.title ?? "Custom offer"} · {order.staff.name} →{" "}
                          {order.client.name}
                        </p>
                        <p className="mt-1 text-[0.7rem] text-muted">
                          Created {formatDate(order.createdAt)}
                          {order.dueAt && order.status !== "completed"
                            ? ` · due ${formatDate(order.dueAt)}`
                            : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-xl font-semibold">
                          {formatMoney(order.total, order.currency)}
                        </p>
                        <p className="mt-1 text-[0.68rem] text-muted">Escrow recorded manually</p>
                      </div>
                    </div>

                    {order.review ? (
                      <div className="mt-4 rounded-md border border-border bg-secondary/20 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold">
                            {t("workspace.orderDetail.review")}
                          </p>
                          <span className="badge badge-success py-1">
                            {(
                              (order.review.quality +
                                order.review.communication +
                                order.review.delivery) /
                              3
                            ).toFixed(1)}{" "}
                            / 5
                          </span>
                        </div>
                        {order.review.comment ? (
                          <p className="mt-2 text-xs text-muted">{order.review.comment}</p>
                        ) : null}
                        {order.review.staffReply ? (
                          <div className="mt-3 border-l-2 border-primary/30 pl-3">
                            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-primary">
                              {order.staff.id === me.id
                                ? t("workspace.review.yourReply")
                                : t("workspace.review.staffReply")}
                            </p>
                            <p className="mt-1 text-xs text-muted">{order.review.staffReply}</p>
                          </div>
                        ) : order.staff.id === me.id ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm mt-3"
                            onClick={() => {
                              setReplyBody("");
                              setReplyReviewId(order.review?.id ?? null);
                            }}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            {t("workspace.review.reply")}
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => void openOrderDetail(order.id)}
                      >
                        <Clock3 className="h-3.5 w-3.5" />
                        {t("workspace.orderDetail.view")}
                      </button>
                      {order.client.id === me.id &&
                      order.status === "completed" &&
                      !order.review ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setReviewOrderId(order.id)}
                          disabled={!!busy}
                        >
                          Leave a review
                        </button>
                      ) : null}
                      {order.client.id === me.id && order.status === "awaiting_payment" ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => actOnOrder(order.id, "pay")}
                          disabled={!!busy}
                        >
                          Record payment
                        </button>
                      ) : null}
                      {order.staff.id === me.id &&
                      ["in_progress", "revision_requested"].includes(order.status) ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => actOnOrder(order.id, "deliver")}
                          disabled={!!busy}
                        >
                          Deliver work
                        </button>
                      ) : null}
                      {order.client.id === me.id && order.status === "delivered" ? (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => actOnOrder(order.id, "complete")}
                            disabled={!!busy}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Complete & release
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => actOnOrder(order.id, "revise")}
                            disabled={!!busy}
                          >
                            Request revision
                          </button>
                        </>
                      ) : null}
                      {!["completed", "cancelled"].includes(order.status) ? (
                        <button
                          className="btn btn-ghost btn-sm text-muted"
                          onClick={() => actOnOrder(order.id, "cancel")}
                          disabled={!!busy}
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        ) : null}

        {tab === "storefront" ? (
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="card p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">
                    {isStaff ? "Your gig" : "Your specialists"}
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    {isStaff
                      ? "Your single, private storefront inside Denobelpro."
                      : "Services from the people you already work with."}
                  </p>
                </div>
                {isStaff && data.gigs.length === 0 ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => openGigForm()}
                  >
                    <Plus className="h-3.5 w-3.5" /> {t("workspace.gig.create")}
                  </button>
                ) : null}
              </div>

              <div className="mt-5 grid gap-4">
                {data.gigs.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border py-14 text-center text-xs text-muted">
                    {isStaff
                      ? "Publish a gig so your clients can see exactly what you offer."
                      : "No published gigs from your specialist yet."}
                  </p>
                ) : (
                  data.gigs.map((gig) => (
                    <article
                      key={gig.id}
                      className="overflow-hidden rounded-lg border border-border"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
                        <div className="max-w-xl">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-lg font-semibold tracking-[-0.02em]">
                              {gig.title}
                            </h3>
                            <span className={`badge py-1 ${tone(gig.status)}`}>
                              {humanStatus(gig.status)}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <Avatar name={gig.staff.name} src={gig.staff.avatarUrl} size="sm" />
                            <p className="text-xs text-muted">
                              {gig.staff.name}
                              {gig.staff.staffProfile?.title
                                ? ` · ${gig.staff.staffProfile.title}`
                                : ""}
                            </p>
                          </div>
                          <p className="mt-3 line-clamp-3 text-xs leading-6 text-muted">
                            {gig.description.replace(/<[^>]+>/g, " ")}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {gig.searchTags.slice(0, 4).map((tag) => (
                              <span key={tag} className="badge py-0.5">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[0.66rem] uppercase tracking-[0.1em] text-muted">
                            From
                          </p>
                          <p className="mt-1 font-display text-2xl font-semibold">
                            {formatMoney(gig.startingPrice, currency)}
                          </p>
                          {gig.rating.count > 0 ? (
                            <p className="mt-1 text-[0.7rem] text-muted">
                              {gig.rating.average.toFixed(1)} · {gig.rating.count} review
                              {gig.rating.count === 1 ? "" : "s"}
                            </p>
                          ) : null}
                          {isStaff ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm mt-3"
                              onClick={() => openGigForm(gig)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {t("workspace.gig.edit")}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="grid gap-3 border-t border-border bg-surface-muted/50 p-5 sm:grid-cols-2">
                        {gig.packages.map((pkg) => (
                          <div
                            key={pkg.id}
                            className="rounded-md border border-border bg-surface p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold capitalize">{pkg.name}</p>
                              <p className="text-xs font-semibold">
                                {formatMoney(pkg.price, currency)}
                              </p>
                            </div>
                            <p className="mt-1 text-[0.68rem] text-muted">
                              {pkg.deliveryDays} days · {pkg.revisions} revisions
                            </p>
                            {isClient ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm mt-3 w-full"
                                onClick={() => {
                                  const relationship = data.relationships.find(
                                    (candidate) => candidate.staffId === gig.staffId,
                                  );
                                  const conversation = relationship
                                    ? data.conversations.find(
                                        (candidate) => candidate.relationshipId === relationship.id,
                                      )
                                    : null;
                                  if (!conversation) {
                                    setToast({
                                      type: "error",
                                      text: "That conversation is not available yet.",
                                    });
                                    return;
                                  }
                                  setActiveConversation(conversation.id);
                                  setDraft(
                                    `Hi, I'd like to discuss the ${pkg.name} package for ${gig.title}.`,
                                  );
                                  setTab("messages");
                                }}
                              >
                                Ask about this package
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <div className="space-y-6">
              {isStaff ? (
                <section className="card p-6 sm:p-8">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">
                        Invite a client
                      </h2>
                      <p className="mt-1 text-xs text-muted">
                        Clients only see your storefront and their own work.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowInvite(true)}
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Invite
                    </button>
                  </div>
                  <div className="mt-4">
                    {data.invitations.length === 0 ? (
                      <p className="rounded-md border border-dashed border-border py-8 text-center text-xs text-muted">
                        No invitations yet.
                      </p>
                    ) : (
                      data.invitations.slice(0, 6).map((invitation) => (
                        <div
                          key={invitation.id}
                          className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold">{invitation.email}</p>
                            <p className="mt-0.5 text-[0.68rem] text-muted">
                              Expires {formatDate(invitation.expiresAt)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className={`badge py-1 ${tone(invitation.status)}`}>
                              {humanStatus(invitation.status)}
                            </span>
                            {["sent", "opened"].includes(invitation.status) &&
                            new Date(invitation.expiresAt).getTime() > Date.now() ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm px-2 text-muted"
                                onClick={() =>
                                  void revokeInvitation(invitation.id, invitation.email)
                                }
                                disabled={!!busy}
                                title={t("workspace.invitations.revoke")}
                              >
                                <Ban className="h-3.5 w-3.5" />
                                {t("workspace.invitations.revoke")}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              ) : null}

              <section className="card p-6 sm:p-8">
                <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">
                  How it works
                </h2>
                <ol className="mt-4 space-y-4">
                  {[
                    ["Agree the scope", "Message first, then turn the plan into a clear offer."],
                    ["Accept and pay", "Payment is recorded against the order before work starts."],
                    [
                      "Review delivery",
                      "Request a revision or complete the order to release funds.",
                    ],
                  ].map(([title, body], index) => (
                    <li key={title} className="flex gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-xs font-semibold">{title}</p>
                        <p className="mt-1 text-[0.72rem] leading-5 text-muted">{body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </div>
        ) : null}
      </div>

      {offerOpen ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-secondary/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
                  Send an offer
                </h2>
                <p className="mt-1 text-xs text-muted">
                  This appears in the conversation. The client can accept and pay or cancel it.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm px-2"
                onClick={() => setOfferOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              <div className="rounded-md border border-border bg-surface-muted/60 px-3 py-2">
                <p className="text-[0.62rem] uppercase tracking-[0.12em] text-muted">
                  Conversation with
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {offerConversation?.participant.name ?? "No conversation selected"}
                </p>
              </div>
              <label className="text-xs font-semibold">
                Offer title
                <input
                  className="input mt-1.5"
                  value={offerForm.title}
                  onChange={(event) => setOfferForm({ ...offerForm, title: event.target.value })}
                  placeholder="e.g. Brand refresh for retail launch"
                />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="text-xs font-semibold">
                  Price ({currency})
                  <input
                    className="input mt-1.5"
                    type="number"
                    min="1"
                    value={offerForm.price}
                    onChange={(event) => setOfferForm({ ...offerForm, price: event.target.value })}
                  />
                </label>
                <label className="text-xs font-semibold">
                  Delivery days
                  <input
                    className="input mt-1.5"
                    type="number"
                    min="1"
                    value={offerForm.deliveryDays}
                    onChange={(event) =>
                      setOfferForm({ ...offerForm, deliveryDays: event.target.value })
                    }
                  />
                </label>
                <label className="text-xs font-semibold">
                  Revisions
                  <input
                    className="input mt-1.5"
                    type="number"
                    min="0"
                    value={offerForm.revisions}
                    onChange={(event) =>
                      setOfferForm({ ...offerForm, revisions: event.target.value })
                    }
                  />
                </label>
              </div>
              <label className="text-xs font-semibold">
                Scope
                <textarea
                  className="input mt-1.5 min-h-24 resize-y"
                  value={offerForm.description}
                  onChange={(event) =>
                    setOfferForm({ ...offerForm, description: event.target.value })
                  }
                  placeholder="What is included, what is not, and what you need to begin."
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setOfferOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={createOffer}
                disabled={!!busy || !offerForm.conversationId}
              >
                {busy === "create-offer" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send offer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showInvite ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-secondary/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
                  Invite a client
                </h2>
                <p className="mt-1 text-xs text-muted">
                  We create a private invitation link you can send directly.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm px-2"
                onClick={() => setShowInvite(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              <label className="text-xs font-semibold">
                Client email
                <input
                  className="input mt-1.5"
                  type="email"
                  value={inviteForm.email}
                  onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })}
                  placeholder="client@company.com"
                />
              </label>
              <label className="text-xs font-semibold">
                Personal note (optional)
                <textarea
                  className="input mt-1.5 min-h-20 resize-y"
                  value={inviteForm.message}
                  onChange={(event) =>
                    setInviteForm({ ...inviteForm, message: event.target.value })
                  }
                  placeholder="A short welcome message."
                />
              </label>
              {inviteLink ? (
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                  <p className="text-[0.68rem] font-semibold text-primary">Invitation link</p>
                  <p className="mt-1 break-all text-[0.7rem] text-muted">{inviteLink}</p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm mt-2"
                    onClick={() => navigator.clipboard.writeText(inviteLink)}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy link
                  </button>
                </div>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowInvite(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={sendInvite}
                disabled={busy !== null || !inviteForm.email.trim()}
              >
                {busy === "invite" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Create invitation
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reviewOrderId ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-secondary/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
                  Review your specialist
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Your feedback helps future clients choose with confidence.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm px-2"
                onClick={() => setReviewOrderId(null)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <label className="text-xs font-semibold">
                Quality
                <select
                  className="input mt-1.5"
                  value={reviewForm.quality}
                  onChange={(event) =>
                    setReviewForm({ ...reviewForm, quality: event.target.value })
                  }
                >
                  {[5, 4, 3, 2, 1].map((score) => (
                    <option key={score} value={score}>
                      {score} / 5
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold">
                Communication
                <select
                  className="input mt-1.5"
                  value={reviewForm.communication}
                  onChange={(event) =>
                    setReviewForm({ ...reviewForm, communication: event.target.value })
                  }
                >
                  {[5, 4, 3, 2, 1].map((score) => (
                    <option key={score} value={score}>
                      {score} / 5
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold">
                Delivery
                <select
                  className="input mt-1.5"
                  value={reviewForm.delivery}
                  onChange={(event) =>
                    setReviewForm({ ...reviewForm, delivery: event.target.value })
                  }
                >
                  {[5, 4, 3, 2, 1].map((score) => (
                    <option key={score} value={score}>
                      {score} / 5
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-4 block text-xs font-semibold">
              Comment (optional)
              <textarea
                className="input mt-1.5 min-h-28 resize-y"
                value={reviewForm.comment}
                onChange={(event) => setReviewForm({ ...reviewForm, comment: event.target.value })}
                placeholder="What stood out about the work and the experience?"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReviewOrderId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitReview}
                disabled={busy !== null}
              >
                {busy?.startsWith("review-") ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Star className="h-4 w-4" />
                )}
                Submit review
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {replyReviewId ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-secondary/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
                  {t("workspace.review.replyTitle")}
                </h2>
                <p className="mt-1 text-xs text-muted">{t("workspace.review.replyHint")}</p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm px-2"
                onClick={() => setReplyReviewId(null)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-5 block text-xs font-semibold">
              {t("workspace.review.reply")}
              <textarea
                className="input mt-1.5 min-h-32 resize-y"
                value={replyBody}
                onChange={(event) => setReplyBody(event.target.value)}
                placeholder={t("workspace.review.replyPlaceholder")}
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReplyReviewId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitReviewReply}
                disabled={busy !== null || !replyBody.trim()}
              >
                {busy === `reply-${replyReviewId}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {t("workspace.review.replyAction")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailOrderId ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-secondary/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">{t("workspace.orderDetail.title")}</p>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em]">
                  {detailOrder?.number ?? "Order"}
                </h2>
                <p className="mt-1 text-xs text-muted">{t("workspace.orderDetail.subtitle")}</p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm px-2"
                onClick={() => {
                  setDetailOrderId(null);
                  setDetailOrder(null);
                  setDetailError(null);
                }}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex items-center gap-2 py-16 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading order...
              </div>
            ) : detailError ? (
              <p className="mt-6 rounded-md border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
                {detailError}
              </p>
            ) : detailOrder ? (
              <div className="mt-6 space-y-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border border-border p-4">
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted">
                      Status
                    </p>
                    <span className={`badge mt-2 py-1 ${tone(detailOrder.status)}`}>
                      {orderStatus(detailOrder.status)}
                    </span>
                  </div>
                  <div className="rounded-md border border-border p-4">
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted">
                      Total
                    </p>
                    <p className="mt-1 font-display text-xl font-semibold">
                      {formatMoney(detailOrder.total, detailOrder.currency)}
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-4">
                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted">
                      Created
                    </p>
                    <p className="mt-2 text-xs">{formatDate(detailOrder.createdAt)}</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-md border border-border p-4">
                    <p className="text-xs font-semibold">
                      {detailOrder.gig?.title ?? detailOrder.offer?.title ?? "Custom order"}
                    </p>
                    <p className="mt-2 text-[0.72rem] leading-6 text-muted">
                      {detailOrder.offer?.description ??
                        detailOrder.gig?.description ??
                        "No scope note was attached."}
                    </p>
                    <p className="mt-3 text-[0.7rem] text-muted">
                      {detailOrder.staff.name} → {detailOrder.client.name}
                    </p>
                  </div>
                  <div className="rounded-md border border-border p-4">
                    <p className="text-xs font-semibold">
                      {t("workspace.orderDetail.requirements")}
                    </p>
                    {detailOrder.requirements &&
                    Object.keys(detailOrder.requirements).length > 0 ? (
                      <dl className="mt-2 space-y-1.5">
                        {Object.entries(detailOrder.requirements).map(([key, value]) => (
                          <div
                            key={key}
                            className="grid grid-cols-[0.8fr_1.2fr] gap-2 text-[0.7rem]"
                          >
                            <dt className="capitalize text-muted">{key.replaceAll("_", " ")}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="mt-2 text-[0.72rem] text-muted">
                        {t("workspace.orderDetail.empty")}
                      </p>
                    )}
                  </div>
                </div>

                {detailOrder.review ? (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                      {t("workspace.orderDetail.review")}
                    </h3>
                    <div className="mt-3 rounded-md border border-border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold">{detailOrder.client.name}</p>
                        <span className="badge badge-success py-1">
                          {(
                            (detailOrder.review.quality +
                              detailOrder.review.communication +
                              detailOrder.review.delivery) /
                            3
                          ).toFixed(1)}{" "}
                          / 5
                        </span>
                      </div>
                      {detailOrder.review.comment ? (
                        <p className="mt-2 text-xs leading-6 text-muted">
                          {detailOrder.review.comment}
                        </p>
                      ) : null}
                      {detailOrder.review.staffReply ? (
                        <div className="mt-3 border-l-2 border-primary/30 pl-3">
                          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-primary">
                            {detailOrder.staff.id === me.id
                              ? t("workspace.review.yourReply")
                              : t("workspace.review.staffReply")}
                          </p>
                          <p className="mt-1 text-xs leading-6 text-muted">
                            {detailOrder.review.staffReply}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                <div className="grid gap-5 sm:grid-cols-2">
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                      {t("workspace.orderDetail.timeline")}
                    </h3>
                    <div className="mt-3 space-y-2">
                      {detailOrder.events.length ? (
                        detailOrder.events.map((event) => (
                          <div key={event.id} className="rounded-md border border-border px-3 py-2">
                            <p className="text-[0.72rem] font-semibold capitalize">
                              {humanStatus(event.type.replace(/^order\./, "").replaceAll("_", " "))}
                            </p>
                            <p className="mt-0.5 text-[0.66rem] text-muted">
                              {formatDate(event.createdAt)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-[0.72rem] text-muted">
                          {t("workspace.orderDetail.empty")}
                        </p>
                      )}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                      {t("workspace.orderDetail.deliveries")}
                    </h3>
                    <div className="mt-3 space-y-2">
                      {detailOrder.deliveries.length ? (
                        detailOrder.deliveries.map((delivery) => (
                          <div
                            key={delivery.id}
                            className="rounded-md border border-border px-3 py-2"
                          >
                            <p className="text-[0.72rem] font-semibold">
                              Delivery {delivery.revisionNumber}
                            </p>
                            <p className="mt-1 text-[0.7rem] leading-5 text-muted">
                              {delivery.message ?? "No note attached."}
                            </p>
                            <p className="mt-1 text-[0.62rem] text-muted">
                              {formatDate(delivery.createdAt)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-[0.72rem] text-muted">
                          {t("workspace.orderDetail.empty")}
                        </p>
                      )}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                      {t("workspace.orderDetail.revisions")}
                    </h3>
                    <div className="mt-3 space-y-2">
                      {detailOrder.revisions.length ? (
                        detailOrder.revisions.map((revision) => (
                          <div
                            key={revision.id}
                            className="rounded-md border border-border px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[0.72rem] font-semibold capitalize">
                                {humanStatus(revision.status)}
                              </p>
                              <span className="text-[0.62rem] text-muted">
                                {formatDate(revision.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 text-[0.7rem] leading-5 text-muted">
                              {revision.notes ?? "No revision note."}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-[0.72rem] text-muted">
                          {t("workspace.orderDetail.empty")}
                        </p>
                      )}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                      {t("workspace.orderDetail.payments")}
                    </h3>
                    <div className="mt-3 space-y-2">
                      {detailOrder.payments.length ? (
                        detailOrder.payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="rounded-md border border-border px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[0.72rem] font-semibold capitalize">
                                {payment.provider} · {humanStatus(payment.status)}
                              </p>
                              <p className="text-[0.72rem] font-semibold">
                                {formatMoney(payment.amount, payment.currency)}
                              </p>
                            </div>
                            <p className="mt-1 text-[0.62rem] text-muted">
                              {formatDate(payment.createdAt)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-[0.72rem] text-muted">
                          {t("workspace.orderDetail.empty")}
                        </p>
                      )}
                    </div>
                  </section>
                </div>

                {detailOrder.invoices.length ? (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                      {t("workspace.orderDetail.invoices")}
                    </h3>
                    <div className="mt-3 space-y-2">
                      {detailOrder.invoices.map((invoice) => (
                        <div
                          key={invoice.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                        >
                          <div>
                            <p className="text-[0.72rem] font-semibold">{invoice.number}</p>
                            <p className="mt-0.5 text-[0.62rem] capitalize text-muted">
                              {invoice.type} · {formatDate(invoice.issuedAt)}
                            </p>
                          </div>
                          <p className="text-[0.72rem] font-semibold">
                            {formatMoney(invoice.total, invoice.currency)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <div className="flex justify-end">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setDetailOrderId(null);
                      setDetailOrder(null);
                      setDetailError(null);
                    }}
                  >
                    {t("workspace.orderDetail.close")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showGigForm ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-secondary/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
                  {editingGigId ? t("workspace.gig.editTitle") : t("workspace.gig.createTitle")}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {editingGigId ? t("workspace.gig.editHint") : t("workspace.gig.createHint")}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm px-2"
                onClick={() => {
                  setShowGigForm(false);
                  setEditingGigId(null);
                }}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 grid gap-3">
              <label className="text-xs font-semibold">
                Title
                <input
                  className="input mt-1.5"
                  value={gigForm.title}
                  onChange={(event) => setGigForm({ ...gigForm, title: event.target.value })}
                  placeholder="A concise promise of the outcome"
                />
              </label>
              <label className="text-xs font-semibold">
                Description
                <textarea
                  className="input mt-1.5 min-h-28 resize-y"
                  value={gigForm.description}
                  onChange={(event) => setGigForm({ ...gigForm, description: event.target.value })}
                  placeholder="What you deliver, how you work and who it is for."
                />
              </label>
              <label className="text-xs font-semibold">
                Category
                <select
                  className="input mt-1.5"
                  value={gigForm.categoryId}
                  onChange={(event) => setGigForm({ ...gigForm, categoryId: event.target.value })}
                >
                  <option value="">No category</option>
                  {data.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="text-xs font-semibold">
                  Price ({currency})
                  <input
                    className="input mt-1.5"
                    type="number"
                    min="1"
                    value={gigForm.price}
                    onChange={(event) => setGigForm({ ...gigForm, price: event.target.value })}
                  />
                </label>
                <label className="text-xs font-semibold">
                  Delivery days
                  <input
                    className="input mt-1.5"
                    type="number"
                    min="1"
                    value={gigForm.deliveryDays}
                    onChange={(event) =>
                      setGigForm({ ...gigForm, deliveryDays: event.target.value })
                    }
                  />
                </label>
                <label className="text-xs font-semibold">
                  Revisions
                  <input
                    className="input mt-1.5"
                    type="number"
                    min="0"
                    value={gigForm.revisions}
                    onChange={(event) => setGigForm({ ...gigForm, revisions: event.target.value })}
                  />
                </label>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  checked={gigForm.published}
                  onChange={(event) => setGigForm({ ...gigForm, published: event.target.checked })}
                />
                {t("workspace.gig.published")}
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowGigForm(false);
                  setEditingGigId(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveGig}
                disabled={busy !== null}
              >
                {busy === (editingGigId ? `gig-${editingGigId}` : "create-gig") ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BriefcaseBusiness className="h-4 w-4" />
                )}
                {editingGigId ? t("workspace.gig.save") : t("workspace.gig.createAction")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function orderStatus(status: string): string {
  return orderActions[status] ?? humanStatus(status);
}
