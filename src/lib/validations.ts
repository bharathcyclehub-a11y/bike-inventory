import { z } from "zod";

export const productSchema = z.object({
  sku: z.string().min(1, "SKU is required").max(50),
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  brandId: z.string().min(1, "Brand is required"),
  type: z.enum([
    "BICYCLE",
    "SPARE_PART",
    "ACCESSORY",
    "BOX_PIECE",
    "WIP",
    "FINISHED_GOOD",
  ]),
  status: z.enum(["ACTIVE", "INACTIVE", "DISCONTINUED"]).optional(),
  condition: z
    .enum([
      "NEW",
      "REFURBISHED_EXCELLENT",
      "REFURBISHED_GOOD",
      "REFURBISHED_FAIR",
      "DAMAGED",
    ])
    .optional(),
  costPrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  mrp: z.number().min(0).optional(),
  gstRate: z.number().min(0).max(100).optional(),
  hsnCode: z.string().optional(),
  currentStock: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
  maxStock: z.number().int().min(0).optional(),
  reorderLevel: z.number().int().min(0).optional(),
  reorderQty: z.number().int().min(0).optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  binId: z.string().optional(),
});

export const productUpdateSchema = productSchema.partial();

export const inwardSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  referenceNo: z.string().optional(),
  notes: z.string().optional(),
  isRgp: z.boolean().optional(),
  rgpReturnDate: z.string().optional(),
});

export const outwardSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  referenceNo: z.string().optional(),
  notes: z.string().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  parentId: z.string().optional(),
  movingLevel: z.enum(["FAST", "NORMAL", "SLOW"]).optional(),
  reorderLevel: z.number().int().min(0).optional(),
});

export const brandSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  whatsappNumber: z.string().optional(),
  cdTermsDays: z.number().int().min(0).optional(),
  cdPercentage: z.number().min(0).max(100).optional(),
});

export const binSchema = z.object({
  code: z.string().min(1, "Code is required").max(20),
  name: z.string().min(1, "Name is required").max(100),
  location: z.string().min(1, "Location is required"),
  zone: z.string().optional(),
  capacity: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const stockCountSchema = z.object({
  title: z.string().min(1, "Title is required"),
  assignedToId: z.string().min(1, "Assigned user is required"),
  dueDate: z.string().min(1, "Due date is required"),
  notes: z.string().optional(),
  productIds: z.array(z.string()).optional(),
});

export const stockCountUpdateSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        id: z.string(),
        countedQty: z.number().int().min(0),
        notes: z.string().optional(),
      })
    )
    .optional(),
});

export const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum([
    "ADMIN",
    "SUPERVISOR",
    "MANAGER",
    "INWARDS_CLERK",
    "OUTWARDS_CLERK",
  ]),
  accessCode: z.string().min(1, "Access code is required"),
});

export const vendorSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  code: z.string().min(1, "Code is required").max(20),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  whatsappNumber: z.string().optional(),
  paymentTermDays: z.number().int().min(0).optional(),
  creditLimit: z.number().min(0).optional(),
  cdTermsDays: z.number().int().min(0).optional(),
  cdPercentage: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

export const vendorUpdateSchema = vendorSchema.partial();

export const vendorContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  designation: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  whatsapp: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

export const purchaseOrderSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  expectedDate: z.string().optional(),
  deliveryAddress: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().min(1, "Product is required"),
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
    unitPrice: z.number().min(0, "Price must be positive"),
    gstRate: z.number().min(0).max(100).optional(),
  })).min(1, "At least one item is required"),
});

export const vendorBillSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  purchaseOrderId: z.string().optional(),
  billNo: z.string().min(1, "Bill number is required"),
  billDate: z.string().min(1, "Bill date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  amount: z.number().min(0.01, "Amount must be positive"),
  notes: z.string().optional(),
});

export const vendorPaymentSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  billId: z.string().optional(),
  amount: z.number().min(0.01, "Amount must be positive"),
  paymentMode: z.enum(["CASH", "CHEQUE", "NEFT", "RTGS", "UPI", "CREDIT_ADJUSTMENT"]),
  paymentDate: z.string().min(1, "Payment date is required"),
  referenceNo: z.string().optional(),
  creditId: z.string().optional(),
  notes: z.string().optional(),
});

export const vendorCreditSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  creditNoteNo: z.string().min(1, "Credit note number is required"),
  amount: z.number().min(0.01, "Amount must be positive"),
  reason: z.string().optional(),
  creditDate: z.string().min(1, "Credit date is required"),
  notes: z.string().optional(),
});

export const expenseSchema = z.object({
  date: z.string().min(1, "Date is required"),
  amount: z.number().min(0.01, "Amount must be positive"),
  category: z.enum(["DELIVERY", "TRANSPORT", "SHOP_MAINTENANCE", "UTILITIES", "SALARY_ADVANCE", "FOOD_TEA", "STATIONERY", "MISCELLANEOUS"]),
  description: z.string().min(1, "Description is required"),
  paidBy: z.string().min(1, "Paid by is required"),
  paymentMode: z.enum(["CASH", "CHEQUE", "NEFT", "RTGS", "UPI", "CREDIT_ADJUSTMENT"]),
  referenceNo: z.string().optional(),
  notes: z.string().optional(),
});

export const billFollowUpSchema = z.object({
  nextFollowUpDate: z.string().optional(),
  followUpNotes: z.string().optional(),
});
