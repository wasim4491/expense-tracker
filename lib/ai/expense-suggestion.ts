/** Shared option lists used by the manual form and AI expense parser. */
export const expenseCategories = [
  "Food",
  "Rent & Bills",
  "Transportation",
  "Health & Fitness",
  "Entertainment",
  "Shopping",
  "Career",
  "Travel",
  "Family",
  "Other",
] as const;

export const expenseTypes = ["Need", "Want", "Impulse", "Worth It"] as const;

export const paymentMethods = [
  "Credit Card",
  "Debit Card",
  "Cash",
  "Bank Transfer",
  "Other",
] as const;

export type ExpenseCategory = (typeof expenseCategories)[number];
export type ExpenseType = (typeof expenseTypes)[number];
export type PaymentMethod = (typeof paymentMethods)[number];

/**
 * Values extracted from one expense message. Null means the model couldn't
 * identify the value reliably; the server applies only safe optional defaults.
 */
export type AIExpenseInterpretation = {
  date: string | null; // YYYY-MM-DD
  amount: number | null; // dollars
  description: string | null;
  category: ExpenseCategory | null;
  type: ExpenseType | null;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  split: "Yes" | "No" | null;
  people: number | null;
};
