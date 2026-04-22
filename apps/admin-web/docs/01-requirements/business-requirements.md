# 📋 BUSINESS REQUIREMENTS - Premium Accounts System

**Version:** 2.0 Final  
**Date:** March 5, 2026  
**Status:** Complete & Approved  

---

## 🎯 MỤC ĐÍCH HỆ THỐNG

**Hệ thống bán tài khoản Premium dùng chung** cho nhiều dịch vụ:
- ChatGPT, Duolingo, Netflix, YouTube Premium, và nhiều dịch vụ khác
- Quản lý **1000+ tài khoản Premium** trong kho
- Bán dạng Family/Group sharing (nhiều người dùng chung 1 account)

---

## 📊 YÊU CẦU NGHIỆP VỤ CHI TIẾT

### **1. QUẢN LÝ DỊCH VỤ (Services)**

#### 1.1. Các dịch vụ hỗ trợ
```
✅ ChatGPT Plus/Team
✅ Duolingo Super
✅ Netflix Premium
✅ YouTube Premium Family
✅ Spotify Family
✅ ... và nhiều dịch vụ khác có thể thêm sau
```

#### 1.2. Thông tin mỗi dịch vụ
```
- Tên dịch vụ
- Logo/hình ảnh
- Danh mục (AI, Learning, Streaming, ...)
- Website
- Hỗ trợ kiểm tra kết nối tự động hay không?
  ├─ Duolingo: CÓ (có API)
  └─ Các dịch vụ khác: KHÔNG (kiểm tra thủ công)
```

---

### **2. QUẢN LÝ GÓI (Packages)**

#### 2.1. Loại gói
```
✅ Individual (1 người dùng)
✅ Family (nhiều người, flexible slots)
✅ Group (nhóm, flexible slots)
```

#### 2.2. Cấu hình slots
```
- Mặc định: 5 slots/account
- Flexible: seller có thể thay đổi từ 1-100 slots/account
- maxSlotsLimit: giới hạn an toàn (do seller quy định khi tạo)
- totalSlots: tổng slots của account (có thể điều chỉnh)
- usedSlots: đang dùng bao nhiêu
- availableSlots: còn trống bao nhiêu (computed)
```

#### 2.3. Chu kỳ thanh toán (Billing Cycles)
```
✅ 1 tháng
✅ 3 tháng
✅ 6 tháng
✅ 1 năm

- Seller chọn chu kỳ nào muốn bán
- Customer chọn chu kỳ khi mua
```

#### 2.4. Giá và chiết khấu gia hạn
```
- pricePerSlot: giá 1 slot
- renewalPriceFactor: hệ số giá gia hạn
  ├─ 1.0 = giá không đổi
  ├─ 0.9 = giảm 10%
  ├─ 1.1 = tăng 10%
  └─ Flexible theo từng gói
```

---

### **3. QUẢN LÝ TÀI KHOẢN PREMIUM (Kho Hàng)**

#### 3.1. Thông tin tài khoản chính
```
✅ primaryEmail: email chính của account
✅ primaryPassword: mật khẩu (MÃ HÓA AES-256)
✅ joinLink: link tham gia (nếu có)
✅ Dịch vụ nào? (ChatGPT, Duolingo, ...)
✅ Gói nào? (Family, Individual, Group)
```

#### 3.2. Quản lý slots
```
✅ totalSlots: tổng slots (flexible, seller set)
✅ usedSlots: đang dùng
✅ availableSlots: còn trống (computed)
```

#### 3.3. Thời hạn subscription
```
✅ subscriptionStartDate: ngày bắt đầu
✅ subscriptionExpiryDate: ngày hết hạn
✅ daysRemaining: còn bao nhiêu ngày (computed)
✅ billingCycle: "1month", "3months", "6months", "1year"
```

