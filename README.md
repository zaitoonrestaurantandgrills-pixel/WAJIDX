# WAJIDX — Precision Technology & Software Studio

> **Build. Automate. Innovate.**

WAJIDX is a specialized software and digital engineering brand. This repository contains the complete portfolio showcase platform, interactive WebGL visuals, and secure dynamic Admin CMS powered by Node.js, Express, and MySQL.

---

## 🌟 Key Features

* **Precision Minimalism UI/UX**: Dark-mode first (`#050505`), blueprint grid background, and electric blue accents (`#2674e7` / `#3b82f6`).
* **Interactive WebGL Shader**: Hardware-accelerated canvas background rendering dynamic particle pulses.
* **Dynamic Project Showcase**: Search, category filtering, and sorting across custom software case studies with rich SEO-friendly URLs (`/projects/:slug`).
* **Relational SQL Database**: Complete database schema with `wajidx_` prefix (projects, categories, technologies, features, gallery, messages, and settings).
* **Secure Admin CMS (`/admin`)**:
  * JWT-authenticated session with bcrypt password hashing.
  * Complete Project CRUD with one-click Draft/Publish and Featured toggles.
  * Categories and Technologies manager.
  * Drag-and-drop Media Library uploader.
  * Client inquiries inbox.
  * Global Site & SEO Settings manager.
* **SEO & AI Searchability**: Semantic HTML5 hierarchy, dynamic JSON-LD structured data (`Organization`, `SoftwareApplication`, `WebSite`, `BreadcrumbList`), dynamic `/sitemap.xml`, and `/robots.txt`.

---

## 🚀 Quick Start

### 1. Prerequisites
* Node.js (v18+)
* MySQL / MariaDB (running on `localhost:3306`)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/<username>/WAJIDX.git
cd WAJIDX

# Install dependencies
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```env
PORT=3000
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=devaj
JWT_SECRET=your_super_secret_jwt_key_here
ADMIN_DEFAULT_USER=admin
ADMIN_DEFAULT_EMAIL=admin@wajidx.com
ADMIN_DEFAULT_PASSWORD=Admin@Wajidx2026!
SITE_URL=http://localhost:3000
```

### 4. Database Migration & Seeding
```bash
node database/seed.js
```

### 5. Start Server
```bash
node server.js
```

* Public Website: `http://localhost:3000`
* Admin Portal: `http://localhost:3000/admin`

---

## 📂 Project Structure

```
WAJIDX/
├── config/
│   └── db.js                 # MySQL Connection Pool
├── database/
│   ├── schema.sql            # Table definitions (wajidx_ prefix)
│   └── seed.js               # Initial data & admin credentials seeder
├── middleware/
│   └── auth.js               # JWT verification & admin guard
├── routes/
│   ├── api.js                # Public API endpoints
│   ├── admin.js              # Protected Admin CMS APIs
│   └── auth.js               # Admin authentication routes
├── public/
│   ├── assets/               # Logos, icons, and static graphics
│   ├── css/
│   │   └── style.css         # Blueprint grid, glassmorphism, animations
│   ├── js/
│   │   ├── app.js            # Public SPA controller & router
│   │   ├── admin.js          # Admin Dashboard SPA controller
│   │   └── shader.js         # Dynamic WebGL Shader Canvas
│   ├── uploads/              # Uploaded project screenshots & media
│   ├── favicon.png
│   └── index.html            # Main HTML Shell & Tailwind config
├── .env.example
├── .gitignore
├── package.json
└── server.js                 # Express Application Entry Point
```

---

## 🛡️ Security

All admin routes and `/api/admin/*` endpoints strictly require token authentication verified at the server and database layer.

---

## 📄 License
ISC © 2026 WAJIDX. All rights reserved.
