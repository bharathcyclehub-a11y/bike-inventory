# 2XG Service App — Complete Project Blueprint (BCH Reference)

> **Purpose:** Hardcoded reference document to recreate the entire 2XG Service application from scratch. Based on the Bharath Cycle Hub (BCH) instance.

---

## 1. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.2.0 |
| Language | TypeScript | 5.9.3 |
| Bundler | Vite | 7.3.1 |
| Styling | Tailwind CSS | 4.1.18 |
| Routing | React Router DOM | 7.13.0 |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) | — |
| Validation | Zod | 4.3.6 |
| Icons | Lucide React | 0.564.0 |
| QR Codes | QR Code React | 4.2.0 |
| PDF Export | html2canvas 1.4.1 + jsPDF 4.2.1 | — |
| Error Tracking | Sentry React | 10.47.0 |
| Testing | Vitest 4.1.2 + Testing Library React 16.3.2 | — |
| Linting | ESLint | 9.39.1 |
| PWA | Vite Plugin PWA | 1.2.0 |

---

## 2. Database Schema (76 Migrations)

### 2.1 organizations

| Column | Type | Default/Notes |
|--------|------|---------------|
| id | UUID | PK |
| name | TEXT | NOT NULL |
| slug | TEXT | UNIQUE, NOT NULL |
| short_code | TEXT | — |
| logo_url | TEXT | — |
| phone | TEXT | — |
| address | TEXT | — |
| country_code | TEXT | `+91` |
| currency | TEXT | `INR` |
| timezone | TEXT | `Asia/Kolkata` |
| working_hours | JSONB | e.g. `{"open":"09:00","close":"20:00"}` |
| time_block_cutoff | INT | `13` (hour; morning < 13, afternoon >= 13) |
| incentive_rules | JSONB | `{daily_target, daily_bonus, milestone_target, milestone_bonus}` |
| whatsapp_enabled | BOOL | `false` |
| whatsapp_footer | TEXT | — |
| google_sheets_enabled | BOOL | `false` |
| google_sheets_url | TEXT | — |
| plan_type | TEXT | `free` — CHECK (free/pro/enterprise) |
| plan_expires_at | TIMESTAMPTZ | — |
| max_mechanics | INT | `2` |
| max_jobs_per_month | INT | `20` |
| storage_limit_mb | INT | `100` |
| gst_number | TEXT | — |
| gst_rate | NUMERIC | — |
| billing_footer | TEXT | — |
| receipt_prefix | TEXT | `INV` |
| upi_id | TEXT | — |
| staff_assign_mode | TEXT | — |
| checkin_strict_mode | BOOL | — |
| maintenance_mode | BOOL | `false` |
| created_at | TIMESTAMPTZ | `now()` |
| updated_at | TIMESTAMPTZ | `now()` |

### 2.2 users

| Column | Type | Default/Notes |
|--------|------|---------------|
| id | UUID | PK |
| org_id | UUID | FK → organizations |
| name | TEXT | NOT NULL |
| phone | TEXT | UNIQUE |
| email | TEXT | UNIQUE |
| role | TEXT | CHECK (owner/admin/staff/mechanic) |
| mechanic_level | TEXT | CHECK (senior/junior) |
| pin_hash | TEXT | pgcrypto bcrypt |
| avatar | TEXT | — |
| color | TEXT | Hex color for UI |
| status | TEXT | CHECK (on_duty/off_duty/on_leave) |
| is_active | BOOL | `true` |
| auth_user_id | UUID | FK → auth.users (nullable) |
| created_at | TIMESTAMPTZ | `now()` |
| updated_at | TIMESTAMPTZ | `now()` |

### 2.3 jobs

