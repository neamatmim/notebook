# Enterprise Grade Inventory Management & POS System

A complete inventory management and point-of-sale system built with Better-T-Stack (TanStack Start + Better Auth + oRPC + Drizzle ORM).

## 🚀 Features

### Inventory Management

- **Product Management**: Complete product catalog with SKUs, barcodes, pricing, and categories
- **Supplier Management**: Track suppliers with contact information and payment terms
- **Stock Control**: Real-time stock levels, automatic adjustments, and movement tracking
- **Purchase Orders**: Create, track, and receive purchase orders
- **Multi-location Support**: Manage inventory across multiple locations/warehouses
- **Low Stock Alerts**: Automated notifications for products below minimum levels

### Point of Sale (POS)

- **Modern POS Interface**: Clean, touch-friendly interface for quick transactions
- **Product Search**: Fast product lookup by name, SKU, or barcode
- **Customer Management**: Customer profiles with loyalty points and purchase history
- **Multiple Payment Methods**: Cash, cards, gift cards, and mobile payments
- **Returns Processing**: Full return workflow with restocking capabilities
- **Receipt Generation**: Professional receipts with itemized details
- **Real-time Inventory Updates**: Automatic stock adjustments on sales

### Analytics & Reporting

- **Sales Analytics**: Daily, weekly, monthly sales reporting
- **Inventory Reports**: Stock levels, movement history, and turnover analysis
- **Customer Analytics**: Purchase patterns and loyalty program metrics
- **Employee Performance**: Sales tracking per employee and shift

## 🏗️ Architecture

### Database Schema

**Inventory Tables:**

- `categories` - Product categorization hierarchy
- `suppliers` - Supplier information and contacts
- `products` - Main product catalog
- `product_variants` - Product variations (size, color, etc.)
- `locations` - Warehouse/store locations
- `stock_levels` - Current inventory quantities per location
- `stock_movements` - All inventory transactions
- `purchase_orders` & `purchase_order_items` - Purchasing workflow

**POS Tables:**

- `customers` - Customer profiles and loyalty data
- `employees` - Staff management and permissions
- `shifts` - Employee shift tracking
- `sales` & `sale_items` - Transaction records
- `payments` - Payment processing details
- `returns` & `return_items` - Return processing
- `discounts` & `discount_usages` - Promotion system
- `gift_cards` & `gift_card_transactions` - Gift card management

### Tech Stack

- **Frontend**: React 19 + TanStack Router + TanStack Query
- **Backend**: oRPC for type-safe APIs
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth
- **UI**: Tailwind CSS + shadcn/ui components
- **Build System**: Vite + Turborepo

## 🛠️ Setup & Installation

### Prerequisites

- Node.js 18+ and Bun
- PostgreSQL database
- Environment variables configured

### Development Setup

1. **Install dependencies**:

   ```bash
   bun install
   ```

2. **Set up environment variables**:
   Create `.env` files in appropriate packages with:

   ```
   DATABASE_URL=postgresql://user:pass@localhost:5432/inventory_pos
   BETTER_AUTH_SECRET=your-auth-secret
   ```

3. **Initialize database**:

   ```bash
   bun run db:push
   ```

4. **Start development server**:
   ```bash
   bun run dev
   ```

### Production Deployment

1. **Build the application**:

   ```bash
   bun run build
   ```

2. **Run database migrations**:

   ```bash
   bun run db:migrate
   ```

3. **Start production server**:
   ```bash
   bun run start
   ```

## 📱 Usage Guide

### Inventory Management

**Adding Products:**

1. Navigate to `/inventory/products`
2. Click "Add Product"
3. Fill in product details (SKU, name, pricing, etc.)
4. Assign to categories and suppliers
5. Set stock levels and reorder points

**Managing Stock:**

1. Go to `/inventory/stock-movements`
2. Use "Adjust Stock Levels" for manual adjustments
3. Track all movements (sales, purchases, adjustments)
4. Monitor low stock alerts

**Purchase Orders:**

1. Create new PO at `/inventory/purchase-orders/new`
2. Select supplier and add products
3. Submit for approval
4. Receive inventory when delivered
5. Automatic stock level updates

### Point of Sale

**Processing Sales:**

1. Open POS terminal at `/pos`
2. Search and add products to cart
3. Select customer (optional)
4. Choose payment method
5. Complete transaction
6. Print/email receipt

**Customer Management:**

1. Add new customers at `/pos/customers`
2. Track loyalty points automatically
3. View purchase history
4. Apply customer-specific discounts

**Returns Processing:**

1. Look up original sale
2. Select items to return
3. Choose return reason
4. Process refund
5. Restock items if applicable

## 🔐 Security Features

- **Role-based Access Control**: Employee permissions and restrictions
- **Audit Trail**: Complete transaction and change history
- **Secure Authentication**: Better Auth integration
- **Data Validation**: Type-safe APIs with Zod validation
- **Session Management**: Secure user sessions

## 📊 API Endpoints

### Inventory API (`/api/rpc/inventory`)

- `products.*` - Product CRUD operations
- `categories.*` - Category management
- `suppliers.*` - Supplier operations
- `stock.*` - Stock level management
- `purchaseOrders.*` - Purchase order workflow

### POS API (`/api/rpc/pos`)

- `sales.*` - Transaction processing
- `customers.*` - Customer management
- `employees.*` - Staff operations
- `returns.*` - Return processing
- `giftCards.*` - Gift card system
- `analytics.*` - Reporting and metrics

## 🧪 Testing

**Run all tests**:

```bash
bun run test
```

**Type checking**:

```bash
bun run check-types
```

**Linting**:

```bash
bun run check
```

## 📈 Performance

- **Optimized Queries**: Efficient database queries with proper indexing
- **Real-time Updates**: Live inventory tracking
- **Caching**: Smart query caching with TanStack Query
- **Lazy Loading**: Component-level code splitting
- **Type Safety**: Full TypeScript coverage

## 🚀 Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
RUN bun run build
CMD ["bun", "run", "start"]
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...
DATABASE_DIRECT_URL=postgresql://...

# Authentication
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_BASE_URL=https://your-domain.com

# Application
NODE_ENV=production
PORT=3000
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Create an issue on GitHub
- Check the documentation
- Review API endpoints in the code

---

Built with ❤️ using Better-T-Stack and modern web technologies.
