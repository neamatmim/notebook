import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  integer,
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { locations, products, productVariants } from "./inventory";

export const saleStatusEnum = pgEnum("sale_status", [
  "pending",
  "completed",
  "refunded",
  "partially_refunded",
  "cancelled",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "credit_card",
  "debit_card",
  "mobile_payment",
  "check",
  "gift_card",
  "store_credit",
  "on_account",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "refunded",
]);

export const discountTypeEnum = pgEnum("discount_type", [
  "percentage",
  "fixed_amount",
  "buy_x_get_y",
]);

export const customerTypeEnum = pgEnum("customer_type", [
  "regular",
  "vip",
  "wholesale",
  "employee",
]);

export const customers = pgTable("customers", {
  address: text("address"),
  birthDate: timestamp("birth_date"),
  city: text("city"),
  companyName: text("company_name"),
  country: text("country"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  customerNumber: text("customer_number").notNull().unique(),
  creditBalance: decimal("credit_balance", { precision: 12, scale: 2 })
    .default("0")
    .notNull(),
  dueBalance: decimal("due_balance", { precision: 12, scale: 2 })
    .default("0")
    .notNull(),
  discountRate: decimal("discount_rate", { precision: 5, scale: 4 }),
  email: text("email"),
  firstName: text("first_name"),
  id: uuid("id").primaryKey().defaultRandom(),
  isActive: boolean("is_active").default(true),
  lastName: text("last_name"),
  loyaltyPoints: integer("loyalty_points").default(0),
  notes: text("notes"),
  phone: text("phone"),
  state: text("state"),
  totalSpent: decimal("total_spent", { precision: 12, scale: 2 }).default("0"),
  type: customerTypeEnum("type").default("regular"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  zipCode: text("zip_code"),
});

export const customersRelations = relations(customers, ({ many }) => ({
  returns: many(returns),
  sales: many(sales),
}));

export const employees = pgTable("employees", {
  canApplyDiscounts: boolean("can_apply_discounts").default(false),
  canProcessReturns: boolean("can_process_returns").default(false),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  department: text("department"),
  email: text("email").notNull(),
  employeeNumber: text("employee_number").notNull().unique(),
  firstName: text("first_name").notNull(),
  hourlyRate: decimal("hourly_rate", { precision: 8, scale: 2 }),
  id: uuid("id").primaryKey().defaultRandom(),
  isActive: boolean("is_active").default(true),
  lastName: text("last_name").notNull(),
  maxDiscountPercent: decimal("max_discount_percent", {
    precision: 5,
    scale: 2,
  }),
  phone: text("phone"),
  role: text("role").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  userId: text("user_id").notNull().unique(),
});

export const employeesRelations = relations(employees, ({ many }) => ({
  sales: many(sales),
  shifts: many(shifts),
}));

export const shifts = pgTable("shifts", {
  breakMinutes: integer("break_minutes").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  employeeId: uuid("employee_id").notNull(),
  endTime: timestamp("end_time"),
  hoursWorked: decimal("hours_worked", { precision: 4, scale: 2 }),
  id: uuid("id").primaryKey().defaultRandom(),
  locationId: uuid("location_id").notNull(),
  notes: text("notes"),
  startTime: timestamp("start_time").defaultNow().notNull(),
  totalSales: decimal("total_sales", { precision: 12, scale: 2 }).default("0"),
  transactionCount: integer("transaction_count").default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  employee: one(employees, {
    fields: [shifts.employeeId],
    references: [employees.id],
  }),
  location: one(locations, {
    fields: [shifts.locationId],
    references: [locations.id],
  }),
  sales: many(sales),
}));

export const sales = pgTable("sales", {
  amountPaid: decimal("amount_paid", { precision: 12, scale: 2 }).default("0"),
  changeGiven: decimal("change_given", { precision: 12, scale: 2 }).default(
    "0"
  ),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  customerId: uuid("customer_id"),
  discountAmount: decimal("discount_amount", {
    precision: 12,
    scale: 2,
  }).default("0"),
  employeeId: uuid("employee_id").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  locationId: uuid("location_id").notNull(),
  loyaltyPointsEarned: integer("loyalty_points_earned").default(0),
  loyaltyPointsUsed: integer("loyalty_points_used").default(0),
  metadata: json("metadata"),
  notes: text("notes"),
  receiptNumber: text("receipt_number").notNull().unique(),
  saleDate: timestamp("sale_date").defaultNow().notNull(),
  shiftId: uuid("shift_id"),
  status: saleStatusEnum("status").default("pending"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const salesRelations = relations(sales, ({ one, many }) => ({
  customer: one(customers, {
    fields: [sales.customerId],
    references: [customers.id],
  }),
  employee: one(employees, {
    fields: [sales.employeeId],
    references: [employees.id],
  }),
  items: many(saleItems),
  location: one(locations, {
    fields: [sales.locationId],
    references: [locations.id],
  }),
  payments: many(payments),
  returns: many(returns),
  shift: one(shifts, {
    fields: [sales.shiftId],
    references: [shifts.id],
  }),
}));

export const saleItems = pgTable("sale_items", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  discountAmount: decimal("discount_amount", {
    precision: 10,
    scale: 2,
  }).default("0"),
  id: uuid("id").primaryKey().defaultRandom(),
  notes: text("notes"),
  productId: uuid("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  saleId: uuid("sale_id").notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  variantId: uuid("variant_id"),
});

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  variant: one(productVariants, {
    fields: [saleItems.variantId],
    references: [productVariants.id],
  }),
}));

export const payments = pgTable("payments", {
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  authCode: text("auth_code"),
  cardLast4: text("card_last_4"),
  cardType: text("card_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  method: paymentMethodEnum("method").notNull(),
  notes: text("notes"),
  processedAt: timestamp("processed_at"),
  reference: text("reference"),
  returnId: uuid("return_id"),
  saleId: uuid("sale_id"),
  status: paymentStatusEnum("status").default("pending"),
  transactionId: text("transaction_id"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const paymentsRelations = relations(payments, ({ one }) => ({
  return: one(returns, {
    fields: [payments.returnId],
    references: [returns.id],
  }),
  sale: one(sales, {
    fields: [payments.saleId],
    references: [sales.id],
  }),
}));

export const discounts = pgTable("discounts", {
  applicableCategories: json("applicable_categories"),
  applicableCustomerTypes: json("applicable_customer_types"),
  applicableProducts: json("applicable_products"),
  code: text("code").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  description: text("description"),
  id: uuid("id").primaryKey().defaultRandom(),
  isActive: boolean("is_active").default(true),
  maxDiscountAmount: decimal("max_discount_amount", {
    precision: 10,
    scale: 2,
  }),
  minPurchaseAmount: decimal("min_purchase_amount", {
    precision: 10,
    scale: 2,
  }),
  name: text("name").notNull(),
  stackable: boolean("stackable").default(false),
  type: discountTypeEnum("type").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  usageCount: integer("usage_count").default(0),
  usageLimit: integer("usage_limit"),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
});

export const discountsRelations = relations(discounts, ({ many }) => ({
  usages: many(discountUsages),
}));

export const discountUsages = pgTable("discount_usages", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  customerId: uuid("customer_id"),
  discountAmount: decimal("discount_amount", {
    precision: 10,
    scale: 2,
  }).notNull(),
  discountId: uuid("discount_id").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  saleId: uuid("sale_id").notNull(),
});

export const discountUsagesRelations = relations(discountUsages, ({ one }) => ({
  customer: one(customers, {
    fields: [discountUsages.customerId],
    references: [customers.id],
  }),
  discount: one(discounts, {
    fields: [discountUsages.discountId],
    references: [discounts.id],
  }),
  sale: one(sales, {
    fields: [discountUsages.saleId],
    references: [sales.id],
  }),
}));

export const returnStatusEnum = pgEnum("return_status", [
  "pending",
  "approved",
  "rejected",
  "completed",
]);

export const returnReasonEnum = pgEnum("return_reason", [
  "defective",
  "wrong_item",
  "damaged",
  "customer_changed_mind",
  "warranty_claim",
  "other",
]);

export const returns = pgTable("returns", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  customerId: uuid("customer_id"),
  employeeId: uuid("employee_id").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  locationId: uuid("location_id").notNull(),
  notes: text("notes"),
  originalSaleId: uuid("original_sale_id").notNull(),
  reason: returnReasonEnum("reason").notNull(),
  refundMethod: paymentMethodEnum("refund_method"),
  restockingFee: decimal("restocking_fee", { precision: 10, scale: 2 }).default(
    "0"
  ),
  returnDate: timestamp("return_date").defaultNow().notNull(),
  returnNumber: text("return_number").notNull().unique(),
  status: returnStatusEnum("status").default("pending"),
  totalRefundAmount: decimal("total_refund_amount", {
    precision: 12,
    scale: 2,
  }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const returnsRelations = relations(returns, ({ one, many }) => ({
  customer: one(customers, {
    fields: [returns.customerId],
    references: [customers.id],
  }),
  employee: one(employees, {
    fields: [returns.employeeId],
    references: [employees.id],
  }),
  items: many(returnItems),
  location: one(locations, {
    fields: [returns.locationId],
    references: [locations.id],
  }),
  originalSale: one(sales, {
    fields: [returns.originalSaleId],
    references: [sales.id],
  }),
  payments: many(payments),
}));

export const returnItems = pgTable("return_items", {
  condition: text("condition"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull(),
  quantityReturned: integer("quantity_returned").notNull(),
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }).notNull(),
  restockable: boolean("restockable").default(true),
  returnId: uuid("return_id").notNull(),
  saleItemId: uuid("sale_item_id").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  variantId: uuid("variant_id"),
});

export const returnItemsRelations = relations(returnItems, ({ one }) => ({
  product: one(products, {
    fields: [returnItems.productId],
    references: [products.id],
  }),
  return: one(returns, {
    fields: [returnItems.returnId],
    references: [returns.id],
  }),
  saleItem: one(saleItems, {
    fields: [returnItems.saleItemId],
    references: [saleItems.id],
  }),
  variant: one(productVariants, {
    fields: [returnItems.variantId],
    references: [productVariants.id],
  }),
}));

export const giftCards = pgTable("gift_cards", {
  cardNumber: text("card_number").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  currentBalance: decimal("current_balance", {
    precision: 10,
    scale: 2,
  }).notNull(),
  customerId: uuid("customer_id"),
  expiresAt: timestamp("expires_at"),
  id: uuid("id").primaryKey().defaultRandom(),
  initialAmount: decimal("initial_amount", {
    precision: 10,
    scale: 2,
  }).notNull(),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  purchasedAt: timestamp("purchased_at"),
  purchasedBy: uuid("purchased_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const giftCardsRelations = relations(giftCards, ({ one, many }) => ({
  customer: one(customers, {
    fields: [giftCards.customerId],
    references: [customers.id],
  }),
  purchaser: one(customers, {
    fields: [giftCards.purchasedBy],
    references: [customers.id],
  }),
  transactions: many(giftCardTransactions),
}));

export const giftCardTransactionTypeEnum = pgEnum(
  "gift_card_transaction_type",
  ["purchase", "redemption", "reload", "refund", "expiration"]
);

export const giftCardTransactions = pgTable("gift_card_transactions", {
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  balanceBefore: decimal("balance_before", {
    precision: 10,
    scale: 2,
  }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  employeeId: uuid("employee_id"),
  giftCardId: uuid("gift_card_id").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  notes: text("notes"),
  returnId: uuid("return_id"),
  saleId: uuid("sale_id"),
  type: giftCardTransactionTypeEnum("type").notNull(),
});

export const giftCardTransactionsRelations = relations(
  giftCardTransactions,
  ({ one }) => ({
    employee: one(employees, {
      fields: [giftCardTransactions.employeeId],
      references: [employees.id],
    }),
    giftCard: one(giftCards, {
      fields: [giftCardTransactions.giftCardId],
      references: [giftCards.id],
    }),
    return: one(returns, {
      fields: [giftCardTransactions.returnId],
      references: [returns.id],
    }),
    sale: one(sales, {
      fields: [giftCardTransactions.saleId],
      references: [sales.id],
    }),
  })
);
