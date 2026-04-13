import type {
  Product,
  InventoryTransaction,
  Category,
  Brand,
  Bin,
  SerialItem,
} from "@/types";

export const MOCK_CATEGORIES: Category[] = [
  { id: "cat-1", name: "Bicycles", movingLevel: "FAST", reorderLevel: 5 },
  { id: "cat-2", name: "Spare Parts", movingLevel: "FAST", reorderLevel: 20 },
  { id: "cat-3", name: "Accessories", movingLevel: "NORMAL", reorderLevel: 10 },
  { id: "cat-4", name: "Tyres & Tubes", movingLevel: "FAST", reorderLevel: 15 },
  { id: "cat-5", name: "Brakes", movingLevel: "NORMAL", reorderLevel: 10 },
  { id: "cat-6", name: "Chains & Gears", movingLevel: "SLOW", reorderLevel: 5 },
  { id: "cat-7", name: "Lights", movingLevel: "NORMAL", reorderLevel: 8 },
  { id: "cat-8", name: "Helmets & Safety", movingLevel: "NORMAL", reorderLevel: 5 },
];

export const MOCK_BRANDS: Brand[] = [
  { id: "br-1", name: "Hero", contactPhone: "9876543210", whatsappNumber: "919876543210", cdTermsDays: 15, cdPercentage: 2 },
  { id: "br-2", name: "BSA", contactPhone: "9876543211", whatsappNumber: "919876543211", cdTermsDays: 10, cdPercentage: 1.5 },
  { id: "br-3", name: "Firefox", contactPhone: "9876543212", whatsappNumber: "919876543212", cdTermsDays: 20, cdPercentage: 3 },
  { id: "br-4", name: "Hercules", contactPhone: "9876543213", whatsappNumber: "919876543213" },
  { id: "br-5", name: "Trek", contactPhone: "9876543214", whatsappNumber: "919876543214", cdTermsDays: 30, cdPercentage: 2.5 },
  { id: "br-6", name: "Giant", contactPhone: "9876543215", whatsappNumber: "919876543215" },
  { id: "br-7", name: "Btwin", contactPhone: "9876543216", whatsappNumber: "919876543216" },
  { id: "br-8", name: "Atlas", contactPhone: "9876543217", whatsappNumber: "919876543217" },
  { id: "br-9", name: "Avon", contactPhone: "9876543218", whatsappNumber: "919876543218" },
  { id: "br-10", name: "Montra", contactPhone: "9876543219", whatsappNumber: "919876543219" },
];

