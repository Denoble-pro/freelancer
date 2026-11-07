"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Save } from "lucide-react";
import type { AccountProfile } from "@/lib/api";
import { makeT } from "@/lib/content";

type ProfileForm = {
  name: string;
  phone: string;
  avatarUrl: string;
  locale: string;
  timezone: string;
  company: string;
  title: string;
  department: string;
  bio: string;
  skills: string;
  availability: string;
};

function formFrom(profile: AccountProfile): ProfileForm {
  return {
    name: profile.name,
    phone: profile.phone ?? "",
    avatarUrl: profile.avatarUrl ?? "",
    locale: profile.locale,
    timezone: profile.timezone,
    company: profile.clientProfile?.company ?? "",
    title: profile.staffProfile?.title ?? "",
    department: profile.staffProfile?.department ?? "",
    bio: profile.staffProfile?.bio ?? "",
    skills: profile.staffProfile?.skills.join(", ") ?? "",
    availability: profile.staffProfile?.availability ?? "available",
  };
}

export function AccountSettings({
  profile,
  content,
}: {
  profile: AccountProfile;
  content: Record<string, string>;
}) {
  const t = makeT(content);
  const router = useRouter();
  const [form, setForm] = useState<ProfileForm>(() => formFrom(profile));
  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(formFrom(profile));
  }, [profile]);

  const isClient = profile.role === "client";
  const isStaff = profile.role === "staff";

  function setField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setNotice(null);
    setError(null);

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      avatarUrl: form.avatarUrl.trim() || null,
      locale: form.locale.trim(),
      timezone: form.timezone.trim(),
      ...(isClient ? { company: form.company.trim() || null } : {}),
      ...(isStaff
        ? {
            title: form.title.trim() || null,
            department: form.department.trim() || null,
            bio: form.bio.trim() || null,
            skills: form.skills
              .split(",")
              .map((skill) => skill.trim())
              .filter(Boolean),
            availability: form.availability,
          }
        : {}),
    };

    try {
      const response = await fetch("/api/v1/account/profile", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        data?: { user: AccountProfile };
        error?: { message?: string };
      };
      if (!response.ok) {
        setError(body.error?.message ?? "Your profile could not be saved.");
        return;
      }
      if (body.data?.user) setForm(formFrom(body.data.user));
      setNotice(t("account.profileSaved"));
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);

    if (password.next !== password.confirm) {
      setError(t("account.passwordMismatch"));
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch("/api/v1/account/password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword: password.current,
          newPassword: password.next,
        }),
      });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setError(body.error?.message ?? "Your password could not be changed.");
        return;
      }
      setPassword({ current: "", next: "", confirm: "" });
      setNotice(t("account.passwordChanged"));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="card p-7 sm:p-8">
        <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">
          {t("account.editProfileTitle")}
        </h2>
        <p className="mt-1 text-xs leading-6 text-muted">{t("account.editProfileBody")}</p>

        <form className="mt-5 grid gap-4" onSubmit={saveProfile}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold">
              {t("account.profileName")}
              <input
                className="input mt-1.5"
                value={form.name}
                onChange={(event) => setField("name", event.target.value)}
                required
                minLength={2}
                maxLength={160}
              />
            </label>
            <label className="text-xs font-semibold">
              {t("account.profilePhone")}
              <input
                className="input mt-1.5"
                value={form.phone}
                onChange={(event) => setField("phone", event.target.value)}
                maxLength={40}
              />
            </label>
          </div>

          <label className="text-xs font-semibold">
            {t("account.profileAvatar")}
            <input
              className="input mt-1.5"
              type="url"
              value={form.avatarUrl}
              onChange={(event) => setField("avatarUrl", event.target.value)}
              placeholder="https://..."
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold">
              {t("account.profileLocale")}
              <select
                className="input mt-1.5"
                value={form.locale}
                onChange={(event) => setField("locale", event.target.value)}
              >
                <option value="en">English</option>
                <option value="en-NG">English (Nigeria)</option>
              </select>
            </label>
            <label className="text-xs font-semibold">
              {t("account.profileTimezone")}
              <input
                className="input mt-1.5"
                value={form.timezone}
                onChange={(event) => setField("timezone", event.target.value)}
                maxLength={60}
              />
            </label>
          </div>

          {isClient ? (
            <label className="text-xs font-semibold">
              {t("account.profileCompany")}
              <input
                className="input mt-1.5"
                value={form.company}
                onChange={(event) => setField("company", event.target.value)}
                maxLength={160}
              />
            </label>
          ) : null}

          {isStaff ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold">
                  {t("account.profileJobTitle")}
                  <input
                    className="input mt-1.5"
                    value={form.title}
                    onChange={(event) => setField("title", event.target.value)}
                    maxLength={160}
                  />
                </label>
                <label className="text-xs font-semibold">
                  {t("account.profileDepartment")}
                  <input
                    className="input mt-1.5"
                    value={form.department}
                    onChange={(event) => setField("department", event.target.value)}
                    maxLength={160}
                  />
                </label>
              </div>
              <label className="text-xs font-semibold">
                {t("account.profileBio")}
                <textarea
                  className="input mt-1.5 min-h-28 resize-y"
                  value={form.bio}
                  onChange={(event) => setField("bio", event.target.value)}
                  maxLength={5000}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold">
                  {t("account.profileSkills")}
                  <input
                    className="input mt-1.5"
                    value={form.skills}
                    onChange={(event) => setField("skills", event.target.value)}
                  />
                </label>
                <label className="text-xs font-semibold">
                  {t("account.profileAvailability")}
                  <select
                    className="input mt-1.5"
                    value={form.availability}
                    onChange={(event) => setField("availability", event.target.value)}
                  >
                    <option value="available">{t("account.availabilityAvailable")}</option>
                    <option value="busy">{t("account.availabilityBusy")}</option>
                    <option value="unavailable">{t("account.availabilityUnavailable")}</option>
                  </select>
                </label>
              </div>
            </>
          ) : null}

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary btn-sm" disabled={savingProfile}>
              {savingProfile ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {savingProfile ? t("account.savingProfile") : t("account.saveProfile")}
            </button>
          </div>
        </form>
      </section>

      <section className="card p-7 sm:p-8">
        <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">
          {t("account.passwordTitle")}
        </h2>
        <p className="mt-1 text-xs leading-6 text-muted">{t("account.passwordBody")}</p>

        <form className="mt-5 grid gap-4" onSubmit={changePassword}>
          <label className="text-xs font-semibold">
            {t("account.currentPassword")}
            <input
              className="input mt-1.5"
              type="password"
              autoComplete="current-password"
              value={password.current}
              onChange={(event) => setPassword({ ...password, current: event.target.value })}
              required
            />
          </label>
          <label className="text-xs font-semibold">
            {t("account.newPassword")}
            <input
              className="input mt-1.5"
              type="password"
              autoComplete="new-password"
              value={password.next}
              onChange={(event) => setPassword({ ...password, next: event.target.value })}
              minLength={10}
              required
            />
          </label>
          <label className="text-xs font-semibold">
            {t("account.confirmPassword")}
            <input
              className="input mt-1.5"
              type="password"
              autoComplete="new-password"
              value={password.confirm}
              onChange={(event) => setPassword({ ...password, confirm: event.target.value })}
              minLength={10}
              required
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary btn-sm justify-center"
            disabled={savingPassword}
          >
            {savingPassword ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <KeyRound className="h-3.5 w-3.5" />
            )}
            {savingPassword ? t("account.changingPassword") : t("account.changePassword")}
          </button>
        </form>
      </section>

      {notice || error ? (
        <div
          className={`lg:col-span-2 rounded-lg border px-4 py-3 text-xs ${
            error
              ? "border-danger/20 bg-danger/5 text-danger"
              : "border-success/20 bg-success/5 text-success"
          }`}
          role="status"
        >
          {error ?? notice}
        </div>
      ) : null}
    </div>
  );
}
