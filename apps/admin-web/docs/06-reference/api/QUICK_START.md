# ⚡ Quick Start - Backend Integrated into Premium Admin Web

## What Changed?

Instead of:
```
backend-api/              ← Separate Express server (separate deployment)
premium-admin-web/        ← React/Next.js frontend
```

Now:
```
premium-admin-web/        ← Both frontend + backend (single deployment) ✅
  ├── src/app/api/v1/     ← Backend API routes
  ├── src/lib/            ← Backend services, utilities
  ├── prisma/             ← Database schema
  └── src/app/            ← Frontend pages
```

## Benefits
✅ Single deployment (Vercel, Netlify, etc)  
✅ No separate server to manage  
✅ Easier GitHub setup  
✅ Better local development  
✅ Simpler environment variables  

---

## Installation (5 minutes)

### Step 1: Install Dependencies
```bash
cd d:\GITHUB\managerorder\premium-admin-web
npm install
```

### Step 2: Create Database
- Go to [Supabase](https://supabase.com) or use local PostgreSQL
- Create database: `warehouse_db`
- Copy connection string

### Step 3: Configure Environment
Edit `.env.local`:
```
DATABASE_URL="postgresql://user:password@host:5432/warehouse_db"
JWT_SECRET="your-secret-min-32-chars"
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

### Step 4: Setup Database Tables
```bash
npm run db:generate
npm run db:push
```

### Step 5: Start Server
```bash
npm run dev
```

Visit: **http://localhost:3000**

---

## Test API (Using curl or Postman)

### Register User
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123",
    "firstName": "Admin",
    "lastName": "User",
    "accountName": "My Company"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123"
  }'
```

Response includes: `accessToken`, `refreshToken`, `user`

### Get Current User (Protected)
```bash
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Project Structure

```
premium-admin-web/
│
├── src/
│   ├── lib/                      ← Backend logic
│   │   ├── db/prisma.ts          Database client
│   │   ├── services/auth.ts      Business logic
│   │   ├── utils/                JWT, crypto, errors
│   │   └── types/                TypeScript types
│   │
│   ├── app/
│   │   ├── api/v1/auth/          API routes (backend)
│   │   │   ├── register/
│   │   │   ├── login/
│   │   │   ├── refresh/
│   │   │   └── me/
│   │   │
│   │   └── (pages)               Frontend pages
│   │
│   └── components/               Frontend components
│
├── prisma/
│   └── schema.prisma             Database schema (13 tables)
│
├── package.json                  Updated with backend deps
├── .env.local                    Environment config
└── BACKEND_INTEGRATION.md        Full documentation
```

---

## Available Commands

```bash
# Development
npm run dev              Start dev server

# Building
npm run build            Build for production
npm start                Run production build

# Database
npm run db:generate      Generate Prisma client
npm run db:migrate       Create/run migrations
npm run db:push          Push schema to database
npm run db:studio        Open Prisma Studio

# Code Quality
npm run lint             ESLint check
```

---

## API Endpoints (Phase 1)

| Method | Endpoint | Body | Auth |
|--------|----------|------|------|
| POST | `/api/v1/auth/register` | {email, password, firstName, lastName, accountName} | No |
| POST | `/api/v1/auth/login` | {email, password} | No |
| POST | `/api/v1/auth/refresh` | {refreshToken} | No |
| GET | `/api/v1/auth/me` | - | Yes |

---

## Environment Variables

```env
# Required
DATABASE_URL                 PostgreSQL connection string
JWT_SECRET                  Min 32 characters
NEXT_PUBLIC_API_URL         Base URL (default: http://localhost:3000)

# Optional
DEBUG                       Set to "true" for debug logging
```

---

## Database Details

**13 Tables Ready:**
- accounts, users (authentication)
- warehouses, warehouse_staff (locations)
- products, categories (catalog)
- inventory, inventory_logs (stock tracking)
- customers, customer_addresses, customer_renewals (customers)
- orders, order_items, order_status_history (orders)
- payments, payment_methods, payment_refunds (payments)
- notifications (alerts)

---

## Security Features

✅ Password hashing (bcrypt, 10 rounds)  
✅ JWT token authentication  
✅ Input validation (Zod)  
✅ Error handling (no stack traces in production)  
✅ Multi-tenant account isolation  
✅ Role-based access control (RBAC)  

---

## Deployment

### Vercel (Recommended)
```bash
vercel deploy
```

Set environment variables in Vercel dashboard.

### Other Platforms
Any platform supporting Node.js 20+

---

## Troubleshooting

### Database Connection Error
- Check DATABASE_URL is correct
- PostgreSQL/Supabase server is running
- Database exists and user has permissions

### JWT_SECRET Error
- Must be at least 32 characters
- Check .env.local has value

### Port 3000 Already in Use
```bash
PORT=3001 npm run dev
```

### Need to Reset Database
```bash
npm run db:push --force-reset
```

---

## Next Steps

1. ✅ Setup database
2. ✅ Run `npm run dev`
3. ✅ Test authentication endpoints
4. ✅ Phase 2: Account management
5. ✅ Phase 3+: Advanced features

---

## Support Files

- [BACKEND_INTEGRATION.md](./BACKEND_INTEGRATION.md) - Detailed integration guide
- [prisma/schema.prisma](./prisma/schema.prisma) - Database schema
- [Documentation](./docs/) - Full API documentation

---

**Status: ✅ Ready to deploy!**

Deploy to production with single command. No separate backend server needed. 🚀
