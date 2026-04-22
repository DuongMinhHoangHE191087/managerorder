# 🎯 Premium Accounts System - OPTIMIZED Schema v2

**Status:** ✅ **Updated for Production**  
**Created:** March 5, 2026  
**Optimizations:** 1000+ packages, flexible slots, manual renewal, refunds

---

## 📊 UPDATED Database Design (Bạn Yêu Cầu)

### **Thay Đổi Từ Original Schema:**

```
✅ Support 1000+ packages/accounts
✅ Flexible slots (configurable max per account)
✅ Multiple billing cycles (1m, 3m, 6m, 1y)
✅ Manual renewal (ask customer, then kick/migrate)
✅ Optional connection check (Duolingo only)
✅ Email tracking for warranty
✅ Password change tracking
✅ Refund calculations
✅ Manual account migration
✅ Better indexing for scale
```

---

## 🗂️ 10 Updated Tables (8 + 2 chủ đề)

### **1️⃣ PREMIUM_SERVICE_TYPES** (Updated)
**Lưu loại dịch vụ + configuration**

```prisma
model PREMIUM_SERVICE_TYPES {
  id                    String   @id @default(cuid())
  accountId            String
  name                 String   // ChatGPT, Duolingo, Netflix, YouTube, ...
  slug                 String   // chatgpt, duolingo, netflix, youtube
  description          String?
  logoUrl              String?
  website              String?
  category             String   // ai, learning, streaming, ...
  
  // NEW: Connection check configuration
  supportsConnectionCheck  Boolean @default(false)  // ← Duolingo only!
  connectionCheckType     String?  // "api", "manual", "scheduled"
  connectionCheckApiUrl   String?  // API endpoint if auto-check available
  
  // Limitations
  maxPackagesAllowed   Int @default(100)  // Tối đa bao nhiêu gói bán cho dịch vụ này?
  
  isActive             Boolean @default(true)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  
  // Relations
  account              Account @relation(fields: [accountId], references: [id])
  packages             PREMIUM_PACKAGES[]
  accounts             PREMIUM_ACCOUNTS[]
  
  @@unique([accountId, slug])
  @@index([accountId])
  @@index([isActive])
}
```

---

### **2️⃣ PREMIUM_PACKAGES** (Updated)
**Mẫu gói với multiple billing cycles**

```prisma
model PREMIUM_PACKAGES {
  id                      String   @id @default(cuid())
  accountId              String
  serviceTypeId          String
  packageType            String   // "individual", "family", "group"
  name                   String   // "ChatGPT Plus Family 5-person"
  description            String?
  
  // Slots management
  slots                  Int   // Default: 5, nhưng flexible
  isFlexibleSlots        Boolean @default(true)  // ← Can change max slots per account
  minSlots               Int @default(1)
  maxSlotsLimit          Int @default(100)  // Safety limit
  
  // Pricing
  pricePerSlot           Decimal(10,2)
  renewalPriceFactor     Decimal(3,2) @default(1.0)  // 1.0 = same, 0.9 = 10% discount, 1.1 = 10% increase
  // ← If 0.9, renewal price = initial price * 0.9
  
  // Billing cycles
  supportedCycles        String  // JSON: ["1month", "3months", "6months", "1year"]
  // ← Seller can choose which cycles to offer
  
  isActive               Boolean @default(true)
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
  
  // Relations
  account                Account @relation(fields: [accountId], references: [id])
  serviceType            PREMIUM_SERVICE_TYPES @relation(fields: [serviceTypeId], references: [id])
  premiumAccounts        PREMIUM_ACCOUNTS[]
  subscriptions          CUSTOMER_PREMIUM_SUBSCRIPTIONS[]
  
  @@unique([accountId, serviceTypeId, packageType])
  @@index([accountId])
  @@index([serviceTypeId])
  @@index([isActive])
}
```

---

### **3️⃣ PREMIUM_ACCOUNTS** (Updated - KHO HÀNG)
**Main accounts - quản lý 1000+ accounts**

