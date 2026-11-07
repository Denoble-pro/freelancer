/* eslint-disable no-console */
import { hash } from "@node-rs/argon2";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "../src/index.js";
import {
  seedCategories,
  seedContent,
  seedFeatureFlags,
  seedLanguages,
  seedMenus,
  seedPages,
  seedRoles,
  seedSettings,
  seedTaxonomies,
  seedTheme,
} from "./seed.js";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

async function seedEssentials() {
  await seedRoles();
  await seedSettings();
  await seedContent();
  await seedTheme();
  await seedFeatureFlags();
  await seedLanguages();
  await seedCategories();
  await seedTaxonomies();
  await seedMenus();
  await seedPages();
}

async function ensureAdmin() {
  const rawEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim();

  if (!rawEmail) {
    console.log("bootstrap: SEED_ADMIN_EMAIL is not set, skipping admin sync.");
    return;
  }
  if (!password) {
    console.warn("bootstrap: SEED_ADMIN_PASSWORD is not set, skipping admin sync.");
    return;
  }

  const existing = await db.user.findUnique({ where: { email: rawEmail } });
  const passwordHash = await hash(password);

  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: {
        name: name || existing.name,
        role: "admin",
        status: "active",
        deletedAt: null,
        suspendedReason: null,
        mustChangePassword: false,
        passwordHash,
      },
    });
    console.log(`bootstrap: admin synced from environment (${rawEmail}).`);
    return;
  }

  await db.user.create({
    data: {
      email: rawEmail,
      name: name || "Denobelpro Management",
      role: "admin",
      status: "active",
      emailVerifiedAt: new Date(),
      mustChangePassword: false,
      passwordHash,
    },
  });
  console.log(`bootstrap: admin created from environment (${rawEmail}).`);
}

async function main() {
  console.log("Bootstrapping Denobelpro Marketplace...");
  await seedEssentials();
  await ensureAdmin();
  console.log("Bootstrap complete.");
}

main()
  .catch((error) => {
    console.error("Bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
