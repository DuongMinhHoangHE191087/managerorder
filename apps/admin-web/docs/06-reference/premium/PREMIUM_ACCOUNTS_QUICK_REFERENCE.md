# 🎯 Premium Accounts System - Quick Reference Card

**Date:** March 5, 2026  
**Status:** 🔍 **Ready for Verification**

---

## 📚 4 Documents Created

| Document | Purpose | Time | Start? |
|----------|---------|------|--------|
| **PREMIUM_ACCOUNTS_BUSINESS_ANALYSIS.md** | Understand business model & workflows | 15 min | ✅ Start here |
| **PREMIUM_ACCOUNTS_SCHEMA.md** | Detailed technical schema (8 tables) | 30 min | 2️⃣ Then this |
| **PREMIUM_ACCOUNTS_VISUAL_GUIDE.md** | Real-world examples & workflows | 15 min | 3️⃣ Visual check |
| **PREMIUM_ACCOUNTS_SUMMARY.md** | Review guide & next steps | 10 min | 4️⃣ Final summary |

---

## 🗂️ 8 Tables at a Glance

```
1. PREMIUM_SERVICE_TYPES          (YouTube, Spotify, Netflix, ...)
   └─→ id, name, category, isActive

2. PREMIUM_PACKAGES               (Individual, Family, Group)
   └─→ id, packageType, maxSlots, pricePerSlot

3. PREMIUM_ACCOUNTS               ← KHO HÀNG (Main accounts!)
   └─→ primaryEmail, password, slots, status, joinLink

4. PREMIUM_ACCOUNT_USERS          ← SUB-USERS
   └─→ userEmail, role, status, isVerified

5. CUSTOMER_PREMIUM_SUBSCRIPTIONS ← KHÁCH MUA
   └─→ customerId, premiumAccountId, expiryDate, status

6. PREMIUM_ACCOUNT_HEALTH_LOGS    ← KIỂM TRA KẾT NỐI
   └─→ connectionStatus, connectionTest, errorMessage

7. PREMIUM_ACCOUNT_USER_HISTORY   ← LỊCH SỬ
   └─→ actionType, oldValue, newValue, performedBy

8. SUBSCRIPTION_RENEWALS          ← GIA HẠN
   └─→ renewalDate, newExpiryDate, status
```

---

## ⚡ Key Design Points

### **Multi-Tenant Support**
```
accounts (seller) → PREMIUM_ACCOUNTS, PREMIUM_ACCOUNT_USERS, etc.
Each seller has isolated premium accounts
```

### **Slot Management**
```
PREMIUM_ACCOUNTS
├─ totalSlots: 6 (from package)
├─ usedSlots: 3 (1 owner + 2 customers)
└─ availableSlots: 3 (calculated)
```

### **Status Tracking (Dual)**
```
PREMIUM_ACCOUNTS
├─ status:               active / expired / paused / error / suspended
│                        ← Business status
│
└─ connectionStatus:     connected / error / expired / suspicious
                         ← Technical healthcheck
```

### **Complete Audit Trail**
```
PREMIUM_ACCOUNT_USER_HISTORY logs ALL changes:
- User created
- Email changed
- Password reset
- Role changed
- Status changed
- ... with WHO, WHEN, WHY
```

---

## 🔄 3 Main Workflows

### **Workflow 1: Customer Purchase**
```
Customer buys Spotify slot
  ↓
Create CUSTOMER_PREMIUM_SUBSCRIPTIONS
  ↓
Create PREMIUM_ACCOUNT_USERS (sub-user with customer's email)
  ↓
Update PREMIUM_ACCOUNTS slots (3 → 4)
  ↓
Send email with access info
  ↓
Log in PREMIUM_ACCOUNT_USER_HISTORY
```

### **Workflow 2: Daily Health Check (Automated)**
```
Cron job (every 12 hours)
  ↓
For each PREMIUM_ACCOUNT:
  ├─ Try login
  ├─ Check status
  ├─ Count active users
  └─ Log to PREMIUM_ACCOUNT_HEALTH_LOGS
  
If status changed:
  ├─ Alert seller
  ├─ Update subscriptions
  └─ Notify customers (if needed)
```

### **Workflow 3: Auto Renewal (Automated)**
```
Cron job (daily)
  ↓
Check: CUSTOMER_PREMIUM_SUBSCRIPTIONS nextRenewalDate = TODAY?
  ↓
If autoRenew = true:
  ├─ Charge customer
  ├─ Create renewal order
  ├─ Update expiryDate
  ├─ Log to SUBSCRIPTION_RENEWALS
  └─ Send confirmation email
```

---

## ✅ What To Verify

### **Business Logic**
- [ ] Understand selling premium accounts?
- [ ] Understand slot sharing (Family plan)?
- [ ] Understand auto-renewal?
- [ ] Workflows make sense?

### **Fields/Constraints**
- [ ] All fields necessary?
- [ ] Constraints correct?
- [ ] Indexes sufficient?
- [ ] Any fields missing?

### **Security**
- [ ] Password encryption OK?
- [ ] Access control clear?
- [ ] Audit trail sufficient?

---

## 📊 Example: Spotify Plan

