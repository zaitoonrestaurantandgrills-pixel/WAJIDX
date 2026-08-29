const express = require('express');
const router = express.Router();
const { query } = require('../config/db');

// GET /api/settings - Public site settings
router.get('/settings', async (req, res) => {
  try {
    const [rows] = await query('SELECT setting_key, setting_value FROM wajidx_site_settings');
    const settings = {};
    for (const r of rows) {
      settings[r.setting_key] = r.setting_value;
    }
    res.json({ success: true, settings });
  } catch (error) {
    console.error('[API ERROR] Failed to fetch settings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

// GET /api/categories - Public categories list
router.get('/categories', async (req, res) => {
  try {
    const sql = `
      SELECT c.*, COUNT(p.id) AS project_count
      FROM wajidx_categories c
      LEFT JOIN wajidx_projects p ON p.category_id = c.id AND p.status = 'published'
      GROUP BY c.id
      ORDER BY c.display_order ASC, c.name ASC
    `;
    const [categories] = await query(sql);
    res.json({ success: true, categories });
  } catch (error) {
    console.error('[API ERROR] Failed to fetch categories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

// GET /api/technologies - Public technologies list
router.get('/technologies', async (req, res) => {
  try {
    const [technologies] = await query('SELECT * FROM wajidx_technologies ORDER BY category ASC, name ASC');
    res.json({ success: true, technologies });
  } catch (error) {
    console.error('[API ERROR] Failed to fetch technologies:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch technologies' });
  }
});

// GET /api/projects - Public projects list (Search, Filter, Sort)
router.get('/projects', async (req, res) => {
  try {
    const { search, category, sort, featured } = req.query;

    let whereClause = "WHERE p.status = 'published'";
    const params = [];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      whereClause += ` AND (
        p.title LIKE ? OR 
        p.short_description LIKE ? OR 
        p.full_description LIKE ? OR 
        c.name LIKE ? OR 
        p.id IN (
          SELECT pt.project_id 
          FROM wajidx_project_technologies pt 
          JOIN wajidx_technologies t ON pt.technology_id = t.id 
          WHERE t.name LIKE ?
        )
      )`;
      params.push(s, s, s, s, s);
    }

    if (category && category !== 'all') {
      whereClause += ' AND (c.slug = ? OR c.name = ?)';
      params.push(category, category);
    }

    if (featured === 'true' || featured === '1') {
      whereClause += ' AND p.is_featured = 1';
    }

    let orderBy = 'p.is_featured DESC, p.display_order ASC, p.created_at DESC';
    if (sort === 'newest') {
      orderBy = 'p.created_at DESC';
    } else if (sort === 'oldest') {
      orderBy = 'p.created_at ASC';
    } else if (sort === 'order') {
      orderBy = 'p.display_order ASC, p.title ASC';
    } else if (sort === 'featured') {
      orderBy = 'p.is_featured DESC, p.display_order ASC, p.created_at DESC';
    }

    const sql = `
      SELECT 
        p.id, p.title, p.slug, p.category_id, p.short_description, 
        p.client_type, p.year, p.status, p.is_featured, p.display_order,
        p.thumbnail_url, p.hero_image_url, p.live_url, p.github_url, p.docs_url,
        p.created_at,
        c.name AS category_name, c.slug AS category_slug
      FROM wajidx_projects p
      LEFT JOIN wajidx_categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY ${orderBy}
    `;

    const [projects] = await query(sql, params);

    if (projects.length === 0) {
      return res.json({ success: true, count: 0, projects: [] });
    }

    const projectIds = projects.map(p => p.id);
    const [allTechs] = await query(
      `SELECT pt.project_id, t.id, t.name, t.slug, t.color, t.icon, t.category
       FROM wajidx_project_technologies pt
       JOIN wajidx_technologies t ON pt.technology_id = t.id
       WHERE pt.project_id IN (?)
       ORDER BY t.category ASC, t.name ASC`,
      [projectIds]
    );

    const techMap = {};
    for (const t of allTechs) {
      if (!techMap[t.project_id]) techMap[t.project_id] = [];
      techMap[t.project_id].push({
        id: t.id,
        name: t.name,
        slug: t.slug,
        color: t.color,
        icon: t.icon,
        category: t.category
      });
    }

    const formatted = projects.map(p => ({
      ...p,
      technologies: techMap[p.id] || []
    }));

    res.json({ success: true, count: formatted.length, projects: formatted });
  } catch (error) {
    console.error('[API ERROR] Failed to list projects:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve projects' });
  }
});

// GET /api/projects/featured - Quick featured projects endpoint
router.get('/projects/featured', async (req, res) => {
  try {
    const sql = `
      SELECT 
        p.id, p.title, p.slug, p.category_id, p.short_description, 
        p.client_type, p.year, p.status, p.is_featured, p.display_order,
        p.thumbnail_url, p.hero_image_url, p.live_url, p.github_url, p.docs_url,
        c.name AS category_name, c.slug AS category_slug
      FROM wajidx_projects p
      LEFT JOIN wajidx_categories c ON p.category_id = c.id
      WHERE p.status = 'published' AND p.is_featured = 1
      ORDER BY p.display_order ASC, p.created_at DESC
      LIMIT 6
    `;
    const [projects] = await query(sql);

    if (projects.length === 0) {
      return res.json({ success: true, projects: [] });
    }

    const projectIds = projects.map(p => p.id);
    const [allTechs] = await query(
      `SELECT pt.project_id, t.id, t.name, t.slug, t.color, t.icon
       FROM wajidx_project_technologies pt
       JOIN wajidx_technologies t ON pt.technology_id = t.id
       WHERE pt.project_id IN (?)`,
      [projectIds]
    );

    const techMap = {};
    for (const t of allTechs) {
      if (!techMap[t.project_id]) techMap[t.project_id] = [];
      techMap[t.project_id].push({
        id: t.id,
        name: t.name,
        slug: t.slug,
        color: t.color,
        icon: t.icon
      });
    }

    const formatted = projects.map(p => ({
      ...p,
      technologies: techMap[p.id] || []
    }));
    res.json({ success: true, projects: formatted });
  } catch (error) {
    console.error('[API ERROR] Featured projects error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch featured projects' });
  }
});

// GET /api/projects/:slug - Complete project details by slug
router.get('/projects/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const projectSql = `
      SELECT 
        p.*,
        c.name AS category_name, c.slug AS category_slug
      FROM wajidx_projects p
      LEFT JOIN wajidx_categories c ON p.category_id = c.id
      WHERE p.slug = ? AND p.status = 'published'
      LIMIT 1
    `;
    const [projects] = await query(projectSql, [slug]);

    if (projects.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const project = projects[0];

    // Fetch Technologies
    const [techRows] = await query(
      `SELECT t.* 
       FROM wajidx_technologies t
       JOIN wajidx_project_technologies pt ON t.id = pt.technology_id
       WHERE pt.project_id = ?
       ORDER BY t.category ASC, t.name ASC`,
      [project.id]
    );

    // Fetch Features
    const [features] = await query(
      'SELECT * FROM wajidx_project_features WHERE project_id = ? ORDER BY display_order ASC, id ASC',
      [project.id]
    );

    // Fetch Images/Gallery
    const [images] = await query(
      'SELECT * FROM wajidx_project_images WHERE project_id = ? ORDER BY display_order ASC, id ASC',
      [project.id]
    );

    // Fetch Related Projects (same category, excluding current project)
    const [related] = await query(
      `SELECT p.id, p.title, p.slug, p.short_description, p.thumbnail_url, p.year, c.name AS category_name
       FROM wajidx_projects p
       LEFT JOIN wajidx_categories c ON p.category_id = c.id
       WHERE p.status = 'published' AND p.id != ? AND (p.category_id = ? OR p.category_id IS NOT NULL)
       ORDER BY (p.category_id = ?) DESC, p.display_order ASC
       LIMIT 3`,
      [project.id, project.category_id, project.category_id]
    );

    res.json({
      success: true,
      project: {
        ...project,
        technologies: techRows,
        features,
        images,
        related
      }
    });
  } catch (error) {
    console.error('[API ERROR] Project detail error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch project details' });
  }
});

// POST /api/contact - Submit message from contact form
router.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'Name, email, and message are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

    const [result] = await query(
      'INSERT INTO wajidx_contact_messages (name, email, subject, message, ip_address) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), email.trim(), subject ? subject.trim() : 'Project Inquiry', message.trim(), ip]
    );

    res.json({
      success: true,
      message: 'Thank you! Your message has been sent successfully to WAJIDX. We will reach out shortly.',
      id: result.insertId
    });
  } catch (error) {
    console.error('[CONTACT ERROR]', error);
    res.status(500).json({ success: false, error: 'Failed to submit contact message.' });
  }
});

module.exports = router;
