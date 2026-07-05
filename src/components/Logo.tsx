// The official Thesis wordmark: lowercase "thesis" with an emerald period.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight text-accent select-none ${className}`}>
      thesis<span className="text-crimson">.</span>
    </span>
  );
}
