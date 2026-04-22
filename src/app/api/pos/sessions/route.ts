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

    // Try register sessions API first (has payment mode breakdown)
    let created = 0;
    let skipped = 0;
    let fetched = 0;
    let usedSessionsApi = false;

    try {
      const sessionsData = await zakya.listRegisterSessions(dateFrom, dateTo);
      const sessions = sessionsData.register_sessions || sessionsData.registersessions || [];

      if (sessions.length > 0) {
        usedSessionsApi = true;
        fetched = sessions.length;

        for (const s of sessions) {
          const existing = await prisma.posSession.findUnique({ where: { zakyaSessionId: s.session_id } });
          if (existing) { skipped++; continue; }

          // Parse payment modes from session data
          let cashSales = s.cash_sales || 0;
          let cardSales = s.card_sales || 0;
          let upiSales = 0;
          let financeSales = 0;
          let creditSales = 0;

          if (s.payment_modes) {
            for (const pm of s.payment_modes) {
              const mode = pm.payment_mode.toUpperCase();
              if (mode.includes("CASH")) cashSales = pm.amount;
              else if (mode.includes("UPI") || mode.includes("PHONEPE") || mode.includes("GPAY")) upiSales += pm.amount;
              else if (mode.includes("BAJAJ") || mode.includes("FINANCE") || mode.includes("EMI")) financeSales += pm.amount;
              else if (mode.includes("CREDIT")) creditSales += pm.amount;
              else if (mode.includes("CARD") || mode.includes("ICICI") || mode.includes("HDFC") || mode.includes("BANK")) cardSales += pm.amount;
              else cardSales += pm.amount; // default to card
            }
          }

          // Cash drawer details (from raw session data)
          const raw = s as Record<string, unknown>;
          const cashIn = parseFloat(String(raw.cash_in || raw.cash_in_amount || 0)) || 0;
          const cashOut = parseFloat(String(raw.cash_out || raw.cash_out_amount || 0)) || 0;
          const cashRefunds = parseFloat(String(raw.cash_refunds || raw.refund_amount || 0)) || 0;
          const expectedCash = parseFloat(String(raw.expected_cash || raw.expected_cash_amount || s.expected_cash || 0)) || 0;
          const countedCash = raw.counted_cash !== undefined && raw.counted_cash !== null
            ? parseFloat(String(raw.counted_cash)) : (raw.amount_counted_at_end !== undefined ? parseFloat(String(raw.amount_counted_at_end)) : null);
          const cashDiscrepancy = parseFloat(String(raw.discrepancy || raw.cash_discrepancy || 0)) || 0;

          const sessionDate = s.opened_time ? new Date(s.opened_time) : new Date(dateFrom);
          await prisma.posSession.create({
            data: {
              zakyaSessionId: s.session_id,
              sessionDate,
              openedAt: s.opened_time ? new Date(s.opened_time) : sessionDate,
              closedAt: s.closed_time ? new Date(s.closed_time) : null,
              registerName: s.register_name || "POS",
              cashierName: s.session_number,
              cashSales,
              cardSales,
              upiSales,
              financeSales,
              creditSales,
              totalSales: s.total_sales,
              cashIn,
              cashOut,
              cashRefunds,
              expectedCash,
              countedCash,
              cashDiscrepancy,
              cashInHand: expectedCash || cashSales,
              cashDeposited: 0,
              invoiceCount: s.invoice_count || 0,
              rawData: JSON.parse(JSON.stringify(s)),
            },
          });
          created++;
        }
      }
    } catch (sessionErr) {
      console.warn("Register sessions API failed, falling back to invoices:", sessionErr);
    }

    // Fallback: aggregate from invoices if sessions API not available
    if (!usedSessionsApi) {
      const invoices = await zakya.listAllInvoices(dateFrom, dateTo);
      fetched = invoices.length;

      const sessionsByDate = new Map<string, { date: string; total: number; count: number }>();
      for (const inv of invoices) {
        const date = inv.date;
        if (!sessionsByDate.has(date)) sessionsByDate.set(date, { date, total: 0, count: 0 });
        const s = sessionsByDate.get(date)!;
        s.total += inv.total;
        s.count += 1;
      }

      for (const [date, s] of sessionsByDate) {
        const zakyaSessionId = `ZAKYA-${date}`;
        const existing = await prisma.posSession.findUnique({ where: { zakyaSessionId } });
        if (existing) { skipped++; continue; }

        await prisma.posSession.create({
          data: {
            zakyaSessionId,
            sessionDate: new Date(date),
            openedAt: new Date(date + "T09:00:00"),
            closedAt: new Date(date + "T21:00:00"),
            registerName: "Zakya POS",
            totalSales: s.total,
            invoiceCount: s.count,
            rawData: { invoiceCount: s.count, total: s.total, source: "invoice-fallback" },
          },
        });
        created++;
      }
    }

    return successResponse({ fetched, created, skipped, source: usedSessionsApi ? "sessions" : "invoices" });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch POS sessions", 500);
  }
}
