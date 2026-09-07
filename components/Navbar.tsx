"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { SeeMediaLogo } from "./Brand";

// Top bar of the app shell. Signing out is AppSidebar's job now — it is in the
// rail on desktop and the tab bar on a phone — so this no longer carries its
// own Гарах button and the two cannot disagree.
export default function Navbar() {
  const { appUser, user } = useAuth();

  const displayName =
    appUser?.full_name?.trim() ||
    appUser?.username?.trim() ||
    appUser?.phone ||
    user?.phone ||
    "";

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <SeeMediaLogo size={34} />
          <span className="text-sm font-black tracking-tight text-white">
            SeeMedia{" "}
            <span className="font-semibold text-brand">Events</span>
          </span>
        </Link>

        {displayName && (
          <span className="text-xs text-muted">{displayName}</span>
        )}
      </div>
    </header>
  );
}
