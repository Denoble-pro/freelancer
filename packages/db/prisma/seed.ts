/* eslint-disable no-console */
import { hash } from "@node-rs/argon2";
import { Prisma } from "@prisma/client";
import {
  contentDefaults,
  featureFlagDefaults,
  navigationDefaults,
  permissions as permissionDefinitions,
  roleDefinitions,
  settingDefaults,
  themeDefaults,
} from "@dlp/shared";
import { db } from "../src/index.js";

const ADMIN_ID = "11111111-1111-4111-8111-111111111101";
const STAFF_IDS = [
  "11111111-1111-4111-8111-111111111102",
  "11111111-1111-4111-8111-111111111103",
  "11111111-1111-4111-8111-111111111104",
] as const;
const CLIENT_IDS = [
  "11111111-1111-4111-8111-111111111201",
  "11111111-1111-4111-8111-111111111202",
  "11111111-1111-4111-8111-111111111203",
  "11111111-1111-4111-8111-111111111204",
  "11111111-1111-4111-8111-111111111205",
] as const;

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@denobelpro.local";
const adminName = process.env.SEED_ADMIN_NAME ?? "Denobelpro Management";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe-Immediately-2026!";
const demoPassword = process.env.SEED_DEMO_PASSWORD ?? "Denobelpro!2026";

const json = (value: unknown) => value as Prisma.InputJsonValue;

async function seedSettings() {
  for (const setting of settingDefaults) {
    const data = {
      label: setting.label,
      description: setting.description,
      group: setting.group,
      type: setting.type,
      defaultValue: json(setting.defaultValue),
      validation: setting.validation ? json(setting.validation) : undefined,
      isPublic: setting.isPublic ?? false,
      isSecret: setting.isSecret ?? false,
    };

    await db.setting.upsert({
      where: { key: setting.key },
      update: data,
      create: {
        key: setting.key,
        ...data,
        value: json(setting.defaultValue),
      },
    });
  }
  console.log(`  settings: ${settingDefaults.length} definitions ready`);
}

async function seedContent() {
  for (const item of contentDefaults) {
    await db.contentString.upsert({
      where: { key: item.key },
      update: {
        group: item.group,
        label: item.label,
        defaultValue: item.defaultValue,
        description: item.description,
      },
      create: {
        key: item.key,
        group: item.group,
        label: item.label,
        defaultValue: item.defaultValue,
        description: item.description,
      },
    });
  }
  console.log(`  content: ${contentDefaults.length} strings ready`);
}

async function seedTheme() {
  for (const token of themeDefaults) {
    await db.themeToken.upsert({
      where: { key: token.key },
      update: {
        group: token.group,
        label: token.label,
        type: token.type,
        defaultValue: token.defaultValue,
      },
      create: {
        key: token.key,
        group: token.group,
        label: token.label,
        type: token.type,
        defaultValue: token.defaultValue,
      },
    });
  }
  console.log(`  theme: ${themeDefaults.length} tokens ready`);
}

async function seedFeatureFlags() {
  for (const flag of featureFlagDefaults) {
    await db.featureFlag.upsert({
      where: { key: flag.key },
      update: {
        label: flag.label,
        description: flag.description,
        defaultEnabled: flag.defaultEnabled,
        isPublic: flag.isPublic ?? false,
      },
      create: {
        key: flag.key,
        label: flag.label,
        description: flag.description,
        enabled: flag.defaultEnabled,
        defaultEnabled: flag.defaultEnabled,
        isPublic: flag.isPublic ?? false,
      },
    });
  }
  console.log(`  feature flags: ${featureFlagDefaults.length} ready`);
}

