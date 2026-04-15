/**
 * Run: npx tsx prisma/setup-bins.ts
 * Creates the proper bins for Bharath Cycle Hub, Centre, and Warehouses.
 * Safe to run multiple times (upserts by code).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BINS = [
  // Bharath Cycle Hub — Ground Floor
  { code: "BCH-GF-01", name: "Assembly Bin", location: "Bharath Cycle Hub - Ground Floor", zone: "BCH-GF" },
  { code: "BCH-GF-02", name: "Second Hand Bin", location: "Bharath Cycle Hub - Ground Floor", zone: "BCH-GF" },
  { code: "BCH-GF-03", name: "Electric Cycle Bin", location: "Bharath Cycle Hub - Ground Floor", zone: "BCH-GF" },
  { code: "BCH-GF-04", name: "Hybrid Bin", location: "Bharath Cycle Hub - Ground Floor", zone: "BCH-GF" },
  { code: "BCH-GF-05", name: "Road Bin", location: "Bharath Cycle Hub - Ground Floor", zone: "BCH-GF" },
  // Bharath Cycle Hub — First Floor
  { code: "BCH-FF-01", name: "Gear MTB Bin", location: "Bharath Cycle Hub - First Floor", zone: "BCH-FF" },
  { code: "BCH-FF-02", name: "Non-Gear MTB Bin", location: "Bharath Cycle Hub - First Floor", zone: "BCH-FF" },
  { code: "BCH-FF-03", name: "Ladies Cycle Bin", location: "Bharath Cycle Hub - First Floor", zone: "BCH-FF" },
  { code: "BCH-FF-04", name: "Kids Cycle Bin", location: "Bharath Cycle Hub - First Floor", zone: "BCH-FF" },
  // Bharath Cycle Centre
  { code: "BCC-01", name: "Bharath Cycle Centre - Main", location: "Bharath Cycle Centre", zone: "BCC" },
  // Warehouses
  { code: "G1-01", name: "Warehouse G1", location: "Warehouse G1", zone: "G1" },
  { code: "G2-01", name: "Warehouse G2", location: "Warehouse G2", zone: "G2" },
];

async function main() {
  console.log("Setting up bins...");

  for (const bin of BINS) {
    await prisma.bin.upsert({
      where: { code: bin.code },
      update: { name: bin.name, location: bin.location, zone: bin.zone },
      create: bin,
    });
    console.log(`  ✅ ${bin.code} — ${bin.name}`);
  }

  // Deactivate old bins that don't match the new codes
  const validCodes = BINS.map((b) => b.code);
  const deactivated = await prisma.bin.updateMany({
    where: { code: { notIn: validCodes } },
    data: { isActive: false },
  });

  if (deactivated.count > 0) {
    console.log(`  ⚠️  Deactivated ${deactivated.count} old bins`);
  }

  const total = await prisma.bin.count({ where: { isActive: true } });
  console.log(`\nDone! ${total} active bins.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
