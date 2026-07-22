"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Camera, Loader2, Save } from "lucide-react";

type ProfileForm = {
  name: string;
  email: string;
  phone: string;
};

const MAX_AVATAR_BYTES = 3 * 1024 * 1024; // keep in sync with the API route

export default function AccountPage() {
  const { data: session, update } = useSession();
  const isCredentialsUser = session?.user
    ? (session.user as { authProvider?: string }).authProvider !== "GOOGLE"
    : true; // The system uses authProvider instead of provider

  const [form, setForm] = useState<ProfileForm>({ name: "", email: "", phone: "" });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/users/me")
      .then((res) => res.json())
      .then((data) => {
        setForm({ name: data.name ?? "", email: data.email ?? "", phone: data.phone ?? "" });
        setAvatarUrl(data.image ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setMessage({ type: "error", text: "Use a PNG, JPEG, or WebP image." });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setMessage({ type: "error", text: "Image must be under 3MB." });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarUrl(previewUrl); // optimistic preview while it uploads
    setUploadingAvatar(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/users/me/avatar", { method: "POST", body: formData });
      if (!res.ok) throw new Error();
      const _resData = await res.json()
          const data = _resData.data || _resData;
      setAvatarUrl(data.image);
      await update?.({ image: data.image });
      setMessage({ type: "success", text: "Photo updated." });
    } catch {
      setMessage({ type: "error", text: "Couldn't upload photo. Try again." });
      setAvatarUrl(session?.user?.image ?? null); // roll back the optimistic preview
    } finally {
      URL.revokeObjectURL(previewUrl);
      setUploadingAvatar(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      await update?.({ name: form.name });
      setMessage({ type: "success", text: "Profile updated." });
    } catch {
      setMessage({ type: "error", text: "Couldn't save changes. Try again." });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwords.next !== passwords.confirm) {
      setMessage({ type: "error", text: "New passwords don't match." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.next,
        }),
      });
      if (!res.ok) throw new Error();
      setPasswords({ current: "", next: "", confirm: "" });
      setMessage({ type: "success", text: "Password changed." });
    } catch {
      setMessage({ type: "error", text: "Couldn't change password. Check your current password." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-neutral-500">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-4 pb-24 animate-slide-up">
      <div className="flex flex-col gap-1.5 mb-2">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground font-heading tracking-tight">Manage account</h1>
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-2.5 text-sm ${
            message.type === "success"
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Avatar */}
      <div className="flex items-center gap-5 rounded-3xl glass-card p-6 shadow-sm transition-all duration-300 hover:shadow-md group/avatar">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingAvatar}
          className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-gradient-to-tr from-primary to-primary/60 shadow-[0_0_15px_rgba(var(--primary),0.3)] disabled:opacity-70 transition-transform duration-300 group-hover/avatar:scale-105"
        >
          {avatarUrl ? (
            <Image src={avatarUrl} alt="Your avatar" fill sizes="80px" className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xl font-semibold uppercase text-primary-foreground">
              {form.name.charAt(0) || "?"}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            {uploadingAvatar ? (
              <Loader2 size={18} className="animate-spin text-white" />
            ) : (
              <Camera size={18} className="text-white" />
            )}
          </span>
        </button>
        <div>
          <p className="text-sm font-medium text-card-foreground">Profile photo</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50"
          >
            {uploadingAvatar ? "Uploading…" : "Change photo"}
          </button>
          <p className="mt-0.5 text-xs text-muted-foreground">PNG, JPEG, or WebP. Up to 3MB.</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleAvatarChange}
          className="hidden"
        />
      </div>

      {/* Profile */}
      <form
        onSubmit={handleSaveProfile}
        className="space-y-5 rounded-3xl glass-card p-6 shadow-sm transition-all duration-300 hover:shadow-md"
      >
        <h2 className="text-lg font-bold text-foreground font-heading">Profile</h2>

        <Field label="Full name">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            required
          />
        </Field>

        <Field label="Email">
          <input
            type="email"
            value={form.email}
            disabled={!isCredentialsUser}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
          />
          {!isCredentialsUser && (
            <p className="mt-1 text-xs text-muted-foreground">Managed by your Google account.</p>
          )}
        </Field>

        <Field label="Phone">
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </Field>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save size={14} />
          Save changes
        </button>
      </form>

      {/* Password — only for credentials-based accounts */}
      {isCredentialsUser && (
        <form
          onSubmit={handleChangePassword}
          className="space-y-5 rounded-3xl glass-card p-6 shadow-sm transition-all duration-300 hover:shadow-md"
        >
          <h2 className="text-lg font-bold text-foreground font-heading">Change password</h2>

          <Field label="Current password">
            <input
              type="password"
              value={passwords.current}
              onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              required
            />
          </Field>

          <Field label="New password">
            <input
              type="password"
              value={passwords.next}
              onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              required
              minLength={8}
            />
          </Field>

          <Field label="Confirm new password">
            <input
              type="password"
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              required
              minLength={8}
            />
          </Field>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
          >
            Update password
          </button>
        </form>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
