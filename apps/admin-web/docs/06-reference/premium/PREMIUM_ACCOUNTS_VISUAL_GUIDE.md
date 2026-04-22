# 📊 Premium Accounts System - Visual Overview & Comparison

**Status:** 🔍 **Awaiting Verification**  
**Created:** March 5, 2026

---

## 🎯 So Sánh: Trước vs Sau

### **TRƯỚC: Warehouse & Order Management**
```
accounts → warehouses → inventory → orders
  ↓                                     ↓
  users                            customers
  ↓                                     ↓
  payments                         customer_addresses
```

**Hạn chế:**
- ❌ Không quản lý được tài khoản premium
- ❌ Không track sub-users
- ❌ Không check kết nối tài khoản
- ❌ Không support gia hạn subscriptions

---

### **SAU: Plus Premium Accounts Management**
```
accounts → PREMIUM_SERVICE_TYPES  (YouTube, Spotify, Netflix, ...)
  ↓           ↓
  ├─→ PREMIUM_PACKAGES            (Family: 6 slots, Individual: 1 slot, ...)
  │     ↓
  │     PREMIUM_ACCOUNTS          ← KHO HÀNG (Email, Password, Link Join)
  │       ├─→ PREMIUM_ACCOUNT_USERS     ← SUB-USERS (Email của khách)
  │       │     └→ PREMIUM_ACCOUNT_USER_HISTORY
  │       │
  │       └─→ CUSTOMER_PREMIUM_SUBSCRIPTIONS ← Khách mua
  │             ├─→ orders
  │             ├─→ customers
  │             └─→ SUBSCRIPTION_RENEWALS
  │
  └─→ PREMIUM_ACCOUNT_HEALTH_LOGS ← Check kết nối xem còn active không

+ Existing inventory, payment systems vẫn giữ
```

**Cải tiến:**
- ✅ Quản lý tài khoản premium centralized
- ✅ Track sub-users Chi tiết
- ✅ Check kết nối hàng ngày
- ✅ Support gia hạn tự động
- ✅ Audit trail đầy đủ

---

## 💼 Real-World Example: Spotify Family

### **Scenario:**

Bạn có 1 Spotify Premium Family account:
- **Main Account:** seller@company.com (chủ account)
- **Slots:** 6 người
- **Hạn:** 2026-06-30
- **Giá:** $15/tháng → Bán 5 slots → 5 × $3 = $15 revenue

---

### **Database Entries:**

#### **1. PREMIUM_SERVICE_TYPES**
```json
{
  "id": "svc_spotify_1",
  "accountId": "seller_account_id",
  "name": "Spotify Premium",
  "category": "streaming"
}
```

#### **2. PREMIUM_PACKAGES**
```json
{
  "id": "pkg_spotify_family",
  "serviceTypeId": "svc_spotify_1",
  "packageType": "family",
  "maxSlots": 6,
  "pricePerSlot": 3.00
}
```

#### **3. PREMIUM_ACCOUNTS (KHO HÀNG)**
```json
{
  "id": "pacc_spotify_001",
  "accountId": "seller_account_id",
  "serviceTypeId": "svc_spotify_1",
  "packageId": "pkg_spotify_family",
  "primaryEmail": "seller@company.com",
  "primaryPasswordEncrypted": "****",
  "joinLink": "https://spotify.fi/join/xyz123",
  "totalSlots": 6,
  "usedSlots": 3,          ← 1 chủ + 2 đã bán
  "availableSlots": 3,     ← Còn 3 slots để bán
  "subscriptionExpiryDate": "2026-06-30",
  "status": "active",
  "connectionStatus": "connected",
  "lastCheckedAt": "2026-03-05 10:00:00"
}
```

#### **4. PREMIUM_ACCOUNT_USERS (SUB-USERS)**
```json
[
  {
    "id": "subuser_1",
    "premiumAccountId": "pacc_spotify_001",
    "userEmail": "seller@company.com",
    "role": "owner",
    "status": "active"
  },
  {
    "id": "subuser_2",
    "premiumAccountId": "pacc_spotify_001",
    "userEmail": "customer1@gmail.com",
    "role": "member",
    "status": "active"
  },
  {
    "id": "subuser_3",
    "premiumAccountId": "pacc_spotify_001",
    "userEmail": "customer2@gmail.com",
    "role": "member",
    "status": "active"
  }
]
```

