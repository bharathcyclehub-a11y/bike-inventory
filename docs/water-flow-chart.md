# Water Flow Chart: Bharath Cycle Hub — Complete Operations & Control Map

> **Version**: 1.0 | **Date**: 16 April 2026 | **Author**: Syed Ibrahim (Owner)
> **Purpose**: Single document showing ALL app operations, who does what, when data changes, frontend views, 30-day lifecycle, loopholes & defenses.
> **Goal**: Inventory and accounts go hand-in-hand. Every step validates the previous and forward. Each step is done by different people. Measurable control over everything.

---

## Section 1: TEAM & ROLE MAP

| Person | Role | App Role | Bottom Nav Tabs | Daily Actions |
|--------|------|----------|-----------------|---------------|
| Syed Ibrahim | Owner | ADMIN | Home, Inwards, Outwards, Stock, More | Full oversight, approvals, sends POs to vendors, overrides |
| Srinu | Supervisor | SUPERVISOR | Home, Accounts, Vendors, Bills, More | Approve delivery expenses, audit oversight, bill follow-ups |
| Abhi Gowda | Purchase Manager | PURCHASE_MANAGER | Home, Stock, Reorder, POs, More | Set reorder levels, create POs, share POs to Syed, enter tracking links |
| Sravan | Accounts Manager | ACCOUNTS_MANAGER | Home, Expenses, Accounts, Audit, More | 20+ expenses/day, payment recording, audit creation |
| Nithin | Inwards Clerk | INWARDS_CLERK | Home, Verify, Stock Count, Stock, More | Verify Zoho inwards, physical receipt, putaway to bins |
| Ranjitha | Outwards Clerk | OUTWARDS_CLERK | Home, Deliveries, Stock Count, Stock, More | Verify Zoho outwards, dispatch, delivery expense, second-hand bike intake |

### Access Control Summary

| Action | Who CAN | Who CANNOT |
|--------|---------|------------|
| Approve POs | Syed, Srinu | Abhi, Sravan, Nithin, Ranjitha |
| Send PO to vendor | Syed ONLY | Everyone else |
| Verify inward receipt | Nithin | Everyone else |
| Verify outward dispatch | Ranjitha | Everyone else |
| Record delivery expense | Ranjitha | Everyone else |
| Approve delivery expense | Srinu, Syed | Ranjitha, Sravan, Abhi, Nithin |
| Record payments | Sravan | Everyone else |
| Create stock audit | Sravan, Syed | Nithin, Ranjitha, Abhi |
| Count stock (assigned) | Nithin, Ranjitha | Cannot self-assign |
| Approve stock variance | Syed, Srinu | Counters themselves |
| Approve Zoho pull data | Syed, Srinu | Everyone else |
| Record second-hand intake | Ranjitha | Everyone else |
| Set second-hand selling price | Syed, Srinu | Ranjitha |

---

## Section 2: THE MASTER WATER FLOW

```
===============================================================
                ZOHO POS (SOURCE OF TRUTH)
           All billing happens here. App verifies.
===============================================================
                         |
          +--------------+--------------+
          |              |              |
   Purchase Bills   Sales Invoices   Item Catalog
   (Vendor buys)    (Customer sales) (Products)
          |              |              |
          v              v              v
===============================================================
          DAILY AUTO-PULL (1 PM IST - Cron Job)
        Pulls NEW data only. ~5-26 API calls/day.
        All data goes to PREVIEW for admin approval.
===============================================================
          |              |              |
          v              v              v
   ZohoPullPreview  ZohoPullPreview  ZohoPullPreview
   (entityType:     (entityType:     (entityType:
    bill)            invoice)         item/contact)
          |              |              |
          v              v              v
===============================================================
       ADMIN/SUPERVISOR REVIEWS & APPROVES
       (More > Zoho > Review & Approve Pulls)
===============================================================
          |              |              |
          v              v              v
   VendorBill +     Delivery        Product/Vendor
   UNVERIFIED       (PENDING)       (new records)
   Inward
          |              |
          v              v
   NITHIN VERIFIES  RANJITHA VERIFIES
   (stock increases) (stock decreases)
```

---

### FLOW 1: INWARD (Purchase -> Stock)

```
+---------------------------------------------------------------+
|  INWARD FLOW (Purchase -> Stock)                               |
|  Zoho Bill --> App creates UNVERIFIED inward --> Nithin sees   |
|                                                                 |
|  STEP 1: Zoho pull creates inward [ZOHO][UNVERIFIED]          |
|          WHO: System (auto)                                     |
|          WHAT CHANGES: Nothing yet -- stock NOT added           |
|          FRONTEND: Appears in Nithin's "Verify" tab (yellow)   |
|                                                                 |
|  STEP 2: Nithin physically checks goods received               |
|          WHO: Nithin (INWARDS_CLERK)                           |
|          WHAT HE SEES: List of unverified items with qty/vendor|
|          WHAT HE DOES: Checks physical items match             |
|                                                                 |
|  STEP 3: Nithin taps "Confirm Receipt"                        |
|          WHO: Nithin (INWARDS_CLERK)                           |
|          WHAT CHANGES: Product.currentStock += qty             |
|                        Transaction marked [VERIFIED]           |
|          FRONTEND: Item moves from "Unverified" to "Verified" |
|          CONTROL: Admin can see who verified, when             |
|                                                                 |
|  STEP 4: Nithin does putaway (assigns bin)                    |
|          WHO: Nithin (INWARDS_CLERK)                           |
|          WHAT CHANGES: Product.binId = selected bin            |
|          FRONTEND: Stock page shows item in correct bin        |
|                                                                 |
|  VALIDATION CHAIN:                                             |
|  [x] Zoho bill exists (can't fake an inward)                  |
|  [x] Physical verification (Nithin confirms receipt)           |
|  [x] Stock only increases AFTER verification                   |
|  [x] Different person from billing (Zoho) and receiving        |
|  [x] Timestamp + userId on every step                          |
+---------------------------------------------------------------+
```

---

### FLOW 2: OUTWARD + DELIVERY EXPENSE (Sales -> Stock -> Expense)

