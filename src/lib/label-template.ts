export interface LabelElement {
  id: string;
  type: "text" | "barcode";
  field: "productName" | "sku" | "mrp" | "sellingPrice" | "brand" | "barcode" | "storeName";
  label: string;
  visible: boolean;
  fontSize: number; // in pt
  bold: boolean;
  align: "left" | "center" | "right";
}

export interface LabelTemplate {
  name: string;
  width: number; // mm
  height: number; // mm
  padding: number; // mm
  barcodeHeight: number; // mm
  elements: LabelElement[];
}

export const DEFAULT_TEMPLATE: LabelTemplate = {
  name: "Default",
  width: 50,
  height: 25,
  padding: 2,
  barcodeHeight: 8,
  elements: [
    { id: "storeName", type: "text", field: "storeName", label: "Store Name", visible: false, fontSize: 6, bold: true, align: "center" },
    { id: "productName", type: "text", field: "productName", label: "Product Name", visible: false, fontSize: 6, bold: false, align: "center" },
    { id: "sku", type: "text", field: "sku", label: "SKU", visible: true, fontSize: 7, bold: true, align: "center" },
    { id: "barcode", type: "barcode", field: "barcode", label: "Barcode", visible: true, fontSize: 0, bold: false, align: "center" },
    { id: "mrp", type: "text", field: "mrp", label: "MRP", visible: true, fontSize: 7, bold: true, align: "center" },
    { id: "sellingPrice", type: "text", field: "sellingPrice", label: "Offer Price", visible: true, fontSize: 8, bold: true, align: "center" },
    { id: "brand", type: "text", field: "brand", label: "Brand", visible: false, fontSize: 6, bold: false, align: "center" },
  ],
};

const STORAGE_KEY = "bch-label-template";

export function loadTemplate(): LabelTemplate {
  if (typeof window === "undefined") return DEFAULT_TEMPLATE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as LabelTemplate;
  } catch { /* */ }
  return DEFAULT_TEMPLATE;
}

export function saveTemplate(template: LabelTemplate): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(template));
}

export function formatFieldValue(
  field: LabelElement["field"],
  product: { name: string; sku: string; mrp: number; sellingPrice: number; brand?: string }
): string {
  switch (field) {
    case "productName": return product.name;
    case "sku": return product.sku;
    case "mrp": return `MRP: ₹${product.mrp.toLocaleString("en-IN")}`;
    case "sellingPrice": return `₹${product.sellingPrice.toLocaleString("en-IN")}`;
    case "brand": return product.brand || "";
    case "storeName": return "Bharath Cycle Hub";
    case "barcode": return product.sku;
    default: return "";
  }
}
