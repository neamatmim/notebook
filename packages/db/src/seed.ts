import dotenv from "dotenv";

import { db } from "./index";
import {
  categories,
  suppliers,
  products,
  locations,
  stockLevels,
  customers,
  employees,
} from "./schema";

dotenv.config({
  path: "../../apps/web/.env",
});

async function seed() {
  console.log("🌱 Starting database seed...");

  try {
    // Create sample categories
    const [electronicsCategory, clothingCategory, homeCategory] = await db
      .insert(categories)
      .values([
        {
          description: "Electronic devices and accessories",
          name: "Electronics",
        },
        { description: "Apparel and fashion items", name: "Clothing" },
        {
          description: "Home improvement and garden supplies",
          name: "Home & Garden",
        },
      ])
      .returning();

    // Create sample suppliers
    const [techSupplier, fashionSupplier, homeSupplier] = await db
      .insert(suppliers)
      .values([
        {
          address: "123 Tech Street",
          city: "San Francisco",
          contactName: "John Smith",
          country: "USA",
          email: "orders@techcorp.com",
          name: "TechCorp Inc",
          phone: "(555) 123-4567",
          state: "CA",
          zipCode: "94105",
        },
        {
          address: "456 Fashion Ave",
          city: "New York",
          contactName: "Sarah Johnson",
          country: "USA",
          email: "wholesale@fashionforward.com",
          name: "Fashion Forward Ltd",
          phone: "(555) 987-6543",
          state: "NY",
          zipCode: "10001",
        },
        {
          address: "789 Home Depot Way",
          city: "Atlanta",
          contactName: "Mike Wilson",
          country: "USA",
          email: "sales@homesolutions.com",
          name: "Home Solutions Co",
          phone: "(555) 555-0123",
          state: "GA",
          zipCode: "30309",
        },
      ])
      .returning();

    // Create sample locations
    const [mainStore, warehouse] = await db
      .insert(locations)
      .values([
        {
          address: "100 Main Street",
          city: "Downtown",
          country: "USA",
          isPrimary: true,
          name: "Main Store",
          state: "CA",
          type: "retail",
          zipCode: "90210",
        },
        {
          address: "500 Industrial Blvd",
          city: "Industrial Park",
          country: "USA",
          name: "Warehouse",
          state: "CA",
          type: "warehouse",
          zipCode: "90211",
        },
      ])
      .returning();

    // Create sample products
    const sampleProducts = [
      {
        categoryId: electronicsCategory.id,
        costPrice: "699.99",
        description: "Latest flagship smartphone with advanced features",
        minStockLevel: 5,
        name: "Smartphone Pro",
        reorderPoint: 10,
        sellingPrice: "999.99",
        sku: "PHONE-001",
        supplierId: techSupplier.id,
        unit: "pcs",
      },
      {
        categoryId: electronicsCategory.id,
        costPrice: "1299.99",
        description: "High-performance laptop for professionals",
        minStockLevel: 3,
        name: "UltraBook Pro",
        reorderPoint: 5,
        sellingPrice: "1799.99",
        sku: "LAPTOP-001",
        supplierId: techSupplier.id,
        unit: "pcs",
      },
      {
        categoryId: clothingCategory.id,
        costPrice: "12.99",
        description: "Comfortable 100% cotton t-shirt",
        minStockLevel: 20,
        name: "Cotton T-Shirt",
        reorderPoint: 50,
        sellingPrice: "24.99",
        sku: "SHIRT-001",
        supplierId: fashionSupplier.id,
        unit: "pcs",
      },
      {
        categoryId: clothingCategory.id,
        costPrice: "29.99",
        description: "Classic denim jeans, various sizes",
        minStockLevel: 15,
        name: "Denim Jeans",
        reorderPoint: 30,
        sellingPrice: "59.99",
        sku: "JEANS-001",
        supplierId: fashionSupplier.id,
        unit: "pcs",
      },
      {
        categoryId: homeCategory.id,
        costPrice: "149.99",
        description: "Ergonomic office chair with lumbar support",
        minStockLevel: 5,
        name: "Office Chair",
        reorderPoint: 10,
        sellingPrice: "249.99",
        sku: "CHAIR-001",
        supplierId: homeSupplier.id,
        unit: "pcs",
      },
    ];

    const createdProducts = await db
      .insert(products)
      .values(sampleProducts)
      .returning();

    // Create initial stock levels
    const stockLevelData = [];
    for (const product of createdProducts) {
      // Stock for main store
      stockLevelData.push({
        productId: product.id,
        locationId: mainStore.id,
        quantity: Math.floor(Math.random() * 50) + 10, // 10-60 items
        availableQuantity: Math.floor(Math.random() * 50) + 10,
      });

      // Stock for warehouse
      stockLevelData.push({
        productId: product.id,
        locationId: warehouse.id,
        quantity: Math.floor(Math.random() * 100) + 50, // 50-150 items
        availableQuantity: Math.floor(Math.random() * 100) + 50,
      });
    }

    await db.insert(stockLevels).values(stockLevelData);

    // Create sample customers
    await db.insert(customers).values([
      {
        customerNumber: "CUS-001",
        email: "john.doe@example.com",
        firstName: "John",
        lastName: "Doe",
        loyaltyPoints: 150,
        phone: "(555) 123-4567",
        totalSpent: "450.00",
        type: "regular",
      },
      {
        customerNumber: "CUS-002",
        email: "jane.smith@example.com",
        firstName: "Jane",
        lastName: "Smith",
        loyaltyPoints: 500,
        phone: "(555) 987-6543",
        totalSpent: "1250.00",
        type: "vip",
      },
      {
        customerNumber: "CUS-003",
        email: "bob.johnson@example.com",
        firstName: "Bob",
        lastName: "Johnson",
        loyaltyPoints: 0,
        phone: "(555) 555-0123",
        totalSpent: "2500.00",
        type: "wholesale",
      },
    ]);

    // Create sample employees
    await db.insert(employees).values([
      {
        canApplyDiscounts: true,
        canProcessReturns: true,
        department: "sales",
        email: "alice@company.com",
        employeeNumber: "EMP-001",
        firstName: "Alice",
        hourlyRate: "25.00",
        lastName: "Manager",
        maxDiscountPercent: "20.00",
        role: "manager",
        userId: "user-1",
      },
      {
        canApplyDiscounts: true,
        canProcessReturns: false,
        department: "sales",
        email: "bob@company.com",
        employeeNumber: "EMP-002",
        firstName: "Bob",
        hourlyRate: "15.00",
        lastName: "Cashier",
        maxDiscountPercent: "5.00",
        role: "cashier",
        userId: "user-2",
      },
    ]);

    console.log("✅ Database seeded successfully!");
    console.log("📊 Created:");
    console.log(`  - ${createdProducts.length} products`);
    console.log(`  - 3 categories`);
    console.log(`  - 3 suppliers`);
    console.log(`  - 2 locations`);
    console.log(`  - ${stockLevelData.length} stock level entries`);
    console.log(`  - 3 customers`);
    console.log(`  - 2 employees`);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

seed().then(() => {
  console.log("🎉 Seed completed!");
  process.exit(0);
});
