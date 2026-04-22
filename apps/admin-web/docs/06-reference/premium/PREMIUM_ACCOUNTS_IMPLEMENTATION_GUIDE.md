# 📝 Integration Guide - Adding Premium Accounts to Existing Schema

**Status:** Ready to Implement  
**Date:** March 5, 2026

---

## 🗂️ Your Current Schema Location

```
d:\GITHUB\managerorder\premium-admin-web\
└─ prisma/
   └─ schema.prisma ← Update this file
```

---

## 📋 Step-by-Step Integration

### **Step 1: Backup Current Schema**
```bash
# Make a backup
cp prisma/schema.prisma prisma/schema.prisma.backup
```

### **Step 2: Add Premium Tables to schema.prisma**

**Location:** After existing models (Warehouse, Product, Customer, Order, etc.)

**Find:** End of your current `schema.prisma` (you probably have Order, Payment, Customer models)

**Add:** Copy ALL content from `PRISMA_SCHEMA_PREMIUM_ACCOUNTS.md` file

The file contains ready-to-use:
- `PremiumServiceType` model
- `PremiumPackage` model
- `PremiumAccount` model
- `PremiumAccountUser` model
- `CustomerPremiumSubscription` model
- `PremiumAccountHealthLog` model
- `PremiumAccountUserHistory` model
- `SubscriptionRenewal` model
- `AccountMigration` model
- `AccountMigrationHistory` model
- Updates to `Order` model

### **Step 3: Update Existing Models**

**Model: Account**
```prisma
model Account {
  // Existing fields...
  
  // Add these relations for premium accounts
  premiumServiceTypes      PremiumServiceType[]
  premiumPackages         PremiumPackage[]
  premiumAccounts         PremiumAccount[]
  premiumAccountUsers     PremiumAccountUser[]
  customerSubscriptions   CustomerPremiumSubscription[]
  healthLogs             PremiumAccountHealthLog[]
  userHistories          PremiumAccountUserHistory[]
  accountMigrations      AccountMigration[]
}
```

**Model: Customer**
```prisma
model Customer {
  // Existing fields...
  
  // Add this relation for premium subscriptions
  premiumSubscriptions    CustomerPremiumSubscription[]
  subscriptionRenewals    SubscriptionRenewal[]
}
```

**Model: Order** - IMPORTANT!
```prisma
model Order {
  // Existing fields...
  
  // NEW: Add these fields after existing fields
  isPremiumAccountOrder     Boolean @default(false)
  premiumSubscriptionId     String?
  isRenewalOrder            Boolean @default(false)
  renewsSubscriptionId      String?
  renewalOrderAmount        Decimal(12,2)?
  isMigrationOrder          Boolean @default(false)
  migrationId               String?
  
  // NEW: Add these relations
  premiumSubscription       CustomerPremiumSubscription? @relation(fields: [premiumSubscriptionId], references: [id])
  renewals                  SubscriptionRenewal[]
  migrations                AccountMigration? @relation(fields: [migrationId], references: [id])
}
```

### **Step 4: Verify Schema Syntax**
```bash
cd d:\GITHUB\managerorder\premium-admin-web

# Check for syntax errors
npx prisma validate
```

### **Step 5: Generate Prisma Client**
```bash
# Generate updated Prisma client
npx prisma generate
```

### **Step 6: Create Migration**
```bash
# Create migration
npx prisma migrate dev --name add_premium_accounts_system

# Enter migration name (e.g., "add_premium_accounts_system")
```

### **Step 7: Verify Database**
```bash
# Open Prisma Studio to verify tables created
npx prisma studio
```

You should see 10 new tables:
- PremiumServiceType
- PremiumPackage
- PremiumAccount
- PremiumAccountUser
- CustomerPremiumSubscription
- PremiumAccountHealthLog
- PremiumAccountUserHistory
- SubscriptionRenewal
- AccountMigration
- AccountMigrationHistory

---

## 🔗 Data Model Integration

Your **Existing Schema:**
```
accounts
  ├─ users
  ├─ warehouses (inventory system)
  ├─ products
  ├─ customers
  ├─ orders
  ├─ payments
  └─ notifications
```

Will become:

Your **New Schema:**
```
accounts
  ├─ users
  ├─ warehouses (inventory system - unchanged)
  ├─ products (unchanged)
  ├─ customers
  │     └─ premiumSubscriptions (NEW!)
  ├─ orders
  │     ├─ premiumSubscription (NEW!)
  │     ├─ renewals (NEW!)
  │     └─ migrations (NEW!)
  ├─ payments (unchanged)
  ├─ notifications (unchanged)
  │
  └─ Premium Accounts System (NEW!):
      ├─ PremiumServiceType (ChatGPT, Duolingo, ...)
      ├─ PremiumPackage (Family, Individual, Group)
      ├─ PremiumAccount (1000+ main accounts)
      ├─ PremiumAccountUser (sub-users, default 5)
      ├─ CustomerPremiumSubscription (who bought)
      ├─ SubscriptionRenewal (renewal + refund)
      ├─ PremiumAccountHealthLog (checks)
      ├─ PremiumAccountUserHistory (audit)
      ├─ AccountMigration (migration)
      └─ AccountMigrationHistory (migration audit)
```

