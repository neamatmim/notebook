import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const projectTypeEnum = pgEnum("project_type", [
  "real_estate",
  "business_venture",
  "infrastructure",
  "financial_instrument",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "funding",
  "active",
  "completed",
  "cancelled",
]);

export const riskLevelEnum = pgEnum("risk_level", [
  "low",
  "medium",
  "high",
  "very_high",
]);

export const investorTypeEnum = pgEnum("investor_type", [
  "individual",
  "corporate",
  "institutional",
]);

export const kycStatusEnum = pgEnum("kyc_status", [
  "pending",
  "approved",
  "rejected",
]);

export const investmentStatusEnum = pgEnum("investment_status", [
  "pending",
  "active",
  "exited",
  "defaulted",
]);

export const milestoneStatusEnum = pgEnum("milestone_status", [
  "pending",
  "in_progress",
  "completed",
  "delayed",
]);

export const distributionTypeEnum = pgEnum("distribution_type", [
  "dividend",
  "interest",
  "capital_return",
  "profit_share",
]);

export const distributionStatusEnum = pgEnum("distribution_status", [
  "scheduled",
  "pending",
  "paid",
  "cancelled",
]);

export const cashFlowTypeEnum = pgEnum("cash_flow_type", ["inflow", "outflow"]);

export const shareClassTypeEnum = pgEnum("share_class_type", [
  "ordinary",
  "preference",
  "redeemable",
  "convertible",
]);

export const allotmentStatusEnum = pgEnum("allotment_status", [
  "active",
  "transferred",
  "cancelled",
  "suspended",
]);

export const capitalCallStatusEnum = pgEnum("capital_call_status", [
  "draft",
  "issued",
  "partially_paid",
  "fully_paid",
  "cancelled",
]);

export const shareholderPaymentTypeEnum = pgEnum("shareholder_payment_type", [
  "dividend",
  "capital_contribution",
  "capital_call",
  "loan_repayment",
  "interest",
]);

export const shareholderPaymentStatusEnum = pgEnum(
  "shareholder_payment_status",
  ["pending", "partial", "paid", "overdue", "waived"]
);

export const loanStatusEnum = pgEnum("loan_status", [
  "active",
  "repaid",
  "defaulted",
]);

export const feeTypeEnum = pgEnum("fee_type", ["flat_per_member", "per_share"]);
export const billingCycleEnum = pgEnum("billing_cycle", [
  "monthly",
  "quarterly",
  "biannual",
  "annual",
]);
export const feeInvoiceStatusEnum = pgEnum("fee_invoice_status", [
  "pending",
  "paid",
  "overdue",
  "waived",
]);
export const memberStatusEnum = pgEnum("member_status", [
  "active",
  "suspended",
  "resigned",
]);

