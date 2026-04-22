# 🔌 API Endpoint Examples - Quick Reference

**Status:** Ready for Implementation  
**Date:** March 5, 2026

---

## 📍 File Structure

```
src/app/api/premium/
├─ accounts/
│  ├─ route.ts                    (GET all, POST new)
│  └─ [id]/
│     ├─ route.ts                (GET, PATCH, DELETE)
│     └─ users/
│        ├─ route.ts             (GET all, POST new)
│        └─ [userId]/
│           └─ route.ts          (GET, PATCH, DELETE)
│
├─ subscriptions/
│  ├─ route.ts                    (GET all, POST new)
│  └─ [id]/
│     ├─ route.ts                (GET, PATCH)
│     ├─ renew/route.ts           (POST - ask customer)
│     ├─ confirm-renew/route.ts   (POST - customer confirms)
│     ├─ deny-renew/route.ts      (POST - customer denies)
│     └─ refund/route.ts          (POST - process refund)
│
├─ migrations/
│  ├─ route.ts                    (GET all, POST new)
│  └─ [id]/
│     ├─ route.ts                (GET, PATCH)
│     └─ complete/route.ts        (POST - complete migration)
│
└─ health-checks/
   ├─ route.ts                    (GET recent)
   └─ [accountId]/
      └─ route.ts                (GET history for account)
```

---

## 📌 Example: Premium Accounts API

### **GET /api/premium/accounts**
**List all premium accounts**

