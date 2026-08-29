require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { testConnection, query } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', apiRoutes);

// Dynamic robots.txt
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(
`User-agent: *
Allow: /
Allow: /projects
Allow: /projects/*
Allow: /about
Allow: /services
Allow: /process
Allow: /contact
Disallow: /admin
Disallow: /admin/*
Disallow: /api/admin/*
Disallow: /api/auth/*

Sitemap: ${SITE_URL}/sitemap.xml
`
  );
});

// Dynamic sitemap.xml
app.get('/sitemap.xml', async (req, res) => {
  try {
    const staticRoutes = [
      { path: '', changefreq: 'daily', priority: '1.0' },
      { path: '/projects', changefreq: 'daily', priority: '0.9' },
      { path: '/about', changefreq: 'monthly', priority: '0.8' },
      { path: '/services', changefreq: 'monthly', priority: '0.8' },
      { path: '/process', changefreq: 'monthly', priority: '0.8' },
      { path: '/contact', changefreq: 'monthly', priority: '0.7' }
    ];

    const [projects] = await query(
      "SELECT slug, updated_at FROM wajidx_projects WHERE status = 'published' ORDER BY updated_at DESC"
    );

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    const now = new Date().toISOString().split('T')[0];

    for (const route of staticRoutes) {
      xml += `  <url>\n`;
      xml += `    <loc>${SITE_URL}${route.path}</loc>\n`;
      xml += `    <lastmod>${now}</lastmod>\n`;
      xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
      xml += `    <priority>${route.priority}</priority>\n`;
      xml += `  </url>\n`;
    }

    for (const proj of projects) {
      const lastmod = proj.updated_at ? new Date(proj.updated_at).toISOString().split('T')[0] : now;
      xml += `  <url>\n`;
      xml += `    <loc>${SITE_URL}/projects/${proj.slug}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.9</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('[SITEMAP ERROR]', error);
    res.status(500).send('Error generating sitemap');
  }
});

// Single Page Application Fallback for Frontend & Admin
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    return res.sendFile(path.join(__dirname, 'public/index.html'));
  }
  next();
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Start Server
app.listen(PORT, async () => {
  console.log(`====================================================`);
  console.log(`🚀 WAJIDX Platform is active on: ${SITE_URL}`);
  console.log(`🔒 Admin Dashboard available at: ${SITE_URL}/admin`);
  console.log(`====================================================`);
  await testConnection();
});
