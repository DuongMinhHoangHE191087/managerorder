// ============= Premium Accounts System - Production Schema =============
// Support: 1000+ packages, multiple services, flexible slots, manual renewal
// Date: March 5, 2026

// ============= 1. PREMIUM_SERVICE_TYPES =============
model PremiumServiceType {
  id                         String   @id @default(cuid())
  accountId                  String
  name                       String   // "ChatGPT", "Duolingo", "Netflix", "YouTube"
  slug                       String   // "chatgpt", "duolingo", "netflix", "youtube"
  description                String?
  logoUrl                    String?
  website                    String?
  category                   String   // "ai", "learning", "streaming", "productivity"
  
  // Connection check support (Duolingo = true, others = false)
  supportsConnectionCheck    Boolean @default(false)
  connectionCheckType        String?  // "api", "manual", "scheduled"
  connectionCheckApiUrl      String?  // API endpoint for auto-checks
  
  // Limits
  maxPackagesAllowed         Int @default(100)
  
  isActive                   Boolean @default(true)
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt
  
  // Relations
  account                    Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  packages                   PremiumPackage[]
  premiumAccounts           PremiumAccount[]
  healthLogs                PremiumAccountHealthLog[]
  
  @@unique([accountId, slug])
  @@index([accountId])
  @@index([isActive])
}

// ============= 2. PREMIUM_PACKAGES =============
model PremiumPackage {
  id                         String   @id @default(cuid())
  accountId                  String
  serviceTypeId              String
  
  packageType                String   // "individual", "family", "group"
  name                       String   // "ChatGPT Plus Family 5-person"
  description                String?
  
  // Slots - FLEXIBLE
  slots                      Int @default(5)  // Default 5, but can change per account
  isFlexibleSlots            Boolean @default(true)
  minSlots                   Int @default(1)
  maxSlotsLimit              Int @default(100)
  
  // Pricing
  pricePerSlot               Decimal(10,2)
  renewalPriceFactor         Decimal(3,2) @default(1.0)  // 1.0 = same, 0.9 = 10% discount
  
  // Billing cycles - JSON array
  supportedCycles            String  // JSON: ["1month", "3months", "6months", "1year"]
  
  isActive                   Boolean @default(true)
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt
  
  // Relations
  account                    Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  serviceType                PremiumServiceType @relation(fields: [serviceTypeId], references: [id])
  premiumAccounts           PremiumAccount[]
  subscriptions             CustomerPremiumSubscription[]
  
  @@unique([accountId, serviceTypeId, packageType])
  @@index([accountId])
  @@index([serviceTypeId])
  @@index([isActive])
}

// ============= 3. PREMIUM_ACCOUNTS (KHO HÀNG) =============
model PremiumAccount {
  id                         String   @id @default(cuid())
  accountId                  String
  serviceTypeId              String
  packageId                  String
  
  // Credentials (encrypted)
  primaryEmail               String
  primaryPasswordEncrypted   String
  joinLink                   String?
  
  // Slots - FLEXIBLE
  totalSlots                 Int      // Can be changed if isFlexibleSlots = true
  usedSlots                  Int @default(1)
  availableSlots             Int      // Computed: totalSlots - usedSlots
  
  // Subscription
  billingCycle              String   // "1month", "3months", "6months", "1year"
  subscriptionStartDate     DateTime @default(now())
  subscriptionExpiryDate    DateTime
  daysRemaining             Int      // Computed: (expiryDate - today)
  
  // Renewal
  autoRenewal               Boolean @default(false)
  manualRenewal             Boolean @default(true)
  
  // Status - COMPREHENSIVE
  status                    String @default("active")
  // "active", "expiring_soon", "expired", "migration_needed", "paused", "suspended", "deleted"
  
  connectionStatus          String @default("unknown")
  // "unknown", "connected", "error", "expired", "manual_check_needed"
  
  // Connection checks (Duolingo only)
  lastCheckedAt             DateTime?
  lastConnectionCheckResult Boolean?
  lastConnectionError       String?
  connectionCheckCount      Int @default(0)
  
  // Renewal history
  lastRenewalDate           DateTime?
  renewalCount              Int @default(0)
  nextRenewalDate           DateTime?
  
  // Additional
  notes                     String?
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
  deletedAt                 DateTime?
  
  // Relations
  account                   Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  serviceType               PremiumServiceType @relation(fields: [serviceTypeId], references: [id])
  package                   PremiumPackage @relation(fields: [packageId], references: [id])
  users                     PremiumAccountUser[]
  subscriptions            CustomerPremiumSubscription[]
  healthLogs               PremiumAccountHealthLog[]
  migrationsFrom           AccountMigration[] @relation("migration_from")
  migrationsTo             AccountMigration[] @relation("migration_to")
  
  @@unique([primaryEmail])
  @@unique([accountId, primaryEmail])
  @@index([accountId])
  @@index([status])
  @@index([connectionStatus])
  @@index([subscriptionExpiryDate])
  @@index([serviceTypeId])
}

