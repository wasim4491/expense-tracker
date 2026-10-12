"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppNavigation from "@/app/components/AppNavigation";
import { useProfile } from "@/app/components/useProfile";

type Expense = {
  ID: string;
  Date: string;
  Amount: number;
  Description: string;
  Category: string;
  Type: string;
  "Payment Method": string;
  Notes: string;
  Split: string;
  People: number;
  "My Share": number;
};

type TrendMonth = { month: string; amount: number };

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

function safeAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function getExpenseShare(expense: Expense) {
  const amount = safeAmount(expense.Amount);
  const share = expense["My Share"];
  return share == null || !Number.isFinite(Number(share)) ? amount : Number(share);
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(month: string, short = false) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1, 1);
  return date.toLocaleDateString("en-US", {
    month: short ? "short" : "long",
    ...(short ? {} : { year: "numeric" }),
  });
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Dashboard() {
  const { displayName } = useProfile();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState(2500);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("2500");
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [budgetMessage, setBudgetMessage] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);

  useEffect(() => {
    let isMounted = true;

    const fetchDashboard = async () => {
      try {
        const response = await fetch("/api/expenses?action=getDashboard", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to fetch dashboard data");

        const data = await response.json();
        if (!isMounted) return;
        setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
        if (typeof data.budget === "number" && data.budget >= 0) {
          setMonthlyBudget(data.budget);
          setBudgetInput(String(data.budget));
        }
      } catch (fetchError) {
        if (isMounted) {
          console.error("Failed to fetch dashboard:", fetchError);
          setError("Unable to load dashboard. Please try again.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void fetchDashboard();
    return () => { isMounted = false; };
  }, []);

  const availableMonths = useMemo(() => {
    const months = Array.from(new Set(expenses.map((expense) => expense.Date?.slice(0, 7)).filter(Boolean)));
    if (!months.includes(selectedMonth)) months.push(selectedMonth);
    return months.sort((a, b) => b.localeCompare(a));
  }, [expenses, selectedMonth]);

  const monthlyExpenses = useMemo(
    () => expenses.filter((expense) => expense.Date?.startsWith(selectedMonth)),
    [expenses, selectedMonth]
  );

  const totalPaid = useMemo(
    () => monthlyExpenses.reduce((total, expense) => total + safeAmount(expense.Amount), 0),
    [monthlyExpenses]
  );

  const myShare = useMemo(
    () => monthlyExpenses.reduce((total, expense) => total + getExpenseShare(expense), 0),
    [monthlyExpenses]
  );

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const expense of monthlyExpenses) {
      const category = expense.Category?.trim() || "Other";
      totals.set(category, (totals.get(category) ?? 0) + getExpenseShare(expense));
    }
    return Array.from(totals, ([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthlyExpenses]);

  const trend = useMemo<TrendMonth[]>(() => {
    const totals = new Map<string, number>();
    for (const expense of expenses) {
      const month = expense.Date?.slice(0, 7);
      if (!month) continue;
      totals.set(month, (totals.get(month) ?? 0) + getExpenseShare(expense));
    }
    return Array.from({ length: 6 }, (_, index) => {
      const month = shiftMonth(selectedMonth, index - 5);
      return { month, amount: totals.get(month) ?? 0 };
    });
  }, [expenses, selectedMonth]);

  const recentExpenses = useMemo(
    () => expenses.slice().sort((a, b) => (b.Date ?? "").localeCompare(a.Date ?? "")).slice(0, 5),
    [expenses]
  );

  const budgetRemaining = monthlyBudget - myShare;
  const budgetUsedPercentage = monthlyBudget > 0 ? (myShare / monthlyBudget) * 100 : 0;
  const budgetProgress = Math.min(Math.max(budgetUsedPercentage, 0), 100);
  const maxTrendAmount = Math.max(...trend.map((item) => item.amount), 1);

  const handleSaveBudget = async () => {
    const newBudget = Number(budgetInput);
    if (!budgetInput.trim() || !Number.isFinite(newBudget) || newBudget < 0) {
      setBudgetMessage("Enter a valid budget amount.");
      return;
    }

    setIsSavingBudget(true);
    setBudgetMessage("");
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateBudget", budget: newBudget }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to update budget.");

      setMonthlyBudget(newBudget);
      setIsEditingBudget(false);
      setBudgetMessage("Monthly budget updated successfully.");
    } catch (saveError) {
      console.error("Failed to update budget:", saveError);
      setBudgetMessage("Could not save budget. Please try again.");
    } finally {
      setIsSavingBudget(false);
    }
  };

  if (isLoading) {
    return (
      <main className="app-content-with-sidebar min-h-screen bg-slate-50 px-4 pb-12 pt-24 sm:px-6 lg:pr-8">
        <AppNavigation />
        <div className="mx-auto max-w-7xl animate-pulse" aria-label="Loading dashboard">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><div className="h-8 w-64 rounded-lg bg-slate-200" /><div className="mt-3 h-4 w-56 rounded bg-slate-100" /></div>
            <div className="h-11 w-40 rounded-xl bg-slate-200" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-36 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="h-4 w-24 rounded bg-slate-100" /><div className="mt-6 h-8 w-36 rounded bg-slate-200" /><div className="mt-4 h-3 w-44 rounded bg-slate-100" /></div>)}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[0, 1].map((item) => <div key={item} className="h-80 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="h-5 w-48 rounded bg-slate-200" /><div className="mt-3 h-4 w-64 rounded bg-slate-100" /><div className="mt-8 h-48 rounded-xl bg-slate-100" /></div>)}
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="app-content-with-sidebar min-h-screen bg-slate-50 px-4 pb-12 pt-24 sm:px-6 lg:pr-8">
        <AppNavigation />
        <div className="mx-auto flex min-h-[60vh] max-w-7xl flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 font-semibold text-red-600">!</div>
          <h1 className="mt-4 text-lg font-semibold text-slate-950">Something went wrong</h1>
          <p className="mt-1 text-sm text-slate-500">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">Try again</button>
        </div>
      </main>
    );
  }

  return (
    <main className="app-content-with-sidebar min-h-screen bg-slate-50 px-4 pb-12 pt-24 sm:px-6 lg:pr-8">
      <AppNavigation />
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Your finances</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Good evening, {displayName.split(" ")[0]} <span aria-hidden="true">👋</span>
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">A clear view of your spending for {formatMonth(selectedMonth)}.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="dashboard-month" className="sr-only">Select dashboard month</label>
            <select
              id="dashboard-month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm outline-none transition hover:border-slate-300 focus:border-blue-300 focus:ring-4 focus:ring-blue-50 sm:w-auto"
            >
              {availableMonths.map((month) => <option key={month} value={month}>{formatMonth(month)}</option>)}
            </select>
            <Link href="/add-expense" className="inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300">
              <span className="mr-2 text-base leading-none" aria-hidden="true">+</span> Add expense
            </Link>
          </div>
        </header>

        <section aria-label={`Financial overview for ${formatMonth(selectedMonth)}`} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="min-h-36 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm font-medium text-slate-500">Total Paid</p>
            <p className="mt-5 text-3xl font-bold tracking-tight text-slate-950">{formatMoney(totalPaid)}</p>
            <p className="mt-2 text-xs text-slate-400">Full transaction amounts this month</p>
          </article>

          <article className="min-h-36 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-sm font-medium text-slate-500">My Share</p>
            <p className="mt-5 text-3xl font-bold tracking-tight text-slate-950">{formatMoney(myShare)}</p>
            <p className="mt-2 text-xs text-slate-400">Your portion of {monthlyExpenses.length} {monthlyExpenses.length === 1 ? "expense" : "expenses"}</p>
          </article>

          <article className="min-h-36 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-500">Budget Remaining</p>
              {budgetRemaining < 0 && <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700">Over budget</span>}
            </div>
            <p className={`mt-5 text-3xl font-bold tracking-tight ${budgetRemaining < 0 ? "text-red-700" : "text-slate-950"}`}>
              {formatMoney(Math.abs(budgetRemaining))}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {monthlyBudget === 0 && myShare === 0 ? "No monthly budget set" : budgetRemaining < 0 ? "Over by this amount" : "Monthly budget minus your share"}
            </p>
          </article>

          <article className="min-h-36 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-500">Budget Used</p>
              <button
                type="button"
                onClick={() => { setBudgetInput(String(monthlyBudget)); setBudgetMessage(""); setIsEditingBudget((current) => !current); }}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              >
                {isEditingBudget ? "Close" : "Edit budget"}
              </button>
            </div>
            {isEditingBudget ? (
              <div className="mt-3">
                <label htmlFor="budget-input" className="sr-only">Monthly budget amount</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">$</span>
                  <input id="budget-input" type="number" min="0" step="0.01" value={budgetInput} onChange={(event) => setBudgetInput(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
                  <button type="button" onClick={() => void handleSaveBudget()} disabled={isSavingBudget} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50">{isSavingBudget ? "Saving" : "Save"}</button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{monthlyBudget > 0 ? `${budgetUsedPercentage.toFixed(0)}%` : "—"}</p>
            )}
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Monthly budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(budgetUsedPercentage, 100)}>
              <div className={`h-full rounded-full transition-all duration-500 ${budgetUsedPercentage >= 100 ? "bg-red-500" : budgetUsedPercentage >= 80 ? "bg-blue-500" : "bg-slate-800"}`} style={{ width: `${budgetProgress}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {monthlyBudget === 0 ? "Set a budget to track your progress" : `${formatMoney(myShare)} of ${formatMoney(monthlyBudget)}`}
            </p>
          </article>
        </section>

        {budgetMessage && <p role="status" className={`mt-3 text-sm ${budgetMessage.includes("successfully") ? "text-green-700" : "text-red-600"}`}>{budgetMessage}</p>}

        <section className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] transition-shadow hover:shadow-md sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-950">Monthly spending</h2>
                <p className="mt-1 text-sm text-slate-500">Your share over six months, ending {formatMonth(selectedMonth)}.</p>
              </div>
              <span className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">Select a bar to view that month</span>
            </div>

            {trend.every((item) => item.amount === 0) ? (
              <div className="mt-6 flex h-56 items-center justify-center rounded-xl bg-slate-50 px-4 text-center text-sm text-slate-500">No spending recorded in this six-month period.</div>
            ) : (
              <div className="mt-6 grid h-56 grid-cols-6 gap-2 sm:gap-4" role="group" aria-label="Monthly spending for six months">
                {trend.map((item) => {
                  const height = item.amount > 0 ? Math.max((item.amount / maxTrendAmount) * 100, 5) : 0;
                  const tooltipBottom = Math.max((height / 100) * 148 + 10, 16);
                  const isSelected = item.month === selectedMonth;
                  return (
                    <button
                      key={item.month}
                      type="button"
                      onClick={() => setSelectedMonth(item.month)}
                      title={`${formatMonth(item.month)} · ${formatMoney(item.amount)} my share`}
                      aria-label={`${formatMonth(item.month)} spending: ${formatMoney(item.amount)}. ${isSelected ? "Selected" : "Select month"}`}
                      aria-pressed={isSelected}
                      className="group relative flex min-w-0 flex-col items-center justify-end rounded-xl px-1 pb-1 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-300"
                    >
                      <span style={{ bottom: `${tooltipBottom}px` }} className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1.5 text-[10px] font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100">
                        {formatMoney(item.amount)}
                      </span>
                      <span className="flex h-40 w-full items-end justify-center rounded-t-lg bg-slate-50">
                        <span className={`w-3/5 max-w-10 rounded-t-md transition-all duration-500 ${isSelected ? "bg-blue-700" : "bg-slate-300 group-hover:bg-slate-500"}`} style={{ height: `${height}%` }} />
                      </span>
                      <span className={`mt-3 text-[11px] ${isSelected ? "font-bold text-blue-800" : "font-medium text-slate-500"}`}>{formatMonth(item.month, true)}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-3 text-right text-[11px] text-slate-400">Amounts show your share to avoid double-counting split expenses.</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] transition-shadow hover:shadow-md sm:p-6">
            <div>
              <h2 className="text-base font-bold text-slate-950">Category breakdown</h2>
              <p className="mt-1 text-sm text-slate-500">Your share by category for {formatMonth(selectedMonth)}.</p>
            </div>
            {categoryTotals.length === 0 ? (
              <div className="mt-6 flex min-h-52 items-center justify-center rounded-xl bg-slate-50 px-4 text-center text-sm text-slate-500">
                No transactions in {formatMonth(selectedMonth)} yet. Your category breakdown will appear here.
              </div>
            ) : (
              <div className="mt-6 max-h-56 space-y-4 overflow-y-auto pr-1">
                {categoryTotals.map(({ category, amount }) => {
                  const percentage = myShare > 0 ? (amount / myShare) * 100 : 0;
                  return (
                    <div key={category}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate font-semibold text-slate-700">{category}</span>
                        <span className="shrink-0 text-slate-500">{formatMoney(amount)} <span className="ml-1 text-slate-400">{percentage.toFixed(1)}%</span></span>
                      </div>
                      <div role="progressbar" aria-label={`${category} share of monthly spending`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(Math.max(percentage, 0), 100)} className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-base font-bold text-slate-950">Recent transactions</h2>
              <p className="mt-1 text-sm text-slate-500">Your five most recent expenses.</p>
            </div>
            <Link href="/expenses" className="text-sm font-semibold text-blue-700 transition hover:text-blue-900">View all expenses <span aria-hidden="true">→</span></Link>
          </div>

          {recentExpenses.length === 0 ? (
            <div className="px-5 py-12 text-center sm:px-6">
              <p className="text-sm font-semibold text-slate-700">No expenses yet</p>
              <p className="mt-1 text-sm text-slate-500">Add an expense to see it in your recent activity.</p>
              <Link href="/add-expense" className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700">Add expense</Link>
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[110px_minmax(160px,1fr)_130px_140px_110px_110px] gap-3 bg-slate-50/70 px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:grid">
                <span>Date</span><span>Description</span><span>Category</span><span>Payment method</span><span className="text-right">Amount</span><span className="text-right">My share</span>
              </div>
              <div className="divide-y divide-slate-100">
                {recentExpenses.map((expense) => {
                  const amount = safeAmount(expense.Amount);
                  const share = getExpenseShare(expense);
                  const isSplit = Math.abs(amount - share) > 0.009;
                  return (
                    <article key={expense.ID} className="px-5 py-3.5 transition-colors hover:bg-slate-50/70 sm:grid sm:grid-cols-[110px_minmax(160px,1fr)_130px_140px_110px_110px] sm:items-center sm:gap-3 sm:px-6">
                      <span className="hidden text-xs text-slate-500 sm:block">{formatDate(expense.Date)}</span>
                      <div className="flex min-w-0 items-center justify-between gap-4 sm:block">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{expense.Description?.trim() || "Untitled expense"}</p>
                          <p className="mt-1 truncate text-xs text-slate-500 sm:hidden">{formatDate(expense.Date)} · {expense.Category || "Other"} · {expense["Payment Method"] || "No payment method"}</p>
                        </div>
                        <div className="shrink-0 text-right sm:hidden">
                          <p className="text-sm font-semibold text-slate-900">{formatMoney(amount)}</p>
                          {isSplit && <p className="mt-0.5 text-[11px] text-slate-500">Share {formatMoney(share)}</p>}
                        </div>
                      </div>
                      <span className="hidden truncate text-xs text-slate-600 sm:block">{expense.Category || "Other"}</span>
                      <span className="hidden truncate text-xs text-slate-600 sm:block">{expense["Payment Method"] || "—"}</span>
                      <span className="hidden text-right text-sm font-semibold text-slate-900 sm:block">{formatMoney(amount)}</span>
                      <span className="hidden text-right text-sm text-slate-600 sm:block">{isSplit ? formatMoney(share) : <span className="text-slate-300">—</span>}</span>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
