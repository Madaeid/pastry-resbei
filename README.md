# 👨‍🍳 Chef Book

A premium, full-stack recipe management platform built for professional chefs and food lovers. Create, share, sell, and publish recipes — all in one beautiful, social-media-inspired experience.

---

## 📖 Overview

Chef Book is a modern, responsive web application (PWA) that goes far beyond a simple recipe keeper. It combines **recipe management**, a **recipe marketplace**, a **book publishing system**, an **integrated wallet**, a **daily menu planner**, **social interactions**, **chef profiles & CVs**, and **Stripe-powered payments** into one cohesive platform. Built with a beautiful glassmorphism UI, dark/light theme support, and full mobile readiness via Capacitor.

---

## ✨ Features

### 🍰 Recipe Management
- Create recipes with ingredients, instructions, photos, videos, prep/cook times, servings, and difficulty levels
- Categorize recipes (Cakes, Cookies, Pastries, Pies, Breads, etc.)
- Set recipe visibility: **Private**, **Public**, or **Selected Viewers**
- Instant search across your recipe collection
- Export recipes to **PDF** (individual or bulk)
- Delete individual or all recipes

### 🏪 Recipe Marketplace (Store)
- **Sell recipes** at custom prices on a public marketplace
- **Browse & purchase** recipes from other chefs using wallet funds or Stripe
- Tabbed interface: Browse Market · My Listings · Purchased
- Trending recipes carousel

### 📚 Chef Books
- Compile your best recipes into professional **Chef Books**
- Customize with cover photos, descriptions, themes (Classic, Modern, Minimal, Rustic), and pricing
- **Publish books** to a public marketplace for other chefs to browse and buy
- Book preview and PDF export
- Tabbed interface: My Books · Browse Books · Purchased Books

### 💰 Wallet & Payments
- Built-in **wallet system** for in-app purchases
- **Stripe integration** for topping up wallet balance and processing payments
- Buy recipes and books directly with wallet funds
- Seller credits automatically deposited on sales
- Full **transaction history**

### 💎 Premium Subscriptions
- Tiered subscription plans with Stripe Checkout
- Premium badge and exclusive features for subscribers
- Admin-grantable premium access
- Auto-renewal management

### 👩‍🍳 Social Features
- **Follow** other chefs and see them in "My Chefs" tab
- **Like**, **comment**, and **share** recipes
- Threaded comment replies with comment likes
- Quick-post card on the Home feed with photo/video support
- Search for chefs and users globally

### 📅 Daily Menu Planner
- Plan daily menus by selecting recipes from your collection
- Mark menu items as completed
- Premium-only feature

### 📄 Chef CV / Portfolio
- Build and manage a professional **culinary CV**
- Add skills, experience, education, certifications, languages
- Upload CV documents (PDF)
- View and share your CV with others

### 📈 Analytics Dashboards
- **User Dashboard**: Personal recipe stats, engagement metrics, and activity overview
- **Admin Dashboard**: Platform-wide statistics, user management, revenue metrics
- **Admin Analytics**: Detailed charts and performance data

### 🔐 Authentication & Security
- Email/password registration and login
- **Google OAuth** and **Apple OAuth** sign-in (configurable)
- JWT-based session management (24h expiry)
- Password reset via email codes
- Rate limiting (100 req/15min general, 20 req/15min auth)
- bcrypt password hashing (10 rounds)
- CORS protection
- SQL injection prevention (prepared statements)

### 🎨 User Experience
- **Glassmorphism** design with floating particles and gradient orbs
- **Dark / Light theme** with system preference detection
- Responsive sidebar navigation with smooth animations
- **Internationalization** (i18n) support for multi-language UI
- Hero section with randomized chef imagery
- PWA-ready with offline support
- Mobile-native experience via Capacitor (Android)

### 👑 Admin Panel
- Manage all users (edit, delete, toggle admin status)
- Grant or revoke premium subscriptions
- View all recipes across the platform
- Export all platform data
- System health monitoring

