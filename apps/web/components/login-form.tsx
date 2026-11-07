"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { makeT } from "@/lib/content";

type LoginFormProps = {
  content: Record<string, string>;
  supportEmail: string;
  nextPath: string | null;
};

export function LoginForm({ content, supportEmail, nextPath }: LoginFormProps) {
  const t = makeT(content);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const forgotHref = `mailto:${supportEmail}?subject=${encodeURIComponent(
    t("auth.login.forgotSubject"),
  )}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json().catch(() => null)) as
        { data?: { redirectTo?: string } } | { error?: { code?: string; message?: string } } | null;

      if (!response.ok) {
        const code = payload && "error" in payload ? payload.error?.code : undefined;
        if (code === "INVALID_CREDENTIALS") setError(t("auth.login.errorInvalid"));
        else if (code === "ACCOUNT_INACTIVE") setError(t("auth.login.errorSuspended"));
        else if (code === "TOO_MANY_REQUESTS") setError(t("auth.login.errorRateLimit"));
        else setError(t("auth.login.errorGeneric"));
        setSubmitting(false);
        return;
      }

      const serverRedirect = payload && "data" in payload ? payload.data?.redirectTo : undefined;
      const redirectTo =
        serverRedirect === "/account/password"
          ? serverRedirect
          : (nextPath ?? serverRedirect ?? "/workspace");
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError(t("auth.login.errorNoConnection"));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
      {error ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-danger/25 bg-danger/[0.06] px-4 py-3 text-[0.8rem] leading-6 text-danger"
        >
          {error}
        </div>
      ) : null}

      <div>
        <label htmlFor="email" className="label">
          {t("auth.login.emailLabel")}
        </label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("auth.login.emailPlaceholder")}
            className="input pl-10"
          />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="password" className="label mb-0">
            {t("auth.login.passwordLabel")}
          </label>
          <a
            href={forgotHref}
            className="text-[0.72rem] font-semibold text-primary hover:text-primary-hover"
          >
            {t("auth.login.forgotPassword")}
          </a>
        </div>
        <div className="relative">
          <LockKeyhole
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("auth.login.passwordPlaceholder")}
            className="input px-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-sm text-muted transition-colors hover:bg-surface-muted hover:text-ink"
            aria-label={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <button type="submit" disabled={submitting} className="btn btn-primary w-full py-3.5">
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("auth.login.submitting")}
          </>
        ) : (
          t("auth.login.submit")
        )}
      </button>
    </form>
  );
}
