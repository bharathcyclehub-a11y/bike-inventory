export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";

interface OverdueItem {
  type: string;
  label: string;
  owner: string;
  count: number;
}

// Vercel Cron: every 6 hours — "0 */6 * * *"
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret (same pattern as zoho-pull)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return errorResponse("CRON_SECRET not configured", 500);
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse("Unauthorized", 401);
    }

    const now = new Date();
    const h72 = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    // Check all overdue items in parallel
    const [unverifiedInwards, pendingDeliveries, stalePOs] = await Promise.all([
      // Unverified inwards > 72h
      prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int AS count
        FROM "InventoryTransaction"
        WHERE type = 'INWARD'
          AND notes LIKE '%[UNVERIFIED]%'
          AND "createdAt" < ${h72}
      `,

      // Pending deliveries > 72h
      prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int AS count
        FROM "Delivery"
        WHERE status IN ('PENDING', 'VERIFIED', 'SCHEDULED')
          AND "invoiceDate" < ${h72}
      `,

      // POs without tracking > 72h
      prisma.$queryRaw<[{ count: number }]>`
        SELECT COUNT(*)::int AS count
        FROM "PurchaseOrder"
        WHERE status IN ('SENT_TO_VENDOR', 'PARTIALLY_RECEIVED')
          AND "orderDate" < ${h72}
      `,
    ]);

    const inwardsCount = unverifiedInwards[0]?.count || 0;
    const deliveriesCount = pendingDeliveries[0]?.count || 0;
    const posCount = stalePOs[0]?.count || 0;

    const overdueItems: OverdueItem[] = [];

    if (inwardsCount > 0) {
      overdueItems.push({
        type: "inward",
        label: `${inwardsCount} inwards unverified (72h+)`,
        owner: "Nithin",
        count: inwardsCount,
      });
    }

    if (deliveriesCount > 0) {
      overdueItems.push({
        type: "delivery",
        label: `${deliveriesCount} delivery pending (72h+)`,
        owner: "Ranjitha",
        count: deliveriesCount,
      });
    }

    if (posCount > 0) {
      overdueItems.push({
        type: "purchase_order",
        label: `${posCount} PO without tracking (72h+)`,
        owner: "Abhi Gowda",
        count: posCount,
      });
    }

    // No overdue items — nothing to alert
    if (overdueItems.length === 0) {
      return successResponse({
        alertSent: false,
        message: "No overdue items found",
        checkedAt: now.toISOString(),
      });
    }

    // Build WhatsApp message
    const lines = ["*BCH Overdue Alert*", ""];
    for (const item of overdueItems) {
      const emoji = item.type === "purchase_order" ? "\uD83D\uDFE1" : "\uD83D\uDD34";
      lines.push(`${emoji} ${item.label} — ${item.owner}`);
    }
    lines.push("", "Open app: https://bike-inventory.vercel.app");
    const message = lines.join("\n");

    // Fetch alert phone numbers from AlertConfig
    const alertConfig = await prisma.alertConfig.findUnique({
      where: { id: "singleton" },
    });

    const phones: string[] = alertConfig?.redFlagPhones
      ? alertConfig.redFlagPhones.split(",").map((p) => p.trim()).filter(Boolean)
      : [];

    let whatsappSent = false;
    const whatsappErrors: string[] = [];

    // If WHATSAPP_TOKEN exists, attempt to send via WhatsApp Cloud API
    const whatsappToken = process.env.WHATSAPP_TOKEN;
    const whatsappPhoneId = process.env.WHATSAPP_PHONE_ID;

    if (whatsappToken && whatsappPhoneId && phones.length > 0) {
      for (const phone of phones) {
        try {
          const res = await fetch(
            `https://graph.facebook.com/v21.0/${whatsappPhoneId}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${whatsappToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: phone.replace(/\D/g, ""), // strip non-digits
                type: "text",
                text: { body: message },
              }),
            }
          );

          if (!res.ok) {
            const errBody = await res.text();
            whatsappErrors.push(`Phone ${phone}: ${res.status} — ${errBody}`);
          } else {
            whatsappSent = true;
          }
        } catch (e) {
          whatsappErrors.push(
            `Phone ${phone}: ${e instanceof Error ? e.message : "Send failed"}`
          );
        }
      }
    } else if (phones.length > 0) {
      // No WhatsApp token — generate deep links instead
      console.log("[overdue-alerts] WhatsApp token not configured. Alert data returned in response.");
    }

    return successResponse({
      alertSent: whatsappSent,
      overdueItems,
      message,
      phones,
      whatsappConfigured: !!(whatsappToken && whatsappPhoneId),
      whatsappErrors: whatsappErrors.length > 0 ? whatsappErrors : undefined,
      checkedAt: now.toISOString(),
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Overdue alerts check failed",
      500
    );
  }
}
