export function apiTargets(): string[] {
  const configured = [process.env.API_INTERNAL_URL, process.env.API_PUBLIC_URL]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/\/+$/, ""));

  const unique = [...new Set(configured)];
  return unique.length > 0 ? unique : ["http://localhost:4000"];
}

export async function fetchApi(path: string, init: RequestInit = {}): Promise<Response> {
  const targets = apiTargets();
  let lastError: unknown;

  for (const [index, target] of targets.entries()) {
    try {
      const response = await fetch(`${target}${path}`, { ...init, cache: "no-store" });
      if ([502, 503, 504].includes(response.status) && index < targets.length - 1) {
        await response.body?.cancel();
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("The API is unreachable.");
}
