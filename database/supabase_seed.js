require('dotenv').config();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { query, isPostgres, testConnection } = require('../config/db');

async function seedSupabase() {
  console.log('====================================================');
  console.log('[SUPABASE SEED] Initializing Supabase PostgreSQL...');
  console.log('====================================================');

  const ok = await testConnection();
  if (!ok) {
    console.error('[SUPABASE SEED ERROR] Unable to connect to database. Please verify SUPABASE_DB_URL in .env');
    process.exit(1);
  }

  // 1. Run Schema SQL
  const schemaPath = path.join(__dirname, 'supabase_schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  console.log('[SUPABASE SEED] Applying schema statements...');
  // Split statements by semicolon where appropriate or execute blocks
  const statements = schemaSql
    .split(';')
    .map(st => st.trim())
    .filter(st => st.length > 0 && !st.startsWith('--'));

  for (const statement of statements) {
    try {
      await query(statement);
    } catch (err) {
      // Ignore if table/policy already exists
      if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
        console.warn(`[SUPABASE SEED NOTE] Statement skipped or already exists: ${err.message}`);
      }
    }
  }
  console.log('[SUPABASE SEED] Schema initialized!');

  // 2. Admin User
  const adminUsername = process.env.ADMIN_DEFAULT_USER || 'admin';
  const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@wajidx.com';
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@Wajidx2026!';

  const [existingAdmins] = await query('SELECT id FROM wajidx_admins WHERE username = ? OR email = ?', [adminUsername, adminEmail]);
  if (existingAdmins.length === 0) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await query(
      'INSERT INTO wajidx_admins (username, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
      [adminUsername, adminEmail, passwordHash, 'WAJIDX Principal', 'superadmin']
    );
    console.log(`[SUPABASE SEED] Created admin account: ${adminEmail}`);
  } else {
    console.log('[SUPABASE SEED] Admin account already present.');
  }

  // 3. Categories
  const categories = [
    { name: 'Business Systems', slug: 'business-systems', description: 'Enterprise operational workflows, ERP systems, and internal tooling.', display_order: 1 },
    { name: 'POS & Hospitality', slug: 'pos-hospitality', description: 'High-speed Point-of-Sale, kitchen order routing, and restaurant tech.', display_order: 2 },
    { name: 'AI & Automation', slug: 'ai-automation', description: 'Computer vision, biometrics, neural pipelines, and automated bots.', display_order: 3 },
    { name: 'Web Applications', slug: 'web-applications', description: 'Scalable modern web platforms and customer-facing digital portals.', display_order: 4 },
    { name: 'Inventory & ERP', slug: 'inventory-erp', description: 'Multi-warehouse stock control, procurement, and bill-of-materials.', display_order: 5 }
  ];

  const categoryMap = {};
  for (const cat of categories) {
    const [existing] = await query('SELECT id FROM wajidx_categories WHERE slug = ?', [cat.slug]);
    if (existing.length === 0) {
      const [res] = await query(
        'INSERT INTO wajidx_categories (name, slug, description, display_order) VALUES (?, ?, ?, ?)',
        [cat.name, cat.slug, cat.description, cat.display_order]
      );
      categoryMap[cat.slug] = res.insertId;
    } else {
      categoryMap[cat.slug] = existing[0].id;
    }
  }
  console.log('[SUPABASE SEED] Categories verified.');

  // 4. Technologies
  const technologies = [
    { name: 'React', slug: 'react', category: 'Frontend', color: '#61DAFB', icon: 'code' },
    { name: 'Node.js', slug: 'nodejs', category: 'Backend', color: '#68A063', icon: 'terminal' },
    { name: 'MySQL', slug: 'mysql', category: 'Database', color: '#00758F', icon: 'database' },
    { name: 'PostgreSQL', slug: 'postgresql', category: 'Database', color: '#336791', icon: 'database' },
    { name: 'Tailwind CSS', slug: 'tailwindcss', category: 'Styling', color: '#38BDF8', icon: 'css' },
    { name: 'Python & OpenCV', slug: 'python-opencv', category: 'AI & Vision', color: '#3776AB', icon: 'smart_toy' },
    { name: 'FastAPI', slug: 'fastapi', category: 'Backend API', color: '#059669', icon: 'api' },
    { name: 'REST API', slug: 'rest-api', category: 'Architecture', color: '#2674E7', icon: 'sync_alt' },
    { name: 'WebGL & GLSL', slug: 'webgl-glsl', category: 'Graphics', color: '#E53E3E', icon: 'animation' },
    { name: 'Docker', slug: 'docker', category: 'DevOps', color: '#2496ED', icon: 'deployed_code' }
  ];

  const techMap = {};
  for (const tech of technologies) {
    const [existing] = await query('SELECT id FROM wajidx_technologies WHERE slug = ?', [tech.slug]);
    if (existing.length === 0) {
      const [res] = await query(
        'INSERT INTO wajidx_technologies (name, slug, category, color, icon) VALUES (?, ?, ?, ?, ?)',
        [tech.name, tech.slug, tech.category, tech.color, tech.icon]
      );
      techMap[tech.slug] = res.insertId;
    } else {
      techMap[tech.slug] = existing[0].id;
    }
  }
  console.log('[SUPABASE SEED] Technologies verified.');

  // 5. Projects
  const projects = [
    {
      title: 'Zaitoon Restaurant Management System',
      slug: 'zaitoon-restaurant-management-system',
      category_id: categoryMap['pos-hospitality'] || categoryMap['business-systems'],
      short_description: 'A comprehensive ecosystem engineered for seamless point-of-sale, inventory control, complex recipe management, and high-volume business operations.',
      full_description: 'Zaitoon RMS is a mission-critical restaurant management platform created to streamline operations across dining rooms, kitchens, warehouses, and executive accounting. Engineered with a local-first fail-safe architecture, the platform maintains zero-latency order entry even during network disruptions, seamlessly syncing transactions to the central cloud cluster once connectivity is restored.',
      problem: 'High-volume restaurant chains face severe operational bottlenecks: erratic raw material inventory shrinkage, untracked recipe cost variations, delayed Kitchen Order Tickets (KOT), and fragmented terminal sync during peak dining hours.',
      solution: 'Engineered an ultra-fast, local-first hybrid POS and centralized management system with sub-second order dispatch, automated recipe BOM depletion down to the gram, multi-station KOT routing, and end-of-day financial reconciliation.',
      results: 'Eliminated 94% of order dispatch delays, reduced unaccounted raw material inventory shrinkage by 18.5%, and provided real-time gross margin insights per dish across peak service shifts.',
      workflow: '1. Order Entry -> 2. Instant Kitchen Dispatch (KDS/Thermal) -> 3. Ingredient Gram Depletion -> 4. Real-Time Shift Reconciliations',
      client_type: 'Multi-Branch Restaurant Chain',
      year: '2024',
      status: 'published',
      is_featured: 1,
      display_order: 1,
      thumbnail_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
      hero_image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1600&q=85',
      live_url: 'https://zaitoon.wajidx.com',
      github_url: 'https://github.com/wajidx/zaitoon-rms',
      docs_url: 'https://docs.wajidx.com/zaitoon-rms',
      seo_title: 'Zaitoon Restaurant Management System | WAJIDX Portfolio',
      seo_description: 'Case study of Zaitoon RMS: High-performance POS, automated recipe costing, and real-time inventory management engineered by WAJIDX.',
      seo_keywords: 'restaurant management, POS system, recipe costing, inventory control, KOT system, restaurant ERP, WAJIDX',
      techSlugs: ['react', 'nodejs', 'postgresql', 'tailwindcss', 'rest-api', 'docker'],
      features: [
        { title: 'High-Speed POS Terminal', description: 'Touch and rapid keyboard shortcut design with sub-50ms dispatch to kitchen print stations and digital displays.', icon: 'point_of_sale' },
        { title: 'Dynamic Bill of Materials (BOM)', description: 'Automatic inventory deduction at the ingredient gram level immediately upon order confirmation.', icon: 'inventory_2' },
        { title: 'Kitchen Display System (KDS)', description: 'Color-coded station routing (Grill, Fryer, Assembly, Beverage) with real-time preparation countdown timers.', icon: 'soup_kitchen' },
        { title: 'Role-Based Shift Audits', description: 'Granular cashier registers, blind end-of-shift drop counts, and automated variance analysis.', icon: 'security' },
        { title: 'Live Menu Margin Analytics', description: 'Automated gross margin computation per menu item dynamically tied to live ingredient supplier invoices.', icon: 'trending_up' }
      ],
      images: [
        { image_url: 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1200&q=80', caption: 'Point of Sale Terminal Interface', alt_text: 'POS Terminal Touchscreen UI' },
        { image_url: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80', caption: 'Kitchen Display System Workflow', alt_text: 'Kitchen Order Display Grid' },
        { image_url: 'https://images.unsplash.com/photo-1507842229451-7f01e6950d0e?auto=format&fit=crop&w=1200&q=80', caption: 'Live Inventory & Recipe Costing Analytics', alt_text: 'Inventory and Profit Analytics' }
      ]
    },
    {
      title: 'WAJIDX Face Attendance System',
      slug: 'face-attendance-system',
      category_id: categoryMap['ai-automation'],
      short_description: 'Edge-computed computer vision platform delivering millisecond facial biometric verification and automated payroll logging.',
      full_description: 'WAJIDX Face Attendance is a modern contactless workforce verification system. Leveraging deep convolutional neural network embeddings optimized for edge devices, it detects and verifies employees in under 400 milliseconds, even in challenging warehouse lighting or with optical occlusions.',
      problem: 'Traditional biometric fingerprint scanners cause massive queues during shift turnovers, suffer high failure rates in industrial environments, and are vulnerable to buddy punching.',
      solution: 'Implemented a high-throughput facial recognition pipeline using lightweight neural embeddings running directly on edge hardware with liveness detection and automated anti-spoofing.',
      results: 'Sub-400ms multi-face detection in variable lighting, zero buddy-punching incidents, and direct automated sync to HR payroll ledger.',
      workflow: '1. Camera Stream -> 2. Face Detection & Liveness Check -> 3. 128-d Feature Matching -> 4. Attendance Timestamp Logged',
      client_type: 'Industrial Logistics & Corporate HQ',
      year: '2024',
      status: 'published',
      is_featured: 1,
      display_order: 2,
      thumbnail_url: 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=1200&q=80',
      hero_image_url: 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=1600&q=85',
      live_url: 'https://attendance.wajidx.com',
      github_url: 'https://github.com/wajidx/face-attendance',
      docs_url: 'https://docs.wajidx.com/face-attendance',
      seo_title: 'AI Face Attendance & Biometrics Platform | WAJIDX Portfolio',
      seo_description: 'Real-time computer vision attendance system with edge computing and automated payroll sync by WAJIDX.',
      seo_keywords: 'face attendance, computer vision, biometrics, edge AI, OpenCV, automated payroll, WAJIDX',
      techSlugs: ['python-opencv', 'fastapi', 'nodejs', 'postgresql', 'docker', 'rest-api'],
      features: [
        { title: 'Sub-400ms Edge Inference', description: 'Real-time facial landmarking and embedding comparison executed on local edge gateway devices.', icon: 'bolt' },
        { title: 'Anti-Spoofing & Liveness', description: 'Passive texture analysis and infrared micro-movement checks to prevent 2D photo or screen spoofing.', icon: 'verified_user' },
        { title: 'Simultaneous Multi-Face Tracking', description: 'Logs multiple employees passing through turnstiles in a single continuous video frame.', icon: 'groups' },
        { title: 'Offline Storage & Auto-Sync', description: 'Local SQLite/buffer storage guarantees continuous operation during network dropouts, syncing automatically.', icon: 'cloud_sync' },
        { title: 'Automated Shift & Overtime Logic', description: 'Intelligent calculation of late arrivals, overtime, and automatic generation of compliant timesheet exports.', icon: 'schedule' }
      ],
      images: [
        { image_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80', caption: 'Real-Time Neural Detection View', alt_text: 'Computer Vision Facial Landmarking' },
        { image_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80', caption: 'Shift Analytics & Payroll Dashboard', alt_text: 'Attendance Log Grid and Reports' }
      ]
    },
    {
      title: 'Recipe & Cost Management Studio',
      slug: 'recipe-cost-management-studio',
      category_id: categoryMap['business-systems'] || categoryMap['pos-hospitality'],
      short_description: 'Precision culinary calculation engine delivering live recipe batch costing, supplier price indexing, and profit margin simulations.',
      full_description: 'A specialized financial software engineered for food manufacturing, commissary kitchens, and restaurant groups. It recalculates exact plate costs, batch yields, and target retail selling prices dynamically whenever supplier raw material prices change.',
      problem: 'Fluctuating commodity prices cause hidden margin erosion when businesses calculate menu costs using static spreadsheets without real-time supplier invoice links.',
      solution: 'Created an interactive recipe modeling workbench that dynamically re-calculates dish cost, batch yields, and target retail pricing whenever supplier invoice unit prices change.',
      results: 'Protected menu profit margins by immediately highlighting margin erosion and automating suggested price adjustments across 450+ recipes.',
      workflow: '1. Ingredient Catalog -> 2. Batch Recipe Composition -> 3. Yield & Wastage Calculation -> 4. Target Margin Optimization',
      client_type: 'Commissary & Restaurant Group',
      year: '2024',
      status: 'published',
      is_featured: 1,
      display_order: 3,
      thumbnail_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80',
      hero_image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1600&q=85',
      live_url: 'https://recipe.wajidx.com',
      github_url: 'https://github.com/wajidx/recipe-cost-engine',
      docs_url: 'https://docs.wajidx.com/recipe-studio',
      seo_title: 'Recipe Costing & Culinary Margin Studio | WAJIDX Portfolio',
      seo_description: 'Precision recipe batch costing, dynamic BOM, and supplier invoice pricing engine developed by WAJIDX.',
      seo_keywords: 'recipe costing, restaurant ERP, food cost calculator, bill of materials, menu pricing, WAJIDX',
      techSlugs: ['react', 'nodejs', 'postgresql', 'tailwindcss', 'rest-api'],
      features: [
        { title: 'Nested Sub-Recipe Architecture', description: 'Model sauces, bases, and pre-prep items as reusable sub-recipes with inheritance of cost changes.', icon: 'account_tree' },
        { title: 'Real-Time Supplier Price Indexing', description: 'Automatically feeds latest procurement invoice unit costs directly into dish pricing formulas.', icon: 'price_change' },
        { title: 'Interactive Margin Simulator', description: 'Simulate target gross margins, overhead absorption, and portion scale factors in real time.', icon: 'tune' },
        { title: 'Standardized Kitchen SOP Prep Cards', description: 'Generate allergen badges, exact gram measurements, and photo-illustrated prep instructions.', icon: 'menu_book' }
      ],
      images: [
        { image_url: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80', caption: 'Interactive Recipe Costing Breakdown', alt_text: 'Ingredient Cost Breakdown UI' },
        { image_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80', caption: 'Commodity Price Trend Analyzer', alt_text: 'Ingredient Price Volatility Graph' }
      ]
    }
  ];

  for (const proj of projects) {
    const [existing] = await query('SELECT id FROM wajidx_projects WHERE slug = ?', [proj.slug]);
    let projectId;
    if (existing.length === 0) {
      const [res] = await query(
        `INSERT INTO wajidx_projects 
         (title, slug, category_id, short_description, full_description, problem, solution, results, workflow, client_type, year, status, is_featured, display_order, thumbnail_url, hero_image_url, live_url, github_url, docs_url, seo_title, seo_description, seo_keywords)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          proj.title, proj.slug, proj.category_id, proj.short_description, proj.full_description,
          proj.problem, proj.solution, proj.results, proj.workflow, proj.client_type, proj.year,
          proj.status, proj.is_featured, proj.display_order, proj.thumbnail_url, proj.hero_image_url,
          proj.live_url, proj.github_url, proj.docs_url, proj.seo_title, proj.seo_description, proj.seo_keywords
        ]
      );
      projectId = res.insertId;
      console.log(`[SUPABASE SEED] Created project: ${proj.title}`);
    } else {
      projectId = existing[0].id;
      console.log(`[SUPABASE SEED] Project already exists: ${proj.title}`);
    }

    // Link technologies
    await query('DELETE FROM wajidx_project_technologies WHERE project_id = ?', [projectId]);
    for (const techSlug of proj.techSlugs) {
      const techId = techMap[techSlug];
      if (techId) {
        try {
          await query('INSERT INTO wajidx_project_technologies (project_id, technology_id) VALUES (?, ?)', [projectId, techId]);
        } catch (e) {
          // ignore duplicates
        }
      }
    }

    // Add features
    await query('DELETE FROM wajidx_project_features WHERE project_id = ?', [projectId]);
    for (let i = 0; i < proj.features.length; i++) {
      const f = proj.features[i];
      await query(
        'INSERT INTO wajidx_project_features (project_id, title, description, icon, display_order) VALUES (?, ?, ?, ?, ?)',
        [projectId, f.title, f.description, f.icon, i + 1]
      );
    }

    // Add images
    await query('DELETE FROM wajidx_project_images WHERE project_id = ?', [projectId]);
    for (let i = 0; i < proj.images.length; i++) {
      const img = proj.images[i];
      await query(
        'INSERT INTO wajidx_project_images (project_id, image_url, caption, alt_text, display_order) VALUES (?, ?, ?, ?, ?)',
        [projectId, img.image_url, img.caption, img.alt_text, i + 1]
      );
    }
  }

  // 6. Site Settings
  const defaultSettings = [
    ['site_brand_name', 'WAJIDX'],
    ['site_tagline', 'Build. Automate. Innovate.'],
    ['site_description', 'WAJIDX is a technology and digital solutions brand focused on practical business systems, automation pipelines, computer vision AI, and custom software engineering.'],
    ['site_logo_text', 'WX'],
    ['contact_email', 'contact@wajidx.com'],
    ['contact_phone', '+923351362639'],
    ['contact_address', 'Karachi, Pakistan'],
    ['social_linkedin', 'https://linkedin.com/company/wajidx'],
    ['social_github', 'https://github.com/wajidx'],
    ['social_twitter', 'https://x.com/wajidx'],
    ['footer_text', '© 2026 WAJIDX. All rights reserved. Precision engineering for digital solutions.'],
    ['seo_default_title', 'WAJIDX — Build. Automate. Innovate. | Technology & Software Studio'],
    ['seo_default_description', 'WAJIDX creates practical business systems, POS platforms, computer vision AI, and enterprise automation pipelines.'],
    ['seo_default_keywords', 'WAJIDX, software engineering, business systems, POS, restaurant ERP, computer vision, AI automation, web applications'],
    ['analytics_id', '']
  ];

  for (const [key, value] of defaultSettings) {
    await query(
      'INSERT INTO wajidx_site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
      [key, value]
    );
  }

  console.log('====================================================');
  console.log('🎉 Supabase PostgreSQL Database successfully seeded!');
  console.log('====================================================');
}

if (require.main === module) {
  seedSupabase()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedSupabase };
