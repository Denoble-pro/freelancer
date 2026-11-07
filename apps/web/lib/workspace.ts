export type WsPerson = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
};

export type WsMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  type: string;
  body: string | null;
  attachments: Record<string, unknown> | null;
  createdAt: string;
  sender: WsPerson;
  readAt: string | null;
};

export type WsConversation = {
  id: string;
  relationshipId: string;
  locked: boolean;
  lastMessageAt: string | null;
  unread: number;
  participant: WsPerson;
  lastMessage: WsMessage | null;
};

export type WsOffer = {
  id: string;
  relationshipId: string;
  gigId: string | null;
  createdById: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  deliveryDays: number;
  revisions: number;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  canRespond: boolean;
  isMine: boolean;
  createdBy: WsPerson;
  relationship: { staff: WsPerson; client: WsPerson };
  order: { id: string; number: string; status: string } | null;
};

export type WsOrder = {
  id: string;
  number: string;
  relationshipId: string;
  status: string;
  price: number;
  fee: number;
  tax: number;
  total: number;
  currency: string;
  dueAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  createdAt: string;
  staff: WsPerson;
  client: WsPerson;
  gig: { id: string; title: string } | null;
  review: {
    id: string;
    visible: boolean;
    quality: number;
    communication: number;
    delivery: number;
    comment: string | null;
    staffReply: string | null;
    repliedAt: string | null;
    createdAt: string;
  } | null;
  payments: { id: string; status: string }[];
};

export type WsOrderDetail = Omit<WsOrder, "review" | "payments" | "gig"> & {
  gig: { id: string; title: string; description: string | null } | null;
  requirements: Record<string, string> | null;
  requirementsSubmittedAt: string | null;
  autoCompleteAt: string | null;
  reviewedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  offer: {
    id: string;
    title: string;
    description: string | null;
    price: number;
    currency: string;
    deliveryDays: number;
    revisions: number;
    status: string;
  } | null;
  review: (NonNullable<WsOrder["review"]> & { clientId: string; staffId: string }) | null;
  deliveries: {
    id: string;
    message: string | null;
    revisionNumber: number;
    createdAt: string;
  }[];
  revisions: {
    id: string;
    notes: string | null;
    status: string;
    resolvedAt: string | null;
    createdAt: string;
  }[];
  events: {
    id: string;
    type: string;
    actorId: string | null;
    data: Record<string, unknown> | null;
    createdAt: string;
  }[];
  payments: {
    id: string;
    provider: string;
    providerRef: string | null;
    amount: number;
    currency: string;
    status: string;
    paidAt: string | null;
    createdAt: string;
  }[];
  invoices: {
    id: string;
    number: string;
    type: string;
    amount: number;
    tax: number;
    total: number;
    currency: string;
    issuedAt: string;
    createdAt: string;
  }[];
};

export type WsGig = {
  id: string;
  staffId: string;
  title: string;
  description: string;
  status: string;
  featured: boolean;
  searchTags: string[];
  publishedAt: string | null;
  startingPrice: number;
  staff: WsPerson & {
    staffProfile: {
      title: string | null;
      department: string | null;
      bio: string | null;
      skills: string[];
      availability: string;
    } | null;
  };
  category: { id: string; name: string; slug: string } | null;
  packages: {
    id: string;
    key: string;
    name: string;
    price: number;
    deliveryDays: number;
    revisions: number;
    features: string[];
  }[];
  media: { id: string; url: string; altText: string | null }[];
  rating: { count: number; average: number };
};

export type WsRelationship = {
  id: string;
  staffId: string;
  clientId: string;
  status: string;
  createdAt: string;
  staff: WsPerson;
  client: WsPerson;
  conversation: { id: string; lastMessageAt: string | null; locked: boolean } | null;
};

export type WsNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

export type WsInvitation = {
  id: string;
  email: string;
  message: string | null;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export type WorkspaceData = {
  me: { user: WsPerson; permissions: string[]; sessionId: string };
  relationships: WsRelationship[];
  conversations: WsConversation[];
  offers: WsOffer[];
  orders: WsOrder[];
  gigs: WsGig[];
  categories: { id: string; name: string; slug: string }[];
  notifications: WsNotification[];
  unreadNotifications: number;
  invitations: WsInvitation[];
  stats: {
    activeOrders: number;
    unreadMessages: number;
    pendingOffers: number;
    completedOrders: number;
    earnings: number;
    spend: number;
  };
};

const apiBase = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

export async function getWorkspace(cookieHeader: string): Promise<WorkspaceData | null> {
  try {
    const response = await fetch(`${apiBase}/api/v1/workspace`, {
      cache: "no-store",
      headers: { cookie: cookieHeader },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { data: WorkspaceData };
    return payload.data;
  } catch {
    return null;
  }
}

export async function getMessages(
  cookieHeader: string,
  conversationId: string,
): Promise<{ items: WsMessage[]; locked: boolean } | null> {
  try {
    const response = await fetch(
      `${apiBase}/api/v1/workspace/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        cache: "no-store",
        headers: { cookie: cookieHeader },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { data: { items: WsMessage[]; locked: boolean } };
    return payload.data;
  } catch {
    return null;
  }
}

export async function getWorkspaceForSession(): Promise<WorkspaceData | null> {
  const { forwardedCookieHeader } = await import("./server");
  return getWorkspace(await forwardedCookieHeader());
}
