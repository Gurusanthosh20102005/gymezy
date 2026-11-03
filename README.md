# GYMEZY — Next-Gen Fitness Access and Gym Management Platform

[![React Native](https://img.shields.io/badge/React_Native-0.76+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev)
[![Expo](https://img.shields.io/badge/Expo-SDK_52+-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas_/_VPS-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com)
[![Ant Design](https://img.shields.io/badge/Ant_Design-6.x-0170FE?style=for-the-badge&logo=antdesign&logoColor=white)](https://ant.design)

**GYMEZY** is a unified multi-platform fitness ecosystem that connects fitness seekers with gyms, boutique fitness studios (Yoga, Zumba, HIIT, CrossFit, Boxing), and certified personal trainers. It eliminates rigid annual contracts by providing pay-as-you-go single-session passes, flexible multi-day packages, tiered memberships with trainer add-ons, and secure digital QR/OTP access control.

---

## Technical Documentation Directory

For complete architecture, logic flows, database models, and build guides, see the [`doc/`](doc/README.md) directory:

| Document | Description |
|---|---|
| **[BUILD_COMMANDS.md](doc/BUILD_COMMANDS.md)** | Single source of truth for build, start, bundling, and environment scripts across all 5 apps. |
| **[ATTENDANCE_CHECKIN_CHECKOUT_FLOW.md](doc/ATTENDANCE_CHECKIN_CHECKOUT_FLOW.md)** | Unified check-in / check-out toggle, 120s anti-bounce cooldown, and pass validation matrices. |
| **[SESSION_BOOKING_FLOW.md](doc/SESSION_BOOKING_FLOW.md)** | Dynamic multi-tier session booking architecture (Per Session, Weekly, Custom Dates, Group Classes). |
| **[MEMBERSHIP_FLOW.md](doc/MEMBERSHIP_FLOW.md)** | Membership lifecycle, ProrationEngine mathematical model for upgrades/downgrades, and cancellations. |
| **[CI_CD_DEPLOYMENT_WORKFLOW.md](doc/CI_CD_DEPLOYMENT_WORKFLOW.md)** | Automated GitHub Actions CI/CD pipeline for `dev` & `prod` branches, SSH scripts, and VPS deployment. |
| **[WALLET_FINANCIAL_ARCHITECTURE.md](doc/WALLET_FINANCIAL_ARCHITECTURE.md)** | Gym-specific wallet isolation, compound indexing, split-payment checkout, and financial ledger integrity. |
| **[AUTHENTICATION_FLOW.md](doc/AUTHENTICATION_FLOW.md)** | End-to-end authentication, Firebase JWT verification, RBAC matrices, and session security. |
| **[LOGIC_FLOW.md](doc/LOGIC_FLOW.md)** | Master architectural sequence diagrams, state machines, and cross-platform network topography. |

---

## Monorepo Structure

```text
GYMEZY/
├── mobile-application/
│   ├── user-react/               # Member / User Mobile App (React Native + Expo SDK 52+)
│   │   ├── src/
│   │   │   ├── pages/            # Discovery, Booking, Digital Passes, Profile, Wallet
│   │   │   ├── widgets/          # SessionBookingFlow, DigitalQrPassCard, CustomCalendar
│   │   │   ├── services/         # apiService (Axios gateway), notificationService
│   │   │   └── theme/            # Centralized Theme, Dark/Light Mode, AppColors tokens
│   │   ├── app.json              # Expo Application Configuration
│   │   └── package.json          # User App Dependencies
│   │
│   └── gym-owner/                # Gym Owner & Turnstile Scanner Mobile App (React Native CLI)
│       ├── android/              # Native Android project configuration
│       ├── ios/                  # Native iOS project configuration
│       ├── src/                  # Scanner, Check-In/Check-Out, Live Attendance Dashboard
│       └── package.json          # RN CLI Dependencies
│
├── web-application/
│   ├── gym-owner/                # Gym Owner Web Portal (React 19 + Vite, Port 5173)
│   │   ├── src/                  # Member management, Section/Class scheduling, KYC, Finances
│   │   └── package.json
│   │
│   └── super-admin/              # Super Admin Web Portal (React 19 + Vite, Port 5174)
│       ├── src/                  # Gym KYC approvals, Platform commissions, Global audit logs
│       └── package.json
│
├── middleware/                   # Node.js + Express REST API Gateway (Port 5001)
│   ├── src/
│   │   ├── controllers/          # attendance, booking, membership, gym, auth, wallet controllers
│   │   ├── models/               # Mongoose Schemas (User, Gym, Booking, Membership, Attendance)
│   │   ├── routes/               # Express API v1 Route Definitions
│   │   ├── services/             # Proration engine, Cron sweepers, Firebase notifications
│   │   └── middleware/           # JWT auth validator, RBAC guard, Error handler
│   ├── test/                     # Automated unit and integration test suite (node --test)
│   ├── .env                      # Environment Variables
│   └── package.json              # Express, Mongoose, Helmet, Morgan, dotenvx
│
├── doc/                          # Technical Specifications and Flow Diagrams
└── README.md                     # Master Project README
```

---

## Technology Stack

### 1. Multi-Platform Application Matrix

| Layer / Application | Primary Framework | Key Libraries & Tooling | Purpose |
| :--- | :--- | :--- | :--- |
| **Member Mobile App**<br/>`mobile-application/user-react` | **React Native** (`0.86+`)<br/>**Expo** (`SDK 57+`) | • React Navigation v7 (Stack & Bottom Tabs)<br/>• `expo-location` (GPS Geo-Discovery)<br/>• `expo-local-authentication` (Biometric Login)<br/>• `react-native-qrcode-svg` (Dynamic Passes)<br/>• `lottie-react-native` & `expo-linear-gradient`<br/>• `expo-clipboard` & `expo-image-picker` | Native iOS and Android app for gym discovery, section booking, memberships, split-wallet checkout, and QR pass turnstile access. |
| **Gym Owner Scanner App**<br/>`mobile-application/gym-owner` | **React Native CLI** (`0.74+`) | • Native Camera / QR Scanner<br/>• React Native Gesture Handler<br/>• Vector Icons & Safe Area Context | Dedicated reception desk and gate operator tool for scanning turnstile QR passes and verifying entry OTPs in offline/online mode. |
| **Gym Owner Web Portal**<br/>`web-application/gym-owner` | **React 19**<br/>**Vite** (`8.x`) | • **Ant Design** (`antd 6.x`) & `@ant-design/icons`<br/>• Redux Toolkit (`@reduxjs/toolkit`) & React-Redux<br/>• React Router DOM (`v7.x`)<br/>• Lucide React Icons<br/>• `canvas-confetti` & `jsqr` | High-density administrative desktop portal for gym profile setup, trainer allocations, class scheduling, membership approvals, and revenue analytics. |
| **Super Admin Web Portal**<br/>`web-application/super-admin` | **React 19**<br/>**Vite** (`8.x`) | • **Ant Design** (`antd 6.x`) & `@ant-design/icons`<br/>• Redux Toolkit (`@reduxjs/toolkit`)<br/>• React Router DOM (`v7.x`)<br/>• Lucide React Icons & Axios | Master governance console for verifying gym KYC submissions, inspecting documents, approving partner tiers, managing platform commissions, and global audit logs. |
| **Backend REST API Gateway**<br/>`middleware` | **Node.js** (`20+ LTS`)<br/>**Express.js** (`v5.x`) | • `mongoose` (`v9.x`) (ODM)<br/>• `firebase-admin` (`v14.x`) (FCM & Google SSO)<br/>• `jsonwebtoken` (`v9.x`) & `bcryptjs`<br/>• `sharp` (Image Compression & WebP Conversion)<br/>• `node-cron` (Automated Attendance Sweepers)<br/>• `helmet`, `cors`, `morgan`, `cookie-parser` | Centralized REST API handling geospatial queries, atomic booking transactions, wallet debit lifecycles, proration math, and turnstile check-ins. |

---

### 2. Core Architectural & Infrastructure Technologies

| Domain | Technology / Tool | Specification & Implementation Details |
| :--- | :--- | :--- |
| **Database & Search** | **MongoDB** (`6.x / 7.x`)<br/>**Mongoose ODM** | • **Geospatial**: `2dsphere` index on `location.coordinates` for Haversine distance-sorted gym queries.<br/>• **Financial Ledger**: Compound unique index `{ userId: 1, gymId: 1 }` on `Wallet` for multi-tenant balance isolation.<br/>• **Consistency**: Atomic ledger debit operations with automatic rollback on booking failure. |
| **Authentication & RBAC** | **Google OAuth 2.0**<br/>**Firebase Auth**<br/>**JWT** | • Hybrid token lifecycle: Firebase ID token validation (`verifyGoogleIdToken`) + proprietary gym JWT access tokens.<br/>• Role-Based Access Control enforcing strict separation: `Customer`, `GymOwner`, `Employee`, `SuperAdmin`.<br/>• Hardware-backed biometric authentication (Fingerprint / Face ID) via Expo LocalAuthentication. |
| **Push Notifications** | **Firebase Cloud Messaging** (FCM) | • Cloud messaging via `firebase-admin` service accounts.<br/>• Automatic multicast dispatch to member and gym owner device tokens for check-ins, switch approvals, and expiry alerts. |
| **Financial Engine** | **GYMEZY ProrationEngine** & **Wallet Core** | • Mathematical proration engine with 4 downgrade compensation modes (`WALLET`, `EXTEND`, `REFUND`, `FORFEIT`).<br/>• Split / Hybrid checkout payment: offsets purchases using available gym wallet funds and routes remainder through external gateways. |
| **DevOps & CI/CD** | **GitHub Actions**<br/>**Appleboy SSH Action** | • Automated multi-branch pipeline ([`deploy.yml`](.github/workflows/deploy.yml)): pushes to `dev` trigger `/var/www/gymezy/deploy-dev.sh`, pushes to `prod` trigger `/var/www/gymezy/deploy-prod.sh`.<br/>• Zero-downtime cluster reloads via PM2 and Nginx reverse proxy on Hostinger VPS. |
| **Server & Hosting** | **Hostinger Linux VPS**<br/>**Nginx** & **PM2** | • Ubuntu Linux VPS (`187.127.149.165`) hosting standalone MongoDB on `27017` with direct connection support.<br/>• Reverse proxy routing: Web ports `5173`/`5174`, API port `5001`, and production SSL terminations. |
| **Testing & Quality** | **Node.js Native Test Runner** (`node --test`) | • Zero-dependency fast test suite in `middleware/test/` verifying proration math, banner geo-sorting, model constraints, Google SSO, and wallet ledger isolation. |

---

## Getting Started and Local Development

### 1. Prerequisites
Ensure you have the following installed on your machine:
* **Node.js** (`>= 20.x.x`) & `npm` (`>= 10.x.x`)
* **Git**
* **MongoDB** (Local instance, Atlas cluster, or VPS database)
* **Android Studio & SDK** (with `adb` configured in PATH) — *for running Android apps*
* **Xcode & CocoaPods** (macOS only) — *for running iOS apps*

---

### 2. Backend Middleware Setup

1. Navigate to the `middleware` directory:
   ```bash
   cd middleware
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Configure the `.env` file:
   ```env
   PORT=5001
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/gymezy_dev
   JWT_SECRET=your_jwt_secret_key_here
   ```
4. Run automated test suite:
   ```bash
   npm test
   ```
5. Start the backend development server:
   ```bash
   npm run dev
   ```
   *The API gateway runs at `http://localhost:5001/api/v1`.*

---

### 3. Member Mobile Application (`user-react`) Setup

1. Forward API and Metro ports to your connected Android device / emulator:
   ```bash
   adb reverse tcp:5001 tcp:5001
   adb reverse tcp:8081 tcp:8081
   ```
2. Navigate to the user app directory:
   ```bash
   cd mobile-application/user-react
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start Metro bundler:
   ```bash
   npm start
   ```
5. Launch on device:
   ```bash
   # Run on connected Android device / emulator
   npm run android

   # Run on iOS simulator (macOS only)
   npm run ios
   ```

---

### 4. Gym Owner Web Portal Setup

1. Navigate to the Gym Owner web application:
   ```bash
   cd web-application/gym-owner
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The portal runs at `http://localhost:5173`.*

---

### 5. Super Admin Web Portal Setup

1. Navigate to the Super Admin web application:
   ```bash
   cd web-application/super-admin
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The portal runs at `http://localhost:5174`.*

---

## Key Platform Features

* **Intelligent Geo-Discovery:** Find gyms and studios sorted by distance, ratings, price, and specialized workout tags (`HIIT`, `Yoga`, `Strength`, `Boxing`, `CrossFit`, `Women Only`).
* **Multi-Tier Booking Engine:**
  - **Single Session Pass:** Pay-per-visit with optional personal coach add-on.
  - **Weekly Pass:** Unlimited access for 7 days.
  - **Custom Multi-Dates:** Pick specific calendar days for your training schedule.
  - **Group Classes & Section Batches:** Scheduled batch reservations with weekday enforcement.
* **Tiered Memberships & Flexible Upgrades:** 1, 3, 6, and 12-month memberships with dynamic proration math for instant upgrades/downgrades and wallet settlements.
* **Digital Access Control:** High-contrast dynamic QR pass and backup 6-digit entry OTP with turnstile tap-in / tap-out auto check-out and 120s anti-bounce guards.
* **Health & Fitness Tracking:** BMI categorization, emergency contact profiles, and attendance history logs.

---

*GYMEZY — Empowering fitness without boundaries.*
