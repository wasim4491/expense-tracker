"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [date, setDate] = useState(() => {
    const today = new Date();

    return `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Food");
  const [type, setType] = useState("Need");
  const [paymentMethod, setPaymentMethod] = useState("Credit Card");
  const [notes, setNotes] = useState("");

  const [split, setSplit] = useState("No");
  const [people, setPeople] = useState("2");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const myShare =
    split === "Yes" && Number(people) > 0
      ? Number(amount || 0) / Number(people)
      : Number(amount || 0);

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
      } finally {
        setIsLoading(false);
      }
    };

    fetchExpenses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date,
          amount: Number(amount),
          description,
          category,
          type,
          paymentMethod,
          notes,
          split,
          people: split === "Yes" ? Number(people) : 1,
          myShare: Number(myShare.toFixed(2)),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to add expense");
      }

      alert("Expense added!");

      const today = new Date();

      setDate(
        `${today.getFullYear()}-${String(
          today.getMonth() + 1
        ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
      );

      setAmount("");
      setDescription("");
      setCategory("Food");
      setType("Need");
      setPaymentMethod("Credit Card");
      setNotes("");
      setSplit("No");
      setPeople("2");

      const expensesResponse = await fetch("/api/expenses");

      if (expensesResponse.ok) {
        const data = await expensesResponse.json();
        setExpenses(data);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to add expense");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f8fa] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">

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
              className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white"
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
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Dashboard
            </a>
          </div>
        </nav>

        {/* Page Header */}
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-gray-500">
            Record a transaction
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            Add Expense
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Keep track of where your money actually goes.
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">

          {/* Form */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-950">
                Expense details
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Enter the details of your transaction.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Date + Amount */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                {/* Date */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Date
                  </label>

                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="block w-full min-w-0 max-w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                    required
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Amount
                  </label>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-gray-400">
                      $
                    </span>

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-9 pr-4 text-lg font-semibold text-gray-950 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:bg-white"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Description
                </label>

                <input
                  type="text"
                  placeholder="e.g. Chicken and rice"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:bg-white"
                  required
                />
              </div>

              {/* Category / Type / Payment */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">

                {/* Category */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Category
                  </label>

                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                  >
                    <option>Food</option>
                    <option>Rent & Bills</option>
                    <option>Transportation</option>
                    <option>Health & Fitness</option>
                    <option>Entertainment</option>
                    <option>Shopping</option>
                    <option>Career</option>
                    <option>Travel</option>
                    <option>Family</option>
                    <option>Other</option>
                  </select>
                </div>

                {/* Type */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Type
                  </label>

                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                  >
                    <option>Need</option>
                    <option>Want</option>
                    <option>Impulse</option>
                    <option>Worth It</option>
                  </select>
                </div>

                {/* Payment */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Payment
                  </label>

                  <select
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                  >
                    <option>Credit Card</option>
                    <option>Debit Card</option>
                    <option>Cash</option>
                    <option>Bank Transfer</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              {/* Split Section */}
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

                  <div>
                    <h3 className="text-sm font-semibold text-gray-950">
                      Split this expense?
                    </h3>

                    <p className="mt-1 text-xs text-gray-500">
                      Divide the expense equally between everyone.
                    </p>
                  </div>

                  <div className="sm:w-40">
                    <select
                      value={split}
                      onChange={(e) => setSplit(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400"
                    >
                      <option>No</option>
                      <option>Yes</option>
                    </select>
                  </div>
                </div>

                {split === "Yes" && (
                  <div className="mt-5 border-t border-gray-200 pt-5">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Number of People
                        </label>

                        <input
                          type="number"
                          min="2"
                          step="1"
                          value={people}
                          onChange={(e) =>
                            setPeople(e.target.value)
                          }
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400"
                          required
                        />
                      </div>

                      <div className="rounded-xl bg-white p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                          Your share
                        </p>

                        <p className="mt-1 text-2xl font-bold text-gray-950">
                          ${myShare.toFixed(2)}
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          ${Number(amount || 0).toFixed(2)} ÷{" "}
                          {people || 0} people
                        </p>
                      </div>

                    </div>
                  </div>
                )}

                {split !== "Yes" && (
                  <div className="mt-4 rounded-xl bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        Your share
                      </span>

                      <span className="text-lg font-bold text-gray-950">
                        ${myShare.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Notes
                </label>

                <textarea
                  placeholder="Optional notes about this expense..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:bg-white"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-gray-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Adding Expense..." : "Add Expense"}
              </button>
            </form>
          </div>

          {/* Right Side */}
          <div className="space-y-6">

            {/* Current Expense Preview */}
            <div className="rounded-2xl border border-gray-200 bg-gray-950 p-6 text-white shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Expense preview
              </p>

              <p className="mt-5 truncate text-lg font-semibold">
                {description || "Your expense"}
              </p>

              <p className="mt-2 text-4xl font-bold tracking-tight">
                ${Number(amount || 0).toFixed(2)}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-200">
                  {category}
                </span>

                <span className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-200">
                  {type}
                </span>

                <span className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-200">
                  {paymentMethod}
                </span>
              </div>

              <div className="mt-6 border-t border-white/10 pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">
                    My Share
                  </span>

                  <span className="font-semibold">
                    ${myShare.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Info */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-950">
                Quick tips
              </h2>

              <div className="mt-5 space-y-4">
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-semibold text-gray-600">
                    1
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Add expenses regularly
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Keeping transactions updated makes your dashboard more useful.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-semibold text-gray-600">
                    2
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Use accurate categories
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Categories help you understand where most of your money goes.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-semibold text-gray-600">
                    3
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Split shared expenses
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Your dashboard will use your share instead of the full amount.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Expenses */}
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-950">
                Recent expenses
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Your latest transactions.
              </p>
            </div>

            <a
              href="/expenses"
              className="text-sm font-semibold text-gray-700 hover:text-gray-950"
            >
              View all →
            </a>
          </div>

          <div className="mt-6">
            {isLoading ? (
              <p className="text-sm text-gray-500">
                Loading expenses...
              </p>
            ) : expenses.length === 0 ? (
              <div className="rounded-xl bg-gray-50 px-5 py-10 text-center">
                <p className="text-sm font-medium text-gray-700">
                  No expenses yet.
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Your recent transactions will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {expenses
                  .slice()
                  .reverse()
                  .slice(0, 10)
                  .map((expense, index) => (
                    <div
                      key={index}
                      className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-gray-950">
                            {expense.Description}
                          </p>

                          <span className="rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-500">
                            {expense.Category}
                          </span>

                          <span className="rounded-md bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-500">
                            {expense.Type}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-gray-400">
                          {new Date(expense.Date).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}{" "}
                          · {expense["Payment Method"]}
                        </p>
                      </div>

                      <div className="shrink-0 sm:text-right">
                        <p className="text-sm font-bold text-gray-950">
                          ${Number(expense.Amount).toFixed(2)}
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          My share: $
                          {Number(
                            expense["My Share"] ||
                              expense.Amount ||
                              0
                          ).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}