#### **5. CUSTOMER_PREMIUM_SUBSCRIPTIONS (KHÁCH MUA)**
```json
{
  "id": "sub_cust1_spotify",
  "customerId": "cust_001",
  "orderId": "order_001",
  "accountId": "seller_account_id",
  "premiumAccountId": "pacc_spotify_001",
  "premiumAccountUserId": "subuser_2",
  "purchaseDate": "2026-03-01",
  "startDate": "2026-03-01",
  "expiryDate": "2026-06-01",
  "autoRenew": true,
  "renewalFrequency": "monthly",
  "nextRenewalDate": "2026-06-01",
  "status": "active",
  "accessMethod": "email",
  "lastAccessDate": "2026-03-05"
}
```

#### **6. ORDERS (UPDATES)**
```json
{
  "id": "order_001",
  "customerId": "cust_001",
  "orderNumber": "ORD-2026-001",
  "status": "completed",
  "total": 3.00,
  
  // NEW FIELDS:
  "isPremiumAccountOrder": true,
  "premiumSubscriptionId": "sub_cust1_spotify"
}
```

#### **7. PREMIUM_ACCOUNT_HEALTH_LOGS (KIỂM TRA KẾT NỐI)**
```json
{
  "id": "log_1",
  "premiumAccountId": "pacc_spotify_001",
  "checkTimestamp": "2026-03-05 10:00:00",
  "currentStatus": "connected",
  "connectionTest": true,
  "subUsersCount": 3,
  "slotsActuallyUsed": 3,
  "daysUntilExpiry": 88,
  "checkedBy": "system"
}
```

---

## 🔄 Workflows

### **Workflow 1: Khách Mua Premium Account**

```
1. Khách browse → Thấy "Spotify Family - 1 Slot - $3/month"
   ↓
2. Click "BUY" → Tạo Order
   ↓
3. Thanh toán → Order status: completed
   ↓
4. Hệ thống tạo:
   ├─ CUSTOMER_PREMIUM_SUBSCRIPTIONS record
   ├─ PREMIUM_ACCOUNT_USERS (email: customer1@gmail.com)
   ├─ Cập nhật PREMIUM_ACCOUNTS.usedSlots: 2 → 3
   ├─ Cập nhật PREMIUM_ACCOUNTS.availableSlots: 4 → 3
   └─ Gửi email với:
      "Email: customer1@gmail.com
       Link join: https://spotify.fi/join/xyz123
       Password sẽ được set qua email"
   ↓
5. Khách login + setup tài khoản
   ↓
6. LỊCH SỬ được ghi nhận:
   └─ PREMIUM_ACCOUNT_USER_HISTORY record
```

---

### **Workflow 2: Daily Health Check (Tự động)**

```
Cron job chạy lúc 2:00 AM hàng ngày
  ↓
Với mỗi PREMIUM_ACCOUNTS record:
  ├─ Try login với primaryEmail + password
  ├─ Check status (connected? expired? error?)
  ├─ Count active sub-users
  ├─ Check ngày hết hạn
  └─ Ghi nhận vào PREMIUM_ACCOUNT_HEALTH_LOGS
  
Nếu STATUS CHANGED (vd: active → expired):
  ├─ Cập nhật connectionStatus
  ├─ Gửi alert cho seller
  ├─ Set CUSTOMER_PREMIUM_SUBSCRIPTIONS.status → "expired" (nếu cần)
  └─ Notify khách hàng (nếu cấu hình)
```

---

### **Workflow 3: Auto Renewal**

```
Cron job chạy lúc 12:00 PM hàng ngày
  ↓
Với mỗi CUSTOMER_PREMIUM_SUBSCRIPTIONS:
  ├─ Kiểm tra: nextRenewalDate === TODAY?
  ├─ autoRenew === true?
  └─ Nếu yes:
     ├─ Tạo SUBSCRIPTION_RENEWALS record
     ├─ Tạo Order (renewal)
     ├─ Payment (automatic charging)
     ├─ Update expiryDate: TODAY + 30 days
     ├─ nextRenewalDate: TODAY + 30 days
     ├─ Lịch sử được ghi nhận
     └─ Email khách: "Renewal successful!"
     
Nếu payment fail:
  ├─ SUBSCRIPTION_RENEWALS.status: failed
  ├─ Retry sau 3 ngày
  ├─ Sau 3 lần fail: Cancel subscription
  └─ Alert seller
```

---

### **Workflow 4: Premium Account Expiry**

```
Premium account hết hạn: subscriptionExpiryDate = TODAY
  ↓
1. Cập nhật PREMIUM_ACCOUNTS.status: active → expired
2. Cập nhật PREMIUM_ACCOUNTS.connectionStatus: expired
3. Khách không thể access nữa
4. Gửi alert cho seller
5. Options:
   ├─ Renew account (seller mua gói Spotify mới)
   ├─ Refund khách hàng
   └─ Provide alternative account
```