```prisma
model PREMIUM_ACCOUNTS {
  id                          String   @id @default(cuid())
  accountId                  String   // Seller's account
  serviceTypeId              String
  packageId                  String
  
  // Main account credentials (encrypted)
  primaryEmail               String
  primaryPasswordEncrypted   String
  joinLink                   String?
  
  // Slots - FLEXIBLE
  totalSlots                 Int      // Can be changed if isFlexibleSlots = true
  usedSlots                  Int @default(1)
  availableSlots             Int      // = totalSlots - usedSlots (Computed field)
  
  // Subscription dates
  billingCycle              String   // "1month", "3months", "6months", "1year"
  subscriptionStartDate     DateTime @default(now())
  subscriptionExpiryDate    DateTime
  daysRemaining             Int      // Computed: (expiryDate - today) in days
  
  // Renewal configuration
  autoRenewal               Boolean @default(false)  // ← Default NO renewal
  manualRenewal             Boolean @default(true)   // ← Manual renewal process
  
  // Status tracking - DETAILED
  status                    String @default("active")
  // "active" = working
  // "expiring_soon" = within 7 days
  // "expired" = past expiry
  // "migration_needed" = waiting to migrate customers
  // "paused" = seller paused
  // "suspended" = terms violation
  // "deleted" = soft delete
  
  connectionStatus          String @default("unknown")
  // "unknown" = not checked yet
  // "connected" = verified working (Duolingo API)
  // "error" = connection error
  // "expired" = subscription ended
  // "manual_check_needed" = need seller to verify
  
  // Check connection - DUOLINGO ONLY
  lastCheckedAt             DateTime?
  lastConnectionCheckResult Boolean?  // null, true, false
  lastConnectionError       String?
  connectionCheckCount      Int @default(0)  // Lần check
  
  // Renewal tracking
  lastRenewalDate           DateTime?
  renewalCount              Int @default(0)
  nextRenewalDate           DateTime?  // Khi hết hạn + cho phép renewal
  
  // Additional info
  notes                     String?
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
  deletedAt                 DateTime?
  
  // Relations
  account                   Account @relation(fields: [accountId], references: [id])
  serviceType               PREMIUM_SERVICE_TYPES @relation(fields: [serviceTypeId], references: [id])
  package                   PREMIUM_PACKAGES @relation(fields: [packageId], references: [id])
  users                     PREMIUM_ACCOUNT_USERS[]
  subscriptions             CUSTOMER_PREMIUM_SUBSCRIPTIONS[]
  healthLogs                PREMIUM_ACCOUNT_HEALTH_LOGS[]
  migrations                ACCOUNT_MIGRATIONS[]
  
  @@unique([primaryEmail])
  @@unique([accountId, primaryEmail])
  @@index([accountId])
  @@index([status])
  @@index([connectionStatus])
  @@index([subscriptionExpiryDate])
  @@index([serviceTypeId])
  @@index([packageId])
  @@index([statusStatus]) // Multi-field: status + connectionStatus
}
```

---

### **4️⃣ PREMIUM_ACCOUNT_USERS** (Updated - SUB-USERS)
**Track customer email changes + warranty**

```prisma
model PREMIUM_ACCOUNT_USERS {
  id                      String   @id @default(cuid())
  premiumAccountId       String
  accountId              String
  
  // Customer account access
  userEmail              String      // ← Email người dùng cung cấp
  userEmailVerified      Boolean @default(false)
  emailVerificationCode  String?
  emailVerificationExpiry DateTime?
  
  userPasswordEncrypted  String?     // ← Optional (khách tự set)
  userFullName           String?
  phoneNumber            String?
  
  // Email change tracking - BẢO HÀNH
  emailChangeHistory     String?     // JSON: [{date, oldEmail, newEmail, reason}]
  lastEmailChangedAt     DateTime?
  lastEmailChangedBy     String?     // "self" or admin id
  
  // Password change tracking
  passwordChangeCount    Int @default(0)
  lastPasswordChangedAt  DateTime?
  
  // Access & usage
  role                   String @default("member")  // "owner", "member", "viewer"
  joinDate               DateTime @default(now())
  lastActiveDate         DateTime?
  lastActiveIP           String?
  
  // Account status
  status                 String @default("active")
  // "active" = can access
  // "inactive" = not verified
  // "paused" = seller paused
  // "removed" = seller kicked
  // "migration_pending" = waiting to move to new account
  
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
  deletedAt              DateTime?
  
  // Relations
  premiumAccount         PREMIUM_ACCOUNTS @relation(fields: [premiumAccountId], references: [id], onDelete: Cascade)
  account                Account @relation(fields: [accountId], references: [id])
  subscriptions          CUSTOMER_PREMIUM_SUBSCRIPTIONS[]
  history                PREMIUM_ACCOUNT_USER_HISTORY[]
  
  @@unique([premiumAccountId, userEmail])
  @@index([premiumAccountId])
  @@index([accountId])
  @@index([userEmail])
  @@index([status])
}
```

