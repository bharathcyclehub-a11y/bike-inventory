import { prisma } from "@/lib/db";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function fuzzyScore(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  const wordsA = na.split(" ");
  const wordsB = nb.split(" ");
  const total = Math.max(wordsA.length, wordsB.length);
  if (total === 0) return 0;

  let matched = 0;
  for (const wa of wordsA) {
    if (wa.length < 2) continue;
    if (wordsB.some((wb) => wb === wa || wb.includes(wa) || wa.includes(wb))) matched++;
  }

  return matched / total;
}

interface MatchInput {
  id: string;
  rawSku: string | null;
  rawName: string;
}

interface MatchResult {
  itemId: string;
  productId: string;
  status: "AUTO_MATCHED" | "FUZZY_MATCHED";
  confidence: number;
}

export async function runMatchPipeline(
  items: MatchInput[],
  brandId: string
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];
  const matched = new Set<string>();

  // Phase 1: Saved mappings
  const mappings = await prisma.brandSkuMapping.findMany({
    where: { brandId },
    include: { product: { select: { id: true, status: true } } },
  });

  const skuMap = new Map<string, string>();
  const nameMap = new Map<string, string>();

  for (const m of mappings) {
    if (m.product.status !== "ACTIVE") continue;
    if (m.brandSku) skuMap.set(m.brandSku.toLowerCase(), m.productId);
    nameMap.set(normalize(m.brandName), m.productId);
  }

  for (const item of items) {
    if (item.rawSku && skuMap.has(item.rawSku.toLowerCase())) {
      results.push({ itemId: item.id, productId: skuMap.get(item.rawSku.toLowerCase())!, status: "AUTO_MATCHED", confidence: 1.0 });
      matched.add(item.id);
    } else if (nameMap.has(normalize(item.rawName))) {
      results.push({ itemId: item.id, productId: nameMap.get(normalize(item.rawName))!, status: "AUTO_MATCHED", confidence: 0.95 });
      matched.add(item.id);
    }
  }

  // Phase 2: Exact SKU match
  const unmatchedWithSku = items.filter((i) => !matched.has(i.id) && i.rawSku);
  if (unmatchedWithSku.length > 0) {
    const skus = unmatchedWithSku.map((i) => i.rawSku!);
    const products = await prisma.product.findMany({
      where: { sku: { in: skus }, status: "ACTIVE" },
      select: { id: true, sku: true },
    });
    const productBySku = new Map(products.map((p) => [p.sku.toLowerCase(), p.id]));

    for (const item of unmatchedWithSku) {
      const pid = productBySku.get(item.rawSku!.toLowerCase());
      if (pid) {
        results.push({ itemId: item.id, productId: pid, status: "AUTO_MATCHED", confidence: 1.0 });
        matched.add(item.id);
      }
    }
  }

  // Phase 3: Fuzzy name match — only for brand's products
  const unmatched = items.filter((i) => !matched.has(i.id));
  if (unmatched.length > 0) {
    const brandProducts = await prisma.product.findMany({
      where: { brandId, status: "ACTIVE" },
      select: { id: true, name: true, sku: true },
    });

    for (const item of unmatched) {
      let bestScore = 0;
      let bestProductId = "";

      for (const p of brandProducts) {
        const score = fuzzyScore(item.rawName, p.name);
        if (score > bestScore) {
          bestScore = score;
          bestProductId = p.id;
        }
      }

      if (bestScore >= 0.6) {
        results.push({ itemId: item.id, productId: bestProductId, status: "FUZZY_MATCHED", confidence: bestScore });
        matched.add(item.id);
      }
    }
  }

  return results;
}

export async function populateBchContext(
  itemIds: string[]
): Promise<Map<string, { currentStock: number; reservedStock: number; reorderLevel: number; suggestedQty: number }>> {
  const items = await prisma.brandStockItem.findMany({
    where: { id: { in: itemIds }, productId: { not: null } },
    select: { id: true, productId: true, product: { select: { currentStock: true, reservedStock: true, reorderLevel: true } } },
  });

  const result = new Map<string, { currentStock: number; reservedStock: number; reorderLevel: number; suggestedQty: number }>();
  for (const item of items) {
    if (!item.product) continue;
    const available = item.product.currentStock - item.product.reservedStock;
    const suggestedQty = Math.max(0, item.product.reorderLevel - available);
    result.set(item.id, {
      currentStock: item.product.currentStock,
      reservedStock: item.product.reservedStock,
      reorderLevel: item.product.reorderLevel,
      suggestedQty,
    });
  }
  return result;
}
