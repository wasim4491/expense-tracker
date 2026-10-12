"use client";

import { useEffect, useMemo, useState } from "react";
import AppNavigation from "@/app/components/AppNavigation";

type Expense = {
  ID: string;
  Date: string;
  Amount: number;
  Description: string;
  Category: string;
  Type: string;
  "My Share": number;
};

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export default function CalendarPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => monthKey(new Date()));
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    const loadExpenses = async () => {
      try {
        const response = await fetch("/api/expenses", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load expenses");
        setExpenses(await response.json());
      } catch (error) {
        console.error("Failed to load calendar expenses:", error);
        setLoadError("Unable to load expenses. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadExpenses();
  }, []);

  const [year, monthNumber] = selectedMonth.split("-").map(Number);
  const firstWeekday = new Date(year, monthNumber - 1, 1).getDay();
  const dayCount = new Date(year, monthNumber, 0).getDate();
  const weekCount = Math.ceil((firstWeekday + dayCount) / 7);
  const cells = Array.from({ length: weekCount * 7 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= dayCount ? day : null;
  });

  const monthExpenses = useMemo(
    () => expenses.filter((expense) => expense.Date?.startsWith(selectedMonth)),
    [expenses, selectedMonth]
  );

  const expensesByDate = useMemo(() => {
    return monthExpenses.reduce<Record<string, Expense[]>>((groups, expense) => {
      const date = expense.Date?.substring(0, 10);
      if (date) groups[date] = [...(groups[date] || []), expense];
      return groups;
    }, {});
  }, [monthExpenses]);

  const monthTotal = monthExpenses.reduce(
    (sum, expense) => sum + Number(expense["My Share"] || expense.Amount || 0),
    0
  );
  const selectedExpenses = selectedDate ? expensesByDate[selectedDate] || [] : [];
  const formatMoney = (amount: number) => `$${amount.toFixed(2)}`;
  const monthLabel = new Date(year, monthNumber - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const changeMonth = (offset: number) => {
    const next = new Date(year, monthNumber - 1 + offset, 1);
    setSelectedMonth(monthKey(next));
    setSelectedDate("");
  };

  return (
    <main className="app-content-with-sidebar min-h-screen bg-slate-50 px-4 pb-8 pt-24 sm:px-6 lg:pr-8">
      <AppNavigation />
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Your activity</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Calendar</h1>
            <p className="mt-1 text-sm text-slate-500">Browse expenses by day.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month" className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-slate-500 hover:bg-slate-100">‹</button>
            <span className="min-w-32 text-center text-sm font-semibold text-slate-800">{monthLabel}</span>
            <button type="button" onClick={() => changeMonth(1)} aria-label="Next month" className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-slate-500 hover:bg-slate-100">›</button>
          </div>
        </div>

        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Spending this month</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{formatMoney(monthTotal)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Expenses this month</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{monthExpenses.length}</p>
          </div>
        </div>

        {loadError ? (
          <section role="alert" className="rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700 shadow-sm">{loadError}</section>
        ) : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="grid grid-cols-7 border-b border-slate-100 pb-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}
          </div>
          {isLoading ? (
            <div className="grid grid-cols-7 gap-px pt-3">
              {cells.map((_, index) => <div key={index} className="h-20 animate-pulse rounded-lg bg-slate-50 sm:h-28" />)}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-px pt-3">
              {cells.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} className="min-h-20 rounded-lg sm:min-h-28" />;
                const date = `${selectedMonth}-${String(day).padStart(2, "0")}`;
                const dayExpenses = expensesByDate[date] || [];
                const total = dayExpenses.reduce((sum, expense) => sum + Number(expense["My Share"] || expense.Amount || 0), 0);
                const isSelected = selectedDate === date;

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelectedDate(isSelected ? "" : date)}
                    aria-pressed={isSelected}
                    className={`min-h-20 rounded-xl border p-1.5 text-left transition sm:min-h-28 sm:p-2.5 ${isSelected ? "border-blue-300 bg-blue-50" : "border-transparent hover:border-slate-200 hover:bg-slate-50"}`}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isSelected ? "bg-blue-700 text-white" : "text-slate-600"}`}>{day}</span>
                    {dayExpenses.length > 0 && <span className="mt-2 block truncate text-[10px] font-semibold text-slate-800 sm:text-xs">{formatMoney(total)}</span>}
                    {dayExpenses.length > 0 && <span className="mt-0.5 hidden text-[10px] text-slate-400 sm:block">{dayExpenses.length} {dayExpenses.length === 1 ? "expense" : "expenses"}</span>}
                    {dayExpenses.length > 0 && <span className="mt-2 block h-1 w-5 rounded-full bg-blue-500 sm:w-7" />}
                  </button>
                );
              })}
            </div>
          )}
        </section>}

        {selectedDate && (
          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">
              {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h2>
            {selectedExpenses.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No expenses recorded for this day.</p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100">
                {selectedExpenses.map((expense) => (
                  <div key={expense.ID} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{expense.Description}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{expense.Category}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-slate-950">{formatMoney(Number(expense["My Share"] || expense.Amount || 0))}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
