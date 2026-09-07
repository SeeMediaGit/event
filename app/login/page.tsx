import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import LoginForm from "@/components/LoginForm";

// useSearchParams (for ?redirect=) forces a Suspense boundary during the
// static prerender of this route.
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 size={28} className="animate-spin text-brand" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
