# GYMEZY Platform Documentation Directory

Welcome to the official technical documentation repository for the **GYMEZY** enterprise fitness platform.

## Documentation Index

| Document | Description | Target Platforms |
|---|---|---|
| **[GYM_MANAGER_ADMIN_DELEGATION_FLOW.md](./GYM_MANAGER_ADMIN_DELEGATION_FLOW.md)** | **Gym Manager vs. Gym Admin Delegation Architecture Specification**.<br/>Details the removal of Super Admin from operational tasks, Gym Admin autonomous direct execution, 4 granular Manager delegation permissions (`requireStaffApproval`, `requirePlanSwitchApproval`, `requireCancellationApproval`, `requireProfileEditApproval`), multi-channel alerting (FCM, dashboard badges, inline cards), and API contracts. | Gym Owner Web, Gym Owner Mobile, Super Admin Web, Middleware API |
| **[GIT_FORKING_WORKFLOW.md](./GIT_FORKING_WORKFLOW.md)** | **Team Git Forking & PR Review Workflow**.<br/>Details the 2-tier upstream/origin architecture, developer fork setup, daily branch lifecycle, Tech Lead (TL) code review gate, and automated VPS deployment triggers. | GitHub Organization, Tech Lead, Team Developers |
| **[CI_CD_DEPLOYMENT_WORKFLOW.md](./CI_CD_DEPLOYMENT_WORKFLOW.md)** | **CI/CD Deployment & VPS Infrastructure Specification**.<br/>Details GitHub Actions workflows for `dev` and `prod` branches, SSH automation, server deployment scripts, environment secrets, and PM2/Nginx reload triggers. | Hostinger VPS, GitHub Actions, Dev & Prod Environments |
| **[WALLET_FINANCIAL_ARCHITECTURE.md](./WALLET_FINANCIAL_ARCHITECTURE.md)** | **Gym-Specific Wallet & Financial Ledger Specification**.<br/>Details the multi-tenant financial isolation boundary, compound indexing `{userId, gymId}`, checkout debit checks, gym-scoped top-ups/payouts, and proration credit mechanics. | User Mobile, Gym Owner Web, Super Admin Web, Middleware API |
| **[ATTENDANCE_CHECKIN_CHECKOUT_FLOW.md](./ATTENDANCE_CHECKIN_CHECKOUT_FLOW.md)** | **Unified Attendance Check-In & Check-Out Specification**.<br/>Details the smart tap-in/tap-out toggle, QR & OTP resolution across Memberships, Sessions, Custom Dates, and Group Classes, anti-double scan cooldown, and stale session cleanup. | User Mobile, Gym Owner Mobile, Gym Owner Web, Middleware API |
| **[SESSION_BOOKING_FLOW.md](./SESSION_BOOKING_FLOW.md)** | **Unified Session & Class Booking Specification**.<br/>Details the reusable `SessionBookingFlow` component, 3 booking tiers (Per Session, Weekly Plan, Custom Dates), trainer add-on calculations, admin category controls, and checkout data contracts. | User Mobile, Gym Owner Web, Super Admin Web, Middleware API |
| **[MEMBERSHIP_FLOW.md](./MEMBERSHIP_FLOW.md)** | **Membership, Plan Update & Cancellation Specification**.<br/>Details the membership lifecycle, ProrationEngine mathematical model for upgrades/downgrades, two-tier approval workflow, cancellation mechanics, and wallet settlement. | User Mobile, Gym Owner Web, Super Admin Web, Middleware API |
| **[AUTHENTICATION_FLOW.md](./AUTHENTICATION_FLOW.md)** | **Master Authentication & Session Lifecycle Specification**.<br/>Full authorization lifecycle covering Customer, Gym Owner, and Super Admin authentication, Firebase JWT verification, RBAC matrices, and biometric lock. | All Platforms & Middleware API |
| **[BUILD_COMMANDS.md](./BUILD_COMMANDS.md)** | **Mobile & Web Application Build Commands Directory**.<br/>Command reference for building, running, and bundling both mobile apps (User React Expo & Gym Owner RN CLI) and web portals. | User Mobile, Gym Owner Mobile, Gym Owner Web, Super Admin Web |
| **[LOGIC_FLOW.md](./LOGIC_FLOW.md)** | **Master Production Logic Flow & Architecture Specification**.<br/>Contains end-to-end Mermaid sequence diagrams, state machines, RBAC tables, registration & verification flows, API contracts, Mongoose models, and cross-platform network architecture. | Super Admin Web, Gym Owner Web, Gym Owner Mobile, Middleware API |

---

## Quick Reference Architecture

```mermaid
flowchart LR
    A["Gym Owner Web / Mobile"] -->|"Register and KYC"| B["Middleware API (Express)"]
    B -->|"Save Application"| C[("MongoDB Cluster")]
    D["Super Admin Portal"] -->|"Inspect and Verify"| B
    B -->|"Approve Status"| C
    E["Member Mobile App"] -->|"Book and Check-In"| B
```
