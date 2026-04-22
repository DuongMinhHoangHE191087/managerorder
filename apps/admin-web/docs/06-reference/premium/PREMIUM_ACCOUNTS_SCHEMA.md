# 🗄️ Premium Accounts Database Schema - Detailed Proposal

**Status:** 🔍 **Chờ xác minh**  
**Created:** 5 Tháng 3, 2026  
**Tables:** 8 bảng mới + updates

---

## 📊 Chi Tiết Từng Table

### **1️⃣ PREMIUM_SERVICE_TYPES** - Loại Dịch Vụ
**Lưu các loại dịch vụ premium (YouTube, Spotify, Netflix, ...)**

| Cột | Kiểu | Mặc định | Bắt Buộc | Mô Tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| accountId | String | - | ✅ | Tài khoản seller |
| name | String | - | ✅ | Tên (YouTube Premium, Spotify Premium, Netflix, ...) |
| description | String | NULL | ❌ | Mô tả dịch vụ |
| logoUrl | String | NULL | ❌ | Logo URL |
| website | String | NULL | ❌ | Website của dịch vụ |
| category | String | - | ✅ | Danh mục (streaming, productivity, storage, ...) |
| isActive | Boolean | true | ✅ | Dịch vụ này còn bán không? |
| createdAt | DateTime | now() | ✅ | Ngày tạo |
| updatedAt | DateTime | now() | ✅ | Ngày cập nhật |

**Constraints:**
- `accountId + name` (unique per seller)

**Indexes:**
- `accountId`
- `isActive`

**Ví dụ:**
```json
{
  "id": "svc_yt_premium",
  "accountId": "acct_seller_1",
  "name": "YouTube Premium",
  "description": "Ad-free YouTube with offline downloads",
  "website": "youtube.com",
  "category": "streaming"
}
```

---

### **2️⃣ PREMIUM_PACKAGES** - Mẫu Gói
**Lưu các mẫu gói (Family, Individual, Group, ...)**

| Cột | Kiểu | Mặc định | Bắt Buộc | Mô Tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| accountId | String | - | ✅ | Tài khoản seller |
| serviceTypeId | String | - | ✅ | FK → PREMIUM_SERVICE_TYPES |
| packageType | String | - | ✅ | Loại: individual / family / group / enterprise |
| name | String | - | ✅ | Tên gói (vd: "Spotify Family 6 slots") |
| description | String | NULL | ❌ | Mô tả |
| maxSlots | Int | - | ✅ | Số slots tối đa (1, 6, 10, 50, ...) |
| features | Text | NULL | ❌ | Features (JSON list hoặc text) |
| pricePerSlot | Decimal(10,2) | - | ✅ | Giá mỗi slot |
| renewalPrice | Decimal(10,2) | NULL | ❌ | Giá gia hạn (nếu khác) |
| billingCycle | String | "monthly" | ✅ | Chu kỳ: monthly / quarterly / yearly |
| isActive | Boolean | true | ✅ | Gói còn bán không? |
| createdAt | DateTime | now() | ✅ | Ngày tạo |
| updatedAt | DateTime | now() | ✅ | Ngày cập nhật |

**Constraints:**
- `accountId + serviceTypeId + packageType` (unique)

**Indexes:**
- `accountId`
- `serviceTypeId`
- `isActive`

**Ví dụ:**
```json
{
  "id": "pkg_yt_family",
  "accountId": "acct_seller_1",
  "serviceTypeId": "svc_yt_premium",
  "packageType": "family",
  "maxSlots": 6,
  "pricePerSlot": 5.00,
  "billingCycle": "monthly"
}
```

---

### **3️⃣ PREMIUM_ACCOUNTS** - KHO HÀNG (LƯU TÀI KHOẢN CHÍNH)
**LƯU CÁC TÀI KHOẢN PREMIUM CHÍNH (EMAIL, PASSWORD, LINK JOIN)**

