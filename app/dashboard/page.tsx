"use client";

import { useEffect, useMemo, useState } from "react";
import LogoutButton from "@/app/components/LogoutButton";

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

export default function Dashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState(2500);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("2500");
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [budgetMessage, setBudgetMessage] = useState("");

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();

    return `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;
  });

  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        const response = await fetch("/api/expenses");

        if (!response.ok) {
          throw new Error("Failed to fetch expenses");
        }

        const data = await response.json();
        setExpenses(data);
      } catch (error) {
        console.error("Failed to fetch expenses:", error);
        setError("Unable to load dashboard. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchExpenses();

    const fetchBudget = async () => {
      try {
        const response = await fetch(
          "/api/expenses?action=getBudget",
          { cache: "no-store" }
        );
    
        if (!response.ok) {
          throw new Error("Failed to fetch budget");
        }
    
        const data = await response.json();
    
        if (typeof data.budget === "number" && data.budget >= 0) {
          setMonthlyBudget(data.budget);
        }
      } catch (error) {
        console.error("Failed to fetch budget:", error);
      }
    };
    
    fetchBudget();
  }, []);


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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "updateBudget",
          budget: newBudget,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to update budget.");
      }

      setMonthlyBudget(newBudget);
      setIsEditingBudget(false);
      setBudgetMessage("Monthly budget updated successfully.");
    } catch (error) {
      console.error("Failed to update budget:", error);
      setBudgetMessage("Could not save budget. Please try again.");
    } finally {
      setIsSavingBudget(false);
    }
  };


  const monthlyExpenses = useMemo(() => {
    return expenses.filter((expense) =>
      expense.Date?.startsWith(selectedMonth)
    );
  }, [expenses, selectedMonth]);

  const getShare = (expense: Expense) =>
    Number(expense["My Share"] || expense.Amount || 0);

  const totalPaid = monthlyExpenses.reduce(
    (total, expense) => total + Number(expense.Amount || 0),
    0
  );

  const myShare = monthlyExpenses.reduce(
    (total, expense) => total + getShare(expense),
    0
  );

  const budgetRemaining = monthlyBudget - myShare;

  const budgetUsedPercentage =
    monthlyBudget > 0
      ? (myShare / monthlyBudget) * 100
      : 0;

  const budgetProgress = Math.min(budgetUsedPercentage, 100);

  const needs = monthlyExpenses
    .filter((expense) => expense.Type === "Need")
    .reduce((total, expense) => total + getShare(expense), 0);

  const wants = monthlyExpenses
    .filter((expense) => expense.Type === "Want")
    .reduce((total, expense) => total + getShare(expense), 0);

  const formatMoney = (value: number) => `$${value.toFixed(2)}`;

  const formatMonth = (month: string) => {
    const [year, monthNumber] = month.split("-");

    const date = new Date(
      Number(year),
      Number(monthNumber) - 1,
      1
    );

    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const availableMonths = Array.from(
    new Set(
      expenses
        .map((expense) => expense.Date?.substring(0, 7))
        .filter(Boolean)
    )
  ).sort().reverse();

  if (!availableMonths.includes(selectedMonth)) {
    availableMonths.unshift(selectedMonth);
  }

  const categoryTotals = Object.entries(
    monthlyExpenses.reduce<Record<string, number>>((acc, expense) => {
      const category = expense.Category || "Other";
      acc[category] = (acc[category] || 0) + getShare(expense);
      return acc;
    }, {})
  ).sort(([, a], [, b]) => b - a);

  const paymentTotals = Object.entries(
    monthlyExpenses.reduce<Record<string, number>>((acc, expense) => {
      const method = expense["Payment Method"] || "Other";
      acc[method] = (acc[method] || 0) + getShare(expense);
      return acc;
    }, {})
  ).sort(([, a], [, b]) => b - a);

  const monthlyTotals = Object.entries(
    expenses.reduce<Record<string, number>>((acc, expense) => {
      const month = expense.Date?.substring(0, 7);

      if (!month) return acc;

      acc[month] = (acc[month] || 0) + getShare(expense);

      return acc;
    }, {})
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6);

  const maxMonthlyAmount = Math.max(
    ...monthlyTotals.map(([, value]) => value),
    1
  );

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f7f8fa] p-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-gray-500">
              Loading dashboard...
            </p>
          </div>
        </div>
      </main>
    );
  }
  
  if (error) {
    return (
      <main className="min-h-screen bg-[#f7f8fa] p-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              !
            </div>
  
            <h1 className="mt-4 text-lg font-semibold text-gray-950">
              Something went wrong
            </h1>
  
            <p className="mt-1 text-sm text-gray-500">
              {error}
            </p>
  
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">

        {/* Navigation */}
        <nav className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <a
            href="/"
            className="text-xl font-bold tracking-tight text-gray-950"
          >
            Expense Tracker
          </a>

          <div className="flex flex-wrap gap-2">
            <a
              href="/"
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Add Expense
            </a>

            <a
              href="/expenses"
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Expenses
            </a>

            <a
              href="/dashboard"
              className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white"
            >
              Dashboard
            </a>
            <LogoutButton />
          </div>
        </nav>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-gray-500">
              Financial overview
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
              Dashboard
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Understand where your money is going.
            </p>
          </div>

          <div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 shadow-sm outline-none transition focus:border-gray-400 sm:w-auto"
            >
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {formatMonth(month)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">
                Total Paid
              </p>

              <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                Paid
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold tracking-tight text-gray-950">
              {formatMoney(totalPaid)}
            </p>

            <p className="mt-2 text-xs text-gray-400">
              Total amount paid this month
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">
                My Share
              </p>

              <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                Mine
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold tracking-tight text-gray-950">
              {formatMoney(myShare)}
            </p>

            <p className="mt-2 text-xs text-gray-400">
              Your actual share of expenses
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">
                Needs
              </p>

              <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                Essential
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold tracking-tight text-gray-950">
              {formatMoney(needs)}
            </p>

            <p className="mt-2 text-xs text-gray-400">
              Essential spending
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">
                Wants
              </p>

              <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                Lifestyle
              </span>
            </div>

            <p className="mt-4 text-3xl font-bold tracking-tight text-gray-950">
              {formatMoney(wants)}
            </p>

            <p className="mt-2 text-xs text-gray-400">
              Non-essential spending
            </p>
          </div>
        </div>


        {/* Monthly Budget */}
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Monthly Budget
              </p>
              
              {isEditingBudget ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-medium text-gray-500">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      className="w-full max-w-48 rounded-lg border border-gray-300 px-3 py-2 text-xl font-semibold text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      aria-label="Monthly budget amount"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveBudget}
                    disabled={isSavingBudget}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                  >
                    {isSavingBudget ? "Saving..." : "Save"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingBudget(false);
                      setBudgetInput(String(monthlyBudget));
                      setBudgetMessage("");
                    }}
                    disabled={isSavingBudget}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h2 className="text-3xl font-bold tracking-tight text-gray-950">
                    {formatMoney(monthlyBudget)}
                  </h2>

                  <button
                    type="button"
                    onClick={() => {
                      setBudgetInput(String(monthlyBudget));
                      setBudgetMessage("");
                      setIsEditingBudget(true);
                    }}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Edit budget
                  </button>
                </div>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Based on your share of expenses for {formatMonth(selectedMonth)}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 px-4 py-3 sm:text-right">
              <p className="text-xs font-medium text-gray-500">
                {budgetRemaining >= 0 ? "Remaining" : "Over budget"}
              </p>
              <p
                className={`mt-1 text-xl font-bold ${
                  budgetRemaining >= 0 ? "text-green-700" : "text-red-600"
                }`}
              >
                {formatMoney(Math.abs(budgetRemaining))}
              </p>
            </div>
          </div>

          {budgetMessage && (
            <p
              role="status"
              className={`mt-3 text-sm ${
                budgetMessage.includes("successfully")
                  ? "text-green-700"
                  : "text-red-600"
              }`}
            >
              {budgetMessage}
            </p>
          )}

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-600">
                {formatMoney(myShare)} spent
              </span>
              <span className="font-semibold text-gray-900">
                {budgetUsedPercentage.toFixed(1)}% used
              </span>
            </div>

            <div
              className="h-3 overflow-hidden rounded-full bg-gray-100"
              role="progressbar"
              aria-label="Monthly budget used"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(budgetUsedPercentage, 100)}
            >
              <div
                className={`h-full rounded-full transition-all ${
                  budgetUsedPercentage >= 100
                    ? "bg-red-500"
                    : budgetUsedPercentage >= 80
                    ? "bg-amber-500"
                    : "bg-green-600"
                }`}
                style={{ width: `${budgetProgress}%` }}
              />
            </div>

            <p className="mt-3 text-xs text-gray-400">
              {budgetUsedPercentage >= 100
                ? "You've reached or exceeded your monthly budget."
                : budgetUsedPercentage >= 80
                ? "You're approaching your monthly budget."
                : "You're within your monthly budget."}
            </p>
          </div>
        </div>


        {/* Monthly Overview */}
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-950">
                Monthly overview
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Your spending activity for {formatMonth(selectedMonth)}.
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 px-4 py-2">
              <span className="text-sm font-semibold text-gray-900">
                {monthlyExpenses.length}
              </span>

              <span className="ml-1 text-sm text-gray-500">
                expenses
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Total Paid
              </p>

              <p className="mt-2 text-xl font-bold text-gray-950">
                {formatMoney(totalPaid)}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                My Share
              </p>

              <p className="mt-2 text-xl font-bold text-gray-950">
                {formatMoney(myShare)}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Average Expense
              </p>

              <p className="mt-2 text-xl font-bold text-gray-950">
                {formatMoney(
                  monthlyExpenses.length > 0
                    ? myShare / monthlyExpenses.length
                    : 0
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Analytics Grid */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Spending by Category */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-gray-950">
                Spending by category
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Where your money is going.
              </p>
            </div>

            <div className="mt-6 space-y-5">
              {categoryTotals.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No expenses for this month.
                </p>
              ) : (
                categoryTotals.map(([category, amount]) => {
                  const percentage =
                    myShare > 0 ? (amount / myShare) * 100 : 0;

                  return (
                    <div key={category}>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          {category}
                        </span>

                        <div className="text-right">
                          <span className="text-sm font-semibold text-gray-950">
                            {formatMoney(amount)}
                          </span>

                          <span className="ml-2 text-xs text-gray-400">
                            {percentage.toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-gray-900 transition-all"
                          style={{
                            width: `${Math.min(percentage, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Needs vs Wants */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-gray-950">
                Needs vs wants
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                See how your spending is distributed.
              </p>
            </div>

            <div className="mt-8">
              <div className="flex h-4 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="bg-gray-900 transition-all"
                  style={{
                    width: `${
                      myShare > 0
                        ? Math.min((needs / myShare) * 100, 100)
                        : 0
                    }%`,
                  }}
                />

                <div
                  className="bg-gray-300 transition-all"
                  style={{
                    width: `${
                      myShare > 0
                        ? Math.min((wants / myShare) * 100, 100)
                        : 0
                    }%`,
                  }}
                />
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-gray-900" />

                    <span className="text-sm font-medium text-gray-600">
                      Needs
                    </span>
                  </div>

                  <p className="mt-3 text-2xl font-bold text-gray-950">
                    {formatMoney(needs)}
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    {myShare > 0
                      ? `${((needs / myShare) * 100).toFixed(1)}% of share`
                      : "0% of share"}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />

                    <span className="text-sm font-medium text-gray-600">
                      Wants
                    </span>
                  </div>

                  <p className="mt-3 text-2xl font-bold text-gray-950">
                    {formatMoney(wants)}
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    {myShare > 0
                      ? `${((wants / myShare) * 100).toFixed(1)}% of share`
                      : "0% of share"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-gray-950">
                Payment methods
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                How you paid this month.
              </p>
            </div>

            <div className="mt-6 space-y-5">
              {paymentTotals.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No payment data for this month.
                </p>
              ) : (
                paymentTotals.map(([method, amount]) => {
                  const percentage =
                    myShare > 0 ? (amount / myShare) * 100 : 0;

                  return (
                    <div key={method}>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                          {method}
                        </span>

                        <div>
                          <span className="text-sm font-semibold text-gray-950">
                            {formatMoney(amount)}
                          </span>

                          <span className="ml-2 text-xs text-gray-400">
                            {percentage.toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-gray-700"
                          style={{
                            width: `${Math.min(percentage, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Monthly Trend */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-gray-950">
                Monthly spending
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Your spending trend over the last six months.
              </p>
            </div>

            <div className="mt-8">
              {monthlyTotals.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No spending data available.
                </p>
              ) : (
                <div className="flex h-56 items-end gap-3 sm:gap-5">
                  {monthlyTotals.map(([month, amount]) => {
                    const height =
                      Math.max(
                        (amount / maxMonthlyAmount) * 100,
                        amount > 0 ? 8 : 0
                      );

                    const isSelected = month === selectedMonth;

                    return (
                      <button
                        key={month}
                        type="button"
                        onClick={() => setSelectedMonth(month)}
                        className="group flex h-full flex-1 flex-col justify-end outline-none"
                      >
                        <div className="mb-2 text-center text-xs font-medium text-gray-500 opacity-0 transition group-hover:opacity-100">
                          {formatMoney(amount)}
                        </div>

                        <div
                          className={`mx-auto w-full max-w-10 rounded-t-lg transition-all ${
                            isSelected
                              ? "bg-gray-950"
                              : "bg-gray-200 group-hover:bg-gray-400"
                          }`}
                          style={{
                            height: `${height}%`,
                          }}
                        />

                        <span
                          className={`mt-3 text-xs ${
                            isSelected
                              ? "font-semibold text-gray-950"
                              : "text-gray-400"
                          }`}
                        >
                          {new Date(
                            Number(month.split("-")[0]),
                            Number(month.split("-")[1]) - 1,
                            1
                          ).toLocaleDateString("en-US", {
                            month: "short",
                          })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-950 p-6 text-white shadow-sm sm:flex sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Keep your expenses up to date
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              Add your latest expense to keep your dashboard accurate.
            </p>
          </div>

          <a
            href="/"
            className="mt-4 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-950 transition hover:bg-gray-100 sm:mt-0"
          >
            Add Expense
          </a>
        </div>
      </div>
    </main>
  );
}