```
SCENARIO: Selling Spotify Family (6 slots)

1. Create in PREMIUM_SERVICE_TYPES:
   ├─ id: svc_spotify
   └─ name: Spotify Premium

2. Create in PREMIUM_PACKAGES:
   ├─ packageType: family
   ├─ maxSlots: 6
   └─ pricePerSlot: $3/month

3. Add to PREMIUM_ACCOUNTS:
   ├─ primaryEmail: seller@company.com
   ├─ primaryPassword: ***encrypted***
   ├─ joinLink: https://spotify.com/join/xyz
   ├─ totalSlots: 6
   ├─ usedSlots: 3    (1 owner + 2 sold)
   ├─ availableSlots: 3
   └─ status: active

4. Sub-users in PREMIUM_ACCOUNT_USERS:
   ├─ Owner: seller@company.com (role: owner)
   ├─ Customer1: customer1@gmail.com (role: member)
   └─ Customer2: customer2@gmail.com (role: member)

5. Customer purchases in CUSTOMER_PREMIUM_SUBSCRIPTIONS:
   ├─ customerId: cust_001
   ├─ premiumAccountId: acc_spotify_001
   ├─ premiumAccountUserId: customer1_subuser
   ├─ expiryDate: 2026-06-01
   ├─ autoRenew: true
   └─ status: active

6. Daily check in PREMIUM_ACCOUNT_HEALTH_LOGS:
   ├─ connectionStatus: connected
   ├─ connectionTest: true
   ├─ subUsersCount: 3
   └─ daysUntilExpiry: 88

7. History in PREMIUM_ACCOUNT_USER_HISTORY:
   └─ Records: created, activated, ...
```

---

## 🎯 Quick Review Checklist

**5-Min Check:**
- [ ] Read PREMIUM_ACCOUNTS_SUMMARY.md
- [ ] Understand 8 tables
- [ ] OK so far?

**20-Min Deep Dive:**
- [ ] Read all schema details
- [ ] Check each field/constraint
- [ ] Identify any issues

**10-Min Scenario Walk:**
- [ ] Review Spotify example
- [ ] Trace through workflow
- [ ] Makes sense?

**Total: 35-45 minutes for thorough review**

---

## 💬 Common Feedback

### **Adding a Field:**
```json
{
  "table": "PREMIUM_ACCOUNTS",
  "action": "add_field",
  "field": "maxUsers",
  "type": "Int",
  "default": 6,
  "reason": "Track maximum concurrent users"
}
```

### **Changing Default:**
```json
{
  "table": "CUSTOMER_PREMIUM_SUBSCRIPTIONS",
  "field": "autoRenew",
  "old_default": "false",
  "new_default": "true",
  "reason": "Most customers want auto-renew"
}
```

### **Adding Constraint:**
```json
{
  "table": "PREMIUM_ACCOUNTS",
  "action": "add_constraint",
  "constraint": "unique(accountId, primaryEmail)",
  "reason": "Ensure no duplicate emails per seller"
}
```

---

## 🚀 Approval Path

```
Today:
├─ You review 4 documents
├─ Ask clarifying questions (if any)
└─ Approve final design

Tomorrow:
├─ I implement 8 tables in Prisma
├─ Generate migrations
└─ Create database

Week 1:
├─ Create API endpoints
├─ Build backend logic
└─ Health check crons

Week 2:
├─ Frontend dashboard
├─ Subscription management UI
└─ Testing

Week 3:
└─ Go live!
```

---

## 📞 Support Resources

**If question about:**

| Topic | See | Section |
|-------|-----|---------|
| Business model | BUSINESS_ANALYSIS | "Business Model Analysis" |
| Database fields | SCHEMA | Each table section |
| Real example | VISUAL_GUIDE | "Real-World Example" |
| Implementation | SUMMARY | "Next Steps" |
| Workflows | VISUAL_GUIDE | "Workflows" |

---

## ⚡ Key Numbers

```
Tables:        8 (new) + 1 (updated)
Total Fields:  ~120 columns
Relationships: 15+ foreign keys
Indexes:       20+
Constraints:   10+ unique/composite
```

---

## 🎓 Important Concepts

### **Soft Delete**
```
Record not actually deleted, just marked deleted
✓ Never lose data
✓ Easy recovery
✓ Full audit trail
```

### **Encryption**
```
Passwords are encrypted (AES-256)
✓ Never stored as plain text
✓ Key kept safe
✓ Decrypt only when needed
```

### **Audit Trail**
```
PREMIUM_ACCOUNT_USER_HISTORY tracks ALL changes
✓ Who made change
✓ What changed
✓ When changed
✓ Why changed
```

### **Status Dual-Tracking**
```
Business status (status) vs Technical status (connectionStatus)
✓ Track business decisions independently
✓ Track system health independently
✓ Can have different states simultaneously
```

---

## ✨ Ready?

### **Next Step:**
```
Open: PREMIUM_ACCOUNTS_BUSINESS_ANALYSIS.md
Read: Full document
Answer: Does business logic make sense?
```

### **Then:**
```
Open: PREMIUM_ACCOUNTS_SCHEMA.md
Review: Each table
Check: Fields accurate?
```

### **Finally:**
```
Open: PREMIUM_ACCOUNTS_VISUAL_GUIDE.md
Trace: Example workflows
Verify: System design sound?
```

### **Result:**
```
Send Feedback:
├─ "✅ All good!" (if approved)
└─ "Need changes: ..." (if modifications needed)
```

---

## 🎯 Your Decision

**After reviewing 4 documents, you decide:**

✅ **APPROVE:**
```
"✅ Premium accounts database design approved!
   Ready to implement."
```

⚠️ **MODIFY:**
```
"⚠️ Need 3 changes:
   1. Add maxConcurrentUsers field
   2. Change autoRenew default to true
   3. ..."
```

❓ **CLARIFY:**
```
"❓ Questions before approval:
   1. How to handle partial refunds?
   2. ..."
```

---

**Status:** 🔍 **Waiting for Your Review**

**Time Needed:** 30-45 minutes  
**Effort:** Medium (careful reading)  
**Importance:** High (foundation for premium business)

👉 **Ready to start? Open PREMIUM_ACCOUNTS_BUSINESS_ANALYSIS.md now!** ✅

---

*All documents in: d:\GITHUB\managerorder\premium-admin-web\*