```typescript
// route.ts - GET
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  
  const accountId = searchParams.get("accountId");
  const status = searchParams.get("status");
  const serviceTypeId = searchParams.get("serviceTypeId");
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 20;
  
  try {
    const accounts = await prisma.premiumAccount.findMany({
      where: {
        accountId,
        status,
        serviceTypeId,
      },
      include: {
        serviceType: true,
        package: true,
        users: { take: 3 },  // First 3 users
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    });
    
    const total = await prisma.premiumAccount.count({
      where: { accountId, status, serviceTypeId },
    });
    
    return Response.json({
      success: true,
      data: accounts,
      pagination: { page, limit, total },
    });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

### **POST /api/premium/accounts**
**Create new premium account**

```typescript
export async function POST(req: Request) {
  const body = await req.json();
  
  const {
    accountId,
    serviceTypeId,
    packageId,
    primaryEmail,
    primaryPassword,
    joinLink,
    totalSlots,
    billingCycle,
    subscriptionExpiryDate,
  } = body;
  
  try {
    // Encrypt password
    const encryptedPassword = encryptPassword(primaryPassword);
    
    // Create account
    const account = await prisma.premiumAccount.create({
      data: {
        accountId,
        serviceTypeId,
        packageId,
        primaryEmail,
        primaryPasswordEncrypted: encryptedPassword,
        joinLink,
        totalSlots,
        usedSlots: 1,  // Default: 1 for owner
        availableSlots: totalSlots - 1,
        billingCycle,
        subscriptionStartDate: new Date(),
        subscriptionExpiryDate: new Date(subscriptionExpiryDate),
        status: "active",
        connectionStatus: "unknown",
      },
      include: { serviceType: true, package: true },
    });
    
    // Create owner sub-user
    await prisma.premiumAccountUser.create({
      data: {
        premiumAccountId: account.id,
        accountId,
        userEmail: primaryEmail,
        role: "owner",
        status: "active",
        isVerified: true,
      },
    });
    
    return Response.json({ success: true, data: account }, { status: 201 });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
```

---

## 📌 Example: Subscription Management

### **POST /api/premium/subscriptions/[id]/renew**
**Ask customer if they want to renew**

```typescript
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const subscription = await prisma.customerPremiumSubscription.findUnique({
      where: { id: params.id },
      include: { customer: true, order: true },
    });
    
    if (!subscription) {
      return Response.json(
        { success: false, error: "Subscription not found" },
        { status: 404 }
      );
    }
    
    // Calculate new pricing
    const premiumPackage = await prisma.premiumPackage.findUnique({
      where: { id: subscription.premiumAccount.packageId },
    });
    
    const renewalPrice = 
      subscription.originalPrice * premiumPackage.renewalPriceFactor;
    
    // Set renewal as pending
    const updated = await prisma.customerPremiumSubscription.update({
      where: { id: params.id },
      data: {
        renewalStatus: "pending",
        renewalAskedAt: new Date(),
        renewalAskedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        renewalPrice,
      },
    });
    
    // Send email to customer
    await sendRenewalRequestEmail(
      subscription.customer.email,
      renewalPrice,
      updated.renewalAskedUntil
    );
    
    return Response.json({ success: true, data: updated });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

### **POST /api/premium/subscriptions/[id]/confirm-renew**
**Customer confirms renewal**

```typescript
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const subscription = await prisma.customerPremiumSubscription.findUnique({
      where: { id: params.id },
    });
    
    // Update subscription
    const updated = await prisma.customerPremiumSubscription.update({
      where: { id: params.id },
      data: {
        renewalStatus: "confirmed",
        renewalConfirmedAt: new Date(),
      },
    });
    
    // Create renewal record
    const renewal = await prisma.subscriptionRenewal.create({
      data: {
        accountId: subscription.accountId,
        originalSubscriptionId: params.id,
        renewalOrderId, // Generated from Order creation
        customerId: subscription.customerId,
        premiumAccountId: subscription.premiumAccountId,
        renewalRequestedDate: new Date(),
        renewalConfirmedDate: new Date(),
        customerResponse: "accept",
        customerResponseDate: new Date(),
        status: "confirmed",
        renewalPrice: subscription.renewalPrice,
      },
    });
    
    // Process payment (integrate with your payment gateway)
    await chargeCustomer(
      subscription.customerId,
      subscription.renewalPrice
    );
    
    // Update expiry date
    const newExpiryDate = new Date(subscription.expiryDate);
    if (subscription.billingCycle === "1month") newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);
    if (subscription.billingCycle === "3months") newExpiryDate.setMonth(newExpiryDate.getMonth() + 3);
    // etc...
    
    await prisma.customerPremiumSubscription.update({
      where: { id: params.id },
      data: {
        status: "renewed",
        renewalCount: { increment: 1 },
        expiryDate: newExpiryDate,
        nextRenewalDate: null,
      },
    });
    
    // Send confirmation email
    await sendRenewalConfirmationEmail(subscription.customer.email);
    
    return Response.json({ success: true, data: renewal });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

### **POST /api/premium/subscriptions/[id]/deny-renew**
**Customer denies renewal - calculate refund**

```typescript
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { reason } = await req.json();
  
  try {
    const subscription = await prisma.customerPremiumSubscription.findUnique({
      where: { id: params.id },
    });
    
    // Calculate refund (prorated)
    const now = new Date();
    const expiryDate = new Date(subscription.expiryDate);
    const totalDays = (expiryDate.getTime() - subscription.startDate.getTime()) / (1000 * 60 * 60 * 24);
    const remainingDays = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    const refundAmount = (remainingDays / totalDays) * subscription.originalPrice;
    
    // Create renewal record with refund
    const renewal = await prisma.subscriptionRenewal.create({
      data: {
        accountId: subscription.accountId,
        originalSubscriptionId: params.id,
        renewalOrderId, // From canceled order
        customerId: subscription.customerId,
        premiumAccountId: subscription.premiumAccountId,
        renewalRequestedDate: subscription.renewalAskedAt,
        customerResponse: "decline",
        customerResponseDate: new Date(),
        declineReason: reason,
        status: "denied",
        refundCalculated: true,
        refundCalculationMethod: "prorated",
        refundAmount,
      },
    });
    
    // Update subscription
    const updated = await prisma.customerPremiumSubscription.update({
      where: { id: params.id },
      data: {
        renewalStatus: "denied",
        renewalDeniedAt: new Date(),
        renewalDeniedReason: reason,
        status: "expired",
        refundRequested: true,
        refundRequestedAt: new Date(),
        refundAmount: refundAmount,
      },
    });
    
    // Process refund (integrate with payment gateway)
    await refundCustomer(subscription.customerId, refundAmount);
    
    // Send refund confirmation email
    await sendRefundConfirmationEmail(
      subscription.customer.email,
      refundAmount
    );
    
    return Response.json({ success: true, data: renewal });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

## 📌 Example: Account Migration

### **POST /api/premium/migrations**
**Initiate account migration**

```typescript
export async function POST(req: Request) {
  const {
    subscriptionId,
    sourceAccountId,
    targetAccountId,
    reason,
  } = await req.json();
  
  try {
    const subscription = await prisma.customerPremiumSubscription.findUnique({
      where: { id: subscriptionId },
      include: { customer: true, premiumAccountUser: true },
    });
    
    // Create migration record
    const migration = await prisma.accountMigration.create({
      data: {
        accountId: subscription.accountId,
        subscriptionId,
        customerId: subscription.customerId,
        sourceAccountId,
        targetAccountId,
        reason, // "account_expired", "upgrade", etc
        status: "pending",
      },
    });
    
    // Log initial step
    await prisma.accountMigrationHistory.create({
      data: {
        migrationId: migration.id,
        oldStatus: "pending",
        newStatus: "pending",
        action: "initiated",
        details: JSON.stringify({ reason }),
      },
    });
    
    return Response.json(
      { success: true, data: migration },
      { status: 201 }
    );
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

### **POST /api/premium/migrations/[id]/complete**
**Complete migration - move customer to new account**

```typescript
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const migration = await prisma.accountMigration.findUnique({
      where: { id: params.id },
      include: { subscription: true, sourceAccount: true, targetAccount: true },
    });
    
    // 1. Create new sub-user on target account
    const newSubUser = await prisma.premiumAccountUser.create({
      data: {
        premiumAccountId: migration.targetAccountId,
        accountId: migration.accountId,
        userEmail: migration.subscription.premiumAccountUser?.userEmail,
        role: "member",
        status: "active",
      },
    });
    
    // 2. Update subscription to point to new account
    const updatedSubscription = await prisma.customerPremiumSubscription.update({
      where: { id: migration.subscriptionId },
      data: {
        premiumAccountId: migration.targetAccountId,
        premiumAccountUserId: newSubUser.id,
        migratedFromAccountId: migration.sourceAccountId,
        migratedToAccountId: migration.targetAccountId,
        migrationDate: new Date(),
        status: "migrated",
        renewalStatus: "migrated",
      },
    });
    
    // 3. Mark old user as removed
    if (migration.subscription.premiumAccountUserId) {
      await prisma.premiumAccountUser.update({
        where: { id: migration.subscription.premiumAccountUserId },
        data: { status: "removed" },
      });
    }
    
    // 4. Update migration status
    const completedMigration = await prisma.accountMigration.update({
      where: { id: params.id },
      data: {
        status: "completed",
        completedAt: new Date(),
      },
    });
    
    // 5. Log completion
    await prisma.accountMigrationHistory.create({
      data: {
        migrationId: params.id,
        oldStatus: "pending",
        newStatus: "completed",
        action: "migration_completed",
        details: JSON.stringify({
          newSubUserId: newSubUser.id,
          newEmail: newSubUser.userEmail,
        }),
      },
    });
    
    // 6. Send email to customer
    await sendMigrationCompleteEmail(
      migration.subscription.customer.email,
      newSubUser.userEmail,
      migration.targetAccount.joinLink
    );
    
    return Response.json({ success: true, data: completedMigration });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

## 📌 Example: Health Checks (Duolingo)

### **GET /api/premium/health-checks**
**Get recent health checks**

```typescript
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  
  const accountId = searchParams.get("accountId");
  const status = searchParams.get("status");
  const limit = Number(searchParams.get("limit")) || 20;
  
  try {
    const logs = await prisma.premiumAccountHealthLog.findMany({
      where: {
        premiumAccount: { accountId },
        ...(status && { currentStatus: status }),
      },
      include: { premiumAccount: true },
      orderBy: { checkTimestamp: "desc" },
      take: limit,
    });
    
    return Response.json({ success: true, data: logs });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

### **POST /api/premium/health-checks/run**
**Manual health check trigger**

```typescript
export async function POST(req: Request) {
  const { premiumAccountId } = await req.json();
  
  try {
    const account = await prisma.premiumAccount.findUnique({
      where: { id: premiumAccountId },
      include: { serviceType: true },
    });
    
    if (!account.serviceType.supportsConnectionCheck) {
      return Response.json(
        {
          success: false,
          error: "This service does not support automatic health checks",
        },
        { status: 400 }
      );
    }
    
    // Call Duolingo API (example)
    const decryptedPassword = decryptPassword(
      account.primaryPasswordEncrypted
    );
    
    const duolingoResponse = await fetch("https://api.duolingo.com/health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: account.primaryEmail,
        password: decryptedPassword,
      }),
    });
    
    const connectionTest = duolingoResponse.ok;
    
    // Log result
    const log = await prisma.premiumAccountHealthLog.create({
      data: {
        premiumAccountId,
        accountId: account.accountId,
        serviceTypeId: account.serviceTypeId,
        checkTimestamp: new Date(),
        checkType: "manual",
        connectionTest,
        currentStatus: connectionTest ? "connected" : "error",
        checkedBy: "manual",
      },
    });
    
    // Update account status if changed
    if (connectionTest) {
      await prisma.premiumAccount.update({
        where: { id: premiumAccountId },
        data: {
          connectionStatus: "connected",
          lastCheckedAt: new Date(),
        },
      });
    } else {
      await prisma.premiumAccount.update({
        where: { id: premiumAccountId },
        data: {
          connectionStatus: "error",
          lastConnectionError: duolingoResponse.statusText,
          lastCheckedAt: new Date(),
        },
      });
    }
    
    return Response.json({ success: true, data: log });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

## 🎯 Quick Copy-Paste Patterns

### **Pattern 1: Find with Relations**
```typescript
const item = await prisma.premiumAccount.findUnique({
  where: { id },
  include: {
    serviceType: true,
    package: true,
    users: true,
    subscriptions: true,
  },
});
```

### **Pattern 2: Update with Logging**
```typescript
// First get old values for history
const oldData = await prisma.premiumAccountUser.findUnique({
  where: { id },
});

// Update
const updated = await prisma.premiumAccountUser.update({
  where: { id },
  data: { status: "inactive" },
});

// Log change
await prisma.premiumAccountUserHistory.create({
  data: {
    premiumAccountUserId: id,
    premiumAccountId: oldData.premiumAccountId,
    accountId: oldData.accountId,
    actionType: "status_changed",
    oldValue: JSON.stringify({ status: oldData.status }),
    newValue: JSON.stringify({ status: updated.status }),
    performedBy: userId,
  },
});
```

### **Pattern 3: Transaction (Multiple Operations)**
```typescript
const result = await prisma.$transaction(async (tx) => {
  // Step 1
  const sub = await tx.customerPremiumSubscription.update({
    where: { id: subscriptionId },
    data: { renewalStatus: "confirmed" },
  });
  
  // Step 2
  const renewal = await tx.subscriptionRenewal.create({
    data: { /* ... */ },
  });
  
  return { sub, renewal };
});
```

---

**These patterns cover 90% of your API needs!** 

Use them as templates for your endpoints. 🚀
