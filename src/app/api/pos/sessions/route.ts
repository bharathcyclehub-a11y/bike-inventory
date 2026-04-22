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
    const { dateFrom, dateTo, force } = body as { dateFrom: string; dateTo: string; force?: boolean };

    if (!dateFrom || !dateTo) return errorResponse("dateFrom and dateTo required", 400);

    const zakya = new ZakyaClient();
    const ok = await zakya.init();
    if (!ok) return errorResponse("Zakya POS not connected. Configure in Settings → Zakya.", 400);

    // Force mode: delete existing sessions (and unlink from settlements) for this date range
    if (force) {
      const startOfRange = new Date(dateFrom);
      const endOfRange = new Date(dateTo + "T23:59:59Z");
      const existingSessions = await prisma.posSession.findMany({
        where: { sessionDate: { gte: startOfRange, lte: endOfRange } },
        select: { id: true, settlementId: true },
      });
      if (existingSessions.length > 0) {
        // Delete linked settlements first
        const settlementIds = [...new Set(existingSessions.filter(s => s.settlementId).map(s => s.settlementId!))];
        for (const sid of settlementIds) {
          await prisma.settlementMatch.deleteMany({ where: { settlementId: sid } });
          await prisma.posSession.updateMany({ where: { settlementId: sid }, data: { settlementId: null } });
          await prisma.dailySettlement.delete({ where: { id: sid } });
        }
        await prisma.posSession.deleteMany({
          where: { id: { in: existingSessions.map(s => s.id) } },
        });
      }
    }

    let created = 0;
    let skipped = 0;
    let fetched = 0;
    let usedSessionsApi = false;
    let sessionApiError: string | null = null;
    let sessionApiRaw: unknown = null;
    let sampleSessionKeys: string[] | null = null;
    let detailSampleKeys: string[] | null = null;

    // Try register sessions API first (has payment mode breakdown)
    try {
      const sessionsData = await zakya.listRegisterSessions(dateFrom, dateTo);
      sessionApiRaw = sessionsData;
      const sessions = sessionsData.register_sessions || sessionsData.registersessions || [];

      if (sessions.length > 0) {
        usedSessionsApi = true;
        fetched = sessions.length;

        // Log what fields the LIST endpoint returns (first session)
        sampleSessionKeys = Object.keys(sessions[0] as Record<string, unknown>);

        for (const s of sessions) {
          const existing = await prisma.posSession.findUnique({ where: { zakyaSessionId: s.session_id } });
          if (existing) { skipped++; continue; }

          // Fetch individual session detail for payment breakdown
          let detail: Record<string, unknown> = s as Record<string, unknown>;
          try {
            const detailData = await zakya.getRegisterSession(s.session_id);
            const detailSession = detailData.register_session || detailData.registersession;
            if (detailSession) {
              detail = detailSession as Record<string, unknown>;
              if (!detailSampleKeys) detailSampleKeys = Object.keys(detail);
            }
            // Small delay to avoid rate limiting
            await zakya.delay(200);
          } catch {
            // If detail fetch fails, use list data
          }

          // Parse payment modes — check detail first, then list data
          let cashSales = parseFloat(String(detail.cash_sales || s.cash_sales || 0)) || 0;
          let cardSales = parseFloat(String(detail.card_sales || s.card_sales || 0)) || 0;
          let upiSales = 0;
          let financeSales = 0;
          let creditSales = 0;

          // Try payment_modes array from detail or list
          const paymentModes = (detail.payment_modes || detail.payment_summary || s.payment_modes) as Array<{ payment_mode: string; amount: number }> | undefined;
          if (paymentModes && Array.isArray(paymentModes)) {
            // Reset to avoid double-counting
            cashSales = 0; cardSales = 0;
            for (const pm of paymentModes) {
              const mode = (pm.payment_mode || "").toUpperCase();
              const amt = parseFloat(String(pm.amount || 0)) || 0;
              if (mode.includes("CASH")) cashSales += amt;
              else if (mode.includes("UPI") || mode.includes("PHONEPE") || mode.includes("GPAY") || mode.includes("GOOGLE")) upiSales += amt;
              else if (mode.includes("BAJAJ") || mode.includes("FINANCE") || mode.includes("EMI")) financeSales += amt;
              else if (mode.includes("CREDIT")) creditSales += amt;
              else if (mode.includes("CARD") || mode.includes("ICICI") || mode.includes("HDFC") || mode.includes("BANK") || mode.includes("MESPOS")) cardSales += amt;
              else cardSales += amt; // Default unknown modes to card
            }
          }

          // Cash drawer details — prefer detail endpoint data
          const cashIn = parseFloat(String(detail.cash_in || detail.cash_in_amount || 0)) || 0;
          const cashOut = parseFloat(String(detail.cash_out || detail.cash_out_amount || 0)) || 0;
          const cashRefunds = parseFloat(String(detail.cash_refunds || detail.refund_amount || detail.cash_refund || 0)) || 0;
          const expectedCash = parseFloat(String(detail.expected_cash || detail.expected_cash_amount || detail.expected_cash_in_drawer || s.expected_cash || 0)) || 0;
          const countedCash = detail.counted_cash !== undefined && detail.counted_cash !== null
            ? parseFloat(String(detail.counted_cash))
            : (detail.amount_counted_at_end !== undefined ? parseFloat(String(detail.amount_counted_at_end))
            : (detail.closing_balance !== undefined ? parseFloat(String(detail.closing_balance)) : null));
          const cashDiscrepancy = parseFloat(String(detail.discrepancy || detail.cash_discrepancy || detail.cash_difference || 0)) || 0;

          const totalSales = parseFloat(String(detail.total_sales || s.total_sales || 0)) || 0;
          const sessionDate = s.opened_time ? new Date(s.opened_time) : new Date(dateFrom);
          await prisma.posSession.create({
            data: {
              zakyaSessionId: s.session_id,
              sessionDate,
              openedAt: s.opened_time ? new Date(s.opened_time) : sessionDate,
              closedAt: s.closed_time ? new Date(s.closed_time) : null,
              registerName: s.register_name || "POS",
              cashierName: s.session_number,
              cashSales, cardSales, upiSales, financeSales, creditSales,
              totalSales,
              cashIn, cashOut, cashRefunds, expectedCash, countedCash, cashDiscrepancy,
              cashInHand: expectedCash || cashSales,
              cashDeposited: 0,
              invoiceCount: parseFloat(String(detail.invoice_count || s.invoice_count || 0)) || 0,
              rawData: JSON.parse(JSON.stringify(detail)),
            },
          });
          created++;
        }
      } else {
        sessionApiError = "Register sessions API returned 0 sessions";
      }
    } catch (sessionErr) {
      sessionApiError = sessionErr instanceof Error ? sessionErr.message : String(sessionErr);
      console.warn("Register sessions API failed:", sessionApiError);
    }

    // Fallback: aggregate from invoices
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

    return successResponse({
      fetched, created, skipped,
      source: usedSessionsApi ? "sessions" : "invoices",
      sessionApiError,
      sessionApiKeys: sessionApiRaw ? Object.keys(sessionApiRaw as Record<string, unknown>) : null,
      sampleSessionKeys,
      detailSampleKeys,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch POS sessions", 500);
  }
}
