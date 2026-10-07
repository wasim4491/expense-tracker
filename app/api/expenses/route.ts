import { NextResponse } from "next/server";

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL!;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { error: result },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: result,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to process expense" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "GET",
      cache: "no-store",
    });

    const result = await response.json();

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to fetch expenses" },
      { status: 500 }
    );
  }
}