export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError, getServerSession } from "@/lib/auth-helpers";

// GET — List uploaded statements
export async function GET() {
  try {
    await requireAuth(["ADMIN", "SUPERVISOR", "ACCOUNTS_MANAGER"]);

    const statements = await prisma.bankStatement.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { uploadedBy: { select: { name: true } } },
    });

    return successResponse(statements);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch statements", 500);
  }
}

// POST — Upload and parse bank statement via Claude AI
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    await requireAuth(["ADMIN", "SUPERVISOR", "ACCOUNTS_MANAGER"]);
    const userId = (session?.user as { userId?: string })?.userId || "";

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const bank = formData.get("bank") as string || "HDFC";

    if (!file) return errorResponse("No file uploaded", 400);

    // Read file content
    const text = await file.text();

    // Get Claude API key from settings
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return errorResponse("Claude API key not configured. Add ANTHROPIC_API_KEY to .env", 400);

    // Parse the CSV/XLS content using Claude
    const parsePrompt = `You are a bank statement parser. Parse the following ${bank} bank statement CSV/text data and extract transactions.

Return a JSON array of transactions with this exact structure:
[
  {
    "date": "YYYY-MM-DD",
    "description": "transaction description",
    "reference": "cheque/utr/ref number if available",
    "amount": 1234.56,
    "type": "CREDIT" or "DEBIT",
    "balance": 5678.90
  }
]

Rules:
- Extract ALL transactions from the data
- Date must be YYYY-MM-DD format
- Amount must be a positive number
- Type is CREDIT for deposits/incoming, DEBIT for withdrawals/outgoing
- Balance is the closing balance after that transaction (if available, else null)
- Reference is the cheque number, UTR, or transaction reference
- Return ONLY the JSON array, no other text

Bank statement data:
${text.slice(0, 50000)}`;

    // Helper: call Claude with retry for overloaded errors
    const callClaude = async (prompt: string, retries = 2): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey!,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 8192,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (res.ok) return { ok: true, data: await res.json() };
        const errText = await res.text();
        const isOverloaded = errText.includes("overloaded") || res.status === 529;
        if (isOverloaded && attempt < retries) {
          await new Promise(r => setTimeout(r, 3000 * (attempt + 1))); // wait 3s, 6s
          continue;
        }
        return { ok: false, error: isOverloaded
          ? "AI service is temporarily busy. Please try again in a minute."
          : `AI processing failed (${res.status}). Please try again.` };
      }
      return { ok: false, error: "AI service unavailable. Please try again later." };
    };

    const claudeResult = await callClaude(parsePrompt);
    if (!claudeResult.ok) return errorResponse(claudeResult.error, 503);

    const claudeData = claudeResult.data as { content?: Array<{ text?: string }> };
    const responseText = claudeData.content?.[0]?.text || "";

    // Extract JSON from response
    let transactions: Array<{
      date: string; description: string; reference: string;
      amount: number; type: "CREDIT" | "DEBIT"; balance: number | null;
    }> = [];

    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        transactions = JSON.parse(jsonMatch[0]);
      }
    } catch {
      return errorResponse("Failed to parse Claude response as JSON", 500);
    }

    if (transactions.length === 0) {
      return errorResponse("No transactions found in the uploaded file", 400);
    }

    // Calculate totals
    const totalCredits = transactions.filter(t => t.type === "CREDIT").reduce((s, t) => s + t.amount, 0);
    const totalDebits = transactions.filter(t => t.type === "DEBIT").reduce((s, t) => s + t.amount, 0);
    const dates = transactions.map(t => new Date(t.date)).filter(d => !isNaN(d.getTime()));
    const fromDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : undefined;
    const toDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : undefined;

    // Create statement with transactions
    const statement = await prisma.bankStatement.create({
      data: {
        bank,
        fileName: file.name,
        fromDate,
        toDate,
        totalCredits,
        totalDebits,
        txnCount: transactions.length,
        uploadedById: userId,
        transactions: {
          create: transactions.map(t => ({
            date: new Date(t.date),
            description: t.description,
            reference: t.reference || null,
            amount: t.amount,
            type: t.type as "CREDIT" | "DEBIT",
            balance: t.balance,
          })),
        },
      },
      include: { transactions: true },
    });

    // Now use Claude to match transactions against vendors and bills
    const vendors = await prisma.vendor.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
    });

    const pendingBills = await prisma.vendorBill.findMany({
      where: { status: { in: ["PENDING", "PARTIALLY_PAID"] } },
      select: {
        id: true, billNo: true, amount: true, paidAmount: true,
        vendor: { select: { id: true, name: true } },
      },
    });

    const matchPrompt = `You are a bank reconciliation AI. Match bank transactions to vendors and bills.

VENDORS (id, name):
${vendors.map(v => `${v.id}|${v.name}|${v.code}`).join("\n")}

PENDING BILLS (id, billNo, amount, balance, vendorId, vendorName):
${pendingBills.map(b => `${b.id}|${b.billNo}|${b.amount}|${b.amount - b.paidAmount}|${b.vendor.id}|${b.vendor.name}`).join("\n")}

BANK TRANSACTIONS TO MATCH:
${statement.transactions.map(t => `${t.id}|${t.date.toISOString().slice(0, 10)}|${t.description}|${t.amount}|${t.type}|${t.reference || ""}`).join("\n")}

For each DEBIT transaction, try to match it to a vendor payment:
- Match by vendor name in description
- Match by amount to pending bill balance
- Match by reference/cheque number

Return a JSON array:
[
  {
    "txnId": "transaction id",
    "vendorId": "matched vendor id or null",
    "billId": "matched bill id or null",
    "category": "VENDOR_PAYMENT" | "EXPENSE_SALARY" | "EXPENSE_RENT" | "EXPENSE_UTILITY" | "EXPENSE_DELIVERY" | "EXPENSE_OTHER" | "TRANSFER" | "UNKNOWN",
    "confidence": 0.0 to 1.0,
    "flagReason": "reason if suspicious, else null"
  }
]

Flag suspicious transactions if:
- Large round amounts with no matching vendor (>50000)
- Duplicate amounts on same day
- Description contains unusual keywords
- Unknown payee for large debits

Return ONLY the JSON array.`;

    const matchResult = await callClaude(matchPrompt);

    let matchedCount = 0;
    let flaggedCount = 0;

    if (matchResult.ok) {
      const matchText = (matchResult.data as { content?: Array<{ text?: string }> }).content?.[0]?.text || "";

      try {
        const jsonMatch = matchText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const matches: Array<{
            txnId: string; vendorId: string | null; billId: string | null;
            category: string; confidence: number; flagReason: string | null;
          }> = JSON.parse(jsonMatch[0]);

          for (const match of matches) {
            const updateData: Record<string, unknown> = {
              confidence: match.confidence || 0,
              suggestedCategory: match.category,
            };

            if (match.vendorId) updateData.suggestedVendorId = match.vendorId;
            if (match.billId) updateData.suggestedBillId = match.billId;

            if (match.flagReason) {
              updateData.matchStatus = "FLAGGED";
              updateData.flagReason = match.flagReason;
              flaggedCount++;
            } else if (match.vendorId || match.category?.startsWith("EXPENSE")) {
              updateData.matchStatus = "MATCHED";
              matchedCount++;
            }

            await prisma.bankTransaction.update({
              where: { id: match.txnId },
              data: updateData,
            }).catch(() => {}); // Skip if txnId doesn't match
          }
        }
      } catch {
        // AI matching failed — transactions stay UNMATCHED, user can review manually
      }
    }

    // Update statement counts
    await prisma.bankStatement.update({
      where: { id: statement.id },
      data: { matchedCount, flaggedCount },
    });

    return successResponse({
      id: statement.id,
      txnCount: transactions.length,
      matchedCount,
      flaggedCount,
      totalCredits,
      totalDebits,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to process statement", 500);
  }
}
