# Software Requirements Specification
# Activity Logs System

## 1. Introduction

### 1.1 Purpose
This document specifies the software requirements for the Activity Logs system within the CBUMS application. The Activity Logs system provides a comprehensive audit trail of user activities, ensuring transparency, accountability, and security across the platform.

### 1.2 Scope
The Activity Logs system tracks, stores, and displays user actions across the CBUMS platform. It covers authentication events, resource manipulations, and system interactions with role-based visibility controls. This document defines the functional and non-functional requirements for this feature.

### 1.3 Definitions, Acronyms and Abbreviations
- **CBUMS**: Coin-Based User Management System
- **SRS**: Software Requirements Specification
- **UI**: User Interface
- **API**: Application Programming Interface
- **JWT**: JSON Web Token
- **CRUD**: Create, Read, Update, Delete

## 2. Overall Description

### 2.1 Product Perspective
The Activity Logs system is a component of the CBUMS platform that provides audit capabilities for system operations. It integrates with the authentication system, user management, and all resource operations to create a comprehensive record of activities.

### 2.2 Product Functions
The Activity Logs system shall:
- Record user authentication events (login/logout) along with what device they use to login (mobile / desktop).
- Track resource creation, modification, and deletion
- Monitor financial transactions and coin allocations
- Provide a filtered view of activities based on user roles
- Support searching and filtering of activity data
- Display detailed information about each activity

### 2.3 User Classes and Characteristics
The system supports four user roles with distinct access levels:

| Role | Description | Access Level |
|------|-------------|--------------|
| SUPERADMIN | System administrators | Complete access to all activities |
| ADMIN | Platform administrators | Access to activities of users they created |
| COMPANY | Company account managers | Access to company and associated employee activities |
| EMPLOYEE | End users of the system | Access to only their own activities |

### 2.4 Operating Environment
- Web-based application accessible via modern browsers
- Backend using Node.js/Next.js
- Database using PostgreSQL with Prisma ORM
- Authentication via NextAuth with JWT

### 2.5 Design and Implementation Constraints
- Must maintain strict data isolation between tenants
- Performance must scale with increasing log volume
- Must ensure immutability of log records
- Logging operations must not impact critical path operations

### 2.6 Assumptions and Dependencies
- Relies on existing user authentication system
- Depends on accurate role-based access control
- Assumes database capacity for long-term log storage

## 3. Specific Requirements

### 3.1 External Interface Requirements

#### 3.1.1 User Interfaces
The Activity Logs UI shall:
- Provide a tabular view of activity records
- Include filters for action type, date range, and user ID (role-dependent)
- Support pagination for large result sets
- Display loading indicators during data retrieval
- Present empty state messages when no logs match criteria
- Include navigation back to the main dashboard

#### 3.1.2 API Interfaces
The Activity Logs API shall:
- Accept requests at `/api/activity-logs`
- Support query parameters for filtering and pagination
- Return JSON response with logs and metadata
- Enforce role-based access controls on the server side
- Return appropriate HTTP status codes for various conditions

### 3.2 Functional Requirements

#### 3.2.1 Activity Logging

| ID | Requirement |
|----|-------------|
| F1.1 | The system shall log successful user authentication events (logins) |
| F1.2 | The system shall capture the IP address and user agent for each login event |
| F1.3 | The system shall record resource creation events with relevant metadata |
| F1.4 | The system shall record resource update events with changed field information |
| F1.5 | The system shall record resource deletion events with identifier information |
| F1.6 | The system shall log financial transactions with source, target, and amount details |
| F1.7 | The system shall support custom activity types for domain-specific operations |
| F1.8 | Log creation shall be non-blocking for critical path operations |
| F1.9 | The system shall log user logout events with timestamp information |
| F1.10 | The system shall determine and record device type (mobile or desktop) for all login events |

#### 3.2.2 Activity Viewing

| ID | Requirement |
|----|-------------|
| F2.1 | SUPERADMIN users shall be able to view all system activities |
| F2.2 | ADMIN users shall be able to view activities for users they created |
| F2.3 | COMPANY users shall be able to view activities for their organization's employees |
| F2.4 | EMPLOYEE users shall be able to view only their own activities |
| F2.5 | The system shall display the user who performed each activity |
| F2.6 | The system shall display the action type for each activity |
| F2.7 | The system shall display the timestamp for each activity |
| F2.8 | The system shall display relevant details specific to each activity type |
| F2.9 | The system shall support pagination of activity records |
| F2.10 | The system shall clearly display device type (mobile or desktop) for login events |
| F2.11 | Login and logout times shall be prominently displayed in the activity view |

