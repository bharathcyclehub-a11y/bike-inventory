// Inventory location/bin configuration — dependency-free so both API routes and
// client components can import it without pulling in server-only modules.
//
// Bin-level tracking is intentionally DORMANT (not deleted). The Bin model, its API
// routes, and the per-unit allocation flow all remain in the codebase. While
// BIN_TRACKING_ENABLED is false:
//   - bin UI is hidden from the frontend
//   - inbound/transfers/counts operate on LOCATIONS, not bins
// Flip this to true to bring bins back.
export const BIN_TRACKING_ENABLED = false;

// The active stock locations. Two sites (BCH, BCC), each with a warehouse and a
// store. Mirrors the StockLocation enum in prisma/schema.prisma. currentStock is the
// sum across a product's location rows.
export type StockLocation = "BCH_WAREHOUSE" | "BCH_STORE" | "BCC_WAREHOUSE" | "BCC_STORE";

export const STOCK_LOCATIONS: { value: StockLocation; label: string; site: "BCH" | "BCC"; kind: "Warehouse" | "Store" }[] = [
  { value: "BCH_WAREHOUSE", label: "BCH Warehouse", site: "BCH", kind: "Warehouse" },
  { value: "BCH_STORE", label: "BCH Store", site: "BCH", kind: "Store" },
  { value: "BCC_WAREHOUSE", label: "BCC Warehouse", site: "BCC", kind: "Warehouse" },
  { value: "BCC_STORE", label: "BCC Store", site: "BCC", kind: "Store" },
];

// Where the current on-hand (90 units) is seeded; also the fallback for any
// stock that lacks an explicit location.
export const DEFAULT_STOCK_LOCATION: StockLocation = "BCH_WAREHOUSE";

const VALID = new Set<string>(STOCK_LOCATIONS.map((l) => l.value));

export function isStockLocation(value: string | null | undefined): value is StockLocation {
  return !!value && VALID.has(value);
}

export function stockLocationLabel(value: string | null | undefined): string {
  return STOCK_LOCATIONS.find((l) => l.value === value)?.label ?? "—";
}