| Cột | Kiểu | Mặc định | Bắt Buộc | Mô Tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| accountId | String | - | ✅ | Tài khoản seller (multi-tenant) |
| serviceTypeId | String | - | ✅ | FK → PREMIUM_SERVICE_TYPES |
| packageId | String | - | ✅ | FK → PREMIUM_PACKAGES |
| primaryEmail | String | - | ✅ | Email tài khoản chính |
| primaryPasswordEncrypted | String | - | ✅ | Mật khẩu (mã hóa, không lưu plain text) |
| joinLink | String | NULL | ❌ | Link join (vd: invite link) |
| totalSlots | Int | - | ✅ | Tổng slots (từ package) |
| usedSlots | Int | 1 | ✅ | Slots đã dùng (default: 1 cho chính chủ) |
| availableSlots | Int | - | ✅ | Slots còn trống = totalSlots - usedSlots |
| subscriptionStartDate | DateTime | now() | ✅ | Ngày bắt đầu gói |
| subscriptionExpiryDate | DateTime | - | ✅ | Ngày hết hạn gói |
| autoRenewal | Boolean | false | ✅ | Tự động gia hạn không? |
| lastRenewalDate | DateTime | NULL | ❌ | Lần cuối gia hạn |
| renewalCount | Int | 0 | ✅ | Số lần gia hạn |
| status | String | "active" | ✅ | active / paused / expired / error / suspended |
| lastCheckedAt | DateTime | NULL | ❌ | Lần cuối check kết nối |
| connectionStatus | String | "unknown" | ✅ | unknown / connected / error / expired / suspicious |
| errorMessage | String | NULL | ❌ | Thông báo lỗi nếu có |
| errorCount | Int | 0 | ✅ | Số lần lỗi liên tiếp |
| notes | Text | NULL | ❌ | Ghi chú |
| createdAt | DateTime | now() | ✅ | Ngày tạo |
| updatedAt | DateTime | now() | ✅ | Ngày cập nhật |
| deletedAt | DateTime | NULL | ❌ | Soft delete |

**Constraints:**
- `primaryEmail` (unique - 1 email chỉ map 1 record)
- `accountId + primaryEmail` (unique)

**Indexes:**
- `accountId` (multi-tenant)
- `status` (frequently queried)
- `connectionStatus`
- `subscriptionExpiryDate` (để check expired)
- `serviceTypeId`

**Relations:**
- accountId → accounts (1:Many)
- serviceTypeId → PREMIUM_SERVICE_TYPES (Many:1)
- packageId → PREMIUM_PACKAGES (Many:1)

---

### **4️⃣ PREMIUM_ACCOUNT_USERS** - SUB-USERS
**LƯU CÁC USER CON TRONG GÓI (EMAIL, PASSWORD NỐI, TRẠNG THÁI)**

| Cột | Kiểu | Mặc định | Bắt Buộc | Mô Tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| premiumAccountId | String | - | ✅ | FK → PREMIUM_ACCOUNTS |
| accountId | String | - | ✅ | Tài khoản seller (denormalized for queries) |
| userEmail | String | - | ✅ | Email sub-user |
| userPasswordEncrypted | String | NULL | ❌ | Mật khẩu (mã hóa, có thể NULL nếu khách tự set) |
| userFullName | String | NULL | ❌ | Tên của sub-user |
| phoneNumber | String | NULL | ❌ | Số điện thoại |
| role | String | "member" | ✅ | owner / member / viewer / manager |
| joinDate | DateTime | now() | ✅ | Ngày join |
| lastActiveDate | DateTime | NULL | ❌ | Lần cuối active |
| lastActiveIP | String | NULL | ❌ | IP cuối cùng sử dụng |
| status | String | "active" | ✅ | active / inactive / paused / removed / suspended |
| verificationCode | String | NULL | ❌ | Code để verify email (nếu cần) |
| verificationCodeExpiry | DateTime | NULL | ❌ | Khi nào code hết hạn |
| isVerified | Boolean | false | ✅ | Email đã verify không? |
| notes | Text | NULL | ❌ | Ghi chú |
| createdAt | DateTime | now() | ✅ | Ngày tạo |
| updatedAt | DateTime | now() | ✅ | Ngày cập nhật |
| deletedAt | DateTime | NULL | ❌ | Soft delete |