| Column | Type | Default/Notes |
|--------|------|---------------|
| id | UUID | PK |
| org_id | UUID | FK → organizations |
| service_id | INT | Auto-increment per org (atomic sequence) |
| customer_name | TEXT | NOT NULL |
| customer_phone | TEXT | — |
| bike | TEXT | — |
| bikeId | UUID | FK → bikes (nullable) |
| service_type | TEXT | CHECK (regular/repair/makeover/insurance/free) |
| issue | TEXT | — |
| priority | TEXT | CHECK (standard/urgent) |
| status | TEXT | CHECK (received/assigned/in_progress/parts_pending/quality_check/ready/completed/delivered) |
| mechanic_id | UUID | FK → users (nullable) |
| estimated_min | INT | — |
| actual_min | INT | — |
| date | DATE | NOT NULL |
| time_block | TEXT | CHECK (morning/afternoon) |
| services | JSONB | Array of selected service names |
| checkin_parts | JSONB | Array of parts checked in with bike |
| parts_used | JSONB | Parts consumed during service |
| parts_needed | JSONB | Parts requested but unavailable |
| labor_charge | NUMERIC | `0` |
| total_cost | NUMERIC | `0` |
| payment_method | TEXT | CHECK (cash/upi/card/credit) |
| qc_status | TEXT | CHECK (passed/failed) |
| photo_before | TEXT | Storage URL |
| photo_after | TEXT | Storage URL |
| credit_settled | BOOL | `false` |
| credit_settled_at | TIMESTAMPTZ | — |
| credit_settled_method | TEXT | — |
| created_at | TIMESTAMPTZ | `now()` |
| updated_at | TIMESTAMPTZ | `now()` |
| started_at | TIMESTAMPTZ | — |
| completed_at | TIMESTAMPTZ | — |
| paused_at | TIMESTAMPTZ | — |
| paid_at | TIMESTAMPTZ | — |
| delivered_at | TIMESTAMPTZ | — |

### 2.4 customers

| Column | Type | Default/Notes |
|--------|------|---------------|
| id | UUID | PK |
| org_id | UUID | FK → organizations |
| name | TEXT | NOT NULL |
| phone | TEXT | UNIQUE per org (composite unique) |
| visits | INT | `0` |
| last_visit_date | DATE | — |
| created_at | TIMESTAMPTZ | `now()` |

### 2.5 bikes

| Column | Type | Default/Notes |
|--------|------|---------------|
| id | UUID | PK |
| org_id | UUID | FK → organizations |
| customer_id | UUID | FK → customers |
| bike_model | TEXT | — |
| registration_number | TEXT | — |
| notes | TEXT | — |
| created_at | TIMESTAMPTZ | `now()` |
| updated_at | TIMESTAMPTZ | `now()` |

### 2.6 parts

| Column | Type | Default/Notes |
|--------|------|---------------|
| id | UUID | PK |
| org_id | UUID | FK → organizations |
| name | TEXT | NOT NULL |
| stock | INT | `0` |
| price | NUMERIC | `0` |
| reorder_at | INT | Threshold for low-stock alert |
| category | TEXT | — |
| created_at | TIMESTAMPTZ | `now()` |
| updated_at | TIMESTAMPTZ | `now()` |

### 2.7 service_options (Enterprise multi-select)

| Column | Type | Default/Notes |
|--------|------|---------------|
| id | UUID | PK |
| org_id | UUID | FK → organizations |
| name | TEXT | NOT NULL |
| price | NUMERIC | `0` |
| category | TEXT | — |
| created_at | TIMESTAMPTZ | `now()` |
| updated_at | TIMESTAMPTZ | `now()` |

### 2.8 reviews

| Column | Type | Default/Notes |
|--------|------|---------------|
| id | UUID | PK |
| org_id | UUID | FK → organizations |
| job_id | UUID | FK → jobs |
| customer_name | TEXT | — |
| bike | TEXT | — |
| service_type | TEXT | — |
| rating | INT | 1–5 (service rating) |
| shop_rating | INT | 1–5 (overall shop rating) |
| comment | TEXT | — |
| created_at | TIMESTAMPTZ | `now()` |

### 2.9 activity_logs

| Column | Type | Default/Notes |
|--------|------|---------------|
| id | UUID | PK |
| org_id | UUID | FK → organizations |
| job_id | UUID | FK → jobs (nullable) |
| user_id | UUID | FK → users |
| action | TEXT | NOT NULL |
| details | JSONB | — |
| created_at | TIMESTAMPTZ | `now()` |

