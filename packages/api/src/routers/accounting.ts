import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";

import { db } from "@notebook/db";
import {
  accountingPeriods,
  accounts,
  customers,
  dueCollections,
  expenses,
  fiscalYears,
  journalEntries,
  journalEntryLines,
  payments,
  sales,
} from "@notebook/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

type Tx = PgTransaction<any, any, ExtractTablesWithRelations<any>>;
type DbOrTx = NodePgDatabase<any> | Tx;

interface LineUpdate {
  accountId: string;
  amount: string;
  type: "credit" | "debit";
}

export async function updateAccountBalances(tx: DbOrTx, lines: LineUpdate[]) {
  for (const line of lines) {
    const [acct] = await tx
      .select({ id: accounts.id, normalBalance: accounts.normalBalance })
      .from(accounts)
      .where(eq(accounts.id, line.accountId))
      .for("update")
      .limit(1);
    if (!acct) {
      continue;
    }

    const amt = Number(line.amount);
    let delta: number;
    if (acct.normalBalance === "debit") {
      delta = line.type === "debit" ? amt : -amt;
    } else {
      delta = line.type === "credit" ? amt : -amt;
    }

    await tx
      .update(accounts)
      .set({
        currentBalance: sql`${accounts.currentBalance} + ${delta}`,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, line.accountId));
  }
}

/**
 * Generates a unique journal entry number using a timestamp + random suffix.
 * This avoids the COUNT(*)+1 race condition that can produce duplicate numbers
 * when two transactions run concurrently.
 *
 * Format: PREFIX-<base36-timestamp>-<4-hex-random>  e.g. JE-LVZ4J8T9-A3F7
 */
export function makeEntryNumber(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.floor(Math.random() * 0xFF_FF)
    .toString(16)
    .toUpperCase()
    .padStart(4, "0");
  return `${prefix}-${ts}-${rnd}`;
}

export async function postSaleJournalEntry(
  tx: DbOrTx,
  sale: {
    discountAmount: string;
    id: string;
    saleDate: Date;
    subtotal: string;
    taxAmount: string;
  },
  paymentLines: { amount: string; method: string }[],
  userId: string
) {
  // Always need revenue (4000) and tax (2100); debit accounts depend on
  // which payment methods were actually used in this sale.
  const requiredCodes = new Set(["4000", "2100"]);
  for (const p of paymentLines) {
    if (p.method === "on_account") {
      requiredCodes.add("1100");
    } else if (p.method === "store_credit") {
      requiredCodes.add("2200");
    } else if (p.method === "gift_card") {
      requiredCodes.add("2300");
    } else {
      requiredCodes.add("1000");
    }
  }

  const acctRows = await tx
    .select({ code: accounts.code, id: accounts.id })
    .from(accounts)
    .where(inArray(accounts.code, [...requiredCodes]));

  if (acctRows.length < requiredCodes.size) {
    return; // required accounts not seeded — skip silently
  }

  const byCode: Record<string, string> = {};
  for (const r of acctRows) {
    byCode[r.code] = r.id;
  }

  const [period] = await tx
    .select({ id: accountingPeriods.id })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.status, "open"),
        lte(accountingPeriods.startDate, sale.saleDate),
        gte(accountingPeriods.endDate, sale.saleDate)
      )
    )
    .limit(1);

  const entryNumber = makeEntryNumber("JE");

  const drMap: Record<string, number> = {};
  for (const p of paymentLines) {
    let acctId: string;
    if (p.method === "on_account") {
      acctId = byCode["1100"]!;
    } else if (p.method === "store_credit") {
      acctId = byCode["2200"]!;
    } else if (p.method === "gift_card") {
      acctId = byCode["2300"]!;
    } else {
      acctId = byCode["1000"]!;
    }
    drMap[acctId] = (drMap[acctId] ?? 0) + Number(p.amount);
  }

  const revenue = Number(sale.subtotal) - Number(sale.discountAmount);
  const tax = Number(sale.taxAmount);
  const totalDR = Object.values(drMap).reduce((s, v) => s + v, 0);

  const [entry] = await tx
    .insert(journalEntries)
    .values({
      createdBy: userId,
      date: sale.saleDate,
      description: `POS Sale`,
      entryNumber,
      periodId: period?.id ?? null,
      postedAt: new Date(),
      sourceId: sale.id,
      sourceType: "sale",
      status: "posted",
      totalCredit: (revenue + tax).toString(),
      totalDebit: totalDR.toString(),
    })
    .returning({ id: journalEntries.id });

  const linesToInsert: {
    accountId: string;
    amount: string;
    description: string | null;
    entryId: string;
    type: "credit" | "debit";
  }[] = [];

  for (const [accountId, amount] of Object.entries(drMap)) {
    linesToInsert.push({
      accountId,
      amount: amount.toString(),
      description: null,
      entryId: entry!.id,
      type: "debit",
    });
  }

  if (revenue > 0) {
    linesToInsert.push({
      accountId: byCode["4000"]!,
      amount: revenue.toString(),
      description: null,
      entryId: entry!.id,
      type: "credit",
    });
  }

  if (tax > 0) {
    linesToInsert.push({
      accountId: byCode["2100"]!,
      amount: tax.toString(),
      description: null,
      entryId: entry!.id,
      type: "credit",
    });
  }

  await tx.insert(journalEntryLines).values(linesToInsert);

  await updateAccountBalances(
    tx,
    linesToInsert.map((l) => ({
      accountId: l.accountId,
      amount: l.amount,
      type: l.type,
    }))
  );
}

/**
 * Posts the accounting entry when goods are received from a purchase order.
 *
 * Base entry:
 *   DR  Inventory (1200)            — goods received into stock
 *   CR  Accounts Payable (2000)     — liability to the supplier
 *
 * If purchaseTax > 0:
 *   DR  Inventory (1200)            — tax capitalised into inventory cost
 *   CR  Accounts Payable (2000)
 *
 * If shippingCost > 0:
 *   DR  Freight-In (6500)           — freight expensed separately
 *   CR  Accounts Payable (2000)
 */