---

### **5️⃣ CUSTOMER_PREMIUM_SUBSCRIPTIONS** (Updated - KHÁCH MUA)
**Track renewal status, refunds, migration**

```prisma
model CUSTOMER_PREMIUM_SUBSCRIPTIONS {
  id                      String   @id @default(cuid())
  customerId             String
  orderId                String
  accountId              String
  premiumAccountId       String
  premiumAccountUserId   String?
  
  // Purchase details
  purchaseDate           DateTime @default(now())
  billingCycle          String   // "1month", "3months", "6months", "1year"
  cycleMonths           Int      // 1, 3, 6, 12
  
  // Duration
  startDate              DateTime @default(now())
  expiryDate             DateTime
  daysRemaining          Int      // Computed field
  
  // Pricing
  originalPrice          Decimal(12,2)
  renewalPrice           Decimal(12,2)?  // Khác nếu có discount/increase
  proratedRefundAmount   Decimal(12,2)?  // Tính sẵn nếu refund
  
  // Renewal process - MANUAL
  renewalStatus          String @default("none")
  // "none" = no renewal
  // "pending" = asked customer (waiting answer)
  // "confirmed" = customer confirmed renew
  // "denied" = customer declined
  // "migrated" = customer moved to new account
  // "refunded" = customer refunded and kicked
  
  renewalAskedAt         DateTime?   // Khi nào offer renewal?
  renewalAskedUntil      DateTime?   // Deadline cho customer answer?
  renewalConfirmedAt     DateTime?   // Khi customer confirm renew?
  renewalDeniedAt        DateTime?   // Khi customer say no renew?
  renewalDeniedReason    String?     // Why declined?
  
  // Refund tracking
  refundRequested        Boolean @default(false)
  refundRequestedAt      DateTime?
  refundApprovedAt       DateTime?
  refundStatus           String?     // "pending", "approved", "rejected", "completed"
  refundReason           String?
  refundAmount           Decimal(12,2)?
  refundNotes            String?
  
  // Account migration - NEW
  migratedFromAccountId  String?     // Previous account if moved
  migratedToAccountId    String?     // If moving to new account
  migrationReason        String?     // "account_expired", "upgrade", "downgrade"
  migrationDate          DateTime?
  
  // General status
  status                 String @default("active")
  // "active" = using
  // "waiting_renewal" = asking if want renew
  // "renewed" = just renewed
  // "expired" = past expiry
  // "migrated" = moved to new account
  // "refunded" = refunded and kicked
  // "suspended" = error/issue
  
  accessMethod           String @default("email")  // email, link, manual
  lastAccessDate         DateTime?
  lastAccessIP           String?
  failedLoginAttempts    Int @default(0)
  
  notes                  String?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
  deletedAt              DateTime?
  
  // Relations
  customer               Customer @relation(fields: [customerId], references: [id])
  order                  Order @relation(fields: [orderId], references: [id])
  account                Account @relation(fields: [accountId], references: [id])
  premiumAccount         PREMIUM_ACCOUNTS @relation(fields: [premiumAccountId], references: [id])
  premiumAccountUser     PREMIUM_ACCOUNT_USERS? @relation(fields: [premiumAccountUserId], references: [id])
  renewals               SUBSCRIPTION_RENEWALS[]
  
  @@unique([orderId])
  @@index([customerId])
  @@index([premiumAccountId])
  @@index([status])
  @@index([renewalStatus])
  @@index([expiryDate])
  @@index([accountId])
}
```

---

### **6️⃣ PREMIUM_ACCOUNT_HEALTH_LOGS** (Updated)
**Connection check - Duolingo only**

