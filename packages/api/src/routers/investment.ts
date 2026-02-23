import { db } from "@notebook/db";
import {
  capitalCalls,
  cashFlowProjections,
  distributions,
  investmentProjects,
  investments,
  investors,
  journalEntries,
  journalEntryLines,
  projectMilestones,
  shareClasses,
  shareholderAllocations,
  shareholderPayments,
  shareTransfers,
} from "@notebook/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { makeEntryNumber, updateAccountBalances } from "./accounting";

function calculateIRR(cashFlows: number[], guess = 0.1): number {
  let rate = guess;
  let iterations = 100;
  while (iterations > 0) {
    iterations -= 1;
    const r = rate;
    const npv = cashFlows.reduce((sum, cf, t) => sum + cf / (1 + r) ** t, 0);
    const dNpv = cashFlows.reduce(
      (sum, cf, t) => sum - (t * cf) / (1 + r) ** (t + 1),
      0
    );
    if (dNpv === 0) {
      break;
    }
    const newRate = r - npv / dNpv;
    if (Math.abs(newRate - r) < 1e-8) {
      return newRate;
    }
    rate = newRate;
  }
  return rate;
}

function calculateNPV(cashFlows: number[], discountRate: number): number {
  return cashFlows.reduce(
    (sum, cf, t) => sum + cf / (1 + discountRate) ** t,
    0
  );
}

function calculateROI(totalReturns: number, totalInvested: number): number {
  if (totalInvested === 0) {
    return 0;
  }
  return ((totalReturns - totalInvested) / totalInvested) * 100;
}

const projectsRouter = {
  close: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["completed", "cancelled"]),
      })
    )
    .handler(async ({ input }) => {
      const [project] = await db
        .select({
          id: investmentProjects.id,
          status: investmentProjects.status,
        })
        .from(investmentProjects)
        .where(eq(investmentProjects.id, input.id))
        .limit(1);

      if (!project) {
        throw new ORPCError("NOT_FOUND", { message: "Project not found" });
      }

      const [updated] = await db
        .update(investmentProjects)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(investmentProjects.id, input.id))
        .returning();

      return updated;
    }),

  create: protectedProcedure
    .input(
      z.object({
        accountingAssetAccountId: z.string().uuid().optional(),
        accountingEquityAccountId: z.string().uuid().optional(),
        accountingRevenueAccountId: z.string().uuid().optional(),
        currency: z.string().default("USD"),
        description: z.string().optional(),
        discountRate: z.string().optional(),
        endDate: z.string().optional(),
        expectedReturnRate: z.string().optional(),
        fundingDeadline: z.string().optional(),
        hurdleRate: z.string().optional(),
        maximumInvestment: z.string().optional(),
        minimumInvestment: z.string().optional(),
        name: z.string().min(1),
        notes: z.string().optional(),
        riskLevel: z.enum(["low", "medium", "high", "very_high"]).optional(),
        startDate: z.string().optional(),
        targetAmount: z.string(),
        type: z.enum([
          "real_estate",
          "business_venture",
          "infrastructure",
          "financial_instrument",
        ]),
      })
    )
    .handler(async ({ input }) => {
      const [project] = await db
        .insert(investmentProjects)
        .values({
          accountingAssetAccountId: input.accountingAssetAccountId,
          accountingEquityAccountId: input.accountingEquityAccountId,
          accountingRevenueAccountId: input.accountingRevenueAccountId,
          currency: input.currency,
          description: input.description,
          discountRate: input.discountRate,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          expectedReturnRate: input.expectedReturnRate,
          fundingDeadline: input.fundingDeadline
            ? new Date(input.fundingDeadline)
            : undefined,
          hurdleRate: input.hurdleRate,
          maximumInvestment: input.maximumInvestment,
          minimumInvestment: input.minimumInvestment,
          name: input.name,
          notes: input.notes,
          riskLevel: input.riskLevel,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          targetAmount: input.targetAmount,
          type: input.type,
        })
        .returning();

      return project;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      const [project] = await db
        .select()
        .from(investmentProjects)
        .where(eq(investmentProjects.id, input.id))
        .limit(1);

      if (!project) {
        throw new ORPCError("NOT_FOUND", { message: "Project not found" });
      }

      const projectInvestments = await db
        .select({
          actualReturnAmount: investments.actualReturnAmount,
          amount: investments.amount,
          equityPercentage: investments.equityPercentage,
          id: investments.id,
          investmentDate: investments.investmentDate,
          investorId: investments.investorId,
          status: investments.status,
        })
        .from(investments)
        .where(eq(investments.projectId, input.id));

      const milestones = await db
        .select()
        .from(projectMilestones)
        .where(eq(projectMilestones.projectId, input.id))
        .orderBy(projectMilestones.plannedDate);

      const cashFlows = await db
        .select()
        .from(cashFlowProjections)
        .where(eq(cashFlowProjections.projectId, input.id))
        .orderBy(cashFlowProjections.periodNumber);

      return {
        ...project,
        cashFlows,
        investments: projectInvestments,
        milestones,
      };
    }),

  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
        riskLevel: z.enum(["low", "medium", "high", "very_high"]).optional(),
        search: z.string().optional(),
        status: z
          .enum(["draft", "funding", "active", "completed", "cancelled"])
          .optional(),
        type: z
          .enum([
            "real_estate",
            "business_venture",
            "infrastructure",
            "financial_instrument",
          ])
          .optional(),
      })
    )
    .handler(async ({ input }) => {
      const conditions = [];
      if (input.status) {
        conditions.push(eq(investmentProjects.status, input.status));
      }
      if (input.type) {
        conditions.push(eq(investmentProjects.type, input.type));
      }
      if (input.riskLevel) {
        conditions.push(eq(investmentProjects.riskLevel, input.riskLevel));
      }
      if (input.search) {
        conditions.push(ilike(investmentProjects.name, `%${input.search}%`));
      }

      const items = await db
        .select()
        .from(investmentProjects)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(investmentProjects.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(investmentProjects)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return { items, total: Number(countRow?.count ?? 0) };
    }),

  publish: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      const [project] = await db
        .select({
          id: investmentProjects.id,
          status: investmentProjects.status,
          targetAmount: investmentProjects.targetAmount,
        })
        .from(investmentProjects)
        .where(eq(investmentProjects.id, input.id))
        .limit(1);

      if (!project) {
        throw new ORPCError("NOT_FOUND", { message: "Project not found" });
      }
      if (project.status !== "draft") {
        throw new ORPCError("BAD_REQUEST", {
          message: "Only draft projects can be published",
        });
      }
      if (!project.targetAmount || Number(project.targetAmount) <= 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Target amount must be set before publishing",
        });
      }

      const [updated] = await db
        .update(investmentProjects)
        .set({ status: "funding", updatedAt: new Date() })
        .where(eq(investmentProjects.id, input.id))
        .returning();

      return updated;
    }),

  update: protectedProcedure
    .input(
      z.object({
        accountingAssetAccountId: z.string().uuid().optional(),
        accountingEquityAccountId: z.string().uuid().optional(),
        accountingRevenueAccountId: z.string().uuid().optional(),
        currency: z.string().optional(),
        description: z.string().optional(),
        discountRate: z.string().optional(),
        endDate: z.string().optional(),
        expectedReturnRate: z.string().optional(),
        fundingDeadline: z.string().optional(),
        hurdleRate: z.string().optional(),
        id: z.string().uuid(),
        maximumInvestment: z.string().optional(),
        minimumInvestment: z.string().optional(),
        name: z.string().min(1).optional(),
        notes: z.string().optional(),
        riskLevel: z.enum(["low", "medium", "high", "very_high"]).optional(),
        startDate: z.string().optional(),
        targetAmount: z.string().optional(),
        type: z
          .enum([
            "real_estate",
            "business_venture",
            "infrastructure",
            "financial_instrument",
          ])
          .optional(),
      })
    )
    .handler(async ({ input }) => {
      const { id, ...fields } = input;

      const [updated] = await db
        .update(investmentProjects)
        .set({
          ...fields,
          endDate: fields.endDate ? new Date(fields.endDate) : undefined,
          fundingDeadline: fields.fundingDeadline
            ? new Date(fields.fundingDeadline)
            : undefined,
          startDate: fields.startDate ? new Date(fields.startDate) : undefined,
          updatedAt: new Date(),
        })
        .where(eq(investmentProjects.id, id))
        .returning();

      if (!updated) {
        throw new ORPCError("NOT_FOUND", { message: "Project not found" });
      }
      return updated;
    }),
};

