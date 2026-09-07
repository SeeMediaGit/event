"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LogOut, Trophy } from "lucide-react";
import { useAuth } from "./AuthProvider";

// The dashboard rail shared by the challenge flow — the same shape as
// admin.seemedia.mn and content-creator.seemedia.mn: a narrow icon rail on the
// left from `lg` up, and the identical set of destinations as a bottom tab bar
// on a phone, where a left rail would eat a third of the screen.
//
// Nothing new in the palette: ink surfaces, brand green for the active item.

type NavItem = {
  href: string;
  label: string;
  icon: typeof Trophy;
  // Active for the exact path only, or for everything beneath it.
  exact?: boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "Уралдаанууд", icon: Trophy, exact: true },
  { href: "/applications", label: "Миний өргөдөл", icon: FileText },
];

function isActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export default function AppSidebar() {
  const pathname = usePathname() || "/";
  const { session, signOut } = useAuth();

  // A signed-out visitor is here for the intro step only; "Миний өргөдөл" and
  // "Гарах" would both dead-end at the login screen, so the rail shows just the
  // one destination that works.
  const items = session ? NAV : NAV.slice(0, 1);

  return (
    <>
      {/* Desktop rail */}
      <nav
        aria-label="Үндсэн цэс"
        className="fixed inset-y-0 left-0 z-40 hidden w-[88px] flex-col items-center gap-1 border-r border-white/8 bg-ink-surface/80 px-1.5 py-4 backdrop-blur-xl lg:flex"
      >
        {items.map((item) => (
          <RailLink
            key={item.href}
            item={item}
            active={isActive(pathname, item)}
          />
        ))}

        {session && (
          // pb-10 keeps the button clear of the Next dev-tools bubble, which
          // parks itself in the bottom-left corner during development.
          <div className="mt-auto w-full border-t border-white/8 pb-10 pt-2">
            <button
              onClick={signOut}
              className={`${RAIL_ITEM} w-full text-white/50 hover:bg-white/5 hover:text-white`}
            >
              <LogOut size={19} />
              <span className={RAIL_LABEL}>Гарах</span>
            </button>
          </div>
        )}
      </nav>

      {/* Mobile tab bar */}
      <nav
        aria-label="Үндсэн цэс"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/8 bg-ink-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {items.map((item) => (
          <TabLink
            key={item.href}
            item={item}
            active={isActive(pathname, item)}
          />
        ))}
        {session && (
          <button
            onClick={signOut}
            className="flex flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-semibold leading-[1.15] text-white/50 transition active:text-white"
          >
            <LogOut size={19} className="shrink-0" />
            <span className="block w-full break-words text-center">Гарах</span>
          </button>
        )}
      </nav>
    </>
  );
}

// Mongolian nav labels are long — "Уралдаанууд" is one unbreakable 11-character
// word — so the rail is sized to the text rather than the icon, and the label
// itself may wrap to two lines. min-h keeps a one-line item and a two-line item
// the same height so the rail does not look ragged.
const RAIL_ITEM =
  "flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-[10px] font-semibold leading-[1.15] transition";

const RAIL_LABEL = "block w-full break-words hyphens-auto";

function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`${RAIL_ITEM} w-full ${
        active
          ? "bg-brand/15 text-brand-light"
          : "text-white/50 hover:bg-white/5 hover:text-white"
      }`}
    >
      <Icon size={19} className="shrink-0" />
      <span className={RAIL_LABEL}>{item.label}</span>
    </Link>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex flex-1 flex-col items-center gap-1 px-1 py-2.5 text-center text-[10px] font-semibold leading-[1.15] transition ${
        active ? "text-brand-light" : "text-white/50 active:text-white"
      }`}
    >
      <Icon size={19} className="shrink-0" />
      <span className="block w-full break-words">{item.label}</span>
    </Link>
  );
}
