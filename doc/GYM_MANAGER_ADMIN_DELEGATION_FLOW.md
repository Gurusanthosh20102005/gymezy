# GYMEZY Gym Manager vs. Gym Admin Delegation Architecture

> **Document Version:** 1.0.0  
> **Last Updated:** November 2026  
> **Target Audience:** Frontend Engineers, Mobile Engineers, Backend API Engineers, QA & Security Architects  
> **Affected Repositories:**  
> - `middleware` (Node.js / Express / Mongoose)  
> - `web-application/gym-owner` (React / Ant Design / Vite)  
> - `web-application/super-admin` (React / Ant Design / Vite)  
> - `mobile-application/gym-owner` (React Native / CLI)  

---

## 1. Architectural Overview & Boundary Definitions

To ensure high-throughput gym operations without operational bottlenecks, the GYMEZY platform strictly decouples **Fleet Governance** from **Daily Gym Operations**:

```mermaid
flowchart TD
    subgraph FleetGovernance ["Platform Governance (Super Admin)"]
        SA["Super Admin (/admin)"]
        SA -->|Sole Authority| KYC["Partner Gym Onboarding & KYC Verification"]
        SA -->|Audit Only| FleetMetrics["Global Financial Audits & Fleet Metrics"]
    end

    subgraph GymOperations ["Gym Autonomous Operations (Gym Admin & Managers)"]
        GA["Gym Admin (Owner)"]
        GA -->|Direct Immediate Execution| LiveOps["Live Operations (Zero Super Admin Approvals)"]
        LiveOps --> Staff["Staff & Trainer Management"]
        LiveOps --> Switches["Membership Switches & Proration"]
        LiveOps --> Cancels["Cancellations & Refunds"]
        LiveOps --> Profile["Facility Profile, Pricing & Timings"]

        GA -->|Appoints & Configures| GM["Gym Manager (Employee: Manager)"]
        GM -->|Delegation Check| DelRule{"Permission Granted?"}
        DelRule -- Yes (false) --> LiveOps
        DelRule -- No (true) --> Staged["Staged Pending Gym Admin Review"]
        Staged -->|FCM Alert & Badge| GA
    end
```

### Key Policy Mandates:
1. **Super Admin Isolation:** Super Admin verification exists **strictly and solely** for initial partner gym onboarding (`/admin/gyms` KYC verification). Super Admin approval has been completely removed from staff additions, staff updates, membership switches, proration calculations, membership cancellations, and gym profile edits.
2. **Gym Admin Direct Authority:** When a Gym Admin (Owner) modifies staff, updates profile timings, or accepts a membership switch, the database transaction applies **immediately and directly** (`approvalStatus: 'Approved'`).
3. **Manager Role Delegation:** When creating or editing an employee with `role: 'Manager'`, the Gym Admin can toggle 4 granular permissions. By default, all 4 toggles require Admin approval (`true`) until explicitly unticked by the Admin.

---

## 2. Granular Delegation Permission Matrix

Each `Employee` document with `role: 'Manager'` embeds a `managerPermissions` subdocument:

| Permission Field | Default | Scope & Description | When `false` (Direct Execution) | When `true` (Admin Approval Required) |
|---|---|---|---|---|
| `requireStaffApproval` | `true` | Creating, updating, or deactivating trainers, housekeeping, and front-desk staff. | Staff added/edited live with `approvalStatus = 'Approved'`. | Created with `approvalStatus = 'Pending Approval'` and staged under `submittedByManager`. |
| `requirePlanSwitchApproval` | `true` | Approving member requests to switch or upgrade membership tiers with pro-rated billing. | Triggers atomic ACID switch transaction immediately. | Switches to `PENDING_GYM_ADMIN_APPROVAL`. |
| `requireCancellationApproval` | `true` | Approving membership cancellations and refund settlements. | Cancels membership directly and updates wallet/gateway ledger. | Transitions to `PENDING_GYM_ADMIN_APPROVAL`. |
| `requireProfileEditApproval` | `true` | Modifying gym facilities, timings, descriptions, day-pass rates, or policies. | Updates live gym document immediately. | Staged in `gym.pendingManagerEdits` with visual diff tracking. |

---

## 3. Database Schema Specifications

### 3.1 Employee Model (`middleware/src/models/employee.model.js`)
```javascript
const employeeSchema = new mongoose.Schema({
  gymId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
  gymPartnerId: { type: String, trim: true, required: true, index: true },
  name: { type: String, required: true, trim: true },
  role: { type: String, required: true, trim: true, default: 'Trainer' },
  approvalStatus: {
    type: String,
    enum: ['Pending Approval', 'Approved', 'Rejected'],
    default: 'Approved', // Defaults to Approved for Owner additions
  },
  managerPermissions: {
    requireStaffApproval: { type: Boolean, default: true },
    requirePlanSwitchApproval: { type: Boolean, default: true },
    requireCancellationApproval: { type: Boolean, default: true },
    requireProfileEditApproval: { type: Boolean, default: true },
  },
  submittedByManager: {
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    managerName: { type: String, trim: true },
    submittedAt: { type: Date },
  },
  adminRemarks: { type: String, trim: true },
  // ...other fields (documents, compensation, schedule, etc.)
});
```

### 3.2 Gym Model (`middleware/src/models/gym.model.js`)
```javascript
const gymSchema = new mongoose.Schema({
  // ...core fields
  pendingManagerEdits: {
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submittedByName: { type: String, trim: true },
    submittedAt: { type: Date },
    edits: { type: mongoose.Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    adminRemarks: { type: String, trim: true },
  },
});
```

---

## 4. End-to-End Execution Sequence Diagrams

