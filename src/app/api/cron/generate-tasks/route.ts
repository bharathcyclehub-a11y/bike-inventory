export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function POST() {
  try {
    const now = new Date();
    const suggestions: Array<{
      source: "OVERDUE_BILL" | "STUCK_DELIVERY" | "LOW_STOCK" | "EXPIRING_CD" | "UNBINNED_INBOUND";
      sourceId: string;
      title: string;
      description: string;
      suggestedRole: string;
      urgencyScore: number;
    }> = [];

    // 1. Overdue vendor bills → ACCOUNTS_MANAGER
    const overdueBills = await prisma.vendorBill.findMany({
      where: {
        status: { in: ["PENDING", "PARTIALLY_PAID"] },
        dueDate: { lt: now },
      },
      select: { id: true, billNo: true, amount: true, paidAmount: true, dueDate: true, vendor: { select: { name: true } } },
      take: 20,
    });

    for (const bill of overdueBills) {
      const daysOverdue = Math.floor((now.getTime() - new Date(bill.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      const balance = bill.amount - bill.paidAmount;
      suggestions.push({
        source: "OVERDUE_BILL",
        sourceId: bill.id,
        title: `Pay overdue bill ${bill.billNo} — ${bill.vendor.name}`,
        description: `₹${Math.round(balance).toLocaleString("en-IN")} overdue by ${daysOverdue} days`,
        suggestedRole: "ACCOUNTS_MANAGER",
        urgencyScore: Math.min(100, 50 + daysOverdue * 2),
      });
    }

    // 2. Stuck deliveries (>48h in PENDING or VERIFIED) → OUTWARDS_EXECUTIVE
    const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const stuckDeliveries = await prisma.delivery.findMany({
      where: {
        status: { in: ["PENDING", "VERIFIED"] },
        createdAt: { lt: cutoff48h },
      },
      select: { id: true, invoiceNo: true, customerName: true, status: true, createdAt: true },
      take: 20,
    });

    for (const del of stuckDeliveries) {
      const hoursStuck = Math.floor((now.getTime() - new Date(del.createdAt).getTime()) / (1000 * 60 * 60));
      suggestions.push({
        source: "STUCK_DELIVERY",
        sourceId: del.id,
        title: `Schedule delivery ${del.invoiceNo} — ${del.customerName}`,
        description: `Stuck in ${del.status} for ${hoursStuck}h`,
        suggestedRole: "OUTWARDS_EXECUTIVE",
        urgencyScore: Math.min(100, 60 + Math.floor(hoursStuck / 12) * 5),
      });
    }

    // 3. Products at/below reorder level → PURCHASE_MANAGER
    const lowStock = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        reorderLevel: { gt: 0 },
        currentStock: { lte: prisma.product.fields.reorderLevel as never },
      },
      select: { id: true, name: true, sku: true, currentStock: true, reorderLevel: true, reservedStock: true },
      take: 20,
    });

    // Fallback: raw query for the self-referencing comparison
    const lowStockProducts = lowStock.length > 0 ? lowStock : await prisma.$queryRaw<Array<{ id: string; name: string; sku: string; currentStock: number; reorderLevel: number; reservedStock: number }>>`
      SELECT id, name, sku, "currentStock", "reorderLevel", "reservedStock"
      FROM "Product"
      WHERE status = 'ACTIVE' AND "reorderLevel" > 0 AND ("currentStock" - "reservedStock") <= "reorderLevel"
      LIMIT 20
    `;

    for (const p of lowStockProducts) {
      const available = p.currentStock - (p.reservedStock || 0);
      suggestions.push({
        source: "LOW_STOCK",
        sourceId: p.id,
        title: `Reorder ${p.name} (${p.sku})`,
        description: `Available: ${available}, Reorder level: ${p.reorderLevel}`,
        suggestedRole: "PURCHASE_MANAGER",
        urgencyScore: available <= 0 ? 95 : 60,
      });
    }

    // 4. CD deadline within 3 days → ACCOUNTS_MANAGER (urgent)
    const vendorsWithCD = await prisma.vendor.findMany({
      where: { cdTermsDays: { not: null }, cdPercentage: { gt: 0 } },
      select: { id: true, name: true, cdTermsDays: true, cdPercentage: true },
    });

    if (vendorsWithCD.length > 0) {
      const cdVendorMap = new Map(vendorsWithCD.map((v) => [v.id, v]));
      const unpaidBills = await prisma.vendorBill.findMany({
        where: {
          status: { in: ["PENDING", "PARTIALLY_PAID"] },
          vendorId: { in: vendorsWithCD.map((v) => v.id) },
        },
        select: { id: true, billNo: true, billDate: true, amount: true, paidAmount: true, vendorId: true },
      });

      for (const bill of unpaidBills) {
        const vendor = cdVendorMap.get(bill.vendorId);
        if (!vendor?.cdTermsDays) continue;
        const cdDeadline = new Date(bill.billDate);
        cdDeadline.setDate(cdDeadline.getDate() + vendor.cdTermsDays);
        const daysLeft = Math.floor((cdDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft >= 0 && daysLeft <= 3) {
          const balance = bill.amount - bill.paidAmount;
          const discount = Math.round(balance * (vendor.cdPercentage! / 100));
          suggestions.push({
            source: "EXPIRING_CD",
            sourceId: bill.id,
            title: `CD expiring: ${bill.billNo} — ${vendor.name}`,
            description: `Pay ₹${Math.round(balance).toLocaleString("en-IN")} within ${daysLeft}d to save ₹${discount.toLocaleString("en-IN")} (${vendor.cdPercentage}%)`,
            suggestedRole: "ACCOUNTS_MANAGER",
            urgencyScore: daysLeft === 0 ? 100 : 90,
          });
        }
      }
    }

    // 5. Inbound shipments delivered but items not binned → INWARDS_EXECUTIVE
    const unbinnedInbound = await prisma.inboundShipment.findMany({
      where: {
        status: { in: ["DELIVERED", "PARTIALLY_DELIVERED"] },
        lineItems: { some: { isDelivered: true, binId: null } },
      },
      select: {
        id: true, shipmentNo: true, brand: { select: { name: true } },
        _count: { select: { lineItems: { where: { isDelivered: true, binId: null } } } },
      },
      take: 20,
    });

    for (const shipment of unbinnedInbound) {
      suggestions.push({
        source: "UNBINNED_INBOUND",
        sourceId: shipment.id,
        title: `Bin items from ${shipment.brand?.name || "Unknown"} shipment`,
        description: `${shipment._count.lineItems} items delivered but not assigned to bins`,
        suggestedRole: "INWARDS_EXECUTIVE",
        urgencyScore: 70,
      });
    }

    // Deduplicate: skip suggestions where a PENDING one already exists for same source+sourceId
    const existingPending = await prisma.taskSuggestion.findMany({
      where: { status: "PENDING" },
      select: { source: true, sourceId: true },
    });
    const existingKeys = new Set(existingPending.map((e) => `${e.source}:${e.sourceId}`));

    const newSuggestions = suggestions.filter((s) => !existingKeys.has(`${s.source}:${s.sourceId}`));

    if (newSuggestions.length > 0) {
      await prisma.taskSuggestion.createMany({
        data: newSuggestions.map((s) => ({
          source: s.source as never,
          sourceId: s.sourceId,
          title: s.title,
          description: s.description,
          suggestedRole: s.suggestedRole as never,
          urgencyScore: s.urgencyScore,
        })),
      });
    }

    // Clean up old dismissed suggestions (>7 days)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    await prisma.taskSuggestion.deleteMany({
      where: { status: "DISMISSED", updatedAt: { lt: weekAgo } },
    });

    return successResponse({
      scanned: {
        overdueBills: overdueBills.length,
        stuckDeliveries: stuckDeliveries.length,
        lowStock: lowStockProducts.length,
        expiringCD: suggestions.filter((s) => s.source === "EXPIRING_CD").length,
        unbinnedInbound: unbinnedInbound.length,
      },
      created: newSuggestions.length,
      skippedDuplicates: suggestions.length - newSuggestions.length,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to generate tasks", 500);
  }
}