export async function postPurchaseReceiptJournalEntry(
  tx: DbOrTx,
  po: {
    date: Date;
    id: string;
    purchaseTax?: string;
    shippingCost?: string;
    totalCost: string;
  },
  userId: string
) {
  const goodsCost = Number(po.totalCost);
  const tax = Number(po.purchaseTax ?? 0);
  const shipping = Number(po.shippingCost ?? 0);
  const totalAP = goodsCost + tax + shipping;

  if (totalAP <= 0) {
    return;
  }

  const codesToFetch = ["1200", "2000"];
  if (shipping > 0) {
    codesToFetch.push("6500");
  }

  const acctRows = await tx
    .select({ code: accounts.code, id: accounts.id })
    .from(accounts)
    .where(inArray(accounts.code, codesToFetch));

  const byCode: Record<string, string> = {};
  for (const r of acctRows) {
    byCode[r.code] = r.id;
  }

  if (!byCode["1200"] || !byCode["2000"]) {
    return;
  } // core accounts not seeded

  const [period] = await tx
    .select({ id: accountingPeriods.id })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.status, "open"),
        lte(accountingPeriods.startDate, po.date),
        gte(accountingPeriods.endDate, po.date)
      )
    )
    .limit(1);

  const entryNumber = makeEntryNumber("JE");
  const inventoryDebit = goodsCost + tax; // tax capitalised into inventory

  const [entry] = await tx
    .insert(journalEntries)
    .values({
      createdBy: userId,
      date: po.date,
      description: "Purchase Order Receipt",
      entryNumber,
      periodId: period?.id ?? null,
      postedAt: new Date(),
      sourceId: po.id,
      sourceType: "purchase_order",
      status: "posted",
      totalCredit: totalAP.toString(),
      totalDebit: totalAP.toString(),
    })
    .returning({ id: journalEntries.id });

  const lines: {
    accountId: string;
    amount: string;
    description: null;
    entryId: string;
    type: "credit" | "debit";
  }[] = [
    {
      accountId: byCode["1200"]!,
      amount: inventoryDebit.toString(),
      description: null,
      entryId: entry!.id,
      type: "debit",
    },
  ];

  if (shipping > 0 && byCode["6500"]) {
    lines.push({
      accountId: byCode["6500"]!,
      amount: shipping.toString(),
      description: null,
      entryId: entry!.id,
      type: "debit",
    });
  }

  lines.push({
    accountId: byCode["2000"]!,
    amount: totalAP.toString(),
    description: null,
    entryId: entry!.id,
    type: "credit",
  });

  await tx.insert(journalEntryLines).values(lines);
  await updateAccountBalances(
    tx,
    lines.map((l) => ({
      accountId: l.accountId,
      amount: l.amount,
      type: l.type,
    }))
  );
}

/**
 * Posts the accounting entry when a PO payment is made.
 *
 * Entry:
 *   DR  Accounts Payable (2000) — liability reduced
 *   CR  Cash (1000)             — cash disbursed to supplier
 */
export async function postPurchasePaymentJournalEntry(
  tx: DbOrTx,
  payment: { amount: string; date: Date; poId: string },
  userId: string
): Promise<void> {
  const amount = Number(payment.amount);
  if (amount <= 0) {
    return;
  }

  const acctRows = await tx
    .select({ code: accounts.code, id: accounts.id })
    .from(accounts)
    .where(inArray(accounts.code, ["1000", "2000"]));

  if (acctRows.length < 2) {
    return; // accounts not seeded — skip silently
  }

  const byCode: Record<string, string> = {};
  for (const r of acctRows) {
    byCode[r.code] = r.id;
  }

  const [period] = await tx
    .select({ id: accountingPeriods.id })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.status, "open"),
        lte(accountingPeriods.startDate, payment.date),
        gte(accountingPeriods.endDate, payment.date)
      )
    )
    .limit(1);

  const entryNumber = makeEntryNumber("JE");

  const [entry] = await tx
    .insert(journalEntries)
    .values({
      createdBy: userId,
      date: payment.date,
      description: "Purchase Order Payment",
      entryNumber,
      periodId: period?.id ?? null,
      postedAt: new Date(),
      sourceId: payment.poId,
      sourceType: "purchase_order",
      status: "posted",
      totalCredit: amount.toString(),
      totalDebit: amount.toString(),
    })
    .returning({ id: journalEntries.id });

  const lines: {
    accountId: string;
    amount: string;
    description: null;
    entryId: string;
    type: "credit" | "debit";
  }[] = [
    {
      accountId: byCode["2000"]!,
      amount: amount.toString(),
      description: null,
      entryId: entry!.id,
      type: "debit",
    },
    {
      accountId: byCode["1000"]!,
      amount: amount.toString(),
      description: null,
      entryId: entry!.id,
      type: "credit",
    },
  ];

  await tx.insert(journalEntryLines).values(lines);
  await updateAccountBalances(
    tx,
    lines.map((l) => ({
      accountId: l.accountId,
      amount: l.amount,
      type: l.type,
    }))
  );
}

/**
 * Posts the accounting entry for a manual stock adjustment.
 *
 * Shrinkage / damage (qty < 0):
 *   DR  Inventory Variance (6400)  — loss expensed
 *   CR  Inventory (1200)           — asset reduced
 *
 * Positive adjustment (qty > 0):
 *   DR  Inventory (1200)           — asset increased
 *   CR  Inventory Variance (6400)  — variance offset
 */
export async function postInventoryVarianceJournalEntry(
  tx: DbOrTx,
  adjustment: {
    date: Date;
    quantity: number;
    referenceId: string;
    unitCost: number;
  },
  userId: string
): Promise<void> {
  const amount = Math.abs(adjustment.quantity) * adjustment.unitCost;
  if (amount <= 0) {
    return;
  }

  const acctRows = await tx
    .select({ code: accounts.code, id: accounts.id })
    .from(accounts)
    .where(inArray(accounts.code, ["1200", "6400"]));

  if (acctRows.length < 2) {
    return;
  }

  const byCode: Record<string, string> = {};
  for (const r of acctRows) {
    byCode[r.code] = r.id;
  }

  const [period] = await tx
    .select({ id: accountingPeriods.id })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.status, "open"),
        lte(accountingPeriods.startDate, adjustment.date),
        gte(accountingPeriods.endDate, adjustment.date)
      )
    )
    .limit(1);

  const entryNumber = makeEntryNumber("JE");
  const isNegative = adjustment.quantity < 0;

  const [entry] = await tx
    .insert(journalEntries)
    .values({
      createdBy: userId,
      date: adjustment.date,
      description: isNegative
        ? "Inventory Shrinkage / Write-down"
        : "Inventory Adjustment Gain",
      entryNumber,
      periodId: period?.id ?? null,
      postedAt: new Date(),
      sourceId: adjustment.referenceId,
      sourceType: "manual",
      status: "posted",
      totalCredit: amount.toString(),
      totalDebit: amount.toString(),
    })
    .returning({ id: journalEntries.id });

  const lines: {
    accountId: string;
    amount: string;
    description: null;
    entryId: string;
    type: "credit" | "debit";
  }[] = isNegative
    ? [
        {
          accountId: byCode["6400"]!,
          amount: amount.toString(),
          description: null,
          entryId: entry!.id,
          type: "debit",
        },
        {
          accountId: byCode["1200"]!,
          amount: amount.toString(),
          description: null,
          entryId: entry!.id,
          type: "credit",
        },
      ]
    : [
        {
          accountId: byCode["1200"]!,
          amount: amount.toString(),
          description: null,
          entryId: entry!.id,
          type: "debit",
        },
        {
          accountId: byCode["6400"]!,
          amount: amount.toString(),
          description: null,
          entryId: entry!.id,
          type: "credit",
        },
      ];

  await tx.insert(journalEntryLines).values(lines);
  await updateAccountBalances(
    tx,
    lines.map((l) => ({
      accountId: l.accountId,
      amount: l.amount,
      type: l.type,
    }))
  );
}

/**
 * Posts the COGS accounting entry when products are sold.
 *
 * Entry:
 *   DR  Cost of Goods Sold (5000) — cost of items sold
 *   CR  Inventory (1200)          — inventory asset reduced
 */
