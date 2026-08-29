const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { query } = require('../config/db');
const { verifyAdmin } = require('../middleware/auth');
const { uploadToStorage, isConfigured: isSupabaseConfigured } = require('../config/supabase');

// Protect all /api/admin/* routes
router.use(verifyAdmin);

// Configure Multer in memory for cloud & local compatibility
const uploadDir = path.join(__dirname, '../public/uploads');

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|svg|gif/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPG, PNG, WebP, SVG, GIF) are allowed.'));
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter
});

// Helper: Slugify string
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// -------------------------------------------------------------
// DASHBOARD STATS
// -------------------------------------------------------------
router.get('/stats', async (req, res) => {
  try {
    const [projectCounts] = await query(`
      SELECT 
        COUNT(*) AS total_projects,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published_projects,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_projects,
        SUM(CASE WHEN is_featured = 1 THEN 1 ELSE 0 END) AS featured_projects
      FROM wajidx_projects
    `);

    const [catCount] = await query('SELECT COUNT(*) AS total_categories FROM wajidx_categories');
    const [techCount] = await query('SELECT COUNT(*) AS total_technologies FROM wajidx_technologies');
    const [msgCount] = await query(`
      SELECT 
        COUNT(*) AS total_messages,
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread_messages
      FROM wajidx_contact_messages
    `);

    const [recentMessages] = await query(
      'SELECT id, name, email, subject, is_read, created_at FROM wajidx_contact_messages ORDER BY created_at DESC LIMIT 5'
    );

    const [recentProjects] = await query(
      'SELECT id, title, slug, status, is_featured, created_at FROM wajidx_projects ORDER BY updated_at DESC LIMIT 5'
    );

    res.json({
      success: true,
      stats: {
        projects: projectCounts[0],
        categories: catCount[0].total_categories,
        technologies: techCount[0].total_technologies,
        messages: msgCount[0],
        recentMessages,
        recentProjects
      }
    });
  } catch (error) {
    console.error('[ADMIN ERROR] Stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard statistics' });
  }
});

// -------------------------------------------------------------
// PROJECTS MANAGEMENT
// -------------------------------------------------------------

// GET /api/admin/projects
router.get('/projects', async (req, res) => {
  try {
    const { search, status, category } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (search && search.trim()) {
      where += ' AND (p.title LIKE ? OR p.slug LIKE ? OR p.short_description LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    if (status && (status === 'draft' || status === 'published')) {
      where += ' AND p.status = ?';
      params.push(status);
    }

    if (category) {
      where += ' AND p.category_id = ?';
      params.push(category);
    }

    const sql = `
      SELECT 
        p.*,
        c.name AS category_name,
        (SELECT COUNT(*) FROM wajidx_project_features WHERE project_id = p.id) AS feature_count,
        (SELECT COUNT(*) FROM wajidx_project_images WHERE project_id = p.id) AS image_count
      FROM wajidx_projects p
      LEFT JOIN wajidx_categories c ON p.category_id = c.id
      ${where}
      ORDER BY p.display_order ASC, p.created_at DESC
    `;

    const [rows] = await query(sql, params);

    if (rows.length === 0) {
      return res.json({ success: true, count: 0, projects: [] });
    }

    const projectIds = rows.map(r => r.id);
    const [allTechs] = await query(
      `SELECT pt.project_id, t.name 
       FROM wajidx_project_technologies pt 
       JOIN wajidx_technologies t ON pt.technology_id = t.id 
       WHERE pt.project_id IN (?)`,
      [projectIds]
    );

    const techNamesMap = {};
    for (const t of allTechs) {
      if (!techNamesMap[t.project_id]) techNamesMap[t.project_id] = [];
      techNamesMap[t.project_id].push(t.name);
    }

    const projects = rows.map(r => ({
      ...r,
      technology_names: techNamesMap[r.id] || []
    }));

    res.json({ success: true, count: projects.length, projects });
  } catch (error) {
    console.error('[ADMIN ERROR] List projects error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve projects' });
  }
});

// GET /api/admin/projects/:id
router.get('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [projects] = await query('SELECT * FROM wajidx_projects WHERE id = ?', [id]);
    if (projects.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const project = projects[0];

    const [techs] = await query(
      'SELECT technology_id FROM wajidx_project_technologies WHERE project_id = ?',
      [id]
    );
    const [features] = await query(
      'SELECT * FROM wajidx_project_features WHERE project_id = ? ORDER BY display_order ASC, id ASC',
      [id]
    );
    const [images] = await query(
      'SELECT * FROM wajidx_project_images WHERE project_id = ? ORDER BY display_order ASC, id ASC',
      [id]
    );

    res.json({
      success: true,
      project: {
        ...project,
        technology_ids: techs.map(t => t.technology_id),
        features,
        images
      }
    });
  } catch (error) {
    console.error('[ADMIN ERROR] Get project error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve project' });
  }
});

