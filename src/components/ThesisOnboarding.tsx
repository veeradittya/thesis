"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Decomposition, Thesis } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { ColourfulText } from "@/components/ui/colourful-text";
import { GlowingStarsBackground } from "@/components/ui/glowing-stars";
import { Badge } from "@/components/ui/badge";
import { labelFor } from "@/lib/signals";
import { cn } from "@/lib/utils";

const ASSET_PHRASES = ["What are you buying?", "NVDA", "Tesla", "Bitcoin", "Eli Lilly", "Coinbase", "Costco", "Palantir", "AMD", "Microsoft", "Uranium"];
const WHY_FALLBACK = ["What's the real driver here?", "Why does this keep working for years?"];
const HORIZONS = ["6 months", "1 year", "2 years", "3 years", "5 years", "Not sure"];

function useTypewriter(phrases: string[]) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState({ i: 0, del: false });
  useEffect(() => {
    const phrase = phrases[phase.i % phrases.length] || "";
    let t: ReturnType<typeof setTimeout>;
    if (!phase.del && text === phrase) t = setTimeout(() => setPhase((p) => ({ ...p, del: true })), 1800);
    else if (phase.del && text === "") t = setTimeout(() => setPhase((p) => ({ i: p.i + 1, del: false })), 350);
    else
      t = setTimeout(
        () => setText(phase.del ? phrase.slice(0, text.length - 1) : phrase.slice(0, text.length + 1)),
        phase.del ? 25 : 55,
      );
    return () => clearTimeout(t);
  }, [text, phase, phrases]);
  return text;
}

interface Asset {
  symbol: string;
  description: string;
}
type Step = "asset" | "why" | "horizon" | "loading" | "confirm";

