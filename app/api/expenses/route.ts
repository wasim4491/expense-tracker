
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getAuthenticatedContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || typeof userId !== "string") {
    return null;
  }

  return { supabase, userId };
}

function toExpenseResponse(row: any) {
  return {
    ID: row.id,
    Date: row.date,
    Amount: Number(row.amount ?? 0),
    Description: row.description ?? "",
    Category: row.category ?? "Other",
    Type: row.type ?? "Need",
    "Payment Method": row.payment_method ?? "",
    Notes: row.notes ?? "",
    Split: row.split ?? "No",
    People: row.people == null ? 0 : Number(row.people),
    "My Share":
      row.my_share == null ? Number(row.amount ?? 0) : Number(row.my_share),
  };
}

async function getExpenses(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map(toExpenseResponse);
}

async function getBudget(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("budgets")
    .select("monthly_budget")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return Number(data?.monthly_budget ?? 2500);
}

function buildExpenseInput(body: any, includePaymentMethod = true) {
  const date = String(body.date ?? "").substring(0, 10);
  const amount = Number(body.amount);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    throw new Error("Enter a valid expense date and amount.");
  }

  const people =
    body.people === "" || body.people == null
      ? null
      : Number(body.people);

  const myShare =
    body.myShare === "" || body.myShare == null
      ? null
      : Number(body.myShare);

  if (
    (people !== null && (!Number.isInteger(people) || people < 1)) ||
    (myShare !== null && (!Number.isFinite(myShare) || myShare < 0))
  ) {
    throw new Error("Invalid split or share amount.");
  }

  return {
    date,
    amount,
    description: String(body.description ?? ""),
    category: String(body.category || "Other"),
    type: String(body.type || "Need"),
    ...(includePaymentMethod
      ? { payment_method: String(body.paymentMethod ?? "") }
      : {}),
    notes: String(body.notes ?? ""),
    split: String(body.split || "No"),
    people,
    my_share: myShare,
  };
}

export async function GET(request: Request) {
  try {
    const context = await getAuthenticatedContext();

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { supabase, userId } = context;
    const action = new URL(request.url).searchParams.get("action");

    if (action === "getBudget") {
      return NextResponse.json({
        budget: await getBudget(supabase, userId),
      });
    }

    if (action === "getDashboard") {
      const [expenses, budget] = await Promise.all([
        getExpenses(supabase, userId),
        getBudget(supabase, userId),
      ]);

      return NextResponse.json({ expenses, budget });
    }

    return NextResponse.json(await getExpenses(supabase, userId));
  } catch (error) {
    console.error("Expense GET error:", error);

    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await getAuthenticatedContext();

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { supabase, userId } = context;
    const body = await request.json();
    const action = String(body.action ?? "add");

    if (action === "updateBudget") {
      const budget = Number(body.budget);

      if (
        body.budget === "" ||
        body.budget == null ||
        !Number.isFinite(budget) ||
        budget < 0
      ) {
        return NextResponse.json(
          { success: false, error: "Enter a valid budget amount." },
          { status: 400 }
        );
      }

      const { error } = await supabase.from("budgets").upsert(
        {
          user_id: userId,
          monthly_budget: budget,
        },
        { onConflict: "user_id" }
      );

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: "Monthly budget updated successfully",
      });
    }

    if (action === "delete") {
      if (!body.id) {
        return NextResponse.json(
          { success: false, error: "Missing expense ID." },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", body.id)
        .eq("user_id", userId)
        .select("id");

      if (error) throw error;

      if (!data?.length) {
        return NextResponse.json(
          { success: false, error: "Expense not found." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Expense deleted successfully",
      });
    }

    if (action === "update") {
      if (!body.id) {
        return NextResponse.json(
          { success: false, error: "Missing expense ID." },
          { status: 400 }
        );
      }

      // Older records keep their stored payment method when the UI omits it.
      const expense = buildExpenseInput(
        body,
        Object.prototype.hasOwnProperty.call(body, "paymentMethod")
      );

      const { data, error } = await supabase
        .from("expenses")
        .update(expense)
        .eq("id", body.id)
        .eq("user_id", userId)
        .select("id");

      if (error) throw error;

      if (!data?.length) {
        return NextResponse.json(
          { success: false, error: "Expense not found." },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Expense updated successfully",
      });
    }

    if (action !== "add") {
      return NextResponse.json(
        { success: false, error: "Unsupported action." },
        { status: 400 }
      );
    }

    const expense = buildExpenseInput(body);

    const { error } = await supabase.from("expenses").insert({
      ...expense,
      user_id: userId,
    });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Expense added successfully",
    });
  } catch (error) {
    console.error("Expense API error:", error);

    if (
      error instanceof Error &&
      (error.message.startsWith("Enter a valid") ||
        error.message.startsWith("Invalid split"))
    ) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to process request." },
      { status: 500 }
    );
  }
}