async function seedRoles() {
  for (const definition of permissionDefinitions) {
    await db.permission.upsert({
      where: { key: definition.key },
      update: {
        label: definition.label,
        group: definition.group,
        description: definition.description,
      },
      create: definition,
    });
  }

  for (const role of roleDefinitions) {
    const roleRecord = await db.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description, isSystem: true },
      create: {
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: true,
      },
    });

    const existing = await db.rolePermission.count({ where: { roleId: roleRecord.id } });
    if (existing === 0) {
      const permissionRecords = await db.permission.findMany({
        where: { key: { in: [...role.permissions] } },
        select: { id: true },
      });
      await db.rolePermission.createMany({
        data: permissionRecords.map((permission) => ({
          roleId: roleRecord.id,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      });
    }
  }
  console.log(
    `  roles: ${roleDefinitions.length} with ${permissionDefinitions.length} permissions`,
  );
}

async function seedLanguages() {
  await db.language.upsert({
    where: { code: "en" },
    update: { name: "English", direction: "ltr", enabled: true },
    create: { code: "en", name: "English", direction: "ltr", enabled: true, isDefault: true },
  });
}

type CategorySeed = {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentId?: string;
  sortOrder: number;
};

async function seedCategories(): Promise<Map<string, string>> {
  const designId = "22222222-2222-4222-8222-222222222201";
  const categories: CategorySeed[] = [
    {
      id: designId,
      name: "Design & Brand",
      slug: "design-brand",
      description: "Identity, graphics, product and presentation design.",
      sortOrder: 10,
    },
    {
      id: "22222222-2222-4222-8222-222222222202",
      name: "Development & Technology",
      slug: "development-technology",
      description: "Websites, applications, integrations and technical support.",
      sortOrder: 20,
    },
    {
      id: "22222222-2222-4222-8222-222222222203",
      name: "Writing & Content",
      slug: "writing-content",
      description: "Copywriting, editing, documentation and content strategy.",
      sortOrder: 30,
    },
    {
      id: "22222222-2222-4222-8222-222222222204",
      name: "Marketing & Growth",
      slug: "marketing-growth",
      description: "Campaigns, social media, email and search.",
      sortOrder: 40,
    },
    {
      id: "22222222-2222-4222-8222-222222222205",
      name: "Brand Identity",
      slug: "brand-identity",
      description: "Logos, visual systems and brand guidelines.",
      parentId: designId,
      sortOrder: 11,
    },
  ];

  const map = new Map<string, string>();
  for (const category of categories) {
    const record = await db.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        parentId: category.parentId,
        sortOrder: category.sortOrder,
      },
      create: category,
    });
    map.set(category.slug, record.id);
  }
  console.log(`  categories: ${categories.length} ready`);
  return map;
}

