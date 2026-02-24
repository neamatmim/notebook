import { db } from "@notebook/db";
import {
  categories,
  costLayers,
  cycleCountLines,
  cycleCounts,
  inventoryAuditLog,
  inventorySettings,
  locations,
  poPayments,
  products,
  productVariants,
  purchaseOrderItems,
  purchaseOrders,
  stockLevels,
  stockMovements,
  suppliers,
} from "@notebook/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, inArray, isNull, sql, sum } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import {
  makeEntryNumber,
  postInventoryVarianceJournalEntry,
  postPurchasePaymentJournalEntry,
  postPurchaseReceiptJournalEntry,
} from "./accounting";

function resolvePaymentStatus(
  paymentStatus: "unpaid" | "partially_paid" | "paid" | "overdue" | null,
  paymentDueDate: Date | null
): "unpaid" | "partially_paid" | "paid" | "overdue" {
  const status = paymentStatus ?? "unpaid";
  if (
    status === "unpaid" &&
    paymentDueDate &&
    new Date(paymentDueDate) < new Date()
  ) {
    return "overdue";
  }
  return status;
}

function computePaymentDueDate(
  orderDate: Date,
  paymentTermsDays: number | null | undefined
): Date | undefined {
  if (
    paymentTermsDays === null ||
    paymentTermsDays === undefined ||
    paymentTermsDays < 0
  ) {
    return undefined;
  }
  if (paymentTermsDays === 0) {
    return orderDate;
  }
  const due = new Date(orderDate);
  due.setDate(due.getDate() + paymentTermsDays);
  return due;
}

const createCategorySchema = z.object({
  description: z.string().optional(),
  name: z.string().min(1),
  parentId: z.string().uuid().optional(),
});

const updateCategorySchema = createCategorySchema.partial();

const createSupplierSchema = z.object({
  address: z.string().optional(),
  city: z.string().optional(),
  contactName: z.string().optional(),
  country: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().min(1),
  notes: z.string().optional(),
  paymentTerms: z.string().optional(),
  paymentTermsDays: z.number().int().min(0).optional(),
  phone: z.string().optional(),
  state: z.string().optional(),
  taxId: z.string().optional(),
  zipCode: z.string().optional(),
});

const updateSupplierSchema = createSupplierSchema.partial().extend({
  status: z.enum(["active", "inactive", "suspended"]).optional(),
});

const createProductSchema = z.object({
  barcode: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  costPrice: z.string().optional(),
  description: z.string().optional(),
  dimensions: z.string().optional(),
  imageUrl: z.string().url().optional(),
  maxStockLevel: z.number().int().min(0).optional(),
  minStockLevel: z.number().int().min(0).default(0),
  msrp: z.string().optional(),
  name: z.string().min(1),
  notes: z.string().optional(),
  reorderPoint: z.number().int().min(0).optional(),
  reorderQuantity: z.number().int().min(1).optional(),
  sellingPrice: z.string().optional(),
  sku: z.string().min(1),
  supplierId: z.string().uuid().optional(),
  tags: z.string().optional(),
  taxRate: z.string().optional(),
  taxable: z.boolean().default(true),
  unit: z.string().default("pcs"),
  weight: z.string().optional(),
});

const updateProductSchema = createProductSchema.partial().extend({
  id: z.string().uuid(),
});

const createVariantSchema = z.object({
  attributeType: z.string().optional(),
  attributeValue: z.string().optional(),
  barcode: z.string().optional(),
  costPrice: z.string().optional(),
  name: z.string().min(1),
  productId: z.string().uuid(),
  sellingPrice: z.string().optional(),
  sku: z.string().min(1),
});

const updateVariantSchema = createVariantSchema.partial().extend({
  id: z.string().uuid(),
});

const createLocationSchema = z.object({
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  isPrimary: z.boolean().default(false),
  name: z.string().min(1),
  state: z.string().optional(),
  type: z.string().min(1),
  zipCode: z.string().optional(),
});

const updateLocationSchema = createLocationSchema.partial().extend({
  id: z.string().uuid(),
});

const stockAdjustmentSchema = z.object({
  locationId: z.string().uuid().optional(),
  notes: z.string().optional(),
  productId: z.string().uuid(),
  quantity: z.number().int(),
  reason: z.string().min(1),
  variantId: z.string().uuid().optional(),
});

const createPurchaseOrderSchema = z.object({
  expectedDate: z.string().datetime().optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().min(1),
      unitCost: z.string(),
      variantId: z.string().uuid().optional(),
    })
  ),
  notes: z.string().optional(),
  supplierId: z.string().uuid(),
});