**Constraints:**
- `premiumAccountId + userEmail` (unique - Một user chỉ 1 email)

**Indexes:**
- `premiumAccountId`
- `accountId`
- `userEmail`
- `status`
- `isVerified`

**Relations:**
- premiumAccountId → PREMIUM_ACCOUNTS (1:Many)
- accountId → accounts

**Ví dụ:**
```json
{
  "id": "subuser_001",
  "premiumAccountId": "pacc_001",
  "userEmail": "customer@gmail.com",
  "role": "member",
  "status": "active",
  "isVerified": true
}
```

---

### **5️⃣ CUSTOMER_PREMIUM_SUBSCRIPTIONS** - LIÊN KẾT KHÁCH MUA
**LIÊN KẾT KHÁCH HÀNG VỚI TÀI KHOẢN PREMIUM QUY**

| Cột | Kiểu | Mặc định | Bắt Buộc | Mô Tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| customerId | String | - | ✅ | FK → customers (khách hàng) |
| orderId | String | - | ✅ | FK → orders (đơn hàng) |
| accountId | String | - | ✅ | FK → accounts (seller) |
| premiumAccountId | String | - | ✅ | FK → PREMIUM_ACCOUNTS |
| premiumAccountUserId | String | NULL | ❌ | FK → PREMIUM_ACCOUNT_USERS (nếu family/group) |
| purchaseDate | DateTime | now() | ✅ | Ngày mua |
| startDate | DateTime | now() | ✅ | Ngày bắt đầu sử dụng |
| expiryDate | DateTime | - | ✅ | Ngày hết hạn |
| renewalFrequency | String | NULL | ❌ | one-time / monthly / quarterly / yearly / custom |
| autoRenew | Boolean | false | ✅ | Có tự động gia hạn không? |
| lastRenewalDate | DateTime | NULL | ❌ | Lần cuối gia hạn |
| nextRenewalDate | DateTime | NULL | ❌ | Khi nào gia hạn tiếp theo |
| renewalCount | Int | 0 | ✅ | Số lần gia hạn rồi |
| accessMethod | String | "email" | ✅ | Cách access: email / link / phone / code / manual |
| additionalInfo | Text | NULL | ❌ | Thông tin thêm (JSON hoặc text) |
| lastAccessDate | DateTime | NULL | ❌ | Lần cuối khách access |
| lastAccessIP | String | NULL | ❌ | IP cuối cùng |
| status | String | "active" | ✅ | active / paused / expired / cancelled / refunded / suspended |
| failedLoginAttempts | Int | 0 | ✅ | Số lần login fail liên tiếp |
| reasonForCancellation | String | NULL | ❌ | Lý do hủy (nếu cancelled) |
| notes | Text | NULL | ❌ | Ghi chú |
| createdAt | DateTime | now() | ✅ | Ngày tạo |
| updatedAt | DateTime | now() | ✅ | Ngày cập nhật |
| deletedAt | DateTime | NULL | ❌ | Soft delete |

**Constraints:**
- `orderId` (unique - 1 order 1 subscription)

**Indexes:**
- `customerId` (tìm subscriptions của khách)
- `orderId`
- `premiumAccountId` (tìm ai đang dùng account)
- `accountId`
- `status`
- `expiryDate` (check expired)

**Relations:**
- customerId → customers (1:Many)
- orderId → orders (1:1)
- premiumAccountId → PREMIUM_ACCOUNTS (1:Many)
- accountId → accounts
- premiumAccountUserId → PREMIUM_ACCOUNT_USERS

---

### **6️⃣ PREMIUM_ACCOUNT_HEALTH_LOGS** - KIỂM TRA KẾT NỐI
**GHI LOG KIỂM TRA XEM TÀI KHOẢN PREMIUM CÒN HOẠT ĐỘNG KHÔNG**

