import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";

import { db } from "@notebook/db";
import {
  customers,
  discounts,
  dueCollections,
  employees,
  giftCardTransactions,
  giftCards,
  locations,
  payments,
  products,
  productVariants,
  returnItems,
  returns,
  saleItems,
  sales,
  shifts,
  stockLevels,
  stockMovements,
} from "@notebook/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, gte, inArray, lte, sql, sum } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import {
  postDueCollectionJournalEntry,
  postSaleJournalEntry,
} from "./accounting";

async function resolveEmployeeId(
  tx: PgTransaction<any, any, ExtractTablesWithRelations<any>>,
  user: { email: string; id: string; name: string }
) {
  const [employee] = await tx
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.userId, user.id))
    .limit(1);

  if (!employee) {
    const nameParts = (user.name || "User").split(" ");
    const [created] = await tx
      .insert(employees)
      .values({
        email: user.email,
        employeeNumber: `EMP-${Date.now()}`,
        firstName: nameParts[0] || "User",
        lastName: nameParts.slice(1).join(" ") || "Staff",
        role: "cashier",
        userId: user.id,
      })
      .returning({ id: employees.id });
    return created!.id;
  }

  return employee.id;
}

const createCustomerSchema = z.object({
  address: z.string().optional(),
  birthDate: z.string().datetime().optional(),
  city: z.string().optional(),
  companyName: z.string().optional(),
  country: z.string().optional(),
  customerNumber: z.string().optional(),
  discountRate: z.string().optional(),
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  notes: z.string().optional(),
  phone: z.string().optional(),
  state: z.string().optional(),
  type: z.enum(["regular", "vip", "wholesale", "employee"]).default("regular"),
  zipCode: z.string().optional(),
});

const updateCustomerSchema = createCustomerSchema.partial().extend({
  id: z.string().uuid(),
});

const createEmployeeSchema = z.object({
  canApplyDiscounts: z.boolean().default(false),
  canProcessReturns: z.boolean().default(false),
  commissionRate: z.string().optional(),
  department: z.string().optional(),
  email: z.string().email(),
  employeeNumber: z.string(),
  firstName: z.string().min(1),
  hourlyRate: z.string().optional(),
  lastName: z.string().min(1),
  maxDiscountPercent: z.string().optional(),
  phone: z.string().optional(),
  role: z.string().min(1),
  userId: z.string(),
});

const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  id: z.string().uuid(),
});

const startShiftSchema = z.object({
  employeeId: z.string().uuid(),
  locationId: z.string().uuid(),
  notes: z.string().optional(),
});

const endShiftSchema = z.object({
  breakMinutes: z.number().int().min(0).default(0),
  notes: z.string().optional(),
  shiftId: z.string().uuid(),
});

const saleItemSchema = z.object({
  discountAmount: z.string().default("0"),
  notes: z.string().optional(),
  productId: z.string().uuid(),
  quantity: z.number().int().min(1),
  unitPrice: z.string(),
  variantId: z.string().uuid().optional(),
});

const paymentSchema = z.object({
  amount: z.string(),
  authCode: z.string().optional(),
  cardLast4: z.string().optional(),
  cardType: z.string().optional(),
  giftCardNumber: z.string().optional(),
  method: z.enum([
    "cash",
    "credit_card",
    "debit_card",
    "mobile_payment",
    "check",
    "gift_card",
    "store_credit",
    "on_account",
  ]),
  reference: z.string().optional(),
  transactionId: z.string().optional(),
});

const dueCollectionSchema = z.object({
  amount: z.string(),
  method: z.enum([
    "cash",
    "credit_card",
    "debit_card",
    "mobile_payment",
    "check",
    "gift_card",
    "store_credit",
  ]),
});

const createSaleSchema = z.object({
  customerId: z.string().uuid().optional(),
  discountAmount: z.string().default("0"),
  dueCollection: dueCollectionSchema.optional(),
  items: z.array(saleItemSchema).min(1),
  locationId: z.string().uuid(),
  loyaltyPointsUsed: z.number().int().min(0).default(0),
  notes: z.string().optional(),
  payments: z.array(paymentSchema).min(1),
  shiftId: z.string().uuid().optional(),
});

const createDiscountSchema = z.object({
  applicableCategories: z.array(z.string().uuid()).optional(),
  applicableCustomerTypes: z.array(z.string()).optional(),
  applicableProducts: z.array(z.string().uuid()).optional(),
  code: z.string().optional(),
  description: z.string().optional(),
  maxDiscountAmount: z.string().optional(),
  minPurchaseAmount: z.string().optional(),
  name: z.string().min(1),
  stackable: z.boolean().default(false),
  type: z.enum(["percentage", "fixed_amount", "buy_x_get_y"]),
  usageLimit: z.number().int().min(1).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  value: z.string(),
});

const updateDiscountSchema = createDiscountSchema.partial().extend({
  id: z.string().uuid(),
});

const validateDiscountSchema = z.object({
  code: z.string(),
  customerId: z.string().uuid().optional(),
  items: z.array(
    z.object({
      categoryId: z.string().uuid().optional(),
      productId: z.string().uuid(),
      quantity: z.number().int(),
      unitPrice: z.string(),
    })
  ),
  subtotal: z.string(),
});

const createReturnSchema = z.object({
  customerId: z.string().uuid().optional(),
  items: z.array(
    z.object({
      condition: z.string().optional(),
      quantityReturned: z.number().int().min(1),
      restockable: z.boolean().default(true),
      saleItemId: z.string().uuid(),
    })
  ),
  locationId: z.string().uuid(),
  notes: z.string().optional(),
  originalSaleId: z.string().uuid(),
  reason: z.enum([
    "defective",
    "wrong_item",
    "damaged",
    "customer_changed_mind",
    "warranty_claim",
    "other",
  ]),
  restockingFee: z.string().default("0"),
});

