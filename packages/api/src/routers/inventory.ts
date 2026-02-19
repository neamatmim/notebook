import { db } from "@notebook/db";
import {
  categories,
  locations,
  products,
  productVariants,
  purchaseOrderItems,
  purchaseOrders,
  stockLevels,
  stockMovements,
  suppliers,
} from "@notebook/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

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
  phone: z.string().optional(),
  state: z.string().optional(),
  taxId: z.string().optional(),
  zipCode: z.string().optional(),
});

const updateSupplierSchema = createSupplierSchema.partial();

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
      itemId: z.string().uuid(),
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
      .input(paginationSchema)
      .handler(async ({ input }) => {
        const [items, totalCountResult] = await Promise.all([
          db
            .select()
            .from(suppliers)
            .where(eq(suppliers.status, "active"))
            .limit(input.limit)
            .offset(input.offset)
            .orderBy(suppliers.name),
          db
            .select({ count: sql<number>`count(*)` })
            .from(suppliers)
            .where(eq(suppliers.status, "active")),
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

    list: protectedProcedure.handler(async () => {
      const locations_data = await db
        .select()
        .from(locations)
        .where(eq(locations.isActive, true))
        .orderBy(locations.name);

      return locations_data;
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

  // Stock Management
  stock: {
    adjust: protectedProcedure.input(stockAdjustmentSchema).handler(
      async ({ input, context }) =>
        await db.transaction(async (tx) => {
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
            .limit(1);

          const currentQuantity = stockLevel[0]?.quantity ?? 0;
          const newQuantity = Math.max(0, currentQuantity + input.quantity);

          if (stockLevel.length > 0) {
            await tx
              .update(stockLevels)
              .set({
                availableQuantity: newQuantity,
                lastMovementAt: new Date(),
                quantity: newQuantity,
                updatedAt: new Date(),
              })
              .where(eq(stockLevels.id, stockLevel[0].id));
          } else {
            await tx.insert(stockLevels).values({
              availableQuantity: newQuantity,
              lastMovementAt: new Date(),
              locationId: input.locationId,
              productId: input.productId,
              quantity: newQuantity,
              variantId: input.variantId,
            });
          }

          await tx.insert(stockMovements).values({
            locationId: input.locationId,
            newQuantity,
            notes: input.notes,
            previousQuantity: currentQuantity,
            productId: input.productId,
            quantity: input.quantity,
            reason: input.reason,
            type: "adjustment",
            userId: context.session.user.id,
            variantId: input.variantId,
          });

          return { newQuantity, success: true };
        })
    ),

    movements: protectedProcedure
      .input(
        z.object({
          limit: z.number().int().min(1).max(100).default(20),
          locationId: z.string().uuid().optional(),
          offset: z.number().int().min(0).default(0),
          productId: z.string().uuid().optional(),
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
  },

  // Purchase Orders
  purchaseOrders: {
    create: protectedProcedure.input(createPurchaseOrderSchema).handler(
      async ({ input, context }) =>
        await db.transaction(async (tx) => {
          const poNumber = `PO-${Date.now()}`;

          let subtotal = 0;
          for (const item of input.items) {
            subtotal += Number(item.unitCost) * item.quantity;
          }

          const [order] = await tx
            .insert(purchaseOrders)
            .values({
              createdBy: context.session.user.id,
              expectedDate: input.expectedDate
                ? new Date(input.expectedDate)
                : undefined,
              notes: input.notes,
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
              purchaseOrderId: order.id,
              quantity: item.quantity,
              totalCost: totalCost.toString(),
              unitCost: item.unitCost,
              variantId: item.variantId,
            });
          }

          return order;
        })
    ),

    get: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .handler(async ({ input }) => {
        const [order] = await db
          .select({
            expectedDate: purchaseOrders.expectedDate,
            id: purchaseOrders.id,
            notes: purchaseOrders.notes,
            orderDate: purchaseOrders.orderDate,
            poNumber: purchaseOrders.poNumber,
            receivedDate: purchaseOrders.receivedDate,
            shippingCost: purchaseOrders.shippingCost,
            status: purchaseOrders.status,
            subtotal: purchaseOrders.subtotal,
            supplier: {
              email: suppliers.email,
              id: suppliers.id,
              name: suppliers.name,
              phone: suppliers.phone,
            },
            taxAmount: purchaseOrders.taxAmount,
            totalAmount: purchaseOrders.totalAmount,
          })
          .from(purchaseOrders)
          .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
          .where(eq(purchaseOrders.id, input.id));

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

        return { ...order, items };
      }),

    list: protectedProcedure
      .input(paginationSchema)
      .handler(async ({ input }) => {
        const [items, totalCountResult] = await Promise.all([
          db
            .select({
              expectedDate: purchaseOrders.expectedDate,
              id: purchaseOrders.id,
              orderDate: purchaseOrders.orderDate,
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
            .limit(input.limit)
            .offset(input.offset)
            .orderBy(desc(purchaseOrders.createdAt)),
          db.select({ count: sql<number>`count(*)` }).from(purchaseOrders),
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

    receive: protectedProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          items: receivePurchaseOrderSchema.shape.items,
        })
      )
      .handler(
        async ({ input, context }) =>
          await db.transaction(async (tx) => {
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

              await tx
                .update(purchaseOrderItems)
                .set({
                  receivedQuantity:
                    orderItem.receivedQuantity + item.receivedQuantity,
                  updatedAt: new Date(),
                })
                .where(eq(purchaseOrderItems.id, item.itemId));

              if (item.receivedQuantity > 0) {
                const stockLevel = await tx
                  .select()
                  .from(stockLevels)
                  .where(
                    and(
                      eq(stockLevels.productId, orderItem.productId),
                      orderItem.variantId
                        ? eq(stockLevels.variantId, orderItem.variantId)
                        : sql`${stockLevels.variantId} IS NULL`
                    )
                  )
                  .limit(1);

                const currentQuantity = stockLevel[0]?.quantity ?? 0;
                const newQuantity = currentQuantity + item.receivedQuantity;

                if (stockLevel.length > 0) {
                  await tx
                    .update(stockLevels)
                    .set({
                      availableQuantity: newQuantity,
                      lastMovementAt: new Date(),
                      quantity: newQuantity,
                      updatedAt: new Date(),
                    })
                    .where(eq(stockLevels.id, stockLevel[0].id));
                } else {
                  await tx.insert(stockLevels).values({
                    availableQuantity: newQuantity,
                    lastMovementAt: new Date(),
                    productId: orderItem.productId,
                    quantity: newQuantity,
                    variantId: orderItem.variantId,
                  });
                }

                await tx.insert(stockMovements).values({
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
              }
            }

            await tx
              .update(purchaseOrders)
              .set({
                receivedDate: new Date(),
                status: "received",
                updatedAt: new Date(),
              })
              .where(eq(purchaseOrders.id, input.id));

            return { success: true };
          })
      ),
  },
};
