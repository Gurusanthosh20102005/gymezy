# GYMEZY Mobile & Web Application Build Commands Directory

This document provides a single-source-of-truth reference for all build, run, bundling, and deployment commands across the entire **GYMEZY** ecosystem.

---

## Table of Contents
1. [Mobile Applications](#1-mobile-applications)
   - [User Mobile App (React Native / Expo)](#a-user-mobile-app-mobile-applicationuser-react)
   - [Gym Owner Mobile App (React Native CLI)](#b-gym-owner-mobile-app-mobile-applicationgym-owner)
2. [Web Application Portals](#2-web-application-portals)
   - [Gym Owner Web Portal](#a-gym-owner-web-portal-web-applicationgym-owner)
   - [Super Admin Web Portal](#b-super-admin-web-portal-web-applicationsuper-admin)
3. [Middleware Backend API](#3-middleware-backend-api)
4. [Environment Switching Guide](#4-environment-switching-guide)

---

## 1. Mobile Applications

### A. User Mobile App (`mobile-application/user-react`)

The Member/User app is built with **Expo SDK 57 / React Native 0.86+**.

#### Prerequisites & Port Forwarding
When running against a local development server with an Android device connected via USB or wireless ADB:
```bash
# Forward backend API port to device
adb reverse tcp:5001 tcp:5001

# Forward Metro bundler port
adb reverse tcp:8081 tcp:8081
```

#### Run in Development
```bash
cd mobile-application/user-react

# Start Metro bundler
npm start

# Run on connected Android device / emulator
npm run android

# Run on iOS simulator (macOS only)
npm run ios
```

#### Environment Configuration
```bash
cd mobile-application/user-react

# Point app to local development backend (port 5001 / LAN IP)
npm run set-env:dev

# Point app to remote VPS cloud backend
npm run set-env:prod
```

#### Local Android APK / Bundle Build
```bash
cd mobile-application/user-react

# Development build (unsigned / debug key APK)
npm run build:dev:android
# Or shortcut
npm run build:dev:apk

# Production release APK (outputs to android/app/build/outputs/apk/release/app-release.apk)
npm run build:prod:android
# Or shortcut
npm run build:prod:apk
```

#### Cloud EAS Build (Expo Application Services)
```bash
cd mobile-application/user-react

# EAS preview build for internal device testing
npm run build:dev:eas

# EAS production APK/AAB build for Google Play Store
npm run build:prod:eas
```

---

### B. Gym Owner Mobile App (`mobile-application/gym-owner`)

The Gym Owner mobile management app is built with **React Native CLI (TypeScript)**.

#### Run in Development
```bash
cd mobile-application/gym-owner

# Setup port forwarding for API
adb reverse tcp:5001 tcp:5001

# Start Metro bundler
npm start

# Run on Android device
npm run android

# Run on iOS simulator (macOS only)
npm run ios
```

#### Environment Configuration
```bash
cd mobile-application/gym-owner

# Development environment
npm run set-env:dev

# Production environment
npm run set-env:prod
```

#### Build Release APK
```bash
cd mobile-application/gym-owner

# Assemble development release APK
npm run build:dev:android

# Assemble production release APK
npm run build:prod:android

# Generated APK output directory:
# android/app/build/outputs/apk/release/app-release.apk
```

---

## 2. Web Application Portals

### A. Gym Owner Web Portal (`web-application/gym-owner`)

Built with **React, Vite, Redux Toolkit, and Ant Design 5**.

```bash
cd web-application/gym-owner

# Install dependencies (if fresh pull)
npm install

# Start local development dev server (default: http://localhost:5173)
npm run dev

# Compile production bundle (outputs to dist/)
npm run build

# Preview compiled production build locally
npm run preview
```

### B. Super Admin Web Portal (`web-application/super-admin`)

Built with **React, Vite, and Ant Design 5**.

```bash
cd web-application/super-admin

# Install dependencies (if fresh pull)
npm install

# Start local development dev server (default: http://localhost:5174)
npm run dev

# Compile production bundle (outputs to dist/)
npm run build

# Preview compiled production build locally
npm run preview
```

---

## 3. Middleware Backend API (`middleware`)

Built with **Node.js (ESM), Express, Mongoose, and Firebase Admin SDK**.

```bash
cd middleware

# Install dependencies
npm install

# Run in development with auto-reload (nodemon)
npm run dev
# Or npm start dev

# Run automated tests
npm test

# Run specific unit test suites
node --test test/sso_notification.test.js test/proration.test.js

# Health check
curl http://localhost:5001/api/v1/health
```

---

## 4. Environment Switching Guide

| Component | Dev Config | Production Config |
|---|---|---|
| **Middleware** | `middleware/.env` | Remote VPS `/home/gymezy/GYMEZY/middleware/.env` |
| **User Mobile** | `npm run set-env:dev` | `npm run set-env:prod` |
| **Owner Mobile** | `npm run set-env:dev` | `npm run set-env:prod` |
| **Gym Owner Web** | `web-application/gym-owner/.env` | `VITE_API_URL=https://api.gymezy.com/api/v1` |
| **Super Admin Web** | `web-application/super-admin/.env` | `VITE_API_URL=https://api.gymezy.com/api/v1` |