const taxonomySeed = [
  ["order_status", "offer_accepted", "Offer accepted", "#0E7A5F", 10],
  ["order_status", "awaiting_payment", "Awaiting payment", "#B45309", 20],
  ["order_status", "paid", "Paid · in escrow", "#0E7A5F", 30],
  ["order_status", "awaiting_requirements", "Awaiting requirements", "#B45309", 40],
  ["order_status", "in_progress", "In progress", "#2563EB", 50],
  ["order_status", "delivered", "Delivered", "#7C3AED", 60],
  ["order_status", "revision_requested", "Revision requested", "#B45309", 70],
  ["order_status", "completed", "Completed", "#15803D", 80],
  ["order_status", "reviewed", "Reviewed", "#15803D", 90],
  ["order_status", "cancellation_requested", "Cancellation requested", "#B45309", 100],
  ["order_status", "cancelled", "Cancelled", "#5C6B62", 110],
  ["order_status", "late", "Late", "#B42318", 120],
  ["order_status", "in_dispute", "In dispute", "#B42318", 130],
  ["order_status", "refunded", "Refunded", "#5C6B62", 140],
  ["dispute_reason", "not_delivered", "Work was not delivered", "#B42318", 10],
  ["dispute_reason", "not_as_described", "Work does not match the offer", "#B42318", 20],
  ["dispute_reason", "quality", "Quality concerns", "#B45309", 30],
  ["dispute_reason", "scope", "Disagreement about scope", "#B45309", 40],
  ["dispute_reason", "other", "Something else", "#5C6B62", 50],
  ["cancellation_reason", "changed_mind", "Changed plans", "#5C6B62", 10],
  ["cancellation_reason", "timeline", "Timeline no longer works", "#5C6B62", 20],
  ["cancellation_reason", "duplicate", "Duplicate order", "#5C6B62", 30],
  ["cancellation_reason", "other", "Other reason", "#5C6B62", 40],
  ["notification_type", "invite_accepted", "Client accepted an invitation", "#0E7A5F", 10],
  ["notification_type", "new_message", "New message", "#0E7A5F", 20],
  ["notification_type", "offer_sent", "Offer sent", "#0E7A5F", 30],
  ["notification_type", "offer_accepted", "Offer accepted", "#15803D", 40],
  ["notification_type", "offer_declined", "Offer declined", "#B45309", 50],
  ["notification_type", "offer_cancelled", "Offer cancelled", "#B45309", 55],
  ["notification_type", "offer_expired", "Offer expired", "#5C6B62", 60],
  ["notification_type", "payment_received", "Payment received", "#15803D", 70],
  ["notification_type", "requirements_submitted", "Requirements submitted", "#0E7A5F", 80],
  ["notification_type", "delivery_made", "Delivery made", "#7C3AED", 90],
  ["notification_type", "revision_requested", "Revision requested", "#B45309", 100],
  ["notification_type", "order_completed", "Order completed", "#15803D", 110],
  ["notification_type", "order_late", "Order is late", "#B42318", 120],
  ["notification_type", "dispute_opened", "Dispute opened", "#B42318", 130],
  ["notification_type", "payout_processed", "Payout processed", "#15803D", 140],
  ["notification_type", "announcement", "Announcement", "#0E7A5F", 150],
  ["review_criterion", "communication", "Communication", "#0E7A5F", 10],
  ["review_criterion", "quality", "Service quality", "#0E7A5F", 20],
  ["review_criterion", "delivery", "Delivery", "#0E7A5F", 30],
] as const;

async function seedTaxonomies() {
  for (const [type, key, label, color, sortOrder] of taxonomySeed) {
    await db.taxonomy.upsert({
      where: { type_key: { type, key } },
      update: { label, color, sortOrder, active: true },
      create: { type, key, label, color, sortOrder, active: true },
    });
  }
  console.log(`  taxonomies: ${taxonomySeed.length} labels ready`);
}

async function seedMenus() {
  for (const menu of navigationDefaults) {
    const menuRecord = await db.menu.upsert({
      where: { key: menu.key },
      update: { label: menu.label },
      create: { key: menu.key, label: menu.label },
    });

    const count = await db.menuItem.count({ where: { menuId: menuRecord.id } });
    if (count === 0) {
      await db.menuItem.createMany({
        data: menu.items.map((item) => ({
          menuId: menuRecord.id,
          label: item.label,
          labelKey: item.labelKey,
          url: item.url,
          sortOrder: item.sortOrder,
          roleVisibility: item.roleVisibility,
        })),
      });
    }
  }
  console.log(`  menus: ${navigationDefaults.length} ready`);
}

type SeedUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "staff" | "client";
  password: string;
};

async function upsertUser(user: SeedUser) {
  const existing = await db.user.findUnique({ where: { email: user.email } });
  if (existing) {
    return db.user.update({
      where: { id: existing.id },
      data: { name: existing.name || user.name },
    });
  }

  return db.user.create({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      passwordHash: await hash(user.password),
      status: "active",
      emailVerifiedAt: new Date(),
      timezone: "Africa/Lagos",
    },
  });
}

