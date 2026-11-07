export type PermissionDefinition = {
  key: string;
  label: string;
  group: string;
  description: string;
};

export const permissions: PermissionDefinition[] = [
  {
    key: "dashboard.admin",
    label: "View admin dashboard",
    group: "Back office",
    description: "Access the management overview and metrics.",
  },
  {
    key: "users.read",
    label: "View staff and clients",
    group: "People",
    description: "Browse staff and client accounts and relationships.",
  },
  {
    key: "users.write",
    label: "Manage staff and clients",
    group: "People",
    description: "Invite, approve, suspend, edit and reassign users.",
  },
  {
    key: "roles.write",
    label: "Edit roles and permissions",
    group: "People",
    description: "Change the permission matrix.",
  },
  {
    key: "gigs.read",
    label: "View all gigs",
    group: "Marketplace",
    description: "Review every staff gig.",
  },
  {
    key: "gigs.write",
    label: "Manage all gigs",
    group: "Marketplace",
    description: "Approve, reject, edit, feature and pause gigs.",
  },
  {
    key: "invitations.read",
    label: "View all invitations",
    group: "Marketplace",
    description: "Audit invitations sent by staff.",
  },
  {
    key: "invitations.write",
    label: "Manage invitations",
    group: "Marketplace",
    description: "Send, revoke and reissue invitations on behalf of staff.",
  },
  {
    key: "conversations.read.all",
    label: "Read all conversations",
    group: "Communication",
    description: "Compliance access to every staff-client conversation.",
  },
  {
    key: "conversations.manage",
    label: "Moderate conversations",
    group: "Communication",
    description: "Lock threads and send system messages.",
  },
  {
    key: "offers.read.all",
    label: "View all offers",
    group: "Orders",
    description: "See offers across every relationship.",
  },
  {
    key: "orders.read.all",
    label: "View all orders",
    group: "Orders",
    description: "See every order, delivery and event.",
  },
  {
    key: "orders.write.all",
    label: "Manage all orders",
    group: "Orders",
    description: "Change status, extend deadlines and reassign orders.",
  },
  {
    key: "payments.read",
    label: "View payments and ledger",
    group: "Finance",
    description: "See payments, escrow, refunds and payouts.",
  },
  {
    key: "payments.write",
    label: "Manage payments",
    group: "Finance",
    description: "Confirm transfers, refund, release funds and process payouts.",
  },
  {
    key: "disputes.resolve",
    label: "Resolve disputes",
    group: "Finance",
    description: "Review evidence and decide dispute outcomes.",
  },
  {
    key: "reviews.moderate",
    label: "Moderate reviews",
    group: "Marketplace",
    description: "Hide, restore or reply to reviews.",
  },
  {
    key: "content.read",
    label: "View content and text",
    group: "Site",
    description: "Read every editable content key.",
  },
  {
    key: "content.write",
    label: "Edit content and text",
    group: "Site",
    description: "Change any user-facing text, with version history.",
  },
  {
    key: "settings.read",
    label: "View settings",
    group: "Site",
    description: "Read business rules and configuration.",
  },
  {
    key: "settings.write",
    label: "Edit settings",
    group: "Site",
    description: "Change business rules and configuration.",
  },
  {
    key: "theme.read",
    label: "View branding and theme",
    group: "Site",
    description: "Read branding colours, fonts and assets.",
  },
  {
    key: "theme.write",
    label: "Edit branding and theme",
    group: "Site",
    description: "Change the live theme.",
  },
  {
    key: "pages.write",
    label: "Edit pages, menus and blocks",
    group: "Site",
    description: "Manage landing blocks, static pages and navigation.",
  },
  {
    key: "templates.write",
    label: "Edit notification templates",
    group: "Site",
    description: "Change email, SMS and in-app templates.",
  },
  {
    key: "flags.write",
    label: "Manage feature flags",
    group: "Site",
    description: "Turn major product features on or off.",
  },
  {
    key: "reports.read",
    label: "View reports",
    group: "Finance",
    description: "Access revenue, performance and export reports.",
  },
  {
    key: "audit.read",
    label: "View audit log",
    group: "Security",
    description: "See administrative actions and impersonation.",
  },
  {
    key: "jobs.manage",
    label: "Manage background jobs",
    group: "Operations",
    description: "Inspect, retry and schedule background jobs.",
  },
  {
    key: "profile.self",
    label: "Edit own profile",
    group: "Self service",
    description: "Update your own display name, photo and details.",
  },
  {
    key: "gigs.self",
    label: "Manage own gig",
    group: "Self service",
    description: "Create and maintain your single gig.",
  },
  {
    key: "invitations.self",
    label: "Invite own clients",
    group: "Self service",
    description: "Send and track invitations to your own clients.",
  },
  {
    key: "conversations.self",
    label: "Message own clients",
    group: "Self service",
    description: "Use the chat inside your own relationships.",
  },
  {
    key: "offers.self",
    label: "Manage own offers",
    group: "Self service",
    description: "Create and revise offers for your own clients.",
  },
  {
    key: "orders.self",
    label: "Manage own orders",
    group: "Self service",
    description: "Deliver and manage orders in your own relationships.",
  },
  {
    key: "earnings.self",
    label: "View own earnings",
    group: "Self service",
    description: "See your own earnings, payouts and invoices.",
  },
  {
    key: "orders.client",
    label: "Manage own purchases",
    group: "Client",
    description: "Submit requirements, approve delivery and request revisions.",
  },
  {
    key: "offers.accept",
    label: "Accept and pay offers",
    group: "Client",
    description: "Accept and pay or cancel offers sent to you in a conversation.",
  },
  {
    key: "reviews.create",
    label: "Leave reviews",
    group: "Client",
    description: "Review completed orders within the review window.",
  },
  {
    key: "disputes.create",
    label: "Open disputes",
    group: "Client",
    description: "Open a dispute on an eligible order.",
  },
  {
    key: "data.export.self",
    label: "Export own data",
    group: "Privacy",
    description: "Download a copy of your personal data.",
  },
];

export const permissionKeys = permissions.map((permission) => permission.key);

export const roleDefinitions = [
  {
    key: "admin",
    name: "Management",
    description: "Full oversight of people, orders, payments, disputes and the site itself.",
    permissions: permissionKeys,
  },
  {
    key: "staff",
    name: "Staff / Seller",
    description: "Runs one gig and serves only the clients they personally invite.",
    permissions: [
      "profile.self",
      "gigs.self",
      "invitations.self",
      "conversations.self",
      "offers.self",
      "orders.self",
      "earnings.self",
      "data.export.self",
    ],
  },
  {
    key: "client",
    name: "Client / Buyer",
    description:
      "Works with the staff member who invited them; cannot browse the wider marketplace.",
    permissions: [
      "profile.self",
      "conversations.self",
      "orders.client",
      "offers.accept",
      "reviews.create",
      "disputes.create",
      "data.export.self",
    ],
  },
] as const;

export type RoleKey = (typeof roleDefinitions)[number]["key"];
