# Bike Inventory Manager — Complete Project Documentation

> **Version**: v0.8.0 Final | **Framework**: Next.js 16 + React 19 + TypeScript  
> **Database**: PostgreSQL (Prisma ORM) | **Auth**: NextAuth (JWT + Access Code)  
> **PWA**: Offline-ready with Service Worker | **Integration**: Zoho Books

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Database Schema](#2-database-schema)
3. [API Routes (56 endpoints)](#3-api-routes)
4. [UI Pages (39 pages)](#4-ui-pages)
5. [Components (11)](#5-components)
6. [Library & Utilities (11 files)](#6-library--utilities)
7. [Authentication](#7-authentication)
8. [Zoho Integration](#8-zoho-integration)
9. [AI Features](#9-ai-features)
10. [PWA Configuration](#10-pwa-configuration)
11. [Key Workflows](#11-key-workflows)
12. [Project Structure](#12-project-structure)
13. [Environment Variables](#13-environment-variables)
14. [NPM Scripts](#14-npm-scripts)
15. [Development Phases](#15-development-phases)

---

## 1. Technology Stack

### Core
| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 16.2.3 | App Router + Turbopack |
| React | 19.2.4 | UI framework |
| TypeScript | 5.x | Type safety |
| Prisma | 6.19.3 | ORM (PostgreSQL) |
| NextAuth | 4.24.13 | Authentication (JWT) |
| Tailwind CSS | 4.x | Styling |

### Libraries
| Library | Purpose |
|---------|---------|
| React Hook Form + Zod | Form handling + validation |
| Lucide React | Icons |
| xlsx | Excel export |
| jspdf + jspdf-autotable | PDF generation |
| bwip-js | Barcode generation |
| bcryptjs | Password hashing |
| date-fns | Date formatting |
| next-pwa | Progressive Web App |
| clsx + tailwind-merge + CVA | Class utilities |

---

## 2. Database Schema

### Core Entities

#### User
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| name | String | |
| email | String | Unique |
| password | String | bcrypt hashed |
| role | Enum | ADMIN, SUPERVISOR, MANAGER, INWARDS_CLERK, OUTWARDS_CLERK |
| accessCode | String | Unique, for login |
| isActive | Boolean | Default true |

#### Product
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| sku | String | Unique |
| name | String | |
| categoryId | String | FK → Category |
| brandId | String? | FK → Brand |
| type | Enum | BICYCLE, SPARE_PART, ACCESSORY |
| status | Enum | ACTIVE, DISCONTINUED, OUT_OF_STOCK |
| condition | Enum | NEW, REFURBISHED, USED |
| costPrice | Float | |
| sellingPrice | Float | |
| mrp | Float | |
| gstRate | Float | |
| hsnCode | String? | GST classification |
| currentStock | Int | Auto-updated |
| minStock | Int | For alerts |
| maxStock | Int | Overstock detection |
| reorderLevel | Int | Trigger point |
| reorderQty | Int | Suggested order qty |
| size | String? | |
| color | String? | |
| imageUrls | String[] | |
| tags | String[] | |
| binId | String? | FK → Bin |

#### SerialItem (Individual tracked items)
| Field | Type | Notes |
|-------|------|-------|
| serialCode | String | Unique, format: SKU-0001 |
| productId | String | FK → Product |
| status | Enum | IN_STOCK, SOLD, RETURNED, DAMAGED, RGP_OUT, TRANSFERRED |
| condition | Enum | NEW, REFURBISHED, USED |
| barcodeData | String? | |
| barcodeFormat | Enum? | CODE128, QR, EAN13 |
| batchNo | String? | |
| invoiceNo | String? | |
| customerName | String? | On sale |
| saleInvoiceNo | String? | On sale |

#### Category
| Field | Type | Notes |
|-------|------|-------|
| name | String | Unique |
| parentId | String? | Self-referential (subcategories) |
| movingLevel | Enum? | FAST, NORMAL, SLOW |
| reorderLevel | Int? | Category-level default |

#### Brand
| Field | Type | Notes |
|-------|------|-------|
| name | String | Unique |
| contactName | String? | |
| contactPhone | String? | |
| whatsappNumber | String? | |
| cdTermsDays | Int? | Cash discount terms |
| cdPercentage | Float? | |

#### Bin (Storage Locations)
| Field | Type | Notes |
|-------|------|-------|
| code | String | Unique, e.g. A-01-03 |
| name | String | |
| location | String? | |
| zone | String? | |
| capacity | Int? | |

#### InventoryTransaction
| Field | Type | Notes |
|-------|------|-------|
| type | Enum | INWARD, OUTWARD, TRANSFER, ADJUSTMENT |
| productId | String | FK → Product |
| quantity | Int | |
| previousStock | Int | Snapshot |
| newStock | Int | After transaction |
| referenceNo | String? | Invoice/challan number |
| isRgp | Boolean | Returnable Gate Pass |
| rgpReturnDate | DateTime? | Expected return |
| rgpReturned | Boolean | |
| userId | String | Who recorded |

### Vendor Management

#### Vendor
| Field | Type | Notes |
|-------|------|-------|
| name | String | Unique |
| code | String | Unique |
| gstin | String? | GST number |
| pan | String? | |
| address1, address2, city, state, pincode | String? | Address fields |
| phone, email, whatsappNumber | String? | Contact |
| paymentTermDays | Int? | Default: 30 |
| creditLimit | Float? | |
| cdTermsDays, cdPercentage | Int?, Float? | Cash discount |

#### VendorContact
| Field | Type | Notes |
|-------|------|-------|
| name | String | |
| designation | String? | |
| phone, email, whatsapp | String? | |
| isPrimary | Boolean | |

#### PurchaseOrder
| Field | Type | Notes |
|-------|------|-------|
| poNumber | String | Unique, auto: PO-00001 |
| vendorId | String | FK → Vendor |
| status | Enum | DRAFT, SENT, PARTIAL, RECEIVED, CANCELLED |
| subtotal, gstTotal, grandTotal | Float | |
| orderDate, expectedDate | DateTime | |
| createdById, approvedById | String | FK → User |

#### PurchaseOrderItem
| Field | Type | Notes |
|-------|------|-------|
| productId | String | FK → Product |
| quantity | Int | Ordered |
| receivedQty | Int | Default: 0 |
| unitPrice | Float | |
| gstRate | Float | |
| amount | Float | Calculated |

#### VendorBill
| Field | Type | Notes |
|-------|------|-------|
| billNo | String | Unique per vendor |
| vendorId | String | FK → Vendor |
| purchaseOrderId | String? | FK → PO |
| billDate, dueDate | DateTime | |
| amount, paidAmount | Float | |
| status | Enum | PENDING, PARTIALLY_PAID, PAID, OVERDUE, DISPUTED |
| lastFollowedUp, nextFollowUpDate | DateTime? | |
| followUpNotes | String? | |

#### VendorPayment
| Field | Type | Notes |
|-------|------|-------|
| vendorId | String | FK → Vendor |
| billId | String? | FK → Bill |
| amount | Float | |
| paymentMode | Enum | CASH, CHEQUE, NEFT, RTGS, UPI, CREDIT_ADJUSTMENT |
| referenceNo | String? | |
| creditId | String? | FK → VendorCredit |
| recordedById | String | FK → User |

#### VendorCredit
| Field | Type | Notes |
|-------|------|-------|
| creditNoteNo | String | Unique per vendor |
| vendorId | String | FK → Vendor |
| amount, usedAmount | Float | |
| reason | String | |

### Expense Tracking

#### Expense
| Field | Type | Notes |
|-------|------|-------|
| date | DateTime | |
| amount | Float | |
| category | Enum | DELIVERY, TRANSPORT, SHOP_MAINTENANCE, UTILITIES, SALARY_ADVANCE, FOOD_TEA, STATIONERY, MISCELLANEOUS |
| description | String | |
| paidBy | String | |
| paymentMode | String | |
| recordedById | String | FK → User |

### Zoho Integration

#### ZohoConfig (Singleton)
| Field | Type | Notes |
|-------|------|-------|
| id | String | Always "singleton" |
| clientId, clientSecret | String | Zoho app credentials |
| refreshToken, accessToken | String? | OAuth tokens |
| organizationId, organizationName | String? | |
| isConnected | Boolean | |
| lastSyncAt | DateTime? | |

#### SyncLog
| Field | Type | Notes |
|-------|------|-------|
| syncType | String | items, contacts, invoices, bills, all |
| status | String | running, success, partial, failed |
| totalItems, synced, failed | Int | |
| errors | Json? | |

### Stock Audit

#### StockCount
| Field | Type | Notes |
|-------|------|-------|
| title | String | |
| assignedToId | String | FK → User |
| status | Enum | PENDING, IN_PROGRESS, COMPLETED |
| dueDate | DateTime? | |

#### StockCountItem
| Field | Type | Notes |
|-------|------|-------|
| productId | String | FK → Product |
| systemQty | Int | At time of count |
| countedQty | Int? | Physical count |
| variance | Int? | countedQty - systemQty |

---

## 3. API Routes

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/auth/[...nextauth]` | NextAuth handler |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List (search, filter, paginate) |
| POST | `/api/products` | Create (ADMIN, MANAGER) |
| GET | `/api/products/[id]` | Get by ID |
| PUT | `/api/products/[id]` | Update |
| DELETE | `/api/products/[id]` | Delete |
| GET | `/api/products/search` | Autocomplete search |

### Categories & Brands
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/categories` | List/Create |
| GET/POST | `/api/brands` | List/Create |

### Bins
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/bins` | List/Create |
| GET/PUT/DELETE | `/api/bins/[id]` | CRUD |

### Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/inventory/inwards` | Record inward (updates stock, creates serials) |
| GET/POST | `/api/inventory/outwards` | Record outward (decrements stock) |

### Serials
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/serials` | List/Create |
| GET | `/api/serials/search` | Search by serial code |
| GET/PUT/DELETE | `/api/serials/[id]` | CRUD |

### Stock Audits
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/stock-counts` | List/Create (ADMIN, MANAGER) |
| GET/PUT | `/api/stock-counts/[id]` | Get/Update audit |
| GET/POST | `/api/stock-counts/[id]/items` | Manage audit items |

### Vendors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/vendors` | List/Create (paginated, searchable) |
| GET/PUT/DELETE | `/api/vendors/[id]` | CRUD |
| GET/POST | `/api/vendors/[id]/contacts` | Manage contacts |

### Purchase Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/purchase-orders` | List/Create (auto PO number) |
| GET/PUT/DELETE | `/api/purchase-orders/[id]` | CRUD |
| POST | `/api/purchase-orders/[id]/approve` | Approve PO |

### Bills
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/bills` | List/Create (overdue filter) |
| GET/PUT/DELETE | `/api/bills/[id]` | CRUD |
| POST | `/api/bills/[id]/follow-up` | Record follow-up |

### Payments & Credits
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/payments` | List/Record payments |
| GET/PUT/DELETE | `/api/payments/[id]` | CRUD |
| GET/POST | `/api/credits` | Manage vendor credits |

### Expenses
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/expenses` | List/Record |
| GET/PUT/DELETE | `/api/expenses/[id]` | CRUD |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/purchase` | Purchase aggregates (date range) |
| GET | `/api/reports/stock-value` | Stock valuation |
| GET | `/api/reports/movement` | Inward/outward trends |
| GET | `/api/reports/expense-summary` | Expense by category |
| GET | `/api/reports/daily` | Daily transaction summary |
| GET | `/api/accounts/summary` | Bills, payments, balances |
| GET | `/api/stock/summary` | Quick stock overview |

### Barcode
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/barcode` | Generate barcode PNG (base64) |

### Zoho Integration
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/zoho/auth/connect` | Exchange grant token |
| GET | `/api/zoho/auth/status` | Check connection |
| POST | `/api/zoho/auth/disconnect` | Disconnect |
| POST | `/api/zoho/sync/all` | Sync all data types |
| POST | `/api/zoho/sync/items` | Sync products |
| POST | `/api/zoho/sync/contacts` | Sync vendors |
| POST | `/api/zoho/sync/invoices` | Sync sales invoices |
| POST | `/api/zoho/sync/bills` | Sync purchase bills |
| GET | `/api/zoho/sync/logs` | Sync history |
| POST | `/api/zoho/import/items` | Import items |
| POST | `/api/zoho/import/contacts` | Import contacts |
| POST | `/api/zoho/import/bills` | Import bills |

### AI Features
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai/dashboard-insights` | Dashboard insights |
| GET | `/api/ai/demand-forecast` | Demand forecasting |
| GET | `/api/ai/low-stock-alerts` | Low stock alerts |
| GET | `/api/ai/reorder-suggestions` | Smart reorder suggestions |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/users` | List/Create |
| GET/PUT/DELETE | `/api/users/[id]` | CRUD |
| POST | `/api/users/seed` | Seed initial users |

---

## 4. UI Pages

### Dashboard
| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/(dashboard)/` | Role-specific overview: stock value, transactions today, low stock, AI insights |

### Inventory
| Page | Path | Description |
|------|------|-------------|
| Stock List | `/(dashboard)/stock/` | Search, filter (bicycle/spare/accessory/low stock), Excel/PDF export |
| Product Detail | `/(dashboard)/stock/[id]/` | Full product info |
| Serial Tracking | `/(dashboard)/stock/[id]/serials/` | Individual item tracking |
| Barcode | `/(dashboard)/stock/[id]/barcode/` | Generate & print barcodes |
| Scanner | `/(dashboard)/scanner/` | QR/barcode scanning |

### Transactions
| Page | Path | Description |
|------|------|-------------|
| Inwards List | `/(dashboard)/inwards/` | Inward transaction history |
| New Inward | `/(dashboard)/inwards/new/` | Record inward (optional serial tracking) |
| Outwards List | `/(dashboard)/outwards/` | Outward transaction history |
| New Outward | `/(dashboard)/outwards/new/` | Record outward |

### Stock Audit
| Page | Path | Description |
|------|------|-------------|
| Audit List | `/(dashboard)/stock-audit/` | All audits |
| New Audit | `/(dashboard)/stock-audit/new/` | Create audit |
| Audit Detail | `/(dashboard)/stock-audit/[id]/` | Count items, track variance |

### Purchase Orders
| Page | Path | Description |
|------|------|-------------|
| PO List | `/(dashboard)/purchase-orders/` | Filter by status |
| New PO | `/(dashboard)/purchase-orders/new/` | Create with line items |
| PO Detail | `/(dashboard)/purchase-orders/[id]/` | View, approve, track receiving |

### Vendors
| Page | Path | Description |
|------|------|-------------|
| Vendor List | `/(dashboard)/vendors/` | All vendors |
| New Vendor | `/(dashboard)/vendors/new/` | Add vendor |
| Vendor Detail | `/(dashboard)/vendors/[id]/` | Details, contacts, payment terms |

### Bills & Payments
| Page | Path | Description |
|------|------|-------------|
| Bill List | `/(dashboard)/bills/` | Status tracking, overdue filter |
| Bill Detail | `/(dashboard)/bills/[id]/` | Payments, follow-ups |
| New Payment | `/(dashboard)/payments/new/` | Record payment |

### Accounts & Reports
| Page | Path | Description |
|------|------|-------------|
| Accounts | `/(dashboard)/accounts/` | Financial summary |
| Reports Hub | `/(dashboard)/reports/` | All reports |
| Stock Value | `/(dashboard)/reports/stock-value/` | Valuation |
| Movement | `/(dashboard)/reports/movement/` | Inward/outward trends |
| Purchase | `/(dashboard)/reports/purchase/` | PO & spend |
| Expense Summary | `/(dashboard)/reports/expense-summary/` | By category |
| Daily | `/(dashboard)/reports/daily/` | Daily transactions |

### Team
| Page | Path | Description |
|------|------|-------------|
| Team List | `/(dashboard)/team/` | All users |
| New User | `/(dashboard)/team/new/` | Add user |
| Edit User | `/(dashboard)/team/[id]/` | Edit role/permissions |

### Settings & AI
| Page | Path | Description |
|------|------|-------------|
| More/Settings | `/(dashboard)/more/` | Settings menu |
| Bins | `/(dashboard)/more/bins/` | Manage storage bins |
| Zoho Settings | `/(dashboard)/more/zoho/` | Zoho Books integration |
| AI Insights | `/(dashboard)/ai/` | AI dashboard |

### Auth
| Page | Path | Description |
|------|------|-------------|
| Login | `/login/` | Access code login |

---

## 5. Components

| Component | File | Description |
|-----------|------|-------------|
| Button | `components/ui/button.tsx` | Variants: default, destructive, outline, secondary, ghost, link |
| Input | `components/ui/input.tsx` | Form input with consistent styling |
| Card | `components/ui/card.tsx` | Card, CardHeader, CardTitle, CardContent |
| Badge | `components/ui/badge.tsx` | Status badges with color variants |
| DashboardCard | `components/dashboard-card.tsx` | Stat card: icon, label, value, trend indicator |
| TransactionItem | `components/transaction-item.tsx` | Transaction row: inward/outward, product, qty, time |
| Header | `components/header.tsx` | App header with navigation |
| BottomNav | `components/bottom-nav.tsx` | Mobile bottom navigation bar |
| ExportButtons | `components/export-buttons.tsx` | Excel/PDF export buttons |
| SessionProvider | `components/session-provider.tsx` | NextAuth wrapper |
| SWRegister | `components/sw-register.tsx` | Service worker registration |

---

## 6. Library & Utilities

| File | Purpose | Key Exports |
|------|---------|-------------|
| `lib/auth.ts` | NextAuth config | `authOptions` — CredentialsProvider with access code |
| `lib/auth-helpers.ts` | Auth utilities | `getServerSession()`, `getCurrentUser()`, `requireAuth(roles)` |
| `lib/db.ts` | Database | Prisma client singleton |
| `lib/validations.ts` | Zod schemas | Schemas for all entities (product, vendor, PO, bill, etc.) |
| `lib/barcode.ts` | Barcode/serial | `generateBarcodePng()`, `generateSerialCode()`, `generateBatchSerialCodes()` |
| `lib/ai-calculations.ts` | AI logic | `calcSalesVelocity()`, `calcReorderPoint()`, `classifyDemand()`, `calcTrend()` |
| `lib/export.ts` | Data export | `exportToExcel()`, `exportToPDF()` |
| `lib/api-utils.ts` | API helpers | `successResponse()`, `errorResponse()`, `paginatedResponse()`, `parseSearchParams()` |
| `lib/zoho.ts` | Zoho client | `ZohoClient` class — token mgmt, items, contacts, invoices, bills |
| `lib/utils.ts` | Client utils | `cn()`, `formatINR()`, `formatTime()`, `useDebounce()` |
| `lib/mock-data.ts` | Dev data | Sample products, transactions |

---

## 7. Authentication

### Strategy
- **Method**: Access Code login (no email/password form)
- **Session**: JWT-based (no database sessions)
- **Password Storage**: bcrypt hashed

### Login Flow
1. User enters access code on `/login`
2. NextAuth `CredentialsProvider` finds user by `accessCode`
3. Password verified via `bcryptjs.compare()`
4. JWT issued with `userId`, `name`, `email`, `role`
5. Session accessible in server components via `getServerSession(authOptions)`

### Roles & Permissions
| Role | Access Level |
|------|-------------|
| ADMIN | Full access — all features, user management |
| SUPERVISOR | Most features — reports, audits, approvals |
| MANAGER | Products, POs, vendors, reports |
| INWARDS_CLERK | Inward transactions only |
| OUTWARDS_CLERK | Outward transactions only |

### Protection
- API routes use `requireAuth(['ADMIN', 'MANAGER'])` for role-based access
- `getCurrentUser()` for authenticated user info
- Dashboard shows role-specific widgets

---

## 8. Zoho Integration

### OAuth Self-Client Flow
1. Admin enters Zoho app credentials (client ID, client secret)
2. Generates grant token from Zoho Developer Console
3. App exchanges grant token → refresh token + access token
4. Tokens stored in `ZohoConfig` singleton record
5. Access token auto-refreshed on expiry

### Sync Operations
| Sync Type | Direction | Description |
|-----------|-----------|-------------|
| Items | Zoho → App | Sync products with SKU matching |
| Contacts | Zoho → App | Sync vendors |
| Invoices | Zoho → App | Sync sales invoices |
| Bills | Zoho → App | Sync purchase bills |
| All | Zoho → App | Sequential sync of all types |

### Import Operations
| Import | Description |
|--------|-------------|
| Items | Import specific products by selection |
| Contacts | Import specific contacts as vendors |
| Bills | Import specific bills |

### Tracking
- Every sync creates a `SyncLog` with status, counts, errors
- UI shows sync history with success/failure details
- Rate limiting handled (Zoho 429 response)

---

## 9. AI Features

All AI features are **rule-based** (no ML models required).

### Reorder Suggestions
- Calculates reorder point: `avgDailyUsage × leadTime + safetyStock`
- Suggests quantity based on `maxStock - currentStock`
- Priority scoring: considers stock level, velocity, days until stockout

### Demand Forecasting
- Classifies demand: FAST, MEDIUM, SLOW, DEAD
- Calculates trend: INCREASING, DECREASING, STABLE
- Sales velocity: `totalSold / daysPeriod`

### Low Stock Alerts
- Compares `currentStock` vs `minStock` and `reorderLevel`
- Priority: CRITICAL (0 stock), HIGH (<50% of min), MEDIUM (<min), LOW (approaching)

### Dashboard Insights
- Products needing reorder
- Top sellers / slow movers
- Overstock detection
- Stock value summary
- Dead stock identification

### Utility Functions
| Function | Description |
|----------|-------------|
| `calcSalesVelocity(sold, days)` | Units per day |
| `calcReorderPoint(velocity, leadTime, safety)` | When to reorder |
| `calcDaysUntilStockout(stock, velocity)` | Urgency metric |
| `classifyDemand(velocity)` | FAST/MEDIUM/SLOW/DEAD |
| `calcTrend(recent, previous)` | Direction of change |
| `calcPriorityScore(stock, min, velocity)` | 0-100 score |
| `formatINR(amount)` | ₹1,234.56 format |

---

## 10. PWA Configuration

### Manifest (`public/manifest.json`)
- **Name**: Bike Inventory Manager
- **Display**: Standalone (app-like)
- **Theme**: #2563eb (blue)
- **Icons**: 192x192, 512x512 (maskable)

### Service Worker (`public/sw.js`)
- Cache name: `bike-inventory-v1`
- Offline fallback: `/offline.html`
- Navigation request interception
- Cache cleanup on activate

### Offline Page (`public/offline.html`)
- User-friendly offline message
- Retry button
- Styled inline

---

## 11. Key Workflows

### Inward Transaction
```
Select Product → Enter Qty → (Optional: Enable Serial Tracking)
→ (Optional: Enter serial details per item)
→ Submit → Stock +N → SerialItems created → Transaction logged
```

### Outward Transaction
```
Select Product → Enter Qty → Enter Reference No
→ (Optional: RGP with return date)
→ Submit → Stock -N → Transaction logged
```

### Purchase Order
```
Select Vendor → Add Line Items (product, qty, price, GST)
→ Auto-calculate totals → Save as DRAFT
→ Manager/Admin approves → Status: SENT
→ Receive goods → Create inward → Status: RECEIVED
→ Create bill → Track payment
```

### Bill Payment
```
Bill received → Record bill (amount, due date)
→ Record payments (partial or full)
→ Bill status auto-updates (PENDING → PARTIALLY_PAID → PAID)
→ Track follow-ups for overdue bills
→ Apply vendor credits if available
```

### Stock Audit
```
Create audit → Assign to user → Set due date
→ User counts physical items → Enter counted qty
→ System calculates variance (counted - system)
→ Mark complete → Review discrepancies
```

### Zoho Sync
```
Settings → Enter Zoho credentials → Connect
→ Sync items/contacts/bills/invoices
→ View sync log (success/failure/partial)
→ Import specific items as needed
```

---

## 12. Project Structure

```
bike-inventory/
├── prisma/
│   ├── schema.prisma          # Database schema (all models)
│   └── seed.ts                # Database seeding
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker
│   ├── offline.html           # Offline fallback
│   └── icons/                 # App icons (192, 512)
├── src/
│   ├── app/
│   │   ├── api/               # 56 API route files
│   │   │   ├── auth/          # NextAuth
│   │   │   ├── products/      # Product CRUD + search
│   │   │   ├── categories/    # Category CRUD
│   │   │   ├── brands/        # Brand CRUD
│   │   │   ├── bins/          # Bin CRUD
│   │   │   ├── inventory/     # Inwards/outwards
│   │   │   ├── serials/       # Serial item CRUD + search
│   │   │   ├── stock-counts/  # Audit CRUD + items
│   │   │   ├── vendors/       # Vendor CRUD + contacts
│   │   │   ├── purchase-orders/ # PO CRUD + approve
│   │   │   ├── bills/         # Bill CRUD + follow-up
│   │   │   ├── payments/      # Payment CRUD
│   │   │   ├── credits/       # Vendor credits
│   │   │   ├── expenses/      # Expense CRUD
│   │   │   ├── reports/       # 5 report endpoints
│   │   │   ├── accounts/      # Account summary
│   │   │   ├── stock/         # Stock summary
│   │   │   ├── barcode/       # Barcode generation
│   │   │   ├── zoho/          # Zoho auth + sync + import
│   │   │   ├── ai/            # AI insights + forecast + alerts
│   │   │   └── users/         # User CRUD + seed
│   │   ├── (dashboard)/       # 32 protected pages
│   │   │   ├── page.tsx       # Dashboard
│   │   │   ├── stock/         # Inventory pages
│   │   │   ├── inwards/       # Inward pages
│   │   │   ├── outwards/      # Outward pages
│   │   │   ├── stock-audit/   # Audit pages
│   │   │   ├── purchase-orders/ # PO pages
│   │   │   ├── vendors/       # Vendor pages
│   │   │   ├── bills/         # Bill pages
│   │   │   ├── payments/      # Payment pages
│   │   │   ├── accounts/      # Accounts page
│   │   │   ├── reports/       # 6 report pages
│   │   │   ├── team/          # User management pages
│   │   │   ├── scanner/       # Barcode scanner
│   │   │   ├── ai/            # AI insights
│   │   │   └── more/          # Settings (bins, zoho)
│   │   ├── login/             # Login page
│   │   ├── layout.tsx         # Root layout
│   │   └── globals.css        # Global styles
│   ├── components/            # 11 React components
│   │   ├── ui/                # Button, Input, Card, Badge
│   │   ├── dashboard-card.tsx
│   │   ├── transaction-item.tsx
│   │   ├── header.tsx
│   │   ├── bottom-nav.tsx
│   │   ├── export-buttons.tsx
│   │   ├── session-provider.tsx
│   │   └── sw-register.tsx
│   ├── lib/                   # 11 utility files
│   │   ├── auth.ts            # NextAuth config
│   │   ├── auth-helpers.ts    # Session helpers
│   │   ├── db.ts              # Prisma client
│   │   ├── validations.ts     # Zod schemas
│   │   ├── barcode.ts         # Barcode/serial generation
│   │   ├── ai-calculations.ts # AI utility functions
│   │   ├── export.ts          # Excel/PDF export
│   │   ├── api-utils.ts       # API response helpers
│   │   ├── zoho.ts            # Zoho client class
│   │   ├── utils.ts           # Client utilities
│   │   └── mock-data.ts       # Sample data
│   └── types/
│       ├── index.ts           # All TypeScript interfaces
│       └── next-pwa.d.ts      # PWA type declarations
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── eslint.config.mjs
├── package.json
└── .env                       # Environment variables (not committed)
```

---

## 13. Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/bike_inventory

# Authentication
NEXTAUTH_SECRET=<random-secret-string>
NEXTAUTH_URL=http://localhost:3000

# Zoho (Optional — configured via UI)
ZOHO_CLIENT_ID=<zoho-client-id>
ZOHO_CLIENT_SECRET=<zoho-client-secret>
```

---

## 14. NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `next dev --turbopack` | Development server |
| `build` | `next build` | Production build |
| `start` | `next start` | Production server |
| `lint` | `next lint` | ESLint check |
| `db:generate` | `prisma generate` | Generate Prisma client |
| `db:push` | `prisma db push` | Push schema to DB |
| `db:migrate` | `prisma migrate dev` | Create & run migration |
| `db:seed` | `ts-node prisma/seed.ts` | Seed database |
| `db:studio` | `prisma studio` | Open DB browser |

---

## 15. Development Phases

| Phase | Deliverables |
|-------|-------------|
| **Phase 1** — Core Inventory | Products, categories, brands, bins, inwards/outwards, dashboard |
| **Phase 2** — Accounts & Vendors | Vendors, POs, bills, payments, credits, expenses, accounts page |
| **Phase 3** — Reports & Stock Audit | 5 reports, stock audit with variance tracking, movement classification |
| **Phase 4** — Barcode & Serial | Barcode generation (CODE128/QR/EAN13), serial tracking, scanner page |
| **Phase 5** — User Management | Auth with bcrypt, RBAC (5 roles), team CRUD, access code login |
| **Phase 6** — Zoho Integration | OAuth2 self-client, ZohoClient class, 9 sync APIs, settings UI |
| **Phase 7** — AI Features | Reorder suggestions, demand forecast, low stock alerts, dashboard insights |
| **Phase 8** — PWA & Polish | Service worker, offline page, icons, real dashboard, debounced search, error handling |

---

## Summary Stats

| Metric | Count |
|--------|-------|
| API Routes | 56 |
| UI Pages | 39 |
| Components | 11 |
| Library Files | 11 |
| Database Models | 18 |
| User Roles | 5 |
| Zoho Sync Types | 4 |
| Report Types | 5 |
| AI Endpoints | 4 |
| Development Phases | 8 |
