"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "./AuthProvider";

// Client-side gate. Note what this is and is not:
//
// It is a UX gate — it keeps a signed-out visitor from staring at an empty page
// and sends them to /login instead. It is NOT the security boundary. The real
// boundary is the RLS policy on public.events, which only answers to the
// `authenticated` role; a visitor who deletes this component from the bundle
// still gets an empty array back from PostgREST.
export default function AuthGuard({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading || session) return;
    const next = encodeURIComponent(pathname || "/");
    router.replace(`/login?next=${next}`);
  }, [isLoading, session, router, pathname]);

  if (isLoading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={28} className="animate-spin text-brand" />
      </div>
    );
  }

  return <>{children}</>;
}
