"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Building2, LockKeyhole, Loader2, Mail, User } from "lucide-react";
import { makeT } from "@/lib/content";

type InviteAcceptFormProps = {
  token: string;
  email: string;
  content: Record<string, string>;
};

export function InviteAcceptForm({ token, email, content }: InviteAcceptFormProps) {
  const router = useRouter();
  const t = makeT(content);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    if (password.length < 10) {
      setError("Use a password with at least 10 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/public/invitations/${encodeURIComponent(token)}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ name, company: company || undefined, password }),
        },
      );

      const payload = (await response.json().catch(() => null)) as
        { data?: { redirectTo?: string } } | { error?: { code?: string; message?: string } } | null;

      if (!response.ok) {
        const message = payload && "error" in payload ? payload.error?.message : undefined;
        setError(message || "We could not accept this invitation. Please try again.");
        setSubmitting(false);
        return;
      }

      const redirectTo =
        (payload && "data" in payload ? payload.data?.redirectTo : undefined) ?? "/workspace";
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("We could not reach the workspace. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate={false}>
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
        <label htmlFor="invite-email" className="label">
          {t("invite.emailLabel")}
        </label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            id="invite-email"
            type="email"
            value={email}
            readOnly
            className="input cursor-not-allowed bg-surface-muted pl-10 text-muted"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="invite-name" className="label">
            {t("invite.nameLabel")}
          </label>
          <div className="relative">
            <User
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              id="invite-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              minLength={2}
              maxLength={160}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("invite.namePlaceholder")}
              className="input pl-10"
            />
          </div>
        </div>

        <div>
          <label htmlFor="invite-company" className="label">
            {t("invite.companyLabel")}
          </label>
          <div className="relative">
            <Building2
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              id="invite-company"
              name="company"
              type="text"
              autoComplete="organization"
              maxLength={160}
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder={t("invite.companyPlaceholder")}
              className="input pl-10"
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="invite-password" className="label">
          {t("invite.passwordLabel")}
        </label>
        <div className="relative">
          <LockKeyhole
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            id="invite-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={200}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("invite.passwordPlaceholder")}
            className="input pl-10"
            aria-describedby="invite-password-hint"
          />
        </div>
        <p id="invite-password-hint" className="mt-2 text-[0.7rem] leading-5 text-muted">
          {t("invite.passwordHint")}
        </p>
      </div>

      <button type="submit" disabled={submitting} className="btn btn-primary w-full py-3.5">
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("invite.submitting")}
          </>
        ) : (
          t("invite.submit")
        )}
      </button>

      <p className="text-center text-[0.7rem] leading-5 text-muted">
        {t("invite.terms")}{" "}
        <Link href="/terms" className="font-semibold text-primary hover:text-primary-hover">
          Terms
        </Link>{" "}
        &middot;{" "}
        <Link href="/privacy" className="font-semibold text-primary hover:text-primary-hover">
          Privacy
        </Link>
      </p>

      <p className="text-center text-[0.72rem] text-muted">
        <Link href="/login" className="font-semibold text-primary hover:text-primary-hover">
          {t("invite.signIn")}
        </Link>
      </p>
    </form>
  );
}
