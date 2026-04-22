# 📊 Premium Accounts Management System - Business Analysis & Database Design

**Ngày:** 5 Tháng 3, 2026  
**Mục đích:** Quản lý bán hàng tài khoản Premium online (YouTube Premium Family, Spotify, Netflix, ...)  
**Status:** 🔍 **Chờ xác minh từ bạn**

---

## 🎯 Business Model Analysis

### Hiểu Về Nghiệp Vụ Của Bạn

**Sản phẩm:** Bán tài khoản Premium online  
**Mô hình:** Tương tự YouTube Premium Family, Spotify Family, Netflix Family  

```
Ví dụ: Bạn mua 1 gói Spotify Family
├── Gói có 6 slots (1 chính + 5 sub-members)
├── Bạn giữ lại 2 slots cho bản thân + gia đình
└── Bán 4 slots cho 4 khách hàng khác nhau
    ├── Khách 1 mua 1 slot → Tài khoản email ABC@gmail.com
    ├── Khách 2 mua 1 slot → Tài khoản email DEF@gmail.com
    ├── Khách 3 mua 1 slot → Tài khoản email GHI@gmail.com
    └── Khách 4 mua 1 slot → Tài khoản email JKL@gmail.com

Theo dõi mỗi slot:
✓ Người dùng (email, password, link join)
✓ Trạng thái (still working, expired, error)
✓ Ngày hết hạn
✓ Khách hàng mua
✓ Đơn hàng
✓ Lịch sử (khi nào hết chế độ, khi nào active, khi nào người dùng thay đổi)
```

---

## 📋 Sơ Đồ Luồng Dữ Liệu

```
Timeline Sử Dụng:

1. Bạn tạo gói Spotify Family
   ↓
2. Quản lý Premium Accounts (kho hàng):
   ├── account_id, email, password, link_join
   ├── total_slots (6), usable_slots (4)
   ├── expiration_date
   └── status (active / expired / error)
   ↓
3. Khách hàng mua slot:
   ├── Đơn hàng được tạo (từ orders table)
   ├── Khách được gán 1 premium account + 1 sub-account
   ├── Đăng ký được tạo (subscription)
   └── Lịch sử được ghi nhận
   ↓
4. Theo dõi kết nối:
   ├── Account còn hoạt động không?
   ├── User account hợp lệ không?
   ├── Bao giờ hết hạn?
   └── Chi tiết ghi nhận
   ↓
5. Khi hết hạn:
   ├── Cập nhật status → "expired"
   ├── Thông báo khách hàng
   ├── Ghi lịch sử
   └── Cung cấp account mới (hoặc hoàn tiền)
```

---

## 🗂️ Các Tables Cần Thiết (Thêm/Sửa)

### **Loại Gói Premium (Thêm mới)**

```
PREMIUM_SERVICE_TYPES (e.g., YouTube Premium, Spotify, Netflix, ...)
├── id
├── accountId (FK)
├── name (YouTube Premium, Spotify Premium, Netflix, ...)
├── description
├── status (active/inactive)
└── createdAt, updatedAt
```

### **Mẫu Gói (Thêm mới)**

```
PREMIUM_PACKAGES (Family, Individual, Group)
├── id
├── accountId (FK)
├── serviceTypeId (FK → PREMIUM_SERVICE_TYPES)
├── packageType (individual, family, group, enterprise)
├── maxSlots (1, 6, 10, 50, ...)
├── features (có OG mode, không ads, download, ...)
├── description
└── status
```

### **Tài Khoản Premium (Kho Hàng) - THÊM MỚI**

```
PREMIUM_ACCOUNTS (Lưu các tài khoản chính)
├── id (CUID)
├── accountId (FK → accounts) ← Tài khoản seller trên hệ thống
├── serviceTypeId (FK → PREMIUM_SERVICE_TYPES)
├── packageTypeId (FK → PREMIUM_PACKAGES)
├── primaryEmail (Email tài khoản chính)
├── primaryPassword (Mã hóa)
├── joinLink (URL/code để join)
├── totalSlots (Tổng slots, vd: 6)
├── usedSlots (Slots đã bán, default: 1 cho chính chủ)
├── availableSlots (Slots còn có = totalSlots - usedSlots)
├── subscriptionStartDate (Ngày bắt đầu gói)
├── subscriptionExpiryDate (Ngày hết hạn gái)
├── autoRenewal (Boolean: tự động gia hạn không?)
├── status (active / paused / expired / error / suspended)
├── lastCheckedAt (Lần cuối check kết nối)
├── connectionStatus (connected / error / expired / suspicious)
├── errorMessage (Nếu có lỗi)
├── notes (Ghi chú)
├── createdAt
├── updatedAt
└── deletedAt (soft delete)

Indexes:
- accountId (multi-tenant)
- status
- subscriptionExpiryDate (để check expired)
- connectionStatus
```

