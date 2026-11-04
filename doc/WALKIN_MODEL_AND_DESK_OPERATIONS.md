# GYMEZY Walk-in Model & Front-Desk Operations Specification

This document details the architecture, data models, customer resolution pipeline, front-desk counter payment flows, and turnstile check-in execution of the **Walk-in Operations System** across the GYMEZY platform.

---

## 1. Architectural Overview & System Purpose

The **Walk-in Model** allows gym owners, managers, and front-desk administrators to create single-session passes, group class bookings, and multi-tier memberships directly from the Gym Owner Portal for offline visitors who walk into the gym without having the GYMEZY mobile application pre-installed.

```mermaid
flowchart TD
    V["Walk-in Visitor Arrives at Gym"] --> D{"Front Desk Action"}
    
    D -->|"Single Session / Group Class"| B["Create Walk-in Booking\n• POST /api/v1/bookings/gym/:gymId/walk-in\n• source: 'WALK_IN'"]
    D -->|"Membership Pass Purchase"| M["Create Walk-in Member\n• POST /api/v1/memberships/gym/:gymId/walk-in\n• source: 'WALK_IN'"]
    
    B --> CR["findOrCreateWalkInCustomer(phone, name, email)\n• Check existing User by phone\n• Or create new CUSTOMER with auto GYZ customerId"]
    M --> CR
    
    CR --> P["Counter Payment Settlement\n• Method: Cash, Counter UPI, Card / POS\n• Status: Completed"]
    
    P --> CH{"Immediate Gate Access?"}
    CH -->|"Yes (Check In Now)"| A["Auto Check-in\n• Create Attendance Record\n• Increment Live Floor Occupancy\n• Status: Checked-in / Active"]
    CH -->|"No (Upcoming Session)"| U["Status: Upcoming\n• Phone-lookup Check-in upon Arrival\n• Zero-friction Desk Check-in"]
```

---

## 2. Source Disambiguation: APP vs. WALK_IN

Every booking and membership record on the GYMEZY platform explicitly tracks its origination source via the `source` field.

| Source | Enum Value | Initiator | Payment Channel | Initial Status | Pass Identifier Format |
|---|---|---|---|---|---|
| **Mobile App** | `'APP'` | Registered User on GYMEZY App | In-App Razorpay, Stripe, or Gym Wallet | `Confirmed` / `Active` | Sequential `BK...` or `MEM...` with Entry QR Code |
| **Front Desk** | `'WALK_IN'` | Gym Owner, Manager, or Staff Desk | Cash at Desk, Counter UPI (QR), POS Card Swipe | `Checked-in` (immediate) or `Upcoming` | Sequential `BK...` or `MEM...` with Phone Lookup |

### Source Constants (Single Source of Truth)

Defined in [`booking.model.js`](../middleware/src/models/booking.model.js) and [`membership.model.js`](../middleware/src/models/membership.model.js):

```javascript
export const BOOKING_SOURCES = ['APP', 'WALK_IN'];
export const MEMBERSHIP_SOURCES = ['APP', 'WALK_IN'];
```

---

## 3. Customer Identity Auto-Resolution Pipeline

Offline visitors often do not have an existing GYMEZY login. To maintain relational integrity and allow seamless account unification if the visitor later downloads the app:

1. Front-desk enters visitor's **Full Name**, **10-Digit Phone Number**, and optional **Email**.
2. [`walkInHelper.js`](../middleware/src/utils/walkInHelper.js) cleans and normalizes the phone number (extracting standard 10-digit format).
3. Database checks if a `User` already exists with this phone number:
   - **User Exists**: Links the walk-in booking or membership directly to the existing account `_id` and preserves their `customerId`.
   - **User Does Not Exist**: Automatically provisions a standard `CUSTOMER` record:
     - Sets `role: 'CUSTOMER'`.
     - Assigns clean phone, full name, and generated email placeholder if none provided.
     - Auto-generates standard sequential `customerId` (`GYZ0001`, `GYZ0002`, etc.) via Mongoose pre-save counter hook.
     - Sets a cryptographically strong random password for local account compatibility.
