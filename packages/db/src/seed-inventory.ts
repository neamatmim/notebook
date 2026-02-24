/**
 * Inventory Test Seed
 * -------------------
 * Creates realistic inventory data for manual testing.
 *
 * Run with: bun run src/seed-inventory.ts
 *
 * Scenarios covered:
 *  - Category hierarchy (parent → child)
 *  - Suppliers with payment terms (active + suspended)
 *  - 3 locations: Main Store, Warehouse, Back Room
 *  - 8 products across categories, with reorder points
 *  - 6 purchase orders (received, approved, pending, draft)
 *  - Cost layers / batches: some expiring in <30 days (triggers Expiring Soon)
 *  - Stock levels: some products below reorder point (triggers Low Stock)
 *  - Stock movements: transfers, adjustments, sales
 *  - 1 completed cycle count + 1 in-progress cycle count
 *  - Inventory settings: FIFO cost method
 */

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

// Must load env before any module that reads process.env at evaluation time.
// We bypass @notebook/db/index (which goes through @notebook/env) and create
// a direct Drizzle connection using the .env file from the web app.
config({ path: "../../apps/web/.env" });

const db = drizzle(process.env.DATABASE_URL!, { schema });

const {
  categories,
  costLayers,
  cycleCountLines,
  cycleCounts,
  inventorySettings,
  locations,
  products,
  purchaseOrderItems,
  purchaseOrders,
  stockLevels,
  stockMovements,
  suppliers,
} = schema;

// ─── Date helpers ──────────────────────────────────────────────────────────
const now = new Date();

function daysFromNow(n: number) {
  const d = new Date(now);
  d.setDate(d.getDate() + n);
  return d;
}

