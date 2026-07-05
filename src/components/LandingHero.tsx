"use client";

import { useEffect, useState } from "react";

// Animated, looping prompts shown in the search bar (type → hold → erase → next).
const PHRASES = [
  "Tell us your view of the world…",
  "Tell us what you want to buy, and why you want to buy it…",
  "“Nvidia stays the backbone of AI…”",
  "“GLP-1 demand outruns supply for years…”",
  "“Rates fall and long-duration tech re-rates…”",
];

function useTypewriter(phrases: string[]) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState({ i: 0, del: false });

  useEffect(() => {
    const phrase = phrases[phase.i % phrases.length];
    let t: ReturnType<typeof setTimeout>;
    if (!phase.del && text === phrase) {
      t = setTimeout(() => setPhase((p) => ({ ...p, del: true })), 1700); // hold full phrase
    } else if (phase.del && text === "") {
      t = setTimeout(() => setPhase((p) => ({ i: p.i + 1, del: false })), 350); // gap before next
    } else {
      t = setTimeout(
        () => setText(phase.del ? phrase.slice(0, text.length - 1) : phrase.slice(0, text.length + 1)),
        phase.del ? 25 : 55,
      );
    }
    return () => clearTimeout(t);
  }, [text, phase, phrases]);

  return text;
}

export function LandingHero({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [blink, setBlink] = useState(true);
  const typed = useTypewriter(PHRASES);

  useEffect(() => {
    const id = setInterval(() => setBlink((b) => !b), 530);
    return () => clearInterval(id);
  }, []);

  const showAnim = !focused && value === "";
  const placeholder = showAnim ? `${typed}${blink ? "▌" : " "}` : "Tell us your view of the world…";

  function submit() {
    const v = value.trim();
    if (v) onSubmit(v);
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* soft emerald glow behind the wordmark */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.08] blur-3xl"
        style={{ background: "radial-gradient(circle, var(--color-crimson), transparent 70%)" }}
      />

      <div className="relative w-full max-w-2xl flex flex-col items-center text-center fade-in">
        <h1 className="text-[64px] leading-none font-semibold tracking-tight text-accent">
          thesis<span className="text-crimson">.</span>
        </h1>

        <p className="mt-6 text-[15px] text-text-muted leading-relaxed max-w-xl">
          The conviction layer for your portfolio. Tell us your view of the world — we decompose it into the
          few things that must stay true, then watch the world and warn you the moment your thesis breaks.
        </p>

        <div className="mt-10 w-full">
          <div className="flex items-center gap-2 bg-panel border border-border rounded-xl pl-4 pr-2 py-2 panel-glow focus-within:border-border-light transition-colors">
            <input
              aria-label="Your thesis"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder={placeholder}
              className="flex-1 bg-transparent py-2.5 text-[15px] text-text placeholder-text-muted/70 focus:outline-none"
            />
            <button
              onClick={submit}
              disabled={!value.trim()}
              aria-label="Decompose thesis"
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-[18px] text-white bg-crimson hover:bg-crimson-hover disabled:opacity-40 transition-colors"
            >
              →
            </button>
          </div>
          <p className="mt-3 text-[11px] text-text-muted/70">
            Press <span className="text-text-muted">↵ Enter</span> — we&apos;ll break it into falsifiable claims you can monitor.
          </p>
        </div>
      </div>
    </div>
  );
}
