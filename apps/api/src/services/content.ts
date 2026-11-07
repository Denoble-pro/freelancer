import { db } from "../db.js";

export async function effectiveContent(): Promise<Record<string, string>> {
  const items = await db.contentString.findMany({
    select: { key: true, value: true, defaultValue: true },
  });
  return Object.fromEntries(items.map((item) => [item.key, item.value ?? item.defaultValue]));
}