async function seedPeople() {
  const admin = await upsertUser({
    id: ADMIN_ID,
    email: adminEmail,
    name: adminName,
    role: "admin",
    password: adminPassword,
  });

  const staffSeeds = [
    {
      email: "amara.okafor@denobelpro.com",
      name: "Amara Okafor",
      title: "Brand & Visual Designer",
      department: "Design",
      inviteCode: "AMARA7",
      bio: "I help ambitious teams look as considered as the work they do. Ten years across identity, packaging and digital brand systems.",
    },
    {
      email: "tunde.bello@denobelpro.com",
      name: "Tunde Bello",
      title: "Full-stack Developer",
      department: "Technology",
      inviteCode: "TUNDE9",
      bio: "I build fast, dependable web products. From marketing sites to customer portals, with a soft spot for clean architecture and accessible interfaces.",
    },
    {
      email: "zara.musa@denobelpro.com",
      name: "Zara Musa",
      title: "Content Strategist & Copywriter",
      department: "Content",
      inviteCode: "ZARA4",
      bio: "Words that sound like a person wrote them. I work on launch copy, brand voice, editorial and the occasional very stubborn homepage headline.",
    },
  ];

  const staff = [] as { id: string; email: string; name: string }[];
  for (let index = 0; index < staffSeeds.length; index += 1) {
    const seed = staffSeeds[index]!;
    const user = await upsertUser({
      id: STAFF_IDS[index]!,
      email: seed.email,
      name: seed.name,
      role: "staff",
      password: demoPassword,
    });
    await db.staffProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        title: seed.title,
        department: seed.department,
        bio: seed.bio,
        skills: ["Brand strategy", "Visual identity", "Art direction"],
        languages: ["English"],
        yearsExperience: 8,
        responseTimeHours: 4,
        availability: "available",
        timezone: "Africa/Lagos",
        inviteCode: seed.inviteCode,
        approvalStatus: "approved",
        workingHours: json({ mondayToFriday: "09:00-17:00", timezone: "Africa/Lagos" }),
      },
    });
    staff.push({ id: user.id, email: user.email, name: user.name });
  }

  const clientSeeds = [
    { email: "grace@acme.test", name: "Grace Adeyemi", company: "Acme Foods", country: "Nigeria" },
    {
      email: "daniel@northstar.test",
      name: "Daniel Mensah",
      company: "Northstar Legal",
      country: "Ghana",
    },
    { email: "ifeoma@lumen.test", name: "Ifeoma Eze", company: "Lumen Health", country: "Nigeria" },
    {
      email: "samuel@harbor.test",
      name: "Samuel Boateng",
      company: "Harbor Freight",
      country: "Ghana",
    },
    {
      email: "leila@cedar.test",
      name: "Leila Haddad",
      company: "Cedar Studio",
      country: "United Kingdom",
    },
  ];

  const clients = [] as { id: string; email: string; name: string }[];
  for (let index = 0; index < clientSeeds.length; index += 1) {
    const seed = clientSeeds[index]!;
    const user = await upsertUser({
      id: CLIENT_IDS[index]!,
      email: seed.email,
      name: seed.name,
      role: "client",
      password: demoPassword,
    });
    await db.clientProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        company: seed.company,
        country: seed.country,
      },
    });
    clients.push({ id: user.id, email: user.email, name: user.name });
  }

  return { admin, staff, clients };
}

type People = Awaited<ReturnType<typeof seedPeople>>;

async function seedRelationships(people: People) {
  const pairs = [
    { staff: people.staff[0]!, client: people.clients[0]!, via: "email" },
    { staff: people.staff[0]!, client: people.clients[1]!, via: "link" },
    { staff: people.staff[1]!, client: people.clients[2]!, via: "email" },
    { staff: people.staff[2]!, client: people.clients[3]!, via: "whatsapp" },
    { staff: people.staff[2]!, client: people.clients[4]!, via: "qr" },
  ];

  const relationships = [];
  for (const pair of pairs) {
    const relationship = await db.relationship.upsert({
      where: { staffId_clientId: { staffId: pair.staff.id, clientId: pair.client.id } },
      update: { lastInteractionAt: new Date() },
      create: {
        staffId: pair.staff.id,
        clientId: pair.client.id,
        status: "active",
        invitedVia: pair.via,
        lastInteractionAt: new Date(),
      },
    });
    relationships.push(relationship);
  }
  console.log(`  relationships: ${relationships.length} ready`);
  return relationships;
}