function daysAgo(n: number) {
  return daysFromNow(-n);
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function seed() {
  console.log("🌱  Seeding inventory test data…\n");

  // ── 1. Inventory settings ──────────────────────────────────────────────
  console.log("⚙️   Setting cost method to FIFO…");
  await db
    .insert(inventorySettings)
    .values({ costUpdateMethod: "fifo", id: "default" })
    .onConflictDoUpdate({
      set: { costUpdateMethod: "fifo", updatedAt: now },
      target: inventorySettings.id,
    });

  // ── 2. Categories ──────────────────────────────────────────────────────
  console.log("📂  Creating categories…");

  const [catElectronics] = await db
    .insert(categories)
    .values({
      description: "Consumer electronics and accessories",
      name: "Electronics",
    })
    .returning();

  const [catHealth] = await db
    .insert(categories)
    .values({
      description: "Health, wellness, and personal care",
      name: "Health & Beauty",
    })
    .returning();

  const [catFood] = await db
    .insert(categories)
    .values({
      description: "Food and beverage products",
      name: "Food & Beverage",
    })
    .returning();

  // Sub-categories
  const [catSmartphones] = await db
    .insert(categories)
    .values({ name: "Smartphones", parentId: catElectronics!.id })
    .returning();

  const [catLaptops] = await db
    .insert(categories)
    .values({ name: "Laptops", parentId: catElectronics!.id })
    .returning();

  const [catSupplements] = await db
    .insert(categories)
    .values({ name: "Supplements", parentId: catHealth!.id })
    .returning();

  const [catDairy] = await db
    .insert(categories)
    .values({ name: "Dairy", parentId: catFood!.id })
    .returning();

  console.log(`   Created 7 categories (3 parent, 4 child)`);

  // ── 3. Suppliers ───────────────────────────────────────────────────────
  console.log("🏭  Creating suppliers…");

  const [supTechWorld] = await db
    .insert(suppliers)
    .values({
      address: "14 Silicon Drive",
      city: "San Jose",
      contactName: "David Kim",
      country: "USA",
      email: "orders@techworld.com",
      name: "TechWorld Distributors",
      notes: "Priority supplier for electronics. Net 30 payment.",
      paymentTerms: "Net 30",
      paymentTermsDays: 30,
      phone: "(408) 555-0191",
      state: "CA",
      status: "active",
      zipCode: "95110",
    })
    .returning();

  const [supPharma] = await db
    .insert(suppliers)
    .values({
      address: "88 Pharma Blvd",
      city: "Raleigh",
      contactName: "Sandra Moore",
      country: "USA",
      email: "supply@globalpharma.com",
      name: "Global Pharma Supply",
      paymentTerms: "Net 15",
      paymentTermsDays: 15,
      phone: "(919) 555-0144",
      state: "NC",
      status: "active",
      taxId: "TAX-GP-4421",
      zipCode: "27601",
    })
    .returning();

  const [supFresh] = await db
    .insert(suppliers)
    .values({
      address: "3 Coldchain Way",
      city: "Madison",
      contactName: "Carlos Rivera",
      country: "USA",
      email: "orders@freshfoods.com",
      name: "FreshFoods Direct",
      notes: "Cold chain supplier. COD payment required.",
      paymentTerms: "COD",
      paymentTermsDays: 0,
      phone: "(608) 555-0177",
      state: "WI",
      status: "active",
      zipCode: "53703",
    })
    .returning();

  // Suspended supplier — used to test blocked PO creation
  await db.insert(suppliers).values({
    city: "Chicago",
    contactName: "Old Contact",
    country: "USA",
    email: "info@deprecated-parts.com",
    name: "Deprecated Parts Co",
    notes: "SUSPENDED — do not order. Use TechWorld instead.",
    phone: "(312) 555-0100",
    state: "IL",
    status: "suspended",
  });

  console.log(`   Created 4 suppliers (3 active, 1 suspended)`);

  // ── 4. Locations ───────────────────────────────────────────────────────
  console.log("📍  Creating locations…");

  const [locMainStore] = await db
    .insert(locations)
    .values({
      address: "100 Main Street",
      city: "Austin",
      country: "USA",
      isActive: true,
      isPrimary: true,
      name: "Main Store",
      state: "TX",
      type: "retail",
      zipCode: "78701",
    })
    .returning();

  const [locWarehouse] = await db
    .insert(locations)
    .values({
      address: "500 Industrial Blvd",
      city: "Austin",
      country: "USA",
      isActive: true,
      isPrimary: false,
      name: "Warehouse A",
      state: "TX",
      type: "warehouse",
      zipCode: "78702",
    })
    .returning();

  await db
    .insert(locations)
    .values({
      address: "100 Main Street (rear)",
      city: "Austin",
      country: "USA",
      isActive: true,
      isPrimary: false,
      name: "Back Room",
      state: "TX",
      type: "storage",
      zipCode: "78701",
    })
    .returning();

  console.log(`   Created 3 locations`);

  // ── 5. Products ────────────────────────────────────────────────────────
  console.log("📦  Creating products…");

  const [prodIphone] = await db
    .insert(products)
    .values({
      barcode: "190199699939",
      categoryId: catSmartphones!.id,
      costPrice: "749.00",
      description:
        "6.1-inch Super Retina XDR display, 48MP camera, A17 Pro chip",
      name: "iPhone 15 Pro",
      reorderPoint: 10,
      reorderQuantity: 25,
      sellingPrice: "999.00",
      sku: "IPHONE-15-PRO",
      status: "active",
      supplierId: supTechWorld!.id,
      unit: "pcs",
    })
    .returning();

  const [prodMacbook] = await db
    .insert(products)
    .values({
      barcode: "194253527473",
      categoryId: catLaptops!.id,
      costPrice: "899.00",
      description: "13-inch Liquid Retina display, M3 chip, 8GB RAM, 256GB SSD",
      name: "MacBook Air M3",
      reorderPoint: 5,
      reorderQuantity: 10,
      sellingPrice: "1299.00",
      sku: "MACBOOK-AIR-M3",
      status: "active",
      supplierId: supTechWorld!.id,
      unit: "pcs",
    })
    .returning();

  const [prodUsbCable] = await db
    .insert(products)
    .values({
      barcode: "840276194802",
      categoryId: catElectronics!.id,
      costPrice: "3.50",
      description: "2m USB-C to USB-C braided cable, 100W fast charge",
      name: "USB-C Cable 2m",
      reorderPoint: 30,
      reorderQuantity: 100,
      sellingPrice: "12.99",
      sku: "USBC-CABLE-2M",
      status: "active",
      supplierId: supTechWorld!.id,
      unit: "pcs",
    })
    .returning();

  const [prodVitaminD] = await db
    .insert(products)
    .values({
      barcode: "306720898002",
      categoryId: catSupplements!.id,
      costPrice: "8.50",
      description: "Vitamin D3 2000 IU — 90 softgel capsules per bottle",
      name: "Vitamin D3 2000 IU",
      reorderPoint: 40,
      reorderQuantity: 120,
      sellingPrice: "19.99",
      sku: "VIT-D3-2000",
      status: "active",
      supplierId: supPharma!.id,
      taxable: true,
      unit: "bottles",
    })
    .returning();

  const [prodOmega3] = await db
    .insert(products)
    .values({
      barcode: "306720801003",
      categoryId: catSupplements!.id,
      costPrice: "12.00",
      description: "Omega-3 Fish Oil 1000mg — 60 softgels per bottle",
      name: "Omega-3 Fish Oil 1000mg",
      reorderPoint: 30,
      reorderQuantity: 80,
      sellingPrice: "29.99",
      sku: "OMEGA3-1000",
      status: "active",
      supplierId: supPharma!.id,
      unit: "bottles",
    })
    .returning();

  const [prodMilk] = await db
    .insert(products)
    .values({
      categoryId: catDairy!.id,
      costPrice: "1.20",
      description: "Organic whole milk, 1 litre carton",
      name: "Organic Whole Milk 1L",
      reorderPoint: 20,
      reorderQuantity: 60,
      sellingPrice: "2.99",
      sku: "MILK-ORG-1L",
      status: "active",
      supplierId: supFresh!.id,
      unit: "cartons",
    })
    .returning();

  const [prodYogurt] = await db
    .insert(products)
    .values({
      categoryId: catDairy!.id,
      costPrice: "0.85",
      description: "Greek-style plain yogurt, 500g tub",
      name: "Greek Yogurt 500g",
      reorderPoint: 25,
      reorderQuantity: 80,
      sellingPrice: "2.49",
      sku: "YOGURT-GRK-500",
      status: "active",
      supplierId: supFresh!.id,
      unit: "tubs",
    })
    .returning();

  // Discontinued product — to test it can't be ordered
  await db.insert(products).values({
    categoryId: catElectronics!.id,
    costPrice: "25.00",
    description: "No longer manufactured",
    name: "Lightning Cable 1m (Legacy)",
    reorderPoint: 0,
    sellingPrice: "19.99",
    sku: "LIGHTNING-1M-LEGACY",
    status: "discontinued",
    supplierId: supTechWorld!.id,
    unit: "pcs",
  });

  console.log(`   Created 8 products (7 active, 1 discontinued)`);

  // ── 6. Purchase Orders ─────────────────────────────────────────────────
  // PO-001: TechWorld — RECEIVED 45 days ago
  // PO-002: Global Pharma — RECEIVED 30 days ago (creates expiring batches)
  // PO-003: FreshFoods — RECEIVED 2 days ago (creates near-expiry batches)
  // PO-004: TechWorld — APPROVED (MacBook restock, ready to receive)
  // PO-005: TechWorld — PENDING (iPhone restock, needs approval)
  // PO-006: FreshFoods — DRAFT (yogurt/milk, not yet submitted)

  console.log("🛒  Creating purchase orders…");

  // ─ PO-001 ─────────────────────────────────
  const [po1] = await db
    .insert(purchaseOrders)
    .values({
      createdBy: "seed",
      notes: "Initial stock load — iPhones and USB cables",
      orderDate: daysAgo(50),
      paymentDueDate: daysAgo(20),
      paymentStatus: "paid",
      amountPaid: "62400.00",
      paidAt: daysAgo(45),
      poNumber: "PO-2026-001",
      receivedDate: daysAgo(45),
      status: "received",
      subtotal: "62400.00",
      supplierId: supTechWorld!.id,
      totalAmount: "62400.00",
    })
    .returning();

  // PO-001 items
  await db
    .insert(purchaseOrderItems)
    .values({
      productId: prodIphone!.id,
      purchaseOrderId: po1!.id,
      quantity: 50,
      receivedQuantity: 50,
      totalCost: "37450.00",
      unitCost: "749.00",
    })
    .returning();

  await db
    .insert(purchaseOrderItems)
    .values({
      productId: prodUsbCable!.id,
      purchaseOrderId: po1!.id,
      quantity: 200,
      receivedQuantity: 200,
      totalCost: "700.00",
      unitCost: "3.50",
    })
    .returning();

  // PO-001 cost layers (batches)
  await db
    .insert(costLayers)
    .values({
      locationId: locWarehouse!.id,
      lotNumber: "LOT-IPHONE-001",
      originalQuantity: 50,
      productId: prodIphone!.id,
      receivedAt: daysAgo(45),
      referenceId: po1!.id,
      referenceType: "purchase_order",
      remainingQuantity: 33, // 17 units sold/transferred
      unitCost: "749.00",
    })
    .returning();

  await db
    .insert(costLayers)
    .values({
      locationId: locWarehouse!.id,
      lotNumber: "LOT-USBC-001",
      originalQuantity: 200,
      productId: prodUsbCable!.id,
      receivedAt: daysAgo(45),
      referenceId: po1!.id,
      referenceType: "purchase_order",
      remainingQuantity: 167, // 33 units sold/adjusted
      unitCost: "3.50",
    })
    .returning();

  // ─ PO-002 ─────────────────────────────────
  const [po2] = await db
    .insert(purchaseOrders)
    .values({
      createdBy: "seed",
      notes: "Supplement restock — Vitamin D3 and Omega-3",
      orderDate: daysAgo(35),
      paymentDueDate: daysAgo(20),
      paymentStatus: "paid",
      amountPaid: "3380.00",
      paidAt: daysAgo(28),
      poNumber: "PO-2026-002",
      receivedDate: daysAgo(30),
      status: "received",
      subtotal: "3380.00",
      supplierId: supPharma!.id,
      totalAmount: "3380.00",
    })
    .returning();

  await db.insert(purchaseOrderItems).values([
    {
      productId: prodVitaminD!.id,
      purchaseOrderId: po2!.id,
      quantity: 200,
      receivedQuantity: 200,
      totalCost: "1700.00",
      unitCost: "8.50",
    },
    {
      productId: prodOmega3!.id,
      purchaseOrderId: po2!.id,
      quantity: 140,
      receivedQuantity: 140,
      totalCost: "1680.00",
      unitCost: "12.00",
    },
  ]);

  // Vitamin D3 — BATCH 1: expiring in 14 days (shows in Expiring Soon)
  await db
    .insert(costLayers)
    .values({
      expirationDate: daysFromNow(14),
      locationId: locWarehouse!.id,
      lotNumber: "LOT-VITD-001",
      notes: "First batch — prioritise for sale before LOT-002",
      originalQuantity: 120,
      productId: prodVitaminD!.id,
      receivedAt: daysAgo(30),
      referenceId: po2!.id,
      referenceType: "purchase_order",
      remainingQuantity: 85,
      unitCost: "8.50",
    })
    .returning();

  // Vitamin D3 — BATCH 2: fine, expires in 6 months
  await db
    .insert(costLayers)
    .values({
      expirationDate: daysFromNow(180),
      locationId: locWarehouse!.id,
      lotNumber: "LOT-VITD-002",
      originalQuantity: 80,
      productId: prodVitaminD!.id,
      receivedAt: daysAgo(30),
      referenceId: po2!.id,
      referenceType: "purchase_order",
      remainingQuantity: 80,
      unitCost: "8.50",
    })
    .returning();

  // Omega-3 — expires in 9 months
  await db
    .insert(costLayers)
    .values({
      expirationDate: daysFromNow(270),
      locationId: locWarehouse!.id,
      lotNumber: "LOT-OMEGA-001",
      originalQuantity: 140,
      productId: prodOmega3!.id,
      receivedAt: daysAgo(30),
      referenceId: po2!.id,
      referenceType: "purchase_order",
      remainingQuantity: 112,
      unitCost: "12.00",
    })
    .returning();

  // ─ PO-003 ─────────────────────────────────
  const [po3] = await db
    .insert(purchaseOrders)
    .values({
      createdBy: "seed",
      notes: "Fresh produce restock — Milk and Yogurt",
      orderDate: daysAgo(3),
      paymentDueDate: daysAgo(2), // COD — overdue intentionally for testing
      paymentStatus: "unpaid",
      amountPaid: "0",
      poNumber: "PO-2026-003",
      receivedDate: daysAgo(2),
      status: "received",
      subtotal: "108.25",
      supplierId: supFresh!.id,
      totalAmount: "108.25",
    })
    .returning();

  await db.insert(purchaseOrderItems).values([
    {
      productId: prodMilk!.id,
      purchaseOrderId: po3!.id,
      quantity: 60,
      receivedQuantity: 60,
      totalCost: "72.00",
      unitCost: "1.20",
    },
    {
      productId: prodYogurt!.id,
      purchaseOrderId: po3!.id,
      quantity: 43,
      receivedQuantity: 43,
      totalCost: "36.55",
      unitCost: "0.85",
    },
  ]);

  // Organic Milk — expires in 4 days (CRITICAL: Expiring Soon)
  await db
    .insert(costLayers)
    .values({
      expirationDate: daysFromNow(4),
      locationId: locWarehouse!.id,
      lotNumber: "LOT-MILK-001",
      notes: "Move to store front ASAP",
      originalQuantity: 60,
      productId: prodMilk!.id,
      receivedAt: daysAgo(2),
      referenceId: po3!.id,
      referenceType: "purchase_order",
      remainingQuantity: 42,
      unitCost: "1.20",
    })
    .returning();

  // Greek Yogurt — expires in 9 days (Expiring Soon)
  await db
    .insert(costLayers)
    .values({
      expirationDate: daysFromNow(9),
      locationId: locWarehouse!.id,
      lotNumber: "LOT-YOGURT-001",
      originalQuantity: 43,
      productId: prodYogurt!.id,
      receivedAt: daysAgo(2),
      referenceId: po3!.id,
      referenceType: "purchase_order",
      remainingQuantity: 38,
      unitCost: "0.85",
    })
    .returning();

  // ─ PO-004 — APPROVED (MacBook restock, ready to receive) ──────────────
  const [po4] = await db
    .insert(purchaseOrders)
    .values({
      createdBy: "seed",
      expectedDate: daysFromNow(7),
      notes: "MacBook Air M3 restock — approved, awaiting delivery",
      orderDate: daysAgo(5),
      paymentDueDate: daysFromNow(25),
      paymentStatus: "unpaid",
      amountPaid: "0",
      poNumber: "PO-2026-004",
      status: "approved",
      subtotal: "8990.00",
      supplierId: supTechWorld!.id,
      totalAmount: "8990.00",
    })
    .returning();

  await db.insert(purchaseOrderItems).values({
    productId: prodMacbook!.id,
    purchaseOrderId: po4!.id,
    quantity: 10,
    receivedQuantity: 0,
    totalCost: "8990.00",
    unitCost: "899.00",
  });

  // ─ PO-005 — PENDING (iPhone restock, needs approval) ──────────────────
  const [po5] = await db
    .insert(purchaseOrders)
    .values({
      createdBy: "seed",
      expectedDate: daysFromNow(14),
      notes: "iPhone 15 Pro restock — submitted, awaiting manager approval",
      orderDate: daysAgo(2),
      paymentDueDate: daysFromNow(28),
      paymentStatus: "unpaid",
      amountPaid: "0",
      poNumber: "PO-2026-005",
      status: "pending",
      subtotal: "18725.00",
      supplierId: supTechWorld!.id,
      totalAmount: "18725.00",
    })
    .returning();

  await db.insert(purchaseOrderItems).values({
    productId: prodIphone!.id,
    purchaseOrderId: po5!.id,
    quantity: 25,
    receivedQuantity: 0,
    totalCost: "18725.00",
    unitCost: "749.00",
  });

  // ─ PO-006 — DRAFT (fresh produce, not yet submitted) ──────────────────
  const [po6] = await db
    .insert(purchaseOrders)
    .values({
      createdBy: "seed",
      notes: "Weekly fresh order — draft, not yet sent to FreshFoods",
      orderDate: now,
      paymentStatus: "unpaid",
      amountPaid: "0",
      poNumber: "PO-2026-006",
      status: "draft",
      subtotal: "122.40",
      supplierId: supFresh!.id,
      totalAmount: "122.40",
    })
    .returning();

  await db.insert(purchaseOrderItems).values([
    {
      productId: prodMilk!.id,
      purchaseOrderId: po6!.id,
      quantity: 48,
      receivedQuantity: 0,
      totalCost: "57.60",
      unitCost: "1.20",
    },
    {
      productId: prodYogurt!.id,
      purchaseOrderId: po6!.id,
      quantity: 76,
      receivedQuantity: 0,
      totalCost: "64.60",
      unitCost: "0.85",
    },
  ]);

  console.log(
    `   Created 6 purchase orders (3 received, 1 approved, 1 pending, 1 draft)`
  );

  // ── 7. Stock Levels ────────────────────────────────────────────────────
  // Intentional LOW STOCK scenarios:
  //   iPhone Main Store = 8  (reorder 10) ← LOW
  //   MacBook Main Store = 3  (reorder 5)  ← LOW
  //   Omega-3 Main Store = 5  (reorder 30) ← LOW
  //   Milk  Main Store = 5    (reorder 20) ← LOW
  //   Yogurt Main Store = 7   (reorder 25) ← LOW

  console.log("📊  Creating stock levels…");

  await db.insert(stockLevels).values([
    // iPhone
    {
      availableQuantity: 8,
      locationId: locMainStore!.id,
      productId: prodIphone!.id,
      quantity: 8,
      lastMovementAt: daysAgo(3),
    },
    {
      availableQuantity: 33,
      locationId: locWarehouse!.id,
      productId: prodIphone!.id,
      quantity: 33,
      lastMovementAt: daysAgo(3),
    },

    // MacBook
    {
      availableQuantity: 3,
      locationId: locMainStore!.id,
      productId: prodMacbook!.id,
      quantity: 3,
      lastMovementAt: daysAgo(7),
    },
    {
      availableQuantity: 12,
      locationId: locWarehouse!.id,
      productId: prodMacbook!.id,
      quantity: 12,
      lastMovementAt: daysAgo(7),
    },

    // USB-C Cable
    {
      availableQuantity: 25,
      locationId: locMainStore!.id,
      productId: prodUsbCable!.id,
      quantity: 25,
      lastMovementAt: daysAgo(1),
    },
    {
      availableQuantity: 142,
      locationId: locWarehouse!.id,
      productId: prodUsbCable!.id,
      quantity: 142,
      lastMovementAt: daysAgo(1),
    },

    // Vitamin D3
    {
      availableQuantity: 15,
      locationId: locMainStore!.id,
      productId: prodVitaminD!.id,
      quantity: 15,
      lastMovementAt: daysAgo(5),
    },
    {
      availableQuantity: 150,
      locationId: locWarehouse!.id,
      productId: prodVitaminD!.id,
      quantity: 150,
      lastMovementAt: daysAgo(5),
    },

    // Omega-3
    {
      availableQuantity: 5,
      locationId: locMainStore!.id,
      productId: prodOmega3!.id,
      quantity: 5,
      lastMovementAt: daysAgo(8),
    },
    {
      availableQuantity: 107,
      locationId: locWarehouse!.id,
      productId: prodOmega3!.id,
      quantity: 107,
      lastMovementAt: daysAgo(8),
    },

    // Milk
    {
      availableQuantity: 5,
      locationId: locMainStore!.id,
      productId: prodMilk!.id,
      quantity: 5,
      lastMovementAt: daysAgo(1),
    },
    {
      availableQuantity: 37,
      locationId: locWarehouse!.id,
      productId: prodMilk!.id,
      quantity: 37,
      lastMovementAt: daysAgo(1),
    },

    // Yogurt
    {
      availableQuantity: 7,
      locationId: locMainStore!.id,
      productId: prodYogurt!.id,
      quantity: 7,
      lastMovementAt: daysAgo(1),
    },
    {
      availableQuantity: 31,
      locationId: locWarehouse!.id,
      productId: prodYogurt!.id,
      quantity: 31,
      lastMovementAt: daysAgo(1),
    },
  ]);

  console.log(`   Created 14 stock level rows across 2 locations`);
  console.log(
    `   LOW STOCK: iPhone (Store:8<10), MacBook (Store:3<5), Omega-3 (Store:5<30), Milk (Store:5<20), Yogurt (Store:7<25)`
  );

  // ── 8. Stock Movements ─────────────────────────────────────────────────
  console.log("📈  Creating stock movement history…");

  await db.insert(stockMovements).values([
    // ── Purchases (PO-001 receipt) ──
    {
      createdAt: daysAgo(45),
      locationId: locWarehouse!.id,
      newQuantity: 50,
      notes: "PO-2026-001 receipt",
      previousQuantity: 0,
      productId: prodIphone!.id,
      quantity: 50,
      reason: "Purchase order receipt",
      referenceId: po1!.id,
      referenceType: "purchase_order",
      totalCost: "37450.00",
      type: "purchase",
      unitCost: "749.00",
    },
    {
      createdAt: daysAgo(45),
      locationId: locWarehouse!.id,
      newQuantity: 200,
      notes: "PO-2026-001 receipt",
      previousQuantity: 0,
      productId: prodUsbCable!.id,
      quantity: 200,
      reason: "Purchase order receipt",
      referenceId: po1!.id,
      referenceType: "purchase_order",
      totalCost: "700.00",
      type: "purchase",
      unitCost: "3.50",
    },

    // ── Transfer: Warehouse → Main Store (iPhones) ──
    {
      createdAt: daysAgo(40),
      locationId: locWarehouse!.id,
      newQuantity: 40,
      notes: "Initial shelf fill",
      previousQuantity: 50,
      productId: prodIphone!.id,
      quantity: -10,
      reason: `Transfer to Main Store`,
      type: "transfer",
    },
    {
      createdAt: daysAgo(40),
      locationId: locMainStore!.id,
      newQuantity: 10,
      notes: "Initial shelf fill",
      previousQuantity: 0,
      productId: prodIphone!.id,
      quantity: 10,
      reason: `Transfer from Warehouse A`,
      type: "transfer",
    },

    // ── Transfer: Warehouse → Main Store (USB cables) ──
    {
      createdAt: daysAgo(40),
      locationId: locWarehouse!.id,
      newQuantity: 170,
      previousQuantity: 200,
      productId: prodUsbCable!.id,
      quantity: -30,
      reason: `Transfer to Main Store`,
      type: "transfer",
    },
    {
      createdAt: daysAgo(40),
      locationId: locMainStore!.id,
      newQuantity: 30,
      previousQuantity: 0,
      productId: prodUsbCable!.id,
      quantity: 30,
      reason: `Transfer from Warehouse A`,
      type: "transfer",
    },

    // ── Sales (simulated POS sales) ──
    {
      createdAt: daysAgo(30),
      locationId: locMainStore!.id,
      newQuantity: 8,
      previousQuantity: 10,
      productId: prodIphone!.id,
      quantity: -2,
      reason: "POS sale",
      type: "sale",
    },
    {
      createdAt: daysAgo(20),
      locationId: locMainStore!.id,
      newQuantity: 28,
      previousQuantity: 30,
      productId: prodUsbCable!.id,
      quantity: -2,
      reason: "POS sale",
      type: "sale",
    },
    {
      createdAt: daysAgo(14),
      locationId: locMainStore!.id,
      newQuantity: 26,
      previousQuantity: 28,
      productId: prodUsbCable!.id,
      quantity: -2,
      reason: "POS sale",
      type: "sale",
    },

    // ── Adjustment: damaged USB cables ──
    {
      createdAt: daysAgo(10),
      locationId: locMainStore!.id,
      newQuantity: 25,
      previousQuantity: 26,
      productId: prodUsbCable!.id,
      quantity: -1,
      reason: "Damaged in store",
      type: "damaged",
    },

    // ── Purchases (PO-002 receipt) ──
    {
      createdAt: daysAgo(30),
      locationId: locWarehouse!.id,
      newQuantity: 200,
      notes: "PO-2026-002 receipt",
      previousQuantity: 0,
      productId: prodVitaminD!.id,
      quantity: 200,
      reason: "Purchase order receipt",
      referenceId: po2!.id,
      referenceType: "purchase_order",
      totalCost: "1700.00",
      type: "purchase",
      unitCost: "8.50",
    },
    {
      createdAt: daysAgo(30),
      locationId: locWarehouse!.id,
      newQuantity: 140,
      notes: "PO-2026-002 receipt",
      previousQuantity: 0,
      productId: prodOmega3!.id,
      quantity: 140,
      reason: "Purchase order receipt",
      referenceId: po2!.id,
      referenceType: "purchase_order",
      totalCost: "1680.00",
      type: "purchase",
      unitCost: "12.00",
    },

    // ── Transfer: Supplement warehouse → store ──
    {
      createdAt: daysAgo(28),
      locationId: locWarehouse!.id,
      newQuantity: 185,
      previousQuantity: 200,
      productId: prodVitaminD!.id,
      quantity: -15,
      reason: "Transfer to Main Store",
      type: "transfer",
    },
    {
      createdAt: daysAgo(28),
      locationId: locMainStore!.id,
      newQuantity: 15,
      previousQuantity: 0,
      productId: prodVitaminD!.id,
      quantity: 15,
      reason: "Transfer from Warehouse A",
      type: "transfer",
    },
    {
      createdAt: daysAgo(28),
      locationId: locWarehouse!.id,
      newQuantity: 130,
      previousQuantity: 140,
      productId: prodOmega3!.id,
      quantity: -10,
      reason: "Transfer to Main Store",
      type: "transfer",
    },
    {
      createdAt: daysAgo(28),
      locationId: locMainStore!.id,
      newQuantity: 10,
      previousQuantity: 0,
      productId: prodOmega3!.id,
      quantity: 10,
      reason: "Transfer from Warehouse A",
      type: "transfer",
    },

    // ── Sales (supplements) ──
    {
      createdAt: daysAgo(15),
      locationId: locMainStore!.id,
      newQuantity: 10,
      previousQuantity: 15,
      productId: prodVitaminD!.id,
      quantity: -5,
      reason: "POS sale",
      type: "sale",
    },
    {
      createdAt: daysAgo(7),
      locationId: locMainStore!.id,
      newQuantity: 5,
      previousQuantity: 10,
      productId: prodOmega3!.id,
      quantity: -5,
      reason: "POS sale",
      type: "sale",
    },

    // ── Warehouse adjustment: vitamin D3 stock correction ──
    {
      createdAt: daysAgo(5),
      locationId: locWarehouse!.id,
      newQuantity: 150,
      previousQuantity: 170,
      productId: prodVitaminD!.id,
      quantity: -20,
      reason: "Cycle count variance",
      type: "adjustment",
    },

    // ── Fresh produce purchases (PO-003 receipt) ──
    {
      createdAt: daysAgo(2),
      locationId: locWarehouse!.id,
      newQuantity: 60,
      notes: "PO-2026-003 receipt",
      previousQuantity: 0,
      productId: prodMilk!.id,
      quantity: 60,
      reason: "Purchase order receipt",
      referenceId: po3!.id,
      referenceType: "purchase_order",
      totalCost: "72.00",
      type: "purchase",
      unitCost: "1.20",
    },
    {
      createdAt: daysAgo(2),
      locationId: locWarehouse!.id,
      newQuantity: 43,
      notes: "PO-2026-003 receipt",
      previousQuantity: 0,
      productId: prodYogurt!.id,
      quantity: 43,
      reason: "Purchase order receipt",
      referenceId: po3!.id,
      referenceType: "purchase_order",
      totalCost: "36.55",
      type: "purchase",
      unitCost: "0.85",
    },

    // ── Fresh produce transfers to store ──
    {
      createdAt: daysAgo(2),
      locationId: locWarehouse!.id,
      newQuantity: 55,
      previousQuantity: 60,
      productId: prodMilk!.id,
      quantity: -5,
      reason: "Transfer to Main Store",
      type: "transfer",
    },
    {
      createdAt: daysAgo(2),
      locationId: locMainStore!.id,
      newQuantity: 5,
      previousQuantity: 0,
      productId: prodMilk!.id,
      quantity: 5,
      reason: "Transfer from Warehouse A",
      type: "transfer",
    },
    {
      createdAt: daysAgo(2),
      locationId: locWarehouse!.id,
      newQuantity: 36,
      previousQuantity: 43,
      productId: prodYogurt!.id,
      quantity: -7,
      reason: "Transfer to Main Store",
      type: "transfer",
    },
    {
      createdAt: daysAgo(2),
      locationId: locMainStore!.id,
      newQuantity: 7,
      previousQuantity: 0,
      productId: prodYogurt!.id,
      quantity: 7,
      reason: "Transfer from Warehouse A",
      type: "transfer",
    },

    // ── Return ──
    {
      createdAt: daysAgo(1),
      locationId: locMainStore!.id,
      newQuantity: 9,
      previousQuantity: 8,
      productId: prodIphone!.id,
      quantity: 1,
      reason: "Customer return — defective unit",
      type: "return",
    },
    // ── Sell returned unit off as damaged ──
    {
      createdAt: daysAgo(1),
      locationId: locMainStore!.id,
      newQuantity: 8,
      previousQuantity: 9,
      productId: prodIphone!.id,
      quantity: -1,
      reason: "Returned unit — sent to supplier for warranty",
      type: "damaged",
    },
  ]);

  console.log(`   Created 26 stock movements`);

  // ── 9. MacBook cost layer (PO-004 not received yet — manual layer for stock) ─
  // MacBook stock came from a pre-existing batch before this seed
  await db.insert(costLayers).values({
    locationId: locWarehouse!.id,
    lotNumber: "LOT-MAC-PREV",
    notes: "Opening stock from previous supplier",
    originalQuantity: 15,
    productId: prodMacbook!.id,
    receivedAt: daysAgo(90),
    remainingQuantity: 15,
    unitCost: "889.00",
  });

  // ── 10. Cycle Counts ───────────────────────────────────────────────────
  console.log("📋  Creating cycle counts…");

  // ─ Completed count (10 days ago) ──────────────────────────────────────
  const [ccCompleted] = await db
    .insert(cycleCounts)
    .values({
      completedAt: daysAgo(10),
      countedBy: "seed-user",
      locationId: locWarehouse!.id,
      name: "Warehouse A — Weekly Count #4",
      notes:
        "Routine weekly count. Found variances on Vitamin D3 (over-counted previously).",
      startedAt: daysAgo(10),
      status: "completed",
      updatedAt: daysAgo(10),
    })
    .returning();

  await db.insert(cycleCountLines).values([
    {
      countedQuantity: 170, // system said 185, counted 170 → −15 variance → matches adjustment we created
      cycleCountId: ccCompleted!.id,
      locationId: locWarehouse!.id,
      notes: "Shelf 3B — counted twice to confirm",
      productId: prodVitaminD!.id,
      systemQuantity: 185,
      variance: -15,
    },
    {
      countedQuantity: 130, // matches expected
      cycleCountId: ccCompleted!.id,
      locationId: locWarehouse!.id,
      productId: prodOmega3!.id,
      systemQuantity: 130,
      variance: 0,
    },
    {
      countedQuantity: 40, // system said 40, matches
      cycleCountId: ccCompleted!.id,
      locationId: locWarehouse!.id,
      productId: prodIphone!.id,
      systemQuantity: 40,
      variance: 0,
    },
    {
      countedQuantity: 173, // found 3 extra cables behind shelf
      cycleCountId: ccCompleted!.id,
      locationId: locWarehouse!.id,
      notes: "Found 3 units behind shelf unit 7",
      productId: prodUsbCable!.id,
      systemQuantity: 170,
      variance: 3,
    },
  ]);

  // ─ In-progress count (today) ───────────────────────────────────────────
  const [ccInProgress] = await db
    .insert(cycleCounts)
    .values({
      countedBy: "seed-user",
      locationId: locMainStore!.id,
      name: "Main Store — Spot Check Feb 2026",
      notes: "Spot check following customer complaint about stock discrepancy.",
      startedAt: now,
      status: "in_progress",
    })
    .returning();

  await db.insert(cycleCountLines).values([
    {
      // Counted — shows variance
      countedQuantity: 8,
      cycleCountId: ccInProgress!.id,
      locationId: locMainStore!.id,
      productId: prodIphone!.id,
      systemQuantity: 8,
      variance: 0,
    },
    {
      // Counted — matches
      countedQuantity: 24,
      cycleCountId: ccInProgress!.id,
      locationId: locMainStore!.id,
      productId: prodUsbCable!.id,
      systemQuantity: 25,
      variance: -1, // one unit missing
    },
    {
      // Not yet counted — still blank
      countedQuantity: null,
      cycleCountId: ccInProgress!.id,
      locationId: locMainStore!.id,
      productId: prodMilk!.id,
      systemQuantity: 5,
      variance: null,
    },
    {
      // Not yet counted — still blank
      countedQuantity: null,
      cycleCountId: ccInProgress!.id,
      locationId: locMainStore!.id,
      productId: prodYogurt!.id,
      systemQuantity: 7,
      variance: null,
    },
  ]);

  console.log(`   Created 1 completed cycle count + 1 in-progress cycle count`);

  // ── Done ───────────────────────────────────────────────────────────────
  console.log("\n✅  Seed complete!\n");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("  WHAT TO TEST                               WHERE TO LOOK");
  console.log("─────────────────────────────────────────────────────────────");
  console.log(
    "  5 low-stock alerts (per-location)          Inventory Overview"
  );
  console.log(
    "  3 expiring-soon batches (<30 days)         Inventory Overview"
  );
  console.log("  Approve PO-2026-005 (iPhone restock)       Purchase Orders");
  console.log("  Receive PO-2026-004 (MacBook, approved)    Purchase Orders");
  console.log("  PO-2026-003 is COD + overdue payment       Purchase Orders");
  console.log("  Cannot receive PO-2026-006 (draft)         Purchase Orders");
  console.log("  Cannot create PO for Deprecated Parts Co   New PO dialog");
  console.log("  Cannot order Lightning Cable (discontinued) New PO dialog");
  console.log("  Category tree: Electronics>Laptops/Phones  Categories page");
  console.log("  Check Reorders button → creates draft POs  Purchase Orders");
  console.log("  In-progress cycle count (Main Store)       Cycle Counts");
  console.log("  LOT-MILK-001 expires in 4 days             Batches page");
  console.log("  LOT-VITD-001 expires in 14 days            Batches page");
  console.log("  Transfer iPhones Warehouse → Back Room     Stock Movements");
  console.log(
    "─────────────────────────────────────────────────────────────\n"
  );
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌  Seed failed:", error);
    process.exit(1);
  });
