import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import ChallengeShell from "@/components/challenge/ChallengeShell";

// Deliberately outside the (app) route group, so AuthGuard does not run: the
// intro step is the public face of the competition and has to render for
// someone who has not signed in yet. Everything past step 1 is gated by the
// shell, and — the part that actually matters — by RLS.
//
// The shell reads ?step= through useSearchParams, which forces a Suspense
// boundary for the prerender, the same as app/login/page.tsx.
export default async function ChallengePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 size={28} className="animate-spin text-brand" />
        </div>
      }
    >
      <ChallengeShell slug={slug} />
    </Suspense>
  );
}
