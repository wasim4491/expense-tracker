import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxAmount = 1_000_000_000;

type Direction = "receive" | "owe";
type EntryStatus = "pending" | "settled";

type EntryInput = {
  person_name: string;
  amount: number;
  direction: Direction;
  entry_date: string;
  notes: string | null;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

function databaseErrorMessage(error: { code?: string } | null, operation: "load" | "save" | "update" | "delete") {
  if (error?.code === "42P01" || error?.code === "PGRST205") {
    return "The Money Tracker table is missing or not available yet. Run the money_entries migration in Supabase, then retry.";
  }
  if (error?.code === "42501") {
    return "Supabase blocked this change. Check the money_entries grants and authenticated-user Row Level Security policies.";
  }
  if (["23502", "23514", "22P02", "42703"].includes(error?.code ?? "")) {
    return "The database rejected these fields. Confirm the latest money_entries migration was applied.";
  }

  const messages = {
    load: "Unable to load money entries. Please try again.",
    save: "The entry couldn't be saved. Please try again.",
    update: "The entry couldn't be updated. Please try again.",
    delete: "The entry couldn't be deleted. Please try again.",
  };
  return messages[operation];
}

async function getAuthenticatedContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || typeof userId !== "string") return null;
  return { supabase, userId };
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function buildEntryInput(body: Record<string, unknown>): EntryInput | string {
  const personName = typeof body.person_name === "string" ? body.person_name.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  const roundedAmount = Number((Math.round((amount + Number.EPSILON) * 100) / 100).toFixed(2));
  const direction = body.direction;
  const entryDate = body.entry_date;

  if (!personName || personName.length > 120) return "Enter a person or group name (up to 120 characters).";
  if (!Number.isFinite(amount) || amount <= 0 || amount > maxAmount || roundedAmount <= 0) return "Enter a valid amount of at least $0.01.";
  if (direction !== "receive" && direction !== "owe") return "Choose whether you will receive or owe the money.";
  if (!isValidDate(entryDate)) return "Choose a valid date.";
  if (notes.length > 2000) return "Notes must be 2,000 characters or fewer.";

  return {
    person_name: personName,
    amount: roundedAmount,
    direction,
    entry_date: entryDate,
    notes: notes || null,
  };
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const context = await getAuthenticatedContext();
  if (!context) return jsonError("Please sign in to view money entries.", 401);

  try {
    const { data, error } = await context.supabase
      .from("money_entries")
      .select("id, person_name, amount, direction, description, entry_date, notes, status, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return jsonError(databaseErrorMessage(error, "load"), 500);
    return NextResponse.json({ entries: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError("Unable to load money entries. Please try again.", 500);
  }
}

export async function POST(request: Request) {
  const context = await getAuthenticatedContext();
  if (!context) return jsonError("Please sign in to add a money entry.", 401);

  const body = await readJson(request);
  if (!body) return jsonError("Send valid entry details.", 400);

  const entry = buildEntryInput(body);
  if (typeof entry === "string") return jsonError(entry, 400);

  try {
    const { data, error } = await context.supabase
      .from("money_entries")
      // Keep the existing non-null database field compatible without collecting a description in the form.
      .insert({ ...entry, description: "Money entry", user_id: context.userId, status: "pending" })
      .select("id, person_name, amount, direction, description, entry_date, notes, status, created_at, updated_at")
      .single();

    if (error || !data) return jsonError(databaseErrorMessage(error, "save"), 500);
    return NextResponse.json({ success: true, entry: data }, { status: 201 });
  } catch {
    return jsonError("The entry couldn't be saved. Please try again.", 500);
  }
}

export async function PATCH(request: Request) {
  const context = await getAuthenticatedContext();
  if (!context) return jsonError("Please sign in to update money entries.", 401);

  const body = await readJson(request);
  if (!body) return jsonError("Send valid entry details.", 400);

  const id = typeof body.id === "string" ? body.id : "";
  if (!uuidPattern.test(id)) return jsonError("Choose a valid entry.", 400);

  let update: Partial<EntryInput> & { status?: EntryStatus };
  if (body.action === "settle") {
    update = { status: "settled" };
  } else if (body.action === "update") {
    const entry = buildEntryInput(body);
    if (typeof entry === "string") return jsonError(entry, 400);
    update = entry;
  } else {
    return jsonError("Unsupported action.", 400);
  }

  try {
    const { data, error } = await context.supabase
      .from("money_entries")
      .update(update)
      .eq("id", id)
      .eq("user_id", context.userId)
      .select("id, person_name, amount, direction, description, entry_date, notes, status, created_at, updated_at")
      .maybeSingle();

    if (error) return jsonError(databaseErrorMessage(error, "update"), 500);
    if (!data) return jsonError("Money entry not found.", 404);
    return NextResponse.json({ success: true, entry: data });
  } catch {
    return jsonError("The entry couldn't be updated. Please try again.", 500);
  }
}

export async function DELETE(request: Request) {
  const context = await getAuthenticatedContext();
  if (!context) return jsonError("Please sign in to delete money entries.", 401);

  const body = await readJson(request);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!uuidPattern.test(id)) return jsonError("Choose a valid entry.", 400);

  try {
    const { data, error } = await context.supabase
      .from("money_entries")
      .delete()
      .eq("id", id)
      .eq("user_id", context.userId)
      .select("id")
      .maybeSingle();

    if (error) return jsonError(databaseErrorMessage(error, "delete"), 500);
    if (!data) return jsonError("Money entry not found.", 404);
    return NextResponse.json({ success: true });
  } catch {
    return jsonError("The entry couldn't be deleted. Please try again.", 500);
  }
}