export function ThesisOnboarding({ onComplete }: { onComplete: (t: Thesis) => void }) {
  const [step, setStep] = useState<Step>("asset");
  const [assetText, setAssetText] = useState("");
  const [verified, setVerified] = useState<Asset | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [thesisText, setThesisText] = useState("");
  const [ideas, setIdeas] = useState<string[]>([]);
  const [horizon, setHorizon] = useState("");
  const [blink, setBlink] = useState(true);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDecomp, setPendingDecomp] = useState<Decomposition | null>(null);
  const [selectedClaims, setSelectedClaims] = useState<Set<string>>(new Set());

  const whyRef = useRef<HTMLDivElement>(null);
  const horizonRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  const phrases = step === "why" ? (ideas.length ? ideas : WHY_FALLBACK) : ASSET_PHRASES;
  const typed = useTypewriter(phrases);

  useEffect(() => {
    const id = setInterval(() => setBlink((b) => !b), 530);
    return () => clearInterval(id);
  }, []);

  // Live verify the typed asset (no dropdown — verification just lights up the text).
  useEffect(() => {
    if (step !== "asset") return;
    const v = assetText.trim();
    if (v.length < 2) {
      setVerified(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/symbol-search?q=${encodeURIComponent(v)}`);
        const json = await res.json();
        const results: Asset[] = json.results || [];
        const vu = v.toUpperCase();
        const exact = results.find((r) => r.symbol === vu);
        const nameMatch =
          !exact && v.length >= 4 ? results.find((r) => r.description.toLowerCase().startsWith(v.toLowerCase())) : null;
        const m = exact || nameMatch || null;
        setVerified(m ? { symbol: m.symbol, description: m.description } : null);
      } catch {
        setVerified(null);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [assetText, step]);

  // Fetch asset-specific thesis ideas once we know the asset.
  useEffect(() => {
    if (step === "why" && asset && ideas.length === 0) {
      fetch(`/api/thesis-ideas?symbol=${encodeURIComponent(asset.symbol)}&name=${encodeURIComponent(asset.description)}`)
        .then((r) => r.json())
        .then((j) => setIdeas(j.ideas || []))
        .catch(() => {});
    }
  }, [step, asset, ideas.length]);

  // Scroll between steps.
  useEffect(() => {
    if (step === "why") whyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (step === "horizon") horizonRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (step === "loading") loadingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (step === "confirm") confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  function proceedAsset() {
    if (!assetText.trim()) {
      setHint("Tell us what you're buying.");
      return;
    }
    if (!verified) {
      setHint("We couldn't verify that as a real asset. Try a ticker like NVDA.");
      return;
    }
    setAsset(verified);
    setHint(null);
    setStep("why");
  }

  function proceedWhy() {
    if (!thesisText.trim()) return;
    setStep("horizon");
  }

  async function runDecompose(hz: string) {
    if (!asset) return;
    setError(null);
    setStep("loading");
    try {
      const res = await fetch("/api/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thesis: thesisText.trim(), holdings: asset.symbol, timeHorizon: hz === "Not sure" ? "" : hz }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Decomposition failed.");
      const decomposition = json.decomposition as Decomposition;
      // Hand off to the confirm step: the user picks which claims to actually monitor.
      setPendingDecomp(decomposition);
      setSelectedClaims(new Set(decomposition.claims.map((c) => c.id)));
      setStep("confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStep("horizon");
    }
  }

  function toggleClaim(id: string) {
    setSelectedClaims((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startMonitoring() {
    if (!asset || !pendingDecomp) return;
    const claims = pendingDecomp.claims.filter((c) => selectedClaims.has(c.id));
    if (claims.length === 0) return;
    const decomposition: Decomposition = { ...pendingDecomp, claims };
    const statuses: Record<string, Thesis["statuses"][string]> = {};
    claims.forEach((c) => (statuses[c.id] = c.status || "holding"));
    onComplete({
      id: `t_${Date.now()}`,
      holdings: asset.symbol.toUpperCase(),
      thesisText: thesisText.trim(),
      timeHorizon: horizon === "Not sure" ? "" : horizon,
      decomposition,
      statuses,
      createdAt: Date.now(),
    });
  }

  return (
    <div className="w-full">
      {/* ── Step 1: what are you buying ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute top-[36%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.08] blur-3xl"
          style={{ background: "radial-gradient(circle, var(--color-crimson), transparent 70%)" }}
        />
        <div className="relative w-full max-w-2xl flex flex-col items-center text-center fade-in">
          <Logo className="text-[64px] leading-none" />
          <p className="mt-6 text-[15px] text-text-muted leading-relaxed max-w-xl">
            <span className="text-text font-medium">The WHOOP for your portfolio.</span> Tell us your world view. We
            decompose it into the few things that must stay true, then watch the world and warn you the moment your
            thesis breaks.
          </p>

          <div className="mt-10 w-full">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex items-center gap-2 bg-panel border border-border rounded-xl pl-4 pr-2 py-2 panel-glow focus-within:border-border-light transition-colors"
            >
              <div className="relative flex-1 text-left">
                <input
                  autoFocus
                  value={assetText}
                  onChange={(e) => setAssetText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") proceedAsset();
                  }}
                  style={{ caretColor: "var(--color-accent)" }}
                  className="w-full bg-transparent py-2.5 text-[15px] text-transparent focus:outline-none"
                />
                <div className="absolute inset-0 py-2.5 text-[15px] flex items-center pointer-events-none">
                  {assetText ? (
                    verified ? (
                      <ColourfulText text={assetText} />
                    ) : (
                      <span className="text-text">{assetText}</span>
                    )
                  ) : (
                    <span className="text-text-muted/70">
                      {typed}
                      <span className={blink ? "opacity-100" : "opacity-0"}>▌</span>
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={proceedAsset}
                disabled={!assetText.trim()}
                aria-label="Continue"
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-[18px] text-white bg-crimson hover:bg-crimson-hover disabled:opacity-40 transition-colors"
              >
                →
              </button>
            </motion.div>
            {hint && <p className="mt-3 text-[12px] text-warning">{hint}</p>}
          </div>
        </div>
      </section>

      {/* ── Step 2: why ── */}
      {(step === "why" || step === "horizon" || step === "loading") && (
        <section ref={whyRef} className="min-h-screen flex flex-col items-center justify-center px-6 fade-in">
          <div className="w-full max-w-2xl text-center">
            <h2 className="text-[26px] font-semibold tracking-tight text-accent mb-2">
              Why do you want to buy <ColourfulText text={asset?.symbol || ""} />?
            </h2>
            <p className="text-[13px] text-text-muted mb-7">
              In a sentence or two. The placeholder is cycling real angles for {asset?.symbol} if you want a nudge.
            </p>
            <div className="flex items-end gap-2 bg-panel border border-border rounded-2xl pl-4 pr-2 py-3 panel-glow focus-within:border-border-light transition-colors">
              <textarea
                value={thesisText}
                onChange={(e) => setThesisText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    proceedWhy();
                  }
                }}
                placeholder={step === "why" ? `${typed}` : ""}
                rows={3}
                className="flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-relaxed text-text placeholder-text-muted/60 focus:outline-none"
              />
              <button
                onClick={proceedWhy}
                disabled={!thesisText.trim()}
                aria-label="Continue"
                className="mb-1 shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-[18px] text-white bg-crimson hover:bg-crimson-hover disabled:opacity-40 transition-colors"
              >
                →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Step 3: horizon ── */}
      {(step === "horizon" || step === "loading") && (
        <section ref={horizonRef} className="min-h-screen flex flex-col items-center justify-center px-6 fade-in">
          <div className="w-full max-w-xl text-center">
            <h2 className="text-[26px] font-semibold tracking-tight text-accent mb-2">How long are you holding?</h2>
            <p className="text-[13px] text-text-muted mb-7">
              Story and macro theses need a horizon to judge what counts as a break.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {HORIZONS.map((h) => (
                <button
                  key={h}
                  onClick={() => {
                    setHorizon(h);
                    runDecompose(h);
                  }}
                  className="px-3.5 py-2 rounded-full text-[13px] border border-border text-text-muted hover:text-text hover:border-border-light transition-colors"
                >
                  {h}
                </button>
              ))}
            </div>
            {error && <p className="mt-4 text-[12px] text-negative">{error}</p>}
          </div>
        </section>
      )}

      {/* ── Step 4: loading (glowing stars + source ladder) ── */}
      {step === "loading" && (
        <section
          ref={loadingRef}
          className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden fade-in"
        >
          <GlowingStarsBackground />
          <div className="relative z-10 flex w-full max-w-lg flex-col items-center text-center">
            <h2 className="text-[24px] font-semibold tracking-tight text-accent">
              Scanning the world for signals on <ColourfulText text={asset?.symbol || ""} />
            </h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.7 }}
              className="mt-6 flex items-center gap-3 text-[15px] text-text-muted"
            >
              <span className="relative flex h-2 w-2 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-crimson" />
              </span>
              Mapping falsifiable claims to leading indicators…
            </motion.p>
          </div>
        </section>
      )}

      {/* ── Step 5: confirm which claims to monitor ── */}
      {step === "confirm" && pendingDecomp && (
        <section ref={confirmRef} className="min-h-screen flex flex-col items-center justify-center px-6 py-16 fade-in">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-8">
              <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2">Confirm your monitors</p>
              <h2 className="text-[26px] font-semibold tracking-tight text-accent">
                Here&apos;s what we&apos;ll watch for <ColourfulText text={asset?.symbol || ""} />
              </h2>
              <p className="mt-2 text-[13px] text-text-muted">
                We broke your thesis into these claims. Pick the ones worth tracking.
              </p>
            </div>

            <div className="space-y-2.5">
              {pendingDecomp.claims.map((c) => {
                const on = selectedClaims.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleClaim(c.id)}
                    className={cn(
                      "w-full text-left rounded-lg border px-4 py-3.5 transition-all",
                      on ? "border-crimson/40 bg-crimson/5" : "border-border bg-panel opacity-55 hover:opacity-90",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                          on ? "border-crimson bg-crimson text-white" : "border-border-light",
                        )}
                      >
                        {on && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] text-text leading-snug">{c.statement}</p>
                        <p className="mt-1 text-[12px] text-text-muted leading-relaxed">
                          <span className="text-text-muted/60">breaks if </span>
                          {c.break_condition}
                        </p>
                        {(c.signals || []).length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {(c.signals || []).slice(0, 5).map((s, i) => (
                              <Badge key={i} variant="muted">
                                {labelFor(s.source_id)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-7 flex items-center justify-between">
              <span className="text-[12px] text-text-muted">
                {selectedClaims.size} of {pendingDecomp.claims.length} claims selected
              </span>
              <button
                onClick={startMonitoring}
                disabled={selectedClaims.size === 0}
                className="px-5 py-2.5 rounded-lg text-[13px] font-medium text-white bg-crimson hover:bg-crimson-hover disabled:opacity-40 transition-colors"
              >
                Start monitoring →
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