#### 3.4. Trạng thái (Status)
```
Account status:
├─ "active" = đang hoạt động
├─ "expiring_soon" = sắp hết hạn (trong 7 ngày)
├─ "expired" = đã hết hạn
├─ "migration_needed" = cần chuyển khách sang account mới
├─ "paused" = seller tạm dừng
├─ "suspended" = vi phạm điều khoản
└─ "deleted" = đã xóa (soft delete)

Connection status:
├─ "unknown" = chưa kiểm tra
├─ "connected" = đang kết nối tốt (Duolingo API check)
├─ "error" = lỗi kết nối
├─ "expired" = account hết hạn
└─ "manual_check_needed" = cần kiểm tra thủ công
```

#### 3.5. Gia hạn
```
✅ autoRenewal: false (default = không tự động)
✅ manualRenewal: true (default = thủ công)
✅ lastRenewalDate: lần gia hạn cuối
✅ renewalCount: đã gia hạn bao nhiêu lần
✅ nextRenewalDate: ngày gia hạn tiếp theo (nếu có)
```

---

### **4. QUẢN LÝ SUB-USERS (Người dùng con)**

#### 4.1. Thông tin sub-user
```
✅ userEmail: email khách hàng cung cấp
✅ userPassword: mật khẩu tự đặt (optional, MÃ HÓA)
✅ userFullName: tên đầy đủ
✅ phoneNumber: số điện thoại
✅ role: "owner", "member", "viewer"
```

#### 4.2. Email tracking (BẢO HÀNH)
```
✅ userEmail: email hiện tại
✅ emailChangeHistory: JSON array lưu lịch sử thay đổi
   [{
     date: "2026-03-05",
     oldEmail: "old@example.com",
     newEmail: "new@example.com",
     reason: "Customer changed",
     changedBy: "customer_self" hoặc admin_id
   }]
✅ lastEmailChangedAt: lần đổi email cuối
✅ lastEmailChangedBy: ai đổi ("self" hoặc admin_id)
```

**LÝ DO:** Để bảo hành khi khách đổi email nhiều lần, seller biết email ban đầu.

#### 4.3. Password tracking
```
✅ userPasswordEncrypted: mật khẩu hiện tại (MÃ HÓA)
✅ passwordChangeCount: đổi mật khẩu bao nhiêu lần
✅ lastPasswordChangedAt: lần đổi cuối
```

#### 4.4. Trạng thái
```
✅ "active" = đang dùng
✅ "inactive" = chưa xác minh
✅ "paused" = seller tạm dừng
✅ "removed" = seller đã kick
✅ "migration_pending" = đang chờ chuyển account
```

---

### **5. QUẢN LÝ ĐƠN MUA (Customer Subscriptions)**

#### 5.1. Thông tin mua hàng
```
✅ customerId: khách hàng nào
✅ orderId: đơn hàng nào
✅ premiumAccountId: account nào
✅ premiumAccountUserId: sub-user nào
✅ purchaseDate: ngày mua
✅ billingCycle: chu kỳ (1m/3m/6m/1y)
✅ cycleMonths: 1, 3, 6, 12 tháng
```

#### 5.2. Thời hạn
```
✅ startDate: ngày bắt đầu
✅ expiryDate: ngày hết hạn
✅ daysRemaining: còn bao nhiêu ngày (computed)
```

#### 5.3. Giá
```
✅ originalPrice: giá ban đầu
✅ renewalPrice: giá gia hạn (nếu khác)
✅ proratedRefundAmount: số tiền hoàn lại (nếu hủy)
```

---

### **6. QUY TRÌNH GIA HẠN (MANUAL RENEWAL)**

