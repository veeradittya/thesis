// Minimal ambient declaration for the `ws` package (no @types/ws installed).
// Server-only usage in src/lib/priceStream.ts; we just need the import to type-check.
declare module "ws";