| Cột | Kiểu | Mặc định | Bắt Buộc | Mô Tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| premiumAccountId | String | - | ✅ | FK → PREMIUM_ACCOUNTS |
| accountId | String | - | ✅ | Tài khoản seller |
| checkTimestamp | DateTime | now() | ✅ | Khi nào check |
| checkType | String | "auto" | ✅ | auto / manual |
| previousStatus | String | NULL | ❌ | Trạng thái trước |
| currentStatus | String | - | ✅ | Trạng thái hiện tại (connected, error, expired, suspended) |
| connectionTest | Boolean | NULL | ❌ | Kết nối có thành công không? |
| responseTime | Int | NULL | ❌ | Thời gian response (ms) |
| subUsersCount | Int | NULL | ❌ | Số lượng active sub-users |
| slotsActuallyUsed | Int | NULL | ❌ | Slots thực tế đang dùng |
| errorCode | String | NULL | ❌ | Mã lỗi (nếu có) |
| errorDetails | Text | NULL | ❌ | Chi tiết lỗi |
| errorMessage | String | NULL | ❌ | Thông báo lỗi human-readable |
| daysUntilExpiry | Int | NULL | ❌ | Bao nhiêu ngày nữa hết hạn |
| checkedBy | String | "system" | ✅ | system / manual_admin / api_call |
| notes | Text | NULL | ❌ | Ghi chú |
| createdAt | DateTime | now() | ✅ | Ngày tạo |

**Indexes:**
- `premiumAccountId`
- `accountId`
- `checkTimestamp DESC` (query gần đây nhất)
- `currentStatus`

**Relations:**
- premiumAccountId → PREMIUM_ACCOUNTS

---

### **7️⃣ PREMIUM_ACCOUNT_USER_HISTORY** - LỊCH SỬ THAY ĐỔI SUB-USERS
**GHI LẠI TẤT CẢ THAY ĐỔI CỦA SUB-USERS (EMAIL, PASSWORD, ROLE, STATUS, ...)**

| Cột | Kiểu | Mặc định | Bắt Buộc | Mô Tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| premiumAccountUserId | String | - | ✅ | FK → PREMIUM_ACCOUNT_USERS |
| premiumAccountId | String | - | ✅ | FK → PREMIUM_ACCOUNTS (denormalize) |
| accountId | String | - | ✅ | FK → accounts (denormalize) |
| actionType | String | - | ✅ | created / activated / deactivated / removed / email_changed / password_reset / role_changed / status_changed / verified / unverified / suspended |
| oldValue | Text | NULL | ❌ | Giá trị cũ (JSON) |
| newValue | Text | NULL | ❌ | Giá trị mới (JSON) |
| performedBy | String | - | ✅ | Ai thực hiện: system / admin_user_id / customer_self |
| performedByType | String | "system" | ✅ | system / admin / customer |
| performedUserEmail | String | NULL | ❌ | Email của người thực hiện (để tracking) |
| reason | String | NULL | ❌ | Lý do thay đổi |
| ipAddress | String | NULL | ❌ | IP address |
| userAgent | String | NULL | ❌ | User agent |
| notes | Text | NULL | ❌ | Ghi chú |
| createdAt | DateTime | now() | ✅ | Ngày tạo |

**Indexes:**
- `premiumAccountUserId`
- `premiumAccountId`
- `accountId`
- `actionType`
- `createdAt DESC`

---

### **8️⃣ SUBSCRIPTION_RENEWALS** - GIA HẠN
**THEO DÕI CÁC ĐƠN GIA HẠN**

| Cột | Kiểu | Mặc định | Bắt Buộc | Mô Tả |
|-----|------|---------|---------|-------|
| id | String (CUID) | Auto | ✅ | ID duy nhất |
| accountId | String | - | ✅ | Tài khoản seller |
| originalSubscriptionId | String | - | ✅ | FK → CUSTOMER_PREMIUM_SUBSCRIPTIONS (subscription cũ) |
| renewalOrderId | String | - | ✅ | FK → orders (đơn hàng gia hạn) |
| premiumAccountId | String | - | ✅ | FK → PREMIUM_ACCOUNTS |
| customerId | String | - | ✅ | FK → customers |
| renewalDate | DateTime | now() | ✅ | Ngày gia hạn |
| newExpiryDate | DateTime | - | ✅ | Hạn mới |
| renewalPeriod | String | - | ✅ | monthly / quarterly / yearly / custom |
| renewalPrice | Decimal(12,2) | - | ✅ | Giá gia hạn |
| discountApplied | Decimal(12,2) | 0 | ✅ | Discount (nếu có) |
| totalPrice | Decimal(12,2) | - | ✅ | Tổng price |
| paymentMethod | String | NULL | ❌ | Phương thức thanh toán |
| status | String | "completed" | ✅ | pending / completed / failed / refunded / cancelled |
| notes | Text | NULL | ❌ | Ghi chú |
| createdAt | DateTime | now() | ✅ | Ngày tạo |
| updatedAt | DateTime | now() | ✅ | Ngày cập nhật |

