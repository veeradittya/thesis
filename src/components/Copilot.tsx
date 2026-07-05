"use client";

import { useEffect, useRef, useState } from "react";
import { Thesis } from "@/lib/types";
import { thesisHealth } from "@/lib/health";

type Msg = { role: "user" | "assistant"; content: string };

function buildContext(theses: Thesis[], focusId: string | null): string {
  if (!theses.length) return "";
  return theses
    .map((t) => {
      const d = t.decomposition;
      const health = thesisHealth(d.claims, t.statuses);
      const focus = t.id === focusId ? " [CURRENTLY VIEWING]" : "";
      const claims = d.claims
        .map((c) => {
          const st = (t.statuses[c.id] ?? c.status).toUpperCase();
          return `  - [${c.id}] ${st} (weight ${c.weight}) ${c.statement}\n    BREAK: ${c.break_condition}\n    signals: ${(c.signals || [])
            .map((s) => `${s.type[0].toUpperCase()}:${s.source_id}`)
            .join(", ")}`;
        })
        .join("\n");
      const unstated = (d.unstated_assumptions || []).map((a) => a.assumption).join("; ");
      return `=== ${t.holdings} (Thesis Health ${health}/100)${focus} ===\nThesis: ${d.thesis_summary}\nType: ${d.thesis_type} | Horizon: ${
        d.time_horizon ?? "n/a"
      }\nClaims:\n${claims}${unstated ? `\nUnstated assumptions: ${unstated}` : ""}`;
    })
    .join("\n\n");
}

export function Copilot({ theses, focusId }: { theses: Thesis[]; focusId: string | null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  const focusTicker = theses.find((t) => t.id === focusId)?.holdings;
  const suggestions = theses.length
    ? [
        focusTicker ? `Is my ${focusTicker} thesis still holding?` : "Is my top thesis still holding?",
        "Which of my claims is closest to breaking?",
        "What should I watch across my portfolio this week?",
      ]
    : ["What does Thesis do?", "How do I write a thesis you can monitor?"];

  async function send(text: string) {
    const q = text.trim();
    if (!q || streaming) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, context: buildContext(theses, focusId) }),
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "Copilot error.");
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { role: "assistant", content: `⚠ ${errText}` };
          return c;
        });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { role: "assistant", content: acc };
          return c;
        });
      }
    } catch {
      setMessages((m) => {
        const c = [...m];
        c[c.length - 1] = { role: "assistant", content: "⚠ Connection error." };
        return c;
      });
    } finally {
      setStreaming(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 px-4 py-2.5 bg-panel border border-border rounded-full text-xs text-text hover:text-accent hover:border-border-light transition-all panel-glow flex items-center gap-2"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-pulse" />
        Ask Thesis
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[400px] max-w-[calc(100vw-2.5rem)] h-[560px] max-h-[calc(100vh-6rem)] flex flex-col bg-panel border border-border rounded-lg panel-glow fade-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-pulse" />
          <span className="text-[13px] text-accent tracking-wider">ASK THESIS</span>
        </div>
        <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text text-sm leading-none">
          ✕
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-[12px] text-text-muted leading-relaxed">
              Grounded in your portfolio and theses. Ask about a holding, or whether a thesis is holding or breaking.
            </p>
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => send(s)}
                className="block w-full text-left px-3 py-2 border border-border rounded text-[12px] text-text-muted hover:text-text hover:border-border-light transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] px-3 py-2 rounded-lg bg-border text-[13px] text-text">{m.content}</div>
            </div>
          ) : (
            <div key={i} className="text-[13px] text-text/85 leading-relaxed whitespace-pre-wrap">
              {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
            </div>
          ),
        )}
      </div>

      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send(input);
            }}
            placeholder="Ask about your portfolio…"
            disabled={streaming}
            className="flex-1 bg-bg border border-border rounded px-3 py-2 text-[13px] text-text placeholder-text-muted/50 focus:outline-none focus:border-border-light disabled:opacity-50"
          />
          <button
            onClick={() => send(input)}
            disabled={streaming || !input.trim()}
            className="px-3 py-2 rounded text-[13px] font-medium text-white bg-crimson hover:bg-crimson-hover disabled:opacity-40 transition-colors"
          >
            {streaming ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
