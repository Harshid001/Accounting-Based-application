# Accounting Business App (AFMS)

## Project Overview
The **Accounting Business App** (AFMS - Accounting Firm Management System) is a comprehensive, multi-platform application designed to streamline operations for accounting firms. It manages clients, compliance tasks, document storage, and team workflows.

## Current Status: Completed Features

The following features have been fully implemented and are currently functional in the application:

*   ✅ **Authentication & Role-Based Access Control:**
    *   Secure login and registration workflows.
    *   NextAuth integration handling both custom credentials and Google OAuth.
    *   Native mobile Google authentication via Capacitor plugins.
    *   A "Pending Approval" system for new user registrations before they can access the platform.
*   ✅ **Dashboard Interface:**
    *   A central dashboard UI for users after they log in, providing navigation to all primary modules.
*   ✅ **Client Management:**
    *   Full CRUD (Create, Read, Update, Delete) APIs and UI components to manage Individual and Business clients.
*   ✅ **Compliance Management:**
    *   Tracking compliance items (GST, Income Tax, etc.) for clients.
    *   APIs and UI for managing compliance statuses and deadlines.
*   ✅ **Task Management:**
    *   Internal task creation and assignment to firm employees.
    *   Linking tasks to specific clients or compliance items.
*   ✅ **Document Management & Storage:**
    *   Uploading and managing client documents.
    *   Integration with S3-compatible cloud storage (Supabase/Cloudflare R2) via AWS SDK.
*   ✅ **User & Service Management:**
    *   Admin interfaces for managing internal users/staff and defining services offered by the firm.

## Architecture & Tech Stack

### Core Technologies
*   **Framework:** Next.js (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS, Lucide React (Icons), UI components
*   **Database ORM:** Prisma
*   **Database Engine:** PostgreSQL
*   **Authentication:** NextAuth (Web), Capacitor Google Auth (Mobile), Custom Credentials & Google OAuth.
*   **Storage:** S3-Compatible Storage (AWS SDK `@aws-sdk/client-s3`) configured for Supabase/Cloudflare R2 for storing client documents.

### Multi-Platform Support
The application is built with a single codebase that targets three platforms:
1.  **Web:** Standard Next.js web application.
2.  **Mobile (Android/iOS):** Powered by **Capacitor** (`@capacitor/core`, `@capacitor/android`). Includes specific plugins like Google Auth for native login.
3.  **Desktop:** Powered by **Electron** (`electron`, `electron-builder`) using `main.js` as the entry point.

### Progressive Web App (PWA)
*   Uses `@ducanh2912/next-pwa` for PWA capabilities, configurable via `next.config.ts` and `manifest.ts`.

## Core Domain Models (Database Schema)

The database schema (`prisma/schema.prisma`) revolves around several key entities:

### 1. Users & Roles
*   **User:** Represents both firm employees and clients.
*   **Roles:** `ADMIN`, `MANAGER`, `ACCOUNTANT`, `DATA_ENTRY`, `CLIENT`.
*   Users authenticate via `CREDENTIALS` or `GOOGLE`.
*   Users can be assigned to multiple clients (Accountants/Managers).

### 2. Clients
*   **ClientType:** `INDIVIDUAL` or `BUSINESS`.
*   **Details stored:** PAN, GSTIN, TAN, Address.
*   **Status:** `ACTIVE`, `INACTIVE`, `ONBOARDING`.

### 3. Compliance & Services
*   **Service:** Catalog of services offered (e.g., Bookkeeping, Audit).
*   **ServiceSubscription:** Links a client to a specific service they are subscribed to.
*   **ComplianceItem:** Specific regulatory tasks for a client.
    *   *Types:* `GST`, `INCOME_TAX`, `SALES_TAX_VAT`, `TDS`.
    *   *Status:* `PENDING`, `IN_PROGRESS`, `FILED`, `ACKNOWLEDGED`.

### 4. Documents & Storage
*   **Document:** Represents a file uploaded to S3/Supabase storage.
*   *Types:* `PURCHASE_INVOICE`, `SALES_INVOICE`, `BANK_STATEMENT`, `TAX_DOCUMENT`, `INCOME_PROOF`, `EXPENSE_DOCUMENT`, `AUDIT_DOCUMENT`.
*   Documents are linked to specific clients and optionally to specific `ComplianceItems`.

### 5. Task Management
*   **Task:** Internal workflows and to-dos assigned to staff.
*   *Status:* `NOT_STARTED`, `IN_PROGRESS`, `REVIEW`, `DONE`.
*   Tasks can be linked to a `Client` or a specific `ComplianceItem`.

### 6. Audit & Tracking
*   **AuditLog:** Tracks changes (`CREATE`, `UPDATE`, `STATUS_CHANGE`) across entities like `ComplianceItem`, `Document`, and `Client` for accountability.

## Project Structure (Key Directories & Files)

*   `src/app/`: Next.js App Router containing all the pages and API routes.
    *   `/api`: Backend endpoints (Next.js API routes).
    *   `/dashboard`: Main application interface post-login.
    *   `/login`: Authentication pages.
    *   `/pending-approval`: View for newly registered users waiting for admin approval.
*   `src/components/`: Reusable React components (UI, Layouts, Forms).
*   `src/lib/`: Utility functions, Prisma client initialization, NextAuth configuration.
*   `prisma/`: Contains `schema.prisma` (DB schema), migrations, and `seed.ts` (database seeding script).
*   `android/`: Native Android project generated by Capacitor.
*   `scripts/`: Utility scripts (e.g., permissions verification).

## Key Configuration Files
*   `capacitor.config.ts`: Configuration for the mobile app wrapper, including Google Auth plugin setup.
*   `package.json`: Lists all dependencies and custom run scripts (`dev`, `android:dev`, `desktop:dev`).
*   `next.config.ts`: Next.js configuration.
*   `tailwind.config.ts`: Tailwind CSS theme and styling rules.
*   `main.js`: Electron desktop application entry point.

## Development Workflow & Scripts

*   **Web Development:** `npm run dev`
*   **Mobile (Android) Development:** `npm run android:dev` (runs Next.js alongside Capacitor).
*   **Desktop Development:** `npm run desktop:dev` (runs Electron).
*   **Database Management:** Use Prisma CLI (`npx prisma generate`, `npx prisma db push`, `npx prisma migrate dev`).