export const MOCK_BINS: Bin[] = [
  { id: "bin-1", code: "A-01-01", name: "Aisle A Rack 1 Shelf 1", location: "Store", zone: "A", isActive: true },
  { id: "bin-2", code: "A-01-02", name: "Aisle A Rack 1 Shelf 2", location: "Store", zone: "A", isActive: true },
  { id: "bin-3", code: "A-02-01", name: "Aisle A Rack 2 Shelf 1", location: "Store", zone: "A", isActive: true },
  { id: "bin-4", code: "B-01-01", name: "Aisle B Rack 1 Shelf 1", location: "Store", zone: "B", isActive: true },
  { id: "bin-5", code: "W-01-01", name: "Warehouse Rack 1 Shelf 1", location: "Warehouse", zone: "W1", isActive: true },
  { id: "bin-6", code: "W-01-02", name: "Warehouse Rack 1 Shelf 2", location: "Warehouse", zone: "W1", isActive: true },
  { id: "bin-7", code: "W-02-01", name: "Warehouse Rack 2 Shelf 1", location: "Warehouse", zone: "W2", isActive: true },
];

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "prod-1", sku: "HRO-MTB26", name: "Hero Sprint 26T MTB", categoryId: "cat-1", category: MOCK_CATEGORIES[0],
    brandId: "br-1", brand: MOCK_BRANDS[0], type: "BICYCLE", status: "ACTIVE", condition: "NEW",
    costPrice: 8500, sellingPrice: 12000, mrp: 13500, gstRate: 12, hsnCode: "8712",
    currentStock: 8, minStock: 2, maxStock: 20, reorderLevel: 5, reorderQty: 10,
    size: "26\"", color: "Red", imageUrls: [], tags: ["popular"], binId: "bin-1", bin: MOCK_BINS[0],
    createdAt: "2024-01-15", updatedAt: "2024-03-10",
  },
  {
    id: "prod-2", sku: "BSA-RD700", name: "BSA Roadster 700C", categoryId: "cat-1", category: MOCK_CATEGORIES[0],
    brandId: "br-2", brand: MOCK_BRANDS[1], type: "BICYCLE", status: "ACTIVE", condition: "NEW",
    costPrice: 12000, sellingPrice: 16500, mrp: 18000, gstRate: 12, hsnCode: "8712",
    currentStock: 3, minStock: 1, maxStock: 10, reorderLevel: 3, reorderQty: 5,
    size: "700C", color: "Blue", imageUrls: [], tags: [], binId: "bin-2", bin: MOCK_BINS[1],
    createdAt: "2024-01-20", updatedAt: "2024-03-08",
  },
  {
    id: "prod-3", sku: "FFX-HYB24", name: "Firefox Hybrid 24T", categoryId: "cat-1", category: MOCK_CATEGORIES[0],
    brandId: "br-3", brand: MOCK_BRANDS[2], type: "BICYCLE", status: "ACTIVE", condition: "NEW",
    costPrice: 15000, sellingPrice: 21000, mrp: 24000, gstRate: 12, hsnCode: "8712",
    currentStock: 2, minStock: 1, maxStock: 8, reorderLevel: 3, reorderQty: 4,
    size: "24\"", color: "Black", imageUrls: [], tags: ["premium"], binId: "bin-3", bin: MOCK_BINS[2],
    createdAt: "2024-02-01", updatedAt: "2024-03-12",
  },
  {
    id: "prod-4", sku: "HRO-TUB26", name: "Hero Tube 26x1.95", categoryId: "cat-4", category: MOCK_CATEGORIES[3],
    brandId: "br-1", brand: MOCK_BRANDS[0], type: "SPARE_PART", status: "ACTIVE", condition: "NEW",
    costPrice: 120, sellingPrice: 200, mrp: 250, gstRate: 18, hsnCode: "4011",
    currentStock: 45, minStock: 10, maxStock: 100, reorderLevel: 15, reorderQty: 30,
    imageUrls: [], tags: ["fast-moving"], binId: "bin-4", bin: MOCK_BINS[3],
    createdAt: "2024-01-10", updatedAt: "2024-03-14",
  },
  {
    id: "prod-5", sku: "GEN-BRK01", name: "V-Brake Pad Set", categoryId: "cat-5", category: MOCK_CATEGORIES[4],
    brandId: "br-4", brand: MOCK_BRANDS[3], type: "SPARE_PART", status: "ACTIVE", condition: "NEW",
    costPrice: 80, sellingPrice: 150, mrp: 180, gstRate: 18, hsnCode: "8714",
    currentStock: 30, minStock: 5, maxStock: 60, reorderLevel: 10, reorderQty: 20,
    imageUrls: [], tags: [], binId: "bin-5", bin: MOCK_BINS[4],
    createdAt: "2024-02-05", updatedAt: "2024-03-11",
  },
  {
    id: "prod-6", sku: "GEN-CHN01", name: "Single Speed Chain", categoryId: "cat-6", category: MOCK_CATEGORIES[5],
    brandId: "br-4", brand: MOCK_BRANDS[3], type: "SPARE_PART", status: "ACTIVE", condition: "NEW",
    costPrice: 150, sellingPrice: 280, mrp: 320, gstRate: 18, hsnCode: "7315",
    currentStock: 18, minStock: 5, maxStock: 40, reorderLevel: 8, reorderQty: 15,
    imageUrls: [], tags: [], binId: "bin-5", bin: MOCK_BINS[4],
    createdAt: "2024-01-25", updatedAt: "2024-03-09",
  },
  {
    id: "prod-7", sku: "GEN-LGT01", name: "USB Rechargeable Front Light", categoryId: "cat-7", category: MOCK_CATEGORIES[6],
    brandId: "br-7", brand: MOCK_BRANDS[6], type: "ACCESSORY", status: "ACTIVE", condition: "NEW",
    costPrice: 250, sellingPrice: 450, mrp: 500, gstRate: 18,
    currentStock: 12, minStock: 3, maxStock: 30, reorderLevel: 5, reorderQty: 10,
    imageUrls: [], tags: [], binId: "bin-6", bin: MOCK_BINS[5],
    createdAt: "2024-02-10", updatedAt: "2024-03-13",
  },
  {
    id: "prod-8", sku: "GEN-HLM01", name: "Adult Helmet - L", categoryId: "cat-8", category: MOCK_CATEGORIES[7],
    brandId: "br-7", brand: MOCK_BRANDS[6], type: "ACCESSORY", status: "ACTIVE", condition: "NEW",
    costPrice: 400, sellingPrice: 700, mrp: 800, gstRate: 18,
    currentStock: 6, minStock: 2, maxStock: 15, reorderLevel: 4, reorderQty: 8,
    imageUrls: [], tags: [], binId: "bin-6", bin: MOCK_BINS[5],
    createdAt: "2024-02-15", updatedAt: "2024-03-10",
  },
  {
    id: "prod-9", sku: "HRO-TYR26", name: "Hero Tyre 26x2.10", categoryId: "cat-4", category: MOCK_CATEGORIES[3],
    brandId: "br-1", brand: MOCK_BRANDS[0], type: "SPARE_PART", status: "ACTIVE", condition: "NEW",
    costPrice: 350, sellingPrice: 550, mrp: 650, gstRate: 18, hsnCode: "4011",
    currentStock: 22, minStock: 5, maxStock: 50, reorderLevel: 10, reorderQty: 20,
    imageUrls: [], tags: ["fast-moving"], binId: "bin-7", bin: MOCK_BINS[6],
    createdAt: "2024-01-18", updatedAt: "2024-03-14",
  },
  {
    id: "prod-10", sku: "HRC-KDS20", name: "Hercules Kids 20T", categoryId: "cat-1", category: MOCK_CATEGORIES[0],
    brandId: "br-4", brand: MOCK_BRANDS[3], type: "BICYCLE", status: "ACTIVE", condition: "NEW",
    costPrice: 5500, sellingPrice: 7800, mrp: 8500, gstRate: 12, hsnCode: "8712",
    currentStock: 4, minStock: 1, maxStock: 10, reorderLevel: 3, reorderQty: 5,
    size: "20\"", color: "Green", imageUrls: [], tags: [], binId: "bin-3", bin: MOCK_BINS[2],
    createdAt: "2024-02-20", updatedAt: "2024-03-12",
  },
];