export async function postCOGSJournalEntry(
  tx: DbOrTx,
  sale: { amount: string; date: Date; saleId: string },
  userId: string
): Promise<void> {
  const amount = Number(sale.amount);
  if (amount <= 0) {
    return;
  }

  const acctRows = await tx
    .select({ code: accounts.code, id: accounts.id })
    .from(accounts)
    .where(inArray(accounts.code, ["5000", "1200"]));

  if (acctRows.length < 2) {
    return; // accounts not seeded — skip silently
  }

  const byCode: Record<string, string> = {};
  for (const r of acctRows) {
    byCode[r.code] = r.id;
  }

  const [period] = await tx
    .select({ id: accountingPeriods.id })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.status, "open"),
        lte(accountingPeriods.startDate, sale.date),
        gte(accountingPeriods.endDate, sale.date)
      )
    )
    .limit(1);

  const entryNumber = makeEntryNumber("JE");

  const [entry] = await tx
    .insert(journalEntries)
    .values({
      createdBy: userId,
      date: sale.date,
      description: "Cost of Goods Sold",
      entryNumber,
      periodId: period?.id ?? null,
      postedAt: new Date(),
      sourceId: sale.saleId,
      sourceType: "sale",
      status: "posted",
      totalCredit: amount.toString(),
      totalDebit: amount.toString(),
    })
    .returning({ id: journalEntries.id });

  const lines: {
    accountId: string;
    amount: string;
    description: null;
    entryId: string;
    type: "credit" | "debit";
  }[] = [
    {
      accountId: byCode["5000"]!,
      amount: amount.toString(),
      description: null,
      entryId: entry!.id,
      type: "debit",
    },
    {
      accountId: byCode["1200"]!,
      amount: amount.toString(),
      description: null,
      entryId: entry!.id,
      type: "credit",
    },
  ];

  await tx.insert(journalEntryLines).values(lines);
  await updateAccountBalances(
    tx,
    lines.map((l) => ({
      accountId: l.accountId,
      amount: l.amount,
      type: l.type,
    }))
  );
}

/**
 * Posts the COGS reversal entry when restockable items are returned.
 *
 * Entry:
 *   DR  Inventory (1200)        — inventory asset restored
 *   CR  Cost of Goods Sold (5000) — COGS reversed
 */
export async function postCOGSReversalJournalEntry(
  tx: DbOrTx,
  ret: { amount: string; date: Date; returnId: string },
  userId: string
): Promise<void> {
  const amount = Number(ret.amount);
  if (amount <= 0) {
    return;
  }

  const acctRows = await tx
    .select({ code: accounts.code, id: accounts.id })
    .from(accounts)
    .where(inArray(accounts.code, ["5000", "1200"]));

  if (acctRows.length < 2) {
    return;
  }

  const byCode: Record<string, string> = {};
  for (const r of acctRows) {
    byCode[r.code] = r.id;
  }

  const [period] = await tx
    .select({ id: accountingPeriods.id })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.status, "open"),
        lte(accountingPeriods.startDate, ret.date),
        gte(accountingPeriods.endDate, ret.date)
      )
    )
    .limit(1);

  const entryNumber = makeEntryNumber("JE");

  const [entry] = await tx
    .insert(journalEntries)
    .values({
      createdBy: userId,
      date: ret.date,
      description: "COGS Reversal — Restocked Return",
      entryNumber,
      periodId: period?.id ?? null,
      postedAt: new Date(),
      sourceId: ret.returnId,
      sourceType: "return",
      status: "posted",
      totalCredit: amount.toString(),
      totalDebit: amount.toString(),
    })
    .returning({ id: journalEntries.id });

  const lines: {
    accountId: string;
    amount: string;
    description: null;
    entryId: string;
    type: "credit" | "debit";
  }[] = [
    {
      accountId: byCode["1200"]!,
      amount: amount.toString(),
      description: null,
      entryId: entry!.id,
      type: "debit",
    },
    {
      accountId: byCode["5000"]!,
      amount: amount.toString(),
      description: null,
      entryId: entry!.id,
      type: "credit",
    },
  ];

  await tx.insert(journalEntryLines).values(lines);
  await updateAccountBalances(
    tx,
    lines.map((l) => ({
      accountId: l.accountId,
      amount: l.amount,
      type: l.type,
    }))
  );
}

/**
 * Posts the reversal accounting entry for a POS return.
 *
 * Entry (mirrors the original sale in reverse):
 *   DR  Revenue (4000)          — revenue reversed proportionally
 *   DR  Sales Tax Payable (2100) — tax reversed proportionally
 *   CR  Cash (1000)             — cash refunded to customer
 */
export async function postReturnJournalEntry(
  tx: DbOrTx,
  ret: {
    date: Date;
    id: string;
    originalSaleTax: string;
    originalSaleTotal: string;
    totalRefundAmount: string;
  },
  userId: string
) {
  const refund = Number(ret.totalRefundAmount);
  if (refund <= 0) {
    return;
  }

  const acctRows = await tx
    .select({ code: accounts.code, id: accounts.id })
    .from(accounts)
    .where(inArray(accounts.code, ["1000", "4000", "2100"]));

  if (acctRows.length < 3) {
    return; // required accounts not seeded — skip silently
  }

  const byCode: Record<string, string> = {};
  for (const r of acctRows) {
    byCode[r.code] = r.id;
  }

  const [period] = await tx
    .select({ id: accountingPeriods.id })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.status, "open"),
        lte(accountingPeriods.startDate, ret.date),
        gte(accountingPeriods.endDate, ret.date)
      )
    )
    .limit(1);

  const entryNumber = makeEntryNumber("RET");

  const saleTotal = Number(ret.originalSaleTotal);
  const taxFraction =
    saleTotal > 0 ? Number(ret.originalSaleTax) / saleTotal : 0;
  const taxPortion = +(refund * taxFraction).toFixed(2);
  const revenuePortion = +(refund - taxPortion).toFixed(2);

  const [entry] = await tx
    .insert(journalEntries)
    .values({
      createdBy: userId,
      date: ret.date,
      description: "POS Return",
      entryNumber,
      periodId: period?.id ?? null,
      postedAt: new Date(),
      sourceId: ret.id,
      sourceType: "return",
      status: "posted",
      totalCredit: refund.toString(),
      totalDebit: refund.toString(),
    })
    .returning({ id: journalEntries.id });

  const linesToInsert: {
    accountId: string;
    amount: string;
    description: string | null;
    entryId: string;
    type: "credit" | "debit";
  }[] = [];

  if (revenuePortion > 0) {
    linesToInsert.push({
      accountId: byCode["4000"]!,
      amount: revenuePortion.toString(),
      description: null,
      entryId: entry!.id,
      type: "debit",
    });
  }

  if (taxPortion > 0) {
    linesToInsert.push({
      accountId: byCode["2100"]!,
      amount: taxPortion.toString(),
      description: null,
      entryId: entry!.id,
      type: "debit",
    });
  }

  linesToInsert.push({
    accountId: byCode["1000"]!,
    amount: refund.toString(),
    description: null,
    entryId: entry!.id,
    type: "credit",
  });

  await tx.insert(journalEntryLines).values(linesToInsert);
  await updateAccountBalances(
    tx,
    linesToInsert.map((l) => ({
      accountId: l.accountId,
      amount: l.amount,
      type: l.type,
    }))
  );
}

/**
 * Posts the accounting entry when a customer pays off their outstanding
 * due balance alongside (or separately from) a sale.
 *
 * Entry:
 *   DR  Cash (1000) [or Store Credit Liability (2200) if method=store_credit]
 *   CR  Accounts Receivable (1100)
 */
