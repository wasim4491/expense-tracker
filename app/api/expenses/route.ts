
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL!;
const EXPENSE_API_SECRET = process.env.EXPENSE_API_SECRET!;

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    return null;
  }

  return data.claims.sub;
}


async function callGoogleScript(payload: Record<string, unknown>) {
  const start = Date.now();

  console.log(`[Expense API] Google Script started: ${payload.action || "getExpenses"}`);

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        secret: EXPENSE_API_SECRET,
      }),
      cache: "no-store",
    });

    console.log(
      `[Expense API] Google Script response headers: ${Date.now() - start} ms`
    );

    const result = await response.text();

    console.log(
      `[Expense API] Google Script response body: ${Date.now() - start} ms`
    );

    if (!response.ok || result.startsWith("ERROR:")) {
      throw new Error(result || "Google Apps Script request failed");
    }

    try {
      return JSON.parse(result);
    } catch {
      return result;
    }
  } finally {
    console.log(
      `[Expense API] Google Script total time: ${Date.now() - start} ms`
    );
  }
}



export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const result = await callGoogleScript({
      ...body,
      userId,
    });

    return NextResponse.json({
      success: true,
      message: result,
    });
  } catch (error) {
    console.error("Expense POST error:", error);

    return NextResponse.json(
      { error: "Failed to process expense" },
      { status: 500 }
    );
  }
}


export async function GET(request: Request) {
  try {
    const userId = await getAuthenticatedUser();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const requestUrl = new URL(request.url);
    const action = requestUrl.searchParams.get("action");

    const result = await callGoogleScript({
      action:
        action === "getBudget"
          ? "getBudget"
          : action === "getDashboard"
          ? "getDashboard"
          : "getExpenses",
      userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Expense GET error:", error);

    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}

