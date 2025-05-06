# CBUMS - Coin Based User Management System

A role-based application with 4 major roles: SuperAdmin, Admin, Company, and Employee. This system includes coin allocation and management features.

## Features

- **Role-based Access Control**: SuperAdmin, Admin, Company, and Employee roles
- **User Management**: Create and manage users based on roles
- **Coin System**: Transfer coins between users and track transactions
- **Company Management**: Create companies and assign employees

## Tech Stack

- **Frontend**: Next.js with App Router, React, TailwindCSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: NextAuth.js

## Prerequisites

- Node.js 18+
- PostgreSQL database

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd cbums
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the `.env.example` file to `.env` and update the values:

```bash
cp .env.example .env
```

Make sure to set your PostgreSQL connection string in the `DATABASE_URL` environment variable.

### 4. Set up the database

```bash
# Run migrations to create database tables
npm run migrate

# Seed the database with initial data (creates a SuperAdmin user)
npm run db:seed
```

### 5. Start the development server

```bash
npm run dev
```

## Default SuperAdmin Credentials

- **Email**: superadmin@cbums.com
- **Password**: superadmin123

## Project Structure

```
cbums/
├── app/                   # Next.js App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   └── page.tsx           # Home page (login)
├── components/            # React components
│   ├── auth/              # Authentication components
│   └── dashboard/         # Dashboard components
├── lib/                   # Utilities and helpers
│   ├── prisma.ts          # Prisma client
│   ├── auth.ts            # Auth utilities
│   └── types.ts           # TypeScript types
└── prisma/                # Prisma ORM
    ├── schema.prisma      # Database schema
    └── seed.ts            # Database seed
```

## Role Hierarchy and Permissions

- **SuperAdmin**: Can create Admin users
- **Admin**: Can create Companies and Employees
- **Company**: Can view and manage assigned Employees
- **Employee**: Can view their profile and coin transactions

## License

[MIT](LICENSE)