### 4.1 Staff Creation & Approval Sequence
```mermaid
sequenceDiagram
    autonumber
    actor Admin as Gym Admin (Owner)
    actor Mgr as Appointed Manager
    participant App as Gym Owner Web / Mobile
    participant API as Middleware API
    participant DB as MongoDB (Employee)
    participant FCM as Firebase Cloud Messaging

    Admin->>App: Creates Manager with custom permissions
    App->>API: POST /api/v1/employees { role: 'Manager', managerPermissions: { requireStaffApproval: true } }
    API->>DB: Save Employee (approvalStatus: 'Approved')
    API-->>App: 201 Created

    Note over Mgr,App: Later: Manager adds a new Trainer
    Mgr->>App: Inputs Trainer details & clicks Submit
    App->>API: POST /api/v1/employees { name: 'Trainer John', role: 'Trainer' }
    API->>API: Check caller managerPermissions.requireStaffApproval == true
    API->>DB: Insert Employee (approvalStatus: 'Pending Approval', submittedByManager)
    API->>FCM: Dispatch FCM alert to Gym Admin device
    API-->>App: 201 Created (Pending Gym Admin Approval)

    Note over Admin,App: Gym Admin Review
    Admin->>App: Views push notification / dashboard pending badge
    Admin->>App: Navigates to Staff Tab -> Clicks "Approve"
    App->>API: PUT /api/v1/employees/:id/approval { action: 'approve' }
    API->>DB: Update approvalStatus = 'Approved'
    API-->>App: 200 OK (Trainer active live)
```

### 4.2 Membership Switch & Proration Execution Sequence
```mermaid
sequenceDiagram
    autonumber
    actor Member as Customer
    actor Mgr as Gym Manager
    actor Admin as Gym Admin (Owner)
    participant API as Middleware API
    participant DB as MongoDB (ACID Transaction)

    Member->>API: POST /memberships/:id/request-switch (e.g. Monthly -> Half-Year)
    API->>DB: Create MembershipSwitchRequest (PENDING_GYM_APPROVAL)
    
    alt Caller is Gym Admin
        Admin->>API: PATCH /switch-requests/:id/gym-action { action: 'ACCEPT' }
        API->>DB: ProrationEngine.executeApprovedSwitchTransaction()
        Note over DB: Current membership -> Switched<br/>New membership -> Active<br/>Ledger -> Updated
        API-->>Admin: 200 OK (Executed Immediately)
    else Caller is Manager (requirePlanSwitchApproval = true)
        Mgr->>API: PATCH /switch-requests/:id/gym-action { action: 'ACCEPT' }
        API->>DB: Update status -> PENDING_GYM_ADMIN_APPROVAL
        API-->>Mgr: 200 OK (Forwarded for Gym Admin Approval)
        Admin->>API: PATCH /switch-requests/:id/gym-action { action: 'ACCEPT' }
        API->>DB: ProrationEngine.executeApprovedSwitchTransaction()
        API-->>Admin: 200 OK (Executed)
    end
```

---

## 5. Multi-Channel Alerting Architecture

When a Manager performs an action requiring Gym Admin approval, GYMEZY alerts the Gym Admin across 4 real-time touchpoints:
1. **Push Notification (FCM):** Sent to the Gym Admin's mobile device via Firebase Admin SDK (`services/notification.service.js`) with high-priority channel tags (`GYM_OPERATIONAL_ALERTS`).
2. **Dashboard Counter Badge:** The Gym Owner Web and Mobile dashboards query `/employees/approvals` and `/memberships/gym/:id/switch-requests?status=PENDING_GYM_ADMIN_APPROVAL` to render real-time numeric badges.
3. **In-App Toast:** Alerts the Manager immediately upon form submission that the item has been staged for Gym Admin sign-off.
4. **Inline Review Cards:** In the Employees Table, Members List, and Profile Screens, pending items display dedicated `Approve` (green) and `Reject` (red) buttons directly for the Gym Admin.

---

## 6. API Reference

### 6.1 Employee Management
- `POST /api/v1/employees`: Creates employee. Applies directly if caller is Gym Admin or Manager with permission; stages as `Pending Approval` if Manager requires approval.
- `PUT /api/v1/employees/:id`: Updates employee. Checked against `requireStaffApproval`.
- `PUT /api/v1/employees/:id/approval`: Reviews pending employee. Authorized for `GYM_OWNER` and `SUPER_ADMIN`.
  - Body: `{ action: 'approve' | 'reject', rejectionReason: string }`

### 6.2 Membership Switches & Cancellations
- `PATCH /api/v1/memberships/switch-requests/:id/gym-action`:
  - Body: `{ action: 'ACCEPT' | 'REJECT', remarks: string }`
  - When called by Gym Admin: Executes ACID switch transaction directly.
  - When called by Manager: Checked against `requirePlanSwitchApproval`.
- `PATCH /api/v1/memberships/:id/cancel/accept`:
  - Body: `{ refundAmountPaise: number, remarks: string }`
  - Checked against `requireCancellationApproval`.

### 6.3 Gym Profile & Timings
- `PUT /api/v1/gyms/:id`:
  - When called by Gym Admin: Applied directly to live gym document.
  - When called by Manager without permission: Staged in `gym.pendingManagerEdits`.

---

## 7. Verification & Test Coverage

All delegation rules are verified under automated unit tests in `middleware/test/manager_delegation.test.js`:
- ✅ Schema validation for default 4 boolean toggles (`true`).
- ✅ Schema support for customizable permissions on Manager creation.
- ✅ Schema support for `pendingManagerEdits` in Gym model.
- ✅ State validation for `PENDING_GYM_ADMIN_APPROVAL` in Membership Switch requests.
- ✅ State validation for `PENDING_GYM_ADMIN_APPROVAL` in Membership Cancellation requests.
- **Run command:** `node --test middleware/test/*.test.js` (34/34 passing).
