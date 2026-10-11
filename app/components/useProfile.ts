"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export function useProfile() {
  const [displayName, setDisplayName] = useState("Account");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const supabase = createClient();

    const applyUser = (user: User | null) => {
      if (!user) {
        setDisplayName("Account");
        setEmail("");
        return;
      }

      const metadataName = user.user_metadata?.full_name || user.user_metadata?.name;
      setDisplayName(
        typeof metadataName === "string" && metadataName.trim()
          ? metadataName.trim()
          : user.email?.split("@")[0] || "Account"
      );
      setEmail(user.email || "");
    };

    const loadProfile = async () => {
      const { data } = await supabase.auth.getUser();
      applyUser(data.user);
    };

    void loadProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  return { displayName, email };
}