#### 6.1. Flow gia hạn
```
BƯỚC 1: Sắp hết hạn (7 ngày trước expiryDate)
  └─ Seller gửi email hỏi khách: "Bạn có muốn gia hạn không?"

BƯỚC 2: Đợi khách trả lời
  ├─ renewalStatus: "none" → "pending"
  ├─ renewalAskedAt: thời gian hỏi
  └─ renewalAskedUntil: deadline trả lời (7 ngày)

BƯỚC 3A: Khách nói CÓ gia hạn
  ├─ renewalStatus: "pending" → "confirmed"
  ├─ renewalConfirmedAt: thời gian confirm
  ├─ Seller tính phí (có thể khác giá ban đầu)
  ├─ Seller charge khách
  ├─ Update expiryDate: +1/3/6/12 tháng
  ├─ Gửi email: "Gia hạn thành công!"
  └─ ✅ HOÀN TẤT

BƯỚC 3B: Khách nói KHÔNG gia hạn
  ├─ renewalStatus: "pending" → "denied"
  ├─ renewalDeniedAt: thời gian từ chối
  ├─ renewalDeniedReason: lý do
  ├─ Tính refund (prorated - xem section 7)
  ├─ Seller hoàn tiền cho khách
  ├─ Seller KICK khách thủ công ra khỏi account
  ├─ Update sub-user status: "removed"
  ├─ Update subscription status: "refunded"
  └─ ✅ HOÀN TẤT
```

#### 6.2. Renewal status
```
✅ "none" = chưa hỏi gia hạn
✅ "pending" = đang hỏi, đợi khách trả lời
✅ "confirmed" = khách đồng ý gia hạn
✅ "denied" = khách từ chối gia hạn
✅ "migrated" = khách chuyển sang account khác
✅ "refunded" = đã hoàn tiền và kick
```

---

### **7. HOÀN TIỀN (REFUND)**

#### 7.1. Công thức tính refund (PRORATED)
```
refund = (remaining_days / total_days) × original_price

Ví dụ:
  - Khách mua gói 1 tháng (30 ngày): $30
  - Khách dùng được 10 ngày
  - Còn lại: 20 ngày
  - Refund = (20 / 30) × $30 = $20
```

#### 7.2. Refund fields
```
✅ refundRequested: true/false
✅ refundRequestedAt: thời gian yêu cầu
✅ refundStatus: "pending", "approved", "rejected", "completed"
✅ refundReason: lý do hoàn tiền
✅ refundAmount: số tiền (computed bằng công thức)
✅ refundCalculationMethod: "prorated", "full", "partial"
✅ refundApprovedAt: thời gian duyệt
✅ refundCompletedAt: thời gian hoàn tiền xong
✅ refundTransactionId: mã giao dịch
```

#### 7.3. Refund workflow
```
1. Khách từ chối gia hạn HOẶC yêu cầu hủy
2. Hệ thống tính refund tự động (công thức prorated)
3. Seller duyệt refund
4. Hệ thống hoàn tiền qua payment gateway
5. Seller kick khách thủ công
6. Update subscription: status = "refunded"
7. Gửi email xác nhận hoàn tiền
```

---

### **8. CHUYỂN ACCOUNT (MIGRATION)**

#### 8.1. Khi nào cần migration?
```
✅ Account chính hết hạn (premiumAccount.subscriptionExpiryDate < today)
  └─ Khách mất kết nối, không dùng được
✅ Seller muốn chuyển khách sang account mới (upgrade/downgrade)
✅ Account gặp lỗi kỹ thuật (technical issue)
```

#### 8.2. Migration workflow
```
BƯỚC 1: Account chính hết hạn
  ├─ premiumAccount.status: "active" → "expired"
  ├─ connectionStatus: "expired"
  └─ Khách nhận thông báo lỗi

BƯỚC 2: Seller tạo account mới
  └─ Seller mua/tạo PREMIUM_ACCOUNT mới

BƯỚC 3: Seller khởi tạo migration
  ├─ sourceAccountId: account cũ
  ├─ targetAccountId: account mới
  ├─ reason: "account_expired"
  └─ status: "pending"

BƯỚC 4: Hệ thống xử lý
  ├─ Tạo sub-user mới trên account mới
  ├─ Copy email khách sang sub-user mới
  ├─ Update subscription: premiumAccountId = account mới
  ├─ Update subscription: status = "migrated"
  ├─ Mark sub-user cũ: status = "removed"
  ├─ Log tất cả vào AccountMigrationHistory
  └─ Gửi email cho khách với access mới

BƯỚC 5: Hoàn tất
  ├─ migration.status: "pending" → "completed"
  ├─ migration.completedAt: timestamp
  └─ ✅ Khách có access mới!
```

