# CBUMS Session System Reference Document

## Table of Contents
1. [Session Core Concepts](#session-core-concepts)
2. [Session Workflow](#session-workflow)
3. [Access Control Matrix](#access-control-matrix)
4. [Company Isolation Rules](#company-isolation-rules)
5. [Functional Requirements](#functional-requirements)
6. [Security Guidelines](#security-guidelines)

## Session Core Concepts

### Definition and Structure
- Sessions represent tracked business processes with defined source and destination
- Each session is owned by exactly one COMPANY
- Sessions contain verification data points that must be confirmed
- Sessions utilize a seal component for security verification

### Key Components
- **Session Metadata**: ID, creation time, status, source, destination
- **Company Association**: The single company that owns the session
- **Creator Info**: OPERATOR who created the session
- **Verification Points**: Data points requiring verification
- **Seal Component**: Security mechanism with barcode scanning
- **Comment History**: Communication record between stakeholders

## Session Workflow

### Creation Phase
- Sessions can ONLY be created by OPERATORS
- OPERATORS must be associated with the session's COMPANY
- OPERATORS define all required verification data points
- Initial session status is unverified/pending

### Verification Phase
- Verification can ONLY be performed by GUARDS
- GUARDS must be associated with the session's COMPANY
- GUARDS verify seal information (typically via barcode)
- GUARDS must verify all data points set by the OPERATOR

### Completion Standards
- Sessions are only complete when ALL verification points are confirmed
- Completed sessions create a full audit trail from creation to verification
- Session status changes to verified/complete upon successful verification

## Access Control Matrix

| Role | Session Creation | Session Verification | Session Visibility | Report Generation |
|------|------------------|----------------------|-------------------|-------------------|
| SUPERADMIN | No | No | ALL sessions | ALL sessions |
| ADMIN | No | No | Only sessions for companies created by them | Same as visibility |
| COMPANY | No | No | Only their own sessions | Only their own sessions |
| OPERATOR | Yes (own company only) | No | Only sessions they created | Only sessions they created |
| GUARD | No | Yes (own company only) | Only sessions they verified | Only sessions they verified |

## Company Isolation Rules

### Session Containment
- Each session belongs to exactly ONE company
- No cross-company visibility or access is permitted
- Sessions are fully isolated within company boundaries

### Employee Restrictions
- **OPERATORS**:
  - Can ONLY create sessions for their associated company
  - Cannot view or interact with sessions from other companies
  - Session creation is restricted to company-associated OPERATORS

- **GUARDS**:
  - Can ONLY verify sessions for their associated company
  - Cannot view or interact with sessions from other companies
  - Verification is limited to company-associated GUARDS

## Functional Requirements

### Session Creation
- Interface for OPERATORS to define verification data points
- Company association must be automatically applied
- Seal generation and management functionality
- Status tracking from creation through verification

### Session Verification
- Interface for GUARDS to review and verify data points
- Barcode scanning for seal verification
- Completion tracking for all verification points
- Status updates based on verification progress

### Reporting & Documentation
- PDF and Excel report generation
- Complete session history and details
- Comment history inclusion
- Proper access controls on report generation

## Security Guidelines

### Separation of Duties
- Creation (OPERATORS) and verification (GUARDS) must be separate
- No single role can both create and verify a session
- Administrative roles have visibility but not creation/verification abilities

### Access Enforcement
- Strict role-based access control for all session operations
- Company-based isolation for OPERATOR and GUARD roles
- Hierarchical visibility structure for administrative roles

### Audit Requirements
- Complete tracking of all session-related activities
- Documentation at each stage of the process
- Timestamp and user information for all actions
- Non-repudiation of creation and verification steps 