---

## 🛠️ Technology Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| **HTML5** | Structure & semantic markup |
| **Vanilla CSS3** | Styling with CSS custom properties, glassmorphism, animations |
| **JavaScript (ES6 Modules)** | Application logic |
| **Vite** | Build tool & dev server |
| **vite-plugin-pwa** | Progressive Web App support |
| **Capacitor** | Native mobile app (Android) |
| **jsPDF** | PDF generation & export |
| **Google Fonts** | Playfair Display, Poppins typography |

### Backend
| Technology | Purpose |
|-----------|---------|
| **Node.js** | Runtime environment |
| **Express.js** | REST API framework |
| **PostgreSQL** | Primary database |
| **Stripe** | Payment processing |
| **JWT (jsonwebtoken)** | Authentication tokens |
| **bcryptjs** | Password hashing |
| **Multer** | File upload handling |
| **express-rate-limit** | API rate limiting |
| **dotenv** | Environment configuration |
| **cors** | Cross-origin resource sharing |
| **uuid** | Unique ID generation |

### Dev Tools
| Tool | Purpose |
|------|---------|
| **concurrently** | Run client + server simultaneously |
| **nodemon** | Auto-restart server on changes |
| **vitest** | Unit testing framework |
| **supertest** | HTTP integration tests |

---

## 📁 Project Structure

```
chef-book/
├── index.html                  # Main application page
├── auth.html                   # Login / Register page
├── admin.html                  # Admin dashboard
├── admin-analytics.html        # Admin analytics page
├── user-analytics.html         # User dashboard
├── payment.html                # Subscription & payment page
├── payment-success.html        # Payment confirmation page
├── wallet.html                 # Wallet management page
├── cost-calculator.html        # Recipe cost calculator
├── daily-menu.html             # Daily menu planner
├── days-selection.html         # Day selection for planner
├── cv-edit.html                # CV editor
├── cv-view.html                # CV viewer
├── chef-profile.html           # Public chef profile page
├── profile-photo.html          # Profile photo management
│
├── main.js                     # Core app logic (recipes, books, store, social)
├── auth.js                     # Authentication logic
├── payment.js                  # Payment & subscription logic
├── wallet.js                   # Wallet management logic
├── cost-calculator.js          # Cost calculator logic
├── daily-menu.js               # Daily menu planner logic
├── social-ui.js                # Social features (likes, comments, shares)
├── recipe-utils.js             # Shared recipe utilities
├── language.js                 # Internationalization (i18n)
├── admin.js                    # Admin panel logic
├── admin-analytics.js          # Admin analytics logic
├── user-analytics.js           # User analytics logic
│
├── style.css                   # Main application styles
├── sidebar.css                 # Sidebar navigation styles
├── hero.css                    # Hero section styles
├── toggle.css                  # Toggle switch component
├── public_card.css             # Public recipe card styles
├── my_recipe_card.css          # Personal recipe card styles
├── cv-style.css                # CV page styles
├── admin-analytics.css         # Admin analytics styles
├── user-analytics.css          # User analytics styles
│
├── vite.config.js              # Vite configuration
├── capacitor.config.json       # Capacitor mobile config
├── package.json                # Frontend dependencies
│
├── public/                     # Static assets (hero images, PWA icons)
├── assets/                     # App assets
├── android/                    # Android Capacitor project
│
└── server/                     # Backend API
    ├── server.js               # Express server entry point
    ├── .env                    # Environment variables
    ├── package.json            # Server dependencies
    ├── config/
    │   └── stripe.js           # Stripe configuration
    ├── database/
    │   ├── db.js               # PostgreSQL connection pool
    │   └── init_pg.js          # Database schema initialization
    ├── middleware/
    │   └── auth.js             # JWT authentication middleware
    └── routes/
        ├── auth.js             # Authentication & password reset
        ├── oauth.js            # Google & Apple OAuth
        ├── users.js            # User profile management
        ├── recipes.js          # Recipe CRUD + social endpoints
        ├── subscriptions.js    # Subscription & Stripe checkout
        ├── admin.js            # Admin user/recipe management
        ├── dailyMenu.js        # Daily menu planner
        ├── cv.js               # Chef CV management
        ├── store.js            # Recipe marketplace
        ├── wallet.js           # Wallet & transfers
        └── books.js            # Chef Books & book marketplace
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18 or higher
- **npm** (Node Package Manager)
- **PostgreSQL** database server

### 1. Clone the Repository
```bash
git clone https://github.com/Madaeid/pastry-resbei.git
cd pastry-resbei
```

### 2. Install Dependencies
```bash
# Frontend dependencies
npm install

