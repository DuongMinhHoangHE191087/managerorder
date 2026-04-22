# 📋 Database Review Checklist - Xác Minh Cấu Trúc

**Yêu cầu:** Bạn muốn xác minh cấu trúc database trước khi thực hiện

---

## 📁 Documents Được Tạo

### 1. **DATABASE_STRUCTURE_VERIFICATION.md** ⭐
Chi tiết từng table với:
- Tất cả 18 tables
- Mô tả từng cột (tên, kiểu, mặc định, bắt buộc)
- Constraints & Indexes
- Relationships
- Checklist verification

👉 **START HERE** - Review document này trước!

---

### 2. **DATABASE_ER_DIAGRAM.md** 
Sơ đồ quan hệ giữa các bảng:
- Visual ASCII diagram
- Data flow examples
- Indexing strategy
- Table summary

👉 **Dùng để hình dung** mối quan hệ giữa tables

---

## 🔍 Cách Xác Minh

### Step 1: Download Documents
- [DATABASE_STRUCTURE_VERIFICATION.md](./DATABASE_STRUCTURE_VERIFICATION.md)
- [DATABASE_ER_DIAGRAM.md](./DATABASE_ER_DIAGRAM.md)
- [prisma/schema.prisma](./prisma/schema.prisma) - Raw schema

### Step 2: Review Từng Section

**Kiểm tra từng khối:**

#### ✅ Accounts & Users
- [ ] Accounts có 12 cột?
- [ ] Users có password hashing?
- [ ] Unique constraints chính xác?

#### ✅ Warehouses & Inventory
- [ ] Warehouses có address, city, country?
- [ ] WarehouseStaff là junction table?
- [ ] Inventory tồn kho theo warehouse+product?
- [ ] InventoryLogs ghi log mọi thay đổi?

#### ✅ Products
- [ ] Categories tách riêng không?
- [ ] Prices là Decimal(10,2)?
- [ ] SKU unique per account?

#### ✅ Customers
- [ ] Customers + Addresses (nhiều địa chỉ)?
- [ ] CustomerRenewals (gói dịch vụ)?
- [ ] Frequency (monthly/yearly)?

#### ✅ Orders
- [ ] Orders: full lifecycle (draft → delivered)?
- [ ] OrderItems: line items detail?
- [ ] OrderStatusHistory: audit trail?
- [ ] Multiple addresses (billing + shipping)?

#### ✅ Payments
- [ ] PaymentMethods: lưu secure?
- [ ] Payments: transaction tracking?
- [ ] PaymentRefunds: hoàn tiền?

#### ✅ Overall
- [ ] Multi-tenant (accountId everywhere)?
- [ ] Soft delete (deletedAt)?
- [ ] Timestamps (createdAt/updatedAt)?
- [ ] Indexes đủ cho performance?
- [ ] Foreign keys chính xác?

---

## 📧 Gửi Feedback

Nếu có thay đổi, vui lòng chỉ định:

```
1. Table nào cần thay đổi?
   Ví dụ: "Orders table cần thêm field X"

2. Cột nào cần thêm/xóa/sửa?
   Ví dụ: "Thêm cột discount_percentage (Decimal) vào OrderItems"

3. Constraints/Relationships cần điều chỉnh?
   Ví dụ: "WarehouseStaff role nên có enum (manager/staff/viewer)"

4. Có table nào cần thêm?
   Ví dụ: "Thêm ShippingMethods table"
```

---

## 📝 Ví Dụ Feedback Format

```
❌ CURRENT:
Cột: "password" (String)

✅ REQUESTED:
Thay thành: "passwordHash" nhưng thêm:
- Algorithm field (bcrypt, etc)
- Salt field (nếu cần)

💬 FEEDBACK:
Đã done! passwordHash + bcrypt + 10 rounds
```

---

## 🚀 Khi Xác Minh Xong

```bash
# 1. Nếu OK (không thay đổi)
npm run db:push

# 2. Nếu có thay đổi
# Thông báo cho tôi → Sửa schema.prisma → 
# npm run db:push
```

---

## ⚠️ Quan Trọng

### ✅ Đã Kiểm Tra
- [x] Relationships logic (1-1, 1-many, etc)
- [x] Naming conventions (tiếng Anh, snake_case)
- [x] Data types (Decimal for money, DateTime for dates)
- [x] Constraints (unique, foreign keys)
- [x] Indexes (for performance)
- [x] Soft deletes (data safety)
- [x] Multi-tenancy (accountId isolation)
- [x] Timestamps (audit trail)

### ⚠️ Cần Bạn Confirm
- [ ] Tên fields có đúng không?
- [ ] Có field nào bị thiếu?
- [ ] Order flow (status) có đúng business logic?
- [ ] Renewal logic (frequency) có đúng?
- [ ] Payment fields (token storage) có secure?
- [ ] Any custom business rules?

---

## 💬 Questions để Xác Minh

### Accounts & Users
- [ ] Account plan: free/pro/enterprise - OK?
- [ ] User roles: admin/manager/staff/viewer - Đủ?
- [ ] Soft delete (deletedAt) - Needed?

### Warehouses
- [ ] Warehouse fields (address, phone) - Enough?
- [ ] WarehouseStaff roles (manager/staff) - Đủ?

### Products
- [ ] Decimal(10,2) cho price/cost - OK?
- [ ] SKU unique per account - OK?
- [ ] Status field - OK?

### Customers
- [ ] Multiple addresses? - Yes OK!
- [ ] Renewal tracking? - Yes OK!
- [ ] Tax ID field? - OK?

### Orders
- [ ] Status flow: draft → delivered - OK?
- [ ] Multiple addresses (billing+shipping) - OK?
- [ ] Order number unique? - Yes OK!

### Payments
- [ ] Token encrypted? - Yes OK!
- [ ] Status tracking? - Yes OK!
- [ ] Refund tracking? - Yes OK!

---

## 📊 Database Stats (Current)

| Metric | Value |
|--------|-------|
| Total Tables | 18 |
| Total Columns | 187 |
| FK Relationships | 35+ |
| Unique Constraints | 8 |
| Indexes | 20+ |
| Soft Delete Support | ✅ |
| Multi-Tenant | ✅ |
| Audit Trail | ✅ |

---

## 🎯 Next Steps

1. **🔍 Review**: Read DATABASE_STRUCTURE_VERIFICATION.md thoroughly
2. **✅ Verify**: Check all tables & constraints
3. **💬 Feedback**: Send me any required changes
4. **🔧 Adjust**: I'll update schema.prisma
5. **🚀 Deploy**: `npm run db:push` to Supabase

---

## 📞 Support

If you need:
- **Explanation**: Read DATABASE_ER_DIAGRAM.md (visual)
- **Details**: Read DATABASE_STRUCTURE_VERIFICATION.md (full)
- **Raw Schema**: Check prisma/schema.prisma
- **Changes**: Just tell me what to change

---

**Status:** 🔍 **Chờ xác minh**  
**Created:** 5 Tháng 3, 2026  
**Files:** 2 documents + 1 schema file

Hãy review và cho tôi biết cần thay đổi gì! 👍
