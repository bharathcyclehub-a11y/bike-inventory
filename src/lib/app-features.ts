// The app's feature catalog + permission shape. Kept in a dependency-free module so both the
// API routes and the server-side permission resolver can import it without a circular dependency.

export const APP_FEATURES = [
  { key: "dashboard", label: "Dashboard (Home)", hasApprove: false, hasCreate: false, hasFetch: false },
  { key: "inbound", label: "Inbound Tracking", hasApprove: true, hasCreate: true, hasFetch: true },
  { key: "deliveries", label: "Deliveries & Dispatch", hasApprove: true, hasCreate: true, hasFetch: true },
  { key: "stock", label: "Stock & Inventory", hasApprove: false, hasCreate: false, hasFetch: true },
  { key: "stock_audit", label: "Stock Audit / Count", hasApprove: true, hasCreate: true, hasFetch: false },
  { key: "transfers", label: "Stock Transfers", hasApprove: true, hasCreate: true, hasFetch: false },
  { key: "vendors", label: "Vendors", hasApprove: false, hasCreate: true, hasFetch: true },
  { key: "bills", label: "Bills & Payments", hasApprove: true, hasCreate: true, hasFetch: true },
  { key: "purchase_orders", label: "Purchase Orders", hasApprove: true, hasCreate: true, hasFetch: false },
  { key: "expenses", label: "Expenses", hasApprove: true, hasCreate: true, hasFetch: false },
  { key: "reports", label: "Reports", hasApprove: false, hasCreate: false, hasFetch: false },
  { key: "team", label: "Team Management", hasApprove: false, hasCreate: false, hasFetch: false },
  { key: "barcode", label: "Barcode Scanner", hasApprove: false, hasCreate: false, hasFetch: false },
  { key: "reorder", label: "Reorder & AI Insights", hasApprove: false, hasCreate: false, hasFetch: false },
  { key: "second_hand", label: "Second Hand / Refurbished", hasApprove: false, hasCreate: true, hasFetch: false },
  { key: "zoho", label: "Zoho Settings & Sync", hasApprove: false, hasCreate: false, hasFetch: true },
  { key: "whatsapp_templates", label: "WhatsApp Templates", hasApprove: false, hasCreate: false, hasFetch: false },
  { key: "customers", label: "Customers & Receivables", hasApprove: false, hasCreate: true, hasFetch: false },
  { key: "vendor_issues", label: "Vendor Issues", hasApprove: false, hasCreate: true, hasFetch: false },
];

export interface FeaturePermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  fetch: boolean;
}

export type RolePermissions = Record<string, Record<string, FeaturePermission>>;
