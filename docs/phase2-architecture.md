# Phase 2 Architecture -- Accounts, Vendors, Purchase Orders, WhatsApp

**Project:** Bike Inventory PWA  
**Version:** 0.2.0  
**Date:** 2026-04-13  
**Status:** Design Complete -- Ready for Implementation  
**Stack:** Next.js 14 App Router, Prisma 6, PostgreSQL, Tailwind CSS, NextAuth, Zod

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [New Prisma Models -- Full Schema](#2-new-prisma-models----full-schema)
3. [Updated Role Permissions Matrix](#3-updated-role-permissions-matrix)
4. [API Route Tree](#4-api-route-tree)
5. [Page Tree with Wireframe Descriptions](#5-page-tree-with-wireframe-descriptions)
6. [WhatsApp PO Template](#6-whatsapp-po-template)
7. [PO Auto-Generation Logic](#7-po-auto-generation-logic)
8. [Data Flow Diagrams](#8-data-flow-diagrams)
9. [Migration Strategy](#9-migration-strategy)
10. [Implementation Order](#10-implementation-order)

---

## 1. Design Principles

These principles govern every Phase 2 decision and ensure compatibility with the existing Phase 1 codebase.

- **Additive only.** No existing table is altered in a breaking way. New columns on existing tables are nullable or have defaults.
- **Same patterns.** Every new API route follows the existing `requireAuth` + Zod validation + `prisma.$transaction` pattern established in Phase 1 (`src/app/api/inventory/inwards/route.ts` is the reference).
- **Same response shape.** All API responses use `successResponse`, `errorResponse`, and `paginatedResponse` from `src/lib/api-utils.ts`.
- **Mobile-first PWA.** All new pages follow the existing `max-w-lg mx-auto px-4 py-4` container pattern. Cards, badges, and bottom-nav remain untouched.
- **Indian locale.** All currency formatted as INR with `en-IN` locale. All dates displayed in IST.
- **Zod at the boundary.** Every POST/PUT/PATCH body is validated through a Zod schema before touching Prisma.

---

## 2. New Prisma Models -- Full Schema

Add the following to `prisma/schema.prisma`. The existing models (`User`, `Product`, `Brand`, `Category`, `Bin`, `InventoryTransaction`, `SerialItem`, `SerialTransactionItem`, `StockCount`, `StockCountItem`) remain unchanged except for the new relation fields noted at the end of this section.

### 2.1 New Enums

```prisma
enum ExpenseCategory {
  DELIVERY
  OFFICE
  MAINTENANCE
  MARKETING
  SALARY
  MISC
}

enum PaymentMode {
  CASH
  CHEQUE
  NEFT
  UPI
  CREDIT_ADJUSTMENT
}

enum POStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  SENT
  PARTIAL
  RECEIVED
  CANCELLED
}

enum BillStatus {
  UNPAID
  PARTIAL
  PAID
  OVERDUE
  CANCELLED
}

enum ApprovalAction {
  APPROVED
  REJECTED
}
```

### 2.2 Vendor

```prisma
model Vendor {
  id              String    @id @default(cuid())
  code            String    @unique              // Auto: "VND-0001"
  name            String
  tradeName       String?                        // Legal trade name if different
  gstNumber       String?   @unique
  panNumber       String?

  // Address
  addressLine1    String?
  addressLine2    String?
  city            String?
  state           String?
  pincode         String?

  // Bank
  bankName        String?
  bankBranch      String?
  accountNumber   String?
  ifscCode        String?
  upiId           String?

  // Terms
  paymentTermDays Int       @default(30)         // Net payment days
  cdTermsDays     Int?                           // Cash Discount window
  cdPercentage    Float?                         // Cash Discount %
  creditLimit     Float     @default(0)          // Max outstanding allowed

  // Communication
  email           String?
  phone           String?
  whatsappNumber  String?                        // For PO sharing via wa.me

  // Classification
  categories      String[]                       // Tags: ["tyres", "spares", "accessories"]
  isActive        Boolean   @default(true)
  notes           String?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  contacts        VendorContact[]
  purchaseOrders  PurchaseOrder[]
  bills           VendorBill[]
  payments        VendorPayment[]
  credits         VendorCredit[]

  @@index([name])
  @@index([gstNumber])
  @@index([isActive])
}
```

### 2.3 VendorContact

```prisma
model VendorContact {
  id          String   @id @default(cuid())
  vendorId    String
  vendor      Vendor   @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  name        String
  designation String?                            // "Sales Manager", "Accounts"
  phone       String?
  whatsapp    String?
  email       String?
  isPrimary   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([vendorId])
}
```

### 2.4 PurchaseOrder

```prisma
model PurchaseOrder {
  id                String     @id @default(cuid())
  poNumber          String     @unique            // Auto: "PO-2026-0001"
  vendorId          String
  vendor            Vendor     @relation(fields: [vendorId], references: [id])
  status            POStatus   @default(DRAFT)

  // Dates
  orderDate         DateTime   @default(now())
  expectedDelivery  DateTime?
  receivedDate      DateTime?

  // Totals (computed from items, stored for query speed)
  subtotal          Float      @default(0)
  gstAmount         Float      @default(0)
  totalAmount       Float      @default(0)
  discountAmount    Float      @default(0)

  // Approval
  approvedById      String?
  approvedBy        User?      @relation("POApprover", fields: [approvedById], references: [id])
  approvedAt        DateTime?
  approvalNotes     String?

  // Creation
  createdById       String
  createdBy         User       @relation("POCreator", fields: [createdById], references: [id])

  // Auto-generation tracking
  isAutoGenerated   Boolean    @default(false)
  triggerProductId  String?                       // Product that triggered auto-PO

  // WhatsApp
  whatsappSentAt    DateTime?
  whatsappSentById  String?

  notes             String?
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt

  // Relations
  items             PurchaseOrderItem[]
  bills             VendorBill[]
  goodsReceipts     GoodsReceipt[]

  @@index([vendorId])
  @@index([status])
  @@index([poNumber])
  @@index([createdById])
  @@index([orderDate])
}
```

### 2.5 PurchaseOrderItem

```prisma
model PurchaseOrderItem {
  id              String        @id @default(cuid())
  purchaseOrderId String
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  productId       String
  product         Product       @relation(fields: [productId], references: [id])

  quantity        Int                             // Ordered qty
  receivedQty     Int           @default(0)       // Received so far
  rate            Float                           // Unit rate (excl. GST)
  gstRate         Float         @default(18)
  discount        Float         @default(0)       // Item-level discount %
  amount          Float                           // qty * rate * (1 - discount/100)

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([purchaseOrderId])
  @@index([productId])
}
```

### 2.6 GoodsReceipt (links PO receiving to inventory)

```prisma
model GoodsReceipt {
  id              String        @id @default(cuid())
  grnNumber       String        @unique           // "GRN-2026-0001"
  purchaseOrderId String
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id])
  receivedById    String
  receivedBy      User          @relation("GRNReceiver", fields: [receivedById], references: [id])

  invoiceNumber   String?                         // Vendor's invoice number
  invoiceDate     DateTime?
  invoiceAmount   Float?

  notes           String?
  receivedAt      DateTime      @default(now())
  createdAt       DateTime      @default(now())

  items           GoodsReceiptItem[]

  @@index([purchaseOrderId])
  @@index([receivedById])
}
```

### 2.7 GoodsReceiptItem

```prisma
model GoodsReceiptItem {
  id              String       @id @default(cuid())
  goodsReceiptId  String
  goodsReceipt    GoodsReceipt @relation(fields: [goodsReceiptId], references: [id], onDelete: Cascade)
  productId       String
  product         Product      @relation(fields: [productId], references: [id])
  quantity        Int                              // Qty received in this GRN
  notes           String?

  @@index([goodsReceiptId])
  @@index([productId])
}
```

### 2.8 VendorBill

```prisma
model VendorBill {
  id              String     @id @default(cuid())
  billNumber      String     @unique              // Vendor's invoice/bill number
  vendorId        String
  vendor          Vendor     @relation(fields: [vendorId], references: [id])
  purchaseOrderId String?
  purchaseOrder   PurchaseOrder? @relation(fields: [purchaseOrderId], references: [id])

  billDate        DateTime
  dueDate         DateTime                        // billDate + vendor.paymentTermDays
  amount          Float
  gstAmount       Float      @default(0)
  totalAmount     Float                           // amount + gstAmount
  paidAmount      Float      @default(0)
  balanceAmount   Float                           // totalAmount - paidAmount

  status          BillStatus @default(UNPAID)

  notes           String?
  createdById     String
  createdBy       User       @relation("BillCreator", fields: [createdById], references: [id])
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  // Relations
  payments        VendorPayment[]

  @@index([vendorId])
  @@index([status])
  @@index([dueDate])
  @@index([purchaseOrderId])
}
```

### 2.9 VendorPayment

```prisma
model VendorPayment {
  id            String      @id @default(cuid())
  paymentNumber String      @unique               // "PAY-2026-0001"
  vendorId      String
  vendor        Vendor      @relation(fields: [vendorId], references: [id])
  billId        String?
  bill          VendorBill? @relation(fields: [billId], references: [id])

  amount        Float
  paymentDate   DateTime
  mode          PaymentMode
  referenceNo   String?                           // Cheque no, UTR, UPI ref
  notes         String?

  // Credit adjustment
  creditId      String?                           // If paying from vendor credit
  credit        VendorCredit? @relation(fields: [creditId], references: [id])

  recordedById  String
  recordedBy    User        @relation("PaymentRecorder", fields: [recordedById], references: [id])
  createdAt     DateTime    @default(now())

  @@index([vendorId])
  @@index([billId])
  @@index([paymentDate])
}
```

### 2.10 VendorCredit

```prisma
model VendorCredit {
  id            String    @id @default(cuid())
  creditNumber  String    @unique                  // "CR-2026-0001"
  vendorId      String
  vendor        Vendor    @relation(fields: [vendorId], references: [id])

  amount        Float                              // Original credit amount
  usedAmount    Float     @default(0)              // Amount applied to payments
  balanceAmount Float                              // amount - usedAmount

  reason        String                             // "Damaged goods return", "Rate difference", etc.
  referenceNo   String?                            // Vendor's credit note number
  creditDate    DateTime
  notes         String?

  recordedById  String
  recordedBy    User      @relation("CreditRecorder", fields: [recordedById], references: [id])
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Payments that used this credit
  payments      VendorPayment[]

  @@index([vendorId])
  @@index([creditDate])
}
```

### 2.11 Expense

```prisma
model Expense {
  id            String          @id @default(cuid())
  expenseNumber String          @unique            // "EXP-2026-0001"
  category      ExpenseCategory
  amount        Float
  date          DateTime
  description   String
  paidBy        String                             // Name of person who paid
  paymentMode   PaymentMode
  referenceNo   String?                            // Receipt/invoice ref
  receiptUrl    String?                            // Uploaded receipt image path

  // Approval
  isReviewed    Boolean         @default(false)
  reviewedById  String?
  reviewedBy    User?           @relation("ExpenseReviewer", fields: [reviewedById], references: [id])
  reviewedAt    DateTime?
  reviewNotes   String?

  // Creator
  createdById   String
  createdBy     User            @relation("ExpenseCreator", fields: [createdById], references: [id])
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@index([category])
  @@index([date])
  @@index([createdById])
  @@index([isReviewed])
}
```

### 2.12 Relation Additions to Existing Models

Add these relation fields to the **existing** `User` model:

```prisma
// Add to User model -- new relation fields only
purchaseOrdersCreated   PurchaseOrder[]   @relation("POCreator")
purchaseOrdersApproved  PurchaseOrder[]   @relation("POApprover")
goodsReceipts           GoodsReceipt[]    @relation("GRNReceiver")
billsCreated            VendorBill[]      @relation("BillCreator")
paymentsRecorded        VendorPayment[]   @relation("PaymentRecorder")
creditsRecorded         VendorCredit[]    @relation("CreditRecorder")
expensesCreated         Expense[]         @relation("ExpenseCreator")
expensesReviewed        Expense[]         @relation("ExpenseReviewer")
```

Add these relation fields to the **existing** `Product` model:

```prisma
// Add to Product model -- new relation fields only
purchaseOrderItems      PurchaseOrderItem[]
goodsReceiptItems       GoodsReceiptItem[]
```

---

## 3. Updated Role Permissions Matrix

Below is the complete permissions matrix for Phase 2. The first column group shows Phase 1 permissions (unchanged). The second group shows new Phase 2 permissions.

### 3.1 Phase 1 Permissions (Unchanged)

| Action                  | ADMIN | SUPERVISOR | MANAGER | INWARDS_CLERK | OUTWARDS_CLERK |
|-------------------------|:-----:|:----------:|:-------:|:-------------:|:--------------:|
| View Dashboard          |  Y    |     Y      |    Y    |      Y        |       Y        |
| Record Inward           |  Y    |     Y      |    Y    |      Y        |       --       |
| Record Outward          |  Y    |     Y      |    Y    |      --       |       Y        |
| View Stock              |  Y    |     Y      |    Y    |      Y        |       Y        |
| Manage Products         |  Y    |     Y      |    Y    |      --       |       --       |
| Manage Categories       |  Y    |     Y      |    --   |      --       |       --       |
| Manage Brands           |  Y    |     Y      |    --   |      --       |       --       |
| Manage Bins             |  Y    |     Y      |    Y    |      Y        |       --       |
| View Serials/Barcodes   |  Y    |     Y      |    Y    |      Y        |       Y        |
| Stock Audit             |  Y    |     Y      |    Y    |      --       |       --       |
| Settings                |  Y    |     --     |    --   |      --       |       --       |

### 3.2 Phase 2 Permissions

| Action                          | ADMIN | SUPERVISOR | MANAGER | INWARDS_CLERK | OUTWARDS_CLERK |
|---------------------------------|:-----:|:----------:|:-------:|:-------------:|:--------------:|
| **Vendor Management**           |       |            |         |               |                |
| Create/Edit Vendor              |  Y    |     Y      |    Y    |      --       |       --       |
| View Vendor List/Detail         |  Y    |     Y      |    Y    |      Y        |       --       |
| Delete/Deactivate Vendor        |  Y    |     --     |    --   |      --       |       --       |
| **Expense Recording**           |       |            |         |               |                |
| Create Expense                  |  Y    |     --     |    Y    |      --       |       --       |
| View Expenses                   |  Y    |     Y      |    Y    |      --       |       --       |
| Review/Approve Expense          |  Y    |     Y      |    --   |      --       |       --       |
| Delete Expense                  |  Y    |     --     |    --   |      --       |       --       |
| **Purchase Orders**             |       |            |         |               |                |
| Create PO (manual)              |  Y    |     Y      |    Y    |      --       |       --       |
| View PO List/Detail             |  Y    |     Y      |    Y    |      Y        |       --       |
| Approve PO                      |  Y    |     --     |    Y    |      --       |       --       |
| Send PO via WhatsApp            |  Y    |     Y      |    Y    |      --       |       --       |
| Receive Goods (GRN)             |  Y    |     Y      |    Y    |      Y        |       --       |
| Cancel PO                       |  Y    |     --     |    Y    |      --       |       --       |
| **Vendor Payments**             |       |            |         |               |                |
| Record Payment                  |  Y    |     --     |    Y    |      --       |       --       |
| View Payments                   |  Y    |     Y      |    Y    |      --       |       --       |
| **Vendor Credits**              |       |            |         |               |                |
| Create Credit Note              |  Y    |     Y      |    Y    |      --       |       --       |
| Apply Credit to Payment         |  Y    |     --     |    Y    |      --       |       --       |
| View Credits                    |  Y    |     Y      |    Y    |      --       |       --       |
| **Vendor Bills**                |       |            |         |               |                |
| Create Bill                     |  Y    |     --     |    Y    |      --       |       --       |
| View Bills                      |  Y    |     Y      |    Y    |      --       |       --       |
| **Overdue Tracking**            |       |            |         |               |                |
| View Overdue Dashboard          |  Y    |     Y      |    Y    |      --       |       --       |
| Vendor Statement Reconciliation |  Y    |     --     |    --   |      --       |       --       |

### 3.3 User-Specific Phase 2 Responsibilities

| User     | Role            | Phase 2 Primary Duties                                              |
|----------|-----------------|---------------------------------------------------------------------|
| Nithin   | INWARDS_CLERK   | Receive goods against PO (create GRN), view POs and vendor details  |
| Ranjitha | OUTWARDS_CLERK  | No major Phase 2 role; continues outward operations                 |
| Sravan   | MANAGER         | Record expenses, create POs, approve POs, record vendor payments    |
| Srinu    | SUPERVISOR      | Review expenses, oversee vendor relationships, view all reports     |
| Syed     | ADMIN           | Full access, vendor statement reconciliation, overdue tracking      |

---

## 4. API Route Tree

All routes live under `src/app/api/`. Methods and role requirements follow the existing pattern of `requireAuth([...roles])`.

### 4.1 Vendor Routes

```
src/app/api/vendors/
  route.ts
    GET    /api/vendors                     -- List vendors (paginated, searchable)
                                               Roles: ADMIN, SUPERVISOR, MANAGER, INWARDS_CLERK
    POST   /api/vendors                     -- Create vendor
                                               Roles: ADMIN, SUPERVISOR, MANAGER

  [id]/route.ts
    GET    /api/vendors/:id                 -- Vendor detail with contacts, balances
                                               Roles: ADMIN, SUPERVISOR, MANAGER, INWARDS_CLERK
    PUT    /api/vendors/:id                 -- Update vendor
                                               Roles: ADMIN, SUPERVISOR, MANAGER
    DELETE /api/vendors/:id                 -- Soft-delete (set isActive=false)
                                               Roles: ADMIN

  [id]/contacts/route.ts
    GET    /api/vendors/:id/contacts        -- List contacts for vendor
    POST   /api/vendors/:id/contacts        -- Add contact
    PUT    /api/vendors/:id/contacts        -- Update contact (body includes contactId)
    DELETE /api/vendors/:id/contacts        -- Remove contact (body includes contactId)
                                               Roles: ADMIN, SUPERVISOR, MANAGER

  [id]/statement/route.ts
    GET    /api/vendors/:id/statement       -- Vendor statement (bills, payments, credits, balance)
                                               Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD
                                               Roles: ADMIN

  [id]/ledger/route.ts
    GET    /api/vendors/:id/ledger          -- Full vendor ledger (all transactions chronological)
                                               Roles: ADMIN, SUPERVISOR, MANAGER
```

### 4.2 Purchase Order Routes

```
src/app/api/purchase-orders/
  route.ts
    GET    /api/purchase-orders             -- List POs (paginated, filterable by status/vendor/date)
                                               Roles: ADMIN, SUPERVISOR, MANAGER, INWARDS_CLERK
    POST   /api/purchase-orders             -- Create PO
                                               Roles: ADMIN, SUPERVISOR, MANAGER

  [id]/route.ts
    GET    /api/purchase-orders/:id         -- PO detail with items, GRNs, vendor
                                               Roles: ADMIN, SUPERVISOR, MANAGER, INWARDS_CLERK
    PUT    /api/purchase-orders/:id         -- Update PO (only DRAFT status)
                                               Roles: ADMIN, SUPERVISOR, MANAGER
    DELETE /api/purchase-orders/:id         -- Cancel PO (sets status to CANCELLED)
                                               Roles: ADMIN, MANAGER

  [id]/approve/route.ts
    POST   /api/purchase-orders/:id/approve -- Approve or reject PO
                                               Body: { action: "APPROVED"|"REJECTED", notes?: string }
                                               Roles: ADMIN, MANAGER

  [id]/send-whatsapp/route.ts
    POST   /api/purchase-orders/:id/send-whatsapp
                                            -- Generate wa.me link, mark PO as SENT
                                               Returns: { whatsappUrl: string }
                                               Roles: ADMIN, SUPERVISOR, MANAGER

  [id]/receive/route.ts
    POST   /api/purchase-orders/:id/receive -- Create GRN (goods receipt)
                                               Body: { invoiceNumber, invoiceDate, invoiceAmount,
                                                       items: [{ productId, quantity }], notes }
                                               Side effects: updates Product.currentStock,
                                                 creates InventoryTransaction (INWARD),
                                                 updates PurchaseOrderItem.receivedQty,
                                                 updates PO status (PARTIAL or RECEIVED)
                                               Roles: ADMIN, SUPERVISOR, MANAGER, INWARDS_CLERK

  auto-generate/route.ts
    POST   /api/purchase-orders/auto-generate
                                            -- Trigger auto-PO generation for all low-stock products
                                               Returns: { generated: PurchaseOrder[] }
                                               Roles: ADMIN, MANAGER
```

### 4.3 Expense Routes

```
src/app/api/expenses/
  route.ts
    GET    /api/expenses                    -- List expenses (paginated, filterable by category/date/reviewed)
                                               Roles: ADMIN, SUPERVISOR, MANAGER
    POST   /api/expenses                    -- Create expense
                                               Roles: ADMIN, MANAGER

  [id]/route.ts
    GET    /api/expenses/:id                -- Expense detail
    PUT    /api/expenses/:id                -- Update expense (only if not yet reviewed)
    DELETE /api/expenses/:id                -- Delete expense
                                               Roles: ADMIN (delete), ADMIN+MANAGER (update)

  [id]/review/route.ts
    POST   /api/expenses/:id/review         -- Review expense
                                               Body: { approved: boolean, notes?: string }
                                               Roles: ADMIN, SUPERVISOR

  summary/route.ts
    GET    /api/expenses/summary            -- Monthly summary by category
                                               Query: ?month=YYYY-MM
                                               Roles: ADMIN, SUPERVISOR, MANAGER

  upload/route.ts
    POST   /api/expenses/upload             -- Upload receipt image
                                               Content-Type: multipart/form-data
                                               Returns: { url: string }
                                               Roles: ADMIN, MANAGER
```

### 4.4 Vendor Payment Routes

```
src/app/api/vendor-payments/
  route.ts
    GET    /api/vendor-payments             -- List payments (paginated, filterable by vendor/date/mode)
                                               Roles: ADMIN, SUPERVISOR, MANAGER
    POST   /api/vendor-payments             -- Record payment
                                               Side effects: updates VendorBill.paidAmount and status,
                                                 updates VendorCredit.usedAmount if credit applied
                                               Roles: ADMIN, MANAGER

  [id]/route.ts
    GET    /api/vendor-payments/:id         -- Payment detail
                                               Roles: ADMIN, SUPERVISOR, MANAGER
```

### 4.5 Vendor Credit Routes

```
src/app/api/vendor-credits/
  route.ts
    GET    /api/vendor-credits              -- List credits (paginated, filterable by vendor)
                                               Roles: ADMIN, SUPERVISOR, MANAGER
    POST   /api/vendor-credits              -- Create credit note
                                               Roles: ADMIN, SUPERVISOR, MANAGER

  [id]/route.ts
    GET    /api/vendor-credits/:id          -- Credit detail with linked payments
                                               Roles: ADMIN, SUPERVISOR, MANAGER
```

### 4.6 Vendor Bill Routes

```
src/app/api/vendor-bills/
  route.ts
    GET    /api/vendor-bills                -- List bills (paginated, filterable by vendor/status/overdue)
                                               Roles: ADMIN, SUPERVISOR, MANAGER
    POST   /api/vendor-bills                -- Create bill (often auto-created from GRN)
                                               Roles: ADMIN, MANAGER

  [id]/route.ts
    GET    /api/vendor-bills/:id            -- Bill detail with payments
                                               Roles: ADMIN, SUPERVISOR, MANAGER
    PUT    /api/vendor-bills/:id            -- Update bill
                                               Roles: ADMIN, MANAGER

  overdue/route.ts
    GET    /api/vendor-bills/overdue        -- Overdue bills with aging buckets
                                               Query: ?vendor=id&minAmount=N&bucket=0-30|31-60|61-90|90+
                                               Roles: ADMIN, SUPERVISOR, MANAGER
```

### 4.7 Dashboard Additions

```
src/app/api/dashboard/
  accounts/route.ts
    GET    /api/dashboard/accounts          -- Accounts overview stats
                                               Returns: { totalPayable, overdueAmount, thisMonthExpenses,
                                                          pendingPOs, overdueBillCount }
                                               Roles: ADMIN, SUPERVISOR, MANAGER
```

---

## 5. Page Tree with Wireframe Descriptions

All new pages live under the existing `src/app/(dashboard)/` layout group and use the same `BottomNav` + `Header` chrome. Phase 2 pages are accessed via the "More" menu.

### 5.1 Navigation Changes

The "More" page (`src/app/(dashboard)/more/page.tsx`) gains these new menu items:

```typescript
// New menu items to add to the existing menuItems array
{
  label: "Vendors",
  icon: Building2,      // from lucide-react
  href: "/more/vendors",
  roles: ["ADMIN", "SUPERVISOR", "MANAGER", "INWARDS_CLERK"],
},
{
  label: "Purchase Orders",
  icon: FileText,
  href: "/more/purchase-orders",
  roles: ["ADMIN", "SUPERVISOR", "MANAGER", "INWARDS_CLERK"],
},
{
  label: "Expenses",
  icon: Receipt,
  href: "/more/expenses",
  roles: ["ADMIN", "SUPERVISOR", "MANAGER"],
},
{
  label: "Payments",
  icon: Wallet,
  href: "/more/payments",
  roles: ["ADMIN", "SUPERVISOR", "MANAGER"],
},
{
  label: "Overdue Bills",
  icon: AlertCircle,
  href: "/more/overdue",
  roles: ["ADMIN", "SUPERVISOR", "MANAGER"],
},
```

### 5.2 Vendor Pages

```
src/app/(dashboard)/more/vendors/
  page.tsx                                  -- Vendor list
  new/page.tsx                              -- Create vendor form
  [id]/page.tsx                             -- Vendor detail
  [id]/edit/page.tsx                        -- Edit vendor form
  [id]/statement/page.tsx                   -- Vendor statement (ADMIN only)
```

**Vendor List Page** (`/more/vendors`)
- Search bar at top (filters by name, code, GST number)
- Filter chips: All | Active | Inactive
- Sort: Name A-Z | Recent | Outstanding Amount
- Each vendor card shows: name, code, phone, outstanding balance (red if overdue)
- FAB (floating action button) bottom-right: "+" to create new vendor (hidden for INWARDS_CLERK)

**Create/Edit Vendor Page** (`/more/vendors/new`, `/more/vendors/:id/edit`)
- Multi-section form with collapsible accordions:
  - Section 1: Basic Info (name, trade name, code [auto], categories [multi-select chips])
  - Section 2: Tax Details (GST number, PAN)
  - Section 3: Address (line1, line2, city, state, pincode)
  - Section 4: Bank Details (bank name, branch, account, IFSC, UPI ID)
  - Section 5: Terms (payment term days, CD days, CD %, credit limit)
  - Section 6: Communication (email, phone, WhatsApp number)
  - Section 7: Contacts (inline add/remove contacts -- name, designation, phone, whatsapp, email, isPrimary toggle)
- Save button at bottom

**Vendor Detail Page** (`/more/vendors/:id`)
- Header card: vendor name, code, active badge, WhatsApp icon (opens chat)
- Tabs: Overview | POs | Bills | Payments | Credits
  - Overview: contact info, terms, bank details, total outstanding, total credits
  - POs: list of POs for this vendor (status badge, date, total)
  - Bills: list of bills (status badge, due date, amount, paid/balance)
  - Payments: payment history (date, amount, mode, reference)
  - Credits: credit notes (date, amount, used/balance)
- Bottom actions: Edit | New PO | Record Payment

**Vendor Statement Page** (`/more/vendors/:id/statement`) -- ADMIN only
- Date range picker (from/to)
- Tabular statement: Date | Particulars | Debit | Credit | Balance
  - Bills show as Debit entries
  - Payments show as Credit entries
  - Credits show as Credit entries
  - Running balance column
- Summary card at bottom: Opening Balance, Total Billed, Total Paid, Credits Applied, Closing Balance
- Export button (future: PDF/CSV)

### 5.3 Purchase Order Pages

```
src/app/(dashboard)/more/purchase-orders/
  page.tsx                                  -- PO list
  new/page.tsx                              -- Create PO form
  [id]/page.tsx                             -- PO detail
  [id]/receive/page.tsx                     -- Goods receipt form
```

**PO List Page** (`/more/purchase-orders`)
- Filter chips: All | Draft | Pending | Approved | Sent | Partial | Received
- Each PO card: PO number, vendor name, date, total amount, status badge (color-coded)
  - DRAFT: gray | PENDING_APPROVAL: yellow | APPROVED: blue | SENT: purple | PARTIAL: orange | RECEIVED: green | CANCELLED: red
- Search by PO number or vendor name
- FAB: "+" to create new PO

**Create PO Page** (`/more/purchase-orders/new`)
- Step 1: Select Vendor (search dropdown with vendor name + code)
- Step 2: Add Items
  - Product search (same pattern as inwards page product search)
  - For each item: product name, SKU, quantity input, rate input, GST % (pre-filled from product), discount %, line total (computed)
  - "Add Item" button adds another row
  - Swipe-left to remove item
- Step 3: Summary
  - Expected delivery date picker
  - Notes text area
  - Totals card: Subtotal, Discount, GST, Grand Total
  - Buttons: "Save as Draft" | "Submit for Approval"

**PO Detail Page** (`/more/purchase-orders/:id`)
- Header: PO number, status badge, vendor name (tappable to vendor detail)
- Date info: Order date, Expected delivery, Received date
- Items table: Product | Qty | Rate | GST | Disc | Amount | Received
- Totals card: Subtotal, Discount, GST, Grand Total
- Action buttons (context-dependent):
  - DRAFT: Edit | Submit for Approval | Cancel
  - PENDING_APPROVAL: Approve | Reject (ADMIN/MANAGER only)
  - APPROVED: Send via WhatsApp | Mark Received
  - SENT: Mark Received | Resend WhatsApp
  - PARTIAL: Receive More | View GRNs
  - RECEIVED: View GRNs | Create Bill
- GRN history section (collapsible): list of goods receipts with date, GRN#, qty received

**Goods Receipt Page** (`/more/purchase-orders/:id/receive`)
- Header: PO number, vendor name
- For each PO item: product name, ordered qty, previously received, qty to receive (input, max = ordered - received)
- Vendor invoice number input
- Vendor invoice date picker
- Vendor invoice amount input
- Notes text area
- "Confirm Receipt" button
- On submit: creates GRN, creates InventoryTransaction (INWARD) per item, updates product stock, updates PO status

### 5.4 Expense Pages

```
src/app/(dashboard)/more/expenses/
  page.tsx                                  -- Expense list
  new/page.tsx                              -- Create expense form
  [id]/page.tsx                             -- Expense detail
```

**Expense List Page** (`/more/expenses`)
- Month selector at top (left/right arrows to navigate months)
- Summary card: Total for month, broken down by category (horizontal bar chart or stacked display)
- Filter chips: All | Pending Review | Reviewed
- Category filter dropdown
- Each expense card: date, description (truncated), amount (bold), category badge, reviewed checkmark
- FAB: "+" to add expense (ADMIN/MANAGER only)

**Create Expense Page** (`/more/expenses/new`)
- Form fields:
  - Category: dropdown (Delivery, Office, Maintenance, Marketing, Salary, Misc)
  - Amount: number input with INR prefix
  - Date: date picker (defaults to today)
  - Description: text area
  - Paid By: text input (name of person who paid)
  - Payment Mode: segmented control (Cash | Cheque | NEFT | UPI)
  - Reference No: text input (optional)
  - Receipt Image: camera/gallery upload button (stores in `/public/uploads/receipts/`)
- "Save Expense" button

**Expense Detail Page** (`/more/expenses/:id`)
- Full details card with all fields
- Receipt image (tappable to full-screen)
- Review section:
  - If not reviewed: "Mark as Reviewed" button with optional notes (ADMIN/SUPERVISOR)
  - If reviewed: shows reviewer name, date, notes, green check badge

### 5.5 Payment Pages

```
src/app/(dashboard)/more/payments/
  page.tsx                                  -- Payment list + record payment
  new/page.tsx                              -- Record payment form
```

**Payment List Page** (`/more/payments`)
- Filter by vendor (dropdown), date range, payment mode
- Each payment card: date, vendor name, amount, mode badge, reference
- Running total at top for selected filter
- FAB: "+" to record payment

**Record Payment Page** (`/more/payments/new`)
- Form fields:
  - Vendor: search dropdown
  - Bill: dropdown of unpaid/partial bills for selected vendor (with balance shown)
  - Amount: number input (defaults to bill balance, can be partial)
  - Payment Date: date picker
  - Mode: segmented control (Cash | Cheque | NEFT | UPI)
  - Reference No: text input
  - Apply Vendor Credit: toggle + dropdown of available credits (shows balance)
  - Notes: text area
- Summary: Bill Amount, Already Paid, Credit Applied, This Payment, Remaining
- "Record Payment" button

### 5.6 Overdue Bills Page

```
src/app/(dashboard)/more/overdue/
  page.tsx                                  -- Overdue dashboard
```

**Overdue Bills Page** (`/more/overdue`)
- Summary cards row: Total Overdue (red), 0-30 days, 31-60 days, 61-90 days, 90+ days
- Aging buckets shown as a horizontal stacked bar (percentage of each bucket)
- Filter: vendor dropdown, min amount, bucket filter (0-30, 31-60, 61-90, 90+)
- List of overdue bills sorted by age (oldest first):
  - Each card: vendor name, bill number, amount, due date, days overdue (red badge), pay button
- Tapping a bill opens the bill detail with payment option

### 5.7 Dashboard Enhancements

The dashboard page (`src/app/(dashboard)/page.tsx`) gets new cards for ADMIN, SUPERVISOR, and MANAGER roles.

**Admin/Supervisor Dashboard additions:**
- New row: "Pending POs" count, "Overdue Bills" count (red if > 0), "This Month Expenses" total
- Overdue alert card (if any bills overdue): "X bills overdue totaling Rs Y" with link to `/more/overdue`

**Manager Dashboard additions:**
- "Pending POs for Approval" count (links to PO list filtered by PENDING_APPROVAL)
- "Unreviewed Expenses" count (links to expense list filtered by pending)
- "This Month Expenses" summary

**Inwards Clerk Dashboard additions:**
- "POs Awaiting Receipt" count (links to PO list filtered by APPROVED/SENT)

---

## 6. WhatsApp PO Template

### 6.1 URL Format

The wa.me deep link format uses URL-encoded text sent to the vendor's WhatsApp number.

```
https://wa.me/{vendorWhatsappNumber}?text={urlEncodedMessage}
```

Where `vendorWhatsappNumber` is the full international format without `+` or spaces (e.g., `919876543210` for an Indian number).

### 6.2 Message Template

The plain-text message sent via WhatsApp:

```
*PURCHASE ORDER*
PO No: {poNumber}
Date: {orderDate formatted as DD-MMM-YYYY}
From: BCH Bicycles, Hyderabad

Dear {vendorName},

Please supply the following items:

{for each item:}
{itemIndex}. {productName} ({productSKU})
   Qty: {quantity} | Rate: Rs {rate} | Amount: Rs {amount}
{end for}

---
Subtotal: Rs {subtotal}
Discount: Rs {discountAmount}
GST: Rs {gstAmount}
*Total: Rs {totalAmount}*

Expected Delivery: {expectedDelivery formatted as DD-MMM-YYYY}

{if notes:}
Notes: {notes}
{end if}

Payment Terms: Net {vendor.paymentTermDays} days
{if vendor.cdPercentage:}
CD: {vendor.cdPercentage}% if paid within {vendor.cdTermsDays} days
{end if}

Please confirm receipt of this order.
Thank you.
```

### 6.3 Implementation (in API route)

```typescript
// src/app/api/purchase-orders/[id]/send-whatsapp/route.ts
function generateWhatsAppUrl(po: PurchaseOrderWithDetails): string {
  const vendor = po.vendor;
  const phone = vendor.whatsappNumber?.replace(/[^0-9]/g, "") || "";

  if (!phone) throw new Error("Vendor has no WhatsApp number");

  const itemLines = po.items
    .map(
      (item, i) =>
        `${i + 1}. ${item.product.name} (${item.product.sku})\n` +
        `   Qty: ${item.quantity} | Rate: Rs ${item.rate.toFixed(2)} | Amount: Rs ${item.amount.toFixed(2)}`
    )
    .join("\n");

  const message = [
    `*PURCHASE ORDER*`,
    `PO No: ${po.poNumber}`,
    `Date: ${formatDate(po.orderDate)}`,
    `From: BCH Bicycles, Hyderabad`,
    ``,
    `Dear ${vendor.name},`,
    ``,
    `Please supply the following items:`,
    ``,
    itemLines,
    ``,
    `---`,
    `Subtotal: Rs ${po.subtotal.toFixed(2)}`,
    `Discount: Rs ${po.discountAmount.toFixed(2)}`,
    `GST: Rs ${po.gstAmount.toFixed(2)}`,
    `*Total: Rs ${po.totalAmount.toFixed(2)}*`,
    ``,
    `Expected Delivery: ${formatDate(po.expectedDelivery)}`,
    po.notes ? `\nNotes: ${po.notes}` : "",
    ``,
    `Payment Terms: Net ${vendor.paymentTermDays} days`,
    vendor.cdPercentage
      ? `CD: ${vendor.cdPercentage}% if paid within ${vendor.cdTermsDays} days`
      : "",
    ``,
    `Please confirm receipt of this order.`,
    `Thank you.`,
  ]
    .filter(Boolean)
    .join("\n");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
```

### 6.4 Frontend Usage

On the PO detail page, the "Send via WhatsApp" button:
1. Calls `POST /api/purchase-orders/:id/send-whatsapp`
2. API validates PO status is APPROVED or SENT
3. API generates the wa.me URL and updates `whatsappSentAt` + status to SENT
4. Frontend opens the returned URL with `window.open(url, "_blank")`
5. WhatsApp opens pre-filled with the PO message on the user's phone

---

## 7. PO Auto-Generation Logic

### 7.1 Trigger Conditions

A product becomes eligible for auto-PO when:

```
Product.currentStock <= Product.reorderLevel
AND Product.reorderLevel > 0
AND Product.reorderQty > 0
AND Product.status = "ACTIVE"
AND no existing DRAFT/PENDING_APPROVAL/APPROVED/SENT/PARTIAL PO exists
    for this product (prevents duplicate POs)
```

### 7.2 Trigger Points

Auto-PO checks run at two points:

1. **After every OUTWARD transaction** -- in the `POST /api/inventory/outwards/route.ts` handler, after stock is decremented, check if the product now meets the trigger condition.

2. **Manual batch trigger** -- `POST /api/purchase-orders/auto-generate` scans all active products and generates POs for any that meet the condition. This endpoint is called from a "Generate POs" button on the PO list page.

### 7.3 Vendor Selection

For auto-generated POs, the vendor is selected by:

1. **Product.brand.defaultVendorId** -- if the Brand model is extended with a `defaultVendorId` field (recommended schema addition below).
2. **Last PO vendor** -- find the most recent RECEIVED PO that included this product and use the same vendor.
3. **Fallback** -- if no vendor can be determined, the PO is created in DRAFT status with `vendorId = null` flagged for manual assignment (or the auto-generation skips this product and logs a warning).

Recommended addition to Brand model:

```prisma
// Add to existing Brand model
defaultVendorId String?
defaultVendor   Vendor? @relation(fields: [defaultVendorId], references: [id])
```

### 7.4 Grouping Strategy

Auto-POs are grouped by vendor. If multiple products from the same vendor hit reorder level, they are combined into a single PO with multiple line items. This reduces the number of POs and communication overhead.

### 7.5 Auto-PO Algorithm (Pseudocode)

```
FUNCTION generateAutoPOs():
    eligibleProducts = SELECT * FROM Product
        WHERE currentStock <= reorderLevel
        AND reorderLevel > 0
        AND reorderQty > 0
        AND status = 'ACTIVE'

    // Filter out products with existing open POs
    FOR EACH product IN eligibleProducts:
        hasOpenPO = EXISTS (
            SELECT 1 FROM PurchaseOrderItem poi
            JOIN PurchaseOrder po ON poi.purchaseOrderId = po.id
            WHERE poi.productId = product.id
            AND po.status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIAL')
        )
        IF hasOpenPO: REMOVE product FROM eligibleProducts

    // Group by vendor
    vendorGroups = GROUP eligibleProducts BY resolveVendor(product)

    generatedPOs = []

    FOR EACH (vendorId, products) IN vendorGroups:
        IF vendorId IS NULL: SKIP (log warning)

        po = CREATE PurchaseOrder {
            poNumber: nextPONumber(),
            vendorId: vendorId,
            status: DRAFT,
            isAutoGenerated: true,
            triggerProductId: products[0].id,
            createdById: SYSTEM_USER or current user
        }

        FOR EACH product IN products:
            CREATE PurchaseOrderItem {
                purchaseOrderId: po.id,
                productId: product.id,
                quantity: product.reorderQty,
                rate: product.costPrice,
                gstRate: product.gstRate,
                amount: product.reorderQty * product.costPrice
            }

        UPDATE po totals (subtotal, gstAmount, totalAmount)
        generatedPOs.push(po)

    RETURN generatedPOs
```

### 7.6 Post-Outward Hook

Add the following check to the existing outwards route (`src/app/api/inventory/outwards/route.ts`) after the stock decrement transaction:

```typescript
// After the existing $transaction block:
// Check if auto-PO should be triggered
if (
  product.reorderLevel > 0 &&
  product.reorderQty > 0 &&
  newStock <= product.reorderLevel
) {
  // Queue auto-PO check (non-blocking, does not fail the outward)
  generateAutoPOForProduct(product.id).catch((err) =>
    console.error("Auto-PO generation failed:", err)
  );
}
```

---

## 8. Data Flow Diagrams

### 8.1 Expense Recording Flow

```
                            SRAVAN (Manager)
                                  |
                                  | Creates expense
                                  v
                    +---------------------------+
                    |   POST /api/expenses      |
                    |---------------------------|
                    | 1. Zod validation         |
                    | 2. requireAuth([ADMIN,    |
                    |    MANAGER])              |
                    | 3. Generate EXP-YYYY-NNNN |
                    | 4. Upload receipt if any  |
                    | 5. prisma.expense.create  |
                    +---------------------------+
                                  |
                                  | isReviewed = false
                                  v
                    +---------------------------+
                    |   Expense Record (DB)     |
                    |   Status: PENDING REVIEW  |
                    +---------------------------+
                                  |
                    +-------------+-------------+
                    |                           |
             SRINU (Supervisor)          SYED (Admin)
                    |                           |
                    | Reviews expense           | Reviews expense
                    v                           v
          +---------------------------+
          | POST /api/expenses/:id/   |
          |          review           |
          |---------------------------|
          | 1. requireAuth([ADMIN,    |
          |    SUPERVISOR])           |
          | 2. Set isReviewed = true  |
          | 3. Record reviewedById,   |
          |    reviewedAt, reviewNotes |
          +---------------------------+
                    |
                    v
          +---------------------------+
          |   Expense Record (DB)     |
          |   Status: REVIEWED        |
          +---------------------------+
                    |
                    v
          +---------------------------+
          | GET /api/expenses/summary |
          | Monthly rollup by         |
          | category for reporting    |
          +---------------------------+
```

### 8.2 Purchase Order Lifecycle

```
 LOW STOCK DETECTED              SRAVAN/SYED
 (auto-trigger)                  (manual create)
       |                              |
       v                              v
  +----------+                +--------------+
  | Auto-PO  |                | Manual PO    |
  | Generator|                | Creation     |
  +----------+                +--------------+
       |                              |
       +----------+-------------------+
                  |
                  v
         +----------------+
         |   PO: DRAFT    |
         | (editable)     |
         +----------------+
                  |
                  | "Submit for Approval"
                  v
         +-------------------+
         | PO: PENDING_      |
         | APPROVAL          |
         +-------------------+
                  |
        +---------+---------+
        |                   |
   APPROVED             REJECTED
        |                   |
        v                   v
  +-------------+    +-------------+
  | PO: APPROVED|    | PO: DRAFT   |
  |             |    | (returned   |
  +-------------+    |  with notes)|
        |            +-------------+
        | "Send via WhatsApp"
        v
  +-------------+
  | PO: SENT    |<--- wa.me link generated
  |             |     WhatsApp opens on phone
  +-------------+     with PO message
        |
        | Vendor delivers goods
        | (Nithin receives at store)
        v
  +------------------+
  | Goods Receipt    |
  | (GRN Creation)   |
  +------------------+
        |
        | For each item received:
        | 1. Update PurchaseOrderItem.receivedQty
        | 2. Create InventoryTransaction (INWARD)
        | 3. Update Product.currentStock
        | 4. Create GoodsReceipt + GoodsReceiptItem
        |
        +--------+---------+
        |                  |
   All items           Some items
   received            remaining
        |                  |
        v                  v
  +-------------+   +--------------+
  | PO: RECEIVED|   | PO: PARTIAL  |
  +-------------+   +--------------+
        |                  |
        |                  | More deliveries arrive
        |                  +----> (repeat GRN)
        |
        v
  +------------------+
  | Auto-create      |
  | VendorBill from  |
  | GRN invoice data |
  +------------------+
```

### 8.3 Vendor Payment Flow

```
  SYED/SRAVAN                 VENDOR BILL
  (records payment)           (from GRN or manual)
       |                           |
       |                           v
       |                  +------------------+
       |                  | VendorBill (DB)  |
       |                  | status: UNPAID   |
       |                  | balance: Rs X    |
       |                  +------------------+
       |                           |
       v                           |
  +----------------------------+   |
  | POST /api/vendor-payments  |<--+
  |----------------------------|
  | 1. requireAuth([ADMIN,     |
  |    MANAGER])               |
  | 2. Zod validation          |
  | 3. Check: amount <=        |
  |    bill.balanceAmount      |
  +----------------------------+
       |
       | Has vendor credit to apply?
       |
  +----+----+
  | NO      | YES
  |         v
  |    +-----------------------------+
  |    | Deduct from VendorCredit    |
  |    | credit.usedAmount += applied|
  |    | credit.balanceAmount -= amt |
  |    | payment.mode =             |
  |    |   CREDIT_ADJUSTMENT        |
  |    +-----------------------------+
  |         |
  +----+----+
       |
       v
  +----------------------------+
  | prisma.$transaction:       |
  | 1. Create VendorPayment    |
  | 2. Update VendorBill:      |
  |    paidAmount += amount    |
  |    balanceAmount -= amount |
  |    status = (balance == 0) |
  |      ? PAID : PARTIAL      |
  | 3. Update VendorCredit     |
  |    (if credit applied)     |
  +----------------------------+
       |
       +--------+---------+
       |                  |
  balance = 0        balance > 0
       |                  |
       v                  v
  +----------+    +-----------+
  | Bill:    |    | Bill:     |
  | PAID     |    | PARTIAL   |
  +----------+    +-----------+


  === OVERDUE CHECK (runs on dashboard load) ===

  +----------------------------+
  | GET /api/vendor-bills/     |
  |         overdue            |
  |----------------------------|
  | SELECT * FROM VendorBill   |
  | WHERE dueDate < NOW()     |
  | AND status IN (UNPAID,     |
  |     PARTIAL)               |
  | ORDER BY dueDate ASC      |
  +----------------------------+
       |
       v
  +----------------------------+
  | Aging Bucket Calculation:  |
  | daysOverdue = NOW - dueDate|
  |                            |
  |  0-30  days  --> Bucket 1  |
  | 31-60  days  --> Bucket 2  |
  | 61-90  days  --> Bucket 3  |
  | 90+    days  --> Bucket 4  |
  +----------------------------+
       |
       v
  +----------------------------+
  | Dashboard Alert:           |
  | "5 bills overdue totaling  |
  |  Rs 1,45,000"             |
  +----------------------------+
```

---

## 9. Migration Strategy

### 9.1 Database Migration Steps

```bash
# Step 1: Add new models to schema.prisma
# Step 2: Add relation fields to existing User and Product models
# Step 3: Run migration
npx prisma migrate dev --name phase2-accounts-vendors-po

# Step 4: Seed vendor data (if any test vendors needed)
# Step 5: Run prisma generate
npx prisma generate
```

### 9.2 Backwards Compatibility

- All new fields on existing models are optional (nullable) or have defaults.
- No existing API routes change behavior. The only modification is the post-outward auto-PO hook, which is non-blocking and wrapped in a try-catch.
- The dashboard page gains new cards but the existing cards remain unchanged.
- The More page gains new menu items but existing items are untouched.
- The bottom navigation bar does not change.

### 9.3 New Zod Schemas Needed

Add to `src/lib/validations.ts`:

```typescript
// Vendor
export const vendorSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  tradeName: z.string().max(200).optional(),
  gstNumber: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GST format").optional().or(z.literal("")),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format").optional().or(z.literal("")),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().regex(/^[0-9]{6}$/, "Invalid pincode").optional().or(z.literal("")),
  bankName: z.string().max(100).optional(),
  bankBranch: z.string().max(100).optional(),
  accountNumber: z.string().max(20).optional(),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC").optional().or(z.literal("")),
  upiId: z.string().max(100).optional(),
  paymentTermDays: z.number().int().min(0).max(365).optional(),
  cdTermsDays: z.number().int().min(0).max(365).optional(),
  cdPercentage: z.number().min(0).max(100).optional(),
  creditLimit: z.number().min(0).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(15).optional(),
  whatsappNumber: z.string().max(15).optional(),
  categories: z.array(z.string()).optional(),
  notes: z.string().optional(),
  contacts: z.array(z.object({
    name: z.string().min(1),
    designation: z.string().optional(),
    phone: z.string().optional(),
    whatsapp: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    isPrimary: z.boolean().optional(),
  })).optional(),
});

// Purchase Order
export const purchaseOrderSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  expectedDelivery: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().min(1, "Product is required"),
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
    rate: z.number().min(0, "Rate must be non-negative"),
    gstRate: z.number().min(0).max(100).optional(),
    discount: z.number().min(0).max(100).optional(),
  })).min(1, "At least one item is required"),
});

// Purchase Order Approval
export const poApprovalSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().optional(),
});

// Goods Receipt
export const goodsReceiptSchema = z.object({
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  invoiceAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1),
  })).min(1, "At least one item is required"),
});

// Expense
export const expenseSchema = z.object({
  category: z.enum(["DELIVERY", "OFFICE", "MAINTENANCE", "MARKETING", "SALARY", "MISC"]),
  amount: z.number().min(0.01, "Amount must be positive"),
  date: z.string().min(1, "Date is required"),
  description: z.string().min(1, "Description is required").max(500),
  paidBy: z.string().min(1, "Paid by is required"),
  paymentMode: z.enum(["CASH", "CHEQUE", "NEFT", "UPI"]),
  referenceNo: z.string().optional(),
  receiptUrl: z.string().optional(),
});

// Expense Review
export const expenseReviewSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional(),
});

// Vendor Payment
export const vendorPaymentSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  billId: z.string().optional(),
  amount: z.number().min(0.01, "Amount must be positive"),
  paymentDate: z.string().min(1, "Payment date is required"),
  mode: z.enum(["CASH", "CHEQUE", "NEFT", "UPI", "CREDIT_ADJUSTMENT"]),
  referenceNo: z.string().optional(),
  notes: z.string().optional(),
  creditId: z.string().optional(),
});

// Vendor Credit
export const vendorCreditSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  amount: z.number().min(0.01, "Amount must be positive"),
  reason: z.string().min(1, "Reason is required"),
  referenceNo: z.string().optional(),
  creditDate: z.string().min(1, "Credit date is required"),
  notes: z.string().optional(),
});

// Vendor Bill
export const vendorBillSchema = z.object({
  billNumber: z.string().min(1, "Bill number is required"),
  vendorId: z.string().min(1, "Vendor is required"),
  purchaseOrderId: z.string().optional(),
  billDate: z.string().min(1, "Bill date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  amount: z.number().min(0),
  gstAmount: z.number().min(0).optional(),
  totalAmount: z.number().min(0.01),
  notes: z.string().optional(),
});
```

### 9.4 New TypeScript Types

Add to `src/types/index.ts`:

```typescript
// Phase 2 Types

export type ExpenseCategory =
  | "DELIVERY"
  | "OFFICE"
  | "MAINTENANCE"
  | "MARKETING"
  | "SALARY"
  | "MISC";

export type PaymentMode =
  | "CASH"
  | "CHEQUE"
  | "NEFT"
  | "UPI"
  | "CREDIT_ADJUSTMENT";

export type POStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SENT"
  | "PARTIAL"
  | "RECEIVED"
  | "CANCELLED";

export type BillStatus =
  | "UNPAID"
  | "PARTIAL"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export interface Vendor {
  id: string;
  code: string;
  name: string;
  tradeName?: string;
  gstNumber?: string;
  panNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  bankName?: string;
  bankBranch?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  paymentTermDays: number;
  cdTermsDays?: number;
  cdPercentage?: number;
  creditLimit: number;
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  categories: string[];
  isActive: boolean;
  notes?: string;
  contacts?: VendorContact[];
}

export interface VendorContact {
  id: string;
  vendorId: string;
  name: string;
  designation?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  isPrimary: boolean;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendor?: Vendor;
  status: POStatus;
  orderDate: string;
  expectedDelivery?: string;
  receivedDate?: string;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  discountAmount: number;
  approvedById?: string;
  approvedBy?: User;
  approvedAt?: string;
  approvalNotes?: string;
  createdById: string;
  createdBy?: User;
  isAutoGenerated: boolean;
  triggerProductId?: string;
  whatsappSentAt?: string;
  notes?: string;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  product?: Product;
  quantity: number;
  receivedQty: number;
  rate: number;
  gstRate: number;
  discount: number;
  amount: number;
}

export interface GoodsReceipt {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  receivedById: string;
  receivedBy?: User;
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceAmount?: number;
  notes?: string;
  receivedAt: string;
  items?: GoodsReceiptItem[];
}

export interface GoodsReceiptItem {
  id: string;
  goodsReceiptId: string;
  productId: string;
  product?: Product;
  quantity: number;
  notes?: string;
}

export interface VendorBill {
  id: string;
  billNumber: string;
  vendorId: string;
  vendor?: Vendor;
  purchaseOrderId?: string;
  billDate: string;
  dueDate: string;
  amount: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: BillStatus;
  notes?: string;
  createdById: string;
  payments?: VendorPaymentRecord[];
}

export interface VendorPaymentRecord {
  id: string;
  paymentNumber: string;
  vendorId: string;
  vendor?: Vendor;
  billId?: string;
  amount: number;
  paymentDate: string;
  mode: PaymentMode;
  referenceNo?: string;
  notes?: string;
  creditId?: string;
  recordedById: string;
  recordedBy?: User;
}

export interface VendorCredit {
  id: string;
  creditNumber: string;
  vendorId: string;
  vendor?: Vendor;
  amount: number;
  usedAmount: number;
  balanceAmount: number;
  reason: string;
  referenceNo?: string;
  creditDate: string;
  notes?: string;
  recordedById: string;
  recordedBy?: User;
}

export interface Expense {
  id: string;
  expenseNumber: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  description: string;
  paidBy: string;
  paymentMode: PaymentMode;
  referenceNo?: string;
  receiptUrl?: string;
  isReviewed: boolean;
  reviewedById?: string;
  reviewedBy?: User;
  reviewedAt?: string;
  reviewNotes?: string;
  createdById: string;
  createdBy?: User;
}

export interface OverdueBucket {
  label: string;
  range: string;
  count: number;
  amount: number;
}

export interface VendorStatement {
  vendor: Vendor;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  entries: VendorStatementEntry[];
  closingBalance: number;
  totalBilled: number;
  totalPaid: number;
  totalCredits: number;
}

export interface VendorStatementEntry {
  date: string;
  particulars: string;
  type: "BILL" | "PAYMENT" | "CREDIT";
  debit: number;
  credit: number;
  balance: number;
  referenceId: string;
}
```

---

## 10. Implementation Order

The recommended build order minimizes dependencies and allows incremental testing.

### Sprint 1 (Week 1-2): Foundation

| Step | Task                                    | Files Created/Modified                                |
|------|-----------------------------------------|-------------------------------------------------------|
| 1.1  | Prisma schema additions                | `prisma/schema.prisma`                                |
| 1.2  | Run migration                           | `prisma/migrations/NNNN_phase2_.../migration.sql`     |
| 1.3  | Add TypeScript types                    | `src/types/index.ts`                                  |
| 1.4  | Add Zod validations                     | `src/lib/validations.ts`                              |
| 1.5  | Add auto-number generators              | `src/lib/auto-number.ts` (new)                        |

### Sprint 2 (Week 2-3): Vendor Module

| Step | Task                                    | Files Created/Modified                                |
|------|-----------------------------------------|-------------------------------------------------------|
| 2.1  | Vendor API routes (CRUD)                | `src/app/api/vendors/route.ts`, `[id]/route.ts`, etc. |
| 2.2  | Vendor contact API                      | `src/app/api/vendors/[id]/contacts/route.ts`          |
| 2.3  | Vendor list page                        | `src/app/(dashboard)/more/vendors/page.tsx`           |
| 2.4  | Vendor create/edit pages                | `more/vendors/new/page.tsx`, `[id]/edit/page.tsx`     |
| 2.5  | Vendor detail page with tabs            | `more/vendors/[id]/page.tsx`                          |
| 2.6  | Update More menu                        | `src/app/(dashboard)/more/page.tsx`                   |

### Sprint 3 (Week 3-4): Purchase Orders

| Step | Task                                    | Files Created/Modified                                |
|------|-----------------------------------------|-------------------------------------------------------|
| 3.1  | PO API routes (CRUD + approve + cancel) | `src/app/api/purchase-orders/...`                     |
| 3.2  | WhatsApp send API                       | `src/app/api/purchase-orders/[id]/send-whatsapp/...`  |
| 3.3  | Goods receipt API                       | `src/app/api/purchase-orders/[id]/receive/...`        |
| 3.4  | PO list page                            | `more/purchase-orders/page.tsx`                       |
| 3.5  | PO create page                          | `more/purchase-orders/new/page.tsx`                   |
| 3.6  | PO detail page                          | `more/purchase-orders/[id]/page.tsx`                  |
| 3.7  | Goods receipt page                      | `more/purchase-orders/[id]/receive/page.tsx`          |
| 3.8  | Auto-PO generator                       | `src/lib/auto-po.ts` (new)                            |
| 3.9  | Hook into outwards route                | `src/app/api/inventory/outwards/route.ts` (modified)  |
| 3.10 | Auto-generate API endpoint              | `src/app/api/purchase-orders/auto-generate/route.ts`  |

### Sprint 4 (Week 4-5): Expenses

| Step | Task                                    | Files Created/Modified                                |
|------|-----------------------------------------|-------------------------------------------------------|
| 4.1  | Expense API routes (CRUD + review)      | `src/app/api/expenses/...`                            |
| 4.2  | Receipt upload API                      | `src/app/api/expenses/upload/route.ts`                |
| 4.3  | Monthly summary API                     | `src/app/api/expenses/summary/route.ts`               |
| 4.4  | Expense list page                       | `more/expenses/page.tsx`                              |
| 4.5  | Expense create page                     | `more/expenses/new/page.tsx`                          |
| 4.6  | Expense detail page                     | `more/expenses/[id]/page.tsx`                         |

### Sprint 5 (Week 5-6): Payments, Credits, Bills, Overdue

| Step | Task                                    | Files Created/Modified                                |
|------|-----------------------------------------|-------------------------------------------------------|
| 5.1  | Vendor bill API routes                  | `src/app/api/vendor-bills/...`                        |
| 5.2  | Vendor payment API routes               | `src/app/api/vendor-payments/...`                     |
| 5.3  | Vendor credit API routes                | `src/app/api/vendor-credits/...`                      |
| 5.4  | Overdue bills API                       | `src/app/api/vendor-bills/overdue/route.ts`           |
| 5.5  | Payment list + create pages             | `more/payments/page.tsx`, `more/payments/new/page.tsx`|
| 5.6  | Overdue dashboard page                  | `more/overdue/page.tsx`                               |
| 5.7  | Vendor statement API + page             | `vendors/[id]/statement/...`                          |

### Sprint 6 (Week 6-7): Dashboard + Polish

| Step | Task                                    | Files Created/Modified                                |
|------|-----------------------------------------|-------------------------------------------------------|
| 6.1  | Dashboard accounts API                  | `src/app/api/dashboard/accounts/route.ts`             |
| 6.2  | Update dashboard with Phase 2 cards     | `src/app/(dashboard)/page.tsx`                        |
| 6.3  | Update Inwards Clerk dashboard          | Same file, `InwardsClerkDashboard` component          |
| 6.4  | Update Manager dashboard                | Same file, `ManagerDashboard` component               |
| 6.5  | Add Brand.defaultVendorId migration     | `prisma/schema.prisma` (add field to Brand)           |
| 6.6  | End-to-end testing of all flows         | Manual QA on mobile device                            |
| 6.7  | Update version to 0.2.0                 | `package.json`                                        |

---

## Appendix A: Auto-Number Format Reference

| Entity         | Format             | Example            | Sequence Source                          |
|----------------|--------------------|--------------------|------------------------------------------|
| Vendor         | `VND-{NNNN}`      | `VND-0001`         | Count of vendors + 1                     |
| Purchase Order | `PO-{YYYY}-{NNNN}`| `PO-2026-0001`     | Count of POs in current year + 1         |
| GRN            | `GRN-{YYYY}-{NNNN}`| `GRN-2026-0001`   | Count of GRNs in current year + 1        |
| Vendor Payment | `PAY-{YYYY}-{NNNN}`| `PAY-2026-0001`   | Count of payments in current year + 1    |
| Vendor Credit  | `CR-{YYYY}-{NNNN}` | `CR-2026-0001`    | Count of credits in current year + 1     |
| Expense        | `EXP-{YYYY}-{NNNN}`| `EXP-2026-0001`   | Count of expenses in current year + 1    |
| Vendor Bill    | (vendor's number)  | Vendor's invoice # | Not auto-generated; uses vendor's number |

## Appendix B: PO Status Badge Colors (Tailwind)

| Status             | Badge Color                        |
|--------------------|------------------------------------|
| DRAFT              | `bg-gray-100 text-gray-700`        |
| PENDING_APPROVAL   | `bg-yellow-100 text-yellow-700`    |
| APPROVED           | `bg-blue-100 text-blue-700`        |
| SENT               | `bg-purple-100 text-purple-700`    |
| PARTIAL            | `bg-orange-100 text-orange-700`    |
| RECEIVED           | `bg-green-100 text-green-700`      |
| CANCELLED          | `bg-red-100 text-red-700`          |

## Appendix C: Expense Category Badge Colors (Tailwind)

| Category    | Badge Color                         |
|-------------|-------------------------------------|
| DELIVERY    | `bg-blue-100 text-blue-700`         |
| OFFICE      | `bg-slate-100 text-slate-700`       |
| MAINTENANCE | `bg-amber-100 text-amber-700`       |
| MARKETING   | `bg-purple-100 text-purple-700`     |
| SALARY      | `bg-green-100 text-green-700`       |
| MISC        | `bg-gray-100 text-gray-700`         |

## Appendix D: File Count Summary

| Category         | New Files | Modified Files |
|------------------|-----------|----------------|
| Prisma schema    | 0         | 1              |
| API routes       | ~25       | 1              |
| Pages            | ~15       | 2              |
| Lib/utils        | 2         | 1              |
| Types            | 0         | 1              |
| Validations      | 0         | 1              |
| Components       | ~5        | 1              |
| **Total**        | **~47**   | **8**          |
