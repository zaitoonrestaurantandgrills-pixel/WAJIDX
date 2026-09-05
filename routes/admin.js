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

const migrate = require('../database/migrate');

/**
 * Capture full entity snapshot and record revision
 */
async function recordProjectRevision(projectId, changeSummary, author = 'admin') {
  try {
    const [projects] = await query('SELECT * FROM wajidx_projects WHERE id = ?', [projectId]);
    if (!projects || projects.length === 0) return null;
    const project = projects[0];

    const [techs] = await query('SELECT technology_id FROM wajidx_project_technologies WHERE project_id = ?', [projectId]);
    const [features] = await query('SELECT * FROM wajidx_project_features WHERE project_id = ? ORDER BY display_order ASC, id ASC', [projectId]);
    const [images] = await query('SELECT * FROM wajidx_project_images WHERE project_id = ? ORDER BY display_order ASC, id ASC', [projectId]);

    const snapshotPayload = {
      project,
      technology_ids: (techs || []).map(t => t.technology_id),
      features: features || [],
      images: images || []
    };

    let nextVersion = 1;
    try {
      const [verRows] = await query(
        'SELECT MAX(version_number) AS max_v FROM wajidx_revisions WHERE entity_type = ? AND entity_id = ?',
        ['project', projectId]
      );
      if (verRows && verRows[0] && verRows[0].max_v) {
        nextVersion = parseInt(verRows[0].max_v, 10) + 1;
      }
    } catch (e) {}

    await query(
      'INSERT INTO wajidx_revisions (entity_type, entity_id, version_number, change_summary, snapshot_data, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      ['project', projectId, nextVersion, changeSummary || `Version ${nextVersion}`, JSON.stringify(snapshotPayload), author]
    );

    return nextVersion;
  } catch (err) {
    console.warn('[REVISION NOTE] Project revision note:', err.message);
    return null;
  }
}

/**
 * Capture site settings revision
 */
async function recordSettingsRevision(changeSummary, author = 'admin') {
  try {
    const [rows] = await query('SELECT setting_key, setting_value FROM wajidx_site_settings');
    const settings = {};
    if (rows) {
      for (const r of rows) settings[r.setting_key] = r.setting_value;
    }

    let nextVersion = 1;
    try {
      const [verRows] = await query(
        'SELECT MAX(version_number) AS max_v FROM wajidx_revisions WHERE entity_type = ?',
        ['setting']
      );
      if (verRows && verRows[0] && verRows[0].max_v) {
        nextVersion = parseInt(verRows[0].max_v, 10) + 1;
      }
    } catch (e) {}

    await query(
      'INSERT INTO wajidx_revisions (entity_type, entity_id, version_number, change_summary, snapshot_data, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      ['setting', 0, nextVersion, changeSummary || `Settings v${nextVersion}`, JSON.stringify(settings), author]
    );

    return nextVersion;
  } catch (err) {
    console.warn('[REVISION NOTE] Settings revision note:', err.message);
    return null;
  }
}

/**
 * Capture complete database snapshot
 */
async function createFullDatabaseSnapshot(name, type = 'manual', author = 'admin') {
  try {
    const [projects] = await query('SELECT * FROM wajidx_projects ORDER BY id ASC');
    const [categories] = await query('SELECT * FROM wajidx_categories ORDER BY id ASC');
    const [technologies] = await query('SELECT * FROM wajidx_technologies ORDER BY id ASC');
    const [projTechs] = await query('SELECT * FROM wajidx_project_technologies');
    const [projFeatures] = await query('SELECT * FROM wajidx_project_features ORDER BY id ASC');
    const [projImages] = await query('SELECT * FROM wajidx_project_images ORDER BY id ASC');
    const [settings] = await query('SELECT * FROM wajidx_site_settings');

    const counts = {
      projects: (projects || []).length,
      categories: (categories || []).length,
      technologies: (technologies || []).length,
      project_features: (projFeatures || []).length,
      project_images: (projImages || []).length,
      site_settings: (settings || []).length
    };

    const payload = {
      metadata: {
        app: 'WAJIDX',
        version: '1.1.0',
        database: 'devaj',
        createdAt: new Date().toISOString(),
        createdBy: author,
        name: name || `Snapshot ${new Date().toISOString().replace(/[:.]/g, '-')}`
      },
      counts,
      data: {
        projects: projects || [],
        categories: categories || [],
        technologies: technologies || [],
        project_technologies: projTechs || [],
        project_features: projFeatures || [],
        project_images: projImages || [],
        site_settings: settings || []
      }
    };

    const [res] = await query(
      'INSERT INTO wajidx_snapshots (snapshot_name, snapshot_type, item_counts, payload, created_by) VALUES (?, ?, ?, ?, ?)',
      [
        name || `Snapshot ${new Date().toLocaleString()}`,
        type,
        JSON.stringify(counts),
        JSON.stringify(payload),
        author
      ]
    );

    return { id: res.insertId, name, counts };
  } catch (err) {
    console.error('[SNAPSHOT ERROR] Failed to create snapshot:', err);
    throw err;
  }
}