const investorsRouter = {
  approveKyc: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      const [updated] = await db
        .update(investors)
        .set({
          kycApprovedAt: new Date(),
          kycStatus: "approved",
          updatedAt: new Date(),
        })
        .where(eq(investors.id, input.id))
        .returning();

      if (!updated) {
        throw new ORPCError("NOT_FOUND", { message: "Investor not found" });
      }
      return updated;
    }),

  create: protectedProcedure
    .input(
      z.object({
        address: z.string().optional(),
        country: z.string().optional(),
        email: z.string().email(),
        name: z.string().min(1),
        notes: z.string().optional(),
        phone: z.string().optional(),
        taxId: z.string().optional(),
        type: z
          .enum(["individual", "corporate", "institutional"])
          .default("individual"),
      })
    )
    .handler(async ({ input }) => {
      const existing = await db
        .select({ id: investors.id })
        .from(investors)
        .where(eq(investors.email, input.email))
        .limit(1);

      if (existing.length > 0) {
        throw new ORPCError("CONFLICT", {
          message: "An investor with this email already exists",
        });
      }

      const [investor] = await db.insert(investors).values(input).returning();
      return investor;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      const [investor] = await db
        .select()
        .from(investors)
        .where(eq(investors.id, input.id))
        .limit(1);

      if (!investor) {
        throw new ORPCError("NOT_FOUND", { message: "Investor not found" });
      }

      const portfolio = await db
        .select({
          actualReturnAmount: investments.actualReturnAmount,
          amount: investments.amount,
          equityPercentage: investments.equityPercentage,
          id: investments.id,
          investmentDate: investments.investmentDate,
          projectId: investments.projectId,
          status: investments.status,
        })
        .from(investments)
        .where(eq(investments.investorId, input.id));

      const totalInvested = portfolio.reduce(
        (sum, inv) => sum + Number(inv.amount),
        0
      );
      const totalReturns = portfolio.reduce(
        (sum, inv) => sum + Number(inv.actualReturnAmount),
        0
      );
      const roi = calculateROI(totalReturns, totalInvested);

      return { ...investor, portfolio, roi, totalInvested, totalReturns };
    }),

  list: protectedProcedure
    .input(
      z.object({
        kycStatus: z.enum(["pending", "approved", "rejected"]).optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
        search: z.string().optional(),
      })
    )
    .handler(async ({ input }) => {
      const conditions = [];
      if (input.kycStatus) {
        conditions.push(eq(investors.kycStatus, input.kycStatus));
      }
      if (input.search) {
        conditions.push(
          or(
            ilike(investors.name, `%${input.search}%`),
            ilike(investors.email, `%${input.search}%`)
          )
        );
      }

      const items = await db
        .select()
        .from(investors)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(investors.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(investors)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return { items, total: Number(countRow?.count ?? 0) };
    }),

  rejectKyc: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      const [updated] = await db
        .update(investors)
        .set({ kycStatus: "rejected", updatedAt: new Date() })
        .where(eq(investors.id, input.id))
        .returning();

      if (!updated) {
        throw new ORPCError("NOT_FOUND", { message: "Investor not found" });
      }
      return updated;
    }),

  update: protectedProcedure
    .input(
      z.object({
        address: z.string().optional(),
        country: z.string().optional(),
        email: z.string().email().optional(),
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        notes: z.string().optional(),
        phone: z.string().optional(),
        taxId: z.string().optional(),
        type: z.enum(["individual", "corporate", "institutional"]).optional(),
      })
    )
    .handler(async ({ input }) => {
      const { id, ...fields } = input;
      const [updated] = await db
        .update(investors)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(investors.id, id))
        .returning();

      if (!updated) {
        throw new ORPCError("NOT_FOUND", { message: "Investor not found" });
      }
      return updated;
    }),
};