```
+---------------------------------------------------------------+
|  OUTWARD + DELIVERY EXPENSE FLOW                               |
|  Zoho Invoice -> Delivery -> Ranjitha verifies -> Expense      |
|                                                                 |
|  STEP 1: Zoho pull creates PENDING delivery                   |
|          WHO: System (auto)                                     |
|          WHAT CHANGES: Delivery record created (PENDING)       |
|          FRONTEND: Appears in Ranjitha's "Deliveries" tab      |
|                                                                 |
|  STEP 2: Ranjitha verifies items dispatched                   |
|          WHO: Ranjitha (OUTWARDS_CLERK)                        |
|          WHAT SHE SEES: Invoice items, qty, customer details   |
|          WHAT SHE DOES: Checks items physically handed over    |
|                                                                 |
|  STEP 3: Ranjitha taps "Verify Dispatch"                      |
|          WHO: Ranjitha (OUTWARDS_CLERK)                        |
|          WHAT CHANGES: Product.currentStock -= qty             |
|                        Delivery.status = VERIFIED              |
|          FRONTEND: Item moves to "Verified" section            |
|                                                                 |
|  STEP 4: Delivery status progresses                           |
|          VERIFIED -> SCHEDULED -> OUT_FOR_DELIVERY             |
|                                                                 |
|  * STEP 5: Ranjitha marks "DELIVERED"                         |
|          WHO: Ranjitha (OUTWARDS_CLERK)                        |
|          APP PROMPTS: "What was the delivery expense?"         |
|          WHAT SHE ENTERS:                                      |
|            - Delivery expense amount (Rs.)                     |
|            - Payment mode (CASH/UPI/etc.)                      |
|            - Reference (receipt no, vehicle no)                 |
|          WHAT CHANGES:                                          |
|            - Delivery.status = DELIVERED                       |
|            - Expense record created (category=DELIVERY)        |
|            - Expense.deliveryId = this delivery (LINKED)       |
|            - Expense.status = PENDING_APPROVAL                 |
|          FRONTEND: Delivery shows checkmark with expense amt   |
|                                                                 |
|  * STEP 6: Srinu approves delivery expense                    |
|          WHO: Srinu (SUPERVISOR)                               |
|          WHAT HE SEES: Delivery details + expense amount       |
|          WHAT HE CHECKS:                                       |
|            - Is the expense reasonable for this delivery?      |
|            - Is the payment going from correct brand pay?      |
|          WHAT HE DOES: Approves or rejects                    |
|          WHAT CHANGES:                                          |
|            - Expense.status = APPROVED (or REJECTED)           |
|            - Expense.approvedById = Srinu                     |
|          FRONTEND: Expense turns green (approved) or red       |
|                                                                 |
|  VALIDATION CHAIN:                                             |
|  [x] Zoho invoice exists (can't fake an outward)              |
|  [x] Stock must exist (rejects if currentStock < qty)         |
|  [x] Physical verification (Ranjitha confirms dispatch)       |
|  [x] Delivery expense MANDATORY on marking delivered          |
|  [x] Expense linked to specific invoice (traceable)           |
|  [x] Srinu approves expense (different person)                |
|  [x] Brand pay verification (correct payment source)          |
|  [x] 3 people: billing (Zoho), dispatch (Ranjitha),           |
|      approval (Srinu)                                          |
+---------------------------------------------------------------+
```

---

### FLOW 3: ACCOUNTS (Bills, Payments, Expenses)

```
+---------------------------------------------------------------+
|  ACCOUNTS FLOW (Runs Parallel to Inventory)                    |
|                                                                 |
|  VENDOR BILLS (Zoho pull)                                      |
|  -------------------------                                      |
|  STEP 1: Bill pulled from Zoho -> VendorBill (PENDING)        |
|          WHO: System (auto)                                     |
|          FRONTEND: Appears in Srinu's "Bills" tab              |
|                                                                 |
|  STEP 2: Srinu reviews bill details                           |
|          WHO: Srinu (SUPERVISOR)                               |
|          WHAT HE SEES: Bill amount, vendor, due date, PO link  |
|          CROSS-CHECK: Bill <-> Inward verified? Items match?   |
|                                                                 |
|  STEP 3: Sravan records payment                               |
|          WHO: Sravan (ACCOUNTS_MANAGER)                        |
|          WHAT HE SEES: Vendor, pending bills, CD eligibility   |
|          WHAT CHANGES: VendorPayment created                   |
|                        Bill.paidAmount += payment              |
|                        Bill.status -> PARTIALLY_PAID or PAID   |
|          FRONTEND: Bill turns green (PAID) or orange (PARTIAL) |
|                                                                 |
|  CD (Cash Discount) CHECK:                                     |
|          If billDate + vendor.cdTermsDays > today:             |
|            -> "CD eligible! Save Rs.X (Y%)"                   |
|            -> "CD expires in Z days"                           |
|          After expiry: full amount due                         |
|                                                                 |
|  VALIDATION CHAIN:                                             |
|  [x] Bill comes from Zoho (can't fake a bill)                 |
|  [x] Srinu reviews (SUPERVISOR) -- different from payer       |
|  [x] Sravan pays (ACCOUNTS) -- different from reviewer        |
|  [x] Payment mode + reference tracked (cheque#, UTR, UPI ID)  |
|  [x] CD auto-calculated, no manual manipulation               |
|                                                                 |
|  EXPENSES (Daily)                                              |
|  ----------------                                              |
|  WHO: Sravan (20+/day)                                         |
|  CATEGORIES: DELIVERY, TRANSPORT, SHOP_MAINTENANCE, UTILITIES, |
|              SALARY_ADVANCE, FOOD_TEA, STATIONERY, MISC        |
|  CONTROL: Category + amount + mode + reference tracked         |
|  DELIVERY EXPENSES: Auto-created by Ranjitha (see Flow 2)     |
|                     Approved by Srinu before counted           |
|  FRONTEND: Sravan's bottom nav has "Expenses" prominently      |
+---------------------------------------------------------------+
```

---

### FLOW 4: PURCHASE ORDER + ITEM JOURNEY TRACKING

```
+---------------------------------------------------------------+
|  PURCHASE ORDER + ITEM JOURNEY TRACKING                        |
|                                                                 |
|  STEP 1: AI alerts low stock                                  |
|          (Product.currentStock <= reorderLevel)                |
|          WHO: System (auto)                                     |
|          FRONTEND: Abhi sees "Reorder" tab with suggestions    |
|                                                                 |
|  STEP 2: Abhi Gowda creates PO (DRAFT)                       |
|          WHO: Abhi Gowda (PURCHASE_MANAGER)                   |
|          WHAT: Selects vendor, adds items + qty + price + GST  |
|          FRONTEND: PO form with line items, auto-calc totals   |
|                                                                 |
|  STEP 3: Syed approves PO                                     |
|          WHO: Syed (ADMIN) or Srinu (SUPERVISOR)              |
|          WHAT CHANGES: PO.status -> APPROVED                   |
|                        PO.approvedBy = approver               |
|          FRONTEND: PO turns green, ready to share              |
|                                                                 |
|  * STEP 4: Abhi shares PO to Syed on WhatsApp                |
|          WHO: Abhi Gowda (PURCHASE_MANAGER)                   |
|          HOW: Taps "Share PO" -> opens WhatsApp with PO text  |
|          WHAT CHANGES: PO.status -> SHARED_WITH_ADMIN          |
|          NOTE: Abhi does NOT contact vendor directly           |
|                                                                 |
|  * STEP 5: Syed sends PO to vendor on WhatsApp               |
|          WHO: Syed (ADMIN)                                     |
|          HOW: Syed forwards/copies PO text to vendor           |
|          WHAT CHANGES: PO.status -> SENT_TO_VENDOR             |
|          CONTROL: Only Syed communicates with vendors          |
|                                                                 |
|  * STEP 6: ITEM JOURNEY TRACKING                              |
|          Vendor shares tracking link with Syed                 |
|          -> Syed forwards tracking link to Abhi               |
|          -> Abhi enters tracking info in app:                  |
|               - Tracking URL / link                            |
|               - Transporter name                               |
|               - Expected delivery date                         |
|               - LR number / docket number                      |
|          -> WHAT CHANGES:                                      |
|               - PO.trackingUrl = link                          |
|               - PO.transporterName = transporter               |
|               - PO.expectedDate = updated ETA                  |
|               - PO.lrNumber = LR/docket no                    |
|               - PO.status -> IN_TRANSIT                        |
|          -> FRONTEND: PO detail page shows:                    |
|               - "In Transit" badge with transporter info       |
|               - Clickable tracking link                        |
|               - Expected arrival date                          |
|               - Days until arrival countdown                   |
|          -> VISIBLE TO: Syed, Abhi, Srinu, Nithin             |
|                                                                 |
|  STEP 7: Goods arrive -> Zoho bill -> Inward flow triggers    |
|          PO.status -> PARTIALLY_RECEIVED -> RECEIVED           |
|          Nithin verifies (links back to Inward Flow)           |
|                                                                 |
|  VALIDATION CHAIN:                                             |
|  [x] Abhi creates (knows what's needed)                       |
|  [x] Syed approves AND sends to vendor (spending + vendor     |
|      control)                                                  |
|  [x] Tracking entered by Abhi (accountability for updates)    |
|  [x] Nithin receives (different person from creator/sender)   |
|  [x] 4 people: creator(Abhi), approver+sender(Syed),         |
|      tracker(Abhi), receiver(Nithin)                           |
|  [x] PO amount auto-calculated (no manipulation)              |
|  [x] Full journey visible: Created -> Approved -> Sent ->     |
|      In Transit -> Received -> Verified                        |
+---------------------------------------------------------------+
```

