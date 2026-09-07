"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// Trimmed down from landing/components/watch/AuthProvider.tsx: the events site
// has no paywall, so everything about subscriptions, purchases and banner
// entitlement is gone. All we need is "who is this" — signing in at all is the
// only gate.
export type AppUser = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  phone: string | null;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  appUser: AppUser | null;
  isLoading: boolean;
  signInPhone: (
    phone: string,
    password: string,
  ) => Promise<{ success: boolean; errorMessage?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Normalize a Mongolian phone number to E.164 (+976XXXXXXXX).
// Accepts "+97699112233", "97699112233", "99112233", with spaces/dashes.
//
// Kept byte-for-byte identical to landing's version on purpose: accounts are
// created by the mobile app, and if the two sites normalized differently the
// same typed number would hash to a different auth identity on one of them.
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("+")) return trimmed.replace(/[\s-]/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 8) return `${digits}`;
  if (digits.startsWith("976")) return `+${digits}`;
  return `+${digits}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(
    async (currentUser: User | null) => {
      if (!currentUser) {
        setAppUser(null);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, phone")
        .eq("id", currentUser.id)
        .maybeSingle();

      setAppUser((profile as AppUser) ?? null);
    },
    [supabase],
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      loadProfile(data.session?.user ?? null).finally(() => {
        if (mounted) setIsLoading(false);
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        loadProfile(newSession?.user ?? null);
      },
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, loadProfile]);

  const signInPhone = useCallback(
    async (phone: string, password: string) => {
      const normalized = normalizePhone(phone);
      const { error } = await supabase.auth.signInWithPassword({
        phone: normalized,
        password,
      });
      if (error) {
        return { success: false, errorMessage: error.message };
      }
      return { success: true };
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setAppUser(null);
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{ session, user, appUser, isLoading, signInPhone, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
