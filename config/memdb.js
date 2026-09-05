const bcrypt = require('bcryptjs');

class InMemoryDatabase {
  constructor() {
    this.admins = [
      {
        id: 1,
        username: process.env.ADMIN_DEFAULT_USER || 'admin',
        email: process.env.ADMIN_DEFAULT_EMAIL || 'admin@wajidx.com',
        password_hash: '$2b$08$alatD04ir5hp7FONhhxmleYTadUr6rZQupyCZ8nDRjYwnKZpFutJy', // Precomputed hash for default password (Admin@Wajidx2026!)
        name: 'WAJIDX Principal',
        role: 'superadmin',
        created_at: new Date()
      }
    ];

    this.categories = [
      { id: 1, name: 'Business Systems', slug: 'business-systems', description: 'Enterprise operational workflows, ERP systems, and internal tooling.', display_order: 1 },
      { id: 2, name: 'POS & Hospitality', slug: 'pos-hospitality', description: 'High-speed Point-of-Sale, kitchen order routing, and restaurant tech.', display_order: 2 },
      { id: 3, name: 'AI & Automation', slug: 'ai-automation', description: 'Computer vision, biometrics, neural pipelines, and automated bots.', display_order: 3 },
      { id: 4, name: 'Web Applications', slug: 'web-applications', description: 'Scalable modern web platforms and customer-facing digital portals.', display_order: 4 },
      { id: 5, name: 'Inventory & ERP', slug: 'inventory-erp', description: 'Multi-warehouse stock control, procurement, and bill-of-materials.', display_order: 5 }
    ];

    this.technologies = [
      { id: 1, name: 'React', slug: 'react', category: 'Frontend', color: '#61DAFB', icon: 'code' },
      { id: 2, name: 'Node.js', slug: 'nodejs', category: 'Backend', color: '#68A063', icon: 'terminal' },
      { id: 3, name: 'MySQL', slug: 'mysql', category: 'Database', color: '#00758F', icon: 'database' },
      { id: 4, name: 'PostgreSQL', slug: 'postgresql', category: 'Database', color: '#336791', icon: 'database' },
      { id: 5, name: 'Tailwind CSS', slug: 'tailwindcss', category: 'Styling', color: '#38BDF8', icon: 'css' },
      { id: 6, name: 'Python & OpenCV', slug: 'python-opencv', category: 'AI & Vision', color: '#3776AB', icon: 'smart_toy' },
      { id: 7, name: 'FastAPI', slug: 'fastapi', category: 'Backend API', color: '#059669', icon: 'api' },
      { id: 8, name: 'REST API', slug: 'rest-api', category: 'Architecture', color: '#2674E7', icon: 'sync_alt' },
      { id: 9, name: 'WebGL & GLSL', slug: 'webgl-glsl', category: 'Graphics', color: '#E53E3E', icon: 'animation' },
      { id: 10, name: 'Docker', slug: 'docker', category: 'DevOps', color: '#2496ED', icon: 'deployed_code' }
    ];

    this.projects = [
      {
        id: 1,
        title: 'Zaitoon Restaurant Management System',
        slug: 'zaitoon-restaurant-pos-system',
        category_id: 2,
        short_description: 'End-to-end POS, kitchen display routing, and inventory telemetry built for high-throughput restaurant operations.',
        full_description: 'Engineered a mission-critical POS and hospitality ecosystem handling continuous order volume, multi-station kitchen display sync, offline resilience, and itemized ledger accounting.',
        problem: 'Peak meal rushes created bottlenecks between front-of-house order taking and multi-section kitchen stations.',
        solution: 'Built an offline-first, event-driven point of sale with real-time websocket kitchen tickets and automated inventory deduction.',
        results: 'Reduced peak order dispatch latency by 68% and eliminated billing discrepancies across thousands of monthly transactions.',
        workflow: '1. Fast Order Capture -> 2. Kitchen Routing & KDS -> 3. Automated Inventory Deduction -> 4. Daily Settlement',
        client_type: 'Hospitality & Dining',
        year: '2026',
        status: 'published',
        is_featured: 1,
        display_order: 1,
        thumbnail_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop',
        hero_image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1600&auto=format&fit=crop',
        live_url: 'https://wajidx.com/projects/zaitoon-restaurant-pos-system',
        github_url: 'https://github.com/zaitoonrestaurantandgrills-pixel/WAJIDX',
        docs_url: '',
        seo_title: 'Zaitoon POS & Restaurant Automation System | WAJIDX Case Study',
        seo_description: 'Case study of Zaitoon Point of Sale and Kitchen Display System engineered by WAJIDX.',
        seo_keywords: 'restaurant pos, kitchen display system, hospitality erp, point of sale software',
        created_at: new Date('2026-01-15T10:00:00Z'),
        updated_at: new Date('2026-02-01T12:00:00Z')
      },
      {
        id: 2,
        title: 'Enterprise Computer Vision Attendance & Security System',
        slug: 'computer-vision-attendance-system',
        category_id: 3,
        short_description: 'Real-time multi-person facial recognition and biometric attendance verification with anti-spoofing liveness detection.',
        full_description: 'Engineered a high-performance computer vision pipeline using Python and OpenCV to detect and verify staff identities under variable lighting.',
        problem: 'Traditional fingerprint scanners created queue bottlenecks at shift changeover and suffered from sensor wear.',
        solution: 'Constructed an edge-accelerated computer vision attendance appliance with dual-stage facial verification and automated timesheet sync.',
        results: 'Sub-300ms identification latency with 99.4% verification accuracy across 200+ concurrent personnel.',
        workflow: '1. Stream Ingest -> 2. Face Detection & Alignment -> 3. Embedding Matching -> 4. Timesheet Log',
        client_type: 'Enterprise Security',
        year: '2026',
        status: 'published',
        is_featured: 1,
        display_order: 2,
        thumbnail_url: 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?q=80&w=1200&auto=format&fit=crop',
        hero_image_url: 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?q=80&w=1600&auto=format&fit=crop',
        live_url: 'https://wajidx.com/projects/computer-vision-attendance-system',
        github_url: 'https://github.com/zaitoonrestaurantandgrills-pixel/WAJIDX',
        docs_url: '',
        seo_title: 'Computer Vision Attendance & Biometric Access | WAJIDX Case Study',
        seo_description: 'AI-driven facial recognition biometric attendance and timekeeping platform.',
        seo_keywords: 'computer vision, opencv, facial recognition, attendance system, biometric security',
        created_at: new Date('2026-01-20T10:00:00Z'),
        updated_at: new Date('2026-02-10T12:00:00Z')
      }
    ];

    this.projectTechnologies = [
      { project_id: 1, technology_id: 1 },
      { project_id: 1, technology_id: 2 },
      { project_id: 1, technology_id: 3 },
      { project_id: 1, technology_id: 5 },
      { project_id: 2, technology_id: 6 },
      { project_id: 2, technology_id: 7 },
      { project_id: 2, technology_id: 10 }
    ];

    this.projectFeatures = [
      { id: 1, project_id: 1, title: 'Multi-Station KDS Sync', description: 'Routes orders simultaneously to grill, fry, and beverage display screens.', icon: 'sync', display_order: 1 },
      { id: 2, project_id: 1, title: 'Itemized Split Billing', description: 'Supports complex table splitting, discounts, and payment methods.', icon: 'point_of_sale', display_order: 2 },
      { id: 3, project_id: 2, title: 'Liveness Detection', description: 'Prevents biometric spoofing from photos and screen recordings.', icon: 'security', display_order: 1 },
      { id: 4, project_id: 2, title: 'Real-time Edge Inference', description: 'Under 300ms verification cycle on low-power local edge hardware.', icon: 'bolt', display_order: 2 }
    ];

    this.projectImages = [];
    this.messages = [];
    this.revisions = [];
    this.snapshots = [];
    this.schemaMigrations = [
      { version: '20260830000001_001_initial_schema', name: 'Initial WAJIDX Database Schema', applied_at: new Date() },
      { version: '20260830000002_002_add_versioning_tables', name: 'Add Revisions, Snapshots and Schema Migration Tables', applied_at: new Date() }
    ];
    this.siteSettings = {
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
    };

    this.autoIncrement = {
      projects: 3,
      categories: 6,
      technologies: 11,
      projectFeatures: 5,
      projectImages: 1,
      messages: 1,
      revisions: 1,
      snapshots: 1
    };
  }

