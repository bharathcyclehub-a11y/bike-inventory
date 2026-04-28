export const dynamic = "force-dynamic";

import { errorResponse } from "@/lib/api-utils";

// Legacy outward verification disabled — use Deliveries system instead.
// This endpoint previously deducted stock on verify, causing double-deduction
// when the same invoice also existed as a Delivery record.
export async function POST() {
  return errorResponse("Legacy outward verification disabled. Use Deliveries system.", 410);
}
