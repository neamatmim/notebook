import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  decimal,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const productStatusEnum = pgEnum("product_status", [
  "active",
  "inactive",
  "discontinued",
]);

export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "purchase",
  "sale",
  "adjustment",
  "transfer",
  "return",
  "damaged",
  "expired",
  "cycle_count",
]);

export const cycleCountStatusEnum = pgEnum("cycle_count_status", [
  "draft",
  "in_progress",
  "completed",
  "cancelled",
]);

export const supplierStatusEnum = pgEnum("supplier_status", [
  "active",
  "inactive",
  "suspended",
]);

export const categories = pgTable("categories", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  description: text("description"),
  id: uuid("id").primaryKey().defaultRandom(),
  isActive: boolean("is_active").default(true),
  name: text("name").notNull(),
  parentId: uuid("parent_id"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const categoriesRelations = relations(categories, ({ many, one }) => ({
  children: many(categories),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
  }),
  products: many(products),
}));

export const suppliers = pgTable("suppliers", {
  address: text("address"),
  city: text("city"),
  contactName: text("contact_name"),
  country: text("country"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  email: text("email"),
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  notes: text("notes"),
  paymentTerms: text("payment_terms"),
  paymentTermsDays: integer("payment_terms_days"),
  phone: text("phone"),
  state: text("state"),
  status: supplierStatusEnum("status").default("active"),
  taxId: text("tax_id"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  zipCode: text("zip_code"),
});

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  products: many(products),
  purchaseOrders: many(purchaseOrders),
}));

export const products = pgTable("products", {
  barcode: text("barcode"),
  categoryId: uuid("category_id"),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  description: text("description"),
  dimensions: text("dimensions"),
  id: uuid("id").primaryKey().defaultRandom(),
  imageUrl: text("image_url"),
  maxStockLevel: integer("max_stock_level"),
  minStockLevel: integer("min_stock_level").default(0),
  msrp: decimal("msrp", { precision: 10, scale: 2 }),
  name: text("name").notNull(),
  notes: text("notes"),
  reorderPoint: integer("reorder_point"),
  reorderQuantity: integer("reorder_quantity"),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }),
  sku: text("sku").notNull().unique(),
  status: productStatusEnum("status").default("active"),
  supplierId: uuid("supplier_id"),
  tags: text("tags"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 4 }),
  taxable: boolean("taxable").default(true),
  unit: text("unit").default("pcs"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  weight: decimal("weight", { precision: 8, scale: 3 }),
});

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  orderItems: many(purchaseOrderItems),
  stockLevels: many(stockLevels),
  stockMovements: many(stockMovements),
  supplier: one(suppliers, {
    fields: [products.supplierId],
    references: [suppliers.id],
  }),
  variants: many(productVariants),
}));

export const productVariants = pgTable("product_variants", {
  attributeType: text("attribute_type"),
  attributeValue: text("attribute_value"),
  barcode: text("barcode"),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  isActive: boolean("is_active").default(true),
  name: text("name").notNull(),
  productId: uuid("product_id").notNull(),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }),
  sku: text("sku").notNull().unique(),
  stockQuantity: integer("stock_quantity").default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const productVariantsRelations = relations(
  productVariants,
  ({ one, many }) => ({
    product: one(products, {
      fields: [productVariants.productId],
      references: [products.id],
    }),
    stockMovements: many(stockMovements),
  })
);

