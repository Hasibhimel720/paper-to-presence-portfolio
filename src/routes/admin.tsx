import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin Login | Portfolio" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminLogin,
});

type SupabaseClient = typeof import("@/lib/supabase").supabase;

function AdminLogin() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    import("@/lib/supabase")
      .then(({ supabase }) => {
        if (!active) return;

        setClient(supabase);

        supabase.auth.getSession().then(({ data, error }) => {
          if (!active) return;

          const session = data.session;
          const authorized =
            !error && !!session && session.user.id === import.meta.env.VITE_SUPABASE_ADMIN_UID;

          setHasSession(!error && !!session);
          setSignedIn(authorized);
          setIsAdmin(authorized);
          setChecking(false);
        });

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!active) return;

          const authorized =
            !!session && session.user.id === import.meta.env.VITE_SUPABASE_ADMIN_UID;

          setHasSession(!!session);
          setSignedIn(authorized);
          setIsAdmin(authorized);
        });
        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch(() => {
        if (active) {
          setMessage("Unable to initialize authentication. Check your local configuration.");
          setChecking(false);
        }
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;

    setLoading(true);
    setMessage("");

    try {
      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage("Sign-in failed. Check your email and password.");
      } else {
        setPassword("");
        setMessage("Signed in successfully. Authentication is working.");
      }
    } catch {
      setMessage("Unable to sign in. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    if (!client) return;

    setLoading(true);
    setMessage("");

    try {
      const { error } = await client.auth.signOut();

      if (error) {
        setMessage("Sign-out failed. Please try again.");
      } else {
        setSignedIn(false);
        setMessage("You have signed out.");
      }
    } catch {
      setMessage("Unable to sign out. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const getAccessToken = useCallback(async () => {
    if (!client) throw new Error("Authentication is not ready. Sign in again.");
    const { data, error } = await client.auth.getSession();
    if (error || !data.session?.access_token) {
      throw new Error("Your administrator session has expired. Sign in again.");
    }
    return data.session.access_token;
  }, [client]);

  if (isAdmin) {
    return (
      <AdminShell onSignOut={handleSignOut} signingOut={loading} getAccessToken={getAccessToken} />
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-md">
        <a
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to portfolio
        </a>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
          <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-background">
            {signedIn ? <ShieldCheck className="h-6 w-6" /> : <LockKeyhole className="h-6 w-6" />}
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Portfolio management
          </p>

          <h1 className="text-3xl font-semibold tracking-tight">
            {checking ? "Checking session" : hasSession ? "Access denied" : "Admin sign in"}
          </h1>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {checking
              ? "Checking your existing authentication session."
              : hasSession
                ? "This account is not authorized to manage this portfolio."
                : "Sign in with your administrator account to continue."}
          </p>

          {checking ? (
            <div className="mt-8 flex items-center gap-3 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Checking authentication…
            </div>
          ) : hasSession ? (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={loading}
              className="mt-8 inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              {loading ? "Signing out…" : "Sign out"}
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label htmlFor="admin-email" className="text-sm font-medium">
                  Email address
                </label>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="admin-password" className="text-sm font-medium">
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !client}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          )}

          {message && (
            <p role="status" aria-live="polite" className="mt-5 text-sm leading-6">
              {message}
            </p>
          )}

          <p className="mt-7 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
            Restricted area. Access to portfolio data is controlled separately by database and
            storage permissions.
          </p>
        </section>
      </div>
    </main>
  );
}
