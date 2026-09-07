import AppSidebar from "@/components/AppSidebar";
import AuthGuard from "@/components/AuthGuard";
import Navbar from "@/components/Navbar";

// Route group: every page inside (app) is behind the login gate and gets the
// app shell — the same rail-and-top-bar dashboard the challenge flow uses, so
// the two do not feel like two different sites. /login and /challenge/[slug]
// sit outside it: the first renders bare, the second brings its own shell
// because its intro step must work signed out.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen lg:pl-[88px]">
        <AppSidebar />
        <Navbar />
        {/* pb-28 clears the mobile tab bar; lg drops back to normal spacing. */}
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-10 sm:px-6 sm:pt-14 lg:pb-14">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