async function seedMessages(
  people: People,
  relationships: Awaited<ReturnType<typeof seedRelationships>>,
) {
  const scripts = [
    {
      relationship: relationships[0]!,
      messages: [
        {
          sender: people.clients[0]!.id,
          body: "Hi Amara, thank you for the invitation. We are preparing a rebrand for our retail range and would love your help.",
        },
        {
          sender: people.staff[0]!.id,
          body: "Grace, it is wonderful to have you here. I have a few questions about where the current identity is letting you down. When are you hoping to launch?",
        },
        {
          sender: people.clients[0]!.id,
          body: "We would like to be in market before the end of the quarter. I will send over the old guidelines this afternoon.",
        },
        {
          sender: people.staff[0]!.id,
          body: "Perfect. Once I have those I will put together a clear scope, timeline and price as an offer here in our workspace.",
        },
      ],
    },
    {
      relationship: relationships[2]!,
      messages: [
        {
          sender: people.clients[2]!.id,
          body: "Hello Tunde. Our patient portal is live but the booking flow feels slow on mobile.",
        },
        {
          sender: people.staff[1]!.id,
          body: "Thanks Ifeoma. I can take a look this week. Could you share a rough sense of peak traffic and the devices most patients use?",
        },
        {
          sender: people.clients[2]!.id,
          body: "Mostly Android, and mornings are busiest. I can send analytics access.",
        },
      ],
    },
  ];

  for (const script of scripts) {
    const conversation = await db.conversation.upsert({
      where: { relationshipId: script.relationship.id },
      update: { lastMessageAt: new Date() },
      create: { relationshipId: script.relationship.id, lastMessageAt: new Date() },
    });

    const messageCount = await db.message.count({ where: { conversationId: conversation.id } });
    if (messageCount === 0) {
      const baseTime = Date.now() - script.messages.length * 15 * 60 * 1000;
      await db.message.createMany({
        data: script.messages.map((message, index) => ({
          conversationId: conversation.id,
          senderId: message.sender,
          type: "text",
          body: message.body,
          readAt: index < script.messages.length - 1 ? new Date() : null,
          createdAt: new Date(baseTime + index * 15 * 60 * 1000),
        })),
      });
      await db.relationship.update({
        where: { id: script.relationship.id },
        data: { lastInteractionAt: new Date() },
      });
    }
  }
  console.log(`  conversations: ${scripts.length} with sample messages`);
}

async function seedOffers(
  people: People,
  relationships: Awaited<ReturnType<typeof seedRelationships>>,
) {
  const existing = await db.offer.count({ where: { relationshipId: relationships[0]!.id } });
  if (existing > 0) return;
  await db.offer.create({
    data: {
      relationshipId: relationships[0]!.id,
      createdById: people.staff[0]!.id,
      title: "Brand refresh — retail range",
      description:
        "A focused refresh of the Acme Foods identity for the new retail range: logo refinement, colour system, packaging direction and a concise usage guide.",
      price: new Prisma.Decimal(320000),
      currency: "NGN",
      deliveryDays: 7,
      revisions: 2,
      status: "sent",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      requirements: json([
        { label: "Existing brand materials", type: "file", required: true },
        { label: "Launch date and channels", type: "text", required: true },
        { label: "Three brands you admire", type: "text", required: false },
      ]),
    },
  });
  console.log("  offers: 1 sample offer ready");
}

