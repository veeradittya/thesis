"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import type { Thesis, ThesisAnalysis } from "@/lib/thesis";
import type { Quote } from "@/lib/prices";
import { loadTheses, removeThesis, setAnalysis, isStale, promoteGuestTheses, type Scope } from "@/lib/thesisStore";
import { ThesisCard } from "@/components/ThesisCard";

// Run `worker` over `items` with bounded concurrency (default 3) — the on-open analyze fan-out.
async function runPool<T>(items: T[], worker: (t: T) => Promise<void>, concurrency = 3): Promise<void> {
  let i = 0;
  const run = async () => {
    while (i < items.length) await worker(items[i++]);
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
}

export function ThesisHome() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;
  const authed = !!userId;
  const scope: Scope = authed ? `u.${userId}` : "guest";

  const [theses, setTheses] = useState<Thesis[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const [acctMenu, setAcctMenu] = useState(false);
  const [booted, setBooted] = useState(false); // gates render until the first-visit redirect is decided
  const ranFor = useRef<string | null>(null); // avoid re-running the analyze loop for the same scope

  useEffect(() => {
    if (status === "loading") return;
    if (authed && userId) promoteGuestTheses(userId); // first authed render → carry guest theses over
    const list = loadTheses(scope);
    // True first visit (no account, nothing saved, never finished onboarding) → the
    // questionnaire IS the landing page. Old users reach the dashboard by logging in.
    if (!authed && !list.length) {
      let seen = false;
      try { seen = localStorage.getItem("thesisv2.seen") === "1"; } catch {}
      if (!seen) { router.replace("/onboard"); return; }
    }
    try { localStorage.setItem("thesisv2.seen", "1"); } catch {}
    setBooted(true);
    setTheses(list);

    // live prices (one REST snapshot)
    const tickers = [...new Set(list.map((t) => t.ticker))];
    if (tickers.length) {
      fetch(`/api/quote?symbols=${encodeURIComponent(tickers.join(","))}`)
        .then((r) => r.json())
        .then((j) => setQuotes(j.quotes || {}))
        .catch(() => {});
    }

    // daily analysis for anything not already analyzed today (once per scope per mount)
    if (ranFor.current === scope) return;
    ranFor.current = scope;
    const stale = list.filter(isStale);
    if (!stale.length) return;
    setAnalyzing(new Set(stale.map((t) => t.id)));
    let cancelled = false;
    runPool(stale, async (t) => {
      try {
        const prior = t.lastAnalysis
          ? { date: t.lastAnalysis.date, verdict: t.lastAnalysis.verdict, rationale: t.lastAnalysis.rationale, beliefState: t.lastAnalysis.beliefState }
          : undefined;
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker: t.ticker, name: t.name, thesisText: t.thesisText, horizon: t.horizon, prior }),
        }).then((r) => r.json());
        if (cancelled) return;
        const analysis: ThesisAnalysis = {
          date: res.date,
          verdict: res.verdict,
          rationale: res.rationale,
          beliefState: res.beliefState ?? undefined,
          drivers: res.drivers || [],
          generatedAt: Date.now(),
          degraded: res.degraded,
        };
        setAnalysis(scope, t.id, analysis);
        setTheses((prev) => prev.map((x) => (x.id === t.id ? { ...x, lastAnalysis: analysis } : x)));
      } catch {
        /* leave the card in its "not analyzed" state */
      } finally {
        if (!cancelled)
          setAnalyzing((prev) => {
            const n = new Set(prev);
            n.delete(t.id);
            return n;
          });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, scope]);

  const remove = (id: string) => setTheses(removeThesis(scope, id));

  return (
    <div className="min-h-dvh bg-black font-sans tracking-[-0.02em] text-[#fafafa] antialiased">
      {/* ── Nav: floating liquid-glass pill (Monaco) ── */}
      <header className="pointer-events-none fixed inset-x-0 top-6 z-50 w-full px-4">
        <div className="mx-auto flex w-full max-w-[1920px] flex-col items-center">
          <div
            className="pointer-events-auto relative flex items-center rounded-[16px]"
            style={{ width: "min(100%, 855px)", height: 55, backgroundColor: "#3a3a3a66", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
          >
            <nav className="flex flex-1" />

            <Link
              href="/"
              className="absolute left-1/2 z-10 -translate-x-1/2 text-white"
              style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "clamp(17px, 1.8vw + 10px, 26px)", fontWeight: 500, letterSpacing: "0.05em", lineHeight: 1 }}
            >
              THESIS
            </Link>

            <div className="flex flex-1 items-center justify-end gap-4 pr-4 sm:pr-[25px]">
              {session?.user ? (
                <div className="relative">
                  <button
                    onClick={() => setAcctMenu((v) => !v)}
                    title={session.user.email ?? session.user.name ?? "Account"}
                    className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-white/10 text-[13px] font-medium text-white ring-1 ring-white/15 transition-colors hover:ring-white/40"
                  >
                    {session.user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={session.user.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      (session.user.name ?? session.user.email ?? "U").slice(0, 1).toUpperCase()
                    )}
                  </button>
                  {acctMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setAcctMenu(false)} />
                      <div className="absolute right-0 top-[46px] z-50 w-56 overflow-hidden rounded-[14px] border border-white/10 bg-[#141414]/95 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur">
                        <div className="border-b border-white/[0.06] px-4 py-3">
                          <p className="truncate text-[12.5px] font-medium text-white">{session.user.name ?? "Signed in"}</p>
                          {session.user.email && <p className="truncate text-[11px] text-[#8a8a8a]">{session.user.email}</p>}
                        </div>
                        <button
                          onClick={() => {
                            setAcctMenu(false);
                            signOut();
                          }}
                          className="block w-full px-4 py-2.5 text-left text-[12.5px] text-white/85 transition-colors hover:bg-white/[0.06] hover:text-white"
                        >
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => signIn("google")}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-[42px] bg-black text-white transition-colors hover:bg-white hover:text-black"
                  style={{ height: 40, padding: "9px 16px", fontWeight: 400, lineHeight: 1.4, fontSize: "clamp(12px, calc(7.43px + 0.446vw), 16px)", letterSpacing: "clamp(-0.32px, calc(-0.103px - 0.009vw), -0.24px)" }}
                >
                  Log in
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-28">
        {!booted ? (
          <div className="flex min-h-[60dvh] items-center justify-center">
            <div className="dot-loader" role="status" aria-label="Loading" />
          </div>
        ) : !theses.length ? (
          <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
            <h1 className="text-[22px] font-semibold text-white">Track your first thesis</h1>
            <p className="mt-2 max-w-sm text-[13px] text-[#8a8a8a]">
              Pick the stocks you believe in and tell us why. Every morning your thesis gets a fresh verdict.
            </p>
            <Link
              href="/onboard"
              className="mt-5 inline-flex items-center rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-black transition-colors hover:bg-white/90"
            >
              Get started
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-baseline justify-between">
              <h1 className="text-[15px] font-semibold text-white">Your theses</h1>
              <span className="text-[11px] uppercase tracking-wider text-[#8a8a8a]">{theses.length} tracked</span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {theses.map((t) => (
                <ThesisCard key={t.id} thesis={t} quote={quotes[t.ticker]} analyzing={analyzing.has(t.id)} onRemove={remove} />
              ))}
              {/* new-thesis creation card — stacked into the grid (replaces the old nav link) */}
              <Link
                href="/onboard?add=1"
                className="fade-in flex min-h-[200px] flex-col items-center justify-center gap-2.5 rounded-[20px] border border-dashed border-white/[0.12] text-[#8a8a8a] transition-colors hover:border-white/30 hover:bg-white/[0.02] hover:text-white"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-[22px] font-light leading-none">+</span>
                <span className="text-[13px] font-medium">New thesis</span>
              </Link>
            </div>
            {!authed && (
              <p className="mt-6 text-center text-[12px] text-[#666]">
                You&apos;re browsing as a guest — {" "}
                <button onClick={() => signIn("google")} className="text-white/80 underline underline-offset-2 hover:text-white">
                  sign in
                </button>{" "}
                to save your theses.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
