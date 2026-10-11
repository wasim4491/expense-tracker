"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import AppNavigation from "@/app/components/AppNavigation";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const metadataName = data.user.user_metadata?.full_name || data.user.user_metadata?.name;
        setName(typeof metadataName === "string" ? metadataName : "");
        setEmail(data.user.email || "");
      }
      setIsLoading(false);
    };

    void loadProfile();
  }, []);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fullName = name.trim();
    if (!fullName) {
      setHasError(true);
      setMessage("Enter your name before saving.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    setHasError(false);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      });
      if (error) throw error;
      setName(fullName);
      setMessage("Your profile has been updated.");
    } catch (error) {
      setHasError(true);
      setMessage(error instanceof Error ? error.message : "Unable to update your profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="app-content-with-sidebar min-h-screen bg-slate-50 px-4 pb-8 pt-24 sm:px-6 lg:pr-8">
      <AppNavigation />
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Your account</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your profile information.</p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 border-b border-slate-100 pb-5">
            <h2 className="text-base font-semibold text-slate-950">Profile</h2>
            <p className="mt-1 text-sm text-slate-500">Your name appears in the account menu.</p>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
              <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : (
            <form onSubmit={saveProfile} className="max-w-xl space-y-5">
              <div>
                <label htmlFor="profile-name" className="mb-2 block text-sm font-medium text-slate-700">Name</label>
                <input
                  id="profile-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label htmlFor="profile-email" className="mb-2 block text-sm font-medium text-slate-700">Email</label>
                <input
                  id="profile-email"
                  type="email"
                  value={email}
                  readOnly
                  className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
                />
                <p className="mt-1.5 text-xs text-slate-400">Email changes are managed through account verification.</p>
              </div>

              {message && <p role="status" className={`text-sm ${hasError ? "text-red-600" : "text-emerald-700"}`}>{message}</p>}

              <button
                type="submit"
                disabled={isSaving}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