const receivePurchaseOrderSchema = z.object({
  items: z.array(
    z.object({
      expirationDate: z.string().datetime().optional(),
      itemId: z.string().uuid(),
      lotNumber: z.string().min(1).optional(),
      receivedQuantity: z.number().int().min(0),
    })
  ),
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

export const inventoryRouter = {
  // Categories
  categories: {
    create: protectedProcedure
      .input(createCategorySchema)
      .handler(async ({ input }) => {
        if (input.parentId) {
          // Detect circular reference before insert
          const visited = new Set<string>();
          let currentId: string | null | undefined = input.parentId;
          while (currentId) {
            if (visited.has(currentId)) {
              break;
            }
            visited.add(currentId);
            const [parent] = await db
              .select({ parentId: categories.parentId })
              .from(categories)
              .where(eq(categories.id, currentId))
              .limit(1);
            currentId = parent?.parentId;
          }
          // (New category has no ID yet, so no cycle possible on create)
        }

        const [category] = await db
          .insert(categories)
          .values(input)
          .returning();

        return category;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) => {
        const [category] = await db
          .update(categories)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(categories.id, input.id))
          .returning();

        if (!category) {
          throw new ORPCError("NOT_FOUND", { message: "Category not found" });
        }

        return { success: true };
      }),

    list: protectedProcedure
      .input(paginationSchema)
      .handler(async ({ input }) => {
        const [items, totalCountResult] = await Promise.all([
          db
            .select()
            .from(categories)
            .where(eq(categories.isActive, true))
            .limit(input.limit)
            .offset(input.offset)
            .orderBy(categories.name),
          db
            .select({ count: sql<number>`count(*)` })
            .from(categories)
            .where(eq(categories.isActive, true)),
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
      .input(updateCategorySchema.extend({ id: z.string().uuid() }))
      .handler(async ({ input }) => {
        const { id, ...updateData } = input;

        if (input.parentId) {
          if (input.parentId === id) {
            throw new ORPCError("BAD_REQUEST", {
              message: "A category cannot be its own parent",
            });
          }
          // Walk up from proposed parent — if we reach this category, it's a cycle
          const visited = new Set<string>();
          let currentId: string | null | undefined = input.parentId;
          while (currentId) {
            if (currentId === id) {
              throw new ORPCError("BAD_REQUEST", {
                message:
                  "Setting this parent would create a circular reference",
              });
            }
            if (visited.has(currentId)) {
              break;
            }
            visited.add(currentId);
            const [parent] = await db
              .select({ parentId: categories.parentId })
              .from(categories)
              .where(eq(categories.id, currentId))
              .limit(1);
            currentId = parent?.parentId;
          }
        }

        const [category] = await db
          .update(categories)
          .set({ ...updateData, updatedAt: new Date() })
          .where(eq(categories.id, id))
          .returning();

        if (!category) {
          throw new ORPCError("NOT_FOUND", { message: "Category not found" });
        }

        return category;
      }),
  },

  // Suppliers
  suppliers: {
    create: protectedProcedure
      .input(createSupplierSchema)
      .handler(async ({ input }) => {
        const [supplier] = await db.insert(suppliers).values(input).returning();

        return supplier;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) => {
        const [supplier] = await db
          .update(suppliers)
          .set({ status: "inactive", updatedAt: new Date() })
          .where(eq(suppliers.id, input.id))
          .returning();

        if (!supplier) {
          throw new ORPCError("NOT_FOUND", { message: "Supplier not found" });
        }

        return { success: true };
      }),

    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
          status: z.enum(["active", "inactive", "suspended"]).optional(),
        })
      )
      .handler(async ({ input }) => {
        // Default to showing active + suspended (not inactive/deleted) so
        // users can see suspended suppliers. Pass status explicitly to filter.
        const statusFilter = input.status
          ? eq(suppliers.status, input.status)
          : inArray(suppliers.status, ["active", "suspended"]);

        const [items, totalCountResult] = await Promise.all([
          db
            .select()
            .from(suppliers)
            .where(statusFilter)
            .limit(input.limit)
            .offset(input.offset)
            .orderBy(suppliers.name),
          db
            .select({ count: sql<number>`count(*)` })
            .from(suppliers)
            .where(statusFilter),
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
      .input(updateSupplierSchema.extend({ id: z.string().uuid() }))
      .handler(async ({ input }) => {
        const { id, ...updateData } = input;

        const [supplier] = await db
          .update(suppliers)
          .set({ ...updateData, updatedAt: new Date() })
          .where(eq(suppliers.id, id))
          .returning();

        if (!supplier) {
          throw new ORPCError("NOT_FOUND", { message: "Supplier not found" });
        }

        return supplier;
      }),
  },

  // Products
  products: {
    create: protectedProcedure
      .input(createProductSchema)
      .handler(async ({ input }) => {
        const [product] = await db.insert(products).values(input).returning();
        return product;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) => {
        const [product] = await db
          .update(products)
          .set({ status: "inactive", updatedAt: new Date() })
          .where(eq(products.id, input.id))
          .returning();

        if (!product) {
          throw new ORPCError("NOT_FOUND", { message: "Product not found" });
        }

        return { success: true };
      }),

    get: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) => {
        const [product] = await db
          .select({
            barcode: products.barcode,
            category: {
              id: categories.id,
              name: categories.name,
            },
            costPrice: products.costPrice,
            createdAt: products.createdAt,
            description: products.description,
            dimensions: products.dimensions,
            id: products.id,
            imageUrl: products.imageUrl,
            maxStockLevel: products.maxStockLevel,
            minStockLevel: products.minStockLevel,
            msrp: products.msrp,
            name: products.name,
            notes: products.notes,
            reorderPoint: products.reorderPoint,
            reorderQuantity: products.reorderQuantity,
            sellingPrice: products.sellingPrice,
            sku: products.sku,
            status: products.status,
            supplier: {
              id: suppliers.id,
              name: suppliers.name,
            },
            tags: products.tags,
            taxRate: products.taxRate,
            taxable: products.taxable,
            unit: products.unit,
            updatedAt: products.updatedAt,
            weight: products.weight,
          })
          .from(products)
          .leftJoin(categories, eq(products.categoryId, categories.id))
          .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
          .where(eq(products.id, input.id));

        if (!product) {
          throw new ORPCError("NOT_FOUND", { message: "Product not found" });
        }

        return product;
      }),

    list: protectedProcedure.input(searchSchema).handler(async ({ input }) => {
      const conditions = [eq(products.status, "active")];

      if (input.query) {
        conditions.push(
          sql`${products.name} ILIKE ${`%${input.query}%`} OR ${products.sku} ILIKE ${`%${input.query}%`}`
        );
      }

      const [items, totalCountResult] = await Promise.all([
        db
          .select({
            barcode: products.barcode,
            category: {
              id: categories.id,
              name: categories.name,
            },
            costPrice: products.costPrice,
            description: products.description,
            id: products.id,
            minStockLevel: products.minStockLevel,
            name: products.name,
            reorderPoint: products.reorderPoint,
            sellingPrice: products.sellingPrice,
            sku: products.sku,
            status: products.status,
            supplier: {
              id: suppliers.id,
              name: suppliers.name,
            },
            variantCount: sql<number>`(
              SELECT COUNT(*) FROM product_variants
              WHERE product_id = ${products.id} AND is_active = true
            )`,
          })
          .from(products)
          .leftJoin(categories, eq(products.categoryId, categories.id))
          .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
          .where(and(...conditions))
          .limit(input.limit)
          .offset(input.offset)
          .orderBy(products.name),
        db
          .select({ count: sql<number>`count(*)` })
          .from(products)
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

    stock: protectedProcedure
      .input(z.object({ productId: z.string().uuid() }))
      .handler(async ({ input }) => {
        const stockData = await db
          .select({
            availableQuantity: stockLevels.availableQuantity,
            locationId: stockLevels.locationId,
            locationName: locations.name,
            quantity: stockLevels.quantity,
            reservedQuantity: stockLevels.reservedQuantity,
            variantId: stockLevels.variantId,
            variantName: productVariants.name,
          })
          .from(stockLevels)
          .leftJoin(locations, eq(stockLevels.locationId, locations.id))
          .leftJoin(
            productVariants,
            eq(stockLevels.variantId, productVariants.id)
          )
          .where(eq(stockLevels.productId, input.productId));

        return stockData;
      }),

    update: protectedProcedure
      .input(updateProductSchema)
      .handler(async ({ input }) => {
        const { id, ...updateData } = input;

        const [product] = await db
          .update(products)
          .set({ ...updateData, updatedAt: new Date() })
          .where(eq(products.id, id))
          .returning();

        if (!product) {
          throw new ORPCError("NOT_FOUND", { message: "Product not found" });
        }

        return product;
      }),

    variants: {
      create: protectedProcedure
        .input(createVariantSchema)
        .handler(async ({ input }) => {
          const [variant] = await db
            .insert(productVariants)
            .values(input)
            .returning();
          return variant;
        }),

      delete: protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .handler(async ({ input }) => {
          const [variant] = await db
            .update(productVariants)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(productVariants.id, input.id))
            .returning();

          if (!variant) {
            throw new ORPCError("NOT_FOUND", { message: "Variant not found" });
          }

          return { success: true };
        }),

      list: protectedProcedure
        .input(z.object({ productId: z.string().uuid() }))
        .handler(async ({ input }) => {
          const variants = await db
            .select()
            .from(productVariants)
            .where(
              and(
                eq(productVariants.productId, input.productId),
                eq(productVariants.isActive, true)
              )
            )
            .orderBy(productVariants.name);

          return variants;
        }),

      update: protectedProcedure
        .input(updateVariantSchema)
        .handler(async ({ input }) => {
          const { id, ...updateData } = input;

          const [variant] = await db
            .update(productVariants)
            .set({ ...updateData, updatedAt: new Date() })
            .where(eq(productVariants.id, id))
            .returning();

          if (!variant) {
            throw new ORPCError("NOT_FOUND", { message: "Variant not found" });
          }

          return variant;
        }),

      listAll: protectedProcedure
        .input(
          z.object({
            limit: z.number().int().min(1).max(100).default(20),
            offset: z.number().int().min(0).default(0),
            productId: z.string().uuid().optional(),
          })
        )
        .handler(async ({ input }) => {
          const conditions = [eq(productVariants.isActive, true)];
          if (input.productId) {
            conditions.push(eq(productVariants.productId, input.productId));
          }

          const [items, countResult] = await Promise.all([
            db
              .select({
                attributeType: productVariants.attributeType,
                attributeValue: productVariants.attributeValue,
                barcode: productVariants.barcode,
                costPrice: productVariants.costPrice,
                id: productVariants.id,
                name: productVariants.name,
                productId: productVariants.productId,
                productName: products.name,
                sellingPrice: productVariants.sellingPrice,
                sku: productVariants.sku,
                stockQuantity: productVariants.stockQuantity,
              })
              .from(productVariants)
              .innerJoin(products, eq(productVariants.productId, products.id))
              .where(and(...conditions))
              .orderBy(products.name, productVariants.name)
              .limit(input.limit)
              .offset(input.offset),
            db
              .select({ count: sql<number>`count(*)` })
              .from(productVariants)
              .where(and(...conditions)),
          ]);

          return {
            items,
            pagination: {
              limit: input.limit,
              offset: input.offset,
              total: Number(countResult[0]?.count ?? 0),
            },
          };
        }),
    },
  },

  // Locations
  locations: {
    create: protectedProcedure
      .input(createLocationSchema)
      .handler(async ({ input }) => {
        const [location] = await db.insert(locations).values(input).returning();
        return location;
      }),

    list: protectedProcedure
      .input(
        z
          .object({
            limit: z.number().int().min(1).max(500).default(200),
            offset: z.number().int().min(0).default(0),
          })
          .optional()
      )
      .handler(async ({ input }) => {
        const limit = input?.limit ?? 200;
        const offset = input?.offset ?? 0;

        const locations_data = await db
          .select()
          .from(locations)
          .where(eq(locations.isActive, true))
          .orderBy(locations.name)
          .limit(limit)
          .offset(offset);

        return locations_data;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) => {
        const [location] = await db
          .update(locations)
          .set({ isActive: false, updatedAt: new Date() })
          .where(and(eq(locations.id, input.id), eq(locations.isActive, true)))
          .returning();

        if (!location) {
          throw new ORPCError("NOT_FOUND", { message: "Location not found" });
        }

        return location;
      }),

    update: protectedProcedure
      .input(updateLocationSchema)
      .handler(async ({ input }) => {
        const { id, ...updateData } = input;

        const [location] = await db
          .update(locations)
          .set({ ...updateData, updatedAt: new Date() })
          .where(eq(locations.id, id))
          .returning();

        if (!location) {
          throw new ORPCError("NOT_FOUND", { message: "Location not found" });
        }

        return location;
      }),
  },

  // Inventory Settings
  settings: {
    get: protectedProcedure.handler(async () => {
      const [row] = await db
        .select()
        .from(inventorySettings)
        .where(eq(inventorySettings.id, "default"))
        .limit(1);
      return row ?? { costUpdateMethod: "none" as const, id: "default" };
    }),

    update: protectedProcedure
      .input(
        z.object({
          costUpdateMethod: z.enum([
            "none",
            "last_cost",
            "weighted_average",
            "fifo",
          ]),
        })
      )
      .handler(async ({ input }) => {
        const [row] = await db
          .insert(inventorySettings)
          .values({ costUpdateMethod: input.costUpdateMethod, id: "default" })
          .onConflictDoUpdate({
            set: {
              costUpdateMethod: input.costUpdateMethod,
              updatedAt: new Date(),
            },
            target: inventorySettings.id,
          })
          .returning();
        return row;
      }),
  },

  // Stock Management
  stock: {
    adjust: protectedProcedure
      .input(stockAdjustmentSchema)
      .handler(async ({ input, context }) => {
        const adjustDate = new Date();

        const { newQuantity, movementId, unitCost } = await db.transaction(
          async (tx) => {
            const stockLevel = await tx
              .select()
              .from(stockLevels)
              .where(
                and(
                  eq(stockLevels.productId, input.productId),
                  input.variantId
                    ? eq(stockLevels.variantId, input.variantId)
                    : sql`${stockLevels.variantId} IS NULL`,
                  input.locationId
                    ? eq(stockLevels.locationId, input.locationId)
                    : sql`${stockLevels.locationId} IS NULL`
                )
              )
              .limit(1)
              .for("update");

            const currentQuantity = stockLevel[0]?.quantity ?? 0;
            const newQty = Math.max(0, currentQuantity + input.quantity);
            const reservedQty = stockLevel[0]?.reservedQuantity ?? 0;

            if (stockLevel.length > 0) {
              await tx
                .update(stockLevels)
                .set({
                  availableQuantity: Math.max(0, newQty - reservedQty),
                  lastMovementAt: adjustDate,
                  quantity: newQty,
                  updatedAt: adjustDate,
                })
                .where(eq(stockLevels.id, stockLevel[0]!.id));
            } else {
              await tx.insert(stockLevels).values({
                availableQuantity: newQty,
                lastMovementAt: adjustDate,
                locationId: input.locationId,
                productId: input.productId,
                quantity: newQty,
                variantId: input.variantId,
              });
            }

            const [movement] = await tx
              .insert(stockMovements)
              .values({
                locationId: input.locationId,
                newQuantity: newQty,
                notes: input.notes,
                previousQuantity: currentQuantity,
                productId: input.productId,
                quantity: input.quantity,
                reason: input.reason,
                type: "adjustment",
                userId: context.session.user.id,
                variantId: input.variantId,
              })
              .returning({ id: stockMovements.id });

            // Sync variant stockQuantity denorm
            if (input.variantId) {
              const [totals] = await tx
                .select({ total: sum(stockLevels.quantity) })
                .from(stockLevels)
                .where(eq(stockLevels.variantId, input.variantId));
              await tx
                .update(productVariants)
                .set({
                  stockQuantity: Number(totals?.total ?? 0),
                  updatedAt: adjustDate,
                })
                .where(eq(productVariants.id, input.variantId));
            }

            // Look up cost price to value the variance JE
            let cost = 0;
            if (input.variantId) {
              const [v] = await tx
                .select({ costPrice: productVariants.costPrice })
                .from(productVariants)
                .where(eq(productVariants.id, input.variantId))
                .limit(1);
              cost = Number(v?.costPrice ?? 0);
            } else {
              const [p] = await tx
                .select({ costPrice: products.costPrice })
                .from(products)
                .where(eq(products.id, input.productId))
                .limit(1);
              cost = Number(p?.costPrice ?? 0);
            }

            return {
              movementId: movement!.id,
              newQuantity: newQty,
              unitCost: cost,
            };
          }
        );

        // Post inventory variance journal entry outside transaction
        try {
          await postInventoryVarianceJournalEntry(
            db,
            {
              date: adjustDate,
              quantity: input.quantity,
              referenceId: movementId,
              unitCost,
            },
            context.session.user.id
          );
        } catch {
          // Accounting not configured — adjustment still succeeded
        }

        return { newQuantity, success: true };
      }),

    markDamaged: protectedProcedure
      .input(
        z.object({
          locationId: z.string().uuid().optional(),
          notes: z.string().optional(),
          productId: z.string().uuid(),
          quantity: z.number().int().min(1),
          reason: z.string().optional(),
          variantId: z.string().uuid().optional(),
        })
      )
      .handler(async ({ input, context }) => {
        const damagedDate = new Date();

        const { newQuantity, movementId, unitCost } = await db.transaction(
          async (tx) => {
            const [stockLevel] = await tx
              .select()
              .from(stockLevels)
              .where(
                and(
                  eq(stockLevels.productId, input.productId),
                  input.variantId
                    ? eq(stockLevels.variantId, input.variantId)
                    : sql`${stockLevels.variantId} IS NULL`,
                  input.locationId
                    ? eq(stockLevels.locationId, input.locationId)
                    : sql`${stockLevels.locationId} IS NULL`
                )
              )
              .limit(1)
              .for("update");

            const currentQty = stockLevel?.quantity ?? 0;
            if (currentQty < input.quantity) {
              throw new ORPCError("BAD_REQUEST", {
                message: `Insufficient stock to mark as damaged (available: ${currentQty})`,
              });
            }

            const newQty = currentQty - input.quantity;
            const reservedQty = stockLevel?.reservedQuantity ?? 0;

            if (stockLevel) {
              await tx
                .update(stockLevels)
                .set({
                  availableQuantity: Math.max(0, newQty - reservedQty),
                  lastMovementAt: damagedDate,
                  quantity: newQty,
                  updatedAt: damagedDate,
                })
                .where(eq(stockLevels.id, stockLevel.id));
            } else {
              await tx.insert(stockLevels).values({
                availableQuantity: 0,
                lastMovementAt: damagedDate,
                locationId: input.locationId,
                productId: input.productId,
                quantity: 0,
                variantId: input.variantId,
              });
            }

            // Consume FIFO cost layers
            let remaining = input.quantity;
            const layers = await tx
              .select()
              .from(costLayers)
              .where(
                and(
                  eq(costLayers.productId, input.productId),
                  input.variantId
                    ? eq(costLayers.variantId, input.variantId)
                    : sql`${costLayers.variantId} IS NULL`,
                  input.locationId
                    ? eq(costLayers.locationId, input.locationId)
                    : sql`${costLayers.locationId} IS NULL`,
                  sql`${costLayers.remainingQuantity} > 0`
                )
              )
              .orderBy(asc(costLayers.receivedAt));

            let weightedCost = 0;
            let totalConsumed = 0;
            for (const layer of layers) {
              if (remaining <= 0) {
                break;
              }
              const consume = Math.min(remaining, layer.remainingQuantity);
              await tx
                .update(costLayers)
                .set({ remainingQuantity: layer.remainingQuantity - consume })
                .where(eq(costLayers.id, layer.id));
              weightedCost += consume * Number(layer.unitCost);
              totalConsumed += consume;
              remaining -= consume;
            }

            const avgUnitCost =
              totalConsumed > 0 ? weightedCost / totalConsumed : 0;

            const [movement] = await tx
              .insert(stockMovements)
              .values({
                locationId: input.locationId,
                newQuantity: newQty,
                notes: input.notes,
                previousQuantity: currentQty,
                productId: input.productId,
                quantity: -input.quantity,
                reason: input.reason ?? "Damaged goods",
                type: "damaged",
                unitCost: avgUnitCost.toFixed(2),
                userId: context.session.user.id,
                variantId: input.variantId,
              })
              .returning({ id: stockMovements.id });

            if (input.variantId) {
              const [totals] = await tx
                .select({ total: sum(stockLevels.quantity) })
                .from(stockLevels)
                .where(eq(stockLevels.variantId, input.variantId));
              await tx
                .update(productVariants)
                .set({
                  stockQuantity: Number(totals?.total ?? 0),
                  updatedAt: damagedDate,
                })
                .where(eq(productVariants.id, input.variantId));
            }

            return {
              movementId: movement!.id,
              newQuantity: newQty,
              unitCost: avgUnitCost,
            };
          }
        );

        try {
          await postInventoryVarianceJournalEntry(
            db,
            {
              date: damagedDate,
              quantity: -input.quantity,
              referenceId: movementId,
              unitCost,
            },
            context.session.user.id
          );
        } catch {
          // Accounting not configured — damaged write-off still succeeded
        }

        return { newQuantity, success: true };
      }),

    movements: protectedProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(100).default(20),
          locationId: z.string().uuid().optional(),
          offset: z.number().int().min(0).default(0),
          productId: z.string().uuid().optional(),
          type: z
            .enum([
              "adjustment",
              "cycle_count",
              "damaged",
              "expired",
              "purchase",
              "return",
              "sale",
              "transfer",
            ])
            .optional(),
        })
      )
      .handler(async ({ input }) => {
        const conditions = [];

        if (input.productId) {
          conditions.push(eq(stockMovements.productId, input.productId));
        }

        if (input.locationId) {
          conditions.push(eq(stockMovements.locationId, input.locationId));
        }

        if (input.type) {
          conditions.push(eq(stockMovements.type, input.type));
        }

        const [items, totalCountResult] = await Promise.all([
          db
            .select({
              createdAt: stockMovements.createdAt,
              id: stockMovements.id,
              location: {
                id: locations.id,
                name: locations.name,
              },
              newQuantity: stockMovements.newQuantity,
              notes: stockMovements.notes,
              previousQuantity: stockMovements.previousQuantity,
              product: {
                id: products.id,
                name: products.name,
                sku: products.sku,
              },
              quantity: stockMovements.quantity,
              reason: stockMovements.reason,
              type: stockMovements.type,
              variant: {
                id: productVariants.id,
                name: productVariants.name,
              },
            })
            .from(stockMovements)
            .leftJoin(products, eq(stockMovements.productId, products.id))
            .leftJoin(locations, eq(stockMovements.locationId, locations.id))
            .leftJoin(
              productVariants,
              eq(stockMovements.variantId, productVariants.id)
            )
            .where(and(...conditions))
            .limit(input.limit)
            .offset(input.offset)
            .orderBy(desc(stockMovements.createdAt)),
          db
            .select({ count: sql<number>`count(*)` })
            .from(stockMovements)
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

    lowStock: protectedProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(200).default(50),
          locationId: z.string().uuid().optional(),
          offset: z.number().int().min(0).default(0),
        })
      )
      .handler(async ({ input }) => {
        // Compare stock per (product × location) row against the product's
        // reorderPoint. This surfaces per-location shortfalls even when the
        // product is well-stocked at other locations.
        const whereClause = and(
          eq(products.status, "active"),
          sql`${products.reorderPoint} IS NOT NULL`,
          sql`${stockLevels.quantity} < ${products.reorderPoint}`,
          input.locationId
            ? eq(stockLevels.locationId, input.locationId)
            : undefined
        );

        const [items, countResult] = await Promise.all([
          db
            .select({
              costPrice: products.costPrice,
              id: products.id,
              locationId: stockLevels.locationId,
              locationName: locations.name,
              minStockLevel: products.minStockLevel,
              name: products.name,
              reorderPoint: products.reorderPoint,
              reorderQuantity: products.reorderQuantity,
              sku: products.sku,
              stockLevelId: stockLevels.id,
              totalStock: stockLevels.quantity,
            })
            .from(products)
            .innerJoin(stockLevels, eq(stockLevels.productId, products.id))
            .leftJoin(locations, eq(stockLevels.locationId, locations.id))
            .where(whereClause)
            .orderBy(asc(products.name), asc(locations.name))
            .limit(input.limit)
            .offset(input.offset),
          db
            .select({ count: sql<number>`count(*)` })
            .from(products)
            .innerJoin(stockLevels, eq(stockLevels.productId, products.id))
            .where(whereClause),
        ]);

        return { items, total: countResult[0]?.count ?? 0 };
      }),

    checkReorders: protectedProcedure
      .input(z.void())
      .handler(async ({ context }) => {
        // Find all (product × location) rows below reorder point
        const lowStockRows = await db
          .select({
            costPrice: products.costPrice,
            locationId: stockLevels.locationId,
            productId: products.id,
            productName: products.name,
            reorderPoint: products.reorderPoint,
            reorderQuantity: products.reorderQuantity,
            sku: products.sku,
            supplierId: products.supplierId,
            totalStock: stockLevels.quantity,
          })
          .from(products)
          .innerJoin(stockLevels, eq(stockLevels.productId, products.id))
          .where(
            and(
              eq(products.status, "active"),
              sql`${products.reorderPoint} IS NOT NULL`,
              sql`${stockLevels.quantity} <= ${products.reorderPoint}`,
              sql`${products.supplierId} IS NOT NULL`
            )
          );

        if (lowStockRows.length === 0) {
          return { created: 0, lowStockCount: 0, skipped: 0 };
        }

        // Find product IDs that already have an open PO
        const openPOItems = await db
          .select({ productId: purchaseOrderItems.productId })
          .from(purchaseOrders)
          .innerJoin(
            purchaseOrderItems,
            eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id)
          )
          .where(
            and(
              isNull(purchaseOrders.deletedAt),
              inArray(purchaseOrders.status, [
                "draft",
                "pending",
                "approved",
                "ordered",
              ])
            )
          );

        const openProductIds = new Set(openPOItems.map((r) => r.productId));

        let created = 0;
        let skipped = 0;

        for (const row of lowStockRows) {
          if (openProductIds.has(row.productId)) {
            skipped += 1;
            continue;
          }

          const reorderQty = row.reorderQuantity ?? row.reorderPoint ?? 1;
          const unitCost = row.costPrice ?? "0";
          const totalCost = (Number(unitCost) * reorderQty).toFixed(2);
          const poNumber = makeEntryNumber("PO");

          await db.transaction(async (tx) => {
            const [order] = await tx
              .insert(purchaseOrders)
              .values({
                createdBy: context.session.user.id,
                notes: `Auto-reorder: ${row.productName} (${row.sku}) dropped to ${row.totalStock} ≤ reorder point ${row.reorderPoint}`,
                poNumber,
                subtotal: totalCost,
                supplierId: row.supplierId!,
                totalAmount: totalCost,
              })
              .returning();

            await tx.insert(purchaseOrderItems).values({
              productId: row.productId,
              purchaseOrderId: order!.id,
              quantity: reorderQty,
              totalCost,
              unitCost,
            });

            await tx.insert(inventoryAuditLog).values({
              action: "auto_reorder_created",
              changes: JSON.stringify({
                poNumber,
                productId: row.productId,
                reorderPoint: row.reorderPoint,
                reorderQty,
                totalStock: row.totalStock,
              }),
              entityId: order!.id,
              entityType: "purchase_order",
              userId: context.session.user.id,
            });
          });

          openProductIds.add(row.productId);
          created += 1;
        }

        return { created, lowStockCount: lowStockRows.length, skipped };
      }),

    transfer: protectedProcedure
      .input(
        z.object({
          fromLocationId: z.string().uuid(),
          notes: z.string().optional(),
          productId: z.string().uuid(),
          quantity: z.number().int().min(1),
          toLocationId: z.string().uuid(),
          variantId: z.string().uuid().optional(),
        })
      )
      .handler(async ({ input, context }) => {
        if (input.fromLocationId === input.toLocationId) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Source and destination locations must be different",
          });
        }

        return db.transaction(async (tx) => {
          // --- Source location — lock row to prevent concurrent depletion ---
          const [fromLevel] = await tx
            .select()
            .from(stockLevels)
            .where(
              and(
                eq(stockLevels.productId, input.productId),
                input.variantId
                  ? eq(stockLevels.variantId, input.variantId)
                  : sql`${stockLevels.variantId} IS NULL`,
                eq(stockLevels.locationId, input.fromLocationId)
              )
            )
            .limit(1)
            .for("update");

          if (!fromLevel || fromLevel.quantity < input.quantity) {
            throw new ORPCError("BAD_REQUEST", {
              message: `Insufficient stock at source location (available: ${fromLevel?.quantity ?? 0})`,
            });
          }

          const fromNew = fromLevel.quantity - input.quantity;
          const fromReserved = fromLevel.reservedQuantity ?? 0;
          await tx
            .update(stockLevels)
            .set({
              availableQuantity: Math.max(0, fromNew - fromReserved),
              lastMovementAt: new Date(),
              quantity: fromNew,
              updatedAt: new Date(),
            })
            .where(eq(stockLevels.id, fromLevel.id));

          // --- Destination location ---
          const [toLevel] = await tx
            .select()
            .from(stockLevels)
            .where(
              and(
                eq(stockLevels.productId, input.productId),
                input.variantId
                  ? eq(stockLevels.variantId, input.variantId)
                  : sql`${stockLevels.variantId} IS NULL`,
                eq(stockLevels.locationId, input.toLocationId)
              )
            )
            .limit(1);

          const toNew = (toLevel?.quantity ?? 0) + input.quantity;
          const toReserved = toLevel?.reservedQuantity ?? 0;
          if (toLevel) {
            await tx
              .update(stockLevels)
              .set({
                availableQuantity: Math.max(0, toNew - toReserved),
                lastMovementAt: new Date(),
                quantity: toNew,
                updatedAt: new Date(),
              })
              .where(eq(stockLevels.id, toLevel.id));
          } else {
            await tx.insert(stockLevels).values({
              availableQuantity: toNew,
              lastMovementAt: new Date(),
              locationId: input.toLocationId,
              productId: input.productId,
              quantity: toNew,
              variantId: input.variantId,
            });
          }

          // --- Move FIFO layers to destination location ---
          await tx
            .update(costLayers)
            .set({ locationId: input.toLocationId })
            .where(
              and(
                eq(costLayers.productId, input.productId),
                input.variantId
                  ? eq(costLayers.variantId, input.variantId)
                  : sql`${costLayers.variantId} IS NULL`,
                eq(costLayers.locationId, input.fromLocationId),
                sql`${costLayers.remainingQuantity} > 0`
              )
            );

          // --- Stock movement records (one out, one in) ---
          await tx.insert(stockMovements).values([
            {
              locationId: input.fromLocationId,
              newQuantity: fromNew,
              notes: input.notes,
              previousQuantity: fromLevel.quantity,
              productId: input.productId,
              quantity: -input.quantity,
              reason: `Transfer to location ${input.toLocationId}`,
              type: "transfer",
              userId: context.session.user.id,
              variantId: input.variantId,
            },
            {
              locationId: input.toLocationId,
              newQuantity: toNew,
              notes: input.notes,
              previousQuantity: toLevel?.quantity ?? 0,
              productId: input.productId,
              quantity: input.quantity,
              reason: `Transfer from location ${input.fromLocationId}`,
              type: "transfer",
              userId: context.session.user.id,
              variantId: input.variantId,
            },
          ]);

          // Sync variant stockQuantity (totals don't change on transfer,
          // but update anyway in case of prior drift)
          if (input.variantId) {
            const [totals] = await tx
              .select({ total: sum(stockLevels.quantity) })
              .from(stockLevels)
              .where(eq(stockLevels.variantId, input.variantId));
            await tx
              .update(productVariants)
              .set({
                stockQuantity: Number(totals?.total ?? 0),
                updatedAt: new Date(),
              })
              .where(eq(productVariants.id, input.variantId));
          }

          return { fromNew, success: true, toNew };
        });
      }),

    batches: protectedProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
          productId: z.string().uuid().optional(),
          status: z
            .enum(["all", "active", "expired", "expiring_soon", "depleted"])
            .default("all"),
        })
      )
      .handler(async ({ input }) => {
        const statusFilter =
          input.status === "depleted"
            ? sql`${costLayers.remainingQuantity} = 0`
            : input.status === "expired"
              ? sql`${costLayers.expirationDate} IS NOT NULL AND ${costLayers.expirationDate} < NOW() AND ${costLayers.remainingQuantity} > 0`
              : input.status === "expiring_soon"
                ? sql`${costLayers.expirationDate} IS NOT NULL AND ${costLayers.expirationDate} > NOW() AND ${costLayers.expirationDate} <= NOW() + INTERVAL '30 days' AND ${costLayers.remainingQuantity} > 0`
                : input.status === "active"
                  ? sql`${costLayers.remainingQuantity} > 0 AND (${costLayers.expirationDate} IS NULL OR ${costLayers.expirationDate} > NOW() + INTERVAL '30 days')`
                  : undefined;

        const productFilter = input.productId
          ? eq(costLayers.productId, input.productId)
          : undefined;

        const whereClause =
          statusFilter && productFilter
            ? and(productFilter, statusFilter)
            : (statusFilter ?? productFilter);

        const [items, totalCountResult] = await Promise.all([
          db
            .select({
              expirationDate: costLayers.expirationDate,
              id: costLayers.id,
              locationName: locations.name,
              lotNumber: costLayers.lotNumber,
              notes: costLayers.notes,
              originalQuantity: costLayers.originalQuantity,
              productName: products.name,
              productSku: products.sku,
              receivedAt: costLayers.receivedAt,
              remainingQuantity: costLayers.remainingQuantity,
              unitCost: costLayers.unitCost,
              variantName: productVariants.name,
            })
            .from(costLayers)
            .leftJoin(products, eq(costLayers.productId, products.id))
            .leftJoin(locations, eq(costLayers.locationId, locations.id))
            .leftJoin(
              productVariants,
              eq(costLayers.variantId, productVariants.id)
            )
            .where(whereClause)
            .limit(input.limit)
            .offset(input.offset)
            .orderBy(desc(costLayers.receivedAt)),
          db
            .select({ count: sql<number>`count(*)` })
            .from(costLayers)
            .where(whereClause),
        ]);

        const now2 = new Date();
        const soon = new Date(now2.getTime() + 30 * 24 * 60 * 60 * 1000);

        const enriched = items.map((row) => {
          let batchStatus: "active" | "expired" | "expiring_soon" | "depleted";
          if (row.remainingQuantity === 0) {
            batchStatus = "depleted";
          } else if (row.expirationDate && row.expirationDate < now2) {
            batchStatus = "expired";
          } else if (
            row.expirationDate &&
            row.expirationDate <= soon &&
            row.expirationDate > now2
          ) {
            batchStatus = "expiring_soon";
          } else {
            batchStatus = "active";
          }
          return { ...row, status: batchStatus };
        });

        return {
          items: enriched,
          pagination: {
            limit: input.limit,
            offset: input.offset,
            total: totalCountResult[0]?.count ?? 0,
          },
        };
      }),

    expiringSoon: protectedProcedure
      .input(
        z.object({
          days: z.number().int().min(1).max(365).default(30),
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
        })
      )
      .handler(async ({ input }) => {
        const [items, totalCountResult] = await Promise.all([
          db
            .select({
              expirationDate: costLayers.expirationDate,
              id: costLayers.id,
              locationName: locations.name,
              productName: products.name,
              productSku: products.sku,
              remainingQuantity: costLayers.remainingQuantity,
              unitCost: costLayers.unitCost,
            })
            .from(costLayers)
            .leftJoin(products, eq(costLayers.productId, products.id))
            .leftJoin(locations, eq(costLayers.locationId, locations.id))
            .where(
              sql`${costLayers.expirationDate} IS NOT NULL AND ${costLayers.expirationDate} > NOW() AND ${costLayers.expirationDate} <= NOW() + (${input.days} || ' days')::INTERVAL AND ${costLayers.remainingQuantity} > 0`
            )
            .limit(input.limit)
            .offset(input.offset)
            .orderBy(asc(costLayers.expirationDate)),
          db
            .select({ count: sql<number>`count(*)` })
            .from(costLayers)
            .where(
              sql`${costLayers.expirationDate} IS NOT NULL AND ${costLayers.expirationDate} > NOW() AND ${costLayers.expirationDate} <= NOW() + (${input.days} || ' days')::INTERVAL AND ${costLayers.remainingQuantity} > 0`
            ),
        ]);

        return { items, total: totalCountResult[0]?.count ?? 0 };
      }),

    writeOffBatch: protectedProcedure
      .input(z.object({ batchId: z.string().uuid() }))
      .handler(async ({ input, context }) => {
        const { movement, qty, unitCost } = await db.transaction(async (tx) => {
          const [batch] = await tx
            .select()
            .from(costLayers)
            .where(eq(costLayers.id, input.batchId))
            .limit(1);

          if (!batch) {
            throw new ORPCError("NOT_FOUND", { message: "Batch not found" });
          }

          if (!batch.expirationDate || batch.expirationDate > new Date()) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Batch is not expired and cannot be written off",
            });
          }

          if (batch.remainingQuantity === 0) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Batch is already depleted",
            });
          }

          const batchQty = batch.remainingQuantity;

          await tx
            .update(costLayers)
            .set({ remainingQuantity: 0 })
            .where(eq(costLayers.id, input.batchId));

          const [stockLevel] = await tx
            .select()
            .from(stockLevels)
            .where(
              and(
                eq(stockLevels.productId, batch.productId),
                batch.variantId
                  ? eq(stockLevels.variantId, batch.variantId)
                  : sql`${stockLevels.variantId} IS NULL`,
                batch.locationId
                  ? eq(stockLevels.locationId, batch.locationId)
                  : sql`${stockLevels.locationId} IS NULL`
              )
            )
            .limit(1);

          const currentQty = stockLevel?.quantity ?? 0;
          const newQty = Math.max(0, currentQty - batchQty);

          if (stockLevel) {
            await tx
              .update(stockLevels)
              .set({
                availableQuantity: newQty,
                lastMovementAt: new Date(),
                quantity: newQty,
                updatedAt: new Date(),
              })
              .where(eq(stockLevels.id, stockLevel.id));
          }

          const [mov] = await tx
            .insert(stockMovements)
            .values({
              locationId: batch.locationId,
              newQuantity: newQty,
              notes: `Write-off of expired batch ${input.batchId}`,
              previousQuantity: currentQty,
              productId: batch.productId,
              quantity: -batchQty,
              reason: "Expired batch write-off",
              referenceId: input.batchId,
              referenceType: "cost_layer",
              totalCost: (batchQty * Number(batch.unitCost)).toString(),
              type: "expired",
              unitCost: batch.unitCost,
              userId: context.session.user.id,
              variantId: batch.variantId,
            })
            .returning();

          return {
            movement: mov,
            qty: batchQty,
            unitCost: Number(batch.unitCost ?? 0),
          };
        });

        // Post inventory variance JE outside transaction so accounting failures
        // never roll back the write-off.
        try {
          await postInventoryVarianceJournalEntry(
            db,
            {
              date: new Date(),
              quantity: -qty,
              referenceId: movement!.id,
              unitCost,
            },
            context.session.user.id
          );
        } catch {
          // Accounting not configured — write-off still succeeded
        }

        return movement;
      }),

    updateBatch: protectedProcedure
      .input(
        z.object({
          expirationDate: z.string().datetime().nullable().optional(),
          id: z.string().uuid(),
          lotNumber: z.string().min(1).optional(),
          notes: z.string().optional(),
        })
      )
      .handler(async ({ input }) => {
        const [batch] = await db
          .select()
          .from(costLayers)
          .where(eq(costLayers.id, input.id))
          .limit(1);

        if (!batch) {
          throw new ORPCError("NOT_FOUND", { message: "Batch not found" });
        }

        const [updated] = await db
          .update(costLayers)
          .set({
            expirationDate:
              input.expirationDate === null
                ? null
                : input.expirationDate
                  ? new Date(input.expirationDate)
                  : undefined,
            ...(input.lotNumber !== undefined && {
              lotNumber: input.lotNumber,
            }),
            ...(input.notes !== undefined && { notes: input.notes }),
          })
          .where(eq(costLayers.id, input.id))
          .returning();

        return updated;
      }),

    createBatch: protectedProcedure
      .input(
        z.object({
          expirationDate: z.string().datetime().optional(),
          locationId: z.string().uuid().optional(),
          lotNumber: z.string().min(1).optional(),
          notes: z.string().optional(),
          productId: z.string().uuid(),
          quantity: z.number().int().min(1),
          unitCost: z.string().default("0"),
          variantId: z.string().uuid().optional(),
        })
      )
      .handler(async ({ input, context }) =>
        db.transaction(async (tx) => {
          const [product] = await tx
            .select({ id: products.id })
            .from(products)
            .where(eq(products.id, input.productId))
            .limit(1);

          if (!product) {
            throw new ORPCError("NOT_FOUND", { message: "Product not found" });
          }

          const lotNumber = input.lotNumber ?? makeEntryNumber("LOT");

          const [layer] = await tx
            .insert(costLayers)
            .values({
              expirationDate: input.expirationDate
                ? new Date(input.expirationDate)
                : null,
              locationId: input.locationId ?? null,
              lotNumber,
              notes: input.notes ?? null,
              originalQuantity: input.quantity,
              productId: input.productId,
              referenceType: "manual",
              remainingQuantity: input.quantity,
              unitCost: input.unitCost,
              variantId: input.variantId ?? null,
            })
            .returning();

          const [stockLevel] = await tx
            .select()
            .from(stockLevels)
            .where(
              and(
                eq(stockLevels.productId, input.productId),
                input.variantId
                  ? eq(stockLevels.variantId, input.variantId)
                  : sql`${stockLevels.variantId} IS NULL`,
                input.locationId
                  ? eq(stockLevels.locationId, input.locationId)
                  : sql`${stockLevels.locationId} IS NULL`
              )
            )
            .limit(1);

          const currentQty = stockLevel?.quantity ?? 0;
          const newQty = currentQty + input.quantity;

          if (stockLevel) {
            await tx
              .update(stockLevels)
              .set({
                availableQuantity: newQty,
                lastMovementAt: new Date(),
                quantity: newQty,
                updatedAt: new Date(),
              })
              .where(eq(stockLevels.id, stockLevel.id));
          } else {
            await tx.insert(stockLevels).values({
              availableQuantity: newQty,
              lastMovementAt: new Date(),
              locationId: input.locationId ?? null,
              productId: input.productId,
              quantity: newQty,
              variantId: input.variantId ?? null,
            });
          }

          await tx.insert(stockMovements).values({
            locationId: input.locationId ?? null,
            newQuantity: newQty,
            notes: input.notes ?? `Manual batch receipt — Lot ${lotNumber}`,
            previousQuantity: currentQty,
            productId: input.productId,
            quantity: input.quantity,
            reason: "Manual batch/lot receipt",
            referenceId: layer!.id,
            referenceType: "manual_batch",
            totalCost: (input.quantity * Number(input.unitCost)).toString(),
            type: "purchase",
            unitCost: input.unitCost,
            userId: context.session.user.id,
            variantId: input.variantId ?? null,
          });

          if (input.variantId) {
            const [totals] = await tx
              .select({ total: sum(stockLevels.quantity) })
              .from(stockLevels)
              .where(eq(stockLevels.variantId, input.variantId));
            await tx
              .update(productVariants)
              .set({
                stockQuantity: Number(totals?.total ?? 0),
                updatedAt: new Date(),
              })
              .where(eq(productVariants.id, input.variantId));
          }

          return layer;
        })
      ),

    locationLevels: protectedProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(100).default(50),
          locationId: z.string().uuid().optional(),
          offset: z.number().int().min(0).default(0),
          query: z.string().optional(),
        })
      )
      .handler(async ({ input }) => {
        const conditions: ReturnType<typeof eq>[] = [];

        if (input.locationId) {
          conditions.push(eq(stockLevels.locationId, input.locationId));
        }

        const baseWhere =
          conditions.length > 0
            ? and(eq(products.status, "active"), ...conditions)
            : eq(products.status, "active");

        const whereClause = input.query
          ? and(
              baseWhere,
              sql`(${products.name} ILIKE ${`%${input.query}%`} OR ${products.sku} ILIKE ${`%${input.query}%`})`
            )
          : baseWhere;

        const [items, countResult] = await Promise.all([
          db
            .select({
              availableQuantity: stockLevels.availableQuantity,
              id: stockLevels.id,
              lastMovementAt: stockLevels.lastMovementAt,
              locationId: stockLevels.locationId,
              locationName: locations.name,
              locationType: locations.type,
              productId: products.id,
              productName: products.name,
              quantity: stockLevels.quantity,
              reservedQuantity: stockLevels.reservedQuantity,
              sku: products.sku,
              variantId: stockLevels.variantId,
              variantName: productVariants.name,
            })
            .from(stockLevels)
            .innerJoin(products, eq(stockLevels.productId, products.id))
            .leftJoin(locations, eq(stockLevels.locationId, locations.id))
            .leftJoin(
              productVariants,
              eq(stockLevels.variantId, productVariants.id)
            )
            .where(whereClause)
            .orderBy(asc(locations.name), asc(products.name))
            .limit(input.limit)
            .offset(input.offset),
          db
            .select({ count: sql<number>`count(*)` })
            .from(stockLevels)
            .innerJoin(products, eq(stockLevels.productId, products.id))
            .leftJoin(locations, eq(stockLevels.locationId, locations.id))
            .where(whereClause),
        ]);

        return {
          items,
          pagination: {
            limit: input.limit,
            offset: input.offset,
            total: countResult[0]?.count ?? 0,
          },
        };
      }),
  },

  // Purchase Orders
  purchaseOrders: {
    create: protectedProcedure.input(createPurchaseOrderSchema).handler(
      async ({ input, context }) =>
        await db.transaction(async (tx) => {
          const poNumber = makeEntryNumber("PO");

          // Guard: supplier must be active
          const [sup] = await tx
            .select({
              paymentTermsDays: suppliers.paymentTermsDays,
              status: suppliers.status,
            })
            .from(suppliers)
            .where(eq(suppliers.id, input.supplierId))
            .limit(1);

          if (!sup) {
            throw new ORPCError("NOT_FOUND", { message: "Supplier not found" });
          }
          if (sup.status !== "active") {
            throw new ORPCError("BAD_REQUEST", {
              message:
                "Cannot create a purchase order for an inactive or suspended supplier",
            });
          }

          // Guard: all products must be active/available (not discontinued)
          const productIds = input.items.map((i) => i.productId);
          const badProducts = await tx
            .select({ id: products.id, name: products.name })
            .from(products)
            .where(
              and(
                inArray(products.id, productIds),
                eq(products.status, "discontinued")
              )
            );
          if (badProducts.length > 0) {
            const names = badProducts.map((p) => p.name).join(", ");
            throw new ORPCError("BAD_REQUEST", {
              message: `Cannot order discontinued products: ${names}`,
            });
          }

          let subtotal = 0;
          for (const item of input.items) {
            subtotal += Number(item.unitCost) * item.quantity;
          }

          const orderDate = new Date();
          const paymentDueDate = computePaymentDueDate(
            orderDate,
            sup?.paymentTermsDays
          );

          const [order] = await tx
            .insert(purchaseOrders)
            .values({
              createdBy: context.session.user.id,
              expectedDate: input.expectedDate
                ? new Date(input.expectedDate)
                : undefined,
              notes: input.notes,
              paymentDueDate: paymentDueDate ?? null,
              poNumber,
              subtotal: subtotal.toString(),
              supplierId: input.supplierId,
              totalAmount: subtotal.toString(),
            })
            .returning();

          for (const item of input.items) {
            const totalCost = Number(item.unitCost) * item.quantity;
            await tx.insert(purchaseOrderItems).values({
              productId: item.productId,
              purchaseOrderId: order!.id,
              quantity: item.quantity,
              totalCost: totalCost.toString(),
              unitCost: item.unitCost,
              variantId: item.variantId,
            });
          }

          return order;
        })
    ),

    approve: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input, context }) => {
        const [po] = await db
          .update(purchaseOrders)
          .set({ status: "approved", updatedAt: new Date() })
          .where(
            and(
              eq(purchaseOrders.id, input.id),
              isNull(purchaseOrders.deletedAt),
              inArray(purchaseOrders.status, ["draft", "pending"])
            )
          )
          .returning();

        if (!po) {
          throw new ORPCError("BAD_REQUEST", {
            message:
              "Purchase order not found or cannot be approved in its current status",
          });
        }

        await db.insert(inventoryAuditLog).values({
          action: "approved",
          entityId: po.id,
          entityType: "purchase_order",
          userId: context.session.user.id,
        });

        return po;
      }),

    markOrdered: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input, context }) => {
        const [po] = await db
          .update(purchaseOrders)
          .set({
            orderDate: new Date(),
            status: "ordered",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(purchaseOrders.id, input.id),
              isNull(purchaseOrders.deletedAt),
              eq(purchaseOrders.status, "approved")
            )
          )
          .returning();

        if (!po) {
          throw new ORPCError("BAD_REQUEST", {
            message:
              "Purchase order not found or cannot be marked as ordered in its current status",
          });
        }

        await db.insert(inventoryAuditLog).values({
          action: "marked_ordered",
          entityId: po.id,
          entityType: "purchase_order",
          userId: context.session.user.id,
        });

        return po;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input, context }) => {
        const [po] = await db
          .update(purchaseOrders)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(purchaseOrders.id, input.id),
              isNull(purchaseOrders.deletedAt),
              inArray(purchaseOrders.status, ["draft", "pending"])
            )
          )
          .returning();

        if (!po) {
          throw new ORPCError("BAD_REQUEST", {
            message:
              "Purchase order not found or cannot be deleted in its current status",
          });
        }

        await db.insert(inventoryAuditLog).values({
          action: "deleted",
          entityId: po.id,
          entityType: "purchase_order",
          userId: context.session.user.id,
        });

        return { success: true };
      }),

    get: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) => {
        const [order] = await db
          .select({
            amountPaid: purchaseOrders.amountPaid,
            expectedDate: purchaseOrders.expectedDate,
            id: purchaseOrders.id,
            notes: purchaseOrders.notes,
            orderDate: purchaseOrders.orderDate,
            paidAt: purchaseOrders.paidAt,
            paymentDueDate: purchaseOrders.paymentDueDate,
            paymentStatus: purchaseOrders.paymentStatus,
            poNumber: purchaseOrders.poNumber,
            receivedDate: purchaseOrders.receivedDate,
            shippingCost: purchaseOrders.shippingCost,
            status: purchaseOrders.status,
            subtotal: purchaseOrders.subtotal,
            supplier: {
              email: suppliers.email,
              id: suppliers.id,
              name: suppliers.name,
              paymentTerms: suppliers.paymentTerms,
              paymentTermsDays: suppliers.paymentTermsDays,
              phone: suppliers.phone,
            },
            taxAmount: purchaseOrders.taxAmount,
            totalAmount: purchaseOrders.totalAmount,
          })
          .from(purchaseOrders)
          .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
          .where(
            and(
              eq(purchaseOrders.id, input.id),
              isNull(purchaseOrders.deletedAt)
            )
          );

        if (!order) {
          throw new ORPCError("NOT_FOUND", {
            message: "Purchase order not found",
          });
        }

        const items = await db
          .select({
            id: purchaseOrderItems.id,
            product: {
              id: products.id,
              name: products.name,
              sku: products.sku,
            },
            quantity: purchaseOrderItems.quantity,
            receivedQuantity: purchaseOrderItems.receivedQuantity,
            totalCost: purchaseOrderItems.totalCost,
            unitCost: purchaseOrderItems.unitCost,
            variant: {
              id: productVariants.id,
              name: productVariants.name,
            },
          })
          .from(purchaseOrderItems)
          .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
          .leftJoin(
            productVariants,
            eq(purchaseOrderItems.variantId, productVariants.id)
          )
          .where(eq(purchaseOrderItems.purchaseOrderId, input.id));

        const payments = await db
          .select()
          .from(poPayments)
          .where(eq(poPayments.purchaseOrderId, input.id))
          .orderBy(asc(poPayments.paymentDate));

        return {
          ...order,
          items,
          payments,
          paymentStatus: resolvePaymentStatus(
            order.paymentStatus,
            order.paymentDueDate
          ),
        };
      }),

    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
          status: z
            .enum([
              "draft",
              "pending",
              "approved",
              "ordered",
              "partial",
              "received",
              "cancelled",
            ])
            .optional(),
        })
      )
      .handler(async ({ input }) => {
        const conditions = [isNull(purchaseOrders.deletedAt)];
        if (input.status) {
          conditions.push(eq(purchaseOrders.status, input.status));
        }

        const [items, totalCountResult] = await Promise.all([
          db
            .select({
              expectedDate: purchaseOrders.expectedDate,
              id: purchaseOrders.id,
              orderDate: purchaseOrders.orderDate,
              paymentDueDate: purchaseOrders.paymentDueDate,
              paymentStatus: purchaseOrders.paymentStatus,
              poNumber: purchaseOrders.poNumber,
              status: purchaseOrders.status,
              supplier: {
                id: suppliers.id,
                name: suppliers.name,
              },
              totalAmount: purchaseOrders.totalAmount,
            })
            .from(purchaseOrders)
            .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
            .where(and(...conditions))
            .limit(input.limit)
            .offset(input.offset)
            .orderBy(desc(purchaseOrders.createdAt)),
          db
            .select({ count: sql<number>`count(*)` })
            .from(purchaseOrders)
            .where(and(...conditions)),
        ]);

        return {
          items: items.map((item) => ({
            ...item,
            paymentStatus: resolvePaymentStatus(
              item.paymentStatus,
              item.paymentDueDate
            ),
          })),
          pagination: {
            limit: input.limit,
            offset: input.offset,
            total: totalCountResult[0]?.count ?? 0,
          },
        };
      }),

    receive: protectedProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          items: receivePurchaseOrderSchema.shape.items,
          locationId: z.string().uuid().optional(),
        })
      )
      .handler(async ({ input, context }) => {
        const receivedDate = new Date();
        const result = await db.transaction(async (tx) => {
          const [invSettings] = await tx
            .select()
            .from(inventorySettings)
            .where(eq(inventorySettings.id, "default"))
            .limit(1);
          const costMethod = invSettings?.costUpdateMethod ?? "none";

          const [poRow] = await tx
            .select({
              paymentTermsDays: suppliers.paymentTermsDays,
              purchaseTax: purchaseOrders.taxAmount,
              shippingCost: purchaseOrders.shippingCost,
              status: purchaseOrders.status,
            })
            .from(purchaseOrders)
            .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
            .where(eq(purchaseOrders.id, input.id))
            .limit(1);

          const receivableStatuses = ["approved", "ordered", "partial"];
          if (!poRow || poRow.status === "cancelled") {
            throw new ORPCError("BAD_REQUEST", {
              message: "Purchase order not found or has been cancelled",
            });
          }
          if (!receivableStatuses.includes(poRow.status ?? "")) {
            throw new ORPCError("BAD_REQUEST", {
              message: `Purchase order must be approved before receiving (current status: ${poRow.status ?? "unknown"})`,
            });
          }

          const poSupplier = poRow;

          let totalCost = 0;

          for (const item of input.items) {
            const [orderItem] = await tx
              .select()
              .from(purchaseOrderItems)
              .where(eq(purchaseOrderItems.id, item.itemId))
              .limit(1);

            if (!orderItem) {
              throw new ORPCError("NOT_FOUND", {
                message: `Purchase order item ${item.itemId} not found`,
              });
            }

            const remaining =
              orderItem.quantity - (orderItem.receivedQuantity ?? 0);
            if (item.receivedQuantity > remaining) {
              throw new ORPCError("BAD_REQUEST", {
                message: `Cannot receive ${item.receivedQuantity} units — only ${remaining} remaining on this order line`,
              });
            }

            await tx
              .update(purchaseOrderItems)
              .set({
                receivedQuantity:
                  (orderItem.receivedQuantity ?? 0) + item.receivedQuantity,
                updatedAt: new Date(),
              })
              .where(eq(purchaseOrderItems.id, item.itemId));

            if (item.receivedQuantity > 0) {
              totalCost += Number(orderItem.unitCost) * item.receivedQuantity;

              const stockLevel = await tx
                .select()
                .from(stockLevels)
                .where(
                  and(
                    eq(stockLevels.productId, orderItem.productId),
                    orderItem.variantId
                      ? eq(stockLevels.variantId, orderItem.variantId)
                      : sql`${stockLevels.variantId} IS NULL`,
                    input.locationId
                      ? eq(stockLevels.locationId, input.locationId)
                      : sql`${stockLevels.locationId} IS NULL`
                  )
                )
                .limit(1);

              const currentQuantity = stockLevel[0]?.quantity ?? 0;
              const reservedQty = stockLevel[0]?.reservedQuantity ?? 0;
              const newQuantity = currentQuantity + item.receivedQuantity;

              if (stockLevel.length > 0) {
                await tx
                  .update(stockLevels)
                  .set({
                    availableQuantity: Math.max(0, newQuantity - reservedQty),
                    lastMovementAt: new Date(),
                    quantity: newQuantity,
                    updatedAt: new Date(),
                  })
                  .where(eq(stockLevels.id, stockLevel[0]!.id));
              } else {
                await tx.insert(stockLevels).values({
                  availableQuantity: newQuantity,
                  lastMovementAt: new Date(),
                  locationId: input.locationId ?? null,
                  productId: orderItem.productId,
                  quantity: newQuantity,
                  variantId: orderItem.variantId,
                });
              }

              // Always create a cost layer for batch/lot tracking
              const batchLotNumber = item.lotNumber ?? makeEntryNumber("LOT");
              await tx.insert(costLayers).values({
                expirationDate: item.expirationDate
                  ? new Date(item.expirationDate)
                  : null,
                locationId: input.locationId ?? null,
                lotNumber: batchLotNumber,
                originalQuantity: item.receivedQuantity,
                productId: orderItem.productId,
                referenceId: input.id,
                referenceType: "purchase_order",
                remainingQuantity: item.receivedQuantity,
                unitCost: orderItem.unitCost,
                variantId: orderItem.variantId,
              });

              if (costMethod !== "none") {
                let newCostPrice: string | null = null;

                if (costMethod === "last_cost") {
                  newCostPrice = orderItem.unitCost;
                } else if (costMethod === "weighted_average") {
                  let existingCostPrice = "0";
                  if (orderItem.variantId) {
                    const [variant] = await tx
                      .select({ costPrice: productVariants.costPrice })
                      .from(productVariants)
                      .where(eq(productVariants.id, orderItem.variantId))
                      .limit(1);
                    existingCostPrice = variant?.costPrice ?? "0";
                  } else {
                    const [product] = await tx
                      .select({ costPrice: products.costPrice })
                      .from(products)
                      .where(eq(products.id, orderItem.productId))
                      .limit(1);
                    existingCostPrice = product?.costPrice ?? "0";
                  }
                  if (newQuantity > 0) {
                    const weighted =
                      (currentQuantity * Number(existingCostPrice) +
                        item.receivedQuantity * Number(orderItem.unitCost)) /
                      newQuantity;
                    newCostPrice = weighted.toFixed(4);
                  }
                } else if (costMethod === "fifo") {
                  // Cost price = oldest layer still in stock
                  const [oldest] = await tx
                    .select({ unitCost: costLayers.unitCost })
                    .from(costLayers)
                    .where(
                      and(
                        eq(costLayers.productId, orderItem.productId),
                        orderItem.variantId
                          ? eq(costLayers.variantId, orderItem.variantId)
                          : sql`${costLayers.variantId} IS NULL`,
                        sql`${costLayers.remainingQuantity} > 0`
                      )
                    )
                    .orderBy(asc(costLayers.receivedAt))
                    .limit(1);
                  newCostPrice = oldest?.unitCost ?? null;
                }

                if (newCostPrice !== null) {
                  if (orderItem.variantId) {
                    await tx
                      .update(productVariants)
                      .set({ costPrice: newCostPrice, updatedAt: new Date() })
                      .where(eq(productVariants.id, orderItem.variantId));
                  } else {
                    await tx
                      .update(products)
                      .set({ costPrice: newCostPrice, updatedAt: new Date() })
                      .where(eq(products.id, orderItem.productId));
                  }
                }
              }

              await tx.insert(stockMovements).values({
                locationId: input.locationId ?? null,
                newQuantity,
                previousQuantity: currentQuantity,
                productId: orderItem.productId,
                quantity: item.receivedQuantity,
                reason: "Purchase order receipt",
                referenceId: input.id,
                referenceType: "purchase_order",
                totalCost: (
                  Number(orderItem.unitCost) * item.receivedQuantity
                ).toString(),
                type: "purchase",
                unitCost: orderItem.unitCost,
                userId: context.session.user.id,
                variantId: orderItem.variantId,
              });

              // Sync denormalized stockQuantity on variants
              if (orderItem.variantId) {
                const [totals] = await tx
                  .select({ total: sum(stockLevels.quantity) })
                  .from(stockLevels)
                  .where(eq(stockLevels.variantId, orderItem.variantId));
                await tx
                  .update(productVariants)
                  .set({
                    stockQuantity: Number(totals?.total ?? 0),
                    updatedAt: new Date(),
                  })
                  .where(eq(productVariants.id, orderItem.variantId));
              }
            }
          }

          // Determine if all items are fully received
          const allItems = await tx
            .select({
              quantity: purchaseOrderItems.quantity,
              receivedQuantity: purchaseOrderItems.receivedQuantity,
            })
            .from(purchaseOrderItems)
            .where(eq(purchaseOrderItems.purchaseOrderId, input.id));

          const allReceived = allItems.every(
            (i) => (i.receivedQuantity ?? 0) >= i.quantity
          );

          const isCOD = poSupplier?.paymentTermsDays === 0;

          const newStatus = allReceived ? "received" : "partial";

          await tx
            .update(purchaseOrders)
            .set({
              ...(isCOD ? { paymentDueDate: receivedDate } : {}),
              receivedDate: receivedDate,
              status: newStatus,
              updatedAt: new Date(),
            })
            .where(eq(purchaseOrders.id, input.id));

          await tx.insert(inventoryAuditLog).values({
            action:
              newStatus === "received"
                ? "fully_received"
                : "partially_received",
            changes: JSON.stringify({
              locationId: input.locationId,
              totalCost,
            }),
            entityId: input.id,
            entityType: "purchase_order",
            userId: context.session.user.id,
          });

          return {
            purchaseTax: poRow?.purchaseTax ?? "0",
            shippingCost: poRow?.shippingCost ?? "0",
            success: true,
            totalCost: totalCost.toString(),
          };
        });

        try {
          await postPurchaseReceiptJournalEntry(
            db,
            {
              date: receivedDate,
              id: input.id,
              purchaseTax: result.purchaseTax,
              shippingCost: result.shippingCost,
              totalCost: result.totalCost,
            },
            context.session.user.id
          );
        } catch {
          // Accounting not configured — receipt still succeeded
        }

        return { success: true };
      }),

    recordPayment: protectedProcedure
      .input(
        z.object({
          amount: z.string().refine((v) => Number(v) > 0, {
            message: "Payment amount must be greater than 0",
          }),
          id: z.string().uuid(),
          notes: z.string().optional(),
          paymentDate: z.string().datetime().optional(),
          paymentMethod: z
            .enum(["bank_transfer", "check", "cash", "credit_card", "other"])
            .optional(),
        })
      )
      .handler(async ({ input, context }) => {
        const paymentDate = input.paymentDate
          ? new Date(input.paymentDate)
          : new Date();

        const updatedOrder = await db.transaction(async (tx) => {
          const [po] = await tx
            .select({
              amountPaid: purchaseOrders.amountPaid,
              totalAmount: purchaseOrders.totalAmount,
            })
            .from(purchaseOrders)
            .where(eq(purchaseOrders.id, input.id))
            .limit(1);

          if (!po) {
            throw new ORPCError("NOT_FOUND", {
              message: "Purchase order not found",
            });
          }

          const remaining = Number(po.totalAmount) - Number(po.amountPaid ?? 0);
          if (Number(input.amount) > remaining + 0.005) {
            throw new ORPCError("BAD_REQUEST", {
              message: `Payment (${Number(input.amount).toFixed(2)}) exceeds remaining balance (${remaining.toFixed(2)})`,
            });
          }

          await tx.insert(poPayments).values({
            amount: input.amount,
            notes: input.notes ?? null,
            paymentDate,
            paymentMethod: input.paymentMethod ?? null,
            purchaseOrderId: input.id,
          });

          const [sumResult] = await tx
            .select({ total: sum(poPayments.amount) })
            .from(poPayments)
            .where(eq(poPayments.purchaseOrderId, input.id));

          const newTotal = sumResult?.total ?? "0";
          const newStatus =
            Number(newTotal) >= Number(po.totalAmount)
              ? ("paid" as const)
              : ("partially_paid" as const);

          const [order] = await tx
            .update(purchaseOrders)
            .set({
              amountPaid: newTotal,
              paidAt: paymentDate,
              paymentStatus: newStatus,
              updatedAt: new Date(),
            })
            .where(eq(purchaseOrders.id, input.id))
            .returning();

          return order;
        });

        try {
          await postPurchasePaymentJournalEntry(
            db,
            { amount: input.amount, date: paymentDate, poId: input.id },
            context.session.user.id
          );
        } catch {
          // Accounting not configured — payment still succeeded
        }

        return updatedOrder;
      }),

    cancel: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input, context }) =>
        db.transaction(async (tx) => {
          const [po] = await tx
            .select({ status: purchaseOrders.status })
            .from(purchaseOrders)
            .where(
              and(
                eq(purchaseOrders.id, input.id),
                isNull(purchaseOrders.deletedAt)
              )
            )
            .limit(1);

          if (!po) {
            throw new ORPCError("NOT_FOUND", {
              message: "Purchase order not found",
            });
          }

          if (po.status === "received" || po.status === "cancelled") {
            throw new ORPCError("BAD_REQUEST", {
              message: `Cannot cancel a purchase order with status "${po.status}"`,
            });
          }

          const [updated] = await tx
            .update(purchaseOrders)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(purchaseOrders.id, input.id))
            .returning();

          await tx.insert(inventoryAuditLog).values({
            action: "cancelled",
            entityId: input.id,
            entityType: "purchase_order",
            userId: context.session.user.id,
          });

          return updated!;
        })
      ),
  },

  // Cycle Counts
  cycleCount: {
    create: protectedProcedure
      .input(
        z.object({
          locationId: z.string().uuid().optional(),
          name: z.string().min(1),
          notes: z.string().optional(),
        })
      )
      .handler(async ({ input, context }) =>
        db.transaction(async (tx) => {
          const [session] = await tx
            .insert(cycleCounts)
            .values({
              countedBy: context.session.user.id,
              locationId: input.locationId,
              name: input.name,
              notes: input.notes,
              status: "draft",
            })
            .returning();

          const stockLevelRows = await tx
            .select()
            .from(stockLevels)
            .where(
              input.locationId
                ? eq(stockLevels.locationId, input.locationId)
                : undefined
            );

          if (stockLevelRows.length > 0) {
            await tx.insert(cycleCountLines).values(
              stockLevelRows.map((sl) => ({
                cycleCountId: session!.id,
                locationId: sl.locationId,
                productId: sl.productId,
                systemQuantity: sl.quantity,
                variantId: sl.variantId,
              }))
            );
          }

          return session!;
        })
      ),

    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
          status: z
            .enum(["draft", "in_progress", "completed", "cancelled"])
            .optional(),
        })
      )
      .handler(async ({ input }) => {
        const conditions = input.status
          ? [eq(cycleCounts.status, input.status)]
          : [];

        const [items, totalCountResult] = await Promise.all([
          db
            .select({
              completedAt: cycleCounts.completedAt,
              countedLines: sql<number>`(SELECT count(*) FROM cycle_count_lines WHERE cycle_count_id = ${cycleCounts.id} AND counted_quantity IS NOT NULL)`,
              createdAt: cycleCounts.createdAt,
              id: cycleCounts.id,
              locationName: locations.name,
              name: cycleCounts.name,
              notes: cycleCounts.notes,
              startedAt: cycleCounts.startedAt,
              status: cycleCounts.status,
              totalLines: sql<number>`(SELECT count(*) FROM cycle_count_lines WHERE cycle_count_id = ${cycleCounts.id})`,
            })
            .from(cycleCounts)
            .leftJoin(locations, eq(cycleCounts.locationId, locations.id))
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .limit(input.limit)
            .offset(input.offset)
            .orderBy(desc(cycleCounts.createdAt)),
          db
            .select({ count: sql<number>`count(*)` })
            .from(cycleCounts)
            .where(conditions.length > 0 ? and(...conditions) : undefined),
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

    get: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) => {
        const [session] = await db
          .select({
            cancelledAt: cycleCounts.cancelledAt,
            completedAt: cycleCounts.completedAt,
            countedBy: cycleCounts.countedBy,
            createdAt: cycleCounts.createdAt,
            id: cycleCounts.id,
            locationId: cycleCounts.locationId,
            locationName: locations.name,
            name: cycleCounts.name,
            notes: cycleCounts.notes,
            startedAt: cycleCounts.startedAt,
            status: cycleCounts.status,
            updatedAt: cycleCounts.updatedAt,
          })
          .from(cycleCounts)
          .leftJoin(locations, eq(cycleCounts.locationId, locations.id))
          .where(eq(cycleCounts.id, input.id));

        if (!session) {
          throw new ORPCError("NOT_FOUND", {
            message: "Cycle count session not found",
          });
        }

        const lines = await db
          .select({
            countedQuantity: cycleCountLines.countedQuantity,
            id: cycleCountLines.id,
            locationId: cycleCountLines.locationId,
            locationName: locations.name,
            notes: cycleCountLines.notes,
            productId: cycleCountLines.productId,
            productName: products.name,
            productSku: products.sku,
            systemQuantity: cycleCountLines.systemQuantity,
            variance: cycleCountLines.variance,
            variantId: cycleCountLines.variantId,
            variantName: productVariants.name,
          })
          .from(cycleCountLines)
          .leftJoin(products, eq(cycleCountLines.productId, products.id))
          .leftJoin(
            productVariants,
            eq(cycleCountLines.variantId, productVariants.id)
          )
          .leftJoin(locations, eq(cycleCountLines.locationId, locations.id))
          .where(eq(cycleCountLines.cycleCountId, input.id))
          .orderBy(asc(products.name));

        return { ...session, lines };
      }),

    updateLine: protectedProcedure
      .input(
        z.object({
          countedQuantity: z.number().int().min(0),
          id: z.string().uuid(),
          notes: z.string().optional(),
        })
      )
      .handler(async ({ input }) =>
        db.transaction(async (tx) => {
          const [line] = await tx
            .select()
            .from(cycleCountLines)
            .where(eq(cycleCountLines.id, input.id))
            .limit(1);

          if (!line) {
            throw new ORPCError("NOT_FOUND", {
              message: "Cycle count line not found",
            });
          }

          const [session] = await tx
            .select()
            .from(cycleCounts)
            .where(eq(cycleCounts.id, line.cycleCountId))
            .limit(1);

          if (
            session?.status === "completed" ||
            session?.status === "cancelled"
          ) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Cannot update a completed or cancelled cycle count",
            });
          }

          if (session?.status === "draft") {
            await tx
              .update(cycleCounts)
              .set({
                startedAt: new Date(),
                status: "in_progress",
                updatedAt: new Date(),
              })
              .where(eq(cycleCounts.id, line.cycleCountId));
          }

          const variance = input.countedQuantity - line.systemQuantity;

          const [updated] = await tx
            .update(cycleCountLines)
            .set({
              countedQuantity: input.countedQuantity,
              notes: input.notes,
              updatedAt: new Date(),
              variance,
            })
            .where(eq(cycleCountLines.id, input.id))
            .returning();

          return updated!;
        })
      ),

    commit: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input, context }) => {
        const commitDate = new Date();

        const committedMovements: {
          movementId: string;
          quantity: number;
          unitCost: number;
        }[] = [];

        const { skipped } = await db.transaction(async (tx) => {
          const [session] = await tx
            .select()
            .from(cycleCounts)
            .where(eq(cycleCounts.id, input.id))
            .limit(1);

          if (!session) {
            throw new ORPCError("NOT_FOUND", {
              message: "Cycle count session not found",
            });
          }

          if (session.status !== "draft" && session.status !== "in_progress") {
            throw new ORPCError("BAD_REQUEST", {
              message: "Cycle count is already completed or cancelled",
            });
          }

          const countedLines = await tx
            .select()
            .from(cycleCountLines)
            .where(
              and(
                eq(cycleCountLines.cycleCountId, input.id),
                sql`${cycleCountLines.countedQuantity} IS NOT NULL`
              )
            );

          if (countedLines.length === 0) {
            throw new ORPCError("BAD_REQUEST", {
              message: "No lines have been counted yet",
            });
          }

          let txSkipped = 0;

          for (const line of countedLines) {
            if (line.variance === 0) {
              txSkipped += 1;
              continue;
            }

            const [stockLevel] = await tx
              .select()
              .from(stockLevels)
              .where(
                and(
                  eq(stockLevels.productId, line.productId),
                  line.variantId
                    ? eq(stockLevels.variantId, line.variantId)
                    : sql`${stockLevels.variantId} IS NULL`,
                  line.locationId
                    ? eq(stockLevels.locationId, line.locationId)
                    : sql`${stockLevels.locationId} IS NULL`
                )
              )
              .limit(1);

            const currentQty = stockLevel?.quantity ?? 0;
            const reservedQty = stockLevel?.reservedQuantity ?? 0;
            // Set stock directly to what was physically counted — not relative
            // to current quantity. This avoids double-counting sales that
            // occurred between count creation and commit.
            const newQty = Math.max(0, line.countedQuantity!);
            // Actual delta applied (for movement record and journal entry)
            const actualDelta = newQty - currentQty;

            if (stockLevel) {
              await tx
                .update(stockLevels)
                .set({
                  availableQuantity: Math.max(0, newQty - reservedQty),
                  lastMovementAt: commitDate,
                  quantity: newQty,
                  updatedAt: commitDate,
                })
                .where(eq(stockLevels.id, stockLevel.id));
            } else {
              await tx.insert(stockLevels).values({
                availableQuantity: newQty,
                lastMovementAt: commitDate,
                locationId: line.locationId,
                productId: line.productId,
                quantity: newQty,
                variantId: line.variantId,
              });
            }

            const [movement] = await tx
              .insert(stockMovements)
              .values({
                locationId: line.locationId,
                newQuantity: newQty,
                previousQuantity: currentQty,
                productId: line.productId,
                quantity: actualDelta,
                reason: "Cycle count variance",
                referenceId: input.id,
                referenceType: "cycle_count",
                type: "cycle_count",
                userId: context.session.user.id,
                variantId: line.variantId,
              })
              .returning({ id: stockMovements.id });

            if (line.variantId) {
              const [totals] = await tx
                .select({ total: sum(stockLevels.quantity) })
                .from(stockLevels)
                .where(eq(stockLevels.variantId, line.variantId));
              await tx
                .update(productVariants)
                .set({
                  stockQuantity: Number(totals?.total ?? 0),
                  updatedAt: commitDate,
                })
                .where(eq(productVariants.id, line.variantId));
            }

            // Look up cost price
            let unitCost = 0;
            if (line.variantId) {
              const [v] = await tx
                .select({ costPrice: productVariants.costPrice })
                .from(productVariants)
                .where(eq(productVariants.id, line.variantId))
                .limit(1);
              unitCost = Number(v?.costPrice ?? 0);
            } else {
              const [p] = await tx
                .select({ costPrice: products.costPrice })
                .from(products)
                .where(eq(products.id, line.productId))
                .limit(1);
              unitCost = Number(p?.costPrice ?? 0);
            }

            committedMovements.push({
              movementId: movement!.id,
              quantity: actualDelta,
              unitCost,
            });
          }

          await tx
            .update(cycleCounts)
            .set({
              completedAt: commitDate,
              status: "completed",
              updatedAt: commitDate,
            })
            .where(eq(cycleCounts.id, input.id));

          await tx.insert(inventoryAuditLog).values({
            action: "committed",
            changes: JSON.stringify({
              committed: committedMovements.length,
              skipped: txSkipped,
            }),
            entityId: input.id,
            entityType: "cycle_count",
            userId: context.session.user.id,
          });

          return { skipped: txSkipped };
        });

        const committed = committedMovements.length;

        // Post journal entries outside transaction
        for (const { movementId, quantity, unitCost } of committedMovements) {
          try {
            await postInventoryVarianceJournalEntry(
              db,
              {
                date: commitDate,
                quantity,
                referenceId: movementId,
                unitCost,
              },
              context.session.user.id
            );
          } catch {
            // Accounting not configured — adjustment still succeeded
          }
        }

        return { committed, skipped, success: true };
      }),

    cancel: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) =>
        db.transaction(async (tx) => {
          const [session] = await tx
            .select()
            .from(cycleCounts)
            .where(eq(cycleCounts.id, input.id))
            .limit(1);

          if (!session) {
            throw new ORPCError("NOT_FOUND", {
              message: "Cycle count session not found",
            });
          }

          if (
            session.status === "completed" ||
            session.status === "cancelled"
          ) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Cycle count is already completed or cancelled",
            });
          }

          const [updated] = await tx
            .update(cycleCounts)
            .set({
              cancelledAt: new Date(),
              status: "cancelled",
              updatedAt: new Date(),
            })
            .where(eq(cycleCounts.id, input.id))
            .returning();

          return updated!;
        })
      ),
  },

  auditLog: {
    list: protectedProcedure
      .input(
        z.object({
          entityId: z.string().optional(),
          entityType: z.string().optional(),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
      )
      .handler(async ({ input }) => {
        const conditions = [];
        if (input.entityType) {
          conditions.push(eq(inventoryAuditLog.entityType, input.entityType));
        }
        if (input.entityId) {
          conditions.push(eq(inventoryAuditLog.entityId, input.entityId));
        }

        const [items, countResult] = await Promise.all([
          db
            .select()
            .from(inventoryAuditLog)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(inventoryAuditLog.createdAt))
            .limit(input.limit)
            .offset(input.offset),
          db
            .select({ count: sql<number>`count(*)` })
            .from(inventoryAuditLog)
            .where(conditions.length > 0 ? and(...conditions) : undefined),
        ]);

        return {
          items,
          pagination: {
            limit: input.limit,
            offset: input.offset,
            total: Number(countResult[0]?.count ?? 0),
          },
        };
      }),
  },
};