const now = new Date();
const today = now.toISOString().split("T")[0];

export const MOCK_TRANSACTIONS: InventoryTransaction[] = [
  { id: "txn-1", type: "INWARD", productId: "prod-4", product: MOCK_PRODUCTS[3], quantity: 20, previousStock: 25, newStock: 45, referenceNo: "INV-2024-0312", userId: "user-nithin", isRgp: false, rgpReturned: false, createdAt: `${today}T09:30:00` },
  { id: "txn-2", type: "INWARD", productId: "prod-9", product: MOCK_PRODUCTS[8], quantity: 10, previousStock: 12, newStock: 22, referenceNo: "INV-2024-0313", userId: "user-nithin", isRgp: false, rgpReturned: false, createdAt: `${today}T10:15:00` },
  { id: "txn-3", type: "INWARD", productId: "prod-1", product: MOCK_PRODUCTS[0], quantity: 5, previousStock: 3, newStock: 8, referenceNo: "INV-2024-0314", userId: "user-nithin", isRgp: false, rgpReturned: false, createdAt: `${today}T11:00:00` },
  { id: "txn-4", type: "OUTWARD", productId: "prod-1", product: MOCK_PRODUCTS[0], quantity: 1, previousStock: 9, newStock: 8, referenceNo: "SALE-0456", userId: "user-ranjitha", isRgp: false, rgpReturned: false, createdAt: `${today}T09:45:00` },
  { id: "txn-5", type: "OUTWARD", productId: "prod-4", product: MOCK_PRODUCTS[3], quantity: 3, previousStock: 48, newStock: 45, referenceNo: "SALE-0457", userId: "user-ranjitha", isRgp: false, rgpReturned: false, createdAt: `${today}T10:30:00` },
  { id: "txn-6", type: "OUTWARD", productId: "prod-7", product: MOCK_PRODUCTS[6], quantity: 2, previousStock: 14, newStock: 12, referenceNo: "SALE-0458", userId: "user-ranjitha", isRgp: false, rgpReturned: false, createdAt: `${today}T11:15:00` },
  { id: "txn-7", type: "OUTWARD", productId: "prod-5", product: MOCK_PRODUCTS[4], quantity: 4, previousStock: 34, newStock: 30, referenceNo: "SALE-0459", userId: "user-ranjitha", isRgp: false, rgpReturned: false, createdAt: `${today}T11:45:00` },
  { id: "txn-8", type: "OUTWARD", productId: "prod-8", product: MOCK_PRODUCTS[7], quantity: 1, previousStock: 7, newStock: 6, referenceNo: "SALE-0460", userId: "user-ranjitha", isRgp: false, rgpReturned: false, createdAt: `${today}T12:00:00` },
  { id: "txn-9", type: "INWARD", productId: "prod-5", product: MOCK_PRODUCTS[4], quantity: 10, previousStock: 20, newStock: 30, referenceNo: "INV-2024-0315", notes: "RGP return from service center", userId: "user-nithin", isRgp: true, rgpReturnDate: "2024-04-15", rgpReturned: false, createdAt: `${today}T14:00:00` },
  { id: "txn-10", type: "OUTWARD", productId: "prod-10", product: MOCK_PRODUCTS[9], quantity: 1, previousStock: 5, newStock: 4, referenceNo: "SALE-0461", userId: "user-ranjitha", isRgp: false, rgpReturned: false, createdAt: `${today}T14:30:00` },
];