#### 3.2.3 Activity Filtering

| ID | Requirement |
|----|-------------|
| F3.1 | Users shall be able to filter activities by action type |
| F3.2 | Users shall be able to filter activities by date range |
| F3.3 | SUPERADMIN and ADMIN users shall be able to filter activities by specific user ID |
| F3.4 | Users shall be able to reset all filters to default values |
| F3.5 | Filter changes shall trigger re-querying of activity data |
| F3.6 | Filters shall persist within a user session |

### 3.3 Non-Functional Requirements

#### 3.3.1 Performance

| ID | Requirement |
|----|-------------|
| NF1.1 | The system shall display activity logs within 2 seconds of page load |
| NF1.2 | Filtering operations shall complete within 1 second |
| NF1.3 | Log creation shall not add more than 100ms latency to core operations |
| NF1.4 | The system shall support at least 10,000 log entries per day |
| NF1.5 | Pagination shall support efficient retrieval of records from large datasets |

#### 3.3.2 Security

| ID | Requirement |
|----|-------------|
| NF2.1 | All activity log access shall require authentication |
| NF2.2 | Activity logs shall enforce strict visibility boundaries between tenants |
| NF2.3 | Log content shall be protected from unauthorized viewing |
| NF2.4 | Log records shall be immutable after creation |
| NF2.5 | Failed authentication attempts shall not reveal existence of logs |

#### 3.3.3 Reliability

| ID | Requirement |
|----|-------------|
| NF3.1 | Failure of the logging system shall not impact core application functions |
| NF3.2 | Log creation shall be retried once on failure before being abandoned |
| NF3.3 | Log query failures shall be gracefully handled with user feedback |
| NF3.4 | The system shall maintain a 99.9% success rate for log creation |

#### 3.3.4 Usability

| ID | Requirement |
|----|-------------|
| NF4.1 | The activity log interface shall be accessible on both desktop and mobile devices |
| NF4.2 | Filter controls shall be clearly labeled and intuitive |
| NF4.3 | Activity types shall be displayed in human-readable format |
| NF4.4 | Timestamps shall be displayed in user-friendly format (today, yesterday, or date) |
| NF4.5 | Empty states shall provide clear feedback when no logs match criteria |
| NF4.6 | Device type for login events shall be displayed with recognizable icons (mobile/desktop) |

## 4. Data Models

### 4.1 Activity Log Entity

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique identifier for the log entry |
| userId | UUID | ID of user who performed the action |
| action | Enum | Type of action (LOGIN, CREATE, UPDATE, etc.) |
| details | JSON | Action-specific details and context |
| targetUserId | UUID | ID of user affected by the action (if applicable) |
| targetResourceId | UUID | ID of resource affected (if applicable) |
| targetResourceType | String | Type of resource affected (if applicable) |
| ipAddress | String | Source IP address (for authentication events) |
| userAgent | String | Browser/client information (for authentication events) |
| createdAt | DateTime | When the activity occurred |

### 4.2 Activity Action Types

| Action | Description |
|--------|-------------|
| CREATE | Resource creation operations |
| UPDATE | Resource modification operations |
| DELETE | Resource deletion operations |
| LOGIN | User authentication events |
| LOGOUT | User sign-out events |
| TRANSFER | Coin transfer between users |
| ALLOCATE | Coin allocation operations |
| VIEW | Resource viewing operations |

## 5. Access Control Matrix

| Operation | SUPERADMIN | ADMIN | COMPANY | EMPLOYEE |
|-----------|------------|-------|---------|----------|
| View all activities | ✅ | ❌ | ❌ | ❌ |
| View created users' activities | ✅ | ✅ | ❌ | ❌ |
| View company employees' activities | ✅ | ✅ | ✅ | ❌ |
| View own activities | ✅ | ✅ | ✅ | ✅ |
| Filter by specific user | ✅ | ✅ | ❌ | ❌ |
| Filter by action type | ✅ | ✅ | ✅ | ✅ |
| Filter by date range | ✅ | ✅ | ✅ | ✅ |

## 6. Appendices

### 6.1 Related Documents
- [Session System Reference](./session-system-reference.md)
- User Authentication Specification
- Role-Based Access Control Specification

### 6.2 Technical Implementation Notes
- Activity logs are stored in the `activity_logs` table in the database
- Login tracking is implemented in NextAuth's `authorize` callback
- Visibility permissions are calculated dynamically based on user relationships
- The API leverages Prisma's query capabilities for efficient filtering 