#### Item Journey Timeline (visible on PO detail page)

```
  o Created          Abhi created PO          Apr 16, 10:00 AM
  |
  o Approved         Syed approved            Apr 16, 11:30 AM
  |
  o Sent to Vendor   Syed sent on WhatsApp    Apr 16, 12:00 PM
  |
  o In Transit       Abhi added tracking      Apr 17, 02:00 PM
  |                  Transporter: XYZ Cargo
  |                  LR: LR-12345
  |                  ETA: Apr 20
  |
  o Received         Nithin confirmed         Apr 20, 09:30 AM
  |                  Verified: 10/10 items
  |
  o Bill Paid        Sravan recorded payment   Apr 25, 05:00 PM
                     Rs.45,000 via NEFT
```

---

### FLOW 5: STOCK AUDIT

```
+---------------------------------------------------------------+
|  STOCK AUDIT FLOW (Periodic Verification)                      |
|                                                                 |
|  STEP 1: Sravan/Syed creates stock count                      |
|          WHO: Sravan (ACCOUNTS_MANAGER) or Syed (ADMIN)       |
|          WHAT: Assigns to staff, sets scope (bin/type),        |
|                due date                                        |
|          FRONTEND: Stock audit page with create form           |
|                                                                 |
|  STEP 2: Assigned person counts physically                    |
|          WHO: Nithin or Ranjitha (assigned clerk)             |
|          WHAT THEY SEE: List of items with systemQty,          |
|                         input box                              |
|          WHAT THEY DO: Enter countedQty for each item         |
|          FRONTEND: Progress bar (X/Y items counted)           |
|                                                                 |
|  STEP 3: Variance auto-calculated                             |
|          SYSTEM: variance = systemQty - countedQty            |
|          FRONTEND: Red highlight on items with variance != 0   |
|                                                                 |
|  STEP 4: Syed/Srinu reviews and approves                     |
|          WHO: Syed (ADMIN) or Srinu (SUPERVISOR)              |
|          WHAT THEY SEE: Summary of variances, details per item |
|          DECISION: APPROVE (accept variance) or REJECT         |
|                    (recount)                                   |
|          IF APPROVED: ADJUSTMENT transactions correct stock    |
|                                                                 |
|  VALIDATION CHAIN:                                             |
|  [x] Creator (Sravan) != Counter (Nithin/Ranjitha) !=         |
|      Approver                                                  |
|  [x] System stock vs physical stock = measurable variance     |
|  [x] Cannot self-assign audit                                 |
|  [x] Overdue audits flagged with red banner                   |
|  [x] All adjustments create transaction records (audit trail) |
+---------------------------------------------------------------+
```

---

### FLOW 6: SECOND-HAND BICYCLE INTAKE & SALE