#### 8.3. Migration fields
```
✅ sourceAccountId: account cũ
✅ targetAccountId: account mới
✅ sourceUserId: sub-user cũ
✅ targetUserId: sub-user mới
✅ reason: "account_expired", "upgrade", "downgrade", "technical_issue"
✅ status: "pending", "in_progress", "completed", "failed", "rollback"
✅ startedAt: bắt đầu
✅ completedAt: hoàn thành
```

---

### **9. KIỂM TRA KẾT NỐI (CONNECTION CHECK)**

#### 9.1. Dịch vụ nào hỗ trợ?
```
✅ Duolingo: CÓ (có API kiểm tra tự động)
❌ ChatGPT, Netflix, YouTube, ...: KHÔNG (kiểm tra thủ công)
```

#### 9.2. Duolingo connection check (Tự động)
```
- Seller cung cấp Duolingo API endpoint sau
- Hệ thống gọi API mỗi ngày (daily cron job)
- Kiểm tra account còn hoạt động không
- Lưu kết quả vào PremiumAccountHealthLog
- Nếu lỗi: alert seller
```

#### 9.3. Connection check fields
```
✅ supportsConnectionCheck: true/false (ở service type)
✅ connectionCheckType: "api", "manual", "scheduled"
✅ connectionCheckApiUrl: Duolingo API endpoint
✅ lastCheckedAt: lần check cuối
✅ lastConnectionCheckResult: true/false
✅ lastConnectionError: error message
✅ connectionCheckCount: đã check bao nhiêu lần
```

#### 9.4. Health log
```
✅ checkTimestamp: thời gian check
✅ checkType: "auto", "manual", "api"
✅ connectionTest: true/false
✅ currentStatus: "connected", "error", "expired"
✅ errorCode, errorMessage: nếu lỗi
✅ responseTime: milliseconds
```

---

### **10. AUDIT TRAIL (Lịch sử thay đổi)**

#### 10.1. Track tất cả thay đổi
```
✅ Sub-user history:
  ├─ created, email_changed, password_changed
  ├─ verified, status_changed, removed, migrated
  └─ Lưu oldValue, newValue, who, when, why

✅ Migration history:
  ├─ initiated, verified_new_account
  ├─ kicked_old_user, created_new_user
  ├─ setup_new_access, completed
  └─ Lưu từng bước trong migration process
```

#### 10.2. Audit fields
```
✅ actionType: loại hành động
✅ oldValue: giá trị cũ (JSON)
✅ newValue: giá trị mới (JSON)
✅ performedBy: ai thực hiện (user_id, "system", "customer_self")
✅ performedByType: "system", "admin", "customer"
✅ reason: lý do
✅ notes: ghi chú
✅ ipAddress: IP address
✅ createdAt: thời gian
```

---

### **11. BẢO MẬT (SECURITY)**

#### 11.1. Mã hóa
```
✅ Passwords: AES-256 encryption
  ├─ primaryPasswordEncrypted (account chính)
  └─ userPasswordEncrypted (sub-users)

✅ Encryption key: từ environment variable
  └─ ENCRYPTION_KEY (32+ characters)
```

#### 11.2. Soft delete
```
✅ Không xóa thật trong database
✅ Sử dụng deletedAt field (timestamp)
✅ Các query exclude records có deletedAt != null
```

#### 11.3. Multi-tenant
```
✅ accountId ở mọi table
✅ Mỗi seller chỉ thấy data của mình
✅ Isolation hoàn toàn
```

#### 11.4. Role-based access
```
✅ owner: quyền cao nhất
✅ member: người dùng thông thường
✅ viewer: chỉ xem
```

