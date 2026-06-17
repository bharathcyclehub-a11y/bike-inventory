// Inventory location/bin configuration — dependency-free so both API routes and
// client components can import it without pulling in server-only modules.
//
// Bin-level tracking is intentionally DORMANT (not deleted). The Bin model, its API
// routes, and the per-unit allocation flow all remain in the codebase. While
// BIN_TRACKING_ENABLED is false:
//   - bin UI is hidden from the frontend
//   - inbound receiving and transfers require a LOCATION, not a bin
//   - location-level quantity (StockLevel) is the active source of truth
// Flip this to true to bring bins back (plus a reconciliation step to slot the
// existing per-location stock under bins again).
export const BIN_TRACKING_ENABLED = false;

// The two stock locations we actively track. Mirrors the StockLocation enum in
// prisma/schema.prisma.
export type StockLocation = "STORE" | "WAREHOUSE";

export const STOCK_LOCATIONS: { value: StockLocation; label: string }[] = [
  { value: "STORE", label: "Store" },
  { value: "WAREHOUSE", label: "Warehouse" },
];

export const DEFAULT_STOCK_LOCATION: StockLocation = "STORE";

// Maps a legacy Bin.location string (e.g. "Bharath Cycle Hub - Ground Floor",
// "Warehouse G1", "Bharath Cycle Centre") onto one of the two active buckets.
// Anything that isn't clearly a warehouse falls back to STORE — this is also the
// rule for products that never had a bin assigned.
export function binLocationToStockLocation(binLocation: string | null | undefined): StockLocation {
  if (binLocation && /warehouse/i.test(binLocation)) return "WAREHOUSE";
  return "STORE";
}
