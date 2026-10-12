"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import DoraemonAssistant from "@/app/components/DoraemonAssistant";
import LogoutButton from "@/app/components/LogoutButton";
import { useProfile } from "@/app/components/useProfile";

type NavIconName = "dashboard" | "add" | "expenses" | "money" | "calendar" | "settings" | "menu";

const primaryLinks: { href: string; label: string; icon: NavIconName }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/add-expense", label: "Add Expense", icon: "add" },
  { href: "/expenses", label: "All Expenses", icon: "expenses" },
  { href: "/money-tracker", label: "Money Tracker", icon: "money" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
];

function NavIcon({ name, className = "h-4 w-4" }: { name: NavIconName; className?: string }) {
  const paths: Record<NavIconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    add: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
    expenses: <><path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1-1.5Z" /><path d="M14 3.5V8h4M9 12h6M9 16h6" /></>,
    money: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="12" cy="12" r="3" /><path d="M7 9h.01M17 15h.01" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3H3.7a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 1 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export default function AppNavigation() {
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  const { displayName, email, userId } = useProfile();

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href.includes("#")) {
      return pathname === href.split("#")[0] && hash === `#${href.split("#")[1]}`;
    }
    if (href === "/dashboard") return pathname === href && !hash;
    return pathname === href;
  };

  const renderLink = (item: { href: string; label: string; icon: NavIconName }) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={(event) => {
        if (item.href.includes("#")) setHash(`#${item.href.split("#")[1]}`);
        event.currentTarget.closest("details")?.removeAttribute("open");
      }}
      aria-current={isActive(item.href) ? "page" : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
        isActive(item.href)
          ? "bg-blue-50 text-blue-800"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
      }`}
    >
      <NavIcon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
      <span>{item.label}</span>
    </Link>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-slate-200 bg-white px-3 py-5 lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-white shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
              <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a2 2 0 0 1 2 2v12H6.5A2.5 2.5 0 0 1 4 16.5v-9Z" stroke="currentColor" strokeWidth="1.6" />
              <path d="M4 8h14a2 2 0 0 1 2 2v3h-5a2.5 2.5 0 0 1 0-5h5" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="15.5" cy="10.5" r=".7" fill="currentColor" />
            </svg>
          </span>
          <span className="text-sm font-bold tracking-tight text-slate-900">ExpenseTracker</span>
        </Link>

        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Workspace</p>
        <nav aria-label="Main navigation" className="space-y-1">
          {primaryLinks.map(renderLink)}
        </nav>

        <div className="mt-auto border-t border-slate-100 pt-4">
          <Link
            href="/settings"
            aria-current={pathname === "/settings" ? "page" : undefined}
            className={`mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${pathname === "/settings" ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
          >
            <NavIcon name="settings" className="h-[18px] w-[18px] shrink-0" />
            Settings
          </Link>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 h-[68px] border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:left-56">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex shrink-0 items-center gap-2 lg:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-sm font-bold text-white">$</span>
              <span className="hidden text-sm font-bold text-slate-900 sm:inline">ExpenseTracker</span>
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <details className="group relative lg:hidden">
              <summary aria-label="Open navigation" className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-200 text-slate-600 [&::-webkit-details-marker]:hidden sm:h-9 sm:w-9">
                <NavIcon name="menu" />
              </summary>
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                <nav aria-label="Mobile navigation" className="space-y-1">
                  {primaryLinks.map(renderLink)}
                  <Link href="/settings" onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    <NavIcon name="settings" /> Settings
                  </Link>
                </nav>
              </div>
            </details>

            <Link
              href="/"
              aria-current={pathname === "/" ? "page" : undefined}
              className="inline-flex h-8 items-center justify-center rounded-xl px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 sm:h-10 sm:px-3.5 sm:text-sm"
            >
              Home
            </Link>

            <details className="group relative">
              <summary aria-label={`Open account menu for ${displayName}`} className="flex cursor-pointer list-none items-center gap-2 rounded-full p-0.5 transition hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold uppercase text-blue-800">
                  {displayName.charAt(0)}
                </span>
                <span className="hidden max-w-32 truncate text-sm font-semibold text-slate-700 sm:block">{displayName}</span>
                <svg viewBox="0 0 20 20" fill="none" className="hidden h-4 w-4 text-slate-400 sm:block" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </summary>
              <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
                <div className="border-b border-slate-100 px-3 py-3">
                  <p className="truncate text-sm font-semibold text-slate-950">{displayName}</p>
                  {email && <p className="mt-0.5 truncate text-xs text-slate-500">{email}</p>}
                </div>
                <div className="pt-2"><LogoutButton /></div>
              </div>
            </details>
          </div>
        </div>
      </header>
      <DoraemonAssistant key={userId ?? "account-loading"} userId={userId} />
    </>
  );
}