---

## 📈 Data Volume Examples

### **Scenario: Bạn bán 100 gói (YouTube + Spotify + Netflix)**

**Estimated Records:**

| Table | Est. Records | Note |
|-------|---------|------|
| PREMIUM_SERVICE_TYPES | 3 | YouTube, Spotify, Netflix |
| PREMIUM_PACKAGES | 9 | 3 services × 3 types (Individual, Family, Group) |
| PREMIUM_ACCOUNTS | 100 | 100 gói chính |
| PREMIUM_ACCOUNT_USERS | 500 | Trung bình 5 users/account |
| CUSTOMER_PREMIUM_SUBSCRIPTIONS | 400 | Trung bình 4 khách/account |
| PREMIUM_ACCOUNT_HEALTH_LOGS | 3,000 | 100 accounts × 30 days/month |
| PREMIUM_ACCOUNT_USER_HISTORY | 5,000 | Audit trail chi tiết |
| SUBSCRIPTION_RENEWALS | 800 | Renewals trong 1 năm |

**Total: ~10,000 records** - Manageable! ✅

---

## 🔐 Security Considerations

### **Password Storage**

```
✅ DO: Encrypt passwords
❌ DON'T: Store plain text passwords

Use:
- AES-256 encryption (not hashing!)
- Keep encryption key in environment (AWS KMS, Vault, ...)
- Decrypt only when needed

Example:
primaryPasswordEncrypted: "U2FsIHNvbWUgZGF0YQ==" (encrypted)
→ Decrypt when needed to login to service

userPasswordEncrypted: May có hoặc không, tùy access method
```

### **Sub-User Access**

```
Khách có 3 cách để access:
1. Email + Link (password set by Spotify)
   → primaryPasswordEncrypted: NULL (khách set riêng)

2. Email + Password (seller cung cấp)
   → userPasswordEncrypted: "***encrypted***"

3. Magic Link (không cần password)
   → accessMethod: "link"
```

---

## ✅ Verification Checklist

- [ ] Hiểu được 8 tables?
- [ ] Fields hợp lý không?
- [ ] Relationships đúng không?
- [ ] Security measures OK không? (encryption, soft delete, ...)
- [ ] Performance scenarios OK không?
- [ ] Workflows logic không?
- [ ] Có field nào cần thêm/sửa?

---

## 📞 Questions for Clarification

1. **Password Storage:**
   - [ ] Cách lưu mật khẩu premier account chính?
   - [ ] Sub-user password là optional hay bắt buộc?

2. **Access Methods:**
   - [ ] Khách access qua email + password? Hay magic link?
   - [ ] Có cần verify email trước khi access?

3. **Health Checks:**
   - [ ] Cần check mỗi ngày hay mỗi tuần?
   - [ ] Nếu error, auto-retry hay manual?

4. **Auto Renewal:**
   - [ ] Tất cả subscription tự động gia hạn?
   - [ ] Hay chỉ những nào autoRenew = true?
   - [ ] Tối đa bao nhiêu lần gia hạn?

5. **Refunds:**
   - [ ] Nếu account bị expired, hoàn tiền?
   - [ ] Partial refund hay full refund?

6. **Status Transitions:**
   - [ ] Có thể từ expired → active lại không?
   - [ ] Có thể từ cancelled → active lại không?

---

## 🚀 Implementation Roadmap

### **Phase 1: Core Tables (Week 1)**
- [ ] Create 8 tables in Prisma
- [ ] Generate migrations
- [ ] Create indexes
- [ ] Update orders table

### **Phase 2: Backend APIs (Week 2-3)**
- [ ] CRUD endpoints for PREMIUM_ACCOUNTS
- [ ] CRUD for PREMIUM_ACCOUNT_USERS
- [ ] CRUD for CUSTOMER_PREMIUM_SUBSCRIPTIONS
- [ ] Health check logic
- [ ] Renewal logic

### **Phase 3: Frontend (Week 3-4)**
- [ ] Admin dashboard for accounts
- [ ] Manage sub-users UI
- [ ] Health status monitor
- [ ] Manual renewal trigger

### **Phase 4: Automation (Week 4-5)**
- [ ] Health check cron job
- [ ] Auto renewal cron job
- [ ] Expiry notifications
- [ ] Error recovery

---

**Status:** 🔍 **Awaiting Your Verification**

Review both documents:
1. PREMIUM_ACCOUNTS_BUSINESS_ANALYSIS.md (business logic)
2. PREMIUM_ACCOUNTS_SCHEMA.md (technical schema)

Then let me know if any changes needed! ✅