const investmentsRouter = {
  exit: protectedProcedure
    .input(
      z.object({
        actualReturnAmount: z.string(),
        exitDate: z.string(),
        id: z.string().uuid(),
      })
    )
    .handler(async ({ input, context }) =>
      db.transaction(async (tx) => {
        const [updated] = await tx
          .update(investments)
          .set({
            actualReturnAmount: input.actualReturnAmount,
            exitDate: new Date(input.exitDate),
            status: "exited",
            updatedAt: new Date(),
          })
          .where(eq(investments.id, input.id))
          .returning();

        if (!updated) {
          throw new ORPCError("NOT_FOUND", { message: "Investment not found" });
        }

        const [project] = await tx
          .select({
            accountingAssetAccountId:
              investmentProjects.accountingAssetAccountId,
            accountingEquityAccountId:
              investmentProjects.accountingEquityAccountId,
          })
          .from(investmentProjects)
          .where(eq(investmentProjects.id, updated.projectId))
          .limit(1);

        if (
          project?.accountingAssetAccountId &&
          project.accountingEquityAccountId
        ) {
          const userId = context.session?.user?.id ?? "system";
          const returnAmt = Number(input.actualReturnAmount);
          const entryNumber = makeEntryNumber("EXIT");

          const [entry] = await tx
            .insert(journalEntries)
            .values({
              createdBy: userId,
              date: new Date(input.exitDate),
              description: `Investment exit - return ${input.actualReturnAmount}`,
              entryNumber,
              sourceType: "manual",
              status: "posted",
              totalCredit: input.actualReturnAmount,
              totalDebit: input.actualReturnAmount,
            })
            .returning();

          if (entry) {
            const lines = [
              {
                accountId: project.accountingEquityAccountId,
                amount: returnAmt.toString(),
                description: "Investment exit — equity reduction",
                entryId: entry.id,
                type: "debit" as const,
              },
              {
                accountId: project.accountingAssetAccountId,
                amount: returnAmt.toString(),
                description: "Investment exit — asset returned",
                entryId: entry.id,
                type: "credit" as const,
              },
            ];
            await tx.insert(journalEntryLines).values(lines);
            await updateAccountBalances(tx, lines);
          }
        }

        return updated;
      })
    ),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      const [inv] = await db
        .select()
        .from(investments)
        .where(eq(investments.id, input.id))
        .limit(1);

      if (!inv) {
        throw new ORPCError("NOT_FOUND", { message: "Investment not found" });
      }
      return inv;
    }),

  invest: protectedProcedure
    .input(
      z.object({
        amount: z.string(),
        investmentDate: z.string(),
        investorId: z.string().uuid(),
        notes: z.string().optional(),
        projectId: z.string().uuid(),
      })
    )
    .handler(
      async ({ input, context }) =>
        await db.transaction(async (tx) => {
          const [project] = await tx
            .select()
            .from(investmentProjects)
            .where(eq(investmentProjects.id, input.projectId))
            .limit(1);

          if (!project) {
            throw new ORPCError("NOT_FOUND", { message: "Project not found" });
          }
          if (project.status !== "funding" && project.status !== "active") {
            throw new ORPCError("BAD_REQUEST", {
              message: "Project is not open for investment",
            });
          }

          const [investor] = await tx
            .select({ id: investors.id, kycStatus: investors.kycStatus })
            .from(investors)
            .where(eq(investors.id, input.investorId))
            .limit(1);

          if (!investor) {
            throw new ORPCError("NOT_FOUND", { message: "Investor not found" });
          }
          if (investor.kycStatus !== "approved") {
            throw new ORPCError("BAD_REQUEST", {
              message: "Investor KYC must be approved before investing",
            });
          }

          const amount = Number(input.amount);
          if (
            project.minimumInvestment &&
            amount < Number(project.minimumInvestment)
          ) {
            throw new ORPCError("BAD_REQUEST", {
              message: `Minimum investment is ${project.minimumInvestment}`,
            });
          }
          if (
            project.maximumInvestment &&
            amount > Number(project.maximumInvestment)
          ) {
            throw new ORPCError("BAD_REQUEST", {
              message: `Maximum investment is ${project.maximumInvestment}`,
            });
          }

          const newRaisedAmount = Number(project.raisedAmount) + amount;
          if (newRaisedAmount > Number(project.targetAmount)) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Investment exceeds project target amount",
            });
          }

          const [investment] = await tx
            .insert(investments)
            .values({
              amount: input.amount,
              investmentDate: new Date(input.investmentDate),
              investorId: input.investorId,
              notes: input.notes,
              projectId: input.projectId,
              status: "active",
            })
            .returning();

          // Update project raised amount
          await tx
            .update(investmentProjects)
            .set({
              raisedAmount: String(newRaisedAmount),
              status:
                newRaisedAmount >= Number(project.targetAmount)
                  ? "active"
                  : project.status,
              updatedAt: new Date(),
            })
            .where(eq(investmentProjects.id, input.projectId));

          // Recalculate equity for all investors
          const allInvestments = await tx
            .select({ amount: investments.amount, id: investments.id })
            .from(investments)
            .where(
              and(
                eq(investments.projectId, input.projectId),
                eq(investments.status, "active")
              )
            );

          for (const inv of allInvestments) {
            const equity = Number(inv.amount) / newRaisedAmount;
            await tx
              .update(investments)
              .set({ equityPercentage: String(equity), updatedAt: new Date() })
              .where(eq(investments.id, inv.id));
          }

          // Create journal entry if accounting accounts are configured
          if (
            project.accountingAssetAccountId &&
            project.accountingEquityAccountId
          ) {
            const userId = context.session?.user?.id ?? "system";
            const entryNumber = makeEntryNumber("INV");

            const [entry] = await tx
              .insert(journalEntries)
              .values({
                createdBy: userId,
                date: new Date(input.investmentDate),
                description: `Investment contribution - ${input.amount}`,
                entryNumber,
                sourceType: "manual",
                status: "posted",
                totalCredit: input.amount,
                totalDebit: input.amount,
              })
              .returning();

            if (entry && investment) {
              const lines = [
                {
                  accountId: project.accountingAssetAccountId,
                  amount: input.amount,
                  description: "Cash received from investor",
                  entryId: entry.id,
                  type: "debit" as const,
                },
                {
                  accountId: project.accountingEquityAccountId,
                  amount: input.amount,
                  description: "Capital contribution",
                  entryId: entry.id,
                  type: "credit" as const,
                },
              ];
              await tx.insert(journalEntryLines).values(lines);
              await updateAccountBalances(tx, lines);

              await tx
                .update(investments)
                .set({ journalEntryId: entry.id })
                .where(eq(investments.id, investment.id));
            }
          }

          return investment;
        })
    ),

  list: protectedProcedure
    .input(
      z.object({
        investorId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
        projectId: z.string().uuid().optional(),
        status: z.enum(["pending", "active", "exited", "defaulted"]).optional(),
      })
    )
    .handler(async ({ input }) => {
      const conditions = [];
      if (input.projectId) {
        conditions.push(eq(investments.projectId, input.projectId));
      }
      if (input.investorId) {
        conditions.push(eq(investments.investorId, input.investorId));
      }
      if (input.status) {
        conditions.push(eq(investments.status, input.status));
      }

      const items = await db
        .select()
        .from(investments)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(investments.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return { items };
    }),
};

const milestonesRouter = {
  complete: protectedProcedure
    .input(
      z.object({
        actualCost: z.string().optional(),
        actualDate: z.string(),
        id: z.string().uuid(),
      })
    )
    .handler(async ({ input }) => {
      const [updated] = await db
        .update(projectMilestones)
        .set({
          actualCost: input.actualCost,
          actualDate: new Date(input.actualDate),
          completionPercentage: 100,
          status: "completed",
          updatedAt: new Date(),
        })
        .where(eq(projectMilestones.id, input.id))
        .returning();

      if (!updated) {
        throw new ORPCError("NOT_FOUND", { message: "Milestone not found" });
      }
      return updated;
    }),

  create: protectedProcedure
    .input(
      z.object({
        budgetAllocated: z.string().optional(),
        description: z.string().optional(),
        name: z.string().min(1),
        notes: z.string().optional(),
        plannedDate: z.string().optional(),
        projectId: z.string().uuid(),
      })
    )
    .handler(async ({ input }) => {
      const [milestone] = await db
        .insert(projectMilestones)
        .values({
          ...input,
          plannedDate: input.plannedDate
            ? new Date(input.plannedDate)
            : undefined,
        })
        .returning();

      return milestone;
    }),

  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid().optional(),
        status: z
          .enum(["pending", "in_progress", "completed", "delayed"])
          .optional(),
      })
    )
    .handler(async ({ input }) => {
      const conditions = [];
      if (input.projectId) {
        conditions.push(eq(projectMilestones.projectId, input.projectId));
      }
      if (input.status) {
        conditions.push(eq(projectMilestones.status, input.status));
      }

      const items = await db
        .select()
        .from(projectMilestones)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(projectMilestones.plannedDate);

      return { items };
    }),

  update: protectedProcedure
    .input(
      z.object({
        actualCost: z.string().optional(),
        budgetAllocated: z.string().optional(),
        completionPercentage: z.number().int().min(0).max(100).optional(),
        description: z.string().optional(),
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        notes: z.string().optional(),
        plannedDate: z.string().optional(),
        status: z
          .enum(["pending", "in_progress", "completed", "delayed"])
          .optional(),
      })
    )
    .handler(async ({ input }) => {
      const { id, plannedDate, ...fields } = input;
      const [updated] = await db
        .update(projectMilestones)
        .set({
          ...fields,
          plannedDate: plannedDate ? new Date(plannedDate) : undefined,
          updatedAt: new Date(),
        })
        .where(eq(projectMilestones.id, id))
        .returning();

      if (!updated) {
        throw new ORPCError("NOT_FOUND", { message: "Milestone not found" });
      }
      return updated;
    }),
};

