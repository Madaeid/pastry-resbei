# 🧁 Chef Book - Backend API

A Node.js + Express + SQLite backend server for the Chef Book application.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or yarn

### Installation

1. **Install dependencies:**
```bash
cd server
npm install
```

2. **Initialize the database:**
```bash
npm run init-db
```
This creates the SQLite database with all tables and a default admin user.

3. **Start the server:**
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will run at `http://localhost:3001`

## 📁 Project Structure

```
server/
├── database/
│   ├── db.js           # Database connection module
│   ├── init.js         # Database initialization script
│   └── pastry.db       # SQLite database file (created after init)
├── middleware/
│   └── auth.js         # JWT authentication middleware
├── routes/
│   ├── auth.js         # Authentication routes
│   ├── users.js        # User profile routes
│   ├── recipes.js      # Recipe CRUD routes
│   ├── subscriptions.js # Subscription & payment routes
│   └── admin.js        # Admin management routes
├── .env                # Environment configuration
├── package.json        # Dependencies
├── server.js           # Main Express server
└── README.md           # This file
```

## 🔐 Default Admin Account

After running `npm run init-db`:
- **Username:** `admin`
- **Password:** `admin123`
- **Email:** `madaeid500@gmail.com`

## 📡 API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register new user |
| POST | `/login` | Login user |
| GET | `/me` | Get current user |
| POST | `/forgot-password` | Send reset code |
| POST | `/reset-password` | Reset password with code |
| POST | `/logout` | Logout user |

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
| DELETE | `/` | Delete all recipes |
| GET | `/count/total` | Get recipe count |

### Subscriptions (`/api/subscriptions`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/plans` | Get available plans |
| GET | `/status` | Check premium status |
| GET | `/details` | Get subscription details |
| POST | `/subscribe` | Process payment |
| POST | `/cancel` | Cancel subscription |
| GET | `/transactions` | Get transaction history |

### Admin (`/api/admin`) - Requires Admin Access
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats` | Get dashboard stats |
| GET | `/users` | Get all users |
| GET | `/users/:id` | Get single user |
| PUT | `/users/:id` | Update user |
| DELETE | `/users/:id` | Delete user |
| PATCH | `/users/:id/toggle-admin` | Toggle admin status |
| POST | `/users/:id/grant-premium` | Grant premium |
| POST | `/users/:id/revoke-premium` | Revoke premium |
| GET | `/recipes` | Get all recipes |
| GET | `/export` | Export all data |

## 🔧 Environment Variables

Edit `.env` file:

```env
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key-here
DATABASE_PATH=./database/pastry.db
FRONTEND_URL=http://localhost:5173
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_EMAIL=your-email@example.com
```

## 🧪 Test Cards (for demo payments)

| Card Number | Result |
|------------|--------|
| `4242 4242 4242 4242` | Success (Visa) |
| `5555 5555 5555 4444` | Success (Mastercard) |
| `3782 822463 10005` | Success (Amex) |
| `4000 0000 0000 0002` | Declined |

## 📊 Database Schema

### Users
- id, username, display_name, email, phone, birthday
- password_hash, is_admin, reset_code, reset_code_expiry
- created_at, updated_at

### Recipes
- id, user_id, name, category, prep_time, cook_time
- servings, difficulty, ingredients, instructions, notes, photo
- created_at, updated_at

### Subscriptions
- id, user_id, plan, status, start_date, end_date
- payment_last4, payment_brand, payment_expiry
- auto_renew, granted_by_admin, cancelled_at
- created_at, updated_at

### Transactions
- id, user_id, transaction_id, type, plan, amount
- status, payment_last4, payment_brand
- created_at

## 🔒 Security Features

- Password hashing with bcrypt (10 rounds)
- JWT token authentication (24h expiry)
- Rate limiting (100 requests/15min general, 20/15min for auth)
- CORS protection
- Input validation
- SQL injection prevention (prepared statements)

## 📝 License

MIT License
