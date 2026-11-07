export type FeatureFlagDefinition = {
  key: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
  isPublic?: boolean;
};

export const featureFlagDefaults: FeatureFlagDefinition[] = [
  {
    key: "chat.realtime",
    label: "Real-time chat",
    description: "Enable WebSocket delivery, typing indicators and read receipts.",
    defaultEnabled: true,
    isPublic: true,
  },
  {
    key: "chat.attachments",
    label: "Chat attachments",
    description: "Allow files and images in messages.",
    defaultEnabled: true,
    isPublic: true,
  },
  {
    key: "chat.voiceNotes",
    label: "Voice notes",
    description: "Allow recorded voice messages in chat.",
    defaultEnabled: false,
  },
  {
    key: "chat.linkPreviews",
    label: "Link previews",
    description: "Unfurl links shared in chat.",
    defaultEnabled: true,
  },
  {
    key: "marketplace.publicDirectory",
    label: "Public gig directory",
    description: "Let guests browse staff gigs. Off by default.",
    defaultEnabled: false,
    isPublic: true,
  },
  {
    key: "orders.revisions",
    label: "Revisions",
    description: "Allow clients to request revisions within the offered limit.",
    defaultEnabled: true,
  },
  {
    key: "orders.tips",
    label: "Client tips",
    description: "Offer an optional tip after delivery.",
    defaultEnabled: false,
  },
  {
    key: "payments.manualBankTransfer",
    label: "Manual bank transfer",
    description: "Enable proof-of-transfer checkout with admin confirmation.",
    defaultEnabled: true,
    isPublic: true,
  },
  {
    key: "payments.multipleGateways",
    label: "Multiple payment gateways",
    description: "Allow more than one online gateway to be active.",
    defaultEnabled: true,
  },
  {
    key: "disputes.enabled",
    label: "Disputes",
    description: "Allow clients and staff to open an order dispute.",
    defaultEnabled: true,
    isPublic: true,
  },
  {
    key: "reviews.enabled",
    label: "Reviews and ratings",
    description: "Collect reviews after order completion.",
    defaultEnabled: true,
    isPublic: true,
  },
  {
    key: "notifications.email",
    label: "Email notifications",
    description: "Send transactional email via the configured provider.",
    defaultEnabled: true,
  },
  {
    key: "notifications.browserPush",
    label: "Browser push",
    description: "Allow optional web push subscriptions.",
    defaultEnabled: false,
  },
  {
    key: "announcements.enabled",
    label: "Announcements",
    description: "Show admin announcements as a banner or popup.",
    defaultEnabled: true,
  },
  {
    key: "onboarding.tours",
    label: "First-run tours",
    description: "Show guided tours to new staff and clients.",
    defaultEnabled: true,
  },
];

export const featureFlagDefaultMap: Record<string, boolean> = Object.fromEntries(
  featureFlagDefaults.map((flag) => [flag.key, flag.defaultEnabled]),
);
