# 👨‍🍳 Chef Book

A delightful digital recipe book application designed for food lovers to manage their personal collection of delicious recipes.

## 📖 Overview

Chef Book is a modern, responsive web application (PWA) that allows users to create, organize, and view recipes. It features a beautiful interface with rich animations, user authentication, and an administrative dashboard for managing the platform.

## ✨ Features

- **User Authentication**: Secure login and session management.
- **Recipe Management**:
  - Add new recipes with details like ingredients, instructions, prep time, and photos.
  - Categorize recipes (Cakes, Cookies, Pastries, Pies, Breads, etc.).
  - Search recipes instantly.
  - Delete individual or all recipes.
- **Interactive UI**:
  - Beautiful glassmorphism design.
  - Tab-based navigation.
  - Responsive layout for mobile and desktop.
- **Export Functionality**: Save your recipes as PDF documents (`jspdf`).
- **Admin Dashboard**: Dedicated area for administrators to manage users and system metrics.
- **PWA Ready**: Built with Capacitor and Vite PWA for a native-like experience on mobile devices.
- **User Profile**: Edit profile details including display name and password.

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla CSS3, JavaScript (ES6 Modules)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Mobile/PWA**: [Capacitor](https://capacitorjs.com/), vite-plugin-pwa
- **Libraries**: 
  - `jspdf` (PDF generation)
  - `boxicons` (Icons - usage inferred contextually or standard web fonts)

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### Installation

1. **Clone the repository** (or navigate to the project directory):
   ```bash
   cd my-recipe-book
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

### Running the Application

**Development Mode**:
To start the local development server:
```bash
npm run dev
```
Open your browser and navigate to the URL shown (usually `http://localhost:5173`).

**Production Build**:
To build the application for production:
```bash
npm run build
```

**Preview Production Build**:
```bash
npm run preview
```

### Mobile (Android)
If you have the Android environment set up:
```bash
npx cap open android
```

## 📝 Usage

1. **Register/Login**: Start by logging in to access your recipe book.
2. **Add a Recipe**: Click the "Add Recipe" tab, fill in the details (don't forget the photo!), and save.
3. **View Recipes**: Switch to "My Recipes" to see your collection. Click a recipe to view full details.
4. **Save as PDF**: Open a recipe or use the bulk action button to save recipes as PDF.
5. **Admin Access**: (If applicable) Navigate to `/admin.html` or use the dashboard button if logged in as an admin.

## 📄 License

This project is for educational and personal use.

---
Created with ❤️ by the Chef Book Team.