### 2.10 platform_notifications (Super Admin → All Orgs)

| Column | Type | Default/Notes |
|--------|------|---------------|
| id | UUID | PK |
| title | TEXT | NOT NULL |
| message | TEXT | — |
| type | TEXT | — |
| target | TEXT | CHECK (all/free/pro/enterprise) |
| is_active | BOOL | `true` |
| expires_at | TIMESTAMPTZ | — |
| created_at | TIMESTAMPTZ | `now()` |

---

## 3. RPC Functions (SECURITY DEFINER)

All RPCs run with elevated privileges (bypass RLS) and enforce org-scoping server-side.

| RPC | Parameters | Purpose |
|-----|-----------|---------|
| `verify_pin` | phone, pin | PIN-based mechanic/staff auth |
| `hash_pin` | pin | Hash via pgcrypto |
| `app_create_job` | all job fields | Create job with atomic service_id |
| `app_update_job` | p_job_id, p_updates (JSONB) | Atomic job state transitions |
| `app_get_jobs` | p_caller_id, p_date, p_done_window_days | Queue view with configurable history |
| `app_get_jobs_done_window` | p_caller_id, p_date, p_done_window_days | Done jobs filter |
| `app_get_mechanic_jobs_range` | p_mechanic_id, from_date, to_date | Mechanic performance range |
| `app_get_team_members` | p_caller_id | Team list (org-scoped) |
| `app_get_mechanics` | — | Active mechanics grid (login screen) |
| `app_get_customers` | p_caller_id | All customers (org-scoped) |
| `app_upsert_customer` | p_caller_id, p_name, p_phone, p_visits | Upsert on org_id + phone |
| `app_search_customers` | p_caller_id, p_phone | Phone search |
| `app_get_parts` | p_caller_id | Parts list (org-scoped) |
| `app_create_user` | p_caller_id, ... | Add team member |
| `app_update_user_status` | p_caller_id, p_user_id, p_status | Status toggle |
| `get_org_jobs_this_month` | p_org_id | Plan limit enforcement |
| `get_active_staff` | p_org_id | Online heartbeat tracking |
| `app_search_bikes` | p_caller_id, p_query | Bike search |
| `get_user_role` | p_user_id | Fast role lookup |
| `public_track_job` | p_service_id | Public tracking (no auth) |
| `update_part_stock` | p_part_id, p_delta | Atomic stock increment |

---

## 4. RLS Policies

- **organizations**: Public read by slug (pre-auth); admin/owner can update own org
- **users/jobs/parts/customers/bikes/service_options/reviews/activity_logs**: All scoped by `org_id` matching the caller's org
- **Mechanic exception**: Mechanics can see their own assigned jobs
- **Mechanic takeover**: Seniors can reassign from juniors
- **Service worker**: Can view all active jobs in queue

---

## 5. Authentication & Authorization

### Auth Flows

| Method | Used By | Mechanism |
|--------|---------|-----------|
| PIN Login | Mechanics, Staff | Tap avatar → phone → 4-digit PIN → `verify_pin()` RPC |
| Email Login | Admins, Owners | Supabase Auth (email + password) |
| Super Admin | Platform admin | Separate auth context with impersonation |
| Public | Anyone | No auth — tracking, receipts, reviews |

### Roles & Permissions

| Role | Access |
|------|--------|
| `owner` | Full access + org settings + invite staff/mechanics |
| `admin` | Dashboard, reports, team management (no org settings) |
| `staff` | Check-in, queue, pickup, parts, customer management |
| `mechanic` | My jobs, active job workflow, personal stats (PIN only) |
| `super_admin` | Platform-level: orgs, analytics, notifications, health |

### Session Storage

- Per-org key: `session_{slug}` (e.g., `session_bharath-cycle-hub`)
- Legacy fallback: `bch_session`
- Contains: user ID, name, role, avatar, color, org_id, expiry
- TTL: 7 days
- Inactivity timeout: 30 minutes (triggers LockScreen)