const cashFlowsRouter = {
  create: protectedProcedure
    .input(
      z.object({
        description: z.string().optional(),
        periodDate: z.string(),
        periodNumber: z.number().int().min(1),
        projectId: z.string().uuid(),
        projectedInflow: z.string().default("0"),
        projectedOutflow: z.string().default("0"),
      })
    )
    .handler(async ({ input }) => {
      const [cashFlow] = await db
        .insert(cashFlowProjections)
        .values({
          ...input,
          periodDate: new Date(input.periodDate),
        })
        .returning();

      return cashFlow;
    }),

  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .handler(async ({ input }) => {
      const items = await db
        .select()
        .from(cashFlowProjections)
        .where(eq(cashFlowProjections.projectId, input.projectId))
        .orderBy(cashFlowProjections.periodNumber);

      return { items };
    }),

  updateActual: protectedProcedure
    .input(
      z.object({
        actualInflow: z.string(),
        actualOutflow: z.string(),
        id: z.string().uuid(),
      })
    )
    .handler(async ({ input }) => {
      const [updated] = await db
        .update(cashFlowProjections)
        .set({
          actualInflow: input.actualInflow,
          actualOutflow: input.actualOutflow,
          updatedAt: new Date(),
        })
        .where(eq(cashFlowProjections.id, input.id))
        .returning();

      if (!updated) {
        throw new ORPCError("NOT_FOUND", { message: "Cash flow not found" });
      }
      return updated;
    }),
};

const distributionsRouter = {
  calculate: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        totalAmount: z.string(),
      })
    )
    .handler(async ({ input }) => {
      const activeInvestments = await db
        .select({
          amount: investments.amount,
          equityPercentage: investments.equityPercentage,
          id: investments.id,
          investorId: investments.investorId,
        })
        .from(investments)
        .where(
          and(
            eq(investments.projectId, input.projectId),
            eq(investments.status, "active")
          )
        );

      const totalAmount = Number(input.totalAmount);
      const breakdown = activeInvestments.map((inv) => ({
        amount: (totalAmount * Number(inv.equityPercentage ?? 0)).toFixed(2),
        equityPercentage: Number(inv.equityPercentage ?? 0),
        investmentId: inv.id,
        investorId: inv.investorId,
      }));

      return { breakdown, totalAmount };
    }),

  create: protectedProcedure
    .input(
      z.object({
        distributionDate: z.string(),
        notes: z.string().optional(),
        periodEnd: z.string().optional(),
        periodStart: z.string().optional(),
        projectId: z.string().uuid(),
        totalAmount: z.string(),
        type: z.enum([
          "dividend",
          "interest",
          "capital_return",
          "profit_share",
        ]),
      })
    )
    .handler(async ({ input }) => {
      const activeInvestments = await db
        .select({
          equityPercentage: investments.equityPercentage,
          id: investments.id,
          investorId: investments.investorId,
        })
        .from(investments)
        .where(
          and(
            eq(investments.projectId, input.projectId),
            eq(investments.status, "active")
          )
        );

      if (activeInvestments.length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "No active investments found for this project",
        });
      }

      const totalAmount = Number(input.totalAmount);
      const created = [];

      for (const inv of activeInvestments) {
        const share = totalAmount * Number(inv.equityPercentage ?? 0);
        const [dist] = await db
          .insert(distributions)
          .values({
            amount: share.toFixed(2),
            distributionDate: new Date(input.distributionDate),
            investmentId: inv.id,
            investorId: inv.investorId,
            notes: input.notes,
            periodEnd: input.periodEnd ? new Date(input.periodEnd) : undefined,
            periodStart: input.periodStart
              ? new Date(input.periodStart)
              : undefined,
            projectId: input.projectId,
            type: input.type,
          })
          .returning();

        created.push(dist);
      }

      return { created, count: created.length };
    }),

  list: protectedProcedure
    .input(
      z.object({
        investorId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
        projectId: z.string().uuid().optional(),
        status: z
          .enum(["scheduled", "pending", "paid", "cancelled"])
          .optional(),
        type: z
          .enum(["dividend", "interest", "capital_return", "profit_share"])
          .optional(),
      })
    )
    .handler(async ({ input }) => {
      const conditions = [];
      if (input.projectId) {
        conditions.push(eq(distributions.projectId, input.projectId));
      }
      if (input.investorId) {
        conditions.push(eq(distributions.investorId, input.investorId));
      }
      if (input.status) {
        conditions.push(eq(distributions.status, input.status));
      }
      if (input.type) {
        conditions.push(eq(distributions.type, input.type));
      }

      const items = await db
        .select()
        .from(distributions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(distributions.distributionDate))
        .limit(input.limit)
        .offset(input.offset);

      return { items };
    }),

  markPaid: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(
      async ({ input, context }) =>
        await db.transaction(async (tx) => {
          const [dist] = await tx
            .select()
            .from(distributions)
            .where(eq(distributions.id, input.id))
            .limit(1);

          if (!dist) {
            throw new ORPCError("NOT_FOUND", {
              message: "Distribution not found",
            });
          }
          if (dist.status === "paid") {
            throw new ORPCError("BAD_REQUEST", {
              message: "Distribution already paid",
            });
          }

          const [project] = await tx
            .select({
              accountingAssetAccountId:
                investmentProjects.accountingAssetAccountId,
              accountingRevenueAccountId:
                investmentProjects.accountingRevenueAccountId,
            })
            .from(investmentProjects)
            .where(eq(investmentProjects.id, dist.projectId))
            .limit(1);

          let journalEntryId: string | undefined;

          if (
            project?.accountingAssetAccountId &&
            project?.accountingRevenueAccountId
          ) {
            const userId = context.session?.user?.id ?? "system";
            const entryNumber = makeEntryNumber("DIST");

            const [entry] = await tx
              .insert(journalEntries)
              .values({
                createdBy: userId,
                date: dist.distributionDate,
                description: `Distribution payment - ${dist.type}`,
                entryNumber,
                sourceType: "manual",
                status: "posted",
                totalCredit: dist.amount,
                totalDebit: dist.amount,
              })
              .returning();

            if (entry) {
              const lines = [
                {
                  accountId: project.accountingRevenueAccountId,
                  amount: dist.amount,
                  description: "Returns distributed",
                  entryId: entry.id,
                  type: "debit" as const,
                },
                {
                  accountId: project.accountingAssetAccountId,
                  amount: dist.amount,
                  description: "Cash paid out",
                  entryId: entry.id,
                  type: "credit" as const,
                },
              ];
              await tx.insert(journalEntryLines).values(lines);
              await updateAccountBalances(tx, lines);

              journalEntryId = entry.id;
            }
          }

          // Update investor's actual return amount
          await tx
            .update(investments)
            .set({
              actualReturnAmount: sql`${investments.actualReturnAmount} + ${dist.amount}`,
              updatedAt: new Date(),
            })
            .where(eq(investments.id, dist.investmentId));

          const [updated] = await tx
            .update(distributions)
            .set({
              journalEntryId,
              status: "paid",
              updatedAt: new Date(),
            })
            .where(eq(distributions.id, input.id))
            .returning();

          return updated;
        })
    ),
};

