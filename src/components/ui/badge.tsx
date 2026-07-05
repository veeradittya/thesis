import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

// shadcn-style Badge, themed to our tokens (radix-rhea preset).
const badgeVariants = {
  default: "border-transparent bg-crimson text-white",
  secondary: "border-transparent bg-surface text-text",
  outline: "border-border text-text",
  muted: "border-transparent bg-surface text-text-muted",
} as const;

export function Badge({
  className,
  variant = "default",
  ...props
}: ComponentProps<"span"> & { variant?: keyof typeof badgeVariants }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}