export const stockLevels = pgTable(
  "stock_levels",
  {
    availableQuantity: integer("available_quantity").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    lastMovementAt: timestamp("last_movement_at"),
    locationId: uuid("location_id"),
    productId: uuid("product_id").notNull(),
    quantity: integer("quantity").default(0).notNull(),
    reservedQuantity: integer("reserved_quantity").default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    variantId: uuid("variant_id"),
  },
  (t) => [
    uniqueIndex("sl_prod_no_var_no_loc_uidx")
      .on(t.productId)
      .where(sql`${t.variantId} IS NULL AND ${t.locationId} IS NULL`),
    uniqueIndex("sl_prod_var_no_loc_uidx")
      .on(t.productId, t.variantId)
      .where(sql`${t.variantId} IS NOT NULL AND ${t.locationId} IS NULL`),
    uniqueIndex("sl_prod_no_var_loc_uidx")
      .on(t.productId, t.locationId)
      .where(sql`${t.variantId} IS NULL AND ${t.locationId} IS NOT NULL`),
    uniqueIndex("sl_prod_var_loc_uidx")
      .on(t.productId, t.variantId, t.locationId)
      .where(sql`${t.variantId} IS NOT NULL AND ${t.locationId} IS NOT NULL`),
    check("sl_quantity_non_negative", sql`${t.quantity} >= 0`),
  ]
);

export const stockLevelsRelations = relations(stockLevels, ({ one }) => ({
  location: one(locations, {
    fields: [stockLevels.locationId],
    references: [locations.id],
  }),
  product: one(products, {
    fields: [stockLevels.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [stockLevels.variantId],
    references: [productVariants.id],
  }),
}));

export const locations = pgTable("locations", {
  address: text("address"),
  city: text("city"),
  country: text("country"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  isActive: boolean("is_active").default(true),
  isPrimary: boolean("is_primary").default(false),
  name: text("name").notNull(),
  state: text("state"),
  type: text("type").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  zipCode: text("zip_code"),
});

export const locationsRelations = relations(locations, ({ many }) => ({
  stockLevels: many(stockLevels),
  stockMovements: many(stockMovements),
}));

export const stockMovements = pgTable("stock_movements", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  locationId: uuid("location_id"),
  newQuantity: integer("new_quantity").notNull(),
  notes: text("notes"),
  previousQuantity: integer("previous_quantity").notNull(),
  productId: uuid("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason"),
  referenceId: uuid("reference_id"),
  referenceType: text("reference_type"),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  type: stockMovementTypeEnum("type").notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  userId: text("user_id"),
  variantId: uuid("variant_id"),
});

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  location: one(locations, {
    fields: [stockMovements.locationId],
    references: [locations.id],
  }),
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [stockMovements.variantId],
    references: [productVariants.id],
  }),
}));

export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "draft",
  "pending",
  "approved",
  "ordered",
  "partial",
  "received",
  "cancelled",
]);

export const purchaseOrderPaymentStatusEnum = pgEnum(
  "purchase_order_payment_status",
  ["unpaid", "partially_paid", "paid", "overdue"]
);

export const purchaseOrders = pgTable("purchase_orders", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: text("created_by"),
  deletedAt: timestamp("deleted_at"),
  expectedDate: timestamp("expected_date"),
  id: uuid("id").primaryKey().defaultRandom(),
  notes: text("notes"),
  orderDate: timestamp("order_date").defaultNow(),
  poNumber: text("po_number").notNull().unique(),
  receivedDate: timestamp("received_date"),
  shippingCost: decimal("shipping_cost", { precision: 12, scale: 2 }).default(
    "0"
  ),
  amountPaid: decimal("amount_paid", { precision: 12, scale: 2 })
    .default("0")
    .notNull(),
  paidAt: timestamp("paid_at"),
  paymentDueDate: timestamp("payment_due_date"),
  paymentStatus: purchaseOrderPaymentStatusEnum("payment_status")
    .default("unpaid")
    .notNull(),
  status: purchaseOrderStatusEnum("status").default("draft"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).default("0"),
  supplierId: uuid("supplier_id").notNull(),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).default(
    "0"
  ),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const purchaseOrdersRelations = relations(
  purchaseOrders,
  ({ one, many }) => ({
    items: many(purchaseOrderItems),
    payments: many(poPayments),
    supplier: one(suppliers, {
      fields: [purchaseOrders.supplierId],
      references: [suppliers.id],
    }),
  })
);

