"use client";

import { useEffect, useState } from "react";

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

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        const response = await fetch("/api/expenses");

        if (!response.ok) {
          throw new Error("Failed to fetch expenses");
        }

        const data = await response.json();

        setExpenses(data.reverse());
      } catch (error) {
        console.error("Failed to fetch expenses:", error);
        setError("Unable to load expenses. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchExpenses();
  }, []);

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this expense?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "delete",
          id: id,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to delete expense");
      }

      setExpenses((currentExpenses) =>
        currentExpenses.filter((expense) => expense.ID !== id)
      );
    } catch (error) {
      console.error("Failed to delete expense:", error);
      alert("Failed to delete expense. Please try again.");
    }
  };

  const handleEdit = async (expense: Expense) => {
    const description = window.prompt(
      "Description:",
      expense.Description
    );

    if (description === null) return;

    const amountInput = window.prompt(
      "Amount:",
      String(expense.Amount)
    );

    if (amountInput === null) return;

    const amount = Number(amountInput);

    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update",
          id: expense.ID,
          date: expense.Date.substring(0, 10),
          amount: amount,
          description: description,
          category: expense.Category,
          type: expense.Type,
          paymentMethod: expense["Payment Method"],
          notes: expense.Notes,
          split: expense.Split,
          people: expense.People,
          myShare:
            expense.Split === "Yes" && expense.People
              ? amount / Number(expense.People)
              : amount,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to update expense");
      }

      setExpenses((currentExpenses) =>
        currentExpenses.map((item) =>
          item.ID === expense.ID
            ? {
                ...item,
                Description: description,
                Amount: amount,
                "My Share":
                  expense.Split === "Yes" && expense.People
                    ? amount / Number(expense.People)
                    : amount,
              }
            : item
        )
      );

      alert("Expense updated successfully.");
    } catch (error) {
      console.error("Failed to update expense:", error);
      alert("Failed to update expense. Please try again.");
    }
  };

  const filteredExpenses = expenses.filter((expense) => {
    const searchText = search.toLowerCase();

    const matchesSearch =
      expense.Description?.toLowerCase().includes(searchText) ||
      expense.Category?.toLowerCase().includes(searchText) ||
      expense.Type?.toLowerCase().includes(searchText) ||
      expense["Payment Method"]?.toLowerCase().includes(searchText);

    const matchesCategory =
      categoryFilter === "All" ||
      expense.Category === categoryFilter;

    const matchesType =
      typeFilter === "All" ||
      expense.Type === typeFilter;

    return matchesSearch && matchesCategory && matchesType;
  });

  const formatMoney = (value: number) => `$${value.toFixed(2)}`;

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
              className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white"
            >
              Expenses
            </a>

            <a
              href="/dashboard"
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Dashboard
            </a>
          </div>
        </nav>

        {/* Page Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-gray-500">
              Transaction history
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
              Expenses
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              View and manage everything you've recorded.
            </p>
          </div>

          <a
            href="/"
            className="inline-flex w-fit items-center rounded-xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            + Add Expense
          </a>
        </div>

        {/* Search + Filters */}
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px_180px]">

            {/* Search */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Search
              </label>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Search expenses..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:bg-white"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Category
              </label>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
              >
                <option value="All">All Categories</option>
                <option value="Food">Food</option>
                <option value="Rent & Bills">Rent & Bills</option>
                <option value="Transportation">
                  Transportation
                </option>
                <option value="Health & Fitness">
                  Health & Fitness
                </option>
                <option value="Entertainment">
                  Entertainment
                </option>
                <option value="Shopping">Shopping</option>
                <option value="Career">Career</option>
                <option value="Travel">Travel</option>
                <option value="Family">Family</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Type
              </label>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
              >
                <option value="All">All Types</option>
                <option value="Need">Need</option>
                <option value="Want">Want</option>
                <option value="Impulse">Impulse</option>
                <option value="Worth It">Worth It</option>
              </select>
            </div>
          </div>

          {/* Filter Summary */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-500">
              Showing{" "}
              <span className="font-semibold text-gray-900">
                {filteredExpenses.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-gray-900">
                {expenses.length}
              </span>{" "}
              expenses
            </p>

            {(search ||
              categoryFilter !== "All" ||
              typeFilter !== "All") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("All");
                  setTypeFilter("All");
                }}
                className="text-sm font-medium text-gray-600 hover:text-gray-950"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Expenses Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
            <div className="flex h-64 items-center justify-center">
                <p className="text-sm text-gray-500">
                Loading expenses...
                </p>
            </div>
            ) : error ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                !
                </div>

                <h2 className="mt-4 text-lg font-semibold text-gray-950">
                Something went wrong
                </h2>

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
            ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-xl">
                $
              </div>

              <h2 className="mt-4 text-lg font-semibold text-gray-950">
                No expenses yet
              </h2>

              <p className="mt-1 max-w-sm text-sm text-gray-500">
                Start tracking your spending by adding your first expense.
              </p>

              <a
                href="/"
                className="mt-5 rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Add Expense
              </a>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
                ?
              </div>

              <h2 className="mt-4 text-lg font-semibold text-gray-950">
                No matching expenses
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Try changing your search or filters.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("All");
                  setTypeFilter("All");
                }}
                className="mt-5 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Date
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Description
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Category
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Type
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Payment
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Amount
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                      My Share
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredExpenses.map((expense) => (
                    <tr
                      key={expense.ID}
                      className="border-b border-gray-100 last:border-b-0 transition hover:bg-gray-50/70"
                    >
                      {/* Date */}
                      <td className="whitespace-nowrap px-5 py-5 text-sm text-gray-500">
                        {new Date(expense.Date).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </td>

                      {/* Description */}
                      <td className="px-5 py-5">
                        <div className="font-semibold text-gray-950">
                          {expense.Description}
                        </div>

                        {expense.Split === "Yes" &&
                          expense.People > 1 && (
                            <div className="mt-1 text-xs text-gray-400">
                              Split between {expense.People} people
                            </div>
                          )}
                      </td>

                      {/* Category */}
                      <td className="px-5 py-5">
                        <span className="inline-flex rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                          {expense.Category}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="px-5 py-5">
                        <span
                          className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${
                            expense.Type === "Need"
                              ? "bg-gray-900 text-white"
                              : expense.Type === "Want"
                              ? "bg-gray-100 text-gray-600"
                              : expense.Type === "Impulse"
                              ? "bg-gray-100 text-gray-500"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {expense.Type}
                        </span>
                      </td>

                      {/* Payment */}
                      <td className="px-5 py-5 text-sm text-gray-500">
                        {expense["Payment Method"]}
                      </td>

                      {/* Amount */}
                      <td className="whitespace-nowrap px-5 py-5 text-right">
                        <span className="font-semibold text-gray-950">
                          {formatMoney(Number(expense.Amount))}
                        </span>
                      </td>

                      {/* My Share */}
                      <td className="whitespace-nowrap px-5 py-5 text-right">
                        <span className="font-semibold text-gray-950">
                          {formatMoney(
                            Number(
                              expense["My Share"] ||
                                expense.Amount ||
                                0
                            )
                          )}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap px-5 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(expense)}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(expense.ID)
                            }
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bottom Summary */}
        {!isLoading && expenses.length > 0 && (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-950">
                Expense history
              </p>

              <p className="mt-1 text-xs text-gray-500">
                Your most recent transactions appear first.
              </p>
            </div>

            <a
              href="/"
              className="w-fit rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              + Add Expense
            </a>
          </div>
        )}
      </div>
    </main>
  );
}