// POST /api/admin/projects (Create)
router.post('/projects', async (req, res) => {
  try {
    const {
      title,
      slug,
      category_id,
      short_description,
      full_description,
      problem,
      solution,
      results,
      workflow,
      client_type,
      year,
      status,
      is_featured,
      display_order,
      thumbnail_url,
      hero_image_url,
      live_url,
      github_url,
      docs_url,
      seo_title,
      seo_description,
      seo_keywords,
      technology_ids,
      features,
      images
    } = req.body;

    if (!title || !short_description) {
      return res.status(400).json({ success: false, error: 'Project title and short description are required.' });
    }

    const finalSlug = slug ? slugify(slug) : slugify(title);

    // Verify slug uniqueness
    const [existing] = await query('SELECT id FROM wajidx_projects WHERE slug = ?', [finalSlug]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: `Slug '${finalSlug}' is already in use. Please specify a unique slug.` });
    }

    const [result] = await query(
      `INSERT INTO wajidx_projects (
        title, slug, category_id, short_description, full_description,
        problem, solution, results, workflow, client_type, year,
        status, is_featured, display_order, thumbnail_url, hero_image_url,
        live_url, github_url, docs_url, seo_title, seo_description, seo_keywords
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        finalSlug,
        category_id ? parseInt(category_id, 10) : null,
        short_description.trim(),
        full_description || null,
        problem || null,
        solution || null,
        results || null,
        workflow || null,
        client_type || 'Enterprise / Custom',
        year || new Date().getFullYear().toString(),
        status === 'draft' ? 'draft' : 'published',
        is_featured ? 1 : 0,
        display_order ? parseInt(display_order, 10) : 0,
        thumbnail_url || null,
        hero_image_url || null,
        live_url || null,
        github_url || null,
        docs_url || null,
        seo_title || null,
        seo_description || null,
        seo_keywords || null
      ]
    );

    const projectId = result.insertId;

    // Link Technologies
    if (Array.isArray(technology_ids) && technology_ids.length > 0) {
      for (const tId of technology_ids) {
        await query('INSERT IGNORE INTO wajidx_project_technologies (project_id, technology_id) VALUES (?, ?)', [
          projectId,
          parseInt(tId, 10)
        ]);
      }
    }

    // Insert Features
    if (Array.isArray(features) && features.length > 0) {
      for (let i = 0; i < features.length; i++) {
        const f = features[i];
        if (f.title && f.title.trim()) {
          await query(
            'INSERT INTO wajidx_project_features (project_id, title, description, icon, display_order) VALUES (?, ?, ?, ?, ?)',
            [projectId, f.title.trim(), f.description || '', f.icon || 'check_circle', f.display_order || i + 1]
          );
        }
      }
    }

    // Insert Images
    if (Array.isArray(images) && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.image_url && img.image_url.trim()) {
          await query(
            'INSERT INTO wajidx_project_images (project_id, image_url, caption, alt_text, display_order) VALUES (?, ?, ?, ?, ?)',
            [projectId, img.image_url.trim(), img.caption || '', img.alt_text || '', img.display_order || i + 1]
          );
        }
      }
    }

    res.json({
      success: true,
      message: 'Project created successfully',
      projectId,
      slug: finalSlug
    });
  } catch (error) {
    console.error('[ADMIN ERROR] Create project error:', error);
    res.status(500).json({ success: false, error: 'Failed to create project.' });
  }
});

// PUT /api/admin/projects/:id (Update)
router.put('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      slug,
      category_id,
      short_description,
      full_description,
      problem,
      solution,
      results,
      workflow,
      client_type,
      year,
      status,
      is_featured,
      display_order,
      thumbnail_url,
      hero_image_url,
      live_url,
      github_url,
      docs_url,
      seo_title,
      seo_description,
      seo_keywords,
      technology_ids,
      features,
      images
    } = req.body;

    if (!title || !short_description) {
      return res.status(400).json({ success: false, error: 'Project title and short description are required.' });
    }

    const finalSlug = slug ? slugify(slug) : slugify(title);

    // Verify slug uniqueness
    const [existing] = await query('SELECT id FROM wajidx_projects WHERE slug = ? AND id != ?', [finalSlug, id]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: `Slug '${finalSlug}' is already in use by another project.` });
    }

    await query(
      `UPDATE wajidx_projects SET
        title = ?, slug = ?, category_id = ?, short_description = ?, full_description = ?,
        problem = ?, solution = ?, results = ?, workflow = ?, client_type = ?, year = ?,
        status = ?, is_featured = ?, display_order = ?, thumbnail_url = ?, hero_image_url = ?,
        live_url = ?, github_url = ?, docs_url = ?, seo_title = ?, seo_description = ?, seo_keywords = ?
      WHERE id = ?`,
      [
        title.trim(),
        finalSlug,
        category_id ? parseInt(category_id, 10) : null,
        short_description.trim(),
        full_description || null,
        problem || null,
        solution || null,
        results || null,
        workflow || null,
        client_type || 'Enterprise / Custom',
        year || '2024',
        status === 'draft' ? 'draft' : 'published',
        is_featured ? 1 : 0,
        display_order ? parseInt(display_order, 10) : 0,
        thumbnail_url || null,
        hero_image_url || null,
        live_url || null,
        github_url || null,
        docs_url || null,
        seo_title || null,
        seo_description || null,
        seo_keywords || null,
        id
      ]
    );

    // Update Technologies
    await query('DELETE FROM wajidx_project_technologies WHERE project_id = ?', [id]);
    if (Array.isArray(technology_ids) && technology_ids.length > 0) {
      for (const tId of technology_ids) {
        await query('INSERT IGNORE INTO wajidx_project_technologies (project_id, technology_id) VALUES (?, ?)', [
          id,
          parseInt(tId, 10)
        ]);
      }
    }

    // Update Features
    await query('DELETE FROM wajidx_project_features WHERE project_id = ?', [id]);
    if (Array.isArray(features) && features.length > 0) {
      for (let i = 0; i < features.length; i++) {
        const f = features[i];
        if (f.title && f.title.trim()) {
          await query(
            'INSERT INTO wajidx_project_features (project_id, title, description, icon, display_order) VALUES (?, ?, ?, ?, ?)',
            [id, f.title.trim(), f.description || '', f.icon || 'check_circle', f.display_order || i + 1]
          );
        }
      }
    }

    // Update Images
    await query('DELETE FROM wajidx_project_images WHERE project_id = ?', [id]);
    if (Array.isArray(images) && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.image_url && img.image_url.trim()) {
          await query(
            'INSERT INTO wajidx_project_images (project_id, image_url, caption, alt_text, display_order) VALUES (?, ?, ?, ?, ?)',
            [id, img.image_url.trim(), img.caption || '', img.alt_text || '', img.display_order || i + 1]
          );
        }
      }
    }

    res.json({
      success: true,
      message: 'Project updated successfully',
      slug: finalSlug
    });
  } catch (error) {
    console.error('[ADMIN ERROR] Update project error:', error);
    res.status(500).json({ success: false, error: 'Failed to update project.' });
  }
});

// PATCH /api/admin/projects/:id/toggle-status
router.patch('/projects/:id/toggle-status', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await query('SELECT status FROM wajidx_projects WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    const newStatus = rows[0].status === 'published' ? 'draft' : 'published';
    await query('UPDATE wajidx_projects SET status = ? WHERE id = ?', [newStatus, id]);
    res.json({ success: true, status: newStatus });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to toggle project status' });
  }
});

// PATCH /api/admin/projects/:id/toggle-featured
router.patch('/projects/:id/toggle-featured', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await query('SELECT is_featured FROM wajidx_projects WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    const newFeatured = rows[0].is_featured ? 0 : 1;
    await query('UPDATE wajidx_projects SET is_featured = ? WHERE id = ?', [newFeatured, id]);
    res.json({ success: true, is_featured: newFeatured });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to toggle featured status' });
  }
});

// DELETE /api/admin/projects/:id
router.delete('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM wajidx_projects WHERE id = ?', [id]);
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('[ADMIN ERROR] Delete project error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
});

// -------------------------------------------------------------
// CATEGORIES MANAGEMENT
// -------------------------------------------------------------
router.get('/categories', async (req, res) => {
  try {
    const [categories] = await query(`
      SELECT c.*, COUNT(p.id) AS project_count 
      FROM wajidx_categories c
      LEFT JOIN wajidx_projects p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.display_order ASC, c.name ASC
    `);
    res.json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve categories' });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const { name, slug, description, display_order } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Category name is required.' });
    const finalSlug = slug ? slugify(slug) : slugify(name);

    const [result] = await query(
      'INSERT INTO wajidx_categories (name, slug, description, display_order) VALUES (?, ?, ?, ?)',
      [name.trim(), finalSlug, description || '', display_order ? parseInt(display_order, 10) : 0]
    );

    res.json({ success: true, message: 'Category created', id: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create category' });
  }
});

router.put('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, display_order } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Category name is required.' });
    const finalSlug = slug ? slugify(slug) : slugify(name);

    await query(
      'UPDATE wajidx_categories SET name = ?, slug = ?, description = ?, display_order = ? WHERE id = ?',
      [name.trim(), finalSlug, description || '', display_order ? parseInt(display_order, 10) : 0, id]
    );

    res.json({ success: true, message: 'Category updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update category' });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM wajidx_categories WHERE id = ?', [id]);
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete category' });
  }
});

// -------------------------------------------------------------
// TECHNOLOGIES MANAGEMENT
// -------------------------------------------------------------
router.get('/technologies', async (req, res) => {
  try {
    const [technologies] = await query(`
      SELECT t.*, COUNT(pt.project_id) AS project_count
      FROM wajidx_technologies t
      LEFT JOIN wajidx_project_technologies pt ON pt.technology_id = t.id
      GROUP BY t.id
      ORDER BY t.category ASC, t.name ASC
    `);
    res.json({ success: true, technologies });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve technologies' });
  }
});

router.post('/technologies', async (req, res) => {
  try {
    const { name, slug, category, color, icon } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Technology name is required.' });
    const finalSlug = slug ? slugify(slug) : slugify(name);

    const [result] = await query(
      'INSERT INTO wajidx_technologies (name, slug, category, color, icon) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), finalSlug, category || 'General', color || '#2674e7', icon || 'code']
    );

    res.json({ success: true, message: 'Technology created', id: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create technology' });
  }
});

router.put('/technologies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, category, color, icon } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Technology name is required.' });
    const finalSlug = slug ? slugify(slug) : slugify(name);

    await query(
      'UPDATE wajidx_technologies SET name = ?, slug = ?, category = ?, color = ?, icon = ? WHERE id = ?',
      [name.trim(), finalSlug, category || 'General', color || '#2674e7', icon || 'code', id]
    );

    res.json({ success: true, message: 'Technology updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update technology' });
  }
});

router.delete('/technologies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM wajidx_technologies WHERE id = ?', [id]);
    res.json({ success: true, message: 'Technology deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete technology' });
  }
});

// -------------------------------------------------------------
// MEDIA UPLOAD (Supabase Storage with Local Disk Fallback)
// -------------------------------------------------------------
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded.' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const safeBase = path.basename(req.file.originalname, ext).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
    const filename = `${safeBase}_${unique}${ext}`;

    let publicUrl = '';

    if (isSupabaseConfigured()) {
      // Upload directly to Supabase Storage bucket 'wajidx-media'
      const storagePath = `uploads/${filename}`;
      publicUrl = await uploadToStorage('wajidx-media', storagePath, req.file.buffer, req.file.mimetype);
    } else {
      // Local development fallback
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const localFilePath = path.join(uploadDir, filename);
      fs.writeFileSync(localFilePath, req.file.buffer);
      publicUrl = `/uploads/${filename}`;
    }

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      file: {
        filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: publicUrl
      }
    });
  } catch (error) {
    console.error('[ADMIN UPLOAD ERROR]', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to upload image.' });
  }
});

// -------------------------------------------------------------
// MESSAGES MANAGEMENT
// -------------------------------------------------------------
router.get('/messages', async (req, res) => {
  try {
    const [messages] = await query('SELECT * FROM wajidx_contact_messages ORDER BY created_at DESC');
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

router.patch('/messages/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE wajidx_contact_messages SET is_read = 1 WHERE id = ?', [id]);
    res.json({ success: true, message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update message status' });
  }
});

router.delete('/messages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM wajidx_contact_messages WHERE id = ?', [id]);
    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete message' });
  }
});

// -------------------------------------------------------------
// SITE SETTINGS
// -------------------------------------------------------------
router.get('/settings', async (req, res) => {
  try {
    const [rows] = await query('SELECT setting_key, setting_value FROM wajidx_site_settings');
    const settings = {};
    for (const r of rows) {
      settings[r.setting_key] = r.setting_value;
    }
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Settings object is required.' });
    }

    for (const [key, value] of Object.entries(settings)) {
      await query(
        'INSERT INTO wajidx_site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [key, typeof value === 'string' ? value : JSON.stringify(value)]
      );
    }

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('[ADMIN ERROR] Update settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to update settings.' });
  }
});

module.exports = router;