---

### **Sub-Users của Premium Account (Thêm mới)**

```
PREMIUM_ACCOUNT_USERS (Người dùng sub-account trong gói Family/Group)
├── id (CUID)
├── premiumAccountId (FK → PREMIUM_ACCOUNTS)
├── userEmail (Email của sub-user)
├── userPassword (Mã hóa - không bắt buộc, có thể để trống)
├── userFullName (Tên của sub-user)
├── role (owner / member / viewer)
├── joinDate (Ngày tham gia)
├── lastActiveDate (Lần cuối active)
├── status (active / inactive / removed / paused)
├── notes (Ghi chú)
├── createdAt
├── updatedAt
└── deletedAt

Indexes:
- premiumAccountId
- userEmail
- status
```

---

### **Liên Kết Khách Hàng ← → Tài Khoản Premium (THÊM MỚI - QUAN TRỌNG)**

```
CUSTOMER_PREMIUM_SUBSCRIPTIONS (Liên kết khách với tài khoản premium)
├── id (CUID)
├── customerId (FK → customers) ← Khách hàng mua
├── orderId (FK → orders) ← Đơn hàng liên quan
├── accountId (FK → accounts) ← Tài khoản seller
├── premiumAccountId (FK → PREMIUM_ACCOUNTS) ← Tài khoản premium được mua
├── premiumAccountUserId (FK → PREMIUM_ACCOUNT_USERS, nullable) 
│                          ← Sub-user nếu gói Family/Group
├── purchaseDate (Ngày mua)
├── expiryDate (Ngày hết hạn cho khách)
├── autoRenew (Có tự động gia hạn không?)
├── frequency (one-time / monthly / yearly)
├── nextRenewalDate (Nếu auto-renew)
├── status (active / paused / expired / cancelled / refunded)
├── accessMethod (email / link / phone / other)
│              ← Cách để access tài khoản
├── lastAccessDate (Lần cuối khách access)
├── createdAt
├── updatedAt
└── deletedAt

Indexes:
- customerId
- orderId
- premiumAccountId
- status
- expiryDate
```

---

### **Kiểm Tra Kết Nối Premium Account (THÊM MỚI - Verification)**

```
PREMIUM_ACCOUNT_HEALTH_LOGS (Ghi log kiểm tra kết nối)
├── id (CUID)
├── premiumAccountId (FK → PREMIUM_ACCOUNTS)
├── accountId (FK → accounts)
├── checkTimestamp (Khi nào check)
├── previousStatus (Trạng thái trước)
├── currentStatus (Trạng thái hiện tại)
├── connectionTest (Kết nối có hoạt động không? true/false)
├── errorDetails (Chi tiết lỗi nếu có)
├── subUsersCount (Số lượng sub-users vẫn hoạt động)
├── slotsActuallyUsed (Slots thực tế đang sử dụng)
├── checkedBy (Ai check - manual/automated)
├── notes (Ghi chú thêm)
└── createdAt

Indexes:
- premiumAccountId
- checkTimestamp DESC (query gần đây nhất)
- currentStatus
```

---

### **Lịch Sử Thay Đổi Sub-Users (THÊM MỚI - Audit Trail)**

```
PREMIUM_ACCOUNT_USER_HISTORY (Lịch sử thay đổi user)
├── id (CUID)
├── premiumAccountUserId (FK → PREMIUM_ACCOUNT_USERS)
├── premiumAccountId (FK → PREMIUM_ACCOUNTS)
├── actionType (created / activated / deactivated / removed / 
│              email_changed / password_changed / role_changed)
├── oldValue (Giá trị cũ - JSON, vd: {email: "old@gmail.com"})
├── newValue (Giá trị mới - JSON, vd: {email: "new@gmail.com"})
├── performedBy (Ai thực hiện - system / admin / customer_self)
├── reason (Lý do)
├── notes (Ghi chú)
├── createdAt
└── updatedAt

Indexes:
- premiumAccountUserId
- premiumAccountId
- actionType
- createdAt DESC
```

---

### **Liên Kết Với Orders (SỬA EXISTING)**

```
Thêm vào table ORDERS:
├── isPremiumAccountOrder (Boolean, default: false)
├── premiumSubscriptionId (FK → CUSTOMER_PREMIUM_SUBSCRIPTIONS, nullable)
├── renewalOrder (Boolean: đây là đơn gia hạn không? default: false)
└── renewsSubscriptionId (FK → CUSTOMER_PREMIUM_SUBSCRIPTIONS, nullable)
                          ← Subscription nào được gia hạn?

Hoặc tạo table:

SUBSCRIPTION_RENEWALS (Gia hạn đơn)
├── id (CUID)
├── originalSubscriptionId (FK)
├── renewalOrderId (FK → orders)
├── renewalDate (Khi nào gia hạn)
├── newExpiryDate (Hạn mới)
├── status (pending / completed / failed / cancelled)
├── createdAt, updatedAt
```

