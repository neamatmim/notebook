# notebook

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Start, Self, ORPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Start** - SSR framework with TanStack Router
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **oRPC** - End-to-end type-safe APIs with OpenAPI integration
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system
- **Husky** - Git hooks for code quality

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/web/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:

```bash
bun run db:push
```

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the fullstack application.

## Git Hooks and Formatting

- Initialize hooks: `bun run prepare`

## Project Structure

```
notebook/
├── apps/
│   └── web/         # Fullstack application (React + TanStack Start)
├── packages/
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run check-types`: Check TypeScript types across all apps
- `bun run db:push`: Push schema changes to database
- `bun run db:generate`: Generate database client/types
- `bun run db:migrate`: Run database migrations
- `bun run db:studio`: Open database studio UI

<!-- "env": ["SERVER_*", "VITE_*"] -->
 <!-- "//#check": {},
    "//#fix": {
      "cache": false
    }, -->

<!-- Here is the full enterprise audit. The system is a functional MVP but needs hardening before production use.

  ---
  Inventory System Audit

  Overall Verdict: ~65% Production-Ready

  ---
  What's Solid ✅

  ┌─────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────┐
  │              Area               │                                   Detail                                    │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
  │ Core CRUD                       │ Categories, Suppliers, Products, Variants, Locations — all with soft-delete │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
  │ Purchase Order lifecycle        │ draft → ordered → partial/received + payment tracking                       │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
  │ Partial payments                │ poPayments table, running total, partially_paid/paid derivation             │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
  │ Stock movements audit log       │ Every change recorded with before/after quantities, userId, reference       │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
  │ FIFO / Weighted-avg / Last-cost │ Cost method selectable globally; layers tracked in costLayers               │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
  │ POS ↔ Inventory                 │ Sales decrement stock, FIFO layers consumed, returns restore them           │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
  │ Accounting on receipt           │ DR Inventory 1200 / CR AP 2000 posted on PO receipt                         │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
  │ Accounting on payment           │ DR AP 2000 / CR Cash 1000 posted on payment                                 │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
  │ Input validation                │ Zod on every procedure with UUID, email, min/max guards                     │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────┤
  │ Graceful degradation            │ Accounting failures caught silently; inventory ops still succeed            │
  └─────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────┘

  ---
  Critical Issues 🔴

  1. COGS Never Posted

  When POS sells a product, stock decrements but no cost-of-goods-sold journal entry is created. The books show revenue
   with no matching expense — P&L is wrong.

  Fix: In pos.ts checkout, after stock deduction, post:
  DR  Cost of Goods Sold (5000)  = cost × qty
  CR  Inventory (1200)           = cost × qty

  2. No Unique Constraint on stock_levels

  No database-level unique index on (productId, variantId, locationId). Two concurrent inserts can create duplicate
  rows; the LIMIT 1 fallback picks arbitrarily.

  Fix: Add a unique constraint (or partial unique index for NULL locationId).

  3. PO Number Race Condition

  PO-${Date.now()} — two concurrent creates at the same millisecond produce the same PO number. The unique constraint
  will throw an unhandled DB error.

  Fix: Use a DB sequence or append a random suffix.

  ---
  High-Severity Issues 🟠

  4. Stock Adjustments Don't Create Accounting Entries

  Manual adjustments (damaged, expired, shrinkage) decrement inventory but never post a variance entry (DR Inventory
  Variance / CR Inventory). The balance sheet stays wrong indefinitely.

  5. Shipping Cost & Purchase Tax Never Journalised

  shippingCost and taxAmount exist on purchaseOrders but only sit in the DB — no journal entry includes them.
  Freight-in cost is entirely absent from accounting.

  6. productVariants.stockQuantity Is a Stale Denormalization

  That column is never updated by any procedure. Sales hit stockLevels; this field diverges immediately. Either
  synchronise it or remove it.

  7. Reserved Quantity Not Enforced

  stockLevels.reservedQuantity column exists but nothing prevents a sale from consuming reserved stock. Under
  concurrency the system can oversell.

  8. No Role-Based Access Control

  Every procedure requires authentication but has no role checks. A cashier can receive a PO, adjust stock, change cost
   method, or void a journal entry.

  9. Inactive Suppliers / Products Not Guarded

  A PO can be created for an inactive supplier. A product with status = "discontinued" can still be added to a PO. No
  guard clauses.

  ---
  Medium Issues 🟡

  #: 10
  Issue: Transfer orders missing — stockMovements.type = "transfer" enum value exists but no procedure creates one.
    Can't formally move stock between locations.
  ────────────────────────────────────────
  #: 11
  Issue: Cost method change has no revaluation — switching from FIFO → weighted-average mid-operation leaves old layers

    inconsistent.
  ────────────────────────────────────────
  #: 12
  Issue: Weighted-avg precision — toFixed(4) accumulates rounding errors at scale. NUMERIC arithmetic should stay in
  the
    DB.
  ────────────────────────────────────────
  #: 13
  Issue: purchaseOrderItems has no locationId — all items in a PO receive to the same location; multi-location splits
  on
     a single PO are impossible.
  ────────────────────────────────────────
  #: 14
  Issue: No FIFO cost layer consumption on POS adjustment/return to supplier — only POS sales and PO receipts interact
    with layers.
  ────────────────────────────────────────
  #: 15
  Issue: Low-stock detection logic is broken — the dashboard filter checks minStockLevel > 0 AND reorderPoint > 0 but
    never compares actual stock quantity against those thresholds.
  ────────────────────────────────────────
  #: 16
  Issue: Soft deletes don't cascade — deleting a category doesn't unlink products from it; deleting a supplier doesn't
    flag their products.
  ────────────────────────────────────────
  #: 17
  Issue: No index on (productId, remainingQuantity, receivedAt) on costLayers — FIFO lookup will full-scan on large
    catalogs.
  ────────────────────────────────────────
  #: 18
  Issue: Payment transitions not guarded — nothing prevents paid → lower status; overpayment (amountPaid > totalAmount)

    is allowed.

  ---
  Missing Enterprise Features 📋

  ┌───────────────────────────────────────────┬──────────────────────────────┐
  │                  Feature                  │            Status            │
  ├───────────────────────────────────────────┼──────────────────────────────┤
  │ Physical inventory count / cycle counting │ ❌ Not started               │
  ├───────────────────────────────────────────┼──────────────────────────────┤
  │ Batch / lot / serial number tracking      │ ❌ Not started               │
  ├───────────────────────────────────────────┼──────────────────────────────┤
  │ Expiration date management                │ ❌ Not started               │
  ├───────────────────────────────────────────┼──────────────────────────────┤
  │ Inter-warehouse transfer orders           │ ❌ Enum exists, no procedure │
  ├───────────────────────────────────────────┼──────────────────────────────┤
  │ Landed cost allocation (freight, duties)  │ ❌ Not started               │
  ├───────────────────────────────────────────┼──────────────────────────────┤
  │ Multi-currency pricing                    │ ❌ Not started               │
  ├───────────────────────────────────────────┼──────────────────────────────┤
  │ Reorder automation (auto-create draft PO) │ ❌ Not started               │
  ├───────────────────────────────────────────┼──────────────────────────────┤
  │ Bundle / kit management                   │ ❌ Not started               │
  ├───────────────────────────────────────────┼──────────────────────────────┤
  │ Consignment stock                         │ ❌ Not started               │
  ├───────────────────────────────────────────┼──────────────────────────────┤
  │ Demand forecasting                        │ ❌ Not started               │
  ├───────────────────────────────────────────┼──────────────────────────────┤
  │ Bulk CSV import/export                    │ ❌ Not started               │
  ├───────────────────────────────────────────┼──────────────────────────────┤
  │ Barcode scanner integration               │ ❌ Not started               │
  └───────────────────────────────────────────┴──────────────────────────────┘

  ---
  Priority Fix List

  ┌──────────┬────────────────────────────────────────────────────────────────────────────┐
  │ Priority │                                    Fix                                     │
  ├──────────┼────────────────────────────────────────────────────────────────────────────┤
  │ 🔴 1     │ Post COGS journal entry on every sale                                      │
  ├──────────┼────────────────────────────────────────────────────────────────────────────┤
  │ 🔴 2     │ Add unique DB constraint on stock_levels(productId, variantId, locationId) │
  ├──────────┼────────────────────────────────────────────────────────────────────────────┤
  │ 🔴 3     │ Fix PO number generation (sequence/UUID suffix)                            │
  ├──────────┼────────────────────────────────────────────────────────────────────────────┤
  │ 🟠 4     │ Post inventory variance entries on stock adjustments                       │
  ├──────────┼────────────────────────────────────────────────────────────────────────────┤
  │ 🟠 5     │ Journal shipping cost and purchase tax                                     │
  ├──────────┼────────────────────────────────────────────────────────────────────────────┤
  │ 🟠 6     │ Remove or synchronise productVariants.stockQuantity                        │
  ├──────────┼────────────────────────────────────────────────────────────────────────────┤
  │ 🟠 7     │ Add RBAC (at minimum: admin vs. staff roles)                               │
  ├──────────┼────────────────────────────────────────────────────────────────────────────┤
  │ 🟠 8     │ Guard PO create/receive against cancelled/inactive supplier                │
  ├──────────┼────────────────────────────────────────────────────────────────────────────┤
  │ 🟡 9     │ Fix low-stock threshold logic                                              │
  ├──────────┼────────────────────────────────────────────────────────────────────────────┤
  │ 🟡 10    │ Add transfer order procedure                                               │
  └──────────┴────────────────────────────────────────────────────────────────────────────┘

  ---
  Bottom line: The foundation — schema design, transactional stock mutations, cost methods, partial payments, and
  accounting hooks — is well-architected. The three critical gaps (COGS posting, stock_levels uniqueness, PO number
  safety) need to be fixed before going live. The RBAC gap is the most significant operational risk. -->

<!-- we want to build an full fledged Enterprise grade highly scalable ERP solution which can be used by any business, any govrnment organization we need to serve them with the best possible ERP solution. we need to serve 1000 of clients and they will have different requirements and different workflows and different business logic. so we need to build a solution which is highly flexible and customizable. configurable. think hard and design a solution which can serve all the requirements of all the clients.  -->
