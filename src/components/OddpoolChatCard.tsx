"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useMovableCard } from "@/components/ui/useMovableCard";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "What are the odds Tesla is the largest company by market cap?",
  "Any whale activity in my portfolio right now?",
  "Which of my holdings has the most prediction-market action?",
];

// Light inline markdown → render **bold** and `code`; leave the rest as plain text.
function renderText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(p)) return <code key={i} className="rounded bg-white/10 px-1 py-0.5 text-[11px] tabular-nums">{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  });
}

export function OddpoolChatCard({
  portfolio,
  x = 1080,
  y = 110,
  width = 460,
  height = 560,
}: {
  portfolio?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  const { style, dragHandle, resizeHandle, raise } = useMovableCard("chat", { x, y, w: width, h: height }, { minW: 360, minH: 360 });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setErr(null);
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, portfolio }),
      });
      const j = await res.json();
      if (j.error) setErr(j.error);
      else setMsgs((m) => [...m, { role: "assistant", content: j.reply }]);
    } catch {
      setErr("Couldn't reach the assistant.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onPointerDown={raise}
      style={style}
      className="fade-in absolute flex flex-col overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#0e0e0e] font-sans tracking-[-0.01em] shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
    >
      {/* header — drag handle */}
      <div {...dragHandle} className="shrink-0 cursor-move touch-none select-none border-b border-white/[0.06] px-5 pt-4 pb-3">
        <p className="text-[10px] uppercase tracking-wider text-[#8a8a8a]">Thesis Chat</p>
        <h2 className="mt-1 text-[16px] font-semibold text-white">Ask the markets</h2>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {msgs.length === 0 && !loading && (
          <div className="mt-1 space-y-2">
            <p className="px-1 text-[12px] leading-relaxed text-[#8a8a8a]">
              Live prediction-market analyst over your portfolio:
            </p>
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left text-[12px] leading-snug text-white/80 transition-colors hover:bg-white/[0.05]"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[12.5px] leading-relaxed",
                m.role === "user" ? "bg-white text-black" : "bg-white/[0.05] text-white/90",
              )}
            >
              {m.role === "assistant" ? renderText(m.content) : m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl bg-white/[0.05] px-3.5 py-3">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/50 [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {err && <p className="px-1 text-[12px] text-rose-400">{err}</p>}
      </div>

      {/* input */}
      <div className="shrink-0 border-t border-white/[0.06] p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about any market…"
            rows={1}
            className="no-scrollbar max-h-24 min-h-[38px] flex-1 resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-[#6a6a6a] focus:border-white/20 focus:outline-none"
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-white text-black transition-opacity disabled:opacity-30"
            title="Send"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>

      {/* resize handle */}
      <div
        {...resizeHandle}
        className="absolute bottom-0 right-0 z-20 flex h-7 w-7 cursor-nwse-resize touch-none items-end justify-end p-1.5 text-white/40 transition-colors hover:text-white/80"
        title="Drag to resize"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M11 4L4 11M11 8L8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}