// ============= 4. PREMIUM_ACCOUNT_USERS (SUB-USERS) =============
model PremiumAccountUser {
  id                         String   @id @default(cuid())
  premiumAccountId          String
  accountId                 String
  
  // Customer's email (they provide)
  userEmail                 String
  userEmailVerified         Boolean @default(false)
  emailVerificationCode     String?
  emailVerificationExpiry   DateTime?
  
  // Password (optional - customer may set own)
  userPasswordEncrypted     String?
  userFullName              String?
  phoneNumber              String?
  
  // Email change tracking - WARRANTY
  emailChangeHistory        String?   // JSON: [{date, oldEmail, newEmail, reason}]
  lastEmailChangedAt        DateTime?
  lastEmailChangedBy        String?   // "self" or admin id
  
  // Password tracking
  passwordChangeCount       Int @default(0)
  lastPasswordChangedAt     DateTime?
  
  // Access
  role                      String @default("member")  // "owner", "member", "viewer"
  joinDate                  DateTime @default(now())
  lastActiveDate            DateTime?
  lastActiveIP              String?
  
  // Status
  status                    String @default("active")
  // "active", "inactive", "paused", "removed", "migration_pending"
  
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
  deletedAt                 DateTime?
  
  // Relations
  premiumAccount            PremiumAccount @relation(fields: [premiumAccountId], references: [id], onDelete: Cascade)
  account                   Account @relation(fields: [accountId], references: [id])
  subscriptions            CustomerPremiumSubscription[]
  history                  PremiumAccountUserHistory[]
  
  @@unique([premiumAccountId, userEmail])
  @@index([premiumAccountId])
  @@index([accountId])
  @@index([userEmail])
  @@index([status])
}

// ============= 5. CUSTOMER_PREMIUM_SUBSCRIPTIONS (KHÁCH MUA) =============
model CustomerPremiumSubscription {
  id                         String   @id @default(cuid())
  customerId                String
  orderId                   String
  accountId                 String  // Seller
  premiumAccountId          String
  premiumAccountUserId      String?
  
  // Purchase
  purchaseDate              DateTime @default(now())
  billingCycle             String   // "1month", "3months", "6months", "1year"
  cycleMonths              Int      // 1, 3, 6, 12
  
  // Duration
  startDate                 DateTime @default(now())
  expiryDate                DateTime
  daysRemaining            Int      // Computed
  
  // Pricing
  originalPrice             Decimal(12,2)
  renewalPrice              Decimal(12,2)?
  proratedRefundAmount      Decimal(12,2)?
  
  // RENEWAL PROCESS - MANUAL
  renewalStatus            String @default("none")
  // "none", "pending", "confirmed", "denied", "migrated", "refunded"
  
  renewalAskedAt           DateTime?     // When did we ask customer?
  renewalAskedUntil        DateTime?     // Deadline for customer answer
  renewalConfirmedAt       DateTime?
  renewalDeniedAt          DateTime?
  renewalDeniedReason      String?
  
  // Refund tracking
  refundRequested          Boolean @default(false)
  refundRequestedAt        DateTime?
  refundApprovedAt         DateTime?
  refundStatus             String?       // "pending", "approved", "rejected", "completed"
  refundReason             String?
  refundAmount             Decimal(12,2)?
  refundNotes              String?
  
  // Account migration
  migratedFromAccountId    String?
  migratedToAccountId      String?
  migrationReason          String?       // "account_expired", "upgrade", "downgrade"
  migrationDate            DateTime?
  
  // General status
  status                   String @default("active")
  // "active", "waiting_renewal", "renewed", "expired", "migrated", "refunded", "suspended"
  
  accessMethod             String @default("email")
  lastAccessDate           DateTime?
  lastAccessIP             String?
  failedLoginAttempts      Int @default(0)
  
  notes                    String?
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt
  deletedAt                DateTime?
  
  // Relations
  customer                 Customer @relation(fields: [customerId], references: [id])
  order                    Order @relation(fields: [orderId], references: [id])
  account                  Account @relation(fields: [accountId], references: [id])
  premiumAccount           PremiumAccount @relation(fields: [premiumAccountId], references: [id])
  premiumAccountUser       PremiumAccountUser? @relation(fields: [premiumAccountUserId], references: [id])
  renewals                 SubscriptionRenewal[]
  migrations               AccountMigration[]
  
  @@unique([orderId])
  @@index([customerId])
  @@index([premiumAccountId])
  @@index([status])
  @@index([renewalStatus])
  @@index([expiryDate])
}