```prisma
model PREMIUM_ACCOUNT_HEALTH_LOGS {
  id                      String   @id @default(cuid())
  premiumAccountId       String
  accountId              String
  
  checkTimestamp         DateTime @default(now())
  checkType              String   // "auto", "manual", "api"
  checkSource            String?  // "duolingo_api", "seller_report", etc
  
  // Connection test result (DUOLINGO ONLY)
  connectionTest         Boolean?     // null if not checked, true/false if checked
  connectionTestType     String?      // "api_request", "manual_verification"
  responseTime           Int?         // milliseconds
  
  // Status change tracking
  previousStatus         String?
  currentStatus          String       // connected, error, expired
  
  // Error tracking
  errorCode              String?
  errorMessage           String?
  errorDetails           String?      // JSON with full error info
  
  // User activity snapshot
  subUsersCount          Int?         // How many sub-users active?
  slotsActuallyUsed      Int?
  
  // Expiry warning
  daysUntilExpiry        Int?
  expiryWarning          Boolean @default(false)  // Within 7 days?
  
  checkedBy              String @default("system")  // "system", "admin_id", "customer_report"
  notes                  String?
  createdAt              DateTime @default(now())
  
  // Relations
  premiumAccount         PREMIUM_ACCOUNTS @relation(fields: [premiumAccountId], references: [id], onDelete: Cascade)
  accountRef             Account @relation(fields: [accountId], references: [id])
  
  @@index([premiumAccountId])
  @@index([accountId])
  @@index([checkTimestamp])
  @@index([currentStatus])
}
```

---

### **7️⃣ PREMIUM_ACCOUNT_USER_HISTORY** (Same)
**Lịch sử thay đổi sub-users**

```prisma
model PREMIUM_ACCOUNT_USER_HISTORY {
  id                      String   @id @default(cuid())
  premiumAccountUserId   String
  premiumAccountId       String
  accountId              String
  
  actionType             String  // created, email_changed, password_changed, verified, status_changed, removed, migrated
  oldValue                String?  // JSON
  newValue                String?  // JSON
  
  // Email changes - ESPECIALLY TRACK
  oldEmail               String?
  newEmail               String?
  emailChangedReason     String?
  
  performedBy            String  // user_id hoặc "system" hoặc "customer_self"
  performedByType        String @default("system")  // "system", "admin", "customer"
  reason                 String?
  notes                  String?
  
  ipAddress              String?
  createdAt              DateTime @default(now())
  
  // Relations
  premiumAccountUser     PREMIUM_ACCOUNT_USERS @relation(fields: [premiumAccountUserId], references: [id], onDelete: Cascade)
  premiumAccount         PREMIUM_ACCOUNTS @relation(fields: [premiumAccountId], references: [id])
  account                Account @relation(fields: [accountId], references: [id])
  
  @@index([premiumAccountUserId])
  @@index([premiumAccountId])
  @@index([accountId])
  @@index([actionType])
  @@index([createdAt])
}
```

---

### **8️⃣ SUBSCRIPTION_RENEWALS** (Updated)
**Track renewal requests + refunds**

```prisma
model SUBSCRIPTION_RENEWALS {
  id                          String   @id @default(cuid())
  accountId                  String
  originalSubscriptionId     String
  renewalOrderId             String
  customerId                String
  premiumAccountId           String
  
  // Renewal dates
  renewalRequestedDate       DateTime @default(now())
  renewalConfirmedDate       DateTime?
  renewalDate                DateTime?
  newExpiryDate              DateTime?
  newBillingCycle           String?  // Can differ from original
  newCycleMonths            Int?
  
  // Pricing
  originalPrice              Decimal(12,2)?
  renewalPrice               Decimal(12,2)?
  discount                   Decimal(12,2) @default(0)
  totalPrice                 Decimal(12,2)?
  
  // Status
  status                     String @default("pending")
  // "pending" = waiting customer answer
  // "confirmed" = customer confirmed
  // "denied" = customer declined
  // "completed" = renewed successfully
  // "failed" = payment failed
  // "refunded" = refund processed
  
  paymentStatus              String?
  paymentMethod              String?
  
  // Customer response tracking
  customerResponseDate       DateTime?
  customerResponse           String?  // "accept" or "decline"
  declineReason              String?
  
  // If declined - refund
  refundCalculated           Boolean @default(false)
  refundAmount               Decimal(12,2)?
  refundCalculationMethod    String?  // "prorated", "full", "partial"
  // Prorated: (remaining_days / total_days) * total_price
  
  refundApprovedAt           DateTime?
  refundCompletedAt          DateTime?
  refundTransactionId        String?
  
  // Manual migration option
  migrateToNewAccount        Boolean @default(false)
  newPremiumAccountId        String?
  migrationCompleted         DateTime?
  
  notes                      String?
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt
  
  // Relations
  account                    Account @relation(fields: [accountId], references: [id])
  originalSubscription       CUSTOMER_PREMIUM_SUBSCRIPTIONS @relation(fields: [originalSubscriptionId], references: [id])
  customer                   Customer @relation(fields: [customerId], references: [id])
  premiumAccount             PREMIUM_ACCOUNTS @relation(fields: [premiumAccountId], references: [id])
  renewalOrder               Order @relation(fields: [renewalOrderId], references: [id])
  
  @@index([originalSubscriptionId])
  @@index([customerId])
  @@index([status])
  @@index([customerResponse])
}
```