```
+---------------------------------------------------------------+
|  SECOND-HAND BICYCLE FLOW                                      |
|  (Cash Purchase -> Resale -> Profit)                           |
|  Ranjitha handles end-to-end intake. Syed records pricing.    |
|                                                                 |
|  =====================                                         |
|  INTAKE (How bikes come in)                                    |
|  =====================                                         |
|                                                                 |
|  SOURCE A: Customer walks in with old bike                    |
|  SOURCE B: Picked up during delivery (Ranjitha's team picks   |
|            up old bike when delivering new one)                |
|                                                                 |
|  STEP 1: Floor staff receives the bicycle                     |
|          WHO: Floor staff / Ranjitha                           |
|          WHERE: Shop floor                                     |
|                                                                 |
|  STEP 2: Ranjitha inspects the bicycle                        |
|          WHO: Ranjitha (OUTWARDS_CLERK)                        |
|          WHAT SHE CHECKS: Frame, wheels, brakes, gears, tyres |
|          DECISION: Accept or reject                            |
|                                                                 |
|  STEP 3: Ranjitha records intake in app                       |
|          WHO: Ranjitha (OUTWARDS_CLERK)                        |
|          WHAT SHE ENTERS:                                      |
|            - Seller name                                       |
|            - Seller phone number                               |
|            - Purchase price (CASH -- outside Zoho)            |
|            - Bicycle details (brand, type, size, condition)    |
|            - Source: WALK_IN or PICKED_UP_ON_DELIVERY          |
|            - If picked up: link to delivery ID                 |
|            - Photo of the bicycle (proof of condition)         |
|          WHAT CHANGES:                                          |
|            - SecondHandBike record created (status: RECEIVED)  |
|            - Bin: BCH-GF-02 (Second Hand Bin) auto-assigned   |
|          FRONTEND: Appears in "Second Hand" section            |
|                                                                 |
|  STEP 4: Physical sticker placed on bicycle                   |
|          WHO: Ranjitha / floor staff                           |
|          WHAT: "SECOND HAND" sticker with intake date + ID    |
|          Bike moved to BCH-GF-02 (Second Hand Bin)            |
|                                                                 |
|  =====================                                         |
|  LISTING & PRICING (Admin decides)                             |
|  =====================                                         |
|                                                                 |
|  STEP 5: Syed/Srinu sets selling price                        |
|          WHO: Syed (ADMIN) or Srinu (SUPERVISOR)              |
|          WHAT THEY SEE: Bike details, photo, purchase price    |
|          WHAT THEY DO: Enter selling price                     |
|          WHAT CHANGES:                                          |
|            - SecondHandBike.sellingPrice = amount              |
|            - SecondHandBike.status = LISTED                    |
|            - Expected profit auto-calculated                   |
|          FRONTEND: Bike shows "Listed Rs.X" badge              |
|                                                                 |
|  STEP 6: Create Zoho item for this bike                       |
|          WHO: Syed (ADMIN) -- manually in Zoho POS            |
|          ITEM NAME FORMAT: "old/{brand} {type} {size}"        |
|          EXAMPLE: "old/Hero MTB 26 Black"                     |
|          SKU: Links back to app's SecondHandBike record        |
|          NOTE: This is manual in Zoho, then pulled by app     |
|                                                                 |
|  =====================                                         |
|  SALE (Via Zoho POS -> Auto-pull to app)                      |
|  =====================                                         |
|                                                                 |
|  STEP 7: Customer buys -- sale recorded in Zoho POS           |
|          WHO: POS operator                                     |
|          WHAT: Zoho invoice created with "old/" item           |
|          Customer gets Zoho invoice                            |
|                                                                 |
|  STEP 8: App auto-pulls the invoice (daily Zoho cron)         |
|          SYSTEM: Detects "old/" prefix in item name            |
|          WHAT CHANGES:                                          |
|            - SecondHandBike.status = SOLD                      |
|            - SecondHandBike.soldAt = date                      |
|            - SecondHandBike.zohoInvoiceNo = invoice number     |
|            - SecondHandBike.soldPrice = invoice amount         |
|            - Profit auto-calculated:                           |
|              soldPrice - purchasePrice                         |
|          FRONTEND: Bike moves to "Sold" section               |
|          STOCK: Removed from BCH-GF-02 bin count              |
|                                                                 |
|  =====================                                         |
|  REPORTING                                                     |
|  =====================                                         |
|                                                                 |
|  DAILY REPORT includes:                                        |
|  +-- Second-hand bikes received today (count + total cost)    |
|  +-- Second-hand bikes sold today (count + revenue)           |
|  +-- Net: bikes in stock in BCH-GF-02                         |
|                                                                 |
|  MONTHLY PROFIT REPORT (Admin only):                           |
|  +----------------------------------------------------+       |
|  | Second-Hand Bicycle P&L -- April 2026               |       |
|  |                                                     |       |
|  | Bikes Received:     12                              |       |
|  | Total Purchase Cost: Rs.48,000                      |       |
|  |                                                     |       |
|  | Bikes Sold:          8                              |       |
|  | Total Sale Revenue:  Rs.72,000                      |       |
|  |                                                     |       |
|  | Gross Profit:        Rs.24,000                      |       |
|  | Avg Margin:          33%                            |       |
|  |                                                     |       |
|  | Unsold in Stock:     4 bikes                        |       |
|  | Unsold Value:        Rs.16,000 (at purchase cost)   |       |
|  | Avg Days to Sell:    11 days                        |       |
|  +----------------------------------------------------+       |
|                                                                 |
|  VALIDATION CHAIN:                                             |
|  [x] Cash purchase recorded with seller details                |
|  [x] Photo proof of bike condition at intake                   |
|  [x] Pricing done by Admin/Supervisor (not intake person)     |
|  [x] Sale through Zoho POS (proper invoice to customer)       |
|  [x] SKU-based matching: purchase price <-> sale price         |
|  [x] Ranjitha handles intake, Syed handles pricing            |
|  [x] Monthly P&L gives Syed full visibility                   |
|  [x] Unsold stock aging tracked (bikes too long = flag)       |
+---------------------------------------------------------------+
```

#### Second-Hand Bike Lifecycle

```
  o RECEIVED       Apr 5   Ranjitha received from walk-in customer
  |                        Seller: Ramesh Kumar, Rs.4,000 cash
  |                        Hero MTB 26" Black, Fair condition
  |                        [Photo attached]
  |
  o STICKERED      Apr 5   Placed in BCH-GF-02 (Second Hand Bin)
  |                        Sticker: SH-0042
  |
  o LISTED         Apr 6   Syed set selling price: Rs.7,000
  |                        Expected profit: Rs.3,000 (75%)
  |
  o ZOHO ITEM      Apr 6   Created in POS: "old/Hero MTB 26 Black"
  |                        SKU: SH-0042
  |
  o SOLD           Apr 16  Customer bought via POS
  |                        Invoice: INV-2026-1234
  |                        Sale price: Rs.7,000
  |                        Actual profit: Rs.3,000
  |
  o P&L UPDATED    Apr 16  Monthly report updated automatically
```

---

## Section 3: 30-DAY LIFECYCLE VIEW

### Day 1-5: Stock Count Baseline (Current Phase)

```
Day 1-2: Create stock counts for all 12 bins
         WHO: Syed/Sravan

Day 2-5: Nithin & Ranjitha physically count all 5200+ items
         Counted stock -> treated as starting inventory

Day 5:   Review variances, approve counts
         Baseline established -> Zoho 2-block system can begin
```

### Day 6-10: Zoho 2-Block System Goes Live

```
Day 6:   Enable Zoho cron auto-pull (1 PM IST daily)
         Purchase bills -> UNVERIFIED inwards
         Sales invoices -> PENDING deliveries

Day 7-10: Team adapts to daily workflow:

         MORNING:
         +-- Nithin: Check "Verify" tab for new inwards
         +-- Ranjitha: Check "Deliveries" tab for new outwards
         +-- Sravan: Record yesterday's expenses
         +-- Abhi: Check reorder alerts, enter tracking updates

         AFTERNOON (after 1 PM Zoho pull):
         +-- Nithin: Verify newly pulled inwards
         +-- Ranjitha: Verify outwards, record delivery expenses
         +-- Srinu: Review bills, approve delivery expenses

         EVENING:
         +-- Srinu: Dashboard overview (today's movements)
         +-- Syed: Review flagged items, send POs to vendors
```

### Day 11-20: Steady State Operations

```
Daily Rhythm (repeats):
+--------+------------------------------------------------------+
| 9 AM   | Nithin verifies yesterday's Zoho inwards             |
|        | Ranjitha verifies yesterday's Zoho outwards           |
|        | Sravan records expenses (20+ entries)                 |
+--------+------------------------------------------------------+
| 10 AM  | Abhi checks reorder levels, creates POs if needed    |
|        | Abhi updates tracking info for in-transit POs         |
|        | Srinu reviews pending bills, CD deadlines             |
|        | Srinu approves pending delivery expenses              |
+--------+------------------------------------------------------+
| 1 PM   | ZOHO AUTO-PULL (system)                              |
|        | New inwards/outwards appear in app                   |
+--------+------------------------------------------------------+
| 2 PM   | Nithin verifies afternoon pull inwards                |
|        | Ranjitha verifies outwards + records delivery expense |
+--------+------------------------------------------------------+
| 5 PM   | Sravan records payments against bills                 |
|        | Srinu reviews daily dashboard                        |
+--------+------------------------------------------------------+
| 7 PM   | Syed reviews: stock value, overdue bills, exceptions  |
|        | Syed sends approved POs to vendors via WhatsApp       |
|        | Syed forwards vendor tracking links to Abhi           |
+--------+------------------------------------------------------+

Weekly:
+-- Stock audit (1 bin per week rotation = all 12 bins in 12 weeks)
+-- PO review: check in-transit POs, follow up on delayed shipments
+-- Vendor issue review: any quality/shortage problems
+-- Delivery expense summary review
+-- Bajaj EMI cross-check (future)
```