const createGiftCardSchema = z.object({
  customerId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
  initialAmount: z.string(),
  notes: z.string().optional(),
});

const searchSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  query: z.string().optional(),
});

const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

const dateRangeSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const posRouter = {
  // Customers
  customers: {
    account: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) => {
        const [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, input.id))
          .limit(1);

        if (!customer) {
          throw new ORPCError("NOT_FOUND", { message: "Customer not found" });
        }

        // Recent purchases with payment method summary
        const recentSales = await db
          .select({
            amountPaid: sales.amountPaid,
            changeGiven: sales.changeGiven,
            discountAmount: sales.discountAmount,
            id: sales.id,
            loyaltyPointsEarned: sales.loyaltyPointsEarned,
            loyaltyPointsUsed: sales.loyaltyPointsUsed,
            receiptNumber: sales.receiptNumber,
            saleDate: sales.saleDate,
            status: sales.status,
            subtotal: sales.subtotal,
            taxAmount: sales.taxAmount,
            totalAmount: sales.totalAmount,
          })
          .from(sales)
          .where(eq(sales.customerId, input.id))
          .orderBy(desc(sales.saleDate))
          .limit(50);

        const saleIds = recentSales.map((s) => s.id);

        // All payments for those sales
        const allPayments =
          saleIds.length > 0
            ? await db
                .select({
                  amount: payments.amount,
                  authCode: payments.authCode,
                  cardLast4: payments.cardLast4,
                  cardType: payments.cardType,
                  id: payments.id,
                  method: payments.method,
                  processedAt: payments.processedAt,
                  receiptNumber: sales.receiptNumber,
                  reference: payments.reference,
                  saleId: payments.saleId,
                  status: payments.status,
                })
                .from(payments)
                .leftJoin(sales, eq(payments.saleId, sales.id))
                .where(
                  and(
                    inArray(payments.saleId, saleIds),
                    eq(payments.status, "completed")
                  )
                )
                .orderBy(desc(payments.processedAt))
            : [];

        // Due collection history (include voided records so they appear in the
        // audit trail, but the UI marks them clearly and excludes them from totals)
        const dueCollectionHistory = await db
          .select({
            amount: dueCollections.amount,
            collectedAt: dueCollections.collectedAt,
            id: dueCollections.id,
            method: dueCollections.method,
            notes: dueCollections.notes,
            receiptNumber: sales.receiptNumber,
            reference: dueCollections.reference,
            saleId: dueCollections.saleId,
            status: dueCollections.status,
          })
          .from(dueCollections)
          .leftJoin(sales, eq(dueCollections.saleId, sales.id))
          .where(eq(dueCollections.customerId, input.id))
          .orderBy(desc(dueCollections.collectedAt));

        // Payment method totals
        const paymentMethodTotals = allPayments.reduce<Record<string, number>>(
          (acc, p) => {
            acc[p.method] = (acc[p.method] ?? 0) + Number(p.amount);
            return acc;
          },
          {}
        );

        return {
          allPayments,
          customer,
          dueCollectionHistory,
          paymentMethodTotals,
          recentSales,
          summary: {
            averageOrderValue:
              recentSales.length > 0
                ? Number(customer.totalSpent) / recentSales.length
                : 0,
            creditBalance: Number(customer.creditBalance),
            dueBalance: Number(customer.dueBalance),
            loyaltyPoints: customer.loyaltyPoints ?? 0,
            totalOrders: recentSales.length,
            totalSpent: Number(customer.totalSpent),
          },
        };
      }),

    create: protectedProcedure
      .input(createCustomerSchema)
      .handler(async ({ input }) => {
        const customerData = {
          ...input,
          birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
          customerNumber: input.customerNumber ?? `CUS-${Date.now()}`,
        };

        const [customer] = await db
          .insert(customers)
          .values(customerData)
          .returning();

        return customer;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) => {
        const [customer] = await db
          .update(customers)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(customers.id, input.id))
          .returning();

        if (!customer) {
          throw new ORPCError("NOT_FOUND", { message: "Customer not found" });
        }

        return { success: true };
      }),

    adjustCredit: protectedProcedure
      .input(
        z.object({
          amount: z.string(),
          id: z.string().uuid(),
        })
      )
      .handler(async ({ input }) => {
        const [updated] = await db
          .update(customers)
          .set({
            creditBalance: sql`${customers.creditBalance} + ${Number(input.amount)}`,
            updatedAt: new Date(),
          })
          .where(eq(customers.id, input.id))
          .returning({
            creditBalance: customers.creditBalance,
            id: customers.id,
          });
        return updated;
      }),

    collectDuePayment: protectedProcedure
      .input(
        z.object({
          amount: z.string(),
          customerId: z.string().uuid(),
          method: z.enum([
            "cash",
            "credit_card",
            "debit_card",
            "mobile_payment",
            "check",
            "gift_card",
            "store_credit",
          ]),
        })
      )
      .handler(async ({ input, context }) => {
        const amt = Number(input.amount);
        if (amt <= 0) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Amount must be greater than zero.",
          });
        }

        const collectionDate = new Date();

        const updated = await db.transaction(async (tx) => {
          const [cust] = await tx
            .select({ dueBalance: customers.dueBalance, id: customers.id })
            .from(customers)
            .where(eq(customers.id, input.customerId))
            .limit(1);

          if (!cust) {
            throw new ORPCError("NOT_FOUND", {
              message: "Customer not found.",
            });
          }
          if (Number(cust.dueBalance) < amt) {
            throw new ORPCError("BAD_REQUEST", {
              message: `Customer only owes $${Number(cust.dueBalance).toFixed(2)}.`,
            });
          }

          const [row] = await tx
            .update(customers)
            .set({
              dueBalance: sql`${customers.dueBalance} - ${amt}`,
              updatedAt: new Date(),
            })
            .where(eq(customers.id, input.customerId))
            .returning({ dueBalance: customers.dueBalance, id: customers.id });

          const [dcRow] = await tx
            .insert(dueCollections)
            .values({
              amount: input.amount,
              collectedAt: collectionDate,
              customerId: input.customerId,
              method: input.method,
            })
            .returning({ id: dueCollections.id });

          return { dcId: dcRow!.id, row };
        });

        // Post the accounting entry outside the transaction so a missing
        // chart-of-accounts never rolls back the balance update.
        // If it succeeds, link the JE back to the dueCollections record so
        // voiding the JE can restore the customer's dueBalance.
        try {
          const jeResult = await postDueCollectionJournalEntry(
            db,
            { amount: input.amount, method: input.method },
            collectionDate,
            context.session.user.id
          );
          if (jeResult) {
            await db
              .update(dueCollections)
              .set({ journalEntryId: jeResult.id })
              .where(eq(dueCollections.id, updated.dcId));
          }
        } catch {
          // Accounting not configured — balance update still succeeded
        }

        return updated.row;
      }),

    get: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) => {
        const [customer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, input.id));

        if (!customer) {
          throw new ORPCError("NOT_FOUND", { message: "Customer not found" });
        }

        return customer;
      }),

    list: protectedProcedure.input(searchSchema).handler(async ({ input }) => {
      const conditions = [eq(customers.isActive, true)];

      if (input.query) {
        conditions.push(
          sql`${customers.firstName} ILIKE ${`%${input.query}%`} OR ${customers.lastName} ILIKE ${`%${input.query}%`} OR ${customers.email} ILIKE ${`%${input.query}%`} OR ${customers.phone} ILIKE ${`%${input.query}%`} OR ${customers.customerNumber} ILIKE ${`%${input.query}%`}`
        );
      }

      const [items, totalCountResult] = await Promise.all([
        db
          .select({
            companyName: customers.companyName,
            createdAt: customers.createdAt,
            creditBalance: customers.creditBalance,
            customerNumber: customers.customerNumber,
            dueBalance: customers.dueBalance,
            email: customers.email,
            firstName: customers.firstName,
            id: customers.id,
            lastName: customers.lastName,
            loyaltyPoints: customers.loyaltyPoints,
            phone: customers.phone,
            totalSpent: customers.totalSpent,
            type: customers.type,
          })
          .from(customers)
          .where(and(...conditions))
          .limit(input.limit)
          .offset(input.offset)
          .orderBy(customers.firstName, customers.lastName),
        db
          .select({ count: sql<number>`count(*)` })
          .from(customers)
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

    update: protectedProcedure
      .input(updateCustomerSchema)
      .handler(async ({ input }) => {
        const { id, ...updateData } = input;

        const [customer] = await db
          .update(customers)
          .set({
            ...updateData,
            birthDate: updateData.birthDate
              ? new Date(updateData.birthDate)
              : undefined,
            updatedAt: new Date(),
          })
          .where(eq(customers.id, id))
          .returning();

        if (!customer) {
          throw new ORPCError("NOT_FOUND", { message: "Customer not found" });
        }

        return customer;
      }),
  },

  // Employees
  employees: {
    create: protectedProcedure
      .input(createEmployeeSchema)
      .handler(async ({ input }) => {
        const [employee] = await db.insert(employees).values(input).returning();

        return employee;
      }),

    list: protectedProcedure
      .input(paginationSchema)
      .handler(async ({ input }) => {
        const [items, totalCountResult] = await Promise.all([
          db
            .select()
            .from(employees)
            .where(eq(employees.isActive, true))
            .limit(input.limit)
            .offset(input.offset)
            .orderBy(employees.firstName, employees.lastName),
          db
            .select({ count: sql<number>`count(*)` })
            .from(employees)
            .where(eq(employees.isActive, true)),
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

    update: protectedProcedure
      .input(updateEmployeeSchema)
      .handler(async ({ input }) => {
        const { id, ...updateData } = input;

        const [employee] = await db
          .update(employees)
          .set({ ...updateData, updatedAt: new Date() })
          .where(eq(employees.id, id))
          .returning();

        if (!employee) {
          throw new ORPCError("NOT_FOUND", { message: "Employee not found" });
        }

        return employee;
      }),
  },

  // Shifts
  shifts: {
    current: protectedProcedure
      .input(z.object({ employeeId: z.string().uuid() }))
      .handler(async ({ input }) => {
        const [shift] = await db
          .select({
            endTime: shifts.endTime,
            id: shifts.id,
            location: {
              id: locations.id,
              name: locations.name,
            },
            startTime: shifts.startTime,
            totalSales: shifts.totalSales,
            transactionCount: shifts.transactionCount,
          })
          .from(shifts)
          .leftJoin(locations, eq(shifts.locationId, locations.id))
          .where(
            and(
              eq(shifts.employeeId, input.employeeId),
              sql`${shifts.endTime} IS NULL`
            )
          )
          .limit(1);

        return shift || null;
      }),

    end: protectedProcedure.input(endShiftSchema).handler(async ({ input }) => {
      const [shift] = await db
        .select()
        .from(shifts)
        .where(eq(shifts.id, input.shiftId))
        .limit(1);

      if (!shift) {
        throw new ORPCError("NOT_FOUND", { message: "Shift not found" });
      }

      const endTime = new Date();
      const hoursWorked =
        (endTime.getTime() - shift.startTime.getTime()) / (1000 * 60 * 60) -
        input.breakMinutes / 60;

      const [updatedShift] = await db
        .update(shifts)
        .set({
          breakMinutes: input.breakMinutes,
          endTime,
          hoursWorked: hoursWorked.toString(),
          notes: input.notes,
          updatedAt: new Date(),
        })
        .where(eq(shifts.id, input.shiftId))
        .returning();

      return updatedShift;
    }),

    start: protectedProcedure
      .input(startShiftSchema)
      .handler(async ({ input }) => {
        const [shift] = await db.insert(shifts).values(input).returning();
        return shift;
      }),
  },

  // Sales
  sales: {
    create: protectedProcedure
      .input(createSaleSchema)
      .handler(async ({ input, context }) => {
        const txResult = await db.transaction(async (tx) => {
          const employeeId = await resolveEmployeeId(tx, context.session.user);
          const receiptNumber = `REC-${Date.now()}`;
          let checkoutDueCollectionId: string | null = null;

          let subtotal = 0;
          for (const item of input.items) {
            const itemTotal =
              Number(item.unitPrice) * item.quantity -
              Number(item.discountAmount);
            subtotal += itemTotal;
          }

          const taxRate = 0.08;
          const taxAmount = subtotal * taxRate;
          const totalAmount =
            subtotal - Number(input.discountAmount) + taxAmount;

          let amountPaid = 0;
          for (const payment of input.payments) {
            amountPaid += Number(payment.amount);
          }

          const changeGiven = Math.max(0, amountPaid - totalAmount);

          const [sale] = await tx
            .insert(sales)
            .values({
              amountPaid: amountPaid.toString(),
              changeGiven: changeGiven.toString(),
              customerId: input.customerId,
              discountAmount: input.discountAmount,
              employeeId,
              locationId: input.locationId,
              loyaltyPointsEarned: Math.floor(totalAmount),
              loyaltyPointsUsed: input.loyaltyPointsUsed,
              notes: input.notes,
              receiptNumber,
              shiftId: input.shiftId,
              status: "completed",
              subtotal: subtotal.toString(),
              taxAmount: taxAmount.toString(),
              totalAmount: totalAmount.toString(),
            })
            .returning();

          for (const item of input.items) {
            const itemTotal = Number(item.unitPrice) * item.quantity;
            const itemTaxAmount = itemTotal * taxRate;

            await tx.insert(saleItems).values({
              discountAmount: item.discountAmount,
              notes: item.notes,
              productId: item.productId,
              quantity: item.quantity,
              saleId: sale!.id,
              taxAmount: itemTaxAmount.toString(),
              totalPrice: (itemTotal - Number(item.discountAmount)).toString(),
              unitPrice: item.unitPrice,
              variantId: item.variantId,
            });

            const stockLevel = await tx
              .select()
              .from(stockLevels)
              .where(
                and(
                  eq(stockLevels.productId, item.productId),
                  item.variantId
                    ? eq(stockLevels.variantId, item.variantId)
                    : sql`${stockLevels.variantId} IS NULL`,
                  eq(stockLevels.locationId, input.locationId)
                )
              )
              .limit(1);

            if (stockLevel.length > 0) {
              const currentQuantity = stockLevel[0]!.quantity;
              const newQuantity = Math.max(0, currentQuantity - item.quantity);

              await tx
                .update(stockLevels)
                .set({
                  availableQuantity: newQuantity,
                  lastMovementAt: new Date(),
                  quantity: newQuantity,
                  updatedAt: new Date(),
                })
                .where(eq(stockLevels.id, stockLevel[0]!.id));

              await tx.insert(stockMovements).values({
                locationId: input.locationId,
                newQuantity,
                previousQuantity: currentQuantity,
                productId: item.productId,
                quantity: -item.quantity,
                reason: "Sale transaction",
                referenceId: sale!.id,
                referenceType: "sale",
                type: "sale",
                userId: context.session.user.id,
                variantId: item.variantId,
              });
            }
          }

          for (const payment of input.payments) {
            await tx.insert(payments).values({
              amount: payment.amount,
              authCode: payment.authCode,
              cardLast4: payment.cardLast4,
              cardType: payment.cardType,
              method: payment.method,
              processedAt: new Date(),
              reference: payment.reference,
              saleId: sale!.id,
              status: "completed",
              transactionId: payment.transactionId,
            });

            // Validate and redeem the gift card balance
            if (payment.method === "gift_card" && payment.giftCardNumber) {
              const [gc] = await tx
                .select()
                .from(giftCards)
                .where(
                  and(
                    eq(giftCards.cardNumber, payment.giftCardNumber),
                    eq(giftCards.isActive, true)
                  )
                )
                .limit(1);

              if (!gc) {
                throw new ORPCError("BAD_REQUEST", {
                  message: `Gift card ${payment.giftCardNumber} not found or inactive.`,
                });
              }
              if (gc.expiresAt && new Date() > gc.expiresAt) {
                throw new ORPCError("BAD_REQUEST", {
                  message: `Gift card ${payment.giftCardNumber} has expired.`,
                });
              }
              if (Number(gc.currentBalance) < Number(payment.amount)) {
                throw new ORPCError("BAD_REQUEST", {
                  message: `Gift card ${payment.giftCardNumber} has insufficient balance ($${Number(gc.currentBalance).toFixed(2)} available).`,
                });
              }

              const gcNewBalance = (
                Number(gc.currentBalance) - Number(payment.amount)
              ).toString();

              await tx
                .update(giftCards)
                .set({ currentBalance: gcNewBalance, updatedAt: new Date() })
                .where(eq(giftCards.id, gc.id));

              await tx.insert(giftCardTransactions).values({
                amount: payment.amount,
                balanceAfter: gcNewBalance,
                balanceBefore: gc.currentBalance,
                employeeId,
                giftCardId: gc.id,
                saleId: sale!.id,
                type: "redemption",
              });
            }
          }

          const storeCreditPayment = input.payments.find(
            (p) => p.method === "store_credit"
          );
          if (storeCreditPayment) {
            if (!input.customerId) {
              throw new ORPCError("BAD_REQUEST", {
                message: "A customer must be selected to use store credit.",
              });
            }
            const [cust] = await tx
              .select({ creditBalance: customers.creditBalance })
              .from(customers)
              .where(eq(customers.id, input.customerId));

            const creditUsed = Number(storeCreditPayment.amount);
            if (!cust || Number(cust.creditBalance) < creditUsed) {
              throw new ORPCError("BAD_REQUEST", {
                message: "Insufficient store credit balance.",
              });
            }
            await tx
              .update(customers)
              .set({
                creditBalance: sql`${customers.creditBalance} - ${creditUsed}`,
                updatedAt: new Date(),
              })
              .where(eq(customers.id, input.customerId));
          }

          // on_account: add unpaid amount to customer's dueBalance
          const onAccountPayments = input.payments.filter(
            (p) => p.method === "on_account"
          );
          if (onAccountPayments.length > 0) {
            if (!input.customerId) {
              throw new ORPCError("BAD_REQUEST", {
                message:
                  "A customer must be selected to use On Account payment.",
              });
            }
            const onAccountTotal = onAccountPayments.reduce(
              (s, p) => s + Number(p.amount),
              0
            );
            await tx
              .update(customers)
              .set({
                dueBalance: sql`${customers.dueBalance} + ${onAccountTotal}`,
                updatedAt: new Date(),
              })
              .where(eq(customers.id, input.customerId));
          }

          // dueCollection: reduce existing dueBalance (collecting outstanding debt)
          if (input.dueCollection) {
            if (!input.customerId) {
              throw new ORPCError("BAD_REQUEST", {
                message: "A customer must be selected to collect due.",
              });
            }
            const collectAmt = Number(input.dueCollection.amount);
            const [cust] = await tx
              .select({ dueBalance: customers.dueBalance })
              .from(customers)
              .where(eq(customers.id, input.customerId))
              .limit(1);
            if (!cust || Number(cust.dueBalance) < collectAmt) {
              throw new ORPCError("BAD_REQUEST", {
                message: "Collection amount exceeds outstanding balance.",
              });
            }
            await tx
              .update(customers)
              .set({
                dueBalance: sql`${customers.dueBalance} - ${collectAmt}`,
                updatedAt: new Date(),
              })
              .where(eq(customers.id, input.customerId));

            const [checkoutDcRow] = await tx
              .insert(dueCollections)
              .values({
                amount: input.dueCollection.amount,
                customerId: input.customerId,
                method: input.dueCollection.method,
                saleId: sale!.id,
              })
              .returning({ id: dueCollections.id });

            checkoutDueCollectionId = checkoutDcRow?.id ?? null;
          }

          if (input.customerId) {
            await tx
              .update(customers)
              .set({
                loyaltyPoints: sql`${customers.loyaltyPoints} + ${Math.floor(totalAmount)} - ${input.loyaltyPointsUsed}`,
                totalSpent: sql`${customers.totalSpent} + ${totalAmount}`,
                updatedAt: new Date(),
              })
              .where(eq(customers.id, input.customerId));
          }

          if (input.shiftId) {
            await tx
              .update(shifts)
              .set({
                totalSales: sql`${shifts.totalSales} + ${totalAmount}`,
                transactionCount: sql`${shifts.transactionCount} + 1`,
                updatedAt: new Date(),
              })
              .where(eq(shifts.id, input.shiftId));
          }

          return {
            checkoutDueCollectionId,
            discountAmount: input.discountAmount,
            dueCollection: input.dueCollection,
            payments: input.payments,
            sale,
            subtotal: subtotal.toString(),
            taxAmount: taxAmount.toString(),
          };
        });

        // Auto-post accounting journal entries outside the main transaction so
        // that a failure here (e.g. accounts not seeded) never rolls back the sale.
        try {
          await postSaleJournalEntry(
            db,
            {
              discountAmount: txResult.discountAmount,
              id: txResult.sale!.id,
              saleDate: txResult.sale!.saleDate,
              subtotal: txResult.subtotal,
              taxAmount: txResult.taxAmount,
            },
            txResult.payments.map((p) => ({
              amount: p.amount,
              method: p.method,
            })),
            context.session.user.id
          );
        } catch {
          // Accounting not configured — sale still succeeded
        }

        // Post a separate journal entry for any due collected at checkout
        // (DR Cash / CR Accounts Receivable) and link the JE id back to the
        // dueCollections record so voiding the JE can restore dueBalance.
        if (txResult.dueCollection && txResult.checkoutDueCollectionId) {
          try {
            const jeResult = await postDueCollectionJournalEntry(
              db,
              txResult.dueCollection,
              txResult.sale!.saleDate,
              context.session.user.id,
              txResult.sale!.id
            );
            if (jeResult) {
              await db
                .update(dueCollections)
                .set({ journalEntryId: jeResult.id })
                .where(eq(dueCollections.id, txResult.checkoutDueCollectionId));
            }
          } catch {
            // Accounting not configured — collection still succeeded
          }
        }

        return txResult.sale;
      }),

    get: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) => {
        const [sale] = await db
          .select({
            amountPaid: sales.amountPaid,
            changeGiven: sales.changeGiven,
            customer: {
              email: customers.email,
              firstName: customers.firstName,
              id: customers.id,
              lastName: customers.lastName,
              phone: customers.phone,
            },
            discountAmount: sales.discountAmount,
            employee: {
              firstName: employees.firstName,
              id: employees.id,
              lastName: employees.lastName,
            },
            id: sales.id,
            location: {
              id: locations.id,
              name: locations.name,
            },
            loyaltyPointsEarned: sales.loyaltyPointsEarned,
            loyaltyPointsUsed: sales.loyaltyPointsUsed,
            notes: sales.notes,
            receiptNumber: sales.receiptNumber,
            saleDate: sales.saleDate,
            status: sales.status,
            subtotal: sales.subtotal,
            taxAmount: sales.taxAmount,
            totalAmount: sales.totalAmount,
          })
          .from(sales)
          .leftJoin(customers, eq(sales.customerId, customers.id))
          .leftJoin(employees, eq(sales.employeeId, employees.id))
          .leftJoin(locations, eq(sales.locationId, locations.id))
          .where(eq(sales.id, input.id));

        if (!sale) {
          throw new ORPCError("NOT_FOUND", { message: "Sale not found" });
        }

        const items = await db
          .select({
            discountAmount: saleItems.discountAmount,
            id: saleItems.id,
            notes: saleItems.notes,
            product: {
              id: products.id,
              name: products.name,
              sku: products.sku,
            },
            quantity: saleItems.quantity,
            taxAmount: saleItems.taxAmount,
            totalPrice: saleItems.totalPrice,
            unitPrice: saleItems.unitPrice,
            variant: {
              id: productVariants.id,
              name: productVariants.name,
            },
          })
          .from(saleItems)
          .leftJoin(products, eq(saleItems.productId, products.id))
          .leftJoin(
            productVariants,
            eq(saleItems.variantId, productVariants.id)
          )
          .where(eq(saleItems.saleId, input.id));

        const paymentsData = await db
          .select()
          .from(payments)
          .where(eq(payments.saleId, input.id));

        return { ...sale, items, payments: paymentsData };
      }),

    list: protectedProcedure
      .input(
        paginationSchema.extend({
          customerId: z.string().uuid().optional(),
          dateRange: dateRangeSchema.optional(),
          employeeId: z.string().uuid().optional(),
          locationId: z.string().uuid().optional(),
        })
      )
      .handler(async ({ input }) => {
        const conditions = [eq(sales.status, "completed")];

        if (input.locationId) {
          conditions.push(eq(sales.locationId, input.locationId));
        }

        if (input.employeeId) {
          conditions.push(eq(sales.employeeId, input.employeeId));
        }

        if (input.customerId) {
          conditions.push(eq(sales.customerId, input.customerId));
        }

        if (input.dateRange) {
          conditions.push(gte(sales.saleDate, new Date(input.dateRange.from)));
          conditions.push(lte(sales.saleDate, new Date(input.dateRange.to)));
        }

        const [items, totalCountResult] = await Promise.all([
          db
            .select({
              customer: {
                firstName: customers.firstName,
                id: customers.id,
                lastName: customers.lastName,
              },
              discountAmount: sales.discountAmount,
              employee: {
                firstName: employees.firstName,
                id: employees.id,
                lastName: employees.lastName,
              },
              id: sales.id,
              location: {
                id: locations.id,
                name: locations.name,
              },
              receiptNumber: sales.receiptNumber,
              saleDate: sales.saleDate,
              status: sales.status,
              subtotal: sales.subtotal,
              taxAmount: sales.taxAmount,
              totalAmount: sales.totalAmount,
            })
            .from(sales)
            .leftJoin(customers, eq(sales.customerId, customers.id))
            .leftJoin(employees, eq(sales.employeeId, employees.id))
            .leftJoin(locations, eq(sales.locationId, locations.id))
            .where(and(...conditions))
            .limit(input.limit)
            .offset(input.offset)
            .orderBy(desc(sales.saleDate)),
          db
            .select({ count: sql<number>`count(*)` })
            .from(sales)
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
  },

  // Discounts
  discounts: {
    create: protectedProcedure
      .input(createDiscountSchema)
      .handler(async ({ input }) => {
        const [discount] = await db
          .insert(discounts)
          .values({
            ...input,
            applicableCategories: input.applicableCategories ?? null,
            applicableCustomerTypes: input.applicableCustomerTypes ?? null,
            applicableProducts: input.applicableProducts ?? null,
            validFrom: input.validFrom ? new Date(input.validFrom) : undefined,
            validUntil: input.validUntil
              ? new Date(input.validUntil)
              : undefined,
          })
          .returning();

        return discount;
      }),

    list: protectedProcedure
      .input(paginationSchema)
      .handler(async ({ input }) => {
        const [items, totalCountResult] = await Promise.all([
          db
            .select()
            .from(discounts)
            .where(eq(discounts.isActive, true))
            .limit(input.limit)
            .offset(input.offset)
            .orderBy(discounts.name),
          db
            .select({ count: sql<number>`count(*)` })
            .from(discounts)
            .where(eq(discounts.isActive, true)),
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

    update: protectedProcedure
      .input(updateDiscountSchema)
      .handler(async ({ input }) => {
        const { id, ...updateData } = input;

        const [discount] = await db
          .update(discounts)
          .set({
            ...updateData,
            applicableCategories: updateData.applicableCategories ?? null,
            applicableCustomerTypes: updateData.applicableCustomerTypes ?? null,
            applicableProducts: updateData.applicableProducts ?? null,
            updatedAt: new Date(),
            validFrom: updateData.validFrom
              ? new Date(updateData.validFrom)
              : undefined,
            validUntil: updateData.validUntil
              ? new Date(updateData.validUntil)
              : undefined,
          })
          .where(eq(discounts.id, id))
          .returning();

        if (!discount) {
          throw new ORPCError("NOT_FOUND", { message: "Discount not found" });
        }

        return discount;
      }),

    validate: protectedProcedure
      .input(validateDiscountSchema)
      .handler(async ({ input }) => {
        const [discount] = await db
          .select()
          .from(discounts)
          .where(
            and(eq(discounts.code, input.code), eq(discounts.isActive, true))
          );

        if (!discount) {
          throw new ORPCError("NOT_FOUND", {
            message: "Discount code not found",
          });
        }

        const now = new Date();
        if (discount.validFrom && now < discount.validFrom) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Discount not yet active",
          });
        }

        if (discount.validUntil && now > discount.validUntil) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Discount has expired",
          });
        }

        if (
          discount.usageLimit &&
          (discount.usageCount ?? 0) >= discount.usageLimit
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Discount usage limit reached",
          });
        }

        const subtotal = Number(input.subtotal);
        if (
          discount.minPurchaseAmount &&
          subtotal < Number(discount.minPurchaseAmount)
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message: `Minimum purchase amount of $${discount.minPurchaseAmount} required`,
          });
        }

        let discountAmount = 0;
        if (discount.type === "percentage") {
          discountAmount = subtotal * (Number(discount.value) / 100);
        } else if (discount.type === "fixed_amount") {
          discountAmount = Number(discount.value);
        }

        if (
          discount.maxDiscountAmount &&
          discountAmount > Number(discount.maxDiscountAmount)
        ) {
          discountAmount = Number(discount.maxDiscountAmount);
        }

        return {
          discount,
          discountAmount: discountAmount.toString(),
          isValid: true,
        };
      }),
  },

  // Returns
  returns: {
    create: protectedProcedure.input(createReturnSchema).handler(
      async ({ input, context }) =>
        await db.transaction(async (tx) => {
          const employeeId = await resolveEmployeeId(tx, context.session.user);
          const returnNumber = `RET-${Date.now()}`;

          const [originalSale] = await tx
            .select()
            .from(sales)
            .where(eq(sales.id, input.originalSaleId))
            .limit(1);

          if (!originalSale) {
            throw new ORPCError("NOT_FOUND", {
              message: "Original sale not found",
            });
          }

          let totalRefundAmount = 0;
          for (const item of input.items) {
            const [saleItem] = await tx
              .select()
              .from(saleItems)
              .where(eq(saleItems.id, item.saleItemId))
              .limit(1);

            if (saleItem) {
              const itemRefundAmount =
                Number(saleItem.unitPrice) * item.quantityReturned;
              totalRefundAmount += itemRefundAmount;
            }
          }

          totalRefundAmount -= Number(input.restockingFee);

          const [returnRecord] = await tx
            .insert(returns)
            .values({
              customerId: input.customerId,
              employeeId,
              locationId: input.locationId,
              notes: input.notes,
              originalSaleId: input.originalSaleId,
              reason: input.reason,
              restockingFee: input.restockingFee,
              returnNumber,
              status: "approved",
              totalRefundAmount: totalRefundAmount.toString(),
            })
            .returning();

          for (const item of input.items) {
            const [saleItem] = await tx
              .select()
              .from(saleItems)
              .where(eq(saleItems.id, item.saleItemId))
              .limit(1);

            if (!saleItem) {
              throw new ORPCError("NOT_FOUND", {
                message: `Sale item ${item.saleItemId} not found`,
              });
            }

            const refundAmount =
              Number(saleItem.unitPrice) * item.quantityReturned;

            await tx.insert(returnItems).values({
              condition: item.condition,
              productId: saleItem.productId,
              quantityReturned: item.quantityReturned,
              refundAmount: refundAmount.toString(),
              restockable: item.restockable,
              returnId: returnRecord!.id,
              saleItemId: item.saleItemId,
              unitPrice: saleItem.unitPrice,
              variantId: saleItem.variantId,
            });

            if (item.restockable) {
              const stockLevel = await tx
                .select()
                .from(stockLevels)
                .where(
                  and(
                    eq(stockLevels.productId, saleItem.productId),
                    saleItem.variantId
                      ? eq(stockLevels.variantId, saleItem.variantId)
                      : sql`${stockLevels.variantId} IS NULL`,
                    eq(stockLevels.locationId, input.locationId)
                  )
                )
                .limit(1);

              const currentQuantity = stockLevel[0]?.quantity ?? 0;
              const newQuantity = currentQuantity + item.quantityReturned;

              if (stockLevel.length > 0) {
                await tx
                  .update(stockLevels)
                  .set({
                    availableQuantity: newQuantity,
                    lastMovementAt: new Date(),
                    quantity: newQuantity,
                    updatedAt: new Date(),
                  })
                  .where(eq(stockLevels.id, stockLevel[0]!.id));
              } else {
                await tx.insert(stockLevels).values({
                  availableQuantity: newQuantity,
                  lastMovementAt: new Date(),
                  locationId: input.locationId,
                  productId: saleItem.productId,
                  quantity: newQuantity,
                  variantId: saleItem.variantId,
                });
              }

              await tx.insert(stockMovements).values({
                locationId: input.locationId,
                newQuantity,
                previousQuantity: currentQuantity,
                productId: saleItem.productId,
                quantity: item.quantityReturned,
                reason: "Product return",
                referenceId: returnRecord!.id,
                referenceType: "return",
                type: "return",
                userId: context.session.user.id,
                variantId: saleItem.variantId,
              });
            }
          }

          return returnRecord;
        })
    ),

    list: protectedProcedure
      .input(paginationSchema)
      .handler(async ({ input }) => {
        const [items, totalCountResult] = await Promise.all([
          db
            .select({
              customer: {
                firstName: customers.firstName,
                id: customers.id,
                lastName: customers.lastName,
              },
              employee: {
                firstName: employees.firstName,
                id: employees.id,
                lastName: employees.lastName,
              },
              id: returns.id,
              originalSale: {
                id: sales.id,
                receiptNumber: sales.receiptNumber,
              },
              reason: returns.reason,
              returnDate: returns.returnDate,
              returnNumber: returns.returnNumber,
              status: returns.status,
              totalRefundAmount: returns.totalRefundAmount,
            })
            .from(returns)
            .leftJoin(sales, eq(returns.originalSaleId, sales.id))
            .leftJoin(customers, eq(returns.customerId, customers.id))
            .leftJoin(employees, eq(returns.employeeId, employees.id))
            .limit(input.limit)
            .offset(input.offset)
            .orderBy(desc(returns.returnDate)),
          db.select({ count: sql<number>`count(*)` }).from(returns),
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
  },

  // Gift Cards
  giftCards: {
    list: protectedProcedure
      .input(paginationSchema)
      .handler(async ({ input }) => {
        const [items, totalCountResult] = await Promise.all([
          db
            .select({
              cardNumber: giftCards.cardNumber,
              createdAt: giftCards.createdAt,
              currentBalance: giftCards.currentBalance,
              customer: {
                firstName: customers.firstName,
                id: customers.id,
                lastName: customers.lastName,
              },
              expiresAt: giftCards.expiresAt,
              id: giftCards.id,
              initialAmount: giftCards.initialAmount,
              isActive: giftCards.isActive,
              notes: giftCards.notes,
              purchasedAt: giftCards.purchasedAt,
            })
            .from(giftCards)
            .leftJoin(customers, eq(giftCards.customerId, customers.id))
            .limit(input.limit)
            .offset(input.offset)
            .orderBy(desc(giftCards.createdAt)),
          db.select({ count: sql<number>`count(*)` }).from(giftCards),
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

    balance: protectedProcedure
      .input(z.object({ cardNumber: z.string() }))
      .handler(async ({ input }) => {
        const [giftCard] = await db
          .select()
          .from(giftCards)
          .where(
            and(
              eq(giftCards.cardNumber, input.cardNumber),
              eq(giftCards.isActive, true)
            )
          )
          .limit(1);

        if (!giftCard) {
          throw new ORPCError("NOT_FOUND", { message: "Gift card not found" });
        }

        if (giftCard.expiresAt && new Date() > giftCard.expiresAt) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Gift card has expired",
          });
        }

        return {
          cardNumber: giftCard.cardNumber,
          currentBalance: giftCard.currentBalance,
          expiresAt: giftCard.expiresAt,
        };
      }),

    create: protectedProcedure.input(createGiftCardSchema).handler(
      async ({ input, context }) =>
        await db.transaction(async (tx) => {
          const employeeId = await resolveEmployeeId(tx, context.session.user);
          const cardNumber = `GC-${Date.now()}`;

          const [giftCard] = await tx
            .insert(giftCards)
            .values({
              cardNumber,
              currentBalance: input.initialAmount,
              customerId: input.customerId,
              expiresAt: input.expiresAt
                ? new Date(input.expiresAt)
                : undefined,
              initialAmount: input.initialAmount,
              notes: input.notes,
              purchasedAt: new Date(),
              purchasedBy: input.customerId,
            })
            .returning();

          await tx.insert(giftCardTransactions).values({
            amount: input.initialAmount,
            balanceAfter: input.initialAmount,
            balanceBefore: "0",
            employeeId,
            giftCardId: giftCard!.id,
            type: "purchase",
          });

          return giftCard;
        })
    ),
  },

  // Analytics & Reports
  analytics: {
    salesSummary: protectedProcedure
      .input(
        dateRangeSchema.extend({ locationId: z.string().uuid().optional() })
      )
      .handler(async ({ input }) => {
        const conditions = [
          eq(sales.status, "completed"),
          gte(sales.saleDate, new Date(input.from)),
          lte(sales.saleDate, new Date(input.to)),
        ];

        if (input.locationId) {
          conditions.push(eq(sales.locationId, input.locationId));
        }

        const [summary] = await db
          .select({
            averageTransactionValue: sql<number>`avg(${sales.totalAmount})`,
            totalDiscount: sum(sales.discountAmount),
            totalSales: sum(sales.totalAmount),
            totalTax: sum(sales.taxAmount),
            totalTransactions: sql<number>`count(*)`,
          })
          .from(sales)
          .where(and(...conditions));

        return summary;
      }),

    topProducts: protectedProcedure
      .input(
        dateRangeSchema.extend({
          limit: z.number().int().min(1).max(50).default(10),
          locationId: z.string().uuid().optional(),
        })
      )
      .handler(async ({ input }) => {
        const conditions = [
          eq(sales.status, "completed"),
          gte(sales.saleDate, new Date(input.from)),
          lte(sales.saleDate, new Date(input.to)),
        ];

        if (input.locationId) {
          conditions.push(eq(sales.locationId, input.locationId));
        }

        const topProducts = await db
          .select({
            productId: saleItems.productId,
            productName: products.name,
            productSku: products.sku,
            totalQuantitySold: sum(saleItems.quantity),
            totalRevenue: sum(saleItems.totalPrice),
          })
          .from(saleItems)
          .innerJoin(sales, eq(saleItems.saleId, sales.id))
          .innerJoin(products, eq(saleItems.productId, products.id))
          .where(and(...conditions))
          .groupBy(saleItems.productId, products.name, products.sku)
          .orderBy(desc(sum(saleItems.quantity)))
          .limit(input.limit);

        return topProducts;
      }),

    salesByDay: protectedProcedure
      .input(
        dateRangeSchema.extend({ locationId: z.string().uuid().optional() })
      )
      .handler(async ({ input }) => {
        const conditions = [
          eq(sales.status, "completed"),
          gte(sales.saleDate, new Date(input.from)),
          lte(sales.saleDate, new Date(input.to)),
        ];

        if (input.locationId) {
          conditions.push(eq(sales.locationId, input.locationId));
        }

        return db
          .select({
            date: sql<string>`DATE(${sales.saleDate})`,
            totalSales: sum(sales.totalAmount),
            totalTransactions: sql<number>`count(*)`,
          })
          .from(sales)
          .where(and(...conditions))
          .groupBy(sql`DATE(${sales.saleDate})`)
          .orderBy(sql`DATE(${sales.saleDate})`);
      }),

    salesByPaymentMethod: protectedProcedure
      .input(
        dateRangeSchema.extend({ locationId: z.string().uuid().optional() })
      )
      .handler(async ({ input }) => {
        const conditions = [
          eq(sales.status, "completed"),
          gte(sales.saleDate, new Date(input.from)),
          lte(sales.saleDate, new Date(input.to)),
        ];

        if (input.locationId) {
          conditions.push(eq(sales.locationId, input.locationId));
        }

        return db
          .select({
            method: payments.method,
            totalAmount: sum(payments.amount),
            transactionCount: sql<number>`count(*)`,
          })
          .from(payments)
          .innerJoin(sales, eq(payments.saleId, sales.id))
          .where(and(...conditions))
          .groupBy(payments.method)
          .orderBy(desc(sum(payments.amount)));
      }),
  },
};