const reportsRouter = {
  cashFlowStatement: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .handler(async ({ input }) => {
      const cashFlows = await db
        .select()
        .from(cashFlowProjections)
        .where(eq(cashFlowProjections.projectId, input.projectId))
        .orderBy(cashFlowProjections.periodNumber);

      return {
        periods: cashFlows.map((cf) => ({
          actualInflow: Number(cf.actualInflow),
          actualNet: Number(cf.actualInflow) - Number(cf.actualOutflow),
          actualOutflow: Number(cf.actualOutflow),
          description: cf.description,
          id: cf.id,
          periodDate: cf.periodDate,
          periodNumber: cf.periodNumber,
          projectedInflow: Number(cf.projectedInflow),
          projectedNet:
            Number(cf.projectedInflow) - Number(cf.projectedOutflow),
          projectedOutflow: Number(cf.projectedOutflow),
          varianceInflow: Number(cf.actualInflow) - Number(cf.projectedInflow),
          varianceOutflow:
            Number(cf.actualOutflow) - Number(cf.projectedOutflow),
        })),
      };
    }),

  investorPortfolio: protectedProcedure
    .input(z.object({ investorId: z.string().uuid() }))
    .handler(async ({ input }) => {
      const portfolio = await db
        .select({
          actualReturnAmount: investments.actualReturnAmount,
          amount: investments.amount,
          equityPercentage: investments.equityPercentage,
          id: investments.id,
          investmentDate: investments.investmentDate,
          projectId: investments.projectId,
          status: investments.status,
        })
        .from(investments)
        .where(eq(investments.investorId, input.investorId));

      const totalInvested = portfolio.reduce(
        (sum, inv) => sum + Number(inv.amount),
        0
      );
      const totalReturns = portfolio.reduce(
        (sum, inv) => sum + Number(inv.actualReturnAmount),
        0
      );

      return {
        investments: portfolio.map((inv) => ({
          ...inv,
          roi: calculateROI(Number(inv.actualReturnAmount), Number(inv.amount)),
        })),
        portfolioROI: calculateROI(totalReturns, totalInvested),
        totalInvested,
        totalReturns,
      };
    }),

  projectSummary: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .handler(async ({ input }) => {
      const [project] = await db
        .select()
        .from(investmentProjects)
        .where(eq(investmentProjects.id, input.projectId))
        .limit(1);

      if (!project) {
        throw new ORPCError("NOT_FOUND", { message: "Project not found" });
      }

      const projectInvestments = await db
        .select({
          actualReturnAmount: investments.actualReturnAmount,
          amount: investments.amount,
          equityPercentage: investments.equityPercentage,
          id: investments.id,
          investorId: investments.investorId,
          status: investments.status,
        })
        .from(investments)
        .where(eq(investments.projectId, input.projectId));

      const paidDistributions = await db
        .select({ amount: distributions.amount })
        .from(distributions)
        .where(
          and(
            eq(distributions.projectId, input.projectId),
            eq(distributions.status, "paid")
          )
        );

      const milestones = await db
        .select({
          completionPercentage: projectMilestones.completionPercentage,
        })
        .from(projectMilestones)
        .where(eq(projectMilestones.projectId, input.projectId));

      const cashFlows = await db
        .select()
        .from(cashFlowProjections)
        .where(eq(cashFlowProjections.projectId, input.projectId))
        .orderBy(cashFlowProjections.periodNumber);

      const totalInvested = projectInvestments.reduce(
        (sum, inv) => sum + Number(inv.amount),
        0
      );
      const activeInvestorCount = projectInvestments.filter(
        (inv) => inv.status === "active"
      ).length;
      const totalDistributionsPaid = paidDistributions.reduce(
        (sum, d) => sum + Number(d.amount),
        0
      );
      const milestoneCompletionAvg =
        milestones.length > 0
          ? milestones.reduce((sum, m) => sum + m.completionPercentage, 0) /
            milestones.length
          : 0;

      const roi = calculateROI(totalDistributionsPaid, totalInvested);

      // Build cash flow array for IRR/NPV: outflows negative, inflows positive
      const cfArray = cashFlows.map(
        (cf) => Number(cf.actualInflow) - Number(cf.actualOutflow)
      );
      if (cfArray.length > 0) {
        cfArray[0] = (cfArray[0] ?? 0) - totalInvested;
      }

      const discountRate = project.discountRate
        ? Number(project.discountRate) / 100
        : 0.1;
      const npv = cfArray.length > 0 ? calculateNPV(cfArray, discountRate) : 0;
      const irr = cfArray.length > 1 ? calculateIRR(cfArray) * 100 : 0;

      return {
        activeInvestorCount,
        fundingPercentage:
          Number(project.targetAmount) > 0
            ? (Number(project.raisedAmount) / Number(project.targetAmount)) *
              100
            : 0,
        hurdleRate: project.hurdleRate ? Number(project.hurdleRate) : null,
        investorCount: projectInvestments.length,
        irr,
        milestoneCompletionAvg,
        npv,
        project,
        raisedAmount: Number(project.raisedAmount),
        roi,
        targetAmount: Number(project.targetAmount),
        totalDistributionsPaid,
        totalInvested,
      };
    }),
};

const shareClassesRouter = {
  create: protectedProcedure
    .input(
      z.object({
        authorizedShares: z.number().int().optional(),
        code: z.string().min(1),
        dividendPriority: z.number().int().default(0),
        name: z.string().min(1),
        notes: z.string().optional(),
        parValue: z.string().optional(),
        type: z.enum(["ordinary", "preference", "redeemable", "convertible"]),
        votingRights: z.boolean().default(true),
      })
    )
    .handler(async ({ input }) => {
      const existing = await db
        .select({ id: shareClasses.id })
        .from(shareClasses)
        .where(eq(shareClasses.code, input.code))
        .limit(1);

      if (existing.length > 0) {
        throw new ORPCError("CONFLICT", {
          message: "A share class with this code already exists",
        });
      }

      const [sc] = await db.insert(shareClasses).values(input).returning();
      return sc;
    }),

  list: protectedProcedure.handler(async () => {
    const items = await db
      .select()
      .from(shareClasses)
      .orderBy(shareClasses.dividendPriority, shareClasses.name);
    return { items };
  }),

  update: protectedProcedure
    .input(
      z.object({
        authorizedShares: z.number().int().optional(),
        dividendPriority: z.number().int().optional(),
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        notes: z.string().optional(),
        parValue: z.string().optional(),
        votingRights: z.boolean().optional(),
      })
    )
    .handler(async ({ input }) => {
      const { id, ...fields } = input;
      const [updated] = await db
        .update(shareClasses)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(shareClasses.id, id))
        .returning();

      if (!updated) {
        throw new ORPCError("NOT_FOUND", { message: "Share class not found" });
      }
      return updated;
    }),
};