export const poPayments = pgTable("po_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseOrderId: uuid("purchase_order_id").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method"),
  paymentDate: timestamp("payment_date").notNull(),
  notes: text("notes"),
  journalEntryId: uuid("journal_entry_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const poPaymentsRelations = relations(poPayments, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [poPayments.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
}));

export const purchaseOrderItems = pgTable("purchase_order_items", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull(),
  purchaseOrderId: uuid("purchase_order_id").notNull(),
  quantity: integer("quantity").notNull(),
  receivedQuantity: integer("received_quantity").default(0),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  variantId: uuid("variant_id"),
});

export const purchaseOrderItemsRelations = relations(
  purchaseOrderItems,
  ({ one }) => ({
    product: one(products, {
      fields: [purchaseOrderItems.productId],
      references: [products.id],
    }),
    purchaseOrder: one(purchaseOrders, {
      fields: [purchaseOrderItems.purchaseOrderId],
      references: [purchaseOrders.id],
    }),
    variant: one(productVariants, {
      fields: [purchaseOrderItems.variantId],
      references: [productVariants.id],
    }),
  })
);

export const costUpdateMethodEnum = pgEnum("cost_update_method", [
  "none",
  "last_cost",
  "weighted_average",
  "fifo",
]);

export const inventorySettings = pgTable("inventory_settings", {
  costUpdateMethod: costUpdateMethodEnum("cost_update_method")
    .default("none")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  id: text("id").primaryKey().default("default"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const costLayers = pgTable("cost_layers", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expirationDate: timestamp("expiration_date"),
  id: uuid("id").primaryKey().defaultRandom(),
  locationId: uuid("location_id"),
  lotNumber: text("lot_number"),
  notes: text("notes"),
  originalQuantity: integer("original_quantity").notNull(),
  productId: uuid("product_id").notNull(),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  referenceId: uuid("reference_id"),
  referenceType: text("reference_type"),
  remainingQuantity: integer("remaining_quantity").notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  variantId: uuid("variant_id"),
});

export const cycleCounts = pgTable("cycle_counts", {
  cancelledAt: timestamp("cancelled_at"),
  completedAt: timestamp("completed_at"),
  countedBy: text("counted_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  locationId: uuid("location_id"),
  name: text("name").notNull(),
  notes: text("notes"),
  startedAt: timestamp("started_at"),
  status: cycleCountStatusEnum("status").default("draft").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cycleCountLines = pgTable("cycle_count_lines", {
  countedQuantity: integer("counted_quantity"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  cycleCountId: uuid("cycle_count_id").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  locationId: uuid("location_id"),
  notes: text("notes"),
  productId: uuid("product_id").notNull(),
  systemQuantity: integer("system_quantity").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  variance: integer("variance"),
  variantId: uuid("variant_id"),
});

export const cycleCountsRelations = relations(cycleCounts, ({ one, many }) => ({
  lines: many(cycleCountLines),
  location: one(locations, {
    fields: [cycleCounts.locationId],
    references: [locations.id],
  }),
}));

export const cycleCountLinesRelations = relations(
  cycleCountLines,
  ({ one }) => ({
    cycleCount: one(cycleCounts, {
      fields: [cycleCountLines.cycleCountId],
      references: [cycleCounts.id],
    }),
    location: one(locations, {
      fields: [cycleCountLines.locationId],
      references: [locations.id],
    }),
    product: one(products, {
      fields: [cycleCountLines.productId],
      references: [products.id],
    }),
    variant: one(productVariants, {
      fields: [cycleCountLines.variantId],
      references: [productVariants.id],
    }),
  })
);

export const inventoryAuditLog = pgTable("inventory_audit_log", {
  action: text("action").notNull(),
  changes: text("changes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  entityId: text("entity_id").notNull(),
  entityType: text("entity_type").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id"),
});
