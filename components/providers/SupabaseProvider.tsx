"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

const SupabaseContext = createContext<SupabaseClient | undefined>(undefined);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClientComponentClient(), []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      fetch("/auth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event, session }),
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  return <SupabaseContext.Provider value={supabase}>{children}</SupabaseContext.Provider>;
}

export function useSupabase() {
  const context = useContext(SupabaseContext);

  if (!context) {
    throw new Error("useSupabase must be used within a SupabaseProvider");
  }

  return context;
}