const shareholdersRouter = {
  allot: protectedProcedure
    .input(
      z.object({
        allotmentDate: z.string(),
        cashAccountId: z.string().uuid().optional(),
        certificateNumber: z.string().optional(),
        investorId: z.string().uuid(),
        issuePricePerShare: z.string(),
        notes: z.string().optional(),
        numberOfShares: z.number().int().min(1),
        shareCapitalAccountId: z.string().uuid().optional(),
        shareClassId: z.string().uuid(),
      })
    )
    .handler(
      async ({ input, context }) =>
        await db.transaction(async (tx) => {
          const [investor] = await tx
            .select({ id: investors.id, kycStatus: investors.kycStatus })
            .from(investors)
            .where(eq(investors.id, input.investorId))
            .limit(1);

          if (!investor) {
            throw new ORPCError("NOT_FOUND", {
              message: "Investor not found",
            });
          }
          if (investor.kycStatus !== "approved") {
            throw new ORPCError("BAD_REQUEST", {
              message: "Investor KYC must be approved before allotting shares",
            });
          }

          const [sc] = await tx
            .select()
            .from(shareClasses)
            .where(eq(shareClasses.id, input.shareClassId))
            .limit(1);

          if (!sc) {
            throw new ORPCError("NOT_FOUND", {
              message: "Share class not found",
            });
          }
          if (
            sc.authorizedShares !== null &&
            (sc.issuedShares ?? 0) + input.numberOfShares > sc.authorizedShares
          ) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Allotment exceeds authorized shares",
            });
          }

          const totalConsideration = (
            input.numberOfShares * Number(input.issuePricePerShare)
          ).toFixed(2);

          const [allocation] = await tx
            .insert(shareholderAllocations)
            .values({
              allotmentDate: new Date(input.allotmentDate),
              certificateNumber: input.certificateNumber,
              investorId: input.investorId,
              issuePricePerShare: input.issuePricePerShare,
              notes: input.notes,
              numberOfShares: input.numberOfShares,
              shareClassId: input.shareClassId,
              totalConsideration,
            })
            .returning();

          await tx
            .update(shareClasses)
            .set({
              issuedShares: (sc.issuedShares ?? 0) + input.numberOfShares,
              updatedAt: new Date(),
            })
            .where(eq(shareClasses.id, input.shareClassId));

          if (input.cashAccountId && input.shareCapitalAccountId) {
            const userId = context.session?.user?.id ?? "system";
            const entryNumber = makeEntryNumber("SHARE");

            const [entry] = await tx
              .insert(journalEntries)
              .values({
                createdBy: userId,
                date: new Date(input.allotmentDate),
                description: `Share allotment - ${input.numberOfShares} shares @ ${input.issuePricePerShare}`,
                entryNumber,
                sourceType: "manual",
                status: "posted",
                totalCredit: totalConsideration,
                totalDebit: totalConsideration,
              })
              .returning();

            if (entry && allocation) {
              const lines = [
                {
                  accountId: input.cashAccountId,
                  amount: totalConsideration,
                  description: "Cash received for shares",
                  entryId: entry.id,
                  type: "debit" as const,
                },
                {
                  accountId: input.shareCapitalAccountId,
                  amount: totalConsideration,
                  description: "Share capital issued",
                  entryId: entry.id,
                  type: "credit" as const,
                },
              ];
              await tx.insert(journalEntryLines).values(lines);
              await updateAccountBalances(tx, lines);

              await tx
                .update(shareholderAllocations)
                .set({ journalEntryId: entry.id })
                .where(eq(shareholderAllocations.id, allocation.id));
            }
          }

          return allocation;
        })
    ),

  getRegister: protectedProcedure.handler(async () => {
    const allocations = await db
      .select({
        allotmentDate: shareholderAllocations.allotmentDate,
        certificateNumber: shareholderAllocations.certificateNumber,
        investorId: shareholderAllocations.investorId,
        issuePricePerShare: shareholderAllocations.issuePricePerShare,
        numberOfShares: shareholderAllocations.numberOfShares,
        shareClassCode: shareClasses.code,
        shareClassId: shareholderAllocations.shareClassId,
        shareClassName: shareClasses.name,
        status: shareholderAllocations.status,
        totalConsideration: shareholderAllocations.totalConsideration,
      })
      .from(shareholderAllocations)
      .innerJoin(
        shareClasses,
        eq(shareholderAllocations.shareClassId, shareClasses.id)
      )
      .where(eq(shareholderAllocations.status, "active"))
      .orderBy(shareholderAllocations.investorId);

    const investorIds = [...new Set(allocations.map((a) => a.investorId))];
    const investorDetails = await db
      .select({
        email: investors.email,
        id: investors.id,
        name: investors.name,
      })
      .from(investors)
      .where(
        investorIds.length > 0
          ? sql`${investors.id} = ANY(${investorIds})`
          : sql`1=0`
      );

    const investorMap = new Map(investorDetails.map((i) => [i.id, i]));

    const grouped = new Map<
      string,
      {
        email: string;
        investorId: string;
        investorName: string;
        holdings: typeof allocations;
        totalConsideration: number;
        totalShares: number;
      }
    >();

    for (const a of allocations) {
      const inv = investorMap.get(a.investorId);
      const existing = grouped.get(a.investorId);
      if (existing) {
        existing.holdings.push(a);
        existing.totalShares += a.numberOfShares;
        existing.totalConsideration += Number(a.totalConsideration ?? 0);
      } else {
        grouped.set(a.investorId, {
          email: inv?.email ?? "",
          holdings: [a],
          investorId: a.investorId,
          investorName: inv?.name ?? "Unknown",
          totalConsideration: Number(a.totalConsideration ?? 0),
          totalShares: a.numberOfShares,
        });
      }
    }

    return { register: [...grouped.values()] };
  }),

  list: protectedProcedure
    .input(
      z.object({
        shareClassId: z.string().uuid().optional(),
        status: z
          .enum(["active", "transferred", "cancelled", "suspended"])
          .optional(),
      })
    )
    .handler(async ({ input }) => {
      const conditions = [];
      if (input.shareClassId) {
        conditions.push(
          eq(shareholderAllocations.shareClassId, input.shareClassId)
        );
      }
      if (input.status) {
        conditions.push(eq(shareholderAllocations.status, input.status));
      }

      const items = await db
        .select({
          allocationId: shareholderAllocations.id,
          allotmentDate: shareholderAllocations.allotmentDate,
          certificateNumber: shareholderAllocations.certificateNumber,
          investorEmail: investors.email,
          investorId: shareholderAllocations.investorId,
          investorName: investors.name,
          issuePricePerShare: shareholderAllocations.issuePricePerShare,
          numberOfShares: shareholderAllocations.numberOfShares,
          shareClassCode: shareClasses.code,
          shareClassId: shareholderAllocations.shareClassId,
          shareClassName: shareClasses.name,
          status: shareholderAllocations.status,
          totalConsideration: shareholderAllocations.totalConsideration,
        })
        .from(shareholderAllocations)
        .innerJoin(
          investors,
          eq(shareholderAllocations.investorId, investors.id)
        )
        .innerJoin(
          shareClasses,
          eq(shareholderAllocations.shareClassId, shareClasses.id)
        )
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(shareholderAllocations.allotmentDate));

      return { items };
    }),

  transfer: protectedProcedure
    .input(
      z.object({
        allocationId: z.string().uuid(),
        newCertificateNumber: z.string().optional(),
        notes: z.string().optional(),
        pricePerShare: z.string().optional(),
        toInvestorId: z.string().uuid(),
        transferDate: z.string(),
      })
    )
    .handler(
      async ({ input }) =>
        await db.transaction(async (tx) => {
          const [allocation] = await tx
            .select()
            .from(shareholderAllocations)
            .where(eq(shareholderAllocations.id, input.allocationId))
            .limit(1);

          if (!allocation) {
            throw new ORPCError("NOT_FOUND", {
              message: "Allocation not found",
            });
          }
          if (allocation.status !== "active") {
            throw new ORPCError("BAD_REQUEST", {
              message: "Only active allocations can be transferred",
            });
          }

          const [toInvestor] = await tx
            .select({ id: investors.id, kycStatus: investors.kycStatus })
            .from(investors)
            .where(eq(investors.id, input.toInvestorId))
            .limit(1);

          if (!toInvestor) {
            throw new ORPCError("NOT_FOUND", {
              message: "Target investor not found",
            });
          }

          await tx
            .update(shareholderAllocations)
            .set({ status: "transferred", updatedAt: new Date() })
            .where(eq(shareholderAllocations.id, input.allocationId));

          const [newAllocation] = await tx
            .insert(shareholderAllocations)
            .values({
              allotmentDate: new Date(input.transferDate),
              certificateNumber: input.newCertificateNumber,
              investorId: input.toInvestorId,
              issuePricePerShare:
                input.pricePerShare ?? allocation.issuePricePerShare,
              notes: input.notes,
              numberOfShares: allocation.numberOfShares,
              shareClassId: allocation.shareClassId,
              status: "active",
              totalConsideration: (
                allocation.numberOfShares *
                Number(input.pricePerShare ?? allocation.issuePricePerShare)
              ).toFixed(2),
            })
            .returning();

          await tx.insert(shareTransfers).values({
            fromShareholderId: allocation.investorId,
            newCertificateNumber: input.newCertificateNumber,
            notes: input.notes,
            oldCertificateNumber: allocation.certificateNumber,
            pricePerShare: input.pricePerShare,
            shareClassId: allocation.shareClassId,
            sharesTransferred: allocation.numberOfShares,
            toShareholderId: input.toInvestorId,
            transferDate: new Date(input.transferDate),
          });

          return newAllocation;
        })
    ),
};