### Day 21-30: Review & Optimize

```
Day 21: Phase 10 features (if stock count baseline verified)
        +-- Multi-select inactive items + Excel export for Zoho
        +-- Pull brand details from Zoho

Day 25: First full month review:
        +-- Stock value report: what's the total inventory worth?
        +-- Purchase report: how much was bought this month?
        +-- Expense summary: where is money going?
        +-- Delivery expense total vs invoice total (margin check)
        +-- Movement report: which items move fast/slow?
        +-- Vendor analysis: who delivers on time?

Day 30: CONTROL CHECKPOINT
        +-- All inwards verified? (count of unverified = 0?)
        +-- All outwards verified? (count of pending = 0?)
        +-- All delivery expenses recorded and approved?
        +-- All in-transit POs have tracking info?
        +-- All bills paid or scheduled? (overdue count?)
        +-- CD savings captured? (total CD discount amount)
        +-- Stock audit variances < threshold?
        +-- Expense trend vs last month?
        +-- Low stock items actioned? (reorder POs created?)
```

---

## Section 4: SEPARATION OF DUTIES MATRIX

```
EVERY CRITICAL OPERATION REQUIRES 2-4 DIFFERENT PEOPLE
======================================================

PURCHASE CYCLE (4 people):
  Creates PO          -> Abhi (PURCHASE_MANAGER)
  Approves PO         -> Syed (ADMIN)
  Sends to vendor     -> Syed (ADMIN) -- only Syed talks to vendors
  Enters tracking     -> Abhi (PURCHASE_MANAGER)
  Receives goods      -> Nithin (INWARDS_CLERK)
  Records payment     -> Sravan (ACCOUNTS_MANAGER)

SALES + DELIVERY CYCLE (3 people):
  Bills in Zoho       -> Zoho POS (system/cashier)
  Verifies dispatch   -> Ranjitha (OUTWARDS_CLERK)
  Records del. cost   -> Ranjitha (at delivery time)
  Approves del. cost  -> Srinu (SUPERVISOR)
  Reviews financials  -> Syed (ADMIN via reports)

STOCK AUDIT (3 people):
  Creates audit       -> Sravan (ACCOUNTS_MANAGER)
  Counts stock        -> Nithin/Ranjitha (CLERKS)
  Approves variance   -> Syed/Srinu (ADMIN/SUPERVISOR)

EXPENSE CYCLE (2-3 people):
  Records expense     -> Sravan (ACCOUNTS_MANAGER)
  Delivery expenses   -> Ranjitha records, Srinu approves
  Reviews/audits      -> Syed (ADMIN via reports)

SECOND-HAND CYCLE (2-3 people):
  Receives & inspects -> Ranjitha (records cash paid)
  Sets selling price  -> Syed (ADMIN) or Srinu (SUPERVISOR)
  Sells via Zoho POS  -> POS operator (could be anyone on floor)
  Reviews profit      -> Syed (ADMIN -- monthly P&L report)
  = Intake != Pricing != Sale -- no one person controls full cycle
```

---

## Section 5: INVENTORY <-> ACCOUNTS LINKAGE

```
EVERY INVENTORY MOVEMENT HAS AN ACCOUNTING COUNTERPART
=======================================================

INWARD (stock up)     <-->   VENDOR BILL (payable up)
+-- Product.currentStock increases
+-- VendorBill.amount = cost of goods
+-- Both linked to same Zoho bill number
+-- CONTROL: Can't have stock without a bill

OUTWARD (stock down)  <-->   SALES INVOICE + DELIVERY EXPENSE
+-- Product.currentStock decreases
+-- Delivery tracks the sale (Zoho invoice link)
+-- Delivery expense auto-linked to invoice
+-- CONTROL: Can't mark delivered without recording expense
+-- CONTROL: Expense approved by different person (Srinu)

PO (ordered)          <-->   ITEM JOURNEY (trackable)
+-- PO created with items + amounts
+-- Tracking link entered when in transit
+-- Receipt links PO -> Inward -> Bill -> Payment
+-- CONTROL: Full chain: order -> track -> receive -> pay

PAYMENT               <-->   BILL STATUS CHANGE
+-- VendorPayment.amount recorded
+-- VendorBill.paidAmount increases
+-- Bill.status: PENDING -> PARTIAL -> PAID
+-- CONTROL: Payment can't exceed bill amount

STOCK AUDIT           <-->   ADJUSTMENT TRANSACTIONS
+-- Variance detected: system != physical
+-- Approved variance creates ADJUSTMENT transaction
+-- Product.currentStock corrected
+-- CONTROL: Adjustments are auditable, approved by ADMIN

SECOND-HAND BIKE      <-->   CASH OUT (purchase) + ZOHO SALE (revenue)
+-- Cash paid to seller = cost (recorded by Ranjitha)
+-- Zoho invoice = revenue (auto-pulled from POS)
+-- Profit = sale price - purchase price (per bike)
+-- CONTROL: Purchase price locked at intake (can't change later)
+-- CONTROL: Sale price comes from Zoho (can't manipulate)
+-- CONTROL: Monthly P&L shows Syed exact margins
```

---

## Section 6: MEASURABLE CONTROLS (KPIs)

### Daily Metrics (Dashboard)

| Metric | Target | Visible To |
|--------|--------|------------|
| Unverified inwards count | 0 by EOD | Syed, Srinu, Nithin |
| Pending deliveries count | 0 by EOD | Syed, Srinu, Ranjitha |
| Unapproved delivery expenses | 0 by EOD | Syed, Srinu |
| In-transit POs without tracking | 0 | Syed, Abhi |
| Today's expenses total | Tracked | Syed, Sravan |
| Today's inward qty / outward qty | Tracked | Syed |
| Low stock items count | Actioned | Abhi |

### Weekly Metrics

| Metric | Purpose |
|--------|---------|
| Stock audit completion rate | Are audits happening on schedule? |
| Average verification time (pull -> verify) | How fast is the team? |
| PO approval -> vendor send turnaround | How fast do POs go out? |
| Average transit time (sent -> received) | Vendor reliability |
| Delivery expense total vs delivery count | Avg cost per delivery |
| Vendor issue count | Quality problems |
| CD savings captured vs missed | Money saved/lost |

### Monthly Metrics

| Metric | Purpose |
|--------|---------|
| Total stock value (by brand, by bin, by type) | Inventory worth |
| Total purchases vs total sales (from Zoho) | Business volume |
| Total expenses by category (delivery separate) | Where money goes |
| Delivery expense as % of sales | Margin indicator |
| Overdue bill count and amount | Cash flow risk |
| Stock audit variance % | Should decrease over time |
| Vendor reliability score | On-time, tracking accuracy |
| PO lifecycle time (created -> received avg days) | Supply chain speed |
| Second-hand bike P&L | Profit per bike, margin %, avg days to sell |
| Unresolved vendor issues count | Pending problems |

---

## Section 7: WHAT HAPPENS IF SOMEONE DOESN'T DO THEIR JOB

