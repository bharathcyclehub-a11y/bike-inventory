export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { requireAuth, AuthError } from "@/lib/auth-helpers";

const BCH_SOPS = [
  // Sales
  { title: "Floor Greeting & Customer Approach", description: "Greet every walk-in customer within 30 seconds. Ask if they need help. Guide to the right section (cycles, accessories, service).", category: "Sales", frequency: "SOP_DAILY" as const },
  { title: "Test Ride / Demo Process", description: "Offer a test ride for every bicycle enquiry. Adjust seat height, explain gears, accompany the customer. Log test ride in the register.", category: "Sales", frequency: "SOP_DAILY" as const },
  { title: "Sales Pitch & Upsell Checklist", description: "After cycle selection: offer accessories (helmet, lock, pump, bell), extended warranty, free first service. Note upsell in invoice remarks.", category: "Sales", frequency: "SOP_DAILY" as const },
  { title: "Quotation Follow-Up", description: "Follow up on all pending quotations within 48 hours via WhatsApp or call. Log outcome in CRM.", category: "Sales", frequency: "SOP_DAILY" as const },
  { title: "Showroom Display Arrangement", description: "Ensure all display bicycles are clean, properly aligned, price-tagged, and wheels inflated. Rotate featured models weekly.", category: "Sales", frequency: "SOP_WEEKLY" as const },

  // Service
  { title: "Mechanic Job Card Checklist", description: "Open a job card for every service intake. Record: customer name, phone, cycle model, issues reported, parts needed, expected delivery date.", category: "Service", frequency: "SOP_DAILY" as const },
  { title: "Service Quality Check (PDI)", description: "Before handing over a serviced cycle: check brakes, gears, tyre pressure, chain tension, bell, reflectors. Sign off on the job card.", category: "Service", frequency: "SOP_DAILY" as const },
  { title: "Workshop Tool Audit", description: "Count and verify all workshop tools against the master list. Report missing/damaged tools to supervisor.", category: "Service", frequency: "SOP_WEEKLY" as const },
  { title: "Service Bay Cleanliness", description: "Clean service bay at end of day: sweep floor, wipe workbench, store tools, dispose of waste oil and packaging.", category: "Service", frequency: "SOP_DAILY" as const },

  // Operations
  { title: "Store Opening Procedure", description: "Arrive 15 min before opening. Unlock, switch on lights/AC/CCTV, check overnight alerts, boot POS, arrange display, update today's task board.", category: "Ops", frequency: "SOP_DAILY" as const },
  { title: "Store Closing Procedure", description: "Count cash, lock display cases, switch off AC/lights, arm CCTV, lock all doors. Submit closing report on WhatsApp group.", category: "Ops", frequency: "SOP_DAILY" as const },
  { title: "Daily Cleaning & Housekeeping", description: "Sweep and mop showroom floor, dust display units, clean glass doors, empty dustbins, restock washroom supplies.", category: "Ops", frequency: "SOP_DAILY" as const },
  { title: "Inventory Spot Check", description: "Pick 10 random SKUs from the system. Physically verify quantity matches. Report discrepancies to admin.", category: "Ops", frequency: "SOP_WEEKLY" as const },
  { title: "Monthly Deep Clean & Pest Control", description: "Full warehouse cleaning, pest spray, check for leaks/dampness, reorganize bins, update bin labels.", category: "Ops", frequency: "SOP_MONTHLY" as const },
  { title: "CCTV & Security Check", description: "Verify all CCTV cameras are recording. Check footage storage. Test alarm system. Report any blind spots.", category: "Ops", frequency: "SOP_WEEKLY" as const },

  // Finance
  { title: "Daily Cash Count & Reconciliation", description: "Count physical cash at closing. Match with POS/Zoho sales total. Record denomination-wise in register. Report variance > Rs.100.", category: "Finance", frequency: "SOP_DAILY" as const },
  { title: "Bank Deposit", description: "Deposit excess cash (above float of Rs.5000) to bank. Enter deposit slip number in accounts register. WhatsApp photo of slip to admin.", category: "Finance", frequency: "SOP_DAILY" as const },
  { title: "Monthly Expense Reconciliation", description: "Reconcile all expense entries against receipts. Flag missing receipts. Submit expense summary to admin by 5th of next month.", category: "Finance", frequency: "SOP_MONTHLY" as const },

  // Billing
  { title: "Invoice Accuracy Check", description: "Before printing: verify customer name, phone, product details, serial numbers, prices, GST, payment mode. Cross-check with Zoho.", category: "Billing", frequency: "SOP_DAILY" as const },
  { title: "Delivery Note Verification", description: "Match delivery note items against invoice. Verify quantities, condition, accessories included. Get customer signature on delivery note.", category: "Billing", frequency: "SOP_DAILY" as const },
];

export async function POST() {
  try {
    await requireAuth(["ADMIN"]);

    let created = 0;

    for (const sop of BCH_SOPS) {
      const existing = await prisma.sOP.findFirst({
        where: { title: sop.title },
      });

      if (!existing) {
        // Use first admin as creator
        const admin = await prisma.user.findFirst({
          where: { role: "ADMIN", isActive: true },
          select: { id: true },
        });

        if (!admin) return errorResponse("No active admin user found", 400);

        await prisma.sOP.create({
          data: {
            title: sop.title,
            description: sop.description,
            category: sop.category,
            frequency: sop.frequency,
            createdById: admin.id,
          },
        });

        created++;
      }
    }

    return successResponse({ created, total: BCH_SOPS.length }, 201);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error.message, error.status);
    return errorResponse(error instanceof Error ? error.message : "Failed to seed SOPs", 400);
  }
}