const capitalCallsRouter = {
  cancel: protectedProcedure.input(z.object({ id: z.string().uuid() })).handler(
    async ({ input }) =>
      await db.transaction(async (tx) => {
        const [call] = await tx
          .select()
          .from(capitalCalls)
          .where(eq(capitalCalls.id, input.id))
          .limit(1);

        if (!call) {
          throw new ORPCError("NOT_FOUND", {
            message: "Capital call not found",
          });
        }
        if (call.status !== "draft" && call.status !== "issued") {
          throw new ORPCError("BAD_REQUEST", {
            message: "Only draft or issued capital calls can be cancelled",
          });
        }

        await tx
          .update(shareholderPayments)
          .set({ status: "waived", updatedAt: new Date() })
          .where(eq(shareholderPayments.capitalCallId, input.id));

        const [updated] = await tx
          .update(capitalCalls)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(capitalCalls.id, input.id))
          .returning();

        return updated;
      })
  ),

  create: protectedProcedure
    .input(
      z.object({
        amountPerShare: z.string(),
        callDate: z.string(),
        description: z.string().min(1),
        dueDate: z.string(),
        notes: z.string().optional(),
        shareClassId: z.string().uuid(),
      })
    )
    .handler(async ({ input }) => {
      const [call] = await db
        .insert(capitalCalls)
        .values({
          amountPerShare: input.amountPerShare,
          callDate: new Date(input.callDate),
          description: input.description,
          dueDate: new Date(input.dueDate),
          notes: input.notes,
          shareClassId: input.shareClassId,
        })
        .returning();

      return call;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ input }) => {
      const [call] = await db
        .select()
        .from(capitalCalls)
        .where(eq(capitalCalls.id, input.id))
        .limit(1);

      if (!call) {
        throw new ORPCError("NOT_FOUND", {
          message: "Capital call not found",
        });
      }

      const payments = await db
        .select({
          amount: shareholderPayments.amount,
          dueDate: shareholderPayments.dueDate,
          investorEmail: investors.email,
          investorId: shareholderPayments.investorId,
          investorName: investors.name,
          paidDate: shareholderPayments.paidDate,
          paymentId: shareholderPayments.id,
          reference: shareholderPayments.reference,
          status: shareholderPayments.status,
        })
        .from(shareholderPayments)
        .innerJoin(investors, eq(shareholderPayments.investorId, investors.id))
        .where(eq(shareholderPayments.capitalCallId, input.id));

      return { ...call, payments };
    }),

  issue: protectedProcedure.input(z.object({ id: z.string().uuid() })).handler(
    async ({ input }) =>
      await db.transaction(async (tx) => {
        const [call] = await tx
          .select()
          .from(capitalCalls)
          .where(eq(capitalCalls.id, input.id))
          .limit(1);

        if (!call) {
          throw new ORPCError("NOT_FOUND", {
            message: "Capital call not found",
          });
        }
        if (call.status !== "draft") {
          throw new ORPCError("BAD_REQUEST", {
            message: "Only draft capital calls can be issued",
          });
        }

        const activeAllocations = await tx
          .select()
          .from(shareholderAllocations)
          .where(
            and(
              eq(shareholderAllocations.shareClassId, call.shareClassId),
              eq(shareholderAllocations.status, "active")
            )
          );

        if (activeAllocations.length === 0) {
          throw new ORPCError("BAD_REQUEST", {
            message: "No active shareholders for this share class",
          });
        }

        let total = 0;
        for (const alloc of activeAllocations) {
          const amount = (
            alloc.numberOfShares * Number(call.amountPerShare)
          ).toFixed(2);
          total += Number(amount);

          await tx.insert(shareholderPayments).values({
            amount,
            capitalCallId: call.id,
            dueDate: call.dueDate,
            investorId: alloc.investorId,
            type: "capital_call",
          });
        }

        const [updated] = await tx
          .update(capitalCalls)
          .set({
            status: "issued",
            totalAmountCalled: total.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(capitalCalls.id, input.id))
          .returning();

        return updated;
      })
  ),

  list: protectedProcedure
    .input(
      z.object({
        shareClassId: z.string().uuid().optional(),
        status: z
          .enum([
            "draft",
            "issued",
            "partially_paid",
            "fully_paid",
            "cancelled",
          ])
          .optional(),
      })
    )
    .handler(async ({ input }) => {
      const conditions = [];
      if (input.shareClassId) {
        conditions.push(eq(capitalCalls.shareClassId, input.shareClassId));
      }
      if (input.status) {
        conditions.push(eq(capitalCalls.status, input.status));
      }

      const items = await db
        .select({
          amountPerShare: capitalCalls.amountPerShare,
          callDate: capitalCalls.callDate,
          capitalCallId: capitalCalls.id,
          description: capitalCalls.description,
          dueDate: capitalCalls.dueDate,
          shareClassCode: shareClasses.code,
          shareClassId: capitalCalls.shareClassId,
          shareClassName: shareClasses.name,
          status: capitalCalls.status,
          totalAmountCalled: capitalCalls.totalAmountCalled,
        })
        .from(capitalCalls)
        .innerJoin(shareClasses, eq(capitalCalls.shareClassId, shareClasses.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(capitalCalls.callDate));

      return { items };
    }),
};

const paymentsRouter = {
  create: protectedProcedure
    .input(
      z.object({
        amount: z.string(),
        capitalCallId: z.string().uuid().optional(),
        dueDate: z.string().optional(),
        investorId: z.string().uuid(),
        notes: z.string().optional(),
        reference: z.string().optional(),
        type: z.enum([
          "dividend",
          "capital_contribution",
          "capital_call",
          "loan_repayment",
          "interest",
        ]),
      })
    )
    .handler(async ({ input }) => {
      const [payment] = await db
        .insert(shareholderPayments)
        .values({
          amount: input.amount,
          capitalCallId: input.capitalCallId,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          investorId: input.investorId,
          notes: input.notes,
          reference: input.reference,
          type: input.type,
        })
        .returning();

      return payment;
    }),

  getSchedule: protectedProcedure.handler(async () => {
    const pending = await db
      .select({
        amount: shareholderPayments.amount,
        dueDate: shareholderPayments.dueDate,
        investorEmail: investors.email,
        investorId: shareholderPayments.investorId,
        investorName: investors.name,
        paymentId: shareholderPayments.id,
        status: shareholderPayments.status,
        type: shareholderPayments.type,
      })
      .from(shareholderPayments)
      .innerJoin(investors, eq(shareholderPayments.investorId, investors.id))
      .where(
        or(
          eq(shareholderPayments.status, "pending"),
          eq(shareholderPayments.status, "overdue")
        )
      )
      .orderBy(shareholderPayments.dueDate);

    return { schedule: pending };
  }),

  list: protectedProcedure
    .input(
      z.object({
        investorId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
        status: z
          .enum(["pending", "partial", "paid", "overdue", "waived"])
          .optional(),
        type: z
          .enum([
            "dividend",
            "capital_contribution",
            "capital_call",
            "loan_repayment",
            "interest",
          ])
          .optional(),
      })
    )
    .handler(async ({ input }) => {
      const conditions = [];
      if (input.investorId) {
        conditions.push(eq(shareholderPayments.investorId, input.investorId));
      }
      if (input.status) {
        conditions.push(eq(shareholderPayments.status, input.status));
      }
      if (input.type) {
        conditions.push(eq(shareholderPayments.type, input.type));
      }

      const items = await db
        .select({
          amount: shareholderPayments.amount,
          dueDate: shareholderPayments.dueDate,
          investorEmail: investors.email,
          investorId: shareholderPayments.investorId,
          investorName: investors.name,
          notes: shareholderPayments.notes,
          paidDate: shareholderPayments.paidDate,
          paymentId: shareholderPayments.id,
          reference: shareholderPayments.reference,
          status: shareholderPayments.status,
          type: shareholderPayments.type,
        })
        .from(shareholderPayments)
        .innerJoin(investors, eq(shareholderPayments.investorId, investors.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(shareholderPayments.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(shareholderPayments)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return { items, total: Number(countRow?.count ?? 0) };
    }),

  markPaid: protectedProcedure
    .input(
      z.object({
        cashAccountId: z.string().uuid().optional(),
        contraAccountId: z.string().uuid().optional(),
        id: z.string().uuid(),
        reference: z.string().optional(),
      })
    )
    .handler(
      async ({ input, context }) =>
        await db.transaction(async (tx) => {
          const [payment] = await tx
            .select()
            .from(shareholderPayments)
            .where(eq(shareholderPayments.id, input.id))
            .limit(1);

          if (!payment) {
            throw new ORPCError("NOT_FOUND", {
              message: "Payment not found",
            });
          }
          if (payment.status === "paid") {
            throw new ORPCError("BAD_REQUEST", {
              message: "Payment already marked as paid",
            });
          }

          let journalEntryId: string | undefined;

          if (input.cashAccountId && input.contraAccountId) {
            const userId = context.session?.user?.id ?? "system";
            const entryNumber = makeEntryNumber("PAY");

            const typeDescriptions: Record<string, string> = {
              capital_call: "Capital call payment",
              capital_contribution: "Capital contribution",
              dividend: "Dividend payment",
              interest: "Interest payment",
              loan_repayment: "Loan repayment",
            };

            const [entry] = await tx
              .insert(journalEntries)
              .values({
                createdBy: userId,
                date: new Date(),
                description:
                  typeDescriptions[payment.type] ?? "Shareholder payment",
                entryNumber,
                sourceType: "manual",
                status: "posted",
                totalCredit: payment.amount,
                totalDebit: payment.amount,
              })
              .returning();

            if (entry) {
              // For outgoing payments (dividend): debit contra, credit cash
              // For incoming payments (capital_call, capital_contribution): debit cash, credit contra
              const incoming =
                payment.type === "capital_call" ||
                payment.type === "capital_contribution";

              const lines = [
                {
                  accountId: incoming
                    ? input.cashAccountId
                    : input.contraAccountId,
                  amount: payment.amount,
                  description: incoming ? "Cash received" : "Payment made",
                  entryId: entry.id,
                  type: "debit" as const,
                },
                {
                  accountId: incoming
                    ? input.contraAccountId
                    : input.cashAccountId,
                  amount: payment.amount,
                  description: incoming
                    ? "Liability/equity credited"
                    : "Cash paid out",
                  entryId: entry.id,
                  type: "credit" as const,
                },
              ];
              await tx.insert(journalEntryLines).values(lines);
              await updateAccountBalances(tx, lines);

              journalEntryId = entry.id;
            }
          }

          const [updated] = await tx
            .update(shareholderPayments)
            .set({
              journalEntryId,
              paidDate: new Date(),
              reference: input.reference ?? payment.reference,
              status: "paid",
              updatedAt: new Date(),
            })
            .where(eq(shareholderPayments.id, input.id))
            .returning();

          // Update capital call status if applicable
          if (payment.capitalCallId) {
            const callPayments = await tx
              .select({ status: shareholderPayments.status })
              .from(shareholderPayments)
              .where(
                eq(shareholderPayments.capitalCallId, payment.capitalCallId)
              );

            const allPaid = callPayments.every((p) => p.status === "paid");
            const anyPaid = callPayments.some((p) => p.status === "paid");

            await tx
              .update(capitalCalls)
              .set({
                status: allPaid
                  ? "fully_paid"
                  : anyPaid
                    ? "partially_paid"
                    : "issued",
                updatedAt: new Date(),
              })
              .where(eq(capitalCalls.id, payment.capitalCallId));
          }

          return updated;
        })
    ),
};

export const investmentRouter = {
  capitalCalls: capitalCallsRouter,
  cashFlows: cashFlowsRouter,
  distributions: distributionsRouter,
  investments: investmentsRouter,
  investors: investorsRouter,
  milestones: milestonesRouter,
  payments: paymentsRouter,
  projects: projectsRouter,
  reports: reportsRouter,
  shareClasses: shareClassesRouter,
  shareholders: shareholdersRouter,
};
