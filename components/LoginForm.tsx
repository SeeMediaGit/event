"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, Phone } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { SeeMediaLogo } from "./Brand";

// Only same-site paths are followed after login. "//evil.example" and
// "https://evil.example" are both valid values for a query parameter and both
// would send a freshly signed-in user off this origin, so anything that is not
// a single leading slash is dropped on the floor.
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

// Login only. No signup and no password reset by design — accounts are created
// in the SeeMedia mobile app, and this site just authenticates against them.
export default function LoginForm() {
  const { signInPhone, session } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // `next` is what the challenge flow sends (/login?next=/challenge/x?step=2);
  // `redirect` is what AuthGuard has always sent and what any existing
  // bookmark still carries. Both are honoured, and both are checked for shape
  // before use — an open redirect starts with trusting a query string.
  const redirectTo = safeNext(
    searchParams.get("next") ?? searchParams.get("redirect"),
  );

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Someone who is already signed in should never sit on the login screen —
  // e.g. they hit /login from a bookmark, or AuthGuard raced the session load.
  useEffect(() => {
    if (session) router.replace(redirectTo);
  }, [session, router, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phone.trim() || !password) {
      setError("Утасны дугаар болон нууц үгээ оруулна уу.");
      return;
    }
    setLoading(true);
    const result = await signInPhone(phone, password);
    setLoading(false);
    if (result.success) {
      router.replace(redirectTo);
    } else {
      setError(
        result.errorMessage?.includes("Invalid login")
          ? "Утас эсвэл нууц үг буруу байна."
          : result.errorMessage || "Нэвтрэхэд алдаа гарлаа.",
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-24">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <SeeMediaLogo size={56} />
          <h1 className="mt-4 text-2xl font-black text-white">
            SeeMedia Events
          </h1>
          <p className="mt-1 text-sm text-muted">
            Уралдаан тэмцээнээ үзэхийн тулд нэвтэрнэ үү
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/8 bg-ink-surface/80 p-6 backdrop-blur-xl"
        >
          <label
            htmlFor="phone"
            className="mb-1.5 block text-xs font-semibold text-white/70"
          >
            Утасны дугаар
          </label>
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-ink px-3 focus-within:border-brand/50">
            <Phone size={16} className="text-muted" />
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="99112233"
              autoComplete="tel"
              className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/30"
            />
          </div>

          <label
            htmlFor="password"
            className="mb-1.5 block text-xs font-semibold text-white/70"
          >
            Нууц үг
          </label>
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-white/10 bg-ink px-3 focus-within:border-brand/50">
            <Lock size={16} className="text-muted" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/30"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-muted transition hover:text-white"
              aria-label={showPassword ? "Нууц үг нуух" : "Нууц үг харах"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-sm font-bold text-black shadow-glow transition hover:bg-brand-light disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? "Нэвтэрч байна…" : "Нэвтрэх"}
          </button>

          <p className="mt-5 text-center text-xs text-muted">
            Аккаунтгүй юу? SeeMedia аппликейшнээр бүртгүүлээрэй.
          </p>
        </form>
      </div>
    </div>
  );
}
