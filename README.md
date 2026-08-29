# WAJIDX — Precision Technology & Software Studio

> **Build. Automate. Innovate.**

WAJIDX is a specialized software and digital engineering brand. This repository contains the complete portfolio showcase platform, interactive WebGL visuals, and secure dynamic Admin CMS powered by Node.js, Express, Supabase (PostgreSQL, Auth & Storage), and Vercel serverless deployment.

---

## 🌟 Key Features

* **Precision Minimalism UI/UX**: Dark-mode first (`#050505`), blueprint grid background, and electric blue accents (`#2674e7` / `#3b82f6`).
* **Interactive WebGL Shader**: Hardware-accelerated canvas background rendering dynamic particle pulses.
* **Dynamic Project Showcase**: Search, category filtering, and sorting across custom software case studies with rich SEO-friendly URLs (`/projects/:slug`).
* **Multi-Database Support**: Supabase PostgreSQL cloud database & local MySQL fallback (`devaj` database).
* **Supabase Storage & Cloud CDN**: Direct media upload storage for screenshots and assets (`wajidx-media` bucket).
* **Secure Admin CMS (`/admin`)**:
  * Supabase Auth & JWT-authenticated sessions with bcrypt password hashing.
  * Complete Project CRUD with one-click Draft/Publish and Featured toggles.
  * Categories and Technologies manager.
  * Cloud Media Library uploader with Supabase Storage CDN URLs.
  * Client inquiries inbox.
  * Global Site & SEO Settings manager.
* **SEO & AI Searchability**: Semantic HTML5 hierarchy, dynamic JSON-LD structured data (`Organization`, `SoftwareApplication`, `WebSite`, `BreadcrumbList`), dynamic `/sitemap.xml`, and `/robots.txt`.
* **Vercel Serverless Ready**: Native `vercel.json` and `api/index.js` serverless function configuration for instant deployment.

---

## ☁️ Deployment to Vercel with Supabase

### 1. Set up Supabase
1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** and run the contents of [`database/supabase_schema.sql`](./database/supabase_schema.sql).
3. (Optional) Run the seed script to populate initial project case studies:
   ```bash
   node database/supabase_seed.js
   ```
4. Copy your project credentials from **Project Settings -> API** & **Database**:
   * `SUPABASE_URL`
   * `SUPABASE_ANON_KEY`
   * `SUPABASE_SERVICE_ROLE_KEY`
   * `SUPABASE_DB_URL` (Connection string)

### 2. Deploy to Vercel
1. Push your code to GitHub:
   ```bash
   git push origin main
   ```
2. Import the repository on [vercel.com/new](https://vercel.com/new).
3. In the Vercel **Environment Variables** section, add:
   * `NODE_ENV` = `production`
   * `SITE_URL` = `https://your-project.vercel.app`
   * `JWT_SECRET` = `your_secure_random_key_here`
   * `SUPABASE_URL` = `https://your-project-id.supabase.co`
   * `SUPABASE_ANON_KEY` = `your_anon_key`
   * `SUPABASE_SERVICE_ROLE_KEY` = `your_service_role_key`
   * `SUPABASE_DB_URL` = `postgresql://postgres.xxx:[PASSWORD]@aws-0-xxx.pooler.supabase.com:6543/postgres`
4. Click **Deploy**. Your site will be live instantly!

---

## 💻 Local Development Setup

### 1. Prerequisites
* Node.js (v18+)
* MySQL or Supabase PostgreSQL

### 2. Installation
```bash
git clone https://github.com/zaitoonrestaurantandgrills-pixel/WAJIDX.git
cd WAJIDX
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` and fill in your settings:
```bash
cp .env.example .env
```

### 4. Run Migration / Seed
```bash
# For local MySQL:
npm run seed

# For Supabase PostgreSQL:
node database/supabase_seed.js
```

### 5. Start Development Server
```bash
npm start
```
* **Website**: [http://localhost:3000](http://localhost:3000)
* **Admin CMS**: [http://localhost:3000/admin](http://localhost:3000/admin)
* **Default Admin**: `admin` / `Admin@Wajidx2026!`

---

## 📁 Project Architecture

```
WAJIDX/
├── api/
│   └── index.js              # Vercel Serverless Function entrypoint
├── config/
│   ├── db.js                 # Unified database adapter (Supabase Postgres / MySQL)
│   └── supabase.js           # Supabase client & Storage uploader
├── database/
│   ├── schema.sql            # MySQL schema (devaj)
│   ├── seed.js               # MySQL seed script
│   ├── supabase_schema.sql   # Supabase PostgreSQL schema & storage policies
│   └── supabase_seed.js      # Supabase database seeder
├── middleware/
│   └── auth.js               # Supabase Auth & JWT verification middleware
├── public/
│   ├── index.html            # Core SPA shell & SEO markup
│   ├── css/
│   │   └── style.css         # Precision Dark Theme & responsive design
│   ├── js/
│   │   ├── app.js            # Client-side router, search, filter & views
│   │   ├── admin.js          # Dynamic Admin CMS dashboard
│   │   └── shader.js         # WebGL interactive background
│   └── uploads/              # Local media storage fallback
├── routes/
│   ├── admin.js              # Admin CRUD & Supabase Storage upload
│   ├── api.js                # Public JSON REST API
│   └── auth.js               # Supabase Auth & JWT login endpoints
├── .env.example              # Environment variables template
├── package.json              # Dependencies & npm scripts
├── server.js                 # Express server & SEO endpoints
└── vercel.json               # Vercel routing & edge cache configuration
```

---

## 🔒 License
Proprietary © 2026 WAJIDX. Engineered with precision.