---

## 📊 Migration SQL (If Needed)

If `prisma migrate dev` fails, you can manually create tables:

```sql
-- Tables will be created automatically by Prisma
-- But if needed, prisma shows the exact SQL before applying

prisma migrate resolve --rolled-back add_premium_accounts_system
prisma migrate dev --name add_premium_accounts_system
```

---

## ✅ Post-Implementation Checklist

After integration:

- [ ] Schema validates without errors
- [ ] Prisma client generated successfully
- [ ] All 10 new tables created in database
- [ ] `Order` table updated with new fields
- [ ] `Account` model has new relations
- [ ] `Customer` model has new relations
- [ ] No breaking changes to existing tables
- [ ] Database connection working

---

## 🔍 How to Verify Integration

### **Option 1: Prisma Studio (Visual)**
```bash
npx prisma studio

# Then open browser to see all tables visually
# Try to create test records
```

### **Option 2: Direct Query**
```bash
# In Supabase or your database viewer
SELECT * FROM "PremiumAccount" LIMIT 1;  -- Should be empty initially
SELECT * FROM "PremiumServiceType" LIMIT 1;
```

### **Option 3: Node Script**
```javascript
// Create test file: test-premium.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Test connection to new tables
  const accounts = await prisma.premiumAccount.count();
  console.log(`Premium accounts: ${accounts}`);
  
  const services = await prisma.premiumServiceType.count();
  console.log(`Premium services: ${services}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

// Run: node test-premium.js
```

---

## 🚀 Next: Create API Endpoints

After schema is ready, create API routes:

```
src/app/api/premium/
├─ accounts/
│  ├─ route.ts (GET, POST)
│  └─ [id]/
│     ├─ route.ts (GET, PATCH, DELETE)
│     └─ users/
│        ├─ route.ts (GET, POST)
│        └─ [userId]/route.ts
│
├─ subscriptions/
│  ├─ route.ts (GET, POST)
│  └─ [id]/
│     ├─ route.ts (GET, PATCH)
│     ├─ renew/route.ts (POST)
│     └─ refund/route.ts (POST)
│
└─ health-checks/
   └─ route.ts (GET dust records)
```

---

## 📌 Important Notes

### ⚠️ **Password Encryption Setup**
Before using PREMIUM_ACCOUNTS, setup password encryption:

```typescript
// src/lib/utils/crypto.ts
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "change-me";
const IV_LENGTH = 16;

export function encryptPassword(password: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(password, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decryptPassword(encrypted: string): string {
  const parts = encrypted.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(parts[1], "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
```

Set in `.env.local`:
```
ENCRYPTION_KEY=your-long-random-key-here-at-least-32-characters
```

### ⚠️ **Database Size Expectations**

For 1000 accounts:

```
PremiumAccount:           1,000 rows
PremiumAccountUser:       5,000-10,000 rows (5-10 users per account)
CustomerPremiumSubscription: 4,000-5,000 rows (4-5 customers per account)
PremiumAccountHealthLog:  3,000 rows per month (1 per account per day)

Total:                    ~13,000-23,000 rows initially
Growth:                   ~3,000 logs per month
```

Performance should be excellent with proper indexes.

---

## 🔧 Troubleshooting

### **Issue: Foreign Key Constraint Error**
```
Solution: Check if Account, Customer, Order models exist
Make sure primary keys (id) are defined as String @id @default(cuid())
```

### **Issue: Prisma Generate Fails**
```bash
# Clear cache
rm -rf node_modules/.prisma
npx prisma generate
```

### **Issue: Migration Conflicts**
```bash
# Reset if conflicts
prisma migrate resolve --rolled-back add_premium_accounts_system
prisma migrate dev --name add_premium_accounts_system
```

---

## 📖 Documentation Files

After implementation, you have:

```
d:\GITHUB\managerorder\premium-admin-web\

Documentation:
├─ PREMIUM_ACCOUNTS_SCHEMA_V2_OPTIMIZED.md (Human-readable schema)
├─ PRISMA_SCHEMA_PREMIUM_ACCOUNTS.md (Prisma code)
├─ ✅_FINAL_VERIFICATION_V2.md (Complete requirements check)
├─ PREMIUM_ACCOUNTS_IMPLEMENTATION_GUIDE.md (THIS FILE)

+ Previous version docs (for reference):
├─ PREMIUM_ACCOUNTS_BUSINESS_ANALYSIS.md
├─ PREMIUM_ACCOUNTS_VISUAL_GUIDE.md
└─ ... other reference docs
```

---

## ✅ Implementation Ready!

**You are ready to:**
1. ✅ Add schema
2. ✅ Run migrations
3. ✅ Create API endpoints
4. ✅ Build frontend UI
5. ✅ Launch system

---

**Time to implement:** 30 minutes (database) + 2-3 weeks (API + UI)

Let me know when you're ready! 🚀
