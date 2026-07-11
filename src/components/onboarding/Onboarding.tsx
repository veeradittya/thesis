"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { cn } from "@/lib/utils";
import type { Thesis, ThesisAnalysis } from "@/lib/thesis";
import { newThesis, saveTheses, loadTheses } from "@/lib/thesisStore";
import { ThesisCard } from "@/components/ThesisCard";

type Trader = "active" | "passive";
type PassiveKind = "no_time" | "have_stocks" | "vest_rest";
type Step = "trader" | "passive" | "pick" | "thesis" | "demo" | "funnel";
interface Sugg {
  symbol: string;
  name: string;
  sector?: string;
}

const HORIZONS = ["3 months", "1 year", "3+ years"];
const THESIS_STARTERS = [
  "Dominant market position with pricing power",
  "Secular demand outgrowing supply",
  "Best-in-class management executing well",
  "Structurally undervalued vs peers",
  "A durable AI / technology tailwind",
];
const EXAMPLE = "e.g. AI datacenter demand keeps GPU orders growing faster than supply can catch up.";

// ── small shared UI ───────────────────────────────────────────────────────────
function Shell({
  step,
  total,
  onBack,
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  step: number;
  total: number;
  onBack?: () => void;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-black font-sans tracking-[-0.02em] text-[#fafafa] antialiased">
      <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-5 pb-8 pt-8">
        {/* progress */}
        <div className="flex items-center gap-3">
          {onBack ? (
            <button onClick={onBack} className="text-[13px] text-[#8a8a8a] transition-colors hover:text-white">
              ← Back
            </button>
          ) : (
            <span
              className="text-white"
              style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 20, fontWeight: 500, letterSpacing: "0.05em" }}
            >
              THESIS
            </span>
          )}
          <div className="ml-auto flex gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} className={cn("h-1 w-6 rounded-full transition-colors", i < step ? "bg-white" : "bg-white/15")} />
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center py-10">
          {eyebrow && <p className="text-[11px] uppercase tracking-wider text-[#8a8a8a]">{eyebrow}</p>}
          <h1 className="mt-2 text-[26px] font-semibold leading-tight text-white">{title}</h1>
          {subtitle && <p className="mt-2 text-[13.5px] leading-snug text-[#8a8a8a]">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>

        {footer && <div className="mt-auto">{footer}</div>}
      </div>
    </div>
  );
}

function ChoiceButton({ label, hint, onClick, active }: { label: string; hint?: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border px-5 py-4 text-left transition-colors",
        active ? "border-white/40 bg-white/[0.06]" : "border-white/[0.08] bg-[#0e0e0e] hover:border-white/20 hover:bg-white/[0.03]",
      )}
    >
      <span className="block text-[15px] font-medium text-white">{label}</span>
      {hint && <span className="mt-0.5 block text-[12.5px] text-[#8a8a8a]">{hint}</span>}
    </button>
  );
}

const primaryBtn =
  "inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-[14px] font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-40 disabled:hover:bg-white";
const ghostBtn = "inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-[14px] font-medium text-white/90 transition-colors hover:border-white/40";