| IF... | THEN... | VISIBLE HOW |
|-------|---------|-------------|
| Nithin doesn't verify inwards | Stock stays understated, items show yellow "UNVERIFIED" | Dashboard shows growing unverified count |
| Ranjitha doesn't verify outwards | Stock stays overstated | Dashboard shows pending deliveries growing |
| Ranjitha doesn't record delivery expense | She CANNOT mark "DELIVERED" (expense is mandatory) | Delivery stuck in OUT_FOR_DELIVERY, visible to Syed |
| Srinu doesn't approve delivery expenses | Expenses pile up in PENDING_APPROVAL | Dashboard shows unapproved count growing |
| Sravan doesn't record payments | Bills show as OVERDUE (red), CD deadlines pass | Srinu sees overdue count, everyone with accounts access sees red |
| Abhi doesn't create POs | Low stock alerts pile up, stockouts happen | Dashboard reorder tab shows growing alerts |
| Abhi doesn't enter tracking info | PO stays in SENT_TO_VENDOR (no transit info) | Dashboard: "POs sent but not tracked" |
| Stock audit is skipped | System stock drifts from physical | No one catches shrinkage or damage |
| Ranjitha doesn't record second-hand intake | Bike sits with no record, cash unaccounted | Stock audit of BCH-GF-02 catches it |
| Syed doesn't set selling price | Bike sits in RECEIVED status forever | Dashboard: "bikes awaiting pricing" count |

---

## Section 8: STRESS TEST — HUMAN LOOPHOLES & DEFENSES

### Loophole 1: "I verified it" (but didn't actually check)
**TRICK**: Nithin/Ranjitha bulk-taps "Verify" without checking
**DEFENSES**:
- Random spot-check audits: Srinu/Syed randomly picks 5 verified items and physically checks them
- Verification timestamp tracking: if 50 items verified in 2 minutes -> suspicious (humanly impossible)
- Photo proof on verification (future: require photo before verify works)
- Monthly variance report: if audits consistently show mismatches -> rubber-stamping detected

### Loophole 2: "I'll do it later" (procrastination)
**TRICK**: Leave unverified items sitting for days
**DEFENSES**:
- Aging badge: "Unverified for 2 days" (yellow -> red)
- Daily digest notification to Syed: "X items unverified for 48+ hours"
- Escalation: if unverified > 3 days -> auto-flag to admin
- SLA metric: avg verification time tracked per person

### Loophole 3: "Wrong bin" (lazy putaway)
**TRICK**: Nithin puts everything in one default bin
**DEFENSES**:
- Bin-level stock audit will catch this
- Stock page shows bin assignment -- other staff can report
- Bin capacity warnings: if one bin has 500 items and others have 10 -> suspicious
- Weekly bin distribution report

### Loophole 4: "I entered Rs.0 expense" (faking delivery expense)
**TRICK**: Ranjitha enters Rs.0 or Rs.1 to bypass mandatory field
**DEFENSES**:
- Minimum expense validation (min Rs.50 configurable)
- Srinu sees the amount during approval -- catches Rs.0/Rs.1
- Average delivery expense tracked -- outliers flagged
- Monthly report: deliveries with unusually low expenses

### Loophole 5: "I didn't get the tracking link"
**TRICK**: Abhi doesn't ask Syed for tracking, PO sits forever
**DEFENSES**:
- After 2 days of SENT_TO_VENDOR with no tracking -> alert to Syed
- Dashboard widget: "POs awaiting tracking" count
- Abhi's KPI: % of POs with tracking entered within 48hrs
- Can't mark PO as RECEIVED without tracking info first

### Loophole 6: "The count is right" (faking stock count numbers)
**TRICK**: Copies systemQty into countedQty without counting
**DEFENSES**:
- If countedQty = systemQty for ALL items -> suspicious flag (perfect count on 500+ items is statistically unlikely)
- System hides systemQty during counting (blind count) -- show only after submission
- Surprise re-count: Syed randomly picks 10 items from a "perfect" audit
- Time tracking: if 500 items counted in 30 mins -> flag

### Loophole 7: "I approved it without checking" (rubber-stamp)
**TRICK**: Srinu bulk-approves delivery expenses without checking
**DEFENSES**:
- Cannot bulk-approve -- must tap each one individually
- Approval screen shows: invoice amount vs expense amount ratio
- Monthly audit: Syed reviews Srinu's approval patterns
- Flag if average approval time < 10 seconds per item

### Loophole 8: "The expense was cash" (untraceable)
**TRICK**: Sravan records CASH expenses without receipts
**DEFENSES**:
- High-value CASH expenses (>Rs.1000) require reference or receipt photo
- Daily cash expense total tracked
- Monthly: CASH vs digital payment ratio report
- Syed reviews expense report -- cash-heavy days flagged

### Loophole 9: "I created the PO but forgot to share"
**TRICK**: Abhi creates PO, doesn't share, blames delay on vendor
**DEFENSES**:
- PO stays in DRAFT/APPROVED for too long -> alert
- Dashboard: "POs approved but not shared" count
- Auto-reminder to Abhi after 24hrs: "Share PO-00123 with admin"
- Syed sees all POs and their status timeline

### Loophole 10: "I didn't see the notification"
**TRICK**: Staff ignores app altogether for days
**DEFENSES**:
- Last login tracking: "Nithin last active 3 days ago" visible on team page
- Pending action count per person on admin dashboard
- If pending actions > threshold -> WhatsApp reminder (future)
- Weekly team activity report: who did what, who didn't

### Loophole 11: "The vendor was late"
**TRICK**: Abhi blames vendor for delay but never updated tracking or followed up
**DEFENSES**:
- PO timeline shows every status change with timestamp
- "Days since sent to vendor" visible on PO list
- If ETA passes with no receipt -> auto-escalate to Syed
- Vendor performance score tracks delivery reliability

### Loophole 12: "I verified the wrong quantity" (intentional miscount)
**TRICK**: Nithin verifies 10 received but only 8 arrived (theft or collusion)
**DEFENSES**:
- Zoho bill has exact quantities -- cross-match at audit
- Serial tracking for high-value items (bicycles)
- Variance in next stock audit will reveal mismatch
- Cross-check: bill qty vs verified qty vs PO qty
- If verified > PO qty -> auto-flag

### Loophole 13: "I recorded payment but didn't actually pay"
**TRICK**: Sravan records CASH payment but pockets the money
**DEFENSES**:
- Bill payment requires reference# for non-cash modes
- Bank statement reconciliation (future: AI import)
- Vendor will call about unpaid bill -> mismatch caught
- Srinu cross-checks: bill shows PAID but vendor says unpaid -> investigation
- Syed reviews payment report weekly -- big cash payments flagged

### Loophole 14: "System was slow / app crashed"
**TRICK**: Claims app didn't work to explain incomplete tasks
**DEFENSES**:
- App logs last activity per user with timestamp
- PWA works offline (service worker) -- no connectivity excuse
- Other staff on same network proves internet was fine
- Team page shows login activity