---

## 6. Routing

### Public Routes (No Auth)

| Route | Page |
|-------|------|
| `/` | Landing page |
| `/privacy` | Privacy policy |
| `/:slug/track/:serviceId` | Customer job tracking |
| `/:slug/receipt/:serviceId` | Receipt/bill view |
| `/:slug/history` | Customer service history |
| `/review` or `/review/:jobId` | Review submission |

### Super Admin Routes

| Route | Page |
|-------|------|
| `/superadmin/login` | Login |
| `/superadmin/dashboard` | Overview |
| `/superadmin/orgs` | Org list + CRUD |
| `/superadmin/orgs/:orgId` | Org detail, plan editing |
| `/superadmin/revenue` | Revenue analytics |
| `/superadmin/analytics` | Platform analytics |
| `/superadmin/onboarding` | New org setup |
| `/superadmin/activity` | Audit log |
| `/superadmin/notifications` | Push notification config |
| `/superadmin/health` | System health |
| `/superadmin/config` | Platform config |

### Org-Scoped Routes (`/:slug/*`)

**Staff:**

| Route | Page |
|-------|------|
| `/staff/checkin` | Bike intake form |
| `/staff/queue` | Live job queue |
| `/staff/pickup` | Payment + delivery |
| `/staff/credit` | Credit settlement |
| `/staff/parts` | Parts inventory |
| `/staff/customers` | Customer management |

**Admin:**

| Route | Page |
|-------|------|
| `/admin/dashboard` | Stats, revenue, slow jobs |
| `/admin/assign` | Manual job assignment |
| `/admin/team` | Staff/mechanic roster |
| `/admin/customers` | Advanced customer search |
| `/admin/customer/:customerId` | Customer profile + history |
| `/admin/services` | Service options editor |
| `/admin/reviews` | Reviews analytics |
| `/admin/audit` | Activity logs |
| `/admin/settings` | Org config (WhatsApp, GST, receipts, hours) |

**Mechanic:**

| Route | Page |
|-------|------|
| `/mechanic/today` | Today's jobs (assigned + pickable) |
| `/mechanic/active` | Active job workflow |
| `/mechanic/stats` | Performance stats |

---

## 7. Job Status Machine

```
received → assigned → in_progress → parts_pending (optional loop)
                                   → quality_check → ready → completed → delivered
```

- `in_progress` → `parts_pending`: Mechanic needs parts
- `parts_pending` → `in_progress`: Parts received, resume
- `in_progress` can also pause/resume (paused_at tracking)
- `quality_check`: QC pass → `ready`, QC fail → `in_progress`
- `completed` → `delivered`: After payment processing

---

## 8. Features

### Job Management
- Full status machine (8 states)
- Auto-assign junior mechanics based on workload
- Mechanic takeover (senior reassigns from junior)
- Job pause/resume (parts wait scenario)
- Estimated vs actual time tracking
- Conflict resolution via version field
- Atomic service_id per org (human-readable job number)

### Service & Parts
- Multi-select service options at check-in (customizable per org)
- Parts catalog with stock tracking
- Auto-reorder alerts (stock < reorder_at)
- Parts needed vs parts used tracking
- Service categories (labor, consumables)

### Customer Management
- Phone-based lookup (upsert on org_id + phone)
- Bike registry per customer
- Visit history tracking
- Customer profile page with full job history

### Payments & Billing
- Methods: cash, UPI (QR + VPA), card (Razorpay), credit (on-account)
- Credit settlement tracking (credit_settled, settled_at, settled_method)
- Labor + parts = total bill
- Receipt generation (HTML → PDF via html2canvas + jsPDF)
- Digital receipt links: `/{slug}/receipt/{serviceId}`
- GST calculation per org
- Billing footer customization
- UPI QR modal with VPA display

### Reviews
- Service rating (1–5) per job
- Shop overall rating (1–5)
- Comment text
- Public review page with org filtering

