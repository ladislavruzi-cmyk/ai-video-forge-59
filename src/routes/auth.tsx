import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Přihlášení — AI Video Forge" },
      {
        name: "description",
        content: "Soukromá aplikace AI Video Forge. Přístup pouze pro autorizovaný účet po přihlášení.",
      },
      { property: "og:title", content: "Přihlášení — AI Video Forge" },
      { property: "og:description", content: "Soukromé AI studio pro tvorbu YouTube videí." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Nesprávný e-mail nebo heslo.";
  if (m.includes("email not confirmed")) return "E-mail účtu ještě není potvrzený.";
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Příliš mnoho pokusů. Zkus to prosím za chvíli znovu.";
  }
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) {
    return "Registrace je zakázaná. Přístup má pouze předem vytvořený účet.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "Nepodařilo se spojit se serverem. Zkontroluj připojení.";
  }
  return "Přihlášení se nepodařilo. Zkontroluj údaje a zkus to znovu.";
}

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) {
      setError(friendlyError(err.message));
      return;
    }
    void navigate({ to: "/", replace: true });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10 text-foreground">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-3 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand/20 text-sm font-bold text-brand ring-1 ring-brand/40">
            AI
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            AI <span className="text-brand">Video</span> Forge
          </h1>
          <p className="text-sm text-muted-foreground">
            Soukromé studio. Přístup pouze pro autorizovaný účet.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-surface p-5">
          <div className="space-y-2">
            <label className="field-label block" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-control"
              placeholder="ty@example.com"
            />
          </div>

          <div className="space-y-2">
            <label className="field-label block" htmlFor="password">
              Heslo
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-control"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-status-error/40 bg-status-error/10 px-3 py-2 text-xs font-medium text-status-error"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-sm font-bold uppercase tracking-wider text-brand-foreground shadow-brand transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            {busy ? "Přihlašuji…" : "Přihlásit se"}
          </button>

          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-cyan" />
            Veřejná registrace je vypnutá. Nový účet lze vytvořit pouze ručně správcem aplikace.
          </p>
        </form>
      </div>
    </main>
  );
}