### Loophole 15: "I bought it for Rs.5000" (inflating second-hand price)
**TRICK**: Ranjitha records Rs.5,000 but paid seller Rs.3,000 (pockets Rs.2,000)
**DEFENSES**:
- Photo of bike at intake (condition evidence vs price claimed)
- Syed sees purchase price when setting selling price -- suspicious if high for bad condition
- Average purchase price per bike type tracked over time (sudden jump = flag)
- Seller phone number recorded -- Syed can verify price
- Monthly: purchase price distribution chart shows outliers

### Loophole 16: "The customer picked it up" (hiding second-hand bike)
**TRICK**: Records intake but bike "disappears" -- claims customer took it back
**DEFENSES**:
- Every intake has a photo (evidence it existed)
- Return/cancellation requires admin approval
- Stock audit of BCH-GF-02 will catch missing bikes
- Monthly count: received - sold - in_stock should = 0
- If refund: cash out must be recorded and approved

### Loophole 17: "I thought someone else would do it"
**TRICK**: Shared responsibility leads to no one taking ownership
**DEFENSES**:
- Every task has ONE assigned person (not a group)
- Verification records userId -- personal accountability
- Dashboard shows pending actions PER PERSON, not generic
- Weekly: "Nithin: 45 verified, 3 pending, 0 overdue" vs "Ranjitha: 30 verified, 12 pending, 5 overdue"

---

## Section 9: COMPLETE ITEM JOURNEY VIEW (In-App)

### For Any Item: Full Lifecycle View

```
ITEM: Shimano Tourney TY300 Derailleur (SKU: SH-TY300)
=======================================================

PURCHASE JOURNEY:
  PO-00456         Created by Abhi          Apr 10
  PO-00456         Approved by Syed         Apr 10
  PO-00456         Sent to Vendor           Apr 10
  PO-00456         In Transit (LR-789)      Apr 12
  PO-00456         Received                 Apr 15

INWARD:
  INW-2026-0234    Pulled from Zoho Bill    Apr 15
  INW-2026-0234    Verified by Nithin       Apr 15
  INW-2026-0234    Bin: BCH-1F-03           Apr 15
  Stock: 0 -> 20

STOCK AUDITS:
  SC-2026-012      Counted by Nithin        Apr 20
                   System: 20, Counted: 20
                   Variance: 0

OUTWARDS:
  OUT-2026-0567    Pulled from Zoho Invoice Apr 22
  OUT-2026-0567    Verified by Ranjitha     Apr 22
  Stock: 20 -> 18

CURRENT STATE:
  Stock: 18 units
  Bin: BCH-1F-03
  Last Movement: Apr 22
  Reorder Level: 5
  Status: HEALTHY (well above reorder)
```

### For Any Vendor: Full Relationship View

```
VENDOR: SpeedParts India (Code: SPEED1234)
==========================================

OPEN POs:
  PO-00456   In Transit   10 items   Rs.45,000   ETA: Apr 20

PENDING BILLS:
  BILL-2026-089   Rs.32,000   Due: Apr 30   CD: 2% if paid by Apr 25

PAYMENT HISTORY:
  Apr 5    Rs.28,000   NEFT   UTR: ABCD1234
  Mar 20   Rs.15,000   Cheque  #456789

RELIABILITY SCORE:
  On-time delivery: 85%
  Avg transit days: 5
  Quality issues: 1 (last 90 days)
  CD captured: 4 of 5 eligible bills
```

---

## Section 10: APP SCREEN MAP (What Each Person Sees)

### Syed (ADMIN) — Home Dashboard

```
+---------------------------------------------------+
|  BHARATH CYCLE HUB                    Syed Ibrahim |
+---------------------------------------------------+
|                                                     |
|  TODAY'S OVERVIEW                                   |
|  +--------+ +--------+ +--------+ +--------+       |
|  | Inward | | Outward| | Stock  | | Revenue|       |
|  |   12   | |    8   | | 5,234  | | 1.2L   |       |
|  +--------+ +--------+ +--------+ +--------+       |
|                                                     |
|  NEEDS ATTENTION                                    |
|  [!] 3 unverified inwards (2+ days old)            |
|  [!] 2 delivery expenses pending approval           |
|  [!] 1 PO sent but no tracking (3 days)            |
|  [!] 2 bills overdue                               |
|  [!] 1 second-hand bike awaiting pricing            |
|                                                     |
|  TEAM ACTIVITY                                      |
|  Nithin: 12 verified today | Last active: 2:30 PM  |
|  Ranjitha: 8 dispatched | Last active: 3:15 PM     |
|  Sravan: 22 expenses entered | Last active: 4:00 PM|
|  Abhi: 2 POs created | Last active: 11:00 AM       |
|                                                     |
|  [Home] [Inwards] [Outwards] [Stock] [More]        |
+---------------------------------------------------+
```

### Nithin (INWARDS_CLERK) — Verify Tab

```
+---------------------------------------------------+
|  VERIFY INWARDS                              Nithin|
+---------------------------------------------------+
|                                                     |
|  UNVERIFIED (3)                                    |
|  +-----------------------------------------------+ |
|  | Shimano TY300 Derailleur     x20              | |
|  | Vendor: SpeedParts | Bill: BILL-089            | |
|  | Pulled: Apr 15 | [2 days ago]                  | |
|  |                          [Confirm Receipt]     | |
|  +-----------------------------------------------+ |
|  | Hero Brake Cable Set        x50               | |
|  | Vendor: CycleParts | Bill: BILL-090            | |
|  | Pulled: Apr 16 | [1 day ago]                   | |
|  |                          [Confirm Receipt]     | |
|  +-----------------------------------------------+ |
|                                                     |
|  VERIFIED TODAY (12)                               |
|  Shimano CS-HG200 Cassette    x10    BCH-1F-03    |
|  Hero Pedal Set               x30    BCH-GF-01    |
|  ...                                               |
|                                                     |
|  [Home] [Verify] [Stock Count] [Stock] [More]      |
+---------------------------------------------------+
```

### Ranjitha (OUTWARDS_CLERK) — Deliveries Tab

```
+---------------------------------------------------+
|  DELIVERIES                                Ranjitha|
+---------------------------------------------------+
|                                                     |
|  PENDING DISPATCH (2)                              |
|  +-----------------------------------------------+ |
|  | INV-2026-1234  Rajesh Kumar                    | |
|  | Hero Sprint Pro 26" + Accessories              | |
|  | Total: Rs.18,500                                | |
|  | Sales: Mahesh                                   | |
|  |                          [Verify Dispatch]     | |
|  +-----------------------------------------------+ |
|                                                     |
|  OUT FOR DELIVERY (1)                              |
|  +-----------------------------------------------+ |
|  | INV-2026-1230  Priya Sharma                    | |
|  | BSA Lady Bird 24" Pink                         | |
|  | Total: Rs.12,000                                | |
|  |                    [Mark Delivered]             | |
|  |  (Will ask for delivery expense)               | |
|  +-----------------------------------------------+ |
|                                                     |
|  DELIVERED TODAY (5)                               |
|  INV-2026-1228  Rs.8,500  Del.Exp: Rs.150 [Approved]|
|  INV-2026-1225  Rs.22,000 Del.Exp: Rs.300 [Pending] |
|  ...                                               |
|                                                     |
|  [Home] [Deliveries] [Stock Count] [Stock] [More]  |
+---------------------------------------------------+
```

