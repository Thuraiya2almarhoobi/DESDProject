# Local Food Marketplace - Demo Guide

## Quick Start

The application has three user roles with different access levels:

### Login Credentials
- **Customer**: `customer@example.com` (any password)
- **Producer**: `producer@example.com` (any password)  
- **Admin**: `admin@example.com` (any password)

## Demo Flow by Test Case

### 1. Customer Journey (Browse, Search, Purchase)

**TC-001/002: Authentication & Role-Based Redirects**
1. Login with `customer@example.com`
2. Automatically redirected to `/marketplace`
3. Try accessing `/producer/dashboard` → Access Denied page

**TC-004/005/014: Browse, Search & Filters**
1. On marketplace, use search bar to find products (try "tomato" or "organic")
2. **Keyboard shortcut**: Press `/` to focus search, `Esc` to clear
3. Use left sidebar filters (desktop) or bottom sheet (mobile)
4. Filter by:
   - Categories (Vegetables, Fruit, Dairy, etc.)
   - Organic only
   - In season only
   - **In stock only** (updated terminology)
5. See applied filter chips with remove buttons below sort dropdown
6. Use **Sort dropdown**: Relevance, Price: Low to High, Price: High to Low, Newest
7. **Loading state**: Skeleton cards appear briefly on page load
8. **Empty state**: Search "xyz123" to see "No products found" with "Clear filters" button

**TC-003/013/015/016: Product Details**
1. Click any product card
2. Verify product page shows:
   - Farm/producer name + location
   - Harvest date (e.g., "Harvested Feb 14, 2026")
   - Food miles
   - Availability badge (In Season, Year-round, Unavailable)
   - Organic badge (if applicable)
   - **Allergen warning** (prominent red alert box)
   - Seasonal dates (e.g., "May - September")

**TC-006/007: Multi-Vendor Cart + Add to Cart UX**
1. On marketplace, click **"Add to cart"** button on any product card
2. **Toast notification** appears: "Added [Product Name]" with **Undo button**
3. Cart badge updates instantly in header
4. Click **Undo** in toast to reverse the add
5. Add products from different producers (e.g., Green Valley Farm + Sunrise Dairy)
6. Go to cart (`/cart`)
7. Verify items are **grouped by producer**
8. Each group shows:
   - Producer name as header
   - Delivery lead time (48 hours minimum)
   - Items with quantity controls
   - Producer subtotal
9. Adjust quantities or remove items

**TC-008: Checkout with Commission**
1. Click "Proceed to Checkout"
2. **Step 1**: Enter delivery address
3. **Step 2**: Select delivery dates **per producer** (minimum 48 hours from now)
4. **Step 3**: Continue to Stripe Checkout (test mode)
5. Verify order summary shows:
   - Per-producer sections with delivery dates
   - Subtotal
   - **5% commission line item** (very visible)
   - Total including commission
6. Stripe opens in test mode
7. Use test card `4242 4242 4242 4242` with any valid future expiry/CVC
8. On success: Order confirmation shows order number and Stripe payment ID
9. On cancel: Clear error message and reserved stock is released again

### 2. Producer Journey (Manage Products & Orders)

**TC-001/002: Producer Login**
1. Login with `producer@example.com`
2. Automatically redirected to `/producer/dashboard`
3. Try accessing `/marketplace` → Access Denied page

**Producer Dashboard**
1. See quick action cards:
   - Add Product
   - Orders
   - Inventory
   - Payments
2. View quick stats (pending orders, products listed, weekly sales)

**TC-009: Order Management**
1. Go to "Orders" page
2. Orders sorted by **delivery date**
3. Each order shows:
   - Customer details (name, email, address)
   - Order items with quantities
   - Delivery date
   - Subtotal and commission breakdown
   - **Your earnings** (subtotal - commission is for platform, producer gets full subtotal)
4. Update order status via dropdown:
   - Pending → Confirmed → Preparing → Ready → Delivered