### WhatsApp Integration
- `wa.me` links with template messages
- Stage-based templates: received, in_progress, quality_check, ready, paid
- Dynamic bill summary with parts breakdown
- Receipt URL embedding
- Shop footer with phone + name

### Google Sheets Sync (Enterprise)
- Syncs job data to Apps Script webhook
- Payload flattening: job + mechanic name
- GET request with `?data=` query param

### Reporting & Analytics
- Dashboard: job stats (total, in progress, parts pending, QC, ready)
- Revenue: today/week/month breakdown
- Mechanic performance: daily target (default 10), daily bonus (100), milestone (300 jobs → 3000)
- Delivered jobs report (history window by plan: Free=7d, Pro=30d, Enterprise=90d)
- Slow job detection (jobs > 2x estimated time)
- Customer LTV
- Incomplete carryover (previous day's unfinished)

### Offline Support
- IndexedDB offline database
- Queue system for failed mutations
- Exponential backoff replay on reconnection
- PWA service worker: CacheFirst (storage), NetworkFirst (REST), NetworkOnly (auth/RPC)

---

## 9. Services / API Layer

| Service File | Key Methods |
|-------------|-------------|
| **jobService** | getJobsForDate, getJobsForMechanic, getJobsForMechanicRange, createJob, updateJob, assignJob, startJob, completeJob, qcPassJob, qcFailJob, markPartsNeeded, markPartsReceived, pauseJob, resumeJob, markDelivered, processPayment |
| **userService** | getAppUsers, getAppUserById, createUser, updateAppUserStatus, updateUserPin |
| **customerService** | searchByPhone, getAll, upsert, incrementVisit |
| **bikeService** | searchByCustomer, createBike, getBikesForCustomer |
| **partsService** | getAll, updateStock |
| **serviceOptionsService** | getAll, create, update, delete |
| **reviewService** | submitReview, getAllReviews, getShopRating |
| **photoService** | uploadPhoto, deletePhoto |
| **activityLogService** | logAction, getLogsForJob, getOrgActivityLog |
| **googleSheetsService** | isEnabled, syncJob, buildSheetPayload |
| **otpService** | requestOtp, verifyOtp |
| **reportService** | getDashboardStats, getRevenueSummary, getLowStockParts, getDeliveredJobs, getMechanicStats |
| **performanceService** | getSlowJobs, getIncompleteCarryover, getLateDeliveries |
| **superAdminService** | listOrgs, getOrgDetail, updateOrgPlan, createOrganization, deleteOrganization, getRevenueReport, sendNotification |

**Pattern:** All services use `getCallerId()` from authStore for RPC calls. RPC-first, then direct Supabase query fallback.

---

## 10. State Management

### AuthStore (`lib/authStore.ts`) — Module-level

- `_callerId` — Current user ID
- `_orgId` — Current org ID
- `_org` — Current org data (Organization object)
- Used by all services for RPC calls + org-scoped queries

### AuthContext (`context/AuthContext.tsx`)

- `appUser`: {id, name, role, email, phone, avatar, color, mechanicLevel, orgId}
- `org`: Organization object
- `isAuthenticated`, `isLoading`, `isLocked`, `role`, `currentMechanicId`
- Methods: `loginWithEmail`, `loginWithPin`, `switchMechanic`, `logout`, `unlock`, `unlockAdmin`

### AppContext (`context/AppContext.tsx`)

- `jobs`: Job[] (realtime + polling)
- `mechanics`: Mechanic[] (realtime updates)
- `parts`: Part[], `serviceList`: string[], `serviceItems`: ServiceOptionItem[]
- Methods: createJob, editJob, pickJob, startJob, completeJob, qcPassJob, markPartsNeeded, pauseJob, resumeJob, reassignJob, processPayment, markDelivered, getDashboardStats, refreshData

### NotificationStore (`lib/notificationStore.ts`) — localStorage

- notifications array (max 50), subscribe pattern, badge count

### Realtime Subscriptions

- `useRealtimeJobs.ts` — Listen on jobs table (INSERT/UPDATE/DELETE)
- `useRealtimeUsers.ts` — Listen on users table (INSERT/UPDATE/DELETE)
- Throttled: eventsPerSecond = 1

---

## 11. Multi-Tenancy

### URL Pattern
```
https://service.2xg.in/{slug}/*
```
Example: `bharath-cycle-hub`, `another-shop`

### Org Resolution Flow
1. `OrgResolver` component extracts slug from URL
2. Fetches org from DB by slug
3. Sets `AuthContext.org`
4. All downstream services use `_orgId` from authStore

### Data Isolation
- `org_id` FK on all tables: users, jobs, customers, bikes, parts, service_options, reviews, activity_logs
- RLS enforces org_id matching — no cross-tenant leaks
- Sessions stored per-org slug (multiple orgs can be logged in simultaneously)

### Maintenance Mode
- Per-org `maintenance_mode` boolean
- `MaintenanceGate` component blocks all routes when enabled

---

## 12. Plan Tiers

| Feature | Free | Pro (499/mo) | Enterprise (Custom) |
|---------|------|-------------|-------------------|
| max_mechanics | 2 | 5 | Unlimited |
| max_jobs_per_month | 20 | 200 | Unlimited |
| storage_limit_mb | 100 | 1,000 | 10,000 |
| History window (Queue) | 7 days | 30 days | 90 days |
| WhatsApp messaging | wa.me only | Full templates | Full templates |
| Google Sheets sync | No | No | Yes |
| CSV export | No | Yes | Yes |
| PDF receipts | Basic | Full | Full |
| Custom branding | No | No | Yes |
| Tally export | No | No | Yes |

**Plan Expiry:** `plan_expires_at` — expired pro/enterprise reverts to Free limits. Checked on dashboard load.

**Feature Gates:** `PlanGates` component checks `org.planType`.

---

## 13. Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_USE_SUPABASE` | Yes | `'true'` to enable Supabase |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key (public) |
| `VITE_APP_NAME` | No | PWA app name |
| `VITE_APP_SHORT_NAME` | No | PWA short name |
| `VITE_GOOGLE_SHEETS_URL` | No | Default Sheets endpoint (legacy) |
| `VITE_SENTRY_DSN` | No | Sentry error tracking |
| `VITE_RAZORPAY_KEY_ID` | No | Razorpay API key |

---

## 14. Build & Deploy

### Vite Config
- PWA manifest: theme `#2563eb`, background `#f9fafb`, display `standalone`
- Code splitting chunks: `vendor-react`, `vendor-supabase`, `vendor-icons`
- Workbox caching: Google Fonts (1yr), Storage (30d), REST API (24h), Auth/RPC (NetworkOnly)
- Dev proxy: `/rest`, `/auth`, `/storage`, `/realtime` → `https://service.2xg.in`
- Sourcemaps: disabled in production

### Deployment Targets
- **Coolify** (primary)
- **Vercel** (vercel.json present)
- **Docker** (Dockerfile present)
- **Nginx** (nginx.conf for reverse proxy)

### PWA
- Package name: `in.2xg.service`
- Icons: icon-192, icon-512, maskable variants
- TWA for Play Store via Bubblewrap
- Offline: navigateFallback → index.html

### Storage Bucket
- `job-photos` (public): `photos/{org_id}/{job_id}/{filename}`
- Auto-cleanup: 6-month old photos (cron migration)

---

## 15. UI Components

### Core (`src/components/ui/`)

| Component | Purpose |
|-----------|---------|
| `Button.tsx` | Primary, secondary, loading states |
| `Card.tsx` | Container for job/customer cards |
| `Modal.tsx` | Dialog overlay |
| `Badge.tsx` | Service type, status badges |
| `SearchBar.tsx` | Job/customer search |
| `SortToggle.tsx` | ASC/DESC sorting |
| `Toast.tsx` | In-app notifications |
| `Skeleton.tsx` | Loading placeholders (PageSkeleton, SkeletonCard) |
| `EmptyState.tsx` | No results UI |
| `FloatingField.tsx` | Floating label input |

### Specialized

| Component | Purpose |
|-----------|---------|
| `PhotoCapture.tsx` | Single photo (before/after) |
| `MultiPhotoCapture.tsx` | Gallery of photos |
| `PhotoGallery.tsx` | View and navigate photos |
| `QRCodeModal.tsx` | QR code display (job tracking link) |
| `UpiQrModal.tsx` | UPI QR code + VPA for payment |
| `VoiceInput.tsx` | Voice dictation |
| `WhatsAppButton.tsx` | WhatsApp message CTA |
| `PlanGates.tsx` | Feature availability checks |
| `Walkthrough.tsx` | Onboarding tooltips |
| `JobCard.tsx` | Job summary card |

### Auth (`src/components/auth/`)

| Component | Purpose |
|-----------|---------|
| `LockScreen.tsx` | Re-lock after 30min inactivity |
| `ProtectedRoute.tsx` | Route-level auth guard (allowedRoles) |
| `RoleRedirect.tsx` | Redirect to role-appropriate landing |
| `OrgResolver.tsx` | Extract slug → resolve org → set context |

---

## 16. Utility Libraries

### `lib/helpers.ts`
- `formatTime(min)` → `"2h 30m"`
- `formatCurrency(n)` → `"₹12,500"`
- `formatTimer(ms)` → `"02:30:45"`
- `getToday()` → `"2026-04-16"` (ISO)
- `getTimeBlock()` → `"morning"` | `"afternoon"` (cutoff = hour 13)
- `isWeekend()` → boolean

### `lib/mappers.ts`
- `mapJobFromDb(row)` → Job (snake_case → camelCase)
- `mapJobToDb(job)` → DB row (camelCase → snake_case)
- `mapUserFromDb(row)` → AppUser
- `mapOrgFromDb(row)` → Organization
- `mapPartFromDb(row)` → Part

### `lib/validation.ts` (Zod)
- `createJobSchema`, `paymentSchema`, `pinLoginSchema`, `bikeCreateSchema`, `customerCreateSchema`
- `validate<T>(schema, data)` — throws on error

### `lib/constants.ts`
- `STATUS` — All job statuses
- `SERVICE_TYPES` — regular, repair, makeover, insurance, free
- `ROLES` — owner, admin, staff, mechanic
- `ROLE_DEFAULTS` — Default redirect per role

### `lib/whatsapp.ts`
- Stage-based template messages (received, in_progress, quality_check, ready, paid)
- Dynamic bill summary builder
- Receipt URL embedding

### `lib/offlineQueue.ts`
- IndexedDB-backed mutation queue
- Actions: createJob, editJob, pickJob, startJob, etc.
- Exponential backoff replay on reconnection

### `lib/offlineDb.ts`
- IndexedDB schema: jobs, mechanics, parts, customers
- Syncs on app load; fallback when offline

---

## 17. Project Structure

```
src/
├── components/
│   ├── auth/         LockScreen, ProtectedRoute, RoleRedirect, OrgResolver
│   ├── mechanic/     SwitchMechanicFAB, SwitchMechanicSheet
│   ├── superadmin/   ImpersonationBanner, SuperAdminAuthGate, SuperAdminLayout
│   └── ui/           Button, Card, Modal, SearchBar, PhotoCapture, QRCode, etc.
├── context/
│   ├── AppContext.tsx          Jobs/mechanics/parts state + mutations
│   ├── AuthContext.tsx         User + org + auth session
│   └── SuperAdminAuthContext   Super admin session
├── hooks/
│   ├── useActivityLog.ts
│   ├── useInflightGuard.ts
│   ├── useOfflineStatus.ts
│   ├── useOrgSlug.ts
│   ├── usePlanLimits.ts
│   ├── useRealtimeJobs.ts
│   └── useRealtimeUsers.ts
├── layouts/
│   └── AppLayout.tsx           Header, TabBar, Outlet
├── lib/
│   ├── authStore.ts
│   ├── config.ts
│   ├── constants.ts
│   ├── haptic.ts
│   ├── helpers.ts
│   ├── imageUtils.ts
│   ├── mappers.ts
│   ├── mediaSyncQueue.ts
│   ├── mockData.ts
│   ├── notifications.ts
│   ├── notificationStore.ts
│   ├── offlineDb.ts
│   ├── offlineQueue.ts
│   ├── serviceOptions.ts
│   ├── supabase.ts             Singleton client
│   ├── superAdminStore.ts
│   ├── validation.ts
│   └── whatsapp.ts
├── pages/
│   ├── admin/       Dashboard, Assign, Team, Customers, CustomerProfile,
│   │                AuditLog, ServiceOptions, Reviews, Settings
│   ├── auth/        LoginScreen, PinPad
│   ├── mechanic/    Today, ActiveJob, MyStats
│   ├── staff/       CheckIn, Queue, Pickup, CreditOutstanding, Parts
│   ├── public/      TrackJob, Receipt, CustomerHistory, ReviewPage
│   ├── superadmin/  13 pages for platform admin
│   ├── Landing.tsx
│   └── Privacy.tsx
├── routes/
│   └── SuperAdminShell.tsx
├── services/
│   ├── jobService.ts
│   ├── userService.ts
│   ├── customerService.ts
│   ├── bikeService.ts
│   ├── partsService.ts
│   ├── serviceOptionsService.ts
│   ├── reviewService.ts
│   ├── photoService.ts
│   ├── activityLogService.ts
│   ├── googleSheetsService.ts
│   ├── otpService.ts
│   ├── reportService.ts
│   ├── performanceService.ts
│   └── superAdminService.ts
├── types/
│   └── index.ts                Organization, Job, User, Customer, Review, etc.
├── App.tsx                     Main route shell + lazy imports
└── main.tsx                    Sentry init, createRoot, StrictMode
```

---

## 18. Caching & Performance

### Service Worker Caching (Workbox)

| Strategy | Target | TTL |
|----------|--------|-----|
| CacheFirst | Google Fonts | 1 year |
| CacheFirst | Supabase Storage | 30 days |
| NetworkFirst | REST API | 24h, 15s timeout |
| NetworkOnly | Auth routes, RPC endpoints | — |

### Code Splitting
- Vendor chunks: react, supabase, lucide-react
- Lazy routes: Each page loaded on demand (Suspense + PageSkeleton)
- Super admin: Separate chunk

### Database Indexes
- `users.phone`, `users.role`
- `jobs.date`, `jobs.status`, `jobs.mechanic_id`
- `customers.org_id + phone` (composite unique)

### Realtime
- Supabase Realtime: eventsPerSecond = 1 (throttled)
- Subscribe only to current org's tables

---

## 19. Integrations Summary

| Integration | Type | Plan Required |
|------------|------|---------------|
| Supabase Auth | Core auth | All |
| Supabase Storage | Photo uploads | All |
| Supabase Realtime | Live updates | All |
| WhatsApp (wa.me) | Customer messaging | All (basic) |
| WhatsApp Templates | Stage notifications | Pro+ |
| Google Sheets | Job sync to spreadsheet | Enterprise |
| Razorpay | Card payments | All (if configured) |
| Sentry | Error tracking | All |
| MSG91 | OTP verification | All |
| PWA / TWA | Play Store app | All |

---

## 20. Currency & Locale

- Currency: INR (₹)
- Country code: +91
- Timezone: Asia/Kolkata
- Date format: ISO (YYYY-MM-DD) internally, localized display
- Time block cutoff: Hour 13 (morning < 1PM, afternoon >= 1PM)

---

## 21. Incentive System

| Metric | Default Value |
|--------|--------------|
| Daily target | 10 jobs |
| Daily bonus | ₹100 |
| Milestone target | 300 jobs |
| Milestone bonus | ₹3,000 |

Configurable per org via `incentive_rules` JSONB in organizations table.

---

*Generated from the live BCH codebase on 2026-04-16.*