---

### **12. SCALE & PERFORMANCE**

#### 12.1. Quy mô
```
✅ 1000+ PREMIUM_ACCOUNTS
✅ 5,000-10,000 sub-users (5-10/account)
✅ 4,000-5,000 customer subscriptions
✅ 500+ khách hàng đồng thời
✅ 3,000+ health check logs/tháng
```

#### 12.2. Indexing
```
✅ accountId (mọi table)
✅ status (tìm theo trạng thái)
✅ expiryDate (tìm accounts sắp hết hạn)
✅ email (tìm user/customer)
✅ Composite indexes cho queries phức tạp
```

#### 12.3. Performance target
```
✅ Query time: <50ms
✅ Bulk operations: supported
✅ Cron jobs: efficient
✅ Email sending: async
```

---

## 🔄 WORKFLOWS CHÍNH

### **Workflow 1: Khách mua slot** 🛒
```
1. Khách chọn dịch vụ (ChatGPT/Duolingo/...)
2. Khách chọn gói (Family/Individual/Group)
3. Khách chọn chu kỳ (1m/3m/6m/1y)
4. Seller tạo đơn hàng (Order)
5. Seller tạo subscription (CustomerPremiumSubscription)
6. Seller tạo sub-user trên account (PremiumAccountUser)
7. Update slots: usedSlots++
8. Gửi email cho khách với access
9. ✅ HOÀN TẤT
```

### **Workflow 2: Hỏi gia hạn** ❓
```
1. 7 ngày trước expiryDate
2. Seller gửi email hỏi khách
3. Update subscription:
   ├─ renewalStatus: "pending"
   ├─ renewalAskedAt: now
   └─ renewalAskedUntil: now + 7 days
4. Đợi khách trả lời...
```

### **Workflow 3: Khách đồng ý gia hạn** ✅
```
1. renewalStatus: "confirmed"
2. Tính phí (với renewalPriceFactor)
3. Charge khách
4. Update expiryDate (+1/3/6/12 tháng)
5. Create SubscriptionRenewal record
6. Gửi email "Gia hạn thành công!"
7. ✅ HOÀN TẤT
```

### **Workflow 4: Khách từ chối gia hạn** ❌
```
1. renewalStatus: "denied"
2. Tính refund (prorated công thức)
3. Seller duyệt refund
4. Hoàn tiền cho khách
5. Seller kick khách (manual)
6. Update sub-user: status = "removed"
7. Update subscription: status = "refunded"
8. Gửi email xác nhận
9. ✅ HOÀN TẤT
```

### **Workflow 5: Account hết hạn - migration** 🔄
```
1. premiumAccount.subscriptionExpiryDate < today
2. Status: "active" → "expired"
3. Khách nhận lỗi
4. Seller tạo account mới
5. Seller khởi tạo migration
6. Hệ thống tự động:
   ├─ Tạo sub-user mới
   ├─ Move subscription
   ├─ Mark sub-user cũ = "removed"
   └─ Gửi email access mới
7. ✅ HOÀN TẤT
```

### **Workflow 6: Daily health check (Duolingo)** 🔍
```
1. Daily cron at 2:00 AM
2. Find all Duolingo accounts
3. Call Duolingo API per account
4. Log result to PremiumAccountHealthLog
5. Update connectionStatus
6. If error: alert seller
7. ✅ HOÀN TẤT
```

---

## ✅ KẾT LUẬN

**Tổng cộng yêu cầu:**
- ✅ 12 nhóm yêu cầu chính
- ✅ 6 workflows nghiệp vụ
- ✅ 10 database tables
- ✅ 180+ fields
- ✅ Support 1000+ accounts
- ✅ Full audit trail
- ✅ Complete security
- ✅ Scalable design

**File này chứa 100% yêu cầu nghiệp vụ để tránh quên context!**

---

**Next:** Tạo System Design + Supabase SQL Schema