**TC-010: Inventory Management**
1. Go to "Inventory" page
2. For each product:
   - Click "Edit" to manage
   - Update stock level
   - Toggle availability (on/off switch)
   - Changes save automatically
3. Products marked unavailable won't appear in customer searches

**TC-011: Payment Reports**
1. Go to "Payments" page
2. View weekly settlement statements
3. See breakdown:
   - Total sales (gross)
   - Commission (5%)
   - Your earnings (net)
4. Click "Export CSV" for accounting

### 3. Admin Journey (Commission Monitoring)

**TC-012: Admin Commission Tracking**
1. Login with `admin@example.com`
2. Automatically redirected to `/admin/commission`
3. View dashboard showing:
   - Total sales across platform
   - Total commission earned (5%)
   - Total orders count
4. Commission breakdown table by producer:
   - Producer name
   - Week period
   - Orders count
   - Total sales
   - Commission amount (5%)
   - Producer earnings
5. Filter by date range
6. Click "Export CSV" to download report

### 4. Error Handling & Edge Cases

**Empty States**
- Search with no results: "No products found" message
- Empty cart: "Your cart is empty" with prompt to browse
- Filters with no matches: Clear message + "Clear filters" button

**Payment Failures**
- 30% chance of payment failure (demo)
- Clear error message: "Payment failed. Please try again."
- **No duplicate order creation** on retry
- Retry button available

**Stock Conflicts**
- Products with low stock show warning: "Only X kg remaining"
- Out of stock products show "Currently Unavailable" badge
- Can't add unavailable products to cart

**Form Validation**
- Inline field errors on all forms
- Required field validation
- Min delivery date validation (48 hours)

## Key Visual Features

### Local Food System Badges
- **In Season** (green): Seasonal products currently available
- **Year-round** (blue): Always available
- **Organic** (emerald): Certified organic
- **Surplus Deal** (orange): Discounted surplus items

### Product Metadata Row
Every product shows:
- 📍 Producer name • Location
- 📅 Harvest date
- 🚚 Food miles

### Allergen Safety Block
- Prominent red alert box
- Warning icon
- Clear list of allergens
- Shows only if product contains allergens

## Technical Highlights

### Multi-Vendor Architecture
- Cart automatically groups items by producer
- Separate delivery dates per producer
- Per-producer subtotals and commission tracking

### RBAC (Role-Based Access Control)
- Customer: Marketplace, product details, cart, checkout
- Producer: Dashboard, orders, inventory, payments
- Admin: Commission monitoring
- Cross-role access attempts → Access Denied page

### Commission System
- 5% platform commission on all sales
- Shown transparently to customers at checkout
- Tracked per producer in admin dashboard
- Deducted from producer weekly settlements

### Responsive Design
- Desktop: Left sidebar filters
- Mobile: Bottom sheet filters with touch-friendly UI
- Adaptive grid layouts
- Touch-optimized controls

## Sprint 3 Demo Checklist

✅ **Passing Test Cases**
- Auth + RBAC (TC-001/002/022)
- Browse + Search + Filters (TC-004/005/014)
- Product page clarity (TC-003/013/015/016)
- Multi-vendor cart (TC-006/007)
- Checkout with commission (TC-008)
- Producer order management (TC-009)
- Inventory management (TC-010)
- Payment reporting (TC-011)
- Admin commission (TC-012)

✅ **Robust Error Handling**
- Empty states throughout
- Form validation
- Payment failure handling
- Stock conflict warnings
- RBAC denial screens

✅ **Local Food System Features**
- Harvest dates visible
- Producer origin + location
- Seasonal indicators
- Food miles tracking
- Organic certification
- Allergen warnings
- Delivery lead times (48hr minimum)

✅ **Export Functionality**
- Producer: Export payment statements (CSV)
- Admin: Export commission reports (CSV)

✅ **Non-Technical Producer UX**
- Dashboard with clear cards
- Simple order status updates
- Easy stock management
- Visual weekly payment statements