---

## 🔗 Các Quan Hệ (Relationships)

```
accounts (Seller)
  ↓ (1 → Many)
  └→ PREMIUM_ACCOUNTS (Các gói premium bán)
      ↓ (1 → Many)
      ├→ PREMIUM_ACCOUNT_USERS (Sub-users)
      │   ↓ (1 → Many)
      │   └→ PREMIUM_ACCOUNT_USER_HISTORY (Lịch sử)
      │
      ├→ CUSTOMER_PREMIUM_SUBSCRIPTIONS (Khách mua)
      │   ↓
      │   ├→ customers (kết nối đến khách)
      │   ├→ orders (đơn hàng)
      │   └→ PREMIUM_ACCOUNT_USERS (sub-user nếu family)
      │
      └→ PREMIUM_ACCOUNT_HEALTH_LOGS (Kiểm tra kết nối)
```

---

## 📊 Ví Dụ Thực Tế Data

### **Scenario: Bị bán Spotify Premium Family**

#### 1. Tạo Gói Spotify (PREMIUM_SERVICE_TYPES)
```json
{
  "id": "svc_spotify_123",
  "name": "Spotify Premium",
  "description": "Spotify Premium Service"
}
```

#### 2. Tạo Mẫu Family (PREMIUM_PACKAGES)
```json
{
  "id": "pkg_spotify_family",
  "serviceTypeId": "svc_spotify_123",
  "packageType": "family",
  "maxSlots": 6
}
```

#### 3. Mục Gói Spotify (PREMIUM_ACCOUNTS)
```json
{
  "id": "acc_spotify_001",
  "accountId": "acct_seller_123",      ← Của seller
  "serviceTypeId": "svc_spotify_123",
  "packageTypeId": "pkg_spotify_family",
  "primaryEmail": "my-spotify@gmail.com",
  "primaryPassword": "**ENCRYPTED**",
  "joinLink": "https://spotify-family-link/xyz",
  "totalSlots": 6,
  "usedSlots": 3,                     ← 1 chính chủ + 2 đã bán
  "availableSlots": 3,                ← 3 còn lại để bán
  "subscriptionExpiryDate": "2025-06-30",
  "status": "active",
  "lastCheckedAt": "2026-03-05 10:00",
  "connectionStatus": "connected"
}
```

#### 4. Sub-Users (PREMIUM_ACCOUNT_USERS)
```json
[
  {
    "id": "subuser_001",
    "premiumAccountId": "acc_spotify_001",
    "userEmail": "me@email.com",
    "role": "owner",
    "status": "active"
  },
  {
    "id": "subuser_002",
    "premiumAccountId": "acc_spotify_001",
    "userEmail": "customer1@email.com",
    "userPassword": "**ENCRYPTED**",
    "role": "member",
    "status": "active"
  },
  {
    "id": "subuser_003",
    "premiumAccountId": "acc_spotify_001",
    "userEmail": "customer2@email.com",
    "userPassword": "**ENCRYPTED**",
    "role": "member",
    "status": "active"
  }
]
```

#### 5. Khách Mua (CUSTOMER_PREMIUM_SUBSCRIPTIONS)
```json
{
  "id": "sub_001",
  "customerId": "cust_001",
  "orderId": "order_001",
  "accountId": "acct_seller_123",
  "premiumAccountId": "acc_spotify_001",
  "premiumAccountUserId": "subuser_002",
  "purchaseDate": "2026-03-01",
  "expiryDate": "2026-06-01",
  "autoRenew": true,
  "nextRenewalDate": "2026-06-01",
  "status": "active",
  "accessMethod": "email",          ← Khách biết email/password
  "lastAccessDate": "2026-03-05"
}
```

#### 6. Kiểm Tra Kết Nối (PREMIUM_ACCOUNT_HEALTH_LOGS)
```json
{
  "id": "log_001",
  "premiumAccountId": "acc_spotify_001",
  "checkTimestamp": "2026-03-05 10:00",
  "previousStatus": "connected",
  "currentStatus": "connected",
  "connectionTest": true,
  "subUsersCount": 3,
  "slotsActuallyUsed": 3,
  "checkedBy": "automated"
}
```

---

## 🔄 Workflow Kinh Doanh

### **Quy Trình 1: Khách Mua Premium Account**

```
1. Khách ghé cửa hàng, xem gói Spotify Family
2. Khách click "Mua" → Tạo Order
3. Order được tạo với:
   - premiumAccountId: acc_spotify_001
   - Giá: $5/tháng
4. Thanh toán th nó
5. Hệ thống tạo:
   - CUSTOMER_PREMIUM_SUBSCRIPTIONS record
   - Tạo sub-user: customer1@email.com
   - Gửi email với email/password/link
6. Khách login vào tài khoản
7. Lịch sử được ghi nhận
```

