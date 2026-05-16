export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";

const MAX_SLOTS_PER_DAY = 10;
const CUTOFF_HOUR_IST = 13; // 1 PM IST — after this, same-day slot is closed
const LOOKAHEAD_DAYS = 14;

// Returns IST date string "YYYY-MM-DD" for a given Date object
function toISTDateString(date: Date): string {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

// Returns current hour in IST (0–23)
function currentHourIST(): number {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.getUTCHours();
}

export async function GET(_req: NextRequest) {
  try {
    const now = new Date();
    const todayIST = toISTDateString(now);
    const hourIST = currentHourIST();

    // Collect the next LOOKAHEAD_DAYS calendar dates in IST
    const dates: string[] = [];
    for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
      const d = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
      d.setUTCDate(d.getUTCDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }

    // Count deliveries already booked per date
    // A date is "taken" if scheduledDate falls on that day
    // Exclude: PREBOOKED, WALK_OUT, CANCELLED statuses
    const bookedCounts = await prisma.delivery.groupBy({
      by: ["scheduledDate"],
      where: {
        scheduledDate: {
          gte: new Date(dates[0] + "T00:00:00+05:30"),
          lte: new Date(dates[dates.length - 1] + "T23:59:59+05:30"),
        },
        status: { notIn: ["PREBOOKED", "WALK_OUT"] },
      },
      _count: { scheduledDate: true },
    });

    // Build a map: dateString → count
    const countMap: Record<string, number> = {};
    for (const row of bookedCounts) {
      if (row.scheduledDate) {
        const dateStr = toISTDateString(row.scheduledDate);
        countMap[dateStr] = (countMap[dateStr] || 0) + (row._count.scheduledDate ?? 0);
      }
    }

    const slots = dates.map((dateStr) => {
      const booked = countMap[dateStr] || 0;
      const spotsLeft = Math.max(0, MAX_SLOTS_PER_DAY - booked);
      const isToday = dateStr === todayIST;
      const isPast = dateStr < todayIST;

      let available = true;
      let reason: "FULL" | "CUTOFF" | "PAST" | null = null;

      if (isPast) {
        available = false;
        reason = "PAST";
      } else if (isToday && hourIST >= CUTOFF_HOUR_IST) {
        available = false;
        reason = "CUTOFF";
      } else if (spotsLeft === 0) {
        available = false;
        reason = "FULL";
      }

      return { date: dateStr, available, spotsLeft, reason, booked };
    });

    const nextAvailable = slots.find((s) => s.available)?.date ?? null;

    return successResponse({ slots, nextAvailable });
  } catch {
    return errorResponse("Failed to fetch delivery slots", 500);
  }
}