// ============= 6. PREMIUM_ACCOUNT_HEALTH_LOGS =============
model PremiumAccountHealthLog {
  id                         String   @id @default(cuid())
  premiumAccountId          String
  accountId                 String
  serviceTypeId             String
  
  checkTimestamp            DateTime @default(now())
  checkType                 String   // "auto", "manual", "api"
  checkSource               String?  // "duolingo_api", "seller_report"
  
  // Connection test (Duolingo only)
  connectionTest            Boolean?
  connectionTestType        String?  // "api_request", "manual_verification"
  responseTime              Int?     // milliseconds
  
  // Status tracking
  previousStatus            String?
  currentStatus             String   // "connected", "error", "expired"
  
  // Errors
  errorCode                 String?
  errorMessage              String?
  errorDetails              String?  // JSON
  
  // Snapshots
  subUsersCount             Int?
  slotsActuallyUsed         Int?
  
  // Expiry tracking
  daysUntilExpiry           Int?
  expiryWarning             Boolean @default(false)
  
  checkedBy                 String @default("system")
  notes                     String?
  createdAt                 DateTime @default(now())
  
  // Relations
  premiumAccount            PremiumAccount @relation(fields: [premiumAccountId], references: [id], onDelete: Cascade)
  account                   Account @relation(fields: [accountId], references: [id])
  serviceType               PremiumServiceType @relation(fields: [serviceTypeId], references: [id])
  
  @@index([premiumAccountId])
  @@index([accountId])
  @@index([checkTimestamp])
  @@index([currentStatus])
}

// ============= 7. PREMIUM_ACCOUNT_USER_HISTORY =============
model PremiumAccountUserHistory {
  id                         String   @id @default(cuid())
  premiumAccountUserId      String
  premiumAccountId          String
  accountId                 String
  
  actionType                String
  // "created", "email_changed", "password_changed", "verified", "status_changed", "removed", "migrated"
  
  oldValue                  String?  // JSON
  newValue                  String?  // JSON
  
  // Email changes - TRACK
  oldEmail                  String?
  newEmail                  String?
  emailChangedReason        String?
  
  performedBy               String   // user_id, "system", "customer_self"
  performedByType           String @default("system")  // "system", "admin", "customer"
  reason                    String?
  notes                     String?
  ipAddress                 String?
  
  createdAt                 DateTime @default(now())
  
  // Relations
  premiumAccountUser        PremiumAccountUser @relation(fields: [premiumAccountUserId], references: [id], onDelete: Cascade)
  premiumAccount            PremiumAccount @relation(fields: [premiumAccountId], references: [id])
  account                   Account @relation(fields: [accountId], references: [id])
  
  @@index([premiumAccountUserId])
  @@index([premiumAccountId])
  @@index([accountId])
  @@index([actionType])
}