---

### **9️⃣ ACCOUNT_MIGRATIONS** - NEW!
**Track khi khách chuyển từ account này sang account khác**

```prisma
model ACCOUNT_MIGRATIONS {
  id                      String   @id @default(cuid())
  accountId              String
  subscriptionId         String   // CUSTOMER_PREMIUM_SUBSCRIPTIONS
  customerId             String
  
  // Migration details
  sourceAccountId        String     // Account cũ
  targetAccountId        String     // Account mới
  sourceAccountEmail     String?    // For reference
  targetAccountEmail     String?
  
  // Sub-user update
  sourceUserId           String?    // Old sub-user
  targetUserId           String?    // New sub-user
  
  // Migration reason
  reason                 String     // "account_expired", "upgrade", "downgrade", "technical_issue", "manual_switch"
  initiatedBy            String @default("system")  // "system", "admin_id", "customer_id"
  
  // Status
  status                 String @default("pending")
  // "pending" = waiting
  // "in_progress" = migrating
  // "completed" = moved successfully
  // "failed" = error during migration
  // "rollback" = reverted
  
  startedAt              DateTime @default(now())
  completedAt            DateTime?
  
  details                String?    // JSON with migration log
  errorLog               String?    // If failed
  
  notes                  String?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
  
  // Relations
  account                Account @relation(fields: [accountId], references: [id])
  subscription           CUSTOMER_PREMIUM_SUBSCRIPTIONS @relation(fields: [subscriptionId], references: [id])
  sourceAccount          PREMIUM_ACCOUNTS @relation("migration_from", fields: [sourceAccountId], references: [id])
  targetAccount          PREMIUM_ACCOUNTS @relation("migration_to", fields: [targetAccountId], references: [id])
  
  @@index([subscriptionId])
  @@index([customerId])
  @@index([status])
}
```

---

### **🔟 ACCOUNT_MIGRATION_HISTORY** - NEW!
**Lịch sử đầy đủ của account migration**

```prisma
model ACCOUNT_MIGRATION_HISTORY {
  id                      String   @id @default(cuid())
  migrationId            String   // FK to ACCOUNT_MIGRATIONS
  
  // Status change log
  oldStatus              String
  newStatus              String
  
  // Timeline
  timestamp              DateTime @default(now())
  
  // Who did it
  performedBy            String?  // User ID or "system"
  action                 String   // "received_customer_email", "verified_new_account", "kicked_old_user", "created_new_user", "setup_new_access", "completed"
  
  details                String?  // JSON
  errorIfAny             String?
  notes                  String?
  
  // Relations
  migration              ACCOUNT_MIGRATIONS @relation(fields: [migrationId], references: [id], onDelete: Cascade)
  
  @@index([migrationId])
  @@index([timestamp])
}
```

---

## 🔗 Updated Relations Diagram

