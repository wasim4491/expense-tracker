
"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50 hover:text-gray-950"
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        className="h-4 w-4 text-gray-400"
        aria-hidden="true"
      >
        <path
          d="M8 3.5H4.5v13H8M11.5 6l4 4-4 4M6.5 10h9"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Sign out
    </button>
  );
}