export async function postDueCollectionJournalEntry(
  tx: DbOrTx,
  collection: { amount: string; method: string },
  date: Date,
  userId: string,
  sourceId?: string
): Promise<{ id: string } | null> {
  // Only fetch the two accounts actually needed for this method.
  const debitCode = collection.method === "store_credit" ? "2200" : "1000";
  const codesToFetch = [debitCode, "1100"];

  const acctRows = await tx
    .select({ code: accounts.code, id: accounts.id })
    .from(accounts)
    .where(inArray(accounts.code, codesToFetch));

  if (acctRows.length < 2) {
    return null; // required accounts not seeded — skip silently
  }

  const byCode: Record<string, string> = {};
  for (const r of acctRows) {
    byCode[r.code] = r.id;
  }

  const [period] = await tx
    .select({ id: accountingPeriods.id })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.status, "open"),
        lte(accountingPeriods.startDate, date),
        gte(accountingPeriods.endDate, date)
      )
    )
    .limit(1);

  const entryNumber = makeEntryNumber("JE");

  const amount = Number(collection.amount);
  // store_credit reduces that liability; everything else hits Cash
  const debitAccountId =
    collection.method === "store_credit" ? byCode["2200"]! : byCode["1000"]!;
  const creditAccountId = byCode["1100"]!;

  const [entry] = await tx
    .insert(journalEntries)
    .values({
      createdBy: userId,
      date,
      description: "Due Collection",
      entryNumber,
      periodId: period?.id ?? null,
      postedAt: new Date(),
      sourceId: sourceId ?? null,
      sourceType: sourceId ? "sale" : "manual",
      status: "posted",
      totalCredit: amount.toString(),
      totalDebit: amount.toString(),
    })
    .returning({ id: journalEntries.id });

  const lines = [
    {
      accountId: debitAccountId,
      amount: amount.toString(),
      description: "Due collection — payment received",
      entryId: entry!.id,
      type: "debit" as const,
    },
    {
      accountId: creditAccountId,
      amount: amount.toString(),
      description: "Due collection — outstanding balance cleared",
      entryId: entry!.id,
      type: "credit" as const,
    },
  ];

  await tx.insert(journalEntryLines).values(lines);

  await updateAccountBalances(
    tx,
    lines.map((l) => ({
      accountId: l.accountId,
      amount: l.amount,
      type: l.type,
    }))
  );

  return { id: entry!.id };
}

const DEFAULT_ACCOUNTS = [
  {
    code: "1000",
    name: "Cash",
    type: "asset" as const,
    normalBalance: "debit" as const,
  },
  {
    code: "1100",
    name: "Accounts Receivable",
    type: "asset" as const,
    normalBalance: "debit" as const,
  },
  {
    code: "1200",
    name: "Inventory",
    type: "asset" as const,
    normalBalance: "debit" as const,
  },
  {
    code: "2000",
    name: "Accounts Payable",
    type: "liability" as const,
    normalBalance: "credit" as const,
  },
  {
    code: "2100",
    name: "Sales Tax Payable",
    type: "liability" as const,
    normalBalance: "credit" as const,
  },
  {
    code: "2200",
    name: "Store Credit Liability",
    type: "liability" as const,
    normalBalance: "credit" as const,
  },
  {
    code: "2300",
    name: "Gift Card Liability",
    type: "liability" as const,
    normalBalance: "credit" as const,
  },
  {
    code: "2400",
    name: "Customer Advances",
    type: "liability" as const,
    normalBalance: "credit" as const,
  },
  {
    code: "3000",
    name: "Owner's Equity",
    type: "equity" as const,
    normalBalance: "credit" as const,
  },
  {
    code: "3100",
    name: "Retained Earnings",
    type: "equity" as const,
    normalBalance: "credit" as const,
  },
  {
    code: "4000",
    name: "Sales Revenue",
    type: "revenue" as const,
    normalBalance: "credit" as const,
  },
  {
    code: "4100",
    name: "Other Revenue",
    type: "revenue" as const,
    normalBalance: "credit" as const,
  },
  {
    code: "5000",
    name: "Cost of Goods Sold",
    type: "expense" as const,
    normalBalance: "debit" as const,
  },
  {
    code: "6000",
    name: "Operating Expenses",
    type: "expense" as const,
    normalBalance: "debit" as const,
  },
  {
    code: "6100",
    name: "Rent Expense",
    type: "expense" as const,
    normalBalance: "debit" as const,
  },
  {
    code: "6200",
    name: "Utilities Expense",
    type: "expense" as const,
    normalBalance: "debit" as const,
  },
  {
    code: "6300",
    name: "Salaries Expense",
    type: "expense" as const,
    normalBalance: "debit" as const,
  },
  {
    code: "6400",
    name: "Inventory Variance",
    type: "expense" as const,
    normalBalance: "debit" as const,
  },
  {
    code: "6500",
    name: "Freight-In",
    type: "expense" as const,
    normalBalance: "debit" as const,
  },
];