// ── main ────────────────────────────────────────────────────────────────────
export function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("trader");
  const [trader, setTrader] = useState<Trader | null>(null);
  const [passiveKind, setPassiveKind] = useState<PassiveKind | null>(null);
  const [theses, setTheses] = useState<Thesis[]>([]); // picks become theses immediately (persisted)
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftHorizon, setDraftHorizon] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);

  // suggestions + search (pick step)
  const [sugg, setSugg] = useState<Sugg[]>([]);
  const [recPage, setRecPage] = useState(0);
  const [q, setQ] = useState("");
  const [searchResults, setSearchResults] = useState<Sugg[]>([]);

  const passiveMode = passiveKind === "vest_rest";
  const picked = new Set(theses.map((t) => t.ticker));

  // Resume any guest theses from a prior visit on mount, then persist on every change (the
  // `hydrated` gate stops the initial empty state from clobbering saved picks). Survives a
  // bail-out and lets "+ New thesis" add to an existing set; the dashboard reads the same store.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const existing = loadTheses("guest");
    if (existing.length) setTheses(existing);
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) saveTheses("guest", theses);
  }, [theses, hydrated]);

  // fetch personalized suggestions for the pick step
  useEffect(() => {
    if (step !== "pick") return;
    const picks = theses.map((t) => t.ticker).join(",");
    fetch(`/api/recommend?picks=${encodeURIComponent(picks)}&page=${recPage}`)
      .then((r) => r.json())
      .then((j) => setSugg(Array.isArray(j.suggestions) ? j.suggestions : []))
      .catch(() => {});
  }, [step, recPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // debounced symbol search
  useEffect(() => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    const id = setTimeout(() => {
      fetch(`/api/symbol-search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((j) => setSearchResults((j.results || []).map((r: { symbol: string; description: string }) => ({ symbol: r.symbol, name: r.description }))))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  const addPick = (s: Sugg) => {
    const sym = s.symbol.trim().toUpperCase();
    if (picked.has(sym)) return;
    setTheses((prev) => [...prev, newThesis({ ticker: sym, name: s.name || sym, passive: passiveMode })]);
  };
  const removePick = (sym: string) => setTheses((prev) => prev.filter((t) => t.ticker !== sym));

  const goPick = () => setStep("pick");
  const startThesis = (id: string) => {
    const t = theses.find((x) => x.id === id);
    setCurrentId(id);
    setDraftText(t?.thesisText || "");
    setDraftHorizon(t?.horizon || null);
    setStep("thesis");
  };

  // save the rationale onto the current thesis, then run the demo analysis
  const runDemo = async () => {
    if (!currentId) return;
    const updated = theses.map((t) => (t.id === currentId ? { ...t, thesisText: draftText.trim(), horizon: draftHorizon } : t));
    setTheses(updated);
    setStep("demo");
    setDemoLoading(true);
    const t = updated.find((x) => x.id === currentId)!;
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: t.ticker, name: t.name, thesisText: t.thesisText, horizon: t.horizon }),
      }).then((r) => r.json());
      const analysis: ThesisAnalysis = {
        date: res.date,
        verdict: res.verdict,
        rationale: res.rationale,
        drivers: res.drivers || [],
        generatedAt: Date.now(),
        degraded: res.degraded,
      };
      setTheses((prev) => prev.map((x) => (x.id === currentId ? { ...x, lastAnalysis: analysis } : x)));
    } catch {
      /* leave without an analysis */
    } finally {
      setDemoLoading(false);
    }
  };

  const finish = (mode: "signup" | "guest") => {
    saveTheses("guest", theses);
    if (mode === "signup") signIn("google", { callbackUrl: "/" });
    else router.push("/");
  };

  const total = trader === "active" ? 4 : 5;
  const current = theses.find((t) => t.id === currentId);
  const withoutThesis = theses.filter((t) => !t.thesisText && !t.passive);

  // ── steps ──
  if (step === "trader") {
    return (
      <Shell step={1} total={total} eyebrow="Getting started" title="How do you invest?" subtitle="This tailors what we show you.">
        <div className="flex flex-col gap-3">
          <ChoiceButton
            label="Active trader"
            hint="I pick and manage individual positions"
            onClick={() => {
              setTrader("active");
              setStep("pick");
            }}
          />
          <ChoiceButton
            label="Passive investor"
            hint="Mostly funds, but I have views"
            onClick={() => {
              setTrader("passive");
              setStep("passive");
            }}
          />
        </div>
      </Shell>
    );
  }

  if (step === "passive") {
    return (
      <Shell step={2} total={total} onBack={() => setStep("trader")} eyebrow="A quick follow-up" title="Any individual stocks you want to hold?">
        <div className="flex flex-col gap-3">
          <ChoiceButton label="Yes — but I have no time to track them" onClick={() => { setPassiveKind("no_time"); goPick(); }} />
          <ChoiceButton label="Yes — I already hold individual stocks" onClick={() => { setPassiveKind("have_stocks"); goPick(); }} />
          <ChoiceButton label="No — I just vest and rest" hint="We'll track a couple of broad funds for you" onClick={() => { setPassiveKind("vest_rest"); goPick(); }} />
        </div>
      </Shell>
    );
  }

  if (step === "pick") {
    const shownSugg = (passiveMode ? [{ symbol: "VOO", name: "Vanguard S&P 500 ETF" }, { symbol: "QQQ", name: "Nasdaq-100 ETF" }, ...sugg] : sugg).filter(
      (s) => !picked.has(s.symbol),
    );
    return (
      <Shell
        step={trader === "active" ? 2 : 3}
        total={total}
        onBack={() => setStep(trader === "active" ? "trader" : "passive")}
        eyebrow="Build your watchlist"
        title={passiveMode ? "Pick a few funds or names to track" : "Which names are you interested in?"}
        subtitle="Tap to add. You can add more later."
        footer={
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[#8a8a8a]">{theses.length} selected</span>
            <button
              className={primaryBtn}
              disabled={!theses.length}
              onClick={() => (passiveMode ? setStep("funnel") : startThesis(theses[0].id))}
            >
              Continue
            </button>
          </div>
        }
      >
        {/* selected chips */}
        {!!theses.length && (
          <div className="mb-4 flex flex-wrap gap-2">
            {theses.map((t) => (
              <button
                key={t.id}
                onClick={() => removePick(t.ticker)}
                className="group inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/[0.08] px-3 py-1.5 text-[12.5px] text-white"
              >
                {t.ticker}
                <span className="text-[#8a8a8a] group-hover:text-white">✕</span>
              </button>
            ))}
          </div>
        )}

        {/* search */}
        <div className="relative mb-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search any ticker or company…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder:text-[#666] outline-none transition-colors focus:border-white/25"
          />
          {!!searchResults.length && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-[#141414] shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
              {searchResults.slice(0, 6).map((r) => (
                <button
                  key={r.symbol}
                  onClick={() => {
                    addPick(r);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
                >
                  <span className="w-14 shrink-0 text-[13px] font-semibold text-white">{r.symbol}</span>
                  <span className="truncate text-[12.5px] text-[#8a8a8a]">{r.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* suggestions */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wider text-[#8a8a8a]">Suggested for you</p>
          <button onClick={() => setRecPage((p) => p + 1)} className="text-[12px] text-[#8a8a8a] transition-colors hover:text-white">
            ↻ Refresh
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {shownSugg.slice(0, 7).map((s) => (
            <button
              key={s.symbol}
              onClick={() => addPick(s)}
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-[#0e0e0e] px-3 py-1.5 text-[12.5px] text-white/90 transition-colors hover:border-white/25 hover:bg-white/[0.04]"
              title={s.sector}
            >
              <span className="font-semibold">{s.symbol}</span>
              <span className="text-[#8a8a8a]">+</span>
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  if (step === "thesis") {
    return (
      <Shell
        step={trader === "active" ? 3 : 4}
        total={total}
        onBack={() => setStep("pick")}
        eyebrow={current ? `${current.ticker} · ${current.name}` : "Your thesis"}
        title="Why are you interested?"
        subtitle="A sentence is enough. We'll check it against the news each day."
        footer={
          <div className="flex items-center justify-end gap-3">
            <button className={ghostBtn} onClick={runDemo}>
              Skip
            </button>
            <button className={primaryBtn} disabled={!draftText.trim()} onClick={runDemo}>
              See today&apos;s read →
            </button>
          </div>
        }
      >
        {theses.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {theses.map((t) => (
              <button
                key={t.id}
                onClick={() => startThesis(t.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-[12px] transition-colors",
                  t.id === currentId ? "bg-white text-black" : "bg-white/[0.06] text-[#a8a8a8] hover:text-white",
                )}
              >
                {t.ticker}
              </button>
            ))}
          </div>
        )}
        <textarea
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          rows={4}
          placeholder={EXAMPLE}
          className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[14px] leading-snug text-white placeholder:text-[#5a5a5a] outline-none transition-colors focus:border-white/25"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {THESIS_STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => setDraftText((prev) => (prev.trim() ? prev : s))}
              className="rounded-full border border-white/[0.1] px-3 py-1.5 text-[11.5px] text-[#a8a8a8] transition-colors hover:border-white/25 hover:text-white"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-wider text-[#8a8a8a]">Horizon (optional)</p>
          <div className="mt-2 flex gap-2">
            {HORIZONS.map((h) => (
              <button
                key={h}
                onClick={() => setDraftHorizon((prev) => (prev === h ? null : h))}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[12px] transition-colors",
                  draftHorizon === h ? "bg-white text-black" : "bg-white/[0.06] text-[#a8a8a8] hover:text-white",
                )}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  if (step === "demo") {
    return (
      <Shell
        step={trader === "active" ? 4 : 5}
        total={total}
        onBack={() => setStep("thesis")}
        eyebrow="Your daily read"
        title="Here's how your thesis is holding up"
        subtitle="Every morning we re-check this against the last 24 hours of news."
        footer={
          <div className="flex items-center justify-between gap-3">
            {withoutThesis.length > 0 ? (
              <button className={ghostBtn} onClick={() => startThesis(withoutThesis[0].id)}>
                + Add another thesis
              </button>
            ) : (
              <span />
            )}
            <button className={primaryBtn} onClick={() => setStep("funnel")}>
              Continue
            </button>
          </div>
        }
      >
        {current && <ThesisCard thesis={current} analyzing={demoLoading} />}
      </Shell>
    );
  }

  // funnel
  return (
    <Shell
      step={total}
      total={total}
      onBack={() => setStep(passiveMode ? "pick" : "demo")}
      eyebrow="You're set"
      title="Save your theses"
      subtitle="Sign in to keep them and get a fresh read every morning. Import a portfolio, or add more anytime."
      footer={
        <div className="flex flex-col gap-2.5">
          <button className={primaryBtn} onClick={() => finish("signup")}>
            Sign in with Google &amp; finish
          </button>
          <button className="text-[13px] text-[#8a8a8a] transition-colors hover:text-white" onClick={() => finish("guest")}>
            Continue as guest →
          </button>
        </div>
      }
    >
      <div className="rounded-2xl border border-white/[0.08] bg-[#0e0e0e] p-5">
        <p className="text-[12px] uppercase tracking-wider text-[#8a8a8a]">Tracking {theses.length}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {theses.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[12.5px] text-white">
              <span className="font-semibold">{t.ticker}</span>
              {t.thesisText && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Thesis written" />}
            </span>
          ))}
        </div>
      </div>
    </Shell>
  );
}
