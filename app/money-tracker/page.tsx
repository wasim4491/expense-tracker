"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import AppNavigation from "@/app/components/AppNavigation";

type Direction = "receive" | "owe";
type EntryStatus = "pending" | "settled";
type MoneyEntry = {
  id: string;
  person_name: string;
  amount: number | string;
  direction: Direction;
  description: string;
  entry_date: string;
  notes: string | null;
  status: EntryStatus;
  created_at: string;
  updated_at: string;
};
type FormValues = {
  direction: Direction;
  person_name: string;
  amount: string;
  entry_date: string;
  notes: string;
};
type EntryFilter = "all" | "owe" | "receive";

const todayAsLocalDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const emptyForm = (): FormValues => ({
  direction: "receive",
  person_name: "",
  amount: "",
  entry_date: todayAsLocalDate(),
  notes: "",
});

const normalizePersonName = (name: string) => name.trim().toLocaleLowerCase();

const formatMoney = (amount: number | string) => {
  const value = Number(amount || 0);
  return value < 0 ? `-$${Math.abs(value).toFixed(2)}` : `$${value.toFixed(2)}`;
};

const formatDate = (value: string) => {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

async function responseError(response: Response, fallback: string) {
  const result = await response.json().catch(() => null);
  return typeof result?.error === "string" ? result.error : fallback;
}

export default function MoneyTrackerPage() {
  const [entries, setEntries] = useState<MoneyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [filter, setFilter] = useState<EntryFilter>("all");
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MoneyEntry | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [transitionType, setTransitionType] = useState<"settle" | "delete" | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [isNameDropdownOpen, setIsNameDropdownOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const personInputRef = useRef<HTMLInputElement>(null);
  const personAutocompleteRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const isSavingRef = useRef(false);

  const loadEntries = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    setPageError("");
    try {
      const response = await fetch("/api/money-entries", { cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response, "Unable to load money entries."));
      const result = await response.json();
      setEntries(Array.isArray(result.entries) ? result.entries : []);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to load money entries. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadEntries(true), 0);
    return () => window.clearTimeout(timeout);
  }, [loadEntries]);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = window.setTimeout(() => setSuccessMessage(""), 1600);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  useEffect(() => {
    if (!isNameDropdownOpen) return;
    const closeWhenOutside = (event: PointerEvent) => {
      if (!personAutocompleteRef.current?.contains(event.target as Node)) {
        setIsNameDropdownOpen(false);
        setActiveSuggestionIndex(-1);
      }
    };
    document.addEventListener("pointerdown", closeWhenOutside);
    return () => document.removeEventListener("pointerdown", closeWhenOutside);
  }, [isNameDropdownOpen]);

  useEffect(() => {
    if (!isModalOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimeout = window.setTimeout(() => personInputRef.current?.focus(), 0);

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!isSavingRef.current) setIsModalOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimeout);
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [isModalOpen]);

  const pendingEntries = useMemo(() => entries.filter((entry) => entry.status === "pending"), [entries]);
  const moneyToReceive = pendingEntries
    .filter((entry) => entry.direction === "receive")
    .reduce((total, entry) => total + Number(entry.amount), 0);
  const moneyToPay = pendingEntries
    .filter((entry) => entry.direction === "owe")
    .reduce((total, entry) => total + Number(entry.amount), 0);
  const netBalance = moneyToReceive - moneyToPay;

  const previousNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const entry of entries) {
      const displayName = entry.person_name.trim();
      const normalizedName = normalizePersonName(displayName);
      if (normalizedName && !names.has(normalizedName)) names.set(normalizedName, displayName);
    }
    return Array.from(names.values());
  }, [entries]);

  const normalizedSearch = normalizePersonName(search);
  const matchingPeople = useMemo(() => {
    if (!normalizedSearch) return [];
    return previousNames.filter((name) => normalizePersonName(name).includes(normalizedSearch));
  }, [normalizedSearch, previousNames]);
  const searchedPerson = useMemo(() => {
    if (!normalizedSearch) return null;
    const exactMatch = previousNames.find((name) => normalizePersonName(name) === normalizedSearch);
    if (exactMatch) return exactMatch;
    return matchingPeople.length === 1 ? matchingPeople[0] : null;
  }, [matchingPeople, normalizedSearch, previousNames]);

  const suggestions = useMemo(() => {
    const query = normalizePersonName(form.person_name);
    if (!query) return [];
    return previousNames.filter((name) => normalizePersonName(name).startsWith(query));
  }, [form.person_name, previousNames]);

  const searchedPersonSummary = useMemo(() => {
    if (!searchedPerson) return null;
    const normalizedPerson = normalizePersonName(searchedPerson);
    const personEntries = entries.filter((entry) => normalizePersonName(entry.person_name) === normalizedPerson);
    const pending = personEntries.filter((entry) => entry.status === "pending");
    const toReceive = pending
      .filter((entry) => entry.direction === "receive")
      .reduce((total, entry) => total + Number(entry.amount), 0);
    const toPay = pending
      .filter((entry) => entry.direction === "owe")
      .reduce((total, entry) => total + Number(entry.amount), 0);
    return { toReceive, toPay, net: toReceive - toPay, pendingCount: pending.length };
  }, [entries, searchedPerson]);

  const filteredEntries = useMemo(() => {
    const query = normalizedSearch;
    return entries.filter((entry) => {
      const matchesDirection = filter === "all" || entry.direction === filter;
      if (searchedPerson && query) {
        return matchesDirection && normalizePersonName(entry.person_name) === normalizePersonName(searchedPerson);
      }
      const matchesSearch = !query || [entry.person_name, entry.description, entry.notes ?? ""]
        .some((value) => value.toLocaleLowerCase().includes(query));
      return matchesDirection && matchesSearch;
    });
  }, [entries, filter, normalizedSearch, searchedPerson]);

  const suggestionsOpen = isNameDropdownOpen && suggestions.length > 0;

  const openAddModal = () => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingEntry(null);
    setForm(emptyForm());
    setFormError("");
    setIsNameDropdownOpen(false);
    setActiveSuggestionIndex(-1);
    setIsModalOpen(true);
  };

  const openEditModal = (entry: MoneyEntry) => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingEntry(entry);
    setForm({
      direction: entry.direction,
      person_name: entry.person_name,
      amount: String(entry.amount),
      entry_date: entry.entry_date.slice(0, 10),
      notes: entry.notes ?? "",
    });
    setFormError("");
    setIsNameDropdownOpen(false);
    setActiveSuggestionIndex(-1);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSavingRef.current) return;
    setIsModalOpen(false);
    window.setTimeout(() => returnFocusRef.current?.focus(), 0);
  };

  const updateForm = (key: keyof FormValues, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const choosePersonName = (name: string) => {
    updateForm("person_name", name);
    setIsNameDropdownOpen(false);
    setActiveSuggestionIndex(-1);
    personInputRef.current?.focus();
  };

  const onPersonInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!suggestionsOpen) {
      if (event.key === "Escape") setIsNameDropdownOpen(false);
      if (event.key === "ArrowDown" && suggestions.length > 0) {
        event.preventDefault();
        setIsNameDropdownOpen(true);
        setActiveSuggestionIndex(0);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((current) => current < suggestions.length - 1 ? current + 1 : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((current) => current > 0 ? current - 1 : suggestions.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choosePersonName(suggestions[activeSuggestionIndex >= 0 ? activeSuggestionIndex : 0]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsNameDropdownOpen(false);
      setActiveSuggestionIndex(-1);
    }
  };

  const saveEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.person_name.trim() || !form.entry_date || !Number.isFinite(amount) || amount <= 0) {
      setFormError("Enter a person name, valid date, and amount greater than zero.");
      return;
    }

    setFormError("");
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      const response = await fetch("/api/money-entries", {
        method: editingEntry ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingEntry ? { id: editingEntry.id, action: "update" } : {}),
          direction: form.direction,
          person_name: form.person_name,
          amount,
          entry_date: form.entry_date,
          notes: form.notes,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "The entry couldn't be saved. Please try again."));

      setIsModalOpen(false);
      setSuccessMessage(editingEntry ? "Entry updated!" : "Money entry added!");
      void loadEntries();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The entry couldn't be saved. Please try again.");
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const markSettled = async (entry: MoneyEntry) => {
    setPageError("");
    setMutatingId(entry.id);
    setTransitioningId(entry.id);
    setTransitionType("settle");
    try {
      const response = await fetch("/api/money-entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, action: "settle" }),
      });
      if (!response.ok) throw new Error(await responseError(response, "The entry couldn't be settled. Please try again."));

      await new Promise((resolve) => window.setTimeout(resolve, 220));
      setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, status: "settled" } : item));
      void loadEntries();
      setSuccessMessage("Marked as settled!");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "The entry couldn't be settled. Please try again.");
    } finally {
      setMutatingId(null);
      setTransitioningId(null);
      setTransitionType(null);
    }
  };

  const deleteEntry = async (entry: MoneyEntry) => {
    const confirmed = window.confirm(`Delete the money entry for ${entry.person_name}? This cannot be undone.`);
    if (!confirmed) return;

    setPageError("");
    setMutatingId(entry.id);
    setTransitioningId(entry.id);
    setTransitionType("delete");
    try {
      const response = await fetch("/api/money-entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id }),
      });
      if (!response.ok) throw new Error(await responseError(response, "The entry couldn't be deleted. Please try again."));

      await new Promise((resolve) => window.setTimeout(resolve, 180));
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      setSuccessMessage("Entry deleted!");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "The entry couldn't be deleted. Please try again.");
    } finally {
      setMutatingId(null);
      setTransitioningId(null);
      setTransitionType(null);
    }
  };

  const filters: { key: EntryFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "owe", label: "You Gave / You Owe" },
    { key: "receive", label: "You Received / Owed to You" },
  ];

  return (
    <main className="app-content-with-sidebar min-h-screen bg-slate-50 px-4 pb-12 pt-24 sm:px-6 lg:pr-8">
      <AppNavigation />
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Shared balances</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Money Tracker</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-500">Keep track of money you owe and money others owe you.</p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300"
          >
            <span aria-hidden="true" className="text-lg leading-none">+</span> Add Entry
          </button>
        </header>

        {!normalizedSearch ? (
          <section aria-label="Overall money summary" className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <SummaryCard label="Money to Receive" amount={moneyToReceive} detail="Outstanding amount owed to you" tone="green" delay="0ms" />
            <SummaryCard label="Money to Pay" amount={moneyToPay} detail="Outstanding amount you owe" tone="red" delay="70ms" />
            <SummaryCard label="Net Balance" amount={netBalance} detail="Money to receive minus money to pay" tone={netBalance >= 0 ? "green" : "red"} delay="140ms" />
          </section>
        ) : searchedPerson && searchedPersonSummary ? (
          <PersonSummaryCards
            personName={searchedPerson}
            toReceive={searchedPersonSummary.toReceive}
            toPay={searchedPersonSummary.toPay}
            net={searchedPersonSummary.net}
            pendingCount={searchedPersonSummary.pendingCount}
          />
        ) : (
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm" aria-live="polite">
            <h2 className="text-sm font-semibold text-slate-800">
              {matchingPeople.length > 1 ? "More than one person matches" : "No matching person found"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {matchingPeople.length > 1
                ? "Type more of the name to see one person’s outstanding totals."
                : `No person matches “${search.trim()}”. Search for a name in your Money Tracker entries to see their totals.`}
            </p>
          </section>
        )}

        {pageError && (
          <div role="alert" className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span>{pageError}</span>
            <button type="button" onClick={() => setPageError("")} aria-label="Dismiss error" className="rounded px-1 font-semibold hover:bg-red-100">×</button>
          </div>
        )}

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Search and filter money entries">
          <label className="relative block">
            <span className="sr-only">Search by person, description, or notes</span>
            <svg viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true">
              <circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.7" />
              <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search person, description, or notes..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter entries by direction">
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                aria-pressed={filter === item.key}
                className={`min-h-9 rounded-lg px-3.5 text-xs font-semibold transition focus:outline-none focus:ring-4 focus:ring-blue-100 ${filter === item.key ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {item.label}
              </button>
            ))}
            <span className="ml-auto self-center text-xs text-slate-500" aria-live="polite">
              {filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"}
            </span>
          </div>
        </section>

        <section aria-label="Money entries" className="space-y-3">
          {isLoading ? (
            <div className="space-y-3" aria-label="Loading money entries">
              {[0, 1, 2].map((item) => <div key={item} className="h-36 animate-pulse motion-reduce:animate-none rounded-2xl border border-slate-200 bg-white" />)}
            </div>
          ) : pageError && entries.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Entries could not be loaded</h2>
              <p className="mt-1 text-sm text-slate-500">Check your connection or confirm that the database migration has been run.</p>
              <button type="button" onClick={() => void loadEntries(true)} className="mt-4 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Try again</button>
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="12" cy="12" r="3" /></svg>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">No money entries yet</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Add a shared balance to keep track of what you owe or what someone owes you.</p>
              <button type="button" onClick={openAddModal} className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">Add your first entry</button>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">No matching entries</h2>
              <p className="mt-1 text-sm text-slate-500">Try another search or choose a different direction filter.</p>
              <button type="button" onClick={() => { setSearch(""); setFilter("all"); }} className="mt-4 text-sm font-semibold text-blue-800 underline underline-offset-4">Clear filters</button>
            </div>
          ) : (
            <div key={`${filter}:${filteredEntries.map((entry) => entry.id).join(",")}`} className="money-filtered-entry-enter space-y-3">
              {filteredEntries.map((entry) => (
                <article
                  key={entry.id}
                  className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-[opacity,transform,border-color] duration-200 sm:p-5 ${transitioningId === entry.id ? transitionType === "settle" ? "money-entry-settling" : "money-entry-removing" : ""}`}
                >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-slate-950">{entry.person_name}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${entry.direction === "receive" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                      {entry.direction === "receive" ? "I will receive" : "I owe"}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${entry.status === "pending" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                      {entry.status === "pending" ? "Pending" : "Settled"}
                    </span>
                  </div>
                  {entry.description && entry.description !== "Money entry" && (
                    <p className="mt-2 text-sm font-medium text-slate-800">{entry.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <time dateTime={entry.entry_date.slice(0, 10)}>{formatDate(entry.entry_date)}</time>
                    {entry.notes && <span className="max-w-full break-words">{entry.notes}</span>}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                  <p className={`text-xl font-bold tracking-tight ${entry.direction === "receive" ? "text-emerald-800" : "text-rose-800"}`}>{formatMoney(entry.amount)}</p>
                  <div className="flex flex-wrap justify-end gap-2">
                    {entry.status === "pending" && (
                      <button type="button" disabled={mutatingId !== null} onClick={() => void markSettled(entry)} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50">
                        {mutatingId === entry.id ? "Saving…" : "Mark settled"}
                      </button>
                    )}
                    <button type="button" disabled={mutatingId !== null} onClick={() => openEditModal(entry)} aria-label={`Edit entry for ${entry.person_name}`} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 disabled:opacity-50">Edit</button>
                    <button type="button" disabled={mutatingId !== null} onClick={() => void deleteEntry(entry)} aria-label={`Delete entry for ${entry.person_name}`} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50">Delete</button>
                  </div>
                </div>
              </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {isModalOpen && (
        <div
          className="money-modal-backdrop fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto bg-slate-950/35 px-0 py-0 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}
        >
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="money-entry-title" className="money-modal-panel max-h-[95dvh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="money-entry-title" className="text-xl font-bold tracking-tight text-slate-950">{editingEntry ? "Edit money entry" : "Add money entry"}</h2>
                <p className="mt-1 text-sm text-slate-500">Record a balance with someone.</p>
              </div>
              <button type="button" onClick={closeModal} disabled={isSaving} aria-label="Close form" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-40">×</button>
            </div>

            <form onSubmit={saveEntry} className="space-y-4">
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-700">Direction</legend>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Entry direction">
                  <button type="button" aria-pressed={form.direction === "receive"} onClick={() => updateForm("direction", "receive")} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-emerald-100 ${form.direction === "receive" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>I will receive</button>
                  <button type="button" aria-pressed={form.direction === "owe"} onClick={() => updateForm("direction", "owe")} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-rose-100 ${form.direction === "owe" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>I owe</button>
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div ref={personAutocompleteRef} className="relative text-sm font-medium text-slate-700">
                  <label htmlFor="money-person-name">
                    Person or group name <span className="text-red-600" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="money-person-name"
                    ref={personInputRef}
                    required
                    maxLength={120}
                    value={form.person_name}
                    onChange={(event) => {
                      updateForm("person_name", event.target.value);
                      setActiveSuggestionIndex(-1);
                      setIsNameDropdownOpen(true);
                    }}
                    onFocus={() => setIsNameDropdownOpen(true)}
                    onBlur={(event) => {
                      if (!personAutocompleteRef.current?.contains(event.relatedTarget as Node | null)) {
                        setIsNameDropdownOpen(false);
                        setActiveSuggestionIndex(-1);
                      }
                    }}
                    onKeyDown={onPersonInputKeyDown}
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={suggestionsOpen}
                    aria-controls={suggestionsOpen ? "money-person-suggestions" : undefined}
                    aria-activedescendant={activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length && suggestionsOpen ? `money-person-suggestion-${activeSuggestionIndex}` : undefined}
                    className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  />
                  {suggestionsOpen && (
                    <ul
                      id="money-person-suggestions"
                      role="listbox"
                      aria-label="Previously used names"
                      className="money-autocomplete-enter absolute inset-x-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
                    >
                      {suggestions.map((name, index) => (
                        <li
                          id={`money-person-suggestion-${index}`}
                          key={normalizePersonName(name)}
                          role="option"
                          aria-selected={activeSuggestionIndex === index}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => choosePersonName(name)}
                          className={`cursor-pointer rounded-lg px-3 py-2.5 text-sm transition-colors ${activeSuggestionIndex === index ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"}`}
                        >
                          {name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <label className="block text-sm font-medium text-slate-700">
                  Amount <span className="text-red-600" aria-hidden="true">*</span>
                  <div className="mt-1.5 flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50">
                    <span aria-hidden="true" className="mr-2 text-sm text-slate-400">$</span>
                    <input required type="number" min="0.01" max="1000000000" step="0.01" inputMode="decimal" value={form.amount} onChange={(event) => updateForm("amount", event.target.value)} className="h-full w-full bg-transparent text-sm text-slate-900 outline-none" />
                  </div>
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-700">
                Date <span className="text-red-600" aria-hidden="true">*</span>
                <input required type="date" value={form.entry_date} onChange={(event) => updateForm("entry_date", event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Notes <span className="font-normal text-slate-400">(optional)</span>
                <textarea rows={3} maxLength={2000} value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Add any details you want to remember..." className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
              </label>

              {formError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeModal} disabled={isSaving} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={isSaving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300 disabled:cursor-wait disabled:opacity-70">
                  {isSaving && <span className="h-4 w-4 animate-spin motion-reduce:animate-none rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
                  {isSaving ? "Saving…" : editingEntry ? "Save changes" : "Save entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/25 px-4 backdrop-blur-sm" role="status" aria-live="polite">
          <div className="expense-success-card w-full max-w-sm rounded-3xl bg-white px-8 py-9 text-center shadow-2xl">
            <div className="expense-success-check mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-600 text-white shadow-lg shadow-green-600/25">
              <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-950">{successMessage}</h2>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryCard({
  label,
  amount,
  detail,
  tone,
  delay,
  formatter = formatMoney,
}: {
  label: string;
  amount: number;
  detail: string;
  tone: "green" | "red" | "slate";
  delay: string;
  formatter?: (amount: number) => string;
}) {
  const toneClass = tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "red" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600";
  return (
    <article className="money-summary-enter rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" style={{ animationDelay: delay }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950"><AnimatedValue amount={amount} formatter={formatter} /></p>
        </div>
        <span aria-hidden="true" className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${toneClass}`}>
          {tone === "slate" ? (
            <span className="text-sm font-semibold">#</span>
          ) : tone === "green" ? (
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8"><path d="M5 16 10 11l3.5 3.5L20 8" strokeLinecap="round" strokeLinejoin="round" /><path d="M14.5 8H20v5.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8"><path d="m5 8 5 5 3.5-3.5L20 16" strokeLinecap="round" strokeLinejoin="round" /><path d="M14.5 16H20v-5.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

function AnimatedValue({ amount, formatter }: { amount: number; formatter: (amount: number) => string }) {
  const [displayedAmount, setDisplayedAmount] = useState(amount);
  const displayedRef = useRef(amount);

  useEffect(() => {
    const startAmount = displayedRef.current;
    const startTime = performance.now();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    const update = (now: number) => {
      const progress = reduceMotion ? 1 : Math.min((now - startTime) / 320, 1);
      const eased = 1 - (1 - progress) ** 3;
      const nextAmount = startAmount + (amount - startAmount) * eased;
      displayedRef.current = nextAmount;
      setDisplayedAmount(nextAmount);
      if (progress < 1) frame = window.requestAnimationFrame(update);
    };

    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [amount]);

  return <><span aria-hidden="true">{formatter(displayedAmount)}</span><span className="sr-only">{formatter(amount)}</span></>;
}

function PersonSummaryCards({
  personName,
  toReceive,
  toPay,
  net,
  pendingCount,
}: {
  personName: string;
  toReceive: number;
  toPay: number;
  net: number;
  pendingCount: number;
}) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = section.animate(
      [{ opacity: 0.82, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 260, easing: "ease-out" },
    );
    return () => animation.cancel();
  }, [personName, toReceive, toPay, net, pendingCount]);

  return (
    <section ref={sectionRef} aria-label={`Outstanding balance summary for ${personName}`} className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label="Total to Receive" amount={toReceive} detail={`Pending money ${personName} owes you`} tone="green" delay="0ms" />
      <SummaryCard label="Total to Pay" amount={toPay} detail={`Pending money you owe ${personName}`} tone="red" delay="40ms" />
      <SummaryCard label="Net Balance" amount={net} detail="Receive minus pay" tone={net === 0 ? "slate" : net > 0 ? "green" : "red"} delay="80ms" />
      <SummaryCard label="Pending entries" amount={pendingCount} detail="Unsettled entries for this person" tone="slate" delay="120ms" formatter={(count) => String(Math.round(count))} />
    </section>
  );
}