```
accounts (seller)
  │
  ├─→ PREMIUM_SERVICE_TYPES (ChatGPT, Duolingo, Netflix, ...)
  │     │ supportsConnectionCheck (Duolingo = true)
  │     └─→ PREMIUM_PACKAGES
  │           └─→ PREMIUM_ACCOUNTS (1000+ accounts!)
  │                 ├─→ PREMIUM_ACCOUNT_USERS (flexible, default 5)
  │                 │     └─→ PREMIUM_ACCOUNT_USER_HISTORY
  │                 │
  │                 ├─→ CUSTOMER_PREMIUM_SUBSCRIPTIONS
  │                 │     ├─→ SUBSCRIPTION_RENEWALS (manual renew process)
  │                 │     └─→ ACCOUNT_MIGRATIONS (if switching accounts)
  │                 │
  │                 ├─→ PREMIUM_ACCOUNT_HEALTH_LOGS (Duolingo API check)
  │                 │
  │                 └─→ ACCOUNT_MIGRATIONS (from/to tracking)
  │
  └─→ ACCOUNT_MIGRATION_HISTORY (audit trail)
```

---

## 📈 Key Changes Summary

### **✅ 1000+ Packages Support**
```
- Better indexing: (accountId, status, expiryDate)
- Efficient queries for bulk operations
- Flexible slots per account (not fixed)
```

### **✅ Manual Renewal Process**
```
CUSTOMER_PREMIUM_SUBSCRIPTIONS.renewalStatus:
├─ none → pending (ask customer)
├─ pending → confirmed (customer says yes)
├─ pending → denied (customer says no)
├─ confirmed → renewed (charge + update expiry)
├─ denied → refunded (kick + refund)
└─ confirmed → migrated (move to new account)
```

### **✅ Flexible Slots**
```
PREMIUM_PACKAGES.isFlexibleSlots = true
PREMIUM_PACKAGES.maxSlotsLimit = 100 (safety)

Per PREMIUM_ACCOUNTS:
├─ totalSlots: flexible (seller can change)
├─ minSlots: 1
└─ maxSlotsLimit: from package
```

### **✅ Multiple Billing Cycles**
```
PREMIUM_PACKAGES.supportedCycles = JSON
Example: ["1month", "3months", "6months", "1year"]

CUSTOMER_PREMIUM_SUBSCRIPTIONS.billingCycle
└─ Customer chooses 1m, 3m, 6m, or 1y
```

### **✅ Email/Password Tracking**
```
PREMIUM_ACCOUNT_USERS:
├─ userEmail (khách cung cấp)
├─ emailChangeHistory (JSON: [{date, oldEmail, newEmail}])
├─ lastEmailChangedAt
├─ lastEmailChangedBy
├─ passwordChangeCount
└─ lastPasswordChangedAt

PREMIUM_ACCOUNT_USER_HISTORY:
├─ actionType: "email_changed"
├─ oldEmail, newEmail
└─ emailChangedReason (for warranty)
```

### **✅ Duolingo Connection Check Only**
```
PREMIUM_SERVICE_TYPES.supportsConnectionCheck = false (default)
Duolingo: supportsConnectionCheck = true
          connectionCheckApiUrl = "https://api.duolingo.com/..."

PREMIUM_ACCOUNT_HEALTH_LOGS:
├─ Only created for services with supportsConnectionCheck = true
├─ For others: connectionStatus = "manual_check_needed"
└─ Seller reports status manually
```

### **✅ Refund Calculation**
```
SUBSCRIPTION_RENEWALS includes:
├─ refundCalculated: boolean
├─ refundAmount: decimal
├─ refundCalculationMethod: "prorated", "full", "partial"

Prorated formula:
  refund = (remaining_days / total_days) × total_price

Example:
  Total price: $30 for 1 year (365 days)
  Days used: 100 days
  Days remaining: 265 days
  Refund = (265 / 365) × $30 = $21.81
```

### **✅ Manual Account Migration**
```
When PREMIUM_ACCOUNT expires:

1. CUSTOMER_PREMIUM_SUBSCRIPTIONS.status = "migration_needed"

2. Seller creates new account (PREMIUM_ACCOUNTS)

3. Seller initiates ACCOUNT_MIGRATIONS:
   ├─ sourceAccountId: old account
   ├─ targetAccountId: new account
   ├─ reason: "account_expired"
   └─ status: "pending"

4. System moves customer:
   ├─ Create NEW sub-user on new account
   ├─ Update CUSTOMER_PREMIUM_SUBSCRIPTIONS.premiumAccountId
   ├─ Update subscription status
   ├─ Log to ACCOUNT_MIGRATION_HISTORY
   └─ Send email to customer

5. Old sub-user marked as:
   └─ PREMIUM_ACCOUNT_USERS.status = "removed"
```