### **Quy Trình 2: Kiểm Tra Kết Nối Hàng Ngày**

```
1. Cron job chạy mỗi 12 giờ
2. Check từng PREMIUM_ACCOUNT:
   - Thử login
   - Kiểm tra còn slots không
   - Check ngày hết hạn
3. Ghi nhận vào PREMIUM_ACCOUNT_HEALTH_LOGS
4. Nếu error:
   - Cập nhật status
   - Alert seller
   - Notify khách hàng nếu cần
```

### **Quy Trình 3: Gia Hạn Đơn Hàng**

```
1. CUSTOMER_PREMIUM_SUBSCRIPTIONS expiry sắp đến
2. autoRenew = true → Thực hiện gia hạn
3. Tạo order lạ (SUBSCRIPTION_RENEWALS)
4. Cộng tiền vào invoice
5. Update expiryDate
6. Ghi lịch sử
```

### **Quy Trình 4: Premium Account Hết Hạn**

```
1. subscriptionExpiryDate đến
2. PREMIUM_ACCOUNTS status: active → expired
3. Khách hàng bị downgrade
4. Alert seller để renew
5. Tùy chọn:
   - Hoàn tiền khách
   - Chờ seller renew rồi update lại
```

---

## 💾 Summary: Tables Cần Thêm/Sửa

### **Tables Mới (Cần Thêm)**
```
1. PREMIUM_SERVICE_TYPES           ← Types (YouTube, Spotify, Netflix, ...)
2. PREMIUM_PACKAGES               ← Mẫu (Family, Individual, Group)
3. PREMIUM_ACCOUNTS               ← Kho hàng (các tài khoản premium)
4. PREMIUM_ACCOUNT_USERS          ← Sub-users trong gói
5. CUSTOMER_PREMIUM_SUBSCRIPTIONS ← Liên kết khách mua
6. PREMIUM_ACCOUNT_HEALTH_LOGS    ← Check kết nối
7. PREMIUM_ACCOUNT_USER_HISTORY   ← Lịch sử thay đổi
8. SUBSCRIPTION_RENEWALS          ← Gia hạn (nếu complex)
```

### **Tables Hiện Có (Cần Sửa)**
```
orders:
  + isPremiumAccountOrder
  + premiumSubscriptionId
  + renewalOrder
  + renewsSubscriptionId

Có thể thêm vào lúc implement
```

---

## ⚠️ Câu Hỏi Để Xác Minh

1. **Số Lượng Gói Gia Hạn:**
   - [ ] Bạn có bao nhiêu gói chia sẻ? (5 gói, 10 gói, 100 gói?)
   - [ ] Hỗ trợ bao nhiêu loại dịch vụ? (Spotify + YouTube + Netflix, hay cụ thể?)

2. **Khoảng Thời Gian:**
   - [ ] Gói thường hạn bao lâu? (1 tháng, 3 tháng, 1 năm?)
   - [ ] Cho phép auto-renew không?
   - [ ] Có phí renew khác với phí mua đầu không?

3. **Gói Loại:**
   - [ ] Chỉ có Family, Individual, Group hay thêm loại khác?
   - [ ] Family có cố định 6 slots hay flexible?
   - [ ] Group bao nhiêu slots tối đa?

4. **Kiểm Tra Kết Nối:**
   - [ ] Bao giờ cần check? (Hàng ngày, tuần, tháng?)
   - [ ] Cách check? (Tự động login hoặc manual?)
   - [ ] Khi error, xử lý thế nào?

5. **Sub-Users:**
   - [ ] Khách có được thay đổi password không?
   - [ ] Khách có được thay email không?
   - [ ] Có role khác ngoài owner/member?

6. **Gia Hạn:**
   - [ ] Tự động gia hạn hay cần khách click lại?
   - [ ] Thuê bao hết hạn hôm nước có downgrade không?
   - [ ] Nếu account chính hết hạn, khách bị mất kết nối không?

7. **Hoàn Tiền:**
   - [ ] Nếu account bị lỗi, hoàn tiền cho khách không?
   - [ ] Nếu khách cancel, hoàn tiền không?
   - [ ] Refund policy?

---

## 🎯 Next Steps

1. **Xác minh** các loại gói
2. **Xác minh** business logic (auto-renew, refund, etc.)
3. **Approve** schema
4. **Implement** tables
5. **Tạo API** để manage

---

**Status:** 🔍 **Chờ xác minh business logic**  
**Prepared:** 8 tables mới + updates  
**Ready:** Khi bạn confirm

Hãy review và trả lời các câu hỏi trên nhé! 🙏