### Delivery Expense Prompt (When Ranjitha taps "Mark Delivered")

```
+---------------------------------------------------+
|  DELIVERY EXPENSE                                  |
|  INV-2026-1230 | Priya Sharma | Rs.12,000         |
+---------------------------------------------------+
|                                                     |
|  Delivery Expense Amount *                         |
|  [Rs. ________]                                    |
|                                                     |
|  Payment Mode *                                    |
|  ( ) Cash  ( ) UPI  ( ) Card  ( ) Other           |
|                                                     |
|  Reference (receipt/vehicle no)                    |
|  [________________________________________]        |
|                                                     |
|  Notes (optional)                                  |
|  [________________________________________]        |
|                                                     |
|  This expense will go to Srinu for approval.       |
|  Payment source: Brand Pay                         |
|                                                     |
|        [Cancel]            [Submit & Deliver]      |
+---------------------------------------------------+
```

### Srinu (SUPERVISOR) — Expense Approvals

```
+---------------------------------------------------+
|  EXPENSE APPROVALS                           Srinu |
+---------------------------------------------------+
|                                                     |
|  PENDING APPROVAL (3)                              |
|  +-----------------------------------------------+ |
|  | DELIVERY EXPENSE                               | |
|  | INV-2026-1230 | Priya Sharma                   | |
|  | Invoice: Rs.12,000 | Del.Exp: Rs.300           | |
|  | Mode: Cash | Ref: Vehicle TN-09-AB-1234        | |
|  | Recorded by: Ranjitha | Apr 16, 3:30 PM        | |
|  |                                                 | |
|  |   [Reject]                [Approve]            | |
|  +-----------------------------------------------+ |
|                                                     |
|  APPROVED TODAY (5)                                |
|  Rs.150 | INV-1228 | Cash    [Approved 2:00 PM]   |
|  Rs.200 | INV-1226 | UPI     [Approved 1:30 PM]   |
|  ...                                               |
+---------------------------------------------------+
```

---

## Section 11: DATA MODEL SUMMARY

### Core Tables & Relationships

```
Product
  +-- currentStock (updated ONLY by verified inward/outward/audit)
  +-- binId (updated by putaway)
  +-- zohoItemId (links to Zoho)
  +-- reorderLevel (set by Abhi)

InventoryTransaction
  +-- type: INWARD | OUTWARD | ADJUSTMENT
  +-- notes: [ZOHO][UNVERIFIED] or [ZOHO][VERIFIED]
  +-- userId (who verified)
  +-- timestamps (when pulled, when verified)

VendorBill
  +-- billNo (from Zoho)
  +-- amount, paidAmount, status
  +-- linked to vendor, linked to PO (future)

VendorPayment
  +-- billId, amount, mode, reference
  +-- recordedBy (Sravan)

Delivery
  +-- invoiceNo (from Zoho)
  +-- status: PENDING -> VERIFIED -> SCHEDULED ->
  +--         OUT_FOR_DELIVERY -> DELIVERED
  +-- salesPerson (from Zoho invoice)
  +-- deliveryExpenseId (linked expense)

Expense
  +-- category, amount, mode, reference
  +-- status: PENDING_APPROVAL -> APPROVED | REJECTED
  +-- deliveryId (if delivery expense)
  +-- approvedById (Srinu)
  +-- recordedById (Sravan or Ranjitha)

PurchaseOrder
  +-- status: DRAFT -> APPROVED -> SHARED_WITH_ADMIN ->
  +--         SENT_TO_VENDOR -> IN_TRANSIT ->
  +--         PARTIALLY_RECEIVED -> RECEIVED
  +-- trackingUrl, transporterName, expectedDate, lrNumber
  +-- createdBy (Abhi), approvedBy (Syed)

SecondHandBike (NEW)
  +-- status: RECEIVED -> LISTED -> SOLD
  +-- sellerName, sellerPhone, purchasePrice
  +-- source: WALK_IN | PICKED_UP_ON_DELIVERY
  +-- deliveryId (if picked up during delivery)
  +-- sellingPrice, soldPrice, soldAt
  +-- zohoInvoiceNo (when sold via POS)
  +-- photoUrl (proof of condition)
  +-- binId: BCH-GF-02 (always)

StockCount (audit)
  +-- assignedToId (Nithin or Ranjitha)
  +-- createdById (Sravan or Syed)
  +-- status: PENDING -> IN_PROGRESS -> COMPLETED -> APPROVED

ZohoPullPreview (staging)
  +-- entityType: item | contact | bill | invoice
  +-- status: PENDING -> APPROVED | REJECTED
  +-- reviewedById (Syed or Srinu)

ZohoPullLog (audit trail)
  +-- itemsNew, contactsNew, billsNew, invoicesNew
  +-- apiCallsUsed, errors
```

---

## Section 12: FUTURE ENHANCEMENTS (Phase 11+)

| Feature | Purpose | Priority |
|---------|---------|----------|
| Delivery expense approval flow | Ranjitha records, Srinu approves | HIGH (next) |
| PO tracking fields | trackingUrl, transporterName, expectedDate, lrNumber | HIGH (next) |
| PO status: SHARED_WITH_ADMIN, SENT_TO_VENDOR, IN_TRANSIT | Full PO lifecycle | HIGH (next) |
| SecondHandBike model + intake form | Ranjitha records, Syed prices | HIGH (next) |
| Second-hand P&L report | Monthly profit per bike | MEDIUM |
| Verification speed tracking | Flag suspiciously fast verifications | MEDIUM |
| Aging badges on unverified items | "2 days old" yellow -> red | MEDIUM |
| Team activity dashboard widget | Who did what, last active | MEDIUM |
| PO -> Inward linking | Auto-match PO with verified inward | MEDIUM |
| Blind stock count (hide systemQty) | Prevent copy-paste counting | HIGH |
| Vendor performance scoring | On-time %, quality issues | LOW |
| Bank statement reconciliation | Auto-match payments with bank | LOW |
| Photo proof on verification | Require photo before verify | LOW |
| WhatsApp auto-reminders | Notify staff of pending tasks | LOW |
| Bajaj EMI cross-check | EMI payment tracking | FUTURE |

---

## Summary: The Control Promise

> **Every rupee in = tracked. Every rupee out = tracked. Every item in = verified by a different person. Every item out = verified by a different person. Every delivery = expense recorded and approved. Every purchase = ordered, tracked, received, paid by 4 different people. Every exception = visible on the dashboard. Every loophole = has a defense.**

This is not just an inventory app. This is a **control system** where:
1. **Zoho is the source of truth** for billing
2. **The app is the verification layer** that ensures physical reality matches digital records
3. **Every step requires a different person** so no one can manipulate alone
4. **Everything is measurable** so Syed can see exactly what's happening
5. **The system catches laziness** through aging badges, pending counts, and audit variances
6. **The system catches dishonesty** through separation of duties, photo proof, and cross-checks

---

*Document created: 16 April 2026 | Bharath Cycle Hub | bike-inventory v0.9*