4. **App Sync**: If the customer subsequently registers on the GYMEZY mobile app using the same mobile number, their historical walk-in sessions and active memberships are instantly accessible.

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Front Desk Staff
    participant Web as Gym Owner Portal
    participant API as Middleware API
    participant Helper as walkInHelper.js
    participant DB as MongoDB Cluster

    Staff->>Web: Enters visitor phone, name & plan
    Web->>API: POST /api/v1/bookings/gym/:gymId/walk-in
    API->>Helper: findOrCreateWalkInCustomer({ fullName, phone, email })
    Helper->>DB: User.findOne({ phone: cleanPhone })
    alt Customer Already Exists
        DB-->>Helper: Returns existing User document
    else New Customer
        Helper->>DB: User.create({ fullName, phone, role: 'CUSTOMER', ... })
        DB-->>Helper: Returns newly provisioned User with customerId
    end
    Helper-->>API: targetUser (ObjectId & customerId)
    API->>DB: Booking.create({ userId: targetUser._id, gymId, source: 'WALK_IN', ... })
    DB-->>API: Created Booking Record
    API-->>Web: 201 Created (Booking details & customer info)
    Web-->>Staff: Displays success toast & adds to live table
```

---

## 4. Front-Desk Payment Settlement & Immediate Check-in

### Counter Payment Handling
- Offline visitors pay at the turnstile or front desk counter.
- Accepted payment methods: `Cash`, `Counter UPI` (gym's static QR code), `POS Card Swipe`.
- Payment status defaults to `Completed` with `paidAt: new Date()`.
- Financial amounts are credited directly to the gym's physical collections without triggering in-app gateway commissions.

### Check-in Behavior
The desk operator can select one of two entry modes:
1. **Check-in Now (`checkInNow: true`)**:
   - Booking `status` set to `Checked-in` / `Active`.
   - An `Attendance` record (`status: 'Checked-In'`) is created immediately.
   - Increases the gym's live floor occupancy counter.
2. **Upcoming Slot (`checkInNow: false`)**:
   - Booking `status` set to `Upcoming` or `Confirmed`.
   - Visitor can arrive later today or on a future date and check in by quoting their mobile number at the desk or scanner terminal.

---

## 5. Walk-in Operations in Gym Owner Portal

### 5.1 Bookings Management (`/owner/bookings`)
- **Action Button**: `+ Create Walk-in Booking` opens the walk-in modal.
- **Source Filter Tabs**: Filter by `All Sources`, `GYMEZY App`, or `Front-Desk Walk-in`.
- **Badges**:
  - `WALK-IN` in vibrant purple tag (`color="purple"`).
  - `APP` in classic blue tag (`color="blue"`).
- **Deep Linking**: Navigating to `/owner/bookings?action=walkin` automatically opens the booking creation modal.

### 5.2 Membership Management (`/owner/members`)
- **Action Button**: `+ New Walk-in Member` launches the membership registration form.
- **Tier Selection**: Monthly, Quarterly, Half-Yearly, and Annual with auto-calculated duration dates (`endDate`).
- **Source Filter Tabs**: Filter by `All Sources`, `GYMEZY App`, or `Walk-in`.
- **Badges**: Dedicated `Source` column displaying `WALK-IN` and `APP` tags.
- **Deep Linking**: Navigating to `/owner/members?action=walkin` automatically opens the member creation modal.

### 5.3 Turnstile Fast Lookup (`/owner/checkin`)
- Front-desk staff can search upcoming walk-ins by entering the visitor's 10-digit mobile number, full name, or booking ID.
- Search results display customer name, phone number, pass type, and an explicit `WALK-IN` badge.
- A single click on **"Verify & Check In"** validates access, unlocks the turnstile gate, creates the attendance record, and launches confetti confirmation.

### 5.4 Dashboard Quick Actions (`/owner/dashboard`)
- Direct shortcut cards for **"New Walk-in Booking"** and **"New Walk-in Member"** in the Quick Actions section.
- Recent Bookings and Membership Status tables render `APP` vs `WALK-IN` pills alongside each customer record.

---

## 6. API Specification & Request / Response Contracts

### 6.1 Create Walk-in Booking
- **Endpoint**: `POST /api/v1/bookings/gym/:gymId/walk-in`
- **Access**: Gym Owner, Gym Admin, Gym Manager

#### Request Payload
```json
{
  "customerName": "Ramesh Kumar",
  "phone": "9876543210",
  "email": "ramesh@example.com",
  "bookingType": "GYM_SESSION",
  "date": "2026-11-04",
  "timeSlot": "07:00 AM",
  "amount": 150,
  "paymentMethod": "Cash",
  "checkInNow": true
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Walk-in booking created successfully for Ramesh Kumar.",
  "data": {
    "_id": "672879a834b9d031cba41e12",
    "bookingId": "BK00142",
    "userId": "672879a834b9d031cba41e10",
    "gymId": "67243912a7f80b2a8d132cb0",
    "bookingType": "GYM_SESSION",
    "source": "WALK_IN",
    "startDate": "2026-11-04T00:00:00.000Z",
    "timeSlot": "07:00 AM",
    "status": "Checked-in",
    "pricing": {
      "totalAmount": 150,
      "basePrice": 150,
      "taxAmount": 0
    },
    "payment": {
      "method": "Cash",
      "status": "Completed",
      "paidAt": "2026-11-04T05:58:32.120Z"
    },
    "walkInDetails": {
      "isWalkIn": true,
      "customerName": "Ramesh Kumar",
      "customerPhone": "9876543210",
      "paymentMethod": "Cash"
    }
  }
}
```

---

### 6.2 Create Walk-in Membership
- **Endpoint**: `POST /api/v1/memberships/gym/:gymId/walk-in`
- **Access**: Gym Owner, Gym Admin, Gym Manager

#### Request Payload
```json
{
  "customerName": "Priya Sharma",
  "phone": "9840123456",
  "email": "priya@example.com",
  "tier": "Quarterly",
  "amount": 4499,
  "startDate": "2026-11-04",
  "paymentMethod": "UPI"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Walk-in membership created successfully for Priya Sharma.",
  "data": {
    "_id": "67287b4134b9d031cba41e24",
    "membershipId": "MEM00088",
    "userId": "67287b4134b9d031cba41e22",
    "gymId": "67243912a7f80b2a8d132cb0",
    "membershipTier": "Quarterly",
    "source": "WALK_IN",
    "startDate": "2026-11-04T00:00:00.000Z",
    "endDate": "2027-02-04T00:00:00.000Z",
    "status": "Active",
    "pricing": {
      "totalAmount": 4499
    },
    "payment": {
      "method": "UPI",
      "status": "Completed"
    },
    "walkInDetails": {
      "isWalkIn": true,
      "customerName": "Priya Sharma",
      "customerPhone": "9840123456",
      "paymentMethod": "UPI"
    }
  }
}
```

---

### 6.3 Querying Gym Bookings & Memberships with Source Filter
- `GET /api/v1/bookings/gym/:gymId?source=ALL` (default)
- `GET /api/v1/bookings/gym/:gymId?source=APP` (returns online mobile bookings only)
- `GET /api/v1/bookings/gym/:gymId?source=WALK_IN` (returns front-desk bookings only)

Same parameters apply to memberships:
- `GET /api/v1/memberships/gym/:gymId?source=ALL|APP|WALK_IN`

---

## 7. Mongoose Schema Reference

### `Booking` Schema Fields
```javascript
source: {
  type: String,
  enum: ['APP', 'WALK_IN'],
  default: 'APP',
  index: true,
},
walkInDetails: {
  isWalkIn: { type: Boolean, default: false },
  customerName: { type: String, trim: true },
  customerPhone: { type: String, trim: true },
  customerEmail: { type: String, trim: true },
  bookedByEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  paymentMethod: { type: String, enum: ['Cash', 'UPI', 'POS', 'Card', 'Other'], default: 'Cash' },
  customPriceOverride: { type: Boolean, default: false },
  approvedByOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}
```

### `Membership` Schema Fields
```javascript
source: {
  type: String,
  enum: ['APP', 'WALK_IN'],
  default: 'APP',
  index: true,
},
walkInDetails: {
  isWalkIn: { type: Boolean, default: false },
  customerName: { type: String, trim: true },
  customerPhone: { type: String, trim: true },
  customerEmail: { type: String, trim: true },
  registeredByEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  paymentMethod: { type: String, enum: ['Cash', 'UPI', 'POS', 'Card', 'Other'], default: 'Cash' },
  customPriceOverride: { type: Boolean, default: false },
  approvedByOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}
```
