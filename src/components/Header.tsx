"use client";

import { Logo } from "@/components/Logo";

export function Header({ onNew }: { onNew: () => void }) {
  return (
    <header className="h-13 shrink-0 bg-panel border-b border-border flex items-center px-4 justify-between">
      <div className="flex items-center gap-3">
        <Logo className="text-[20px]" />
        <div className="w-px h-5 bg-border" />
        <span className="text-[11px] text-text-muted uppercase tracking-widest">Portfolio Conviction Monitor</span>
      </div>
      <button
        onClick={onNew}
        className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-white bg-crimson hover:bg-crimson-hover transition-colors"
      >
        + New thesis
      </button>
    </header>
  );
}