// ============= 8. SUBSCRIPTION_RENEWALS =============
model SubscriptionRenewal {
  id                         String   @id @default(cuid())
  accountId                 String
  originalSubscriptionId    String
  renewalOrderId            String
  customerId               String
  premiumAccountId          String
  
  // Renewal dates
  renewalRequestedDate      DateTime @default(now())
  renewalConfirmedDate      DateTime?
  renewalDate               DateTime?
  newExpiryDate             DateTime?
  newBillingCycle          String?
  newCycleMonths           Int?
  
  // Pricing
  originalPrice             Decimal(12,2)?
  renewalPrice              Decimal(12,2)?
  discount                  Decimal(12,2) @default(0)
  totalPrice                Decimal(12,2)?
  
  // Status
  status                    String @default("pending")
  // "pending", "confirmed", "denied", "completed", "failed", "refunded"
  
  paymentStatus             String?
  paymentMethod             String?
  
  // Customer response
  customerResponseDate      DateTime?
  customerResponse          String?  // "accept", "decline"
  declineReason             String?
  
  // Refund calculation
  refundCalculated          Boolean @default(false)
  refundAmount              Decimal(12,2)?
  refundCalculationMethod   String?  // "prorated", "full", "partial"
  // Formula: (remaining_days / total_days) * original_price
  
  refundApprovedAt          DateTime?
  refundCompletedAt         DateTime?
  refundTransactionId       String?
  
  // Migration option
  migrateToNewAccount       Boolean @default(false)
  newPremiumAccountId       String?
  migrationCompleted        DateTime?
  
  notes                     String?
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
  
  // Relations
  account                   Account @relation(fields: [accountId], references: [id])
  originalSubscription      CustomerPremiumSubscription @relation(fields: [originalSubscriptionId], references: [id])
  customer                  Customer @relation(fields: [customerId], references: [id])
  premiumAccount            PremiumAccount @relation(fields: [premiumAccountId], references: [id])
  renewalOrder              Order @relation(fields: [renewalOrderId], references: [id])
  
  @@index([originalSubscriptionId])
  @@index([customerId])
  @@index([status])
  @@index([customerResponse])
}

// ============= 9. ACCOUNT_MIGRATIONS =============
model AccountMigration {
  id                         String   @id @default(cuid())
  accountId                 String
  subscriptionId            String
  customerId               String
  
  // Migration from/to
  sourceAccountId           String
  targetAccountId           String
  sourceAccountEmail        String?
  targetAccountEmail        String?
  
  // Sub-users
  sourceUserId              String?
  targetUserId              String?
  
  // Reason
  reason                    String
  // "account_expired", "upgrade", "downgrade", "technical_issue", "manual_switch"
  
  initiatedBy               String @default("system")  // "system", admin_id, customer_id
  
  // Status
  status                    String @default("pending")
  // "pending", "in_progress", "completed", "failed", "rollback"
  
  startedAt                 DateTime @default(now())
  completedAt               DateTime?
  
  details                   String?  // JSON with migration log
  errorLog                  String?
  notes                     String?
  
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
  
  // Relations
  account                   Account @relation(fields: [accountId], references: [id])
  subscription              CustomerPremiumSubscription @relation(fields: [subscriptionId], references: [id])
  sourceAccount             PremiumAccount @relation("migration_from", fields: [sourceAccountId], references: [id])
  targetAccount             PremiumAccount @relation("migration_to", fields: [targetAccountId], references: [id])
  history                   AccountMigrationHistory[]
  
  @@index([subscriptionId])
  @@index([customerId])
  @@index([status])
}

// ============= 10. ACCOUNT_MIGRATION_HISTORY =============
model AccountMigrationHistory {
  id                         String   @id @default(cuid())
  migrationId               String
  
  oldStatus                 String
  newStatus                 String
  
  timestamp                 DateTime @default(now())
  
  performedBy               String?  // user_id, "system"
  action                    String
  // "received_customer_email", "verified_new_account", "kicked_old_user", "created_new_user", "setup_new_access"
  
  details                   String?  // JSON
  errorIfAny                String?
  notes                     String?
  
  // Relations
  migration                 AccountMigration @relation(fields: [migrationId], references: [id], onDelete: Cascade)
  
  @@index([migrationId])
  @@index([timestamp])
}

// ============= UPDATES TO EXISTING TABLES =============

model Order {
  // Existing fields...
  
  // Premium account fields
  isPremiumAccountOrder     Boolean @default(false)
  premiumSubscriptionId     String?
  
  // Renewal fields
  isRenewalOrder            Boolean @default(false)
  renewsSubscriptionId      String?
  renewalOrderAmount        Decimal(12,2)?
  
  // Migration fields
  isMigrationOrder          Boolean @default(false)
  migrationId               String?
  
  // Relations
  premiumSubscription       CustomerPremiumSubscription? @relation(fields: [premiumSubscriptionId], references: [id])
  renewals                  SubscriptionRenewal[]
  migrations                AccountMigration?
}