async function seedDefaultAccounts() {
  const inserted = await db
    .insert(accounts)
    .values(DEFAULT_ACCOUNTS.map((a) => ({ ...a, isSystem: true })))
    .onConflictDoNothing({ target: accounts.code })
    .returning({ id: accounts.id, code: accounts.code });

  const parent6000 = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.code, "6000"))
    .limit(1);

  if (parent6000[0]) {
    await db
      .update(accounts)
      .set({ parentId: parent6000[0].id, updatedAt: new Date() })
      .where(inArray(accounts.code, ["6100", "6200", "6300"]));
  }

  return inserted.length;
}

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const accountingRouter = {
  accounts: {
    create: protectedProcedure
      .input(
        z.object({
          code: z.string().min(1),
          description: z.string().optional(),
          name: z.string().min(1),
          normalBalance: z.enum(["debit", "credit"]),
          parentId: z.string().uuid().optional(),
          type: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
        })
      )
      .handler(async ({ input }) => {
        const existing = await db
          .select({ id: accounts.id })
          .from(accounts)
          .where(eq(accounts.code, input.code))
          .limit(1);

        if (existing.length > 0) {
          throw new ORPCError("CONFLICT", {
            message: `Account code ${input.code} already exists`,
          });
        }

        const [account] = await db.insert(accounts).values(input).returning();
        return account;
      }),

    get: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) => {
        const [account] = await db
          .select()
          .from(accounts)
          .where(eq(accounts.id, input.id))
          .limit(1);

        if (!account) {
          throw new ORPCError("NOT_FOUND", { message: "Account not found" });
        }

        return account;
      }),

    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(200).default(100),
          offset: z.number().int().min(0).default(0),
          query: z.string().optional(),
          type: z
            .enum(["asset", "liability", "equity", "revenue", "expense"])
            .optional(),
        })
      )
      .handler(async ({ input }) => {
        const conditions = [eq(accounts.isActive, true)];

        if (input.type) {
          conditions.push(eq(accounts.type, input.type));
        }

        if (input.query) {
          conditions.push(
            sql`${accounts.name} ILIKE ${`%${input.query}%`} OR ${accounts.code} ILIKE ${`%${input.query}%`}`
          );
        }

        const [items, totalCountResult] = await Promise.all([
          db
            .select()
            .from(accounts)
            .where(and(...conditions))
            .limit(input.limit)
            .offset(input.offset)
            .orderBy(accounts.code),
          db
            .select({ count: sql<number>`count(*)` })
            .from(accounts)
            .where(and(...conditions)),
        ]);

        return {
          items,
          pagination: {
            limit: input.limit,
            offset: input.offset,
            total: totalCountResult[0]?.count ?? 0,
          },
        };
      }),

    seed: protectedProcedure.input(z.object({})).handler(async () => {
      const seeded = await seedDefaultAccounts();
      return { seeded };
    }),

    update: protectedProcedure
      .input(
        z.object({
          description: z.string().optional(),
          id: z.string().uuid(),
          isActive: z.boolean().optional(),
          name: z.string().min(1).optional(),
          parentId: z.string().uuid().nullable().optional(),
        })
      )
      .handler(async ({ input }) => {
        const { id, ...updateData } = input;
        const [account] = await db
          .update(accounts)
          .set({ ...updateData, updatedAt: new Date() })
          .where(eq(accounts.id, id))
          .returning();

        if (!account) {
          throw new ORPCError("NOT_FOUND", { message: "Account not found" });
        }

        return account;
      }),
  },

  expenses: {
    approve: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) => {
        const [expense] = await db
          .update(expenses)
          .set({ status: "approved", updatedAt: new Date() })
          .where(and(eq(expenses.id, input.id), eq(expenses.status, "pending")))
          .returning();

        if (!expense) {
          throw new ORPCError("NOT_FOUND", {
            message: "Expense not found or not in pending status",
          });
        }

        return expense;
      }),

    create: protectedProcedure
      .input(
        z.object({
          amount: z.string(),
          categoryAccountId: z.string().uuid(),
          date: z.string().datetime(),
          description: z.string().min(1),
          notes: z.string().optional(),
          paymentAccountId: z.string().uuid(),
          vendorName: z.string().optional(),
        })
      )
      .handler(async ({ input, context }) =>
        db.transaction(async (tx) => {
          const expenseDate = new Date(input.date);

          const [period] = await tx
            .select({ id: accountingPeriods.id })
            .from(accountingPeriods)
            .where(
              and(
                eq(accountingPeriods.status, "open"),
                lte(accountingPeriods.startDate, expenseDate),
                gte(accountingPeriods.endDate, expenseDate)
              )
            )
            .limit(1);

          const expenseNumber = makeEntryNumber("EXP");

          const [expense] = await tx
            .insert(expenses)
            .values({
              amount: input.amount,
              categoryAccountId: input.categoryAccountId,
              createdBy: context.session.user.id,
              date: expenseDate,
              description: input.description,
              expenseNumber,
              notes: input.notes,
              paymentAccountId: input.paymentAccountId,
              periodId: period?.id ?? null,
              vendorName: input.vendorName,
            })
            .returning();

          const entryNumber = makeEntryNumber("JE");

          const amt = Number(input.amount);

          const [entry] = await tx
            .insert(journalEntries)
            .values({
              createdBy: context.session.user.id,
              date: expenseDate,
              description: `Expense: ${input.description}`,
              entryNumber,
              periodId: period?.id ?? null,
              postedAt: new Date(),
              sourceId: expense!.id,
              sourceType: "expense",
              status: "posted",
              totalCredit: amt.toString(),
              totalDebit: amt.toString(),
            })
            .returning({ id: journalEntries.id });

          const lines: {
            accountId: string;
            amount: string;
            description: string | null;
            entryId: string;
            type: "credit" | "debit";
          }[] = [
            {
              accountId: input.categoryAccountId,
              amount: input.amount,
              description: null,
              entryId: entry!.id,
              type: "debit",
            },
            {
              accountId: input.paymentAccountId,
              amount: input.amount,
              description: null,
              entryId: entry!.id,
              type: "credit",
            },
          ];

          await tx.insert(journalEntryLines).values(lines);
          await updateAccountBalances(tx, lines);

          return expense;
        })
      ),

    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) =>
        db.transaction(async (tx) => {
          const [expense] = await tx
            .select()
            .from(expenses)
            .where(
              and(eq(expenses.id, input.id), eq(expenses.status, "pending"))
            )
            .limit(1);

          if (!expense) {
            throw new ORPCError("NOT_FOUND", {
              message: "Expense not found or not in pending status",
            });
          }

          const linkedEntries = await tx
            .select({ id: journalEntries.id })
            .from(journalEntries)
            .where(
              and(
                eq(journalEntries.sourceId, input.id),
                eq(journalEntries.sourceType, "expense"),
                eq(journalEntries.status, "posted")
              )
            );

          for (const je of linkedEntries) {
            const lines = await tx
              .select({
                accountId: journalEntryLines.accountId,
                amount: journalEntryLines.amount,
                type: journalEntryLines.type,
              })
              .from(journalEntryLines)
              .where(eq(journalEntryLines.entryId, je.id));

            await updateAccountBalances(
              tx,
              lines.map((l) => ({
                accountId: l.accountId,
                amount: l.amount,
                type: l.type === "debit" ? "credit" : "debit",
              }))
            );

            await tx
              .update(journalEntries)
              .set({ status: "void", updatedAt: new Date() })
              .where(eq(journalEntries.id, je.id));
          }

          await tx.delete(expenses).where(eq(expenses.id, input.id));

          return { success: true };
        })
      ),

    get: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) => {
        const [expense] = await db
          .select()
          .from(expenses)
          .where(eq(expenses.id, input.id))
          .limit(1);

        if (!expense) {
          throw new ORPCError("NOT_FOUND", { message: "Expense not found" });
        }

        return expense;
      }),

    list: protectedProcedure
      .input(
        z.object({
          from: z.string().datetime().optional(),
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
          periodId: z.string().uuid().optional(),
          status: z.enum(["pending", "approved", "paid"]).optional(),
          to: z.string().datetime().optional(),
        })
      )
      .handler(async ({ input }) => {
        const conditions = [];

        if (input.status) {
          conditions.push(eq(expenses.status, input.status));
        }
        if (input.periodId) {
          conditions.push(eq(expenses.periodId, input.periodId));
        }
        if (input.from) {
          conditions.push(gte(expenses.date, new Date(input.from)));
        }
        if (input.to) {
          conditions.push(lte(expenses.date, new Date(input.to)));
        }

        const whereClause =
          conditions.length > 0 ? and(...conditions) : undefined;

        const [items, totalCountResult] = await Promise.all([
          db
            .select({
              amount: expenses.amount,
              categoryAccount: {
                code: accounts.code,
                id: accounts.id,
                name: accounts.name,
              },
              createdAt: expenses.createdAt,
              date: expenses.date,
              description: expenses.description,
              expenseNumber: expenses.expenseNumber,
              id: expenses.id,
              notes: expenses.notes,
              periodId: expenses.periodId,
              status: expenses.status,
              vendorName: expenses.vendorName,
            })
            .from(expenses)
            .leftJoin(accounts, eq(expenses.categoryAccountId, accounts.id))
            .where(whereClause)
            .limit(input.limit)
            .offset(input.offset)
            .orderBy(desc(expenses.date)),
          db
            .select({ count: sql<number>`count(*)` })
            .from(expenses)
            .where(whereClause),
        ]);

        return {
          items,
          pagination: {
            limit: input.limit,
            offset: input.offset,
            total: totalCountResult[0]?.count ?? 0,
          },
        };
      }),

    markPaid: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) => {
        const [expense] = await db
          .update(expenses)
          .set({ status: "paid", updatedAt: new Date() })
          .where(
            and(eq(expenses.id, input.id), eq(expenses.status, "approved"))
          )
          .returning();

        if (!expense) {
          throw new ORPCError("NOT_FOUND", {
            message: "Expense not found or not in approved status",
          });
        }

        return expense;
      }),

    update: protectedProcedure
      .input(
        z.object({
          amount: z.string().optional(),
          categoryAccountId: z.string().uuid().optional(),
          date: z.string().datetime().optional(),
          description: z.string().min(1).optional(),
          id: z.string().uuid(),
          notes: z.string().optional(),
          paymentAccountId: z.string().uuid().optional(),
          vendorName: z.string().optional(),
        })
      )
      .handler(async ({ input }) => {
        const { id, date, ...rest } = input;
        const [expense] = await db
          .update(expenses)
          .set({
            ...rest,
            date: date ? new Date(date) : undefined,
            updatedAt: new Date(),
          })
          .where(and(eq(expenses.id, id), eq(expenses.status, "pending")))
          .returning();

        if (!expense) {
          throw new ORPCError("NOT_FOUND", {
            message: "Expense not found or not in pending status",
          });
        }

        return expense;
      }),
  },

  fiscalYears: {
    close: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) =>
        db.transaction(async (tx) => {
          await tx
            .update(accountingPeriods)
            .set({ status: "locked", updatedAt: new Date() })
            .where(eq(accountingPeriods.fiscalYearId, input.id));

          const [fy] = await tx
            .update(fiscalYears)
            .set({ status: "closed", updatedAt: new Date() })
            .where(eq(fiscalYears.id, input.id))
            .returning();

          if (!fy) {
            throw new ORPCError("NOT_FOUND", {
              message: "Fiscal year not found",
            });
          }

          return fy;
        })
      ),

    create: protectedProcedure
      .input(
        z.object({
          endDate: z.string().datetime(),
          name: z.string().min(1),
          startDate: z.string().datetime(),
        })
      )
      .handler(async ({ input }) =>
        db.transaction(async (tx) => {
          const startDate = new Date(input.startDate);

          const [fy] = await tx
            .insert(fiscalYears)
            .values({
              endDate: new Date(input.endDate),
              name: input.name,
              startDate,
            })
            .returning();

          const periods = Array.from({ length: 12 }, (_, i) => {
            const d = new Date(startDate);
            d.setMonth(d.getMonth() + i);
            return {
              endDate: new Date(
                d.getFullYear(),
                d.getMonth() + 1,
                0,
                23,
                59,
                59,
                999
              ),
              fiscalYearId: fy!.id,
              name: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
              periodNumber: i + 1,
              startDate: new Date(d.getFullYear(), d.getMonth(), 1),
              status: "open" as const,
            };
          });

          await tx.insert(accountingPeriods).values(periods);

          return fy;
        })
      ),

    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
        })
      )
      .handler(async ({ input }) => {
        const [items, totalCountResult] = await Promise.all([
          db
            .select()
            .from(fiscalYears)
            .limit(input.limit)
            .offset(input.offset)
            .orderBy(desc(fiscalYears.startDate)),
          db.select({ count: sql<number>`count(*)` }).from(fiscalYears),
        ]);

        return {
          items,
          pagination: {
            limit: input.limit,
            offset: input.offset,
            total: totalCountResult[0]?.count ?? 0,
          },
        };
      }),

    periods: protectedProcedure
      .input(z.object({ fiscalYearId: z.string().uuid() }))
      .handler(async ({ input }) => {
        const items = await db
          .select()
          .from(accountingPeriods)
          .where(eq(accountingPeriods.fiscalYearId, input.fiscalYearId))
          .orderBy(accountingPeriods.periodNumber);

        return items;
      }),

    setCurrent: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) =>
        db.transaction(async (tx) => {
          await tx
            .update(fiscalYears)
            .set({ isCurrent: false, updatedAt: new Date() });

          const [fy] = await tx
            .update(fiscalYears)
            .set({ isCurrent: true, updatedAt: new Date() })
            .where(eq(fiscalYears.id, input.id))
            .returning();

          if (!fy) {
            throw new ORPCError("NOT_FOUND", {
              message: "Fiscal year not found",
            });
          }

          return fy;
        })
      ),
  },

  journalEntries: {
    create: protectedProcedure
      .input(
        z.object({
          date: z.string().datetime(),
          description: z.string().min(1),
          lines: z
            .array(
              z.object({
                accountId: z.string().uuid(),
                amount: z.string(),
                description: z.string().optional(),
                type: z.enum(["debit", "credit"]),
              })
            )
            .min(2),
          reference: z.string().optional(),
          sourceType: z
            .enum(["sale", "expense", "manual", "return"])
            .default("manual"),
        })
      )
      .handler(async ({ input, context }) =>
        db.transaction(async (tx) => {
          const debits = input.lines.filter((l) => l.type === "debit");
          const credits = input.lines.filter((l) => l.type === "credit");

          if (debits.length === 0 || credits.length === 0) {
            throw new ORPCError("BAD_REQUEST", {
              message:
                "Journal entry must have at least one debit and one credit line",
            });
          }

          const totalDR = debits.reduce((s, l) => s + Number(l.amount), 0);
          const totalCR = credits.reduce((s, l) => s + Number(l.amount), 0);

          if (Math.abs(totalDR - totalCR) > 0.001) {
            throw new ORPCError("BAD_REQUEST", {
              message: `Debits (${totalDR}) must equal credits (${totalCR})`,
            });
          }

          const entryDate = new Date(input.date);

          const [period] = await tx
            .select({ id: accountingPeriods.id })
            .from(accountingPeriods)
            .where(
              and(
                eq(accountingPeriods.status, "open"),
                lte(accountingPeriods.startDate, entryDate),
                gte(accountingPeriods.endDate, entryDate)
              )
            )
            .limit(1);

          const entryNumber = makeEntryNumber("JE");

          const [entry] = await tx
            .insert(journalEntries)
            .values({
              createdBy: context.session.user.id,
              date: entryDate,
              description: input.description,
              entryNumber,
              periodId: period?.id ?? null,
              reference: input.reference,
              sourceType: input.sourceType,
              status: "draft",
              totalCredit: totalCR.toString(),
              totalDebit: totalDR.toString(),
            })
            .returning();

          await tx.insert(journalEntryLines).values(
            input.lines.map((l) => ({
              accountId: l.accountId,
              amount: l.amount,
              description: l.description ?? null,
              entryId: entry!.id,
              type: l.type,
            }))
          );

          return entry;
        })
      ),

    get: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) => {
        const [entry] = await db
          .select()
          .from(journalEntries)
          .where(eq(journalEntries.id, input.id))
          .limit(1);

        if (!entry) {
          throw new ORPCError("NOT_FOUND", {
            message: "Journal entry not found",
          });
        }

        const lines = await db
          .select({
            accountCode: accounts.code,
            accountId: accounts.id,
            accountName: accounts.name,
            amount: journalEntryLines.amount,
            description: journalEntryLines.description,
            id: journalEntryLines.id,
            type: journalEntryLines.type,
          })
          .from(journalEntryLines)
          .leftJoin(accounts, eq(journalEntryLines.accountId, accounts.id))
          .where(eq(journalEntryLines.entryId, input.id));

        return { ...entry, lines };
      }),

    list: protectedProcedure
      .input(
        z.object({
          from: z.string().datetime().optional(),
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
          periodId: z.string().uuid().optional(),
          sourceType: z
            .enum(["sale", "expense", "manual", "return", "purchase_order"])
            .optional(),
          status: z.enum(["draft", "posted", "void"]).optional(),
          to: z.string().datetime().optional(),
        })
      )
      .handler(async ({ input }) => {
        const conditions = [];

        if (input.status) {
          conditions.push(eq(journalEntries.status, input.status));
        }
        if (input.sourceType) {
          conditions.push(eq(journalEntries.sourceType, input.sourceType));
        }
        if (input.periodId) {
          conditions.push(eq(journalEntries.periodId, input.periodId));
        }
        if (input.from) {
          conditions.push(gte(journalEntries.date, new Date(input.from)));
        }
        if (input.to) {
          conditions.push(lte(journalEntries.date, new Date(input.to)));
        }

        const whereClause =
          conditions.length > 0 ? and(...conditions) : undefined;

        const [items, totalCountResult] = await Promise.all([
          db
            .select()
            .from(journalEntries)
            .where(whereClause)
            .limit(input.limit)
            .offset(input.offset)
            .orderBy(desc(journalEntries.date)),
          db
            .select({ count: sql<number>`count(*)` })
            .from(journalEntries)
            .where(whereClause),
        ]);

        return {
          items,
          pagination: {
            limit: input.limit,
            offset: input.offset,
            total: totalCountResult[0]?.count ?? 0,
          },
        };
      }),

    post: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) =>
        db.transaction(async (tx) => {
          const [entry] = await tx
            .select()
            .from(journalEntries)
            .where(
              and(
                eq(journalEntries.id, input.id),
                eq(journalEntries.status, "draft")
              )
            )
            .limit(1);

          if (!entry) {
            throw new ORPCError("NOT_FOUND", {
              message: "Draft journal entry not found",
            });
          }

          const lines = await tx
            .select({
              accountId: journalEntryLines.accountId,
              amount: journalEntryLines.amount,
              type: journalEntryLines.type,
            })
            .from(journalEntryLines)
            .where(eq(journalEntryLines.entryId, input.id));

          const totalDR = lines
            .filter((l) => l.type === "debit")
            .reduce((s, l) => s + Number(l.amount), 0);
          const totalCR = lines
            .filter((l) => l.type === "credit")
            .reduce((s, l) => s + Number(l.amount), 0);

          if (Math.abs(totalDR - totalCR) > 0.001) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Journal entry is not balanced",
            });
          }

          const [posted] = await tx
            .update(journalEntries)
            .set({
              postedAt: new Date(),
              status: "posted",
              updatedAt: new Date(),
            })
            .where(eq(journalEntries.id, input.id))
            .returning();

          await updateAccountBalances(tx, lines);

          return posted;
        })
      ),

    void: protectedProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          reason: z.string().min(1),
        })
      )
      .handler(async ({ input }) =>
        db.transaction(async (tx) => {
          const [entry] = await tx
            .select()
            .from(journalEntries)
            .where(
              and(
                eq(journalEntries.id, input.id),
                eq(journalEntries.status, "posted")
              )
            )
            .limit(1);

          if (!entry) {
            throw new ORPCError("NOT_FOUND", {
              message: "Posted journal entry not found",
            });
          }

          // Prevent voiding entries in a locked accounting period
          if (entry.periodId) {
            const [period] = await tx
              .select({ status: accountingPeriods.status })
              .from(accountingPeriods)
              .where(eq(accountingPeriods.id, entry.periodId))
              .limit(1);

            if (period?.status === "locked") {
              throw new ORPCError("BAD_REQUEST", {
                message:
                  "Cannot void an entry in a locked accounting period. Close the period lock first.",
              });
            }
          }

          const lines = await tx
            .select({
              accountId: journalEntryLines.accountId,
              amount: journalEntryLines.amount,
              type: journalEntryLines.type,
            })
            .from(journalEntryLines)
            .where(eq(journalEntryLines.entryId, input.id));

          await updateAccountBalances(
            tx,
            lines.map((l) => ({
              accountId: l.accountId,
              amount: l.amount,
              type: l.type === "debit" ? "credit" : "debit",
            }))
          );

          // ── POS cascade ─────────────────────────────────────────────────
          // 1. If this JE is linked to a due-collection record, restore the
          //    customer's dueBalance (the payment is being un-done).
          const linkedCollections = await tx
            .select({
              amount: dueCollections.amount,
              customerId: dueCollections.customerId,
              id: dueCollections.id,
            })
            .from(dueCollections)
            .where(eq(dueCollections.journalEntryId, input.id));

          for (const dc of linkedCollections) {
            await tx
              .update(customers)
              .set({
                dueBalance: sql`${customers.dueBalance} + ${Number(dc.amount)}`,
                updatedAt: new Date(),
              })
              .where(eq(customers.id, dc.customerId));

            // Mark the collection as voided so it no longer appears as an
            // active payment in the customer's history and the restored
            // dueBalance is consistent with the displayed records.
            await tx
              .update(dueCollections)
              .set({ journalEntryId: null, status: "voided" })
              .where(eq(dueCollections.id, dc.id));
          }

          // 2. If this JE came from a sale, reverse any on_account balance
          //    increases (the recorded debt should no longer exist).
          if (entry.sourceType === "sale" && entry.sourceId) {
            const onAccountRows = await tx
              .select({ amount: payments.amount })
              .from(payments)
              .where(
                and(
                  eq(payments.saleId, entry.sourceId),
                  eq(payments.method, "on_account")
                )
              );

            if (onAccountRows.length > 0) {
              const [saleRow] = await tx
                .select({ customerId: sales.customerId })
                .from(sales)
                .where(eq(sales.id, entry.sourceId))
                .limit(1);

              if (saleRow?.customerId) {
                const onAccountTotal = onAccountRows.reduce(
                  (s, p) => s + Number(p.amount),
                  0
                );
                await tx
                  .update(customers)
                  .set({
                    dueBalance: sql`${customers.dueBalance} - ${onAccountTotal}`,
                    updatedAt: new Date(),
                  })
                  .where(eq(customers.id, saleRow.customerId));
              }
            }
          }
          // ────────────────────────────────────────────────────────────────

          const now = new Date();
          const [voided] = await tx
            .update(journalEntries)
            .set({
              status: "void",
              updatedAt: now,
              voidedAt: now,
              voidReason: input.reason,
            })
            .where(eq(journalEntries.id, input.id))
            .returning();

          return voided;
        })
      ),
  },

  reports: {
    balanceSheet: protectedProcedure
      .input(z.object({ asOf: z.string().datetime() }))
      .handler(async ({ input }) => {
        const rows = await db
          .select({
            accountId: accounts.id,
            balance: sql<string>`CASE WHEN ${accounts.normalBalance}='debit'
              THEN COALESCE(SUM(CASE WHEN ${journalEntryLines.type}='debit' THEN ${journalEntryLines.amount}::numeric ELSE 0 END),0)
                 - COALESCE(SUM(CASE WHEN ${journalEntryLines.type}='credit' THEN ${journalEntryLines.amount}::numeric ELSE 0 END),0)
              ELSE COALESCE(SUM(CASE WHEN ${journalEntryLines.type}='credit' THEN ${journalEntryLines.amount}::numeric ELSE 0 END),0)
                 - COALESCE(SUM(CASE WHEN ${journalEntryLines.type}='debit' THEN ${journalEntryLines.amount}::numeric ELSE 0 END),0)
              END`,
            code: accounts.code,
            name: accounts.name,
            normalBalance: accounts.normalBalance,
            type: accounts.type,
          })
          .from(accounts)
          .leftJoin(
            journalEntryLines,
            eq(journalEntryLines.accountId, accounts.id)
          )
          .leftJoin(
            journalEntries,
            and(
              eq(journalEntries.id, journalEntryLines.entryId),
              eq(journalEntries.status, "posted"),
              lte(journalEntries.date, new Date(input.asOf))
            )
          )
          .where(
            and(
              eq(accounts.isActive, true),
              inArray(accounts.type, ["asset", "liability", "equity"])
            )
          )
          .groupBy(
            accounts.id,
            accounts.code,
            accounts.name,
            accounts.type,
            accounts.normalBalance
          )
          .orderBy(accounts.code);

        const assets = rows.filter((r) => r.type === "asset");
        const liabilities = rows.filter((r) => r.type === "liability");
        const equity = rows.filter((r) => r.type === "equity");

        const totalAssets = assets.reduce((s, r) => s + Number(r.balance), 0);
        const totalLiabilities = liabilities.reduce(
          (s, r) => s + Number(r.balance),
          0
        );
        const totalEquity = equity.reduce((s, r) => s + Number(r.balance), 0);

        return {
          assets,
          equity,
          liabilities,
          totalAssets,
          totalEquity,
          totalLiabilities,
        };
      }),

    profitAndLoss: protectedProcedure
      .input(
        z.object({ from: z.string().datetime(), to: z.string().datetime() })
      )
      .handler(async ({ input }) => {
        const rows = await db
          .select({
            accountId: accounts.id,
            balance: sql<string>`CASE WHEN ${accounts.normalBalance}='debit'
              THEN COALESCE(SUM(CASE WHEN ${journalEntryLines.type}='debit' THEN ${journalEntryLines.amount}::numeric ELSE 0 END),0)
                 - COALESCE(SUM(CASE WHEN ${journalEntryLines.type}='credit' THEN ${journalEntryLines.amount}::numeric ELSE 0 END),0)
              ELSE COALESCE(SUM(CASE WHEN ${journalEntryLines.type}='credit' THEN ${journalEntryLines.amount}::numeric ELSE 0 END),0)
                 - COALESCE(SUM(CASE WHEN ${journalEntryLines.type}='debit' THEN ${journalEntryLines.amount}::numeric ELSE 0 END),0)
              END`,
            code: accounts.code,
            name: accounts.name,
            normalBalance: accounts.normalBalance,
            type: accounts.type,
          })
          .from(accounts)
          .leftJoin(
            journalEntryLines,
            eq(journalEntryLines.accountId, accounts.id)
          )
          .leftJoin(
            journalEntries,
            and(
              eq(journalEntries.id, journalEntryLines.entryId),
              eq(journalEntries.status, "posted"),
              gte(journalEntries.date, new Date(input.from)),
              lte(journalEntries.date, new Date(input.to))
            )
          )
          .where(
            and(
              eq(accounts.isActive, true),
              inArray(accounts.type, ["revenue", "expense"])
            )
          )
          .groupBy(
            accounts.id,
            accounts.code,
            accounts.name,
            accounts.type,
            accounts.normalBalance
          )
          .orderBy(accounts.code);

        const revenue = rows.filter((r) => r.type === "revenue");
        const expenseRows = rows.filter((r) => r.type === "expense");

        const totalRevenue = revenue.reduce((s, r) => s + Number(r.balance), 0);
        const totalExpenses = expenseRows.reduce(
          (s, r) => s + Number(r.balance),
          0
        );

        return {
          expenses: expenseRows,
          netIncome: totalRevenue - totalExpenses,
          revenue,
          totalExpenses,
          totalRevenue,
        };
      }),

    trialBalance: protectedProcedure
      .input(
        z.object({ from: z.string().datetime(), to: z.string().datetime() })
      )
      .handler(async ({ input }) => {
        const rows = await db
          .select({
            accountId: accounts.id,
            balance: sql<string>`CASE WHEN ${accounts.normalBalance}='debit'
              THEN COALESCE(SUM(CASE WHEN ${journalEntryLines.type}='debit' THEN ${journalEntryLines.amount}::numeric ELSE 0 END),0)
                 - COALESCE(SUM(CASE WHEN ${journalEntryLines.type}='credit' THEN ${journalEntryLines.amount}::numeric ELSE 0 END),0)
              ELSE COALESCE(SUM(CASE WHEN ${journalEntryLines.type}='credit' THEN ${journalEntryLines.amount}::numeric ELSE 0 END),0)
                 - COALESCE(SUM(CASE WHEN ${journalEntryLines.type}='debit' THEN ${journalEntryLines.amount}::numeric ELSE 0 END),0)
              END`,
            code: accounts.code,
            name: accounts.name,
            normalBalance: accounts.normalBalance,
            totalCredit: sql<string>`COALESCE(SUM(CASE WHEN ${journalEntryLines.type}='credit' THEN ${journalEntryLines.amount}::numeric ELSE 0 END),0)`,
            totalDebit: sql<string>`COALESCE(SUM(CASE WHEN ${journalEntryLines.type}='debit' THEN ${journalEntryLines.amount}::numeric ELSE 0 END),0)`,
            type: accounts.type,
          })
          .from(accounts)
          .leftJoin(
            journalEntryLines,
            eq(journalEntryLines.accountId, accounts.id)
          )
          .leftJoin(
            journalEntries,
            and(
              eq(journalEntries.id, journalEntryLines.entryId),
              eq(journalEntries.status, "posted"),
              gte(journalEntries.date, new Date(input.from)),
              lte(journalEntries.date, new Date(input.to))
            )
          )
          .where(eq(accounts.isActive, true))
          .groupBy(
            accounts.id,
            accounts.code,
            accounts.name,
            accounts.type,
            accounts.normalBalance
          )
          .orderBy(accounts.code);

        return { rows };
      }),
  },

  settings: {
    seedAccounts: protectedProcedure.input(z.object({})).handler(async () => {
      const seeded = await seedDefaultAccounts();
      return { seeded };
    }),

    summary: protectedProcedure.input(z.object({})).handler(async () => {
      const [accountCount, currentFY, openPeriodCount, postedEntries] =
        await Promise.all([
          db
            .select({ count: sql<number>`count(*)` })
            .from(accounts)
            .where(eq(accounts.isActive, true)),
          db
            .select({ name: fiscalYears.name })
            .from(fiscalYears)
            .where(eq(fiscalYears.isCurrent, true))
            .limit(1),
          db
            .select({ count: sql<number>`count(*)` })
            .from(accountingPeriods)
            .where(eq(accountingPeriods.status, "open")),
          db
            .select({ count: sql<number>`count(*)` })
            .from(journalEntries)
            .where(eq(journalEntries.status, "posted")),
        ]);

      return {
        accountCount: accountCount[0]?.count ?? 0,
        currentFiscalYearName: currentFY[0]?.name ?? null,
        openPeriodCount: openPeriodCount[0]?.count ?? 0,
        totalPostedEntries: postedEntries[0]?.count ?? 0,
      };
    }),
  },
};