  async executeQuery(sql, params = []) {
    const rawSql = sql.trim();
    const upper = rawSql.toUpperCase();

    // 1. SELECT ADMINS
    if (upper.includes('FROM WAJIDX_ADMINS')) {
      let filtered = [...this.admins];
      if (params.length >= 2) {
        filtered = filtered.filter(a => a.username === params[0] || a.email === params[1]);
      } else if (params.length === 1) {
        filtered = filtered.filter(a => a.id === parseInt(params[0], 10) || a.username === params[0] || a.email === params[0]);
      }
      return [filtered, []];
    }

    // 2. STATS QUERY
    if (upper.includes('COUNT(*)') && upper.includes('FROM WAJIDX_PROJECTS')) {
      const total = this.projects.length;
      const published = this.projects.filter(p => p.status === 'published').length;
      const draft = this.projects.filter(p => p.status === 'draft').length;
      const featured = this.projects.filter(p => p.is_featured === 1).length;
      return [[{ total_projects: total, published_projects: published, draft_projects: draft, featured_projects: featured }], []];
    }

    if (upper.includes('COUNT(*)') && upper.includes('FROM WAJIDX_CATEGORIES')) {
      return [[{ total_categories: this.categories.length }], []];
    }

    if (upper.includes('COUNT(*)') && upper.includes('FROM WAJIDX_TECHNOLOGIES')) {
      return [[{ total_technologies: this.technologies.length }], []];
    }

    if (upper.includes('COUNT(*)') && upper.includes('FROM WAJIDX_CONTACT_MESSAGES')) {
      const unread = this.messages.filter(m => !m.is_read).length;
      return [[{ total_messages: this.messages.length, unread_messages: unread }], []];
    }

    // 3. SELECT CATEGORIES
    if (upper.includes('FROM WAJIDX_CATEGORIES')) {
      const res = this.categories.map(c => {
        const pCount = this.projects.filter(p => p.category_id === c.id).length;
        return { ...c, project_count: pCount };
      });
      if (params.length > 0) {
        return [res.filter(c => c.id === parseInt(params[0], 10) || c.slug === params[0]), []];
      }
      return [res, []];
    }

    // 4. SELECT TECHNOLOGIES
    if (upper.includes('FROM WAJIDX_TECHNOLOGIES')) {
      const res = this.technologies.map(t => {
        const pCount = this.projectTechnologies.filter(pt => pt.technology_id === t.id).length;
        return { ...t, project_count: pCount };
      });
      if (params.length > 0) {
        return [res.filter(t => t.id === parseInt(params[0], 10) || t.slug === params[0]), []];
      }
      return [res, []];
    }

    // 5. SELECT PROJECTS
    if (upper.includes('FROM WAJIDX_PROJECTS') && upper.startsWith('SELECT')) {
      let list = [...this.projects];

      if (upper.includes('WHERE SLUG = ?') || upper.includes('WHERE P.SLUG = ?')) {
        const slug = params[0];
        const match = list.filter(p => p.slug === slug);
        return [this._enrichProjects(match), []];
      }

      if (upper.includes('WHERE ID = ?') || upper.includes('WHERE P.ID = ?')) {
        const id = parseInt(params[0], 10);
        const match = list.filter(p => p.id === id);
        return [this._enrichProjects(match), []];
      }

      if (upper.includes('WHERE STATUS =') || upper.includes("WHERE P.STATUS = 'PUBLISHED'")) {
        list = list.filter(p => p.status === 'published');
      }

      return [this._enrichProjects(list), []];
    }

    // 6. SELECT PROJECT TECHNOLOGIES
    if (upper.includes('FROM WAJIDX_PROJECT_TECHNOLOGIES')) {
      if (params.length > 0) {
        const pId = parseInt(params[0], 10);
        const rows = this.projectTechnologies
          .filter(pt => pt.project_id === pId)
          .map(pt => {
            const tech = this.technologies.find(t => t.id === pt.technology_id) || {};
            return {
              project_id: pt.project_id,
              technology_id: pt.technology_id,
              id: tech.id,
              name: tech.name,
              slug: tech.slug,
              category: tech.category,
              color: tech.color,
              icon: tech.icon
            };
          });
        return [rows, []];
      }
      return [this.projectTechnologies, []];
    }

    // 7. SELECT PROJECT FEATURES
    if (upper.includes('FROM WAJIDX_PROJECT_FEATURES')) {
      if (params.length > 0) {
        const pId = parseInt(params[0], 10);
        return [this.projectFeatures.filter(f => f.project_id === pId), []];
      }
      return [this.projectFeatures, []];
    }

    // 8. SELECT PROJECT IMAGES
    if (upper.includes('FROM WAJIDX_PROJECT_IMAGES')) {
      if (params.length > 0) {
        const pId = parseInt(params[0], 10);
        return [this.projectImages.filter(img => img.project_id === pId), []];
      }
      return [this.projectImages, []];
    }

    // 9. SELECT MESSAGES
    if (upper.includes('FROM WAJIDX_CONTACT_MESSAGES') && upper.startsWith('SELECT')) {
      return [this.messages, []];
    }

    // 10. SELECT SETTINGS
    if (upper.includes('FROM WAJIDX_SITE_SETTINGS') && upper.startsWith('SELECT')) {
      const rows = Object.entries(this.siteSettings).map(([k, v]) => ({ setting_key: k, setting_value: v }));
      return [rows, []];
    }

    // 11. INSERT INTO PROJECTS
    if (upper.startsWith('INSERT INTO WAJIDX_PROJECTS') || upper.startsWith('INSERT INTO `WAJIDX_PROJECTS`')) {
      const newId = this.autoIncrement.projects++;
      const [
        title, slug, category_id, short_description, full_description,
        problem, solution, results, workflow, client_type, year,
        status, is_featured, display_order, thumbnail_url, hero_image_url,
        live_url, github_url, docs_url, seo_title, seo_description, seo_keywords
      ] = params;

      const projectRecord = {
        id: newId,
        title: title || 'Untitled Project',
        slug: slug || `project-${newId}`,
        category_id: category_id ? parseInt(category_id, 10) : null,
        short_description: short_description || '',
        full_description: full_description || '',
        problem: problem || '',
        solution: solution || '',
        results: results || '',
        workflow: workflow || '',
        client_type: client_type || 'Enterprise Custom',
        year: year || new Date().getFullYear().toString(),
        status: status || 'published',
        is_featured: is_featured ? 1 : 0,
        display_order: display_order ? parseInt(display_order, 10) : 0,
        thumbnail_url: thumbnail_url || '',
        hero_image_url: hero_image_url || '',
        live_url: live_url || '',
        github_url: github_url || '',
        docs_url: docs_url || '',
        seo_title: seo_title || '',
        seo_description: seo_description || '',
        seo_keywords: seo_keywords || '',
        created_at: new Date(),
        updated_at: new Date()
      };

      this.projects.unshift(projectRecord);
      return [{ insertId: newId, affectedRows: 1, rowCount: 1, rows: [{ id: newId }] }];
    }

    // 12. UPDATE PROJECTS
    if (upper.startsWith('UPDATE WAJIDX_PROJECTS')) {
      const pId = parseInt(params[params.length - 1], 10);
      const proj = this.projects.find(p => p.id === pId);
      if (proj) {
        proj.title = params[0] !== undefined ? params[0] : proj.title;
        proj.slug = params[1] !== undefined ? params[1] : proj.slug;
        proj.category_id = params[2] !== undefined ? parseInt(params[2], 10) : proj.category_id;
        proj.short_description = params[3] !== undefined ? params[3] : proj.short_description;
        proj.full_description = params[4] !== undefined ? params[4] : proj.full_description;
        proj.problem = params[5] !== undefined ? params[5] : proj.problem;
        proj.solution = params[6] !== undefined ? params[6] : proj.solution;
        proj.results = params[7] !== undefined ? params[7] : proj.results;
        proj.workflow = params[8] !== undefined ? params[8] : proj.workflow;
        proj.client_type = params[9] !== undefined ? params[9] : proj.client_type;
        proj.year = params[10] !== undefined ? params[10] : proj.year;
        proj.status = params[11] !== undefined ? params[11] : proj.status;
        proj.is_featured = params[12] !== undefined ? (params[12] ? 1 : 0) : proj.is_featured;
        proj.display_order = params[13] !== undefined ? parseInt(params[13], 10) : proj.display_order;
        proj.thumbnail_url = params[14] !== undefined ? params[14] : proj.thumbnail_url;
        proj.hero_image_url = params[15] !== undefined ? params[15] : proj.hero_image_url;
        proj.live_url = params[16] !== undefined ? params[16] : proj.live_url;
        proj.github_url = params[17] !== undefined ? params[17] : proj.github_url;
        proj.docs_url = params[18] !== undefined ? params[18] : proj.docs_url;
        proj.seo_title = params[19] !== undefined ? params[19] : proj.seo_title;
        proj.seo_description = params[20] !== undefined ? params[20] : proj.seo_description;
        proj.seo_keywords = params[21] !== undefined ? params[21] : proj.seo_keywords;
        proj.updated_at = new Date();
      }
      return [{ insertId: pId, affectedRows: 1, rowCount: 1, rows: [{ id: pId }] }];
    }

    // 13. DELETE PROJECTS
    if (upper.startsWith('DELETE FROM WAJIDX_PROJECTS')) {
      const pId = parseInt(params[0], 10);
      this.projects = this.projects.filter(p => p.id !== pId);
      this.projectTechnologies = this.projectTechnologies.filter(pt => pt.project_id !== pId);
      this.projectFeatures = this.projectFeatures.filter(f => f.project_id !== pId);
      this.projectImages = this.projectImages.filter(img => img.project_id !== pId);
      return [{ affectedRows: 1, rowCount: 1 }];
    }

    // 14. INSERT PROJECT TECHNOLOGIES
    if (upper.includes('INTO WAJIDX_PROJECT_TECHNOLOGIES')) {
      const [pId, tId] = params;
      const exists = this.projectTechnologies.some(pt => pt.project_id === parseInt(pId, 10) && pt.technology_id === parseInt(tId, 10));
      if (!exists) {
        this.projectTechnologies.push({ project_id: parseInt(pId, 10), technology_id: parseInt(tId, 10) });
      }
      return [{ affectedRows: 1, rowCount: 1 }];
    }

    // 15. INSERT PROJECT FEATURES
    if (upper.includes('INTO WAJIDX_PROJECT_FEATURES')) {
      const [pId, title, desc, icon, order] = params;
      const newId = this.autoIncrement.projectFeatures++;
      this.projectFeatures.push({
        id: newId,
        project_id: parseInt(pId, 10),
        title,
        description: desc,
        icon: icon || 'check_circle',
        display_order: order || 1
      });
      return [{ insertId: newId, affectedRows: 1, rowCount: 1 }];
    }

    // 16. INSERT CONTACT MESSAGES
    if (upper.includes('INTO WAJIDX_CONTACT_MESSAGES')) {
      const newId = this.autoIncrement.messages++;
      let name, email, phone, company, projectType, budget, subject, message, ip, agent;
      if (params.length === 5) {
        [name, email, subject, message, ip] = params;
      } else {
        [name, email, phone, company, projectType, budget, message, ip, agent] = params;
      }
      this.messages.unshift({
        id: newId,
        name: name || '',
        email: email || '',
        phone: phone || '',
        company: company || '',
        project_type: projectType || 'General',
        budget_range: budget || '',
        subject: subject || `Project Inquiry from ${name}`,
        message: message || '',
        ip_address: ip || '',
        user_agent: agent || '',
        is_read: false,
        created_at: new Date()
      });
      return [{ insertId: newId, affectedRows: 1, rowCount: 1 }];
    }

    // 17. SITE SETTINGS UPDATE
    if (upper.includes('WAJIDX_SITE_SETTINGS') && (upper.includes('INSERT') || upper.includes('UPDATE'))) {
      const [key, value] = params;
      if (key) {
        this.siteSettings[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }
      return [{ affectedRows: 1, rowCount: 1 }];
    }

    // 18. REVISIONS
    if (upper.includes('FROM WAJIDX_REVISIONS') && upper.startsWith('SELECT')) {
      let list = [...this.revisions];
      if (upper.includes('WHERE ENTITY_TYPE =') && params.length >= 2) {
        list = list.filter(r => r.entity_type === params[0] && r.entity_id === parseInt(params[1], 10));
      } else if (upper.includes('WHERE ENTITY_TYPE =') && params.length === 1) {
        list = list.filter(r => r.entity_type === params[0]);
      } else if (upper.includes('WHERE ID =') && params.length >= 1) {
        list = list.filter(r => r.id === parseInt(params[0], 10));
      }
      list.sort((a, b) => (b.version_number || 0) - (a.version_number || 0));
      return [list, []];
    }

    if (upper.includes('INTO WAJIDX_REVISIONS')) {
      const newId = this.autoIncrement.revisions++;
      const [type, entityId, versionNum, summary, data, author] = params;
      this.revisions.unshift({
        id: newId,
        entity_type: type,
        entity_id: entityId ? parseInt(entityId, 10) : null,
        version_number: versionNum || 1,
        change_summary: summary || 'Revision recorded',
        snapshot_data: typeof data === 'string' ? data : JSON.stringify(data),
        created_by: author || 'admin',
        created_at: new Date()
      });
      return [{ insertId: newId, affectedRows: 1, rowCount: 1 }];
    }

    // 19. SNAPSHOTS
    if (upper.includes('FROM WAJIDX_SNAPSHOTS') && upper.startsWith('SELECT')) {
      let list = [...this.snapshots];
      if (upper.includes('WHERE ID =') && params.length >= 1) {
        list = list.filter(s => s.id === parseInt(params[0], 10));
      }
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return [list, []];
    }

    if (upper.includes('INTO WAJIDX_SNAPSHOTS')) {
      const newId = this.autoIncrement.snapshots++;
      const [name, type, counts, payload, author] = params;
      this.snapshots.unshift({
        id: newId,
        snapshot_name: name,
        snapshot_type: type || 'manual',
        item_counts: typeof counts === 'string' ? counts : JSON.stringify(counts),
        payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
        created_by: author || 'admin',
        created_at: new Date()
      });
      return [{ insertId: newId, affectedRows: 1, rowCount: 1 }];
    }

    if (upper.startsWith('DELETE FROM WAJIDX_SNAPSHOTS')) {
      const id = parseInt(params[0], 10);
      this.snapshots = this.snapshots.filter(s => s.id !== id);
      return [{ affectedRows: 1, rowCount: 1 }];
    }

    // 20. SCHEMA MIGRATIONS
    if (upper.includes('FROM WAJIDX_SCHEMA_MIGRATIONS') && upper.startsWith('SELECT')) {
      return [[...this.schemaMigrations], []];
    }

    if (upper.includes('INTO WAJIDX_SCHEMA_MIGRATIONS')) {
      const [version, name] = params;
      const exists = this.schemaMigrations.some(m => m.version === version);
      if (!exists) {
        this.schemaMigrations.push({ version, name, applied_at: new Date() });
      }
      return [{ affectedRows: 1, rowCount: 1 }];
    }

    if (upper.startsWith('DELETE FROM WAJIDX_SCHEMA_MIGRATIONS')) {
      const version = params[0];
      this.schemaMigrations = this.schemaMigrations.filter(m => m.version !== version);
      return [{ affectedRows: 1, rowCount: 1 }];
    }

    // CREATE TABLE / DDL ignore
    if (upper.startsWith('CREATE TABLE') || upper.startsWith('CREATE INDEX') || upper.startsWith('DROP TABLE')) {
      return [{ affectedRows: 0, rowCount: 0 }];
    }

    // Default fallback: return empty list / success
    return [[], []];
  }

  _enrichProjects(list) {
    return list.map(p => {
      const cat = this.categories.find(c => c.id === p.category_id) || {};
      const ptList = this.projectTechnologies.filter(pt => pt.project_id === p.id);
      const techNames = ptList.map(pt => {
        const t = this.technologies.find(tech => tech.id === pt.technology_id);
        return t ? t.name : null;
      }).filter(Boolean);
      return {
        ...p,
        category_name: cat.name || 'General',
        category_slug: cat.slug || 'general',
        technology_names: techNames
      };
    });
  }
}

const memoryDbInstance = new InMemoryDatabase();

module.exports = memoryDbInstance;