---

## 🎯 Optimizations for 1000+ Packages

### **Indexing Strategy**
```
PREMIUM_ACCOUNTS:
├─ (accountId, status) ← Find seller's active accounts
├─ (status, subscriptionExpiryDate) ← Find expiring accounts
├─ (serviceTypeId, status) ← Find by service
├─ subscriptionExpiryDate ← Daily renewal job
├─ connectionStatus ← Find error connections
└─ primaryEmail ← Prevent duplicates

CUSTOMER_PREMIUM_SUBSCRIPTIONS:
├─ (customerId, status) ← Customer's all subscriptions
├─ (premiumAccountId, status) ← Who's using this account
├─ (expiryDate, renewalStatus) ← Find to ask renewal
├─ (status, autoRenewal) ← Batch renewal job
└─ (customerId, expiryDate) ← Expiry notifications

SUBSCRIPTION_RENEWALS:
├─ (status, customerResponseDate) ← Find pending responses
├─ (customerId, status) ← Customer renewal history
├─ (refundStatus) ← Find refunds to process
└─ (migrateToNewAccount) ← Track migrations
```

### **Query Performance**
```
Find all expiring accounts (within 7 days):
  SELECT * FROM PREMIUM_ACCOUNTS
  WHERE subscriptionExpiryDate BETWEEN now() AND now() + 7 days
  AND status != "expired"
  Index: (subscriptionExpiryDate, status)

Find customers waiting to renew:
  SELECT * FROM CUSTOMER_PREMIUM_SUBSCRIPTIONS
  WHERE renewalStatus = "pending"
  AND expiryDate <= now()
  Index: (renewalStatus, expiryDate)

Find migrations in progress:
  SELECT * FROM ACCOUNT_MIGRATIONS
  WHERE status = "in_progress"
  Index: (status, startedAt)
```

---

## 📝 Updates to ORDERS Table

```prisma
model Order {
  // Existing fields...
  
  // Premium account fields
  isPremiumAccountOrder     Boolean @default(false)
  premiumSubscriptionId     String?     // FK
  
  // Renewal fields
  isRenewalOrder           Boolean @default(false)
  renewsSubscriptionId     String?     // Which subscription is renewed?
  renewalOrderAmount       Decimal(12,2)?  // If different from original
  
  // Migration fields
  isMigrationOrder         Boolean @default(false)
  migrationId              String?     // FK to ACCOUNT_MIGRATIONS
  
  // Relations
  premiumSubscription      CUSTOMER_PREMIUM_SUBSCRIPTIONS? @relation(fields: [premiumSubscriptionId], references: [id])
  renewals                 SUBSCRIPTION_RENEWALS[]
  migrations               ACCOUNT_MIGRATIONS?
}
```

---

## ✅ Verification Checklist - UPDATED

### **Data Structure**
- [ ] Support 1000+ accounts? ✓ (Proper indexing)
- [ ] Flexible slots? ✓ (totalSlots configurable)
- [x] Multiple billing cycles? ✓ (1m, 3m, 6m, 1y)
- [ ] Manual renewal? ✓ (renewalStatus tracking)

### **Features**
- [ ] Connection check (Duolingo only)? ✓ (supportsConnectionCheck)
- [ ] Email tracking? ✓ (emailChangeHistory)
- [ ] Password tracking? ✓ (passwordChangeCount)
- [ ] Refund calculation? ✓ (prorated formula)
- [ ] Account migration? ✓ (ACCOUNT_MIGRATIONS table)

### **Business Rules**
- [ ] Renewal offer workflow? ✓ (ask → confirm/deny)
- [ ] If denied → refund? ✓ (refund calculated + kicked)
- [ ] If expire → migrate? ✓ (switch to new account)
- [ ] Seller manual control? ✓ (all manual processes)

---

**Status:** ✅ **READY FOR IMPLEMENTATION**

Xác minh và tôi sẽ generate Prisma schema file cho bạn! 👍
