import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const accountTypeEnum = pgEnum("account_type", [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
]);

export const normalBalanceEnum = pgEnum("normal_balance", ["debit", "credit"]);

export const fiscalYearStatusEnum = pgEnum("fiscal_year_status", [
  "open",
  "closed",
]);

export const periodStatusEnum = pgEnum("period_status", [
  "open",
  "closed",
  "locked",
]);

export const journalEntryStatusEnum = pgEnum("journal_entry_status", [
  "draft",
  "posted",
  "void",
]);

export const journalSourceTypeEnum = pgEnum("journal_source_type", [
  "sale",
  "expense",
  "manual",
  "return",
  "purchase_order",
  "membership_fee",
]);

export const entryLineTypeEnum = pgEnum("entry_line_type", ["debit", "credit"]);

export const expenseStatusEnum = pgEnum("expense_status", [
  "pending",
  "approved",
  "paid",
]);

export const accounts = pgTable("accounts", {
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  currentBalance: decimal("current_balance", { precision: 15, scale: 2 })
    .default("0")
    .notNull(),
  description: text("description"),
  id: uuid("id").primaryKey().defaultRandom(),
  isActive: boolean("is_active").default(true).notNull(),
  isSystem: boolean("is_system").default(false).notNull(),
  name: text("name").notNull(),
  normalBalance: normalBalanceEnum("normal_balance").notNull(),
  parentId: uuid("parent_id"),
  type: accountTypeEnum("type").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  children: many(accounts, { relationName: "parentChild" }),
  expenseCategory: many(expenses, { relationName: "categoryAccount" }),
  expensePayment: many(expenses, { relationName: "paymentAccount" }),
  journalLines: many(journalEntryLines),
  parent: one(accounts, {
    fields: [accounts.parentId],
    references: [accounts.id],
    relationName: "parentChild",
  }),
}));

export const fiscalYears = pgTable("fiscal_years", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  endDate: timestamp("end_date").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  isCurrent: boolean("is_current").default(false).notNull(),
  name: text("name").notNull(),
  startDate: timestamp("start_date").notNull(),
  status: fiscalYearStatusEnum("status").default("open").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const fiscalYearsRelations = relations(fiscalYears, ({ many }) => ({
  periods: many(accountingPeriods),
}));

export const accountingPeriods = pgTable("accounting_periods", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  endDate: timestamp("end_date").notNull(),
  fiscalYearId: uuid("fiscal_year_id").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  periodNumber: integer("period_number").notNull(),
  startDate: timestamp("start_date").notNull(),
  status: periodStatusEnum("status").default("open").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accountingPeriodsRelations = relations(
  accountingPeriods,
  ({ one, many }) => ({
    fiscalYear: one(fiscalYears, {
      fields: [accountingPeriods.fiscalYearId],
      references: [fiscalYears.id],
    }),
    journalEntries: many(journalEntries),
  })
);

export const journalEntries = pgTable(
  "journal_entries",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by").notNull(),
    date: timestamp("date").notNull(),
    description: text("description").notNull(),
    entryNumber: text("entry_number").notNull().unique(),
    id: uuid("id").primaryKey().defaultRandom(),
    periodId: uuid("period_id"),
    postedAt: timestamp("posted_at"),
    reference: text("reference"),
    sourceId: uuid("source_id"),
    sourceType: journalSourceTypeEnum("source_type").notNull(),
    status: journalEntryStatusEnum("status").default("draft").notNull(),
    totalCredit: decimal("total_credit", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    totalDebit: decimal("total_debit", { precision: 15, scale: 2 })
      .default("0")
      .notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    voidedAt: timestamp("voided_at"),
    voidReason: text("void_reason"),
  },
  (t) => [
    index("je_status_idx").on(t.status),
    index("je_source_type_idx").on(t.sourceType),
    index("je_period_id_idx").on(t.periodId),
    index("je_date_idx").on(t.date),
  ]
);

export const journalEntriesRelations = relations(
  journalEntries,
  ({ one, many }) => ({
    lines: many(journalEntryLines),
    period: one(accountingPeriods, {
      fields: [journalEntries.periodId],
      references: [accountingPeriods.id],
    }),
  })
);

export const journalEntryLines = pgTable(
  "journal_entry_lines",
  {
    accountId: uuid("account_id").notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    entryId: uuid("entry_id").notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    type: entryLineTypeEnum("type").notNull(),
  },
  (t) => [
    index("jel_entry_id_idx").on(t.entryId),
    index("jel_account_id_idx").on(t.accountId),
  ]
);

export const journalEntryLinesRelations = relations(
  journalEntryLines,
  ({ one }) => ({
    account: one(accounts, {
      fields: [journalEntryLines.accountId],
      references: [accounts.id],
    }),
    entry: one(journalEntries, {
      fields: [journalEntryLines.entryId],
      references: [journalEntries.id],
    }),
  })
);

export const expenses = pgTable(
  "expenses",
  {
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    categoryAccountId: uuid("category_account_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by").notNull(),
    date: timestamp("date").notNull(),
    description: text("description").notNull(),
    expenseNumber: text("expense_number").notNull().unique(),
    id: uuid("id").primaryKey().defaultRandom(),
    notes: text("notes"),
    paymentAccountId: uuid("payment_account_id").notNull(),
    periodId: uuid("period_id"),
    status: expenseStatusEnum("status").default("pending").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    vendorName: text("vendor_name"),
  },
  (t) => [
    index("exp_status_idx").on(t.status),
    index("exp_period_id_idx").on(t.periodId),
    index("exp_date_idx").on(t.date),
  ]
);

export const expensesRelations = relations(expenses, ({ one }) => ({
  categoryAccount: one(accounts, {
    fields: [expenses.categoryAccountId],
    references: [accounts.id],
    relationName: "categoryAccount",
  }),
  paymentAccount: one(accounts, {
    fields: [expenses.paymentAccountId],
    references: [accounts.id],
    relationName: "paymentAccount",
  }),
  period: one(accountingPeriods, {
    fields: [expenses.periodId],
    references: [accountingPeriods.id],
  }),
}));
