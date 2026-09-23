# 🐔 PoultryDex

> Modern, Multi-Tenant SaaS Platform for Poultry & Layer Farm Operations (Mobile App + REST API Backend)

---

## 🏗 System Architecture

PoultryDex is organized as a production-grade TypeScript monorepo using npm workspaces:

```
├── apps/
│   ├── api/             # Express.js REST API with Mongoose, Zod & JWT Auth
│   └── mobile/          # Expo React Native App (iOS & Android)
├── packages/
│   ├── types/           # Shared TypeScript interfaces & models
│   └── validation/      # Shared Zod validation schemas
├── api/
│   └── index.ts         # Vercel serverless entry proxy
├── vercel.json          # Root Vercel deployment configuration
└── package.json         # Monorepo workspaces manifest
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** >= 18.x
- **npm** >= 9.x
- **MongoDB** (local or MongoDB Atlas connection)

### Installation
```bash
# Clone the repository
git clone https://github.com/Utsho11/poultry-ops.git
cd poultry-ops

# Install all monorepo dependencies
npm install

# Build shared packages
npm run build:packages
```

### Development

```bash
# Run shared packages build + API server in watch mode
npm run dev

# Or run API server separately
npm run dev:api

# Run Mobile application
cd apps/mobile
npm run start
```

### Database Seeding
```bash
# Seed initial test data (Owner & Worker accounts, flocks, logs, sales)
npm run seed:api
```

Default seeded credentials:
- **Owner**: `test@farm.com` / `password123` (Phone: `01700000000`)
- **Worker**: `worker@farm.com` / `password123` (Phone: `01800000000`)

---

## 🔐 Environment Variables

### Backend API (`apps/api/.env` or Vercel Environment Variables)

| Variable | Required in Production | Description | Default / Example |
| :--- | :---: | :--- | :--- |
| `PORT` | No | Local server listening port | `4000` |
| `NODE_ENV` | Yes | Runtime environment | `production` |
| `MONGODB_URI` | **Yes** | MongoDB connection string (Atlas recommended) | `mongodb+srv://...` |
| `JWT_SECRET` | **Yes** | 64+ char secret key for signing auth tokens | `super_secret_key` |
| `CORS_ORIGINS` | No | Comma-separated list of allowed web origins | `https://poultrydex.vercel.app` |

---

## 🌐 Deployment Guide

### Backend Deployment (Vercel)
The repository is pre-configured for automated Vercel serverless deployment from the root directory.

1. Import the Git repository in your [Vercel Dashboard](https://vercel.com).
2. Configure **Environment Variables**:
   - `MONGODB_URI`: Your MongoDB Atlas URI.
   - `JWT_SECRET`: A secure, random secret key.
   - `NODE_ENV`: `production`.
3. Deploy! Vercel runs `npm run build:packages && npm run build:api` and routes API requests to `api/index.ts`.
4. Verify by checking `https://your-domain.vercel.app/api/health-check`.

### Mobile Deployment (Expo & EAS Build)

```bash
cd apps/mobile

# Build Android APK for testing
npx eas-cli build --platform android --profile preview

# Build for Google Play Store (AAB)
npx eas-cli build --platform android --profile production

# Build for Apple App Store (IPA)
npx eas-cli build --platform ios --profile production
```

---

## 🛡 Security & Role Matrix

| Capability | Worker | Manager | Owner |
| :--- | :---: | :---: | :---: |
| Submit daily flock logs | ✅ | ✅ | ✅ |
| Edit today's daily log | ✅ | ✅ | ✅ |
| Edit historical logs / delete logs | ❌ | ✅ | ✅ |
| View flock dashboards & metrics | ✅ | ✅ | ✅ |
| Create / edit flocks | ❌ | ✅ | ✅ |
| Delete flock (with cascading cleanup) | ❌ | ❌ | ✅ |
| View sales, customer pricing & dues | ❌ | ✅ | ✅ |
| Record sales invoice & accept payments | ❌ | ✅ | ✅ |
| Delete sale invoice / payment | ❌ | ❌ | ✅ |
| Create / delete farms | ❌ | ❌ | ✅ |
| Manage team members & roles | ❌ | ❌ | ✅ |

---

## 🧪 Testing & Verification

```bash
# Build all packages & apps
npm run build

# Mobile TypeScript checking
cd apps/mobile && npx tsc --noEmit

# API diagnostic runner
npm run test:api --workspace=@poultry-ops/api
```