export const MOCK_SERIAL_ITEMS: SerialItem[] = [
  { id: "ser-1", serialCode: "HRO-MTB26-0001", productId: "prod-1", status: "IN_STOCK", condition: "NEW", binId: "bin-1", barcodeFormat: "CODE128", receivedAt: "2024-03-01", createdAt: "2024-03-01", updatedAt: "2024-03-01" },
  { id: "ser-2", serialCode: "HRO-MTB26-0002", productId: "prod-1", status: "IN_STOCK", condition: "NEW", binId: "bin-1", barcodeFormat: "CODE128", receivedAt: "2024-03-01", createdAt: "2024-03-01", updatedAt: "2024-03-01" },
  { id: "ser-3", serialCode: "HRO-MTB26-0003", productId: "prod-1", status: "SOLD", condition: "NEW", binId: "bin-1", barcodeFormat: "CODE128", receivedAt: "2024-03-01", soldAt: "2024-03-10", customerName: "Ramesh K", saleInvoiceNo: "SALE-0440", createdAt: "2024-03-01", updatedAt: "2024-03-10" },
  { id: "ser-4", serialCode: "BSA-RD700-0001", productId: "prod-2", status: "IN_STOCK", condition: "NEW", binId: "bin-2", barcodeFormat: "CODE128", receivedAt: "2024-02-20", createdAt: "2024-02-20", updatedAt: "2024-02-20" },
  { id: "ser-5", serialCode: "FFX-HYB24-0001", productId: "prod-3", status: "IN_STOCK", condition: "NEW", binId: "bin-3", barcodeFormat: "CODE128", receivedAt: "2024-03-05", createdAt: "2024-03-05", updatedAt: "2024-03-05" },
  { id: "ser-6", serialCode: "HRC-KDS20-0001", productId: "prod-10", status: "SOLD", condition: "NEW", barcodeFormat: "CODE128", receivedAt: "2024-02-25", soldAt: "2024-03-14", customerName: "Suresh P", saleInvoiceNo: "SALE-0461", createdAt: "2024-02-25", updatedAt: "2024-03-14" },
];

export function getTodayInwards() {
  return MOCK_TRANSACTIONS.filter((t) => t.type === "INWARD");
}

export function getTodayOutwards() {
  return MOCK_TRANSACTIONS.filter((t) => t.type === "OUTWARD");
}

export function getLowStockProducts() {
  return MOCK_PRODUCTS.filter((p) => p.currentStock <= p.reorderLevel);
}

export function getTotalStockValue() {
  return MOCK_PRODUCTS.reduce((sum, p) => sum + p.currentStock * p.costPrice, 0);
}

export function getTodayInwardQty() {
  return getTodayInwards().reduce((sum, t) => sum + t.quantity, 0);
}

export function getTodayOutwardQty() {
  return getTodayOutwards().reduce((sum, t) => sum + t.quantity, 0);
}