# Backend dependencies
cd server
npm install
cd ..
```

### 3. Configure Environment
Create or edit `server/.env`:
```env
# Server
PORT=3001
NODE_ENV=development

# JWT Secret (change in production!)
JWT_SECRET=your-super-secret-key

# PostgreSQL Database
DATABASE_URL=postgresql://username:password@localhost:5432/resipebook

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Admin Account
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_EMAIL=your-email@example.com

# Stripe Keys (get from https://dashboard.stripe.com)
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Google OAuth (optional - https://console.cloud.google.com)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

# Apple OAuth (optional - https://developer.apple.com)
APPLE_CLIENT_ID=your-apple-service-id
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_REDIRECT_URI=http://localhost:3001/api/auth/apple/callback
```

### 4. Initialize the Database
```bash
cd server
npm run init-db
```
This creates all tables, indexes, and a default admin user.

### 5. Run the Application
```bash
# From the project root — starts both frontend & backend
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend (Vite) | `http://localhost:5173` |
| Backend API | `http://localhost:3001` |

### 6. Mobile (Android)
If you have the Android SDK set up:
```bash
npx cap open android
```

---

## 📡 API Reference

### Authentication (`/api/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register a new user |
| POST | `/login` | Login and receive JWT |
| GET | `/me` | Get current authenticated user |
| POST | `/forgot-password` | Send password reset code |
| POST | `/reset-password` | Reset password with code |
| POST | `/logout` | Invalidate session |

### OAuth (`/api/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/google` | Initiate Google OAuth |
| GET | `/google/callback` | Google OAuth callback |
| POST | `/apple` | Initiate Apple OAuth |
| GET | `/apple/callback` | Apple OAuth callback |

### Users (`/api/users`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profile` | Get user profile |
| PUT | `/profile` | Update user profile |

### Recipes (`/api/recipes`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get all user recipes |
| GET | `/:id` | Get single recipe |
| POST | `/` | Create recipe |
| PUT | `/:id` | Update recipe |
| DELETE | `/:id` | Delete recipe |
| DELETE | `/` | Delete all user recipes |
| GET | `/count/total` | Get recipe count |

### Store / Marketplace (`/api/store`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Browse marketplace listings |
| POST | `/` | List a recipe for sale |
| GET | `/my-listings` | Get seller's own listings |
| GET | `/purchased` | Get buyer's purchased recipes |
| POST | `/:id/purchase` | Purchase a recipe |

### Books (`/api/books`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get user's books |
| POST | `/` | Create a new book |
| GET | `/:id` | Get book details |
| PUT | `/:id` | Update book metadata |
| DELETE | `/:id` | Delete a book |
| POST | `/:id/recipes` | Add recipes to book |
| DELETE | `/:id/recipes/:recipeId` | Remove recipe from book |
| GET | `/public` | Browse public books |
| POST | `/:id/purchase` | Purchase a book |
| GET | `/purchased` | Get purchased books |

### Wallet (`/api/wallet`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/balance` | Get wallet balance |
| POST | `/top-up` | Add funds via Stripe |
| POST | `/transfer` | Transfer funds |
| GET | `/transactions` | Get transaction history |

### Subscriptions (`/api/subscriptions`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/plans` | Get available plans |
| GET | `/status` | Check premium status |
| GET | `/details` | Get subscription details |
| POST | `/subscribe` | Start Stripe checkout |
| POST | `/cancel` | Cancel subscription |
| GET | `/transactions` | Get payment history |

### Daily Menu (`/api/daily-menu`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:date` | Get menu for a date |
| POST | `/` | Create/update daily menu |
| PUT | `/:id/items/:itemId` | Update menu item |
| DELETE | `/:id/items/:itemId` | Remove menu item |

### CV (`/api/cv`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get user's CV |
| POST | `/` | Create or update CV |

### Admin (`/api/admin`) — *Requires Admin Access*
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats` | Platform dashboard stats |
| GET | `/users` | Get all users |
| GET | `/users/:id` | Get single user |
| PUT | `/users/:id` | Update user |
| DELETE | `/users/:id` | Delete user |
| PATCH | `/users/:id/toggle-admin` | Toggle admin status |
| POST | `/users/:id/grant-premium` | Grant premium access |
| POST | `/users/:id/revoke-premium` | Revoke premium access |
| GET | `/recipes` | Get all recipes |
| GET | `/export` | Export all platform data |

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | API health status |

---

## 🗄️ Database Schema

### Core Tables
| Table | Description |
|-------|-------------|
| `users` | User accounts with profile, OAuth, visibility settings |
| `recipes` | Recipes with full metadata, photos, video, visibility |
| `sessions` | JWT session management |

### Social Tables
| Table | Description |
|-------|-------------|
| `recipe_likes` | Recipe likes (unique per user) |
| `recipe_comments` | Comments with threaded replies |
| `comment_likes` | Comment likes (unique per user) |
| `recipe_shares` | Recipe share tracking |
| `follows` | User follow relationships |

### Marketplace Tables
| Table | Description |
|-------|-------------|
| `store_recipes` | Recipes listed for sale |
| `store_purchases` | Recipe purchase records |
| `books` | Chef Books with theme, pricing, visibility |
| `book_recipes` | Recipes assigned to books |
| `book_purchases` | Book purchase records |

### Financial Tables
| Table | Description |
|-------|-------------|
| `subscriptions` | User subscription plans & Stripe data |
| `transactions` | All payment & wallet transactions |

### Other Tables
| Table | Description |
|-------|-------------|
| `cvs` | Chef CVs / portfolios |
| `daily_menus` | Planned daily menus |
| `daily_menu_items` | Individual items in daily menus |

---

## 🧪 Test Cards (Stripe Test Mode)

| Card Number | Result |
|------------|--------|
| `4242 4242 4242 4242` | ✅ Success (Visa) |
| `5555 5555 5555 4444` | ✅ Success (Mastercard) |
| `3782 822463 10005` | ✅ Success (Amex) |
| `4000 0000 0000 0002` | ❌ Declined |

---

## 📝 Usage Guide

1. **Register / Login** — Create an account or sign in with email, Google, or Apple
2. **Home Feed** — Browse community recipes, quick-post, like & comment
3. **My Recipes** — Add, edit, search, and export your personal recipes
4. **Chefs** — Discover other chefs, follow your favorites
5. **Store** — Buy and sell individual recipes on the marketplace
6. **Chef Book** — Create professional recipe books, publish to marketplace
7. **Wallet** — Top up funds, buy content, view transaction history
8. **Daily Menu** — Plan your daily cooking schedule (Premium)
9. **My CV** — Build and share your professional chef portfolio
10. **Calculator** — Estimate recipe costs
11. **Dashboard** — Track your stats and engagement
12. **Admin Panel** — Manage users, recipes, and platform data (admin only)

---

## 📄 License

MIT License

---

Created with ❤️ by the Chef Book Team.
