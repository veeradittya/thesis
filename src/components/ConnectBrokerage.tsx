"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Holding } from "@/lib/types";

export function ConnectBrokerage({
  onImport,
  compact,
}: {
  onImport: (holdings: Holding[], institution: string) => void;
  compact?: boolean;
}) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSuccess = useCallback(
    async (public_token: string, metadata: { institution?: { name?: string } | null }) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/plaid/exchange_public_token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token, institution: metadata?.institution?.name }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Import failed.");
        onImport(json.holdings || [], json.institution || "Brokerage");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import failed.");
      } finally {
        setBusy(false);
        setLinkToken(null);
      }
    },
    [onImport],
  );

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  // Open Plaid Link once the token is fetched and the SDK is ready.
  useEffect(() => {
    if (pendingOpen && ready && linkToken) {
      setPendingOpen(false);
      open();
    }
  }, [pendingOpen, ready, linkToken, open]);

  const start = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/plaid/create_link_token", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not start Plaid.");
      setLinkToken(json.link_token);
      setPendingOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start Plaid.");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div>
      <button
        onClick={start}
        disabled={busy}
        className={
          compact
            ? "w-full px-3 py-2 rounded text-[12px] font-medium text-white bg-crimson hover:bg-crimson-hover disabled:opacity-40 transition-colors"
            : "px-3 py-1.5 rounded text-[13px] font-medium border border-border text-text-muted hover:text-text hover:border-border-light disabled:opacity-40 transition-colors"
        }
      >
        {busy ? "Connecting…" : "Connect brokerage"}
      </button>
      {error && <p className="mt-1.5 text-[11px] text-negative leading-snug">{error}</p>}
    </div>
  );
}
