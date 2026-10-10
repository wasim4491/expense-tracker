
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/expenses") ||
    pathname.startsWith("/add-expense");

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup");

  const supabase = await import("@/lib/supabase/server");
  const client = await supabase.createClient();
  const { data, error } = await client.auth.getClaims();
  const claims = error ? null : data?.claims ?? null;

  if (isProtectedRoute && !claims) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthRoute && claims) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
