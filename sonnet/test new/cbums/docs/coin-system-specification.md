# Coin System Specification

## 1. Introduction

This document provides a detailed specification of the coin system implemented in the CBUMS application. The coin system is a virtual currency mechanism that enables users to transfer and allocate coins to other users based on their roles and relationships within the system.

## 2. System Overview

The coin system is a core feature of the CBUMS application that facilitates virtual currency transactions between specific user roles. Only certain roles maintain a coin balance that can be transferred to other users or allocated based on hierarchical relationships.

## 3. User Roles and Permissions

### 3.1 Role Hierarchy

The application has a hierarchical user role structure that determines coin-related permissions:

1. **SuperAdmin**: The highest level administrator with full system access
2. **Admin**: Administrators who manage companies and employees
3. **Company**: Company accounts that manage their employees (no coin balance)
4. **Employee**: End-users with different subroles:
   - **Operator**: Performs operations and requires coins
   - **Driver**: Transport-related role
   - **Transporter**: Transport-related role
   - **Guard**: Security role (no coin balance)

### 3.2 Role-Based Coin Permissions

| Role | Has Coin Balance | View Balance | Transfer Coins | Allocate Coins | Receive Coins | Spend Coins |
|------|------------------|--------------|----------------|----------------|---------------|-------------|
| SuperAdmin | Yes | Yes | No | Yes (to Admins) | No | No |
| Admin | Yes | Yes | Yes | Yes (to Operators only) | Yes | No |
| Company | No | No | No | No | No | No |
| Operator | Yes | Yes | No | No | Yes | Yes (1 coin per session) |
| Guard | No | No | No | No | No | No |

## 4. Coin Transactions

### 4.1 Transaction Types

Coin transactions in the system are categorized by their reason:

1. **ADMIN_CREATION**: Coins allocated when a SuperAdmin creates an Admin (default: 1000 coins)
2. **OPERATOR_CREATION**: Coins allocated when an Admin creates an Operator (default: 200 coins)
3. **COIN_ALLOCATION**: Additional allocation of coins to existing users
4. **SESSION_CREATION**: Coins spent when an Operator creates a session/trip (cost: 1 coin)

### 4.2 Transaction Flow

All coin transactions follow this general flow:
1. Validate sender and receiver exist and have appropriate roles
2. Check authorization based on user roles
3. Verify sufficient coin balance (if applicable)
4. Execute transaction within a database transaction (atomic operation)
5. Update balances for relevant users
6. Create transaction record
7. Log activity for auditing purposes

## 5. Features

### 5.1 Coin Balance Display

- Only SuperAdmin, Admin, and Operator roles can view their coin balance
- Balance is displayed prominently with refresh capability
- Session context maintains updated coin balance information

### 5.2 Coin Allocation During User Creation

- When creating an ADMIN, the SUPERADMIN allocates a default of 1000 coins
- When creating an OPERATOR, the ADMIN allocates a default of 200 coins from their own balance
- Creating COMPANY or GUARD users does not involve any coin allocation

### 5.3 Additional Coin Allocation

- SuperAdmin can allocate additional coins to existing Admin users at any time
- Admin can allocate additional coins to existing Operator users at any time
- All allocations deduct from the allocator's balance

### 5.4 Coin Usage

- Operators spend 1 coin when creating a new session/trip
- If an Operator has insufficient coins, they cannot create new sessions

### 5.5 Transaction History

- SuperAdmin, Admin, and Operator users can view their transaction history
- History displays:
  - Transaction date/time
  - Sender/recipient information
  - Amount (with visual indication for incoming/outgoing)
  - Transaction reason
  - Notes (if provided)

## 6. Data Model

### 6.1 User Schema (Coin-Related Fields)

```
model User {
  id                   String
  coins                Int?              // Only used for SuperAdmin, Admin, and Operator roles
  sentTransactions     CoinTransaction[] @relation("SentTransactions")
  receivedTransactions CoinTransaction[] @relation("ReceivedTransactions")
  // Other fields omitted for brevity
}
```

### 6.2 Transaction Schema

```
model CoinTransaction {
  id         String             @id @default(uuid())
  fromUserId String
  toUserId   String
  amount     Int
  reasonText String?
  reason     TransactionReason?
  createdAt  DateTime           @default(now())
  fromUser   User               @relation("SentTransactions", fields: [fromUserId], references: [id])
  toUser     User               @relation("ReceivedTransactions", fields: [toUserId], references: [id])
}
```

### 6.3 Transaction Reason Enum

```
enum TransactionReason {
  ADMIN_CREATION
  OPERATOR_CREATION
  COIN_ALLOCATION
  SESSION_CREATION
}
```

## 7. API Endpoints

### 7.1 Coin Allocation API

- **Endpoint**: `/api/coins/allocate`
- **Method**: POST
- **Authentication**: Required
- **Authorization**: SuperAdmin (to Admins), Admin (to Operators)
- **Request Body**:
  ```json
  {
    "toUserId": "string",
    "amount": number,
    "reasonText": "string (optional)"
  }
  ```
- **Response**: Transaction details and updated balances

### 7.2 Coin Balance API

- **Endpoint**: `/api/coins/balance`
- **Method**: GET
- **Authentication**: Required
- **Authorization**: SuperAdmin, Admin, Operator
- **Response**: Current balance and recent transactions

### 7.3 Session Creation API (Coin Deduction)

- **Endpoint**: `/api/sessions`
- **Method**: POST
- **Authentication**: Required
- **Authorization**: Operator
- **Effect**: Deducts 1 coin from the Operator's balance when creating a session

## 8. User Interface Components

### 8.1 Balance Display

- Present in dashboard for SuperAdmin, Admin, and Operator roles
- Shows coin amount with refresh capability

### 8.2 Allocation Controls

- SuperAdmin dashboard includes controls to allocate coins to Admins
- Admin dashboard includes controls to allocate coins to Operators

### 8.3 Transaction History

- Available to SuperAdmin, Admin, and Operator roles
- Shows all incoming and outgoing transactions
- Color-coded for received (green) and sent (red) transactions

## 9. System Initialization

- SuperAdmin account is initialized with 1,000,000 coins during system setup
- When creating an Admin, 1000 coins are allocated by default
- When creating an Operator, 200 coins are allocated by default

## 10. Restrictions

- Only specific roles (SuperAdmin, Admin, Operator) have coin balances
- Company and Guard roles have no coin functionality
- Users cannot transfer coins to themselves
- Transaction amounts must be positive
- Transfers cannot exceed the sender's available balance
- Operators must have at least 1 coin to create a session
- Specific role-based restrictions on who can allocate coins to whom

## 11. Activity Logging

All coin transactions are logged in the activity log system with:
- Transaction details
- Sender and recipient information
- Amount
- Reason
- Timestamp 