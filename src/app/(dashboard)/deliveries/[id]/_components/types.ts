export interface LineItem {
  name: string;
  sku: string;
  quantity: number;
  rate: number;
  itemTotal?: number;
}

export interface DeliveryData {
  id: string;
  invoiceNo: string;
  zohoInvoiceId: string | null;
  invoiceDate: string;
  invoiceAmount: number;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  customerArea: string | null;
  customerPincode: string | null;
  alternatePhone: string | null;
  status: string;
  verifiedAt: string | null;
  verifiedBy: { name: string } | null;
  scheduledDate: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  expectedReadyDate: string | null;
  prebookNotes: string | null;
  flagReason: string | null;
  flaggedAt: string | null;
  lineItems: LineItem[] | null;
  notes: string | null;
  deliveryNotes: string | null;
  whatsAppScheduledSent: boolean;
  whatsAppDispatchedSent: boolean;
  whatsAppDeliveredSent: boolean;
  freeAccessories: string | null;
  reversePickup: boolean;
  googleReviewLink: string | null;
  invoiceType: string | null;
  isOutstation: boolean;
  courierName: string | null;
  courierTrackingNo: string | null;
  vehicleNo: string | null;
  courierCost: number | null;
  paymentStatus: {
    hasPending: boolean;
    balance: number;
    paidAmount: number;
    totalAmount: number;
  } | null;
  salesPerson: string | null;
  selfFillToken: string | null;
  selfFillCompletedAt: string | null;
  mapsLink: string | null;
}

export function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

// Inside Bangalore: simpler flow, no "Out" step
export const BANGALORE_STEPS = ["PENDING", "SCHEDULED", "DELIVERED"];
// Outside Bangalore (outstation): full flow with dispatch
export const OUTSTATION_STEPS = ["PENDING", "SCHEDULED", "OUT_FOR_DELIVERY", "DELIVERED"];
// Courier outstation: packed -> shipped -> transit -> delivered
export const COURIER_STEPS = ["VERIFIED", "PACKED", "SHIPPED", "IN_TRANSIT", "DELIVERED"];
