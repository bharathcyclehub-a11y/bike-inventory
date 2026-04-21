export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse, paginatedResponse, parseSearchParams } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";
import { ZohoInventoryClient } from "@/lib/zoho-inventory";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Cycle name is required"),
  condition: z.enum(["EXCELLENT", "GOOD", "FAIR", "SCRAP"]),
  costPrice: z.number().min(0, "Cost price must be positive"),
  photoUrl: z.string().min(1, "Photo is required"),
  photoUrls: z.array(z.string()).optional(),
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().optional(),
  zohoInvoiceNo: z.string().optional(),
  notes: z.string().optional(),
});

// GET: List second-hand cycles
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { page, limit, skip, searchParams } = parseSearchParams(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const showArchived = searchParams.get("showArchived") === "true";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (!showArchived) where.isArchived = false;
    if (status && status !== "ALL") where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [cycles, total] = await Promise.all([
      prisma.secondHandCycle.findMany({
        where,
        include: {
          bin: { select: { code: true, name: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.secondHandCycle.count({ where }),
    ]);

    return paginatedResponse(cycles, total, page, limit);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to fetch", 500);
  }
}

// POST: Create second-hand cycle
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN", "OUTWARDS_CLERK"]);
    const body = await req.json();
    const data = createSchema.parse(body);

    // Auto-generate SKU: SH-0001
    const lastCycle = await prisma.secondHandCycle.findFirst({
      orderBy: { sku: "desc" },
      select: { sku: true },
    });
    const seq = lastCycle ? parseInt(lastCycle.sku.replace("SH-", ""), 10) + 1 : 1;
    const sku = `SH-${String(seq).padStart(4, "0")}`;

    // Find BCH-GF-02 (Second Hand Bin)
    const secondHandBin = await prisma.bin.findFirst({
      where: { code: "BCH-GF-02" },
      select: { id: true },
    });

    // Create the cycle
    const cycle = await prisma.secondHandCycle.create({
      data: {
        sku,
        name: data.name,
        condition: data.condition,
        costPrice: data.costPrice,
        photoUrl: data.photoUrl,
        photoUrls: data.photoUrls || [data.photoUrl],
        customerName: data.customerName,
        customerPhone: data.customerPhone || null,
        zohoInvoiceNo: data.zohoInvoiceNo || null,
        binId: secondHandBin?.id || null,
        notes: data.notes || null,
        createdById: user.id,
      },
    });

    // Push to Zoho Inventory (best effort — don't fail if Zoho is down)
    let zohoItemId: string | null = null;
    try {
      const inventory = new ZohoInventoryClient();
      const ready = await inventory.init();
      if (ready) {
        const condLabel = data.condition.charAt(0) + data.condition.slice(1).toLowerCase();
        const result = await inventory.createItem({
          name: `SH | ${data.name} - ${condLabel}`,
          sku,
          purchase_rate: data.costPrice,
          rate: 0,
          item_type: "inventory",
          product_type: "goods",
        });
        zohoItemId = result.item?.item_id || null;
        if (zohoItemId) {
          await prisma.secondHandCycle.update({
            where: { id: cycle.id },
            data: { zohoItemId },
          });
        }
      }
    } catch {
      // Zoho push failed — cycle is still saved locally
    }

    return successResponse({ ...cycle, zohoItemId }, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to create", 400);
  }
}