export const investmentProjects = pgTable("investment_projects", {
  accountingAssetAccountId: uuid("accounting_asset_account_id"),
  accountingEquityAccountId: uuid("accounting_equity_account_id"),
  accountingRevenueAccountId: uuid("accounting_revenue_account_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  currency: text("currency").default("USD").notNull(),
  description: text("description"),
  discountRate: decimal("discount_rate", { precision: 8, scale: 4 }),
  endDate: timestamp("end_date"),
  expectedReturnRate: decimal("expected_return_rate", {
    precision: 8,
    scale: 4,
  }),
  fundingDeadline: timestamp("funding_deadline"),
  hurdleRate: decimal("hurdle_rate", { precision: 8, scale: 4 }),
  id: uuid("id").primaryKey().defaultRandom(),
  maximumInvestment: decimal("maximum_investment", { precision: 15, scale: 2 }),
  minimumInvestment: decimal("minimum_investment", { precision: 15, scale: 2 }),
  name: text("name").notNull(),
  notes: text("notes"),
  raisedAmount: decimal("raised_amount", { precision: 15, scale: 2 })
    .default("0")
    .notNull(),
  riskLevel: riskLevelEnum("risk_level"),
  startDate: timestamp("start_date"),
  status: projectStatusEnum("status").default("draft").notNull(),
  targetAmount: decimal("target_amount", { precision: 15, scale: 2 }).notNull(),
  type: projectTypeEnum("type").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const investmentProjectsRelations = relations(
  investmentProjects,
  ({ many }) => ({
    cashFlows: many(cashFlowProjections),
    distributions: many(distributions),
    investments: many(investments),
    milestones: many(projectMilestones),
  })
);

export const investors = pgTable("investors", {
  address: text("address"),
  country: text("country"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  email: text("email").notNull().unique(),
  id: uuid("id").primaryKey().defaultRandom(),
  kycApprovedAt: timestamp("kyc_approved_at"),
  kycStatus: kycStatusEnum("kyc_status").default("pending").notNull(),
  name: text("name").notNull(),
  notes: text("notes"),
  phone: text("phone"),
  taxId: text("tax_id"),
  type: investorTypeEnum("type").default("individual").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const investorsRelations = relations(investors, ({ many }) => ({
  distributions: many(distributions),
  investments: many(investments),
  shareholderAllocations: many(shareholderAllocations),
  shareholderPayments: many(shareholderPayments),
}));

export const investments = pgTable("investments", {
  actualReturnAmount: decimal("actual_return_amount", {
    precision: 15,
    scale: 2,
  })
    .default("0")
    .notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  equityPercentage: decimal("equity_percentage", { precision: 8, scale: 6 }),
  exitDate: timestamp("exit_date"),
  expectedReturnAmount: decimal("expected_return_amount", {
    precision: 15,
    scale: 2,
  }),
  id: uuid("id").primaryKey().defaultRandom(),
  investmentDate: timestamp("investment_date").notNull(),
  investorId: uuid("investor_id").notNull(),
  journalEntryId: uuid("journal_entry_id"),
  notes: text("notes"),
  projectId: uuid("project_id").notNull(),
  status: investmentStatusEnum("status").default("pending").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const investmentsRelations = relations(investments, ({ one, many }) => ({
  distributions: many(distributions),
  investor: one(investors, {
    fields: [investments.investorId],
    references: [investors.id],
  }),
  project: one(investmentProjects, {
    fields: [investments.projectId],
    references: [investmentProjects.id],
  }),
}));

export const projectMilestones = pgTable("project_milestones", {
  actualCost: decimal("actual_cost", { precision: 15, scale: 2 }),
  actualDate: timestamp("actual_date"),
  budgetAllocated: decimal("budget_allocated", { precision: 15, scale: 2 }),
  completionPercentage: integer("completion_percentage").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  description: text("description"),
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  notes: text("notes"),
  plannedDate: timestamp("planned_date"),
  projectId: uuid("project_id").notNull(),
  status: milestoneStatusEnum("status").default("pending").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectMilestonesRelations = relations(
  projectMilestones,
  ({ one }) => ({
    project: one(investmentProjects, {
      fields: [projectMilestones.projectId],
      references: [investmentProjects.id],
    }),
  })
);

export const cashFlowProjections = pgTable("cash_flow_projections", {
  actualInflow: decimal("actual_inflow", { precision: 15, scale: 2 })
    .default("0")
    .notNull(),
  actualOutflow: decimal("actual_outflow", { precision: 15, scale: 2 })
    .default("0")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  description: text("description"),
  id: uuid("id").primaryKey().defaultRandom(),
  periodDate: timestamp("period_date").notNull(),
  periodNumber: integer("period_number").notNull(),
  projectId: uuid("project_id").notNull(),
  projectedInflow: decimal("projected_inflow", { precision: 15, scale: 2 })
    .default("0")
    .notNull(),
  projectedOutflow: decimal("projected_outflow", { precision: 15, scale: 2 })
    .default("0")
    .notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cashFlowProjectionsRelations = relations(
  cashFlowProjections,
  ({ one }) => ({
    project: one(investmentProjects, {
      fields: [cashFlowProjections.projectId],
      references: [investmentProjects.id],
    }),
  })
);

export const distributions = pgTable("distributions", {
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  distributionDate: timestamp("distribution_date").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  investmentId: uuid("investment_id").notNull(),
  investorId: uuid("investor_id").notNull(),
  journalEntryId: uuid("journal_entry_id"),
  notes: text("notes"),
  periodEnd: timestamp("period_end"),
  periodStart: timestamp("period_start"),
  projectId: uuid("project_id").notNull(),
  status: distributionStatusEnum("status").default("scheduled").notNull(),
  type: distributionTypeEnum("type").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const distributionsRelations = relations(distributions, ({ one }) => ({
  investment: one(investments, {
    fields: [distributions.investmentId],
    references: [investments.id],
  }),
  investor: one(investors, {
    fields: [distributions.investorId],
    references: [investors.id],
  }),
  project: one(investmentProjects, {
    fields: [distributions.projectId],
    references: [investmentProjects.id],
  }),
}));

export const shareClasses = pgTable("share_classes", {
  authorizedShares: integer("authorized_shares"),
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  dividendPriority: integer("dividend_priority").default(0).notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  issuedShares: integer("issued_shares").default(0).notNull(),
  name: text("name").notNull(),
  notes: text("notes"),
  parValue: decimal("par_value", { precision: 15, scale: 4 }),
  type: shareClassTypeEnum("type").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  votingRights: boolean("voting_rights").default(true).notNull(),
});

export const shareClassesRelations = relations(shareClasses, ({ many }) => ({
  allocations: many(shareholderAllocations),
  capitalCalls: many(capitalCalls),
}));

export const shareholderAllocations = pgTable("shareholder_allocations", {
  allotmentDate: timestamp("allotment_date").notNull(),
  certificateNumber: text("certificate_number").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  investorId: uuid("investor_id").notNull(),
  issuePricePerShare: decimal("issue_price_per_share", {
    precision: 15,
    scale: 4,
  }).notNull(),
  journalEntryId: uuid("journal_entry_id"),
  notes: text("notes"),
  numberOfShares: integer("number_of_shares").notNull(),
  shareClassId: uuid("share_class_id").notNull(),
  status: allotmentStatusEnum("status").default("active").notNull(),
  totalConsideration: decimal("total_consideration", {
    precision: 15,
    scale: 2,
  }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const shareholderAllocationsRelations = relations(
  shareholderAllocations,
  ({ one }) => ({
    investor: one(investors, {
      fields: [shareholderAllocations.investorId],
      references: [investors.id],
    }),
    shareClass: one(shareClasses, {
      fields: [shareholderAllocations.shareClassId],
      references: [shareClasses.id],
    }),
  })
);

export const shareTransfers = pgTable("share_transfers", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  fromShareholderId: uuid("from_shareholder_id").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  newCertificateNumber: text("new_certificate_number"),
  notes: text("notes"),
  oldCertificateNumber: text("old_certificate_number"),
  pricePerShare: decimal("price_per_share", { precision: 15, scale: 4 }),
  shareClassId: uuid("share_class_id").notNull(),
  sharesTransferred: integer("shares_transferred").notNull(),
  toShareholderId: uuid("to_shareholder_id").notNull(),
  transferDate: timestamp("transfer_date").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const shareTransfersRelations = relations(shareTransfers, ({ one }) => ({
  fromShareholder: one(investors, {
    fields: [shareTransfers.fromShareholderId],
    references: [investors.id],
    relationName: "fromShareholder",
  }),
  shareClass: one(shareClasses, {
    fields: [shareTransfers.shareClassId],
    references: [shareClasses.id],
  }),
  toShareholder: one(investors, {
    fields: [shareTransfers.toShareholderId],
    references: [investors.id],
    relationName: "toShareholder",
  }),
}));

export const capitalCalls = pgTable("capital_calls", {
  amountPerShare: decimal("amount_per_share", {
    precision: 15,
    scale: 4,
  }).notNull(),
  callDate: timestamp("call_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  description: text("description").notNull(),
  dueDate: timestamp("due_date").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  notes: text("notes"),
  shareClassId: uuid("share_class_id").notNull(),
  status: capitalCallStatusEnum("status").default("draft").notNull(),
  totalAmountCalled: decimal("total_amount_called", {
    precision: 15,
    scale: 2,
  }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const capitalCallsRelations = relations(
  capitalCalls,
  ({ one, many }) => ({
    payments: many(shareholderPayments),
    shareClass: one(shareClasses, {
      fields: [capitalCalls.shareClassId],
      references: [shareClasses.id],
    }),
  })
);

export const shareholderPayments = pgTable("shareholder_payments", {
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  capitalCallId: uuid("capital_call_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  dueDate: timestamp("due_date"),
  id: uuid("id").primaryKey().defaultRandom(),
  investorId: uuid("investor_id").notNull(),
  journalEntryId: uuid("journal_entry_id"),
  notes: text("notes"),
  paidDate: timestamp("paid_date"),
  reference: text("reference"),
  status: shareholderPaymentStatusEnum("status").default("pending").notNull(),
  type: shareholderPaymentTypeEnum("type").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const shareholderPaymentsRelations = relations(
  shareholderPayments,
  ({ one }) => ({
    capitalCall: one(capitalCalls, {
      fields: [shareholderPayments.capitalCallId],
      references: [capitalCalls.id],
    }),
    investor: one(investors, {
      fields: [shareholderPayments.investorId],
      references: [investors.id],
    }),
  })
);

export const membershipFeeSchedules = pgTable("membership_fee_schedules", {
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  billingCycle: billingCycleEnum("billing_cycle").notNull(),
  cashAccountId: uuid("cash_account_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  description: text("description"),
  feeType: feeTypeEnum("fee_type").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  isActive: boolean("is_active").default(true).notNull(),
  name: text("name").notNull(),
  notes: text("notes"),
  revenueAccountId: uuid("revenue_account_id"),
  shareClassId: uuid("share_class_id").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const membershipFeeSchedulesRelations = relations(
  membershipFeeSchedules,
  ({ one, many }) => ({
    invoices: many(membershipFeeInvoices),
    shareClass: one(shareClasses, {
      fields: [membershipFeeSchedules.shareClassId],
      references: [shareClasses.id],
    }),
  })
);

export const membershipFeeInvoices = pgTable("membership_fee_invoices", {
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  dueDate: timestamp("due_date").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  investorId: uuid("investor_id").notNull(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  journalEntryId: uuid("journal_entry_id"),
  notes: text("notes"),
  paidAt: timestamp("paid_at"),
  periodEnd: timestamp("period_end").notNull(),
  periodLabel: text("period_label").notNull(),
  periodStart: timestamp("period_start").notNull(),
  scheduleId: uuid("schedule_id").notNull(),
  shareCount: integer("share_count").notNull(),
  status: feeInvoiceStatusEnum("status").default("pending").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  waivedReason: text("waived_reason"),
});

export const membershipFeeInvoicesRelations = relations(
  membershipFeeInvoices,
  ({ one }) => ({
    investor: one(investors, {
      fields: [membershipFeeInvoices.investorId],
      references: [investors.id],
    }),
    schedule: one(membershipFeeSchedules, {
      fields: [membershipFeeInvoices.scheduleId],
      references: [membershipFeeSchedules.id],
    }),
  })
);

export const memberStatuses = pgTable("member_statuses", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  investorId: uuid("investor_id").notNull().unique(),
  resignedAt: timestamp("resigned_at"),
  resignedReason: text("resigned_reason"),
  status: memberStatusEnum("status").default("active").notNull(),
  suspendedAt: timestamp("suspended_at"),
  suspendedReason: text("suspended_reason"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const memberStatusesRelations = relations(memberStatuses, ({ one }) => ({
  investor: one(investors, {
    fields: [memberStatuses.investorId],
    references: [investors.id],
  }),
}));
