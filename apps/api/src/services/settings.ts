import type { Setting } from "@dlp/db";
import { db } from "../db.js";
import { decryptSecret, encryptSecret } from "../lib/crypto.js";
import { badRequest, notFound } from "../lib/errors.js";

type SettingValidation = {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  options?: { value: string; label: string }[];
};

const validationFor = (setting: Pick<Setting, "validation">): SettingValidation =>
  (setting.validation ?? {}) as SettingValidation;

export function validateSettingValue(
  setting: Pick<Setting, "key" | "type" | "validation">,
  input: unknown,
): unknown {
  const rules = validationFor(setting);
  const label = setting.key;

  switch (setting.type) {
    case "number": {
      if (typeof input !== "number" || !Number.isFinite(input)) {
        throw badRequest(`${label} must be a number.`);
      }
      if (rules.min !== undefined && input < rules.min) {
        throw badRequest(`${label} must be at least ${rules.min}.`);
      }
      if (rules.max !== undefined && input > rules.max) {
        throw badRequest(`${label} must be no more than ${rules.max}.`);
      }
      return input;
    }
    case "boolean": {
      if (typeof input !== "boolean") throw badRequest(`${label} must be true or false.`);
      return input;
    }
    case "select": {
      if (typeof input !== "string")
        throw badRequest(`${label} must be one of the allowed options.`);
      const options = rules.options ?? [];
      if (options.length > 0 && !options.some((option) => option.value === input)) {
        throw badRequest(
          `${label} must be one of: ${options.map((option) => option.value).join(", ")}.`,
        );
      }
      return input;
    }
    case "json": {
      if (input === undefined) throw badRequest(`${label} requires a value.`);
      if (typeof input === "string") {
        try {
          return JSON.parse(input);
        } catch {
          throw badRequest(`${label} must be valid JSON.`);
        }
      }
      return input;
    }
    case "secret": {
      if (typeof input !== "string") throw badRequest(`${label} must be text.`);
      if (input.length > 20000) throw badRequest(`${label} is too long.`);
      return input;
    }
    case "string":
    default: {
      if (typeof input !== "string") throw badRequest(`${label} must be text.`);
      if (rules.minLength !== undefined && input.length < rules.minLength) {
        throw badRequest(`${label} must be at least ${rules.minLength} characters.`);
      }
      if (rules.maxLength !== undefined && input.length > rules.maxLength) {
        throw badRequest(`${label} must be no more than ${rules.maxLength} characters.`);
      }
      if (rules.pattern) {
        let pattern: RegExp;
        try {
          pattern = new RegExp(rules.pattern);
        } catch {
          throw badRequest(`${label} has an invalid validation rule.`);
        }
        if (!pattern.test(input)) {
          throw badRequest(`${label} does not match the required format.`);
        }
      }
      return input;
    }
  }
}

export async function getSettingRaw(key: string): Promise<Setting | null> {
  return db.setting.findUnique({ where: { key } });
}

export async function getSettingValue<T = string>(key: string, fallback: T): Promise<T> {
  const setting = await getSettingRaw(key);
  if (!setting) return fallback;
  try {
    let value = setting.value;
    if (setting.isSecret && typeof value === "string") {
      value = decryptSecret(value);
    }
    if (setting.type === "number" && typeof value !== "number") {
      const parsed = Number(value);
      return (Number.isFinite(parsed) ? parsed : fallback) as T;
    }
    if (setting.type === "boolean" && typeof value !== "boolean") {
      return (value === "true" ? true : value === "false" ? false : fallback) as T;
    }
    return (value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export function prepareSettingValue(setting: Setting, input: unknown): unknown {
  const validated = validateSettingValue(setting, input);
  if (setting.isSecret && typeof validated === "string") {
    return encryptSecret(validated);
  }
  return validated;
}

export function presentSetting(setting: Setting) {
  const isSet = setting.value !== null && setting.value !== undefined && setting.value !== "";
  return {
    id: setting.id,
    key: setting.key,
    label: setting.label,
    description: setting.description,
    group: setting.group,
    type: setting.type,
    value: setting.isSecret ? null : setting.value,
    defaultValue: setting.isSecret ? null : setting.defaultValue,
    validation: setting.validation,
    isPublic: setting.isPublic,
    isSecret: setting.isSecret,
    isSet: setting.isSecret ? isSet : undefined,
    maskedValue: setting.isSecret && isSet ? "••••••••" : undefined,
    updatedAt: setting.updatedAt,
    updatedById: setting.updatedById,
  };
}

export function presentSettingVersion(
  setting: Setting,
  version: {
    id: string;
    oldValue: unknown;
    newValue: unknown;
    changedById: string | null;
    note: string | null;
    createdAt: Date;
  },
) {
  return {
    id: version.id,
    oldValue: setting.isSecret ? (version.oldValue ? "••••••••" : null) : version.oldValue,
    newValue: setting.isSecret ? "••••••••" : version.newValue,
    changedById: version.changedById,
    note: version.note,
    createdAt: version.createdAt,
  };
}

export async function publicSettings(): Promise<Record<string, unknown>> {
  const settings = await db.setting.findMany({
    where: { isPublic: true, isSecret: false },
    select: { key: true, value: true },
  });
  return Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
}

export async function requireSetting(key: string): Promise<Setting> {
  const setting = await getSettingRaw(key);
  if (!setting) throw notFound("That setting does not exist.");
  return setting;
}
