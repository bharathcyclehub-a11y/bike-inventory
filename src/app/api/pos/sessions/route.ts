export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { ZakyaClient } from "@/lib/zakya";

// GET — List POS sessions (from DB)
export async function GET(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "ACCOUNTS_MANAGER"]);
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const where: Record<string, unknown> = {};
    if (dateFrom || dateTo) {
      where.sessionDate = {};
      if (dateFrom) (where.sessionDate as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.sessionDate as Record<string, unknown>).lte = new Date(dateTo + "T23:59:59Z");
    }

    const sessions = await prisma.posSession.findMany({
      where,
      orderBy: { sessionDate: "desc" },
      take: 50,
      include: { settlement: { select: { id: true, status: true } } },
    });

    return successResponse(sessions);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed", 500);
  }
}

// POST — Fetch POS sessions from Zakya and save to DB
export async function POST(req: NextRequest) {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "ACCOUNTS_MANAGER"]);
    const body = await req.json();
    const { dateFrom, dateTo } = body as { dateFrom: string; dateTo: string };

    if (!dateFrom || !dateTo) return errorResponse("dateFrom and dateTo required", 400);

    const zakya = new ZakyaClient();
    const ok = await zakya.init();
    if (!ok) return errorResponse("Zakya POS not connected. Configure in Settings → Zakya.", 400);

    // Fetch sales from Zakya for the date range
    const invoices = await zakya.listAllInvoices(dateFrom, dateTo);

    // Group invoices by date to create session-like summaries
    const sessionsByDate = new Map<string, {
      date: string;
      cash: number;
      card: number;
      upi: number;
      finance: number;
      total: number;
      count: number;
    }>();

    for (const inv of invoices) {
      const date = inv.date; // YYYY-MM-DD
      if (!sessionsByDate.has(date)) {
        sessionsByDate.set(date, { date, cash: 0, card: 0, upi: 0, finance: 0, total: 0, count: 0 });
      }
      const s = sessionsByDate.get(date)!;
      s.total += inv.total;
      s.count += 1;
      // Zakya doesn't break down by payment mode in invoice list — put all in total for now
      // The user can match against bank transactions manually
    }

    let created = 0;
    let skipped = 0;

    for (const [date, s] of sessionsByDate) {
      const zakyaSessionId = `ZAKYA-${date}`;
      const existing = await prisma.posSession.findUnique({ where: { zakyaSessionId } });
      if (existing) {
        skipped++;
        continue;
      }

      await prisma.posSession.create({
        data: {
          zakyaSessionId,
          sessionDate: new Date(date),
          openedAt: new Date(date + "T09:00:00"),
          closedAt: new Date(date + "T21:00:00"),
          registerName: "Zakya POS",
          totalSales: s.total,
          invoiceCount: s.count,
          rawData: { invoiceCount: s.count, total: s.total },
        },
      });
      created++;
    }

    return successResponse({ fetched: invoices.length, created, skipped });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch POS sessions", 500);
  }
}