/**
 * Restore complete database state from snapshot payload
 */
async function restoreFullDatabaseSnapshot(payload, author = 'admin') {
  if (!payload || !payload.data) {
    throw new Error('Invalid snapshot payload format. Missing data root.');
  }

  const { data } = payload;

  // Clear existing items in reverse foreign key order
  await query('DELETE FROM wajidx_project_images');
  await query('DELETE FROM wajidx_project_features');
  await query('DELETE FROM wajidx_project_technologies');
  await query('DELETE FROM wajidx_projects');
  await query('DELETE FROM wajidx_technologies');
  await query('DELETE FROM wajidx_categories');
  await query('DELETE FROM wajidx_site_settings');

  // 1. Restore Categories
  if (Array.isArray(data.categories)) {
    for (const c of data.categories) {
      await query(
        'INSERT INTO wajidx_categories (id, name, slug, description, display_order) VALUES (?, ?, ?, ?, ?)',
        [c.id, c.name, c.slug, c.description || null, c.display_order || 0]
      );
    }
  }

  // 2. Restore Technologies
  if (Array.isArray(data.technologies)) {
    for (const t of data.technologies) {
      await query(
        'INSERT INTO wajidx_technologies (id, name, slug, category, color, icon) VALUES (?, ?, ?, ?, ?, ?)',
        [t.id, t.name, t.slug, t.category || 'General', t.color || '#2674e7', t.icon || 'code']
      );
    }
  }

  // 3. Restore Projects
  if (Array.isArray(data.projects)) {
    for (const p of data.projects) {
      await query(
        `INSERT INTO wajidx_projects (
          id, title, slug, category_id, short_description, full_description,
          problem, solution, results, workflow, client_type, year,
          status, is_featured, display_order, thumbnail_url, hero_image_url,
          live_url, github_url, docs_url, seo_title, seo_description, seo_keywords
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.title,
          p.slug,
          p.category_id || null,
          p.short_description || '',
          p.full_description || null,
          p.problem || null,
          p.solution || null,
          p.results || null,
          p.workflow || null,
          p.client_type || 'Enterprise / Custom',
          p.year || '2024',
          p.status || 'published',
          p.is_featured ? 1 : 0,
          p.display_order || 0,
          p.thumbnail_url || null,
          p.hero_image_url || null,
          p.live_url || null,
          p.github_url || null,
          p.docs_url || null,
          p.seo_title || null,
          p.seo_description || null,
          p.seo_keywords || null
        ]
      );
    }
  }

  // 4. Restore Project Technologies
  if (Array.isArray(data.project_technologies)) {
    for (const pt of data.project_technologies) {
      await query(
        'INSERT INTO wajidx_project_technologies (project_id, technology_id) VALUES (?, ?)',
        [pt.project_id, pt.technology_id]
      );
    }
  }

  // 5. Restore Project Features
  if (Array.isArray(data.project_features)) {
    for (const f of data.project_features) {
      await query(
        'INSERT INTO wajidx_project_features (id, project_id, title, description, icon, display_order) VALUES (?, ?, ?, ?, ?, ?)',
        [f.id, f.project_id, f.title, f.description || '', f.icon || 'check_circle', f.display_order || 0]
      );
    }
  }

  // 6. Restore Project Images
  if (Array.isArray(data.project_images)) {
    for (const img of data.project_images) {
      await query(
        'INSERT INTO wajidx_project_images (id, project_id, image_url, caption, alt_text, display_order) VALUES (?, ?, ?, ?, ?, ?)',
        [img.id, img.project_id, img.image_url, img.caption || '', img.alt_text || '', img.display_order || 0]
      );
    }
  }

  // 7. Restore Site Settings
  if (Array.isArray(data.site_settings)) {
    for (const s of data.site_settings) {
      await query(
        'INSERT INTO wajidx_site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [s.setting_key, s.setting_value]
      );
    }
  }

  return {
    success: true,
    restoredCounts: {
      projects: (data.projects || []).length,
      categories: (data.categories || []).length,
      technologies: (data.technologies || []).length,
      project_features: (data.project_features || []).length,
      project_images: (data.project_images || []).length,
      site_settings: (data.site_settings || []).length
    }
  };
}


// -------------------------------------------------------------
// DASHBOARD STATS
// -------------------------------------------------------------
router.get('/stats', async (req, res) => {
  try {
    let projectCounts = [{}];
    let catCount = [{ total_categories: 0 }];
    let techCount = [{ total_technologies: 0 }];
    let msgCount = [{}];
    let recentMessages = [];
    let recentProjects = [];

    try {
      const [pc] = await query(`
        SELECT 
          COUNT(*) AS total_projects,
          SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published_projects,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_projects,
          SUM(CASE WHEN is_featured = 1 THEN 1 ELSE 0 END) AS featured_projects
        FROM wajidx_projects
      `);
      if (pc && pc.length > 0) projectCounts = pc;

      const [cc] = await query('SELECT COUNT(*) AS total_categories FROM wajidx_categories');
      if (cc && cc.length > 0) catCount = cc;

      const [tc] = await query('SELECT COUNT(*) AS total_technologies FROM wajidx_technologies');
      if (tc && tc.length > 0) techCount = tc;

      const [mc] = await query(`
        SELECT 
          COUNT(*) AS total_messages,
          SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread_messages
        FROM wajidx_contact_messages
      `);
      if (mc && mc.length > 0) msgCount = mc;

      const [rm] = await query(
        'SELECT id, name, email, subject, is_read, created_at FROM wajidx_contact_messages ORDER BY created_at DESC LIMIT 5'
      );
      if (rm) recentMessages = rm;

      const [rp] = await query(
        'SELECT id, title, slug, status, is_featured, created_at FROM wajidx_projects ORDER BY updated_at DESC LIMIT 5'
      );
      if (rp) recentProjects = rp;
    } catch (queryErr) {
      console.warn('[ADMIN STATS NOTE] Query fallback:', queryErr.message);
    }

    const projectsObj = projectCounts[0] || {};
    const messagesObj = msgCount[0] || {};

    res.json({
      success: true,
      stats: {
        projects: {
          total_projects: parseInt(projectsObj.total_projects || 0, 10),
          published_projects: parseInt(projectsObj.published_projects || 0, 10),
          draft_projects: parseInt(projectsObj.draft_projects || 0, 10),
          featured_projects: parseInt(projectsObj.featured_projects || 0, 10)
        },
        categories: parseInt(catCount[0]?.total_categories || 0, 10),
        technologies: parseInt(techCount[0]?.total_technologies || 0, 10),
        messages: {
          total_messages: parseInt(messagesObj.total_messages || 0, 10),
          unread_messages: parseInt(messagesObj.unread_messages || 0, 10)
        },
        recentMessages,
        recentProjects
      }
    });
  } catch (error) {
    console.error('[ADMIN ERROR] Stats error:', error);
    res.json({
      success: true,
      stats: {
        projects: { total_projects: 0, published_projects: 0, draft_projects: 0, featured_projects: 0 },
        categories: 0,
        technologies: 0,
        messages: { total_messages: 0, unread_messages: 0 },
        recentMessages: [],
        recentProjects: []
      }
    });
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
    console.warn('[ADMIN DB NOTE] List projects fallback:', error.message);
    res.json({ success: true, count: 0, projects: [] });
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

    // Record initial revision
    await recordProjectRevision(projectId, 'Initial project creation', req.admin?.username || 'admin');

    res.json({
      success: true,
      message: 'Project created successfully',
      projectId,
      slug: finalSlug
    });
  } catch (error) {
    console.error('[ADMIN ERROR] Create project error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create project.' });
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

    // Auto-record revision of current project state BEFORE applying new updates
    await recordProjectRevision(id, `Pre-update backup before edit (${title})`, req.admin?.username || 'admin');

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

// GET /api/admin/projects/:id/versions (List Revision History)
router.get('/projects/:id/versions', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await query(
      `SELECT id, entity_type, entity_id, version_number, change_summary, created_by, created_at
       FROM wajidx_revisions
       WHERE entity_type = 'project' AND entity_id = ?
       ORDER BY version_number DESC`,
      [id]
    );

    res.json({
      success: true,
      versions: rows || []
    });
  } catch (error) {
    console.error('[ADMIN ERROR] Project versions error:', error);
    res.status(500).json({ success: false, error: 'Failed to load project revisions.' });
  }
});

// GET /api/admin/projects/:id/versions/:versionId (View Specific Revision Snapshot)
router.get('/projects/:id/versions/:versionId', async (req, res) => {
  try {
    const { id, versionId } = req.params;
    const [rows] = await query(
      `SELECT * FROM wajidx_revisions WHERE id = ? AND entity_type = 'project' AND entity_id = ? LIMIT 1`,
      [versionId, id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Revision not found.' });
    }

    const rev = rows[0];
    let parsedData = null;
    try {
      parsedData = typeof rev.snapshot_data === 'string' ? JSON.parse(rev.snapshot_data) : rev.snapshot_data;
    } catch (e) {
      parsedData = rev.snapshot_data;
    }

    res.json({
      success: true,
      version: {
        id: rev.id,
        version_number: rev.version_number,
        change_summary: rev.change_summary,
        created_by: rev.created_by,
        created_at: rev.created_at,
        data: parsedData
      }
    });
  } catch (error) {
    console.error('[ADMIN ERROR] Get project version error:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve version details.' });
  }
});

// POST /api/admin/projects/:id/revert/:versionId (1-Click Revert Project to Revision)
router.post('/projects/:id/revert/:versionId', async (req, res) => {
  try {
    const { id, versionId } = req.params;

    const [rows] = await query(
      `SELECT * FROM wajidx_revisions WHERE id = ? AND entity_type = 'project' AND entity_id = ? LIMIT 1`,
      [versionId, id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Target revision not found.' });
    }

    const targetRev = rows[0];
    let snapshot = null;
    try {
      snapshot = typeof targetRev.snapshot_data === 'string' ? JSON.parse(targetRev.snapshot_data) : targetRev.snapshot_data;
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Corrupted revision snapshot data.' });
    }

    if (!snapshot || !snapshot.project) {
      return res.status(400).json({ success: false, error: 'Invalid revision structure.' });
    }

    const p = snapshot.project;

    // 1. Auto-record current state before reverting
    await recordProjectRevision(
      id,
      `Pre-revert safety backup (before reverting to v${targetRev.version_number})`,
      req.admin?.username || 'admin'
    );

    // 2. Revert main project row
    await query(
      `UPDATE wajidx_projects SET
        title = ?, slug = ?, category_id = ?, short_description = ?, full_description = ?,
        problem = ?, solution = ?, results = ?, workflow = ?, client_type = ?, year = ?,
        status = ?, is_featured = ?, display_order = ?, thumbnail_url = ?, hero_image_url = ?,
        live_url = ?, github_url = ?, docs_url = ?, seo_title = ?, seo_description = ?, seo_keywords = ?
      WHERE id = ?`,
      [
        p.title,
        p.slug,
        p.category_id || null,
        p.short_description || '',
        p.full_description || null,
        p.problem || null,
        p.solution || null,
        p.results || null,
        p.workflow || null,
        p.client_type || 'Enterprise / Custom',
        p.year || '2024',
        p.status || 'published',
        p.is_featured ? 1 : 0,
        p.display_order || 0,
        p.thumbnail_url || null,
        p.hero_image_url || null,
        p.live_url || null,
        p.github_url || null,
        p.docs_url || null,
        p.seo_title || null,
        p.seo_description || null,
        p.seo_keywords || null,
        id
      ]
    );

    // 3. Revert Technologies
    await query('DELETE FROM wajidx_project_technologies WHERE project_id = ?', [id]);
    if (Array.isArray(snapshot.technology_ids) && snapshot.technology_ids.length > 0) {
      for (const tId of snapshot.technology_ids) {
        await query('INSERT IGNORE INTO wajidx_project_technologies (project_id, technology_id) VALUES (?, ?)', [
          id,
          parseInt(tId, 10)
        ]);
      }
    }

    // 4. Revert Features
    await query('DELETE FROM wajidx_project_features WHERE project_id = ?', [id]);
    if (Array.isArray(snapshot.features) && snapshot.features.length > 0) {
      for (let i = 0; i < snapshot.features.length; i++) {
        const f = snapshot.features[i];
        await query(
          'INSERT INTO wajidx_project_features (project_id, title, description, icon, display_order) VALUES (?, ?, ?, ?, ?)',
          [id, f.title, f.description || '', f.icon || 'check_circle', f.display_order || i + 1]
        );
      }
    }

    // 5. Revert Images
    await query('DELETE FROM wajidx_project_images WHERE project_id = ?', [id]);
    if (Array.isArray(snapshot.images) && snapshot.images.length > 0) {
      for (let i = 0; i < snapshot.images.length; i++) {
        const img = snapshot.images[i];
        await query(
          'INSERT INTO wajidx_project_images (project_id, image_url, caption, alt_text, display_order) VALUES (?, ?, ?, ?, ?)',
          [id, img.image_url, img.caption || '', img.alt_text || '', img.display_order || i + 1]
        );
      }
    }

    // 6. Record the successful reversion event
    await recordProjectRevision(
      id,
      `Restored state to Version ${targetRev.version_number}`,
      req.admin?.username || 'admin'
    );

    res.json({
      success: true,
      message: `Project successfully reverted to Version ${targetRev.version_number}.`,
      restoredVersion: targetRev.version_number,
      slug: p.slug
    });
  } catch (error) {
    console.error('[ADMIN ERROR] Project revert error:', error);
    res.status(500).json({ success: false, error: 'Failed to revert project: ' + error.message });
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
    res.json({ success: true, categories: categories || [] });
  } catch (error) {
    console.warn('[ADMIN DB NOTE] Categories fallback:', error.message);
    res.json({ success: true, categories: [] });
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
    res.json({ success: true, technologies: technologies || [] });
  } catch (error) {
    console.warn('[ADMIN DB NOTE] Technologies fallback:', error.message);
    res.json({ success: true, technologies: [] });
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
    res.json({ success: true, messages: messages || [] });
  } catch (error) {
    console.warn('[ADMIN DB NOTE] Messages fallback:', error.message);
    res.json({ success: true, messages: [] });
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
    if (rows) {
      for (const r of rows) {
        settings[r.setting_key] = r.setting_value;
      }
    }
    res.json({ success: true, settings });
  } catch (error) {
    console.warn('[ADMIN DB NOTE] Settings fallback:', error.message);
    res.json({
      success: true,
      settings: {
        site_brand_name: 'WAJIDX',
        site_tagline: 'Build. Automate. Innovate.',
        site_description: 'WAJIDX creates practical business systems, POS platforms, computer vision AI, and enterprise automation pipelines.',
        site_logo_text: 'WX',
        contact_email: 'contact@wajidx.com',
        contact_phone: '+923351362639',
        contact_address: 'Karachi, Pakistan',
        social_linkedin: 'https://linkedin.com/company/wajidx',
        social_github: 'https://github.com/wajidx',
        social_twitter: 'https://x.com/wajidx',
        footer_text: '© 2026 WAJIDX. All rights reserved. Precision engineering for digital solutions.'
      }
    });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Settings object is required.' });
    }

    // Auto-record revision of settings before applying new update
    await recordSettingsRevision('Pre-update backup before saving settings', req.admin?.username || 'admin');

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

// GET /api/admin/settings/versions (List Settings Revision History)
router.get('/settings/versions', async (req, res) => {
  try {
    const [rows] = await query(
      `SELECT id, entity_type, entity_id, version_number, change_summary, created_by, created_at
       FROM wajidx_revisions
       WHERE entity_type = 'setting'
       ORDER BY version_number DESC`
    );
    res.json({ success: true, versions: rows || [] });
  } catch (error) {
    console.error('[ADMIN ERROR] Settings versions error:', error);
    res.status(500).json({ success: false, error: 'Failed to load settings revisions.' });
  }
});

// POST /api/admin/settings/revert/:versionId (1-Click Revert Settings)
router.post('/settings/revert/:versionId', async (req, res) => {
  try {
    const { versionId } = req.params;
    const [rows] = await query(
      `SELECT * FROM wajidx_revisions WHERE id = ? AND entity_type = 'setting' LIMIT 1`,
      [versionId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Target settings revision not found.' });
    }

    const rev = rows[0];
    let settingsObj = null;
    try {
      settingsObj = typeof rev.snapshot_data === 'string' ? JSON.parse(rev.snapshot_data) : rev.snapshot_data;
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Corrupted settings snapshot data.' });
    }

    // Auto-record pre-revert safety backup
    await recordSettingsRevision(
      `Pre-revert safety backup (before restoring v${rev.version_number})`,
      req.admin?.username || 'admin'
    );

    // Revert settings
    for (const [key, value] of Object.entries(settingsObj)) {
      await query(
        'INSERT INTO wajidx_site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [key, typeof value === 'string' ? value : JSON.stringify(value)]
      );
    }

    // Record post-revert event
    await recordSettingsRevision(
      `Restored settings to Version ${rev.version_number}`,
      req.admin?.username || 'admin'
    );

    res.json({
      success: true,
      message: `Site settings reverted to Version ${rev.version_number} successfully.`,
      restoredVersion: rev.version_number
    });
  } catch (error) {
    console.error('[ADMIN ERROR] Settings revert error:', error);
    res.status(500).json({ success: false, error: 'Failed to revert settings: ' + error.message });
  }
});

// -------------------------------------------------------------
// SYSTEM SNAPSHOTS & BACKUPS (FULL DATABASE RESTORE / REVERT)
// -------------------------------------------------------------

// GET /api/admin/system/snapshots (List Full System Snapshots)
router.get('/system/snapshots', async (req, res) => {
  try {
    const [rows] = await query(
      `SELECT id, snapshot_name, snapshot_type, item_counts, created_by, created_at
       FROM wajidx_snapshots
       ORDER BY created_at DESC`
    );

    const formatted = (rows || []).map(r => {
      let counts = {};
      try {
        counts = typeof r.item_counts === 'string' ? JSON.parse(r.item_counts) : (r.item_counts || {});
      } catch (e) {}
      return {
        ...r,
        item_counts: counts
      };
    });

    res.json({ success: true, count: formatted.length, snapshots: formatted });
  } catch (error) {
    console.error('[ADMIN ERROR] List snapshots error:', error);
    res.status(500).json({ success: false, error: 'Failed to list system snapshots.' });
  }
});

// POST /api/admin/system/snapshots (Create Manual Snapshot)
router.post('/system/snapshots', async (req, res) => {
  try {
    const { name, notes } = req.body;
    const author = req.admin?.username || 'admin';
    const snapshotName = name && name.trim() ? name.trim() : `Manual Backup (${new Date().toLocaleDateString()})`;

    const result = await createFullDatabaseSnapshot(snapshotName, 'manual', author);

    res.json({
      success: true,
      message: 'System snapshot created successfully.',
      snapshot: result
    });
  } catch (error) {
    console.error('[ADMIN ERROR] Create snapshot error:', error);
    res.status(500).json({ success: false, error: 'Failed to create system snapshot.' });
  }
});

// POST /api/admin/system/snapshots/:id/restore (1-Click Restore / Revert Full Database)
router.post('/system/snapshots/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await query('SELECT * FROM wajidx_snapshots WHERE id = ? LIMIT 1', [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Snapshot not found.' });
    }

    const snapshot = rows[0];
    let payload = null;
    try {
      payload = typeof snapshot.payload === 'string' ? JSON.parse(snapshot.payload) : snapshot.payload;
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Failed to parse snapshot payload.' });
    }

    // Auto-create a pre-restore backup first
    await createFullDatabaseSnapshot(
      `Auto backup before restoring "${snapshot.snapshot_name}"`,
      'auto_pre_update',
      req.admin?.username || 'admin'
    );

    // Restore full state
    const restoreResult = await restoreFullDatabaseSnapshot(payload, req.admin?.username || 'admin');

    res.json({
      success: true,
      message: `System database successfully restored to snapshot "${snapshot.snapshot_name}".`,
      restoredCounts: restoreResult.restoredCounts
    });
  } catch (error) {
    console.error('[ADMIN ERROR] Restore snapshot error:', error);
    res.status(500).json({ success: false, error: 'Failed to restore snapshot: ' + error.message });
  }
});

// GET /api/admin/system/snapshots/:id/download (Export / Download Backup JSON)
router.get('/system/snapshots/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await query('SELECT * FROM wajidx_snapshots WHERE id = ? LIMIT 1', [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Snapshot not found.' });
    }

    const snapshot = rows[0];
    let payload = null;
    try {
      payload = typeof snapshot.payload === 'string' ? JSON.parse(snapshot.payload) : snapshot.payload;
    } catch (e) {
      payload = { error: 'Raw payload', raw: snapshot.payload };
    }

    const filename = `wajidx_backup_${snapshot.snapshot_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error('[ADMIN ERROR] Download snapshot error:', error);
    res.status(500).json({ success: false, error: 'Failed to download snapshot.' });
  }
});

// POST /api/admin/system/snapshots/upload (Upload & Import JSON Backup)
router.post('/system/snapshots/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No JSON backup file uploaded.' });
    }

    let parsed = null;
    try {
      parsed = JSON.parse(req.file.buffer.toString('utf8'));
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Uploaded file is not valid JSON.' });
    }

    if (!parsed || !parsed.data) {
      return res.status(400).json({ success: false, error: 'Invalid backup schema format.' });
    }

    const author = req.admin?.username || 'admin';
    const backupName = parsed.metadata?.name || req.file.originalname.replace(/\.json$/i, '');

    // Save as snapshot record
    const [ins] = await query(
      'INSERT INTO wajidx_snapshots (snapshot_name, snapshot_type, item_counts, payload, created_by) VALUES (?, ?, ?, ?, ?)',
      [
        `Uploaded: ${backupName}`,
        'uploaded_backup',
        JSON.stringify(parsed.counts || {}),
        JSON.stringify(parsed),
        author
      ]
    );

    // If restore requested immediately
    if (req.query.restoreImmediately === 'true' || req.body.restoreImmediately === 'true') {
      await createFullDatabaseSnapshot(`Auto backup before importing uploaded "${backupName}"`, 'auto_pre_update', author);
      await restoreFullDatabaseSnapshot(parsed, author);
      return res.json({
        success: true,
        message: 'Backup uploaded and database restored successfully!',
        snapshotId: ins.insertId
      });
    }

    res.json({
      success: true,
      message: 'Backup uploaded and saved to Snapshots catalog.',
      snapshotId: ins.insertId
    });
  } catch (error) {
    console.error('[ADMIN ERROR] Upload snapshot error:', error);
    res.status(500).json({ success: false, error: 'Failed to import backup: ' + error.message });
  }
});