async function seedGigs(people: People, categories: Map<string, string>) {
  const gigSeeds = [
    {
      staff: people.staff[0]!,
      categorySlug: "brand-identity",
      title: "A brand identity that feels unmistakably yours",
      description:
        "<p>I build thoughtful identities for teams who care how they are perceived. We start with a short discovery, then move through direction, design and delivery.</p><p>You leave with a logo system, colour and type foundations, and a practical guide your team can actually use.</p>",
      tags: ["brand identity", "logo", "packaging", "visual system"],
      featured: true,
      packages: [
        {
          key: "basic",
          name: "Essential mark",
          price: 180000,
          deliveryDays: 5,
          revisions: 1,
          features: ["Primary logo", "Colour palette", "One-page usage note"],
        },
        {
          key: "standard",
          name: "Signature identity",
          price: 320000,
          deliveryDays: 7,
          revisions: 2,
          features: ["Logo system", "Colour and type direction", "Basic brand guide"],
        },
        {
          key: "premium",
          name: "Full identity",
          price: 520000,
          deliveryDays: 10,
          revisions: 3,
          features: ["Logo system", "Brand guide", "Packaging direction", "Launch assets"],
        },
      ],
    },
    {
      staff: people.staff[1]!,
      categorySlug: "development-technology",
      title: "A fast, reliable web presence built to convert",
      description:
        "<p>I design and build clean, accessible websites that load quickly and are straightforward to maintain.</p><p>Every project includes performance checks, responsive layouts and a short handover walkthrough for your team.</p>",
      tags: ["website", "next.js", "performance", "accessibility"],
      featured: false,
      packages: [
        {
          key: "basic",
          name: "Landing page",
          price: 250000,
          deliveryDays: 7,
          revisions: 1,
          features: ["One responsive page", "Basic SEO", "Contact form"],
        },
        {
          key: "standard",
          name: "Marketing site",
          price: 480000,
          deliveryDays: 14,
          revisions: 2,
          features: ["Up to five pages", "CMS setup", "Performance audit"],
        },
        {
          key: "premium",
          name: "Custom web build",
          price: 900000,
          deliveryDays: 21,
          revisions: 3,
          features: ["Custom application", "Integrations", "Handover session"],
        },
      ],
    },
    {
      staff: people.staff[2]!,
      categorySlug: "writing-content",
      title: "Words that make your next launch land",
      description:
        "<p>I write clear, human copy for launches, websites and campaigns. No filler, no wall of buzzwords.</p><p>We begin with a short messaging conversation, then I deliver copy ready for design or publication.</p>",
      tags: ["copywriting", "launch", "website copy", "brand voice"],
      featured: false,
      packages: [
        {
          key: "basic",
          name: "One page",
          price: 90000,
          deliveryDays: 3,
          revisions: 1,
          features: ["Up to 500 words", "One round of revisions"],
        },
        {
          key: "standard",
          name: "Launch pack",
          price: 220000,
          deliveryDays: 6,
          revisions: 2,
          features: ["Landing page copy", "Three emails", "Messaging notes"],
        },
        {
          key: "premium",
          name: "Full voice kit",
          price: 380000,
          deliveryDays: 10,
          revisions: 3,
          features: ["Website copy", "Brand voice guide", "Social toolkit"],
        },
      ],
    },
  ];

  for (const seed of gigSeeds) {
    const existing = await db.gig.findFirst({ where: { staffId: seed.staff.id } });
    if (existing) continue;

    const gig = await db.gig.create({
      data: {
        staffId: seed.staff.id,
        categoryId: categories.get(seed.categorySlug),
        title: seed.title,
        description: seed.description,
        status: "live",
        featured: seed.featured,
        searchTags: seed.tags,
        whatYouGet: json([
          "A dedicated specialist",
          "Clear milestones",
          "Editable source files",
          "A calm, documented handover",
        ]),
        publishedAt: new Date(),
      },
    });

    await db.gigPackage.createMany({
      data: seed.packages.map((gigPackage, index) => ({
        gigId: gig.id,
        key: gigPackage.key,
        name: gigPackage.name,
        description: null,
        price: new Prisma.Decimal(gigPackage.price),
        deliveryDays: gigPackage.deliveryDays,
        revisions: gigPackage.revisions,
        features: gigPackage.features,
        sortOrder: index * 10,
      })),
    });

    await db.gigFaq.createMany({
      data: [
        {
          gigId: gig.id,
          question: "How do we start?",
          answer:
            "Accept an offer and complete the short requirement questions. I will confirm the plan and timeline in the order.",
          sortOrder: 10,
        },
        {
          gigId: gig.id,
          question: "What do you need from me?",
          answer:
            "Any existing materials, a sense of your audience, and one decision-maker who can approve the work.",
          sortOrder: 20,
        },
        {
          gigId: gig.id,
          question: "What if the scope changes?",
          answer:
            "We agree a revised offer before any additional work begins, so there are no surprises on either side.",
          sortOrder: 30,
        },
      ],
    });
  }
  console.log(`  gigs: ${gigSeeds.length} sample gigs ready`);
}