**Indexes:**
- `originalSubscriptionId`
- `premiumAccountId`
- `customerId`
- `status`

---

## 📋 Updates Cho Existing Tables

### **ORDERS Table (Thêm Columns)**

```prisma
model Order {
  // Existing columns...
  
  // NEW: Premium account fields
  isPremiumAccountOrder    Boolean    @default(false)
  premiumSubscriptionId    String?    // FK → CUSTOMER_PREMIUM_SUBSCRIPTIONS
  
  // NEW: Renewal fields
  isRenewalOrder          Boolean    @default(false)
  renewsSubscriptionId    String?    // FK → CUSTOMER_PREMIUM_SUBSCRIPTIONS (subscription being renewed)
  
  // Relations
  premiumSubscription    CUSTOMER_PREMIUM_SUBSCRIPTIONS? @relation(fields: [premiumSubscriptionId], references: [id])
  // Có thể add thêm relation cho renewals nếu cần
}
```

---

## 🗺️ Diagram: Relationships

```
accounts (seller)
  │
  ├─→ PREMIUM_SERVICE_TYPES (1:Many)
  │     └─→ PREMIUM_PACKAGES (1:Many)
  │           └─→ PREMIUM_ACCOUNTS (1:Many)  ← KHO HÀNG
  │                 ├─→ PREMIUM_ACCOUNT_USERS (1:Many)  ← SUB-USERS
  │                 │     └─→ PREMIUM_ACCOUNT_USER_HISTORY (1:Many)
  │                 │
  │                 ├─→ CUSTOMER_PREMIUM_SUBSCRIPTIONS (1:Many)  ← KHÁCH MUA
  │                 │     ├─→ customers (1:Many)
  │                 │     ├─→ orders (1:1)
  │                 │     └─→ PREMIUM_ACCOUNT_USERS (Many:1, nullable)
  │                 │
  │                 └─→ PREMIUM_ACCOUNT_HEALTH_LOGS (1:Many)  ← KIỂM TRA
  │
  └─→ SUBSCRIPTION_RENEWALS (1:Many)  ← GIA HẠN
        └─→ orders (nhiều renewal orders)

customers
  └─→ CUSTOMER_PREMIUM_SUBSCRIPTIONS (1:Many)
```

---

## ✅ Checklist Xác Minh

### Tables Cần Thêm
- [ ] PREMIUM_SERVICE_TYPES
- [ ] PREMIUM_PACKAGES
- [ ] PREMIUM_ACCOUNTS (KHO HÀNG)
- [ ] PREMIUM_ACCOUNT_USERS (SUB-USERS)
- [ ] CUSTOMER_PREMIUM_SUBSCRIPTIONS (LIÊN KẾT)
- [ ] PREMIUM_ACCOUNT_HEALTH_LOGS (KIỂM TRA)
- [ ] PREMIUM_ACCOUNT_USER_HISTORY (LỊCH SỬ)
- [ ] SUBSCRIPTION_RENEWALS (GIA HẠN)

### Cần Xác Minh
- [ ] Fields có đúng không?
- [ ] Constraints chính xác không?
- [ ] Relationships logic không?
- [ ] Indexes đủ không?
- [ ] Names có phù hợp không?
- [ ] Status values có đủ không?
- [ ] Có field nào thiếu không?

---

**Status:** 🔍 **Chờ xác minh**  
**Next:** Review → Approve → Implement

Hãy review chi tiết từng table và cho feedback nhé! 👍