// DELETE /api/admin/system/snapshots/:id
router.delete('/system/snapshots/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM wajidx_snapshots WHERE id = ?', [id]);
    res.json({ success: true, message: 'Snapshot deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete snapshot.' });
  }
});

// -------------------------------------------------------------
// DATABASE SCHEMA MIGRATIONS (SCHEMA VERSIONING & ROLLBACK)
// -------------------------------------------------------------

// GET /api/admin/system/migrations (Status)
router.get('/system/migrations', async (req, res) => {
  try {
    const statuses = await migrate.getMigrationStatus();
    res.json({
      success: true,
      migrations: statuses || []
    });
  } catch (error) {
    console.error('[ADMIN ERROR] Migrations status error:', error);
    res.status(500).json({ success: false, error: 'Failed to read migration status.' });
  }
});

// POST /api/admin/system/migrations/up (Apply pending)
router.post('/system/migrations/up', async (req, res) => {
  try {
    const result = await migrate.runUp();
    res.json({
      success: true,
      message: result.count > 0 ? `Applied ${result.count} migration(s).` : 'Schema is already up to date.',
      result
    });
  } catch (error) {
    console.error('[ADMIN ERROR] Migration up error:', error);
    res.status(500).json({ success: false, error: 'Migration failed: ' + error.message });
  }
});

// POST /api/admin/system/migrations/rollback (Rollback schema)
router.post('/system/migrations/rollback', async (req, res) => {
  try {
    const steps = parseInt(req.body.steps || '1', 10);
    const result = await migrate.runDown(steps);
    res.json({
      success: true,
      message: result.count > 0 ? `Rolled back ${result.count} migration(s).` : 'No migrations to roll back.',
      result
    });
  } catch (error) {
    console.error('[ADMIN ERROR] Migration rollback error:', error);
    res.status(500).json({ success: false, error: 'Rollback failed: ' + error.message });
  }
});

module.exports = router;