const pageSeeds = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    html: "<p>Denobelpro collects only the information needed to run your private workspace: account details, conversations, offers, orders and payment records.</p><p>Your data is visible to you and to Denobelpro management for service and compliance purposes. Staff cannot access another staff member's clients, chats or orders.</p><p>To request a copy of your data or ask for account deletion, contact support. Financial records are retained where required by law.</p>",
  },
  {
    slug: "terms",
    title: "Terms of Use",
    html: "<p>This marketplace is available only to invited Denobelpro clients and authorised staff. Accounts are personal and may not be shared.</p><p>Offers, delivery timelines and revision limits are agreed before payment. Payments are held in escrow until delivery is approved or the auto-completion window ends.</p><p>Disputes are reviewed by Denobelpro management. Management's decision on a disputed order is final within this workspace.</p>",
  },
  {
    slug: "help",
    title: "Help Centre",
    html: "<p>Welcome to the Denobelpro Help Centre.</p><h3>For clients</h3><p>Sign in with the link in your invitation email. If you have not received it, ask the Denobelpro specialist who invited you to resend it.</p><h3>For staff</h3><p>Your workspace contains your single gig, your client invitations and every conversation in one place. Contact management if you need a client reassigned or an order escalated.</p>",
  },
];

async function seedPages() {
  for (const page of pageSeeds) {
    const existing = await db.page.findUnique({ where: { slug: page.slug } });
    if (existing) continue;
    await db.page.create({
      data: {
        slug: page.slug,
        title: page.title,
        status: "published",
        isSystem: true,
        seo: json({ title: `${page.title} · Denobelpro`, description: "" }),
        blocks: {
          create: {
            type: "rich_text",
            sortOrder: 10,
            content: json({ html: page.html }),
          },
        },
      },
    });
  }
  console.log(`  pages: ${pageSeeds.length} static pages ready`);
}

async function main() {
  console.log("Seeding Denobelpro Marketplace...");
  await seedRoles();
  await seedSettings();
  await seedContent();
  await seedTheme();
  await seedFeatureFlags();
  await seedLanguages();
  const categories = await seedCategories();
  await seedTaxonomies();
  await seedMenus();
  const people = await seedPeople();
  const relationships = await seedRelationships(people);
  await seedMessages(people, relationships);
  await seedOffers(people, relationships);
  await seedGigs(people, categories);
  await seedPages();

  await db.sequence.upsert({
    where: { key: "invoice" },
    update: {},
    create: { key: "invoice", value: 0 },
  });

  console.log("");
  console.log("Seed complete.");
  console.log(`  Admin:  ${adminEmail}  (password from SEED_ADMIN_PASSWORD)`);
  console.log(
    "  Staff:  amara.okafor@denobelpro.com, tunde.bello@denobelpro.com, zara.musa@denobelpro.com",
  );
  console.log(
    "  Client: grace@acme.test, daniel@northstar.test, ifeoma@lumen.test, samuel@harbor.test, leila@cedar.test",
  );
  console.log("  Demo password comes from SEED_DEMO_PASSWORD.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
