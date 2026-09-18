const fs = require('fs');
const path = require('path');
const { query } = require('../config/db');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeSiteUrl(siteUrl) {
  return String(siteUrl || 'https://wajid.website').replace(/\/+$/, '');
}

function publicUrl(siteUrl, pathname) {
  const base = normalizeSiteUrl(siteUrl);
  const safePath = pathname === '/' ? '/' : '/' + String(pathname || '').replace(/^\/+|\/+$/g, '');
  return safePath === '/' ? base + '/' : base + safePath;
}

async function loadSettings() {
  const defaults = {
    site_brand_name: 'WAJIDX',
    site_tagline: 'Build. Automate. Innovate.',
    site_description: 'Custom POS, ERP, AI, and automation systems for restaurants, retail, and operations-heavy teams.',
    contact_email: 'contact@wajidx.com',
    contact_phone: '+923351362639',
    contact_address: 'Karachi, Pakistan',
    social_github: 'https://github.com/wajidx',
    social_linkedin: '',
    social_twitter: 'https://x.com/wajidx'
  };

  try {
    const [rows] = await query('SELECT setting_key, setting_value FROM wajidx_site_settings');
    for (const row of rows || []) {
      if (row && row.setting_key) defaults[row.setting_key] = row.setting_value;
    }
  } catch (error) {
    console.warn('[SSR NOTE] Settings fallback in use:', error.message);
  }

  return defaults;
}

async function loadProjects({ featuredOnly = false, limit = 12 } = {}) {
  try {
    const featuredClause = featuredOnly ? ' AND p.is_featured = 1' : '';
    const sql = `
      SELECT
        p.id, p.title, p.slug, p.short_description, p.client_type, p.year,
        p.is_featured, p.thumbnail_url, p.hero_image_url, p.live_url, p.github_url,
        c.name AS category_name
      FROM wajidx_projects p
      LEFT JOIN wajidx_categories c ON p.category_id = c.id
      WHERE p.status = 'published'${featuredClause}
      ORDER BY p.is_featured DESC, p.display_order ASC, p.created_at DESC
      LIMIT ${Number(limit) || 12}
    `;
    const [projects] = await query(sql);
    return Array.isArray(projects) ? projects : [];
  } catch (error) {
    console.warn('[SSR NOTE] Project list unavailable:', error.message);
    return [];
  }
}

async function loadProjectBySlug(slug) {
  try {
    const [projects] = await query(
      `SELECT p.*, c.name AS category_name
       FROM wajidx_projects p
       LEFT JOIN wajidx_categories c ON p.category_id = c.id
       WHERE p.slug = ? AND p.status = 'published'
       LIMIT 1`,
      [slug]
    );
    return projects && projects[0] ? projects[0] : null;
  } catch (error) {
    console.warn('[SSR NOTE] Project detail unavailable:', error.message);
    return null;
  }
}

function projectCards(projects) {
  if (!projects.length) {
    return `
      <div class="col-span-full py-12 text-center text-on-surface-variant">
        Project case studies are being prepared. <a class="text-on-tertiary-container hover:underline" href="/contact">Discuss your project</a>.
      </div>
    `;
  }

  return projects.map((project) => {
    const image = project.thumbnail_url || project.hero_image_url || '/assets/wajidx-logo.png';
    const category = project.category_name || 'Custom Software';
    return `
      <article class="rounded-DEFAULT bg-surface-container-low/70 border border-outline-variant/30 overflow-hidden flex flex-col">
        <a href="/projects/${escapeHtml(project.slug)}" class="block">
          <div class="aspect-video w-full overflow-hidden bg-surface-container-highest">
            <img src="${escapeHtml(image)}" alt="${escapeHtml(project.title)}" class="w-full h-full object-cover object-center" loading="lazy"/>
          </div>
        </a>
        <div class="p-6 flex flex-col gap-3 flex-1">
          <div class="flex items-center justify-between gap-3">
            <span class="font-label-caps text-[10px] text-on-tertiary-container uppercase">${escapeHtml(category)}</span>
            <span class="font-code-sm text-[11px] text-on-surface-variant">${escapeHtml(project.year || '')}</span>
          </div>
          <h3 class="font-headline-md text-xl font-bold text-on-surface">
            <a href="/projects/${escapeHtml(project.slug)}" class="hover:text-on-tertiary-container">${escapeHtml(project.title)}</a>
          </h3>
          <p class="text-on-surface-variant text-sm leading-relaxed">${escapeHtml(project.short_description || '')}</p>
          <a href="/projects/${escapeHtml(project.slug)}" class="mt-auto pt-2 text-on-tertiary-container text-sm font-semibold">Read case study →</a>
        </div>
      </article>
    `;
  }).join('');
}

function staticRouteContent(pathname, settings, projects = []) {
  if (pathname === '/projects') {
    return `
      <section class="max-w-container-max mx-auto px-4 md:px-xl py-12 sm:py-16 animate-fade-in-up" data-ssr-route="projects">
        <header class="mb-12 border-b border-outline-variant/30 pb-8">
          <p class="font-label-caps text-xs text-on-tertiary-container uppercase tracking-widest mb-2">PROJECTS &amp; CASE STUDIES</p>
          <h1 class="font-display-lg text-4xl md:text-5xl font-bold text-on-surface mb-4">Software built around real operational workflows.</h1>
          <p class="font-body-lg text-on-surface-variant max-w-3xl">Explore POS, ERP, AI, automation, and business-system projects. Each case study explains the problem, the engineered approach, and results recorded for that project.</p>
        </header>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">${projectCards(projects)}</div>
      </section>
    `;
  }

  if (pathname === '/about') {
    return `
      <section class="max-w-container-max mx-auto px-4 md:px-xl py-12 sm:py-16" data-ssr-route="about">
        <header class="mb-12 border-b border-outline-variant/30 pb-8">
          <p class="font-label-caps text-xs text-on-tertiary-container uppercase tracking-widest mb-2">ABOUT WAJIDX</p>
          <h1 class="font-display-lg text-4xl md:text-6xl font-bold text-on-surface mb-5">Software engineering for operations-heavy businesses.</h1>
          <p class="font-body-lg text-on-surface-variant max-w-3xl">WAJIDX designs practical systems for restaurants, retail, distribution, and workforce operations—combining product thinking with reliable backend architecture and clear day-to-day workflows.</p>
        </header>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <article class="p-7 rounded-DEFAULT bg-surface-container-low border border-outline-variant/30"><h2 class="font-headline-md text-xl font-bold mb-2">Business-first design</h2><p class="text-sm text-on-surface-variant">Start with bottlenecks, users, controls, and reporting needs before choosing technology.</p></article>
          <article class="p-7 rounded-DEFAULT bg-surface-container-low border border-outline-variant/30"><h2 class="font-headline-md text-xl font-bold mb-2">Operational reliability</h2><p class="text-sm text-on-surface-variant">Design for busy service periods, network interruptions, permissions, auditability, and recoverability.</p></article>
          <article class="p-7 rounded-DEFAULT bg-surface-container-low border border-outline-variant/30"><h2 class="font-headline-md text-xl font-bold mb-2">Direct collaboration</h2><p class="text-sm text-on-surface-variant">Keep decision makers and operators close to the build so software reflects the way the business actually runs.</p></article>
        </div>
      </section>
    `;
  }

  if (pathname === '/services') {
    return `
      <section class="max-w-container-max mx-auto px-4 md:px-xl py-12 sm:py-16" data-ssr-route="services">
        <header class="mb-12 border-b border-outline-variant/30 pb-8">
          <p class="font-label-caps text-xs text-on-tertiary-container uppercase tracking-widest mb-2">SERVICES</p>
          <h1 class="font-display-lg text-4xl md:text-6xl font-bold text-on-surface mb-5">Custom POS, ERP, AI &amp; workflow automation.</h1>
          <p class="font-body-lg text-on-surface-variant max-w-3xl">WAJIDX builds systems that reduce repetitive work, improve operational visibility, and connect transactions, stock, staff, and reporting.</p>
        </header>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <article class="p-7 rounded-DEFAULT bg-surface-container-low border border-outline-variant/30"><h2 class="font-headline-md text-xl font-bold mb-3">Restaurant &amp; Retail POS</h2><p class="text-sm text-on-surface-variant">POS, kitchen display, recipe costing, inventory, purchasing, branch controls, and shift auditing tailored to real service workflows.</p></article>
          <article class="p-7 rounded-DEFAULT bg-surface-container-low border border-outline-variant/30"><h2 class="font-headline-md text-xl font-bold mb-3">ERP &amp; Business Systems</h2><p class="text-sm text-on-surface-variant">Centralize stock, procurement, suppliers, permissions, reconciliations, and management reporting in one operational platform.</p></article>
          <article class="p-7 rounded-DEFAULT bg-surface-container-low border border-outline-variant/30"><h2 class="font-headline-md text-xl font-bold mb-3">AI &amp; Automation</h2><p class="text-sm text-on-surface-variant">Automate attendance, verification, data movement, alerts, approvals, and repetitive back-office workflows while keeping human oversight.</p></article>
        </div>
      </section>
    `;
  }

  if (pathname === '/process') {
    const steps = [
      ['01', 'Discover', 'Map users, bottlenecks, data, risks, and the business outcome the system must support.'],
      ['02', 'Architect', 'Define workflows, permissions, data models, integrations, offline behavior, and deployment constraints.'],
      ['03', 'Build', 'Deliver working increments so operators and decision makers can validate the system early.'],
      ['04', 'Validate', 'Test realistic load, failure modes, security controls, data integrity, and day-to-day usability.'],
      ['05', 'Deploy & improve', 'Roll out with monitoring, backups, onboarding, feedback loops, and a clear roadmap for iteration.']
    ];
    return `
      <section class="max-w-container-max mx-auto px-4 md:px-xl py-12 sm:py-16" data-ssr-route="process">
        <header class="mb-12 border-b border-outline-variant/30 pb-8">
          <p class="font-label-caps text-xs text-on-tertiary-container uppercase tracking-widest mb-2">PROCESS</p>
          <h1 class="font-display-lg text-4xl md:text-6xl font-bold text-on-surface mb-5">A clear path from bottleneck to production system.</h1>
          <p class="font-body-lg text-on-surface-variant max-w-3xl">The process keeps business requirements, technical decisions, validation, and rollout connected so scope and operational reality stay aligned.</p>
        </header>
        <ol class="grid grid-cols-1 md:grid-cols-2 gap-6">
          ${steps.map(([number, title, text]) => `<li class="p-7 rounded-DEFAULT bg-surface-container-low border border-outline-variant/30"><span class="font-code-sm text-on-tertiary-container">${number}</span><h2 class="font-headline-md text-xl font-bold mt-2 mb-2">${title}</h2><p class="text-sm text-on-surface-variant">${text}</p></li>`).join('')}
        </ol>
      </section>
    `;
  }

  if (pathname === '/contact') {
    const email = escapeHtml(settings.contact_email || 'contact@wajidx.com');
    const phone = escapeHtml(settings.contact_phone || '+923351362639');
    const address = escapeHtml(settings.contact_address || 'Karachi, Pakistan');
    return `
      <section class="max-w-container-max mx-auto px-4 md:px-xl py-12 sm:py-16" data-ssr-route="contact">
        <header class="mb-12 border-b border-outline-variant/30 pb-8">
          <p class="font-label-caps text-xs text-on-tertiary-container uppercase tracking-widest mb-2">CONTACT</p>
          <h1 class="font-display-lg text-4xl md:text-6xl font-bold text-on-surface mb-5">Discuss the operational problem you want to solve.</h1>
          <p class="font-body-lg text-on-surface-variant max-w-3xl">Share your current workflow, bottlenecks, users, locations, and what a successful result should look like. WAJIDX can then scope the right system rather than forcing a generic product.</p>
        </header>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="p-7 rounded-DEFAULT bg-surface-container-low border border-outline-variant/30"><h2 class="font-headline-md text-lg font-bold mb-2">Email</h2><a class="text-on-tertiary-container" href="mailto:${email}">${email}</a></div>
          <div class="p-7 rounded-DEFAULT bg-surface-container-low border border-outline-variant/30"><h2 class="font-headline-md text-lg font-bold mb-2">Phone</h2><a class="text-on-tertiary-container" href="tel:${phone}">${phone}</a></div>
          <div class="p-7 rounded-DEFAULT bg-surface-container-low border border-outline-variant/30"><h2 class="font-headline-md text-lg font-bold mb-2">Location</h2><p class="text-on-surface-variant">${address}</p></div>
        </div>
      </section>
    `;
  }

  return '';
}

function projectDetailContent(project) {
  const image = project.hero_image_url || project.thumbnail_url;
  return `
    <article class="max-w-container-max mx-auto px-4 md:px-xl py-12 sm:py-16" data-ssr-route="project-detail">
      <nav class="text-xs font-label-caps text-on-surface-variant mb-8"><a href="/">HOME</a> / <a href="/projects">PROJECTS</a> / <span class="text-on-tertiary-container">${escapeHtml(project.title)}</span></nav>
      <header class="border-b border-outline-variant/30 pb-10 mb-12">
        <p class="font-label-caps text-xs text-on-tertiary-container uppercase tracking-widest mb-3">${escapeHtml(project.category_name || 'Custom Software')}</p>
        <h1 class="font-display-lg text-4xl md:text-6xl font-bold text-on-surface mb-5">${escapeHtml(project.title)}</h1>
        <p class="font-body-lg text-on-surface-variant max-w-3xl">${escapeHtml(project.short_description || '')}</p>
      </header>
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(project.title)}" class="w-full max-h-[620px] object-cover rounded-xl border border-outline-variant/30 mb-12"/>` : ''}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        ${project.problem ? `<section class="p-7 rounded-DEFAULT bg-surface-container-low border border-outline-variant/30"><h2 class="font-headline-md text-2xl font-bold mb-3">The operational problem</h2><p class="text-on-surface-variant leading-relaxed">${escapeHtml(project.problem)}</p></section>` : ''}
        ${project.solution ? `<section class="p-7 rounded-DEFAULT bg-surface-container-low border border-outline-variant/30"><h2 class="font-headline-md text-2xl font-bold mb-3">The engineered approach</h2><p class="text-on-surface-variant leading-relaxed">${escapeHtml(project.solution)}</p></section>` : ''}
        ${project.results ? `<section class="p-7 rounded-DEFAULT bg-surface-container-low border border-outline-variant/30 lg:col-span-2"><h2 class="font-headline-md text-2xl font-bold mb-3">Recorded results</h2><p class="text-on-surface-variant leading-relaxed">${escapeHtml(project.results)}</p></section>` : ''}
      </div>
    </article>
  `;
}

function replaceMain(html, content) {
  const main = /<main id="app-root" class="[^"]*">[\s\S]*?<\/main>/;
  if (!main.test(html)) throw new Error('Unable to locate #app-root in public shell.');
  return html.replace(main, `<main id="app-root" class="flex-grow pt-[72px]">${content}</main>`);
}

function setHeadValue(html, regex, replacement, fallback) {
  if (regex.test(html)) return html.replace(regex, replacement);
  return html.replace('</head>', `${fallback}\n</head>`);
}

function applySeo(html, { title, description, canonical, image, schema, noindex = false }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonical = escapeHtml(canonical);
  const safeImage = escapeHtml(image || '/assets/wajidx-logo.png');

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);
  html = setHeadValue(html, /<meta name="description"[^>]*>/i, `<meta name="description" content="${safeDescription}"/>`, `<meta name="description" content="${safeDescription}"/>`);
  html = setHeadValue(html, /<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${safeCanonical}"/>`, `<link rel="canonical" href="${safeCanonical}"/>`);
  html = setHeadValue(html, /<meta property="og:title"[^>]*>/i, `<meta property="og:title" content="${safeTitle}"/>`, `<meta property="og:title" content="${safeTitle}"/>`);
  html = setHeadValue(html, /<meta property="og:description"[^>]*>/i, `<meta property="og:description" content="${safeDescription}"/>`, `<meta property="og:description" content="${safeDescription}"/>`);
  html = setHeadValue(html, /<meta property="og:image"[^>]*>/i, `<meta property="og:image" content="${safeImage}"/>`, `<meta property="og:image" content="${safeImage}"/>`);
  html = setHeadValue(html, /<meta property="og:url"[^>]*>/i, `<meta property="og:url" content="${safeCanonical}"/>`, `<meta property="og:url" content="${safeCanonical}"/>`);

  const robotsTag = noindex ? '<meta name="robots" content="noindex,nofollow,noarchive"/>' : '<meta name="robots" content="index,follow,max-image-preview:large"/>';
  html = setHeadValue(html, /<meta name="robots"[^>]*>/i, robotsTag, robotsTag);

  html = setHeadValue(html, /<meta name="twitter:card"[^>]*>/i, '<meta name="twitter:card" content="summary_large_image"/>', '<meta name="twitter:card" content="summary_large_image"/>');
  html = setHeadValue(html, /<meta name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${safeTitle}"/>`, `<meta name="twitter:title" content="${safeTitle}"/>`);
  html = setHeadValue(html, /<meta name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${safeDescription}"/>`, `<meta name="twitter:description" content="${safeDescription}"/>`);

  if (schema) {
    const json = JSON.stringify(schema).replace(/</g, '\\u003c');
    const tag = `<script id="jsonld-schema" type="application/ld+json">${json}</script>`;
    if (/<script id="jsonld-schema"[\s\S]*?<\/script>/i.test(html)) {
      html = html.replace(/<script id="jsonld-schema"[\s\S]*?<\/script>/i, tag);
    } else {
      html = html.replace('</head>', `${tag}\n</head>`);
    }
  }

  return html;
}

function metaFor(pathname, settings, siteUrl, project) {
  const canonical = publicUrl(siteUrl, pathname);
  const brand = settings.site_brand_name || 'WAJIDX';
  const baseSchema = [
    {
      '@type': 'Organization',
      '@id': publicUrl(siteUrl, '/') + '#organization',
      name: brand,
      url: publicUrl(siteUrl, '/'),
      logo: publicUrl(siteUrl, '/assets/wajidx-logo.png'),
      description: settings.site_description,
      sameAs: [settings.social_github, settings.social_linkedin, settings.social_twitter].filter(Boolean)
    },
    {
      '@type': 'WebSite',
      '@id': publicUrl(siteUrl, '/') + '#website',
      url: publicUrl(siteUrl, '/'),
      name: brand
    }
  ];

  if (project) {
    baseSchema.push({
      '@type': 'SoftwareApplication',
      name: project.title,
      description: project.short_description,
      applicationCategory: project.category_name || 'BusinessApplication',
      url: canonical,
      author: { '@id': publicUrl(siteUrl, '/') + '#organization' }
    });
    return {
      title: `${project.seo_title || project.title} | ${brand}`,
      description: project.seo_description || project.short_description || settings.site_description,
      canonical,
      image: project.hero_image_url || project.thumbnail_url || publicUrl(siteUrl, '/assets/wajidx-logo.png'),
      schema: { '@context': 'https://schema.org', '@graph': baseSchema }
    };
  }

  const map = {
    '/': {
      title: `Custom POS, ERP & Automation Systems | ${brand}`,
      description: 'WAJIDX builds custom POS, ERP, AI, and workflow automation systems for restaurants, retail, and operations-heavy businesses.'
    },
    '/projects': {
      title: `Software Projects & Case Studies | ${brand}`,
      description: 'Explore WAJIDX POS, ERP, AI, automation, and business software projects with problem, approach, and project result details.'
    },
    '/about': {
      title: `About WAJIDX | Software Engineering Studio`,
      description: 'Learn how WAJIDX approaches operational software, system architecture, reliability, and direct collaboration with business teams.'
    },
    '/services': {
      title: `POS, ERP, AI & Automation Development Services | ${brand}`,
      description: 'Custom restaurant and retail POS, ERP, inventory, workforce AI, integrations, and workflow automation engineered around real operations.'
    },
    '/process': {
      title: `Software Engineering Process | ${brand}`,
      description: 'See the WAJIDX process from operational discovery and architecture through iterative build, validation, deployment, and improvement.'
    },
    '/contact': {
      title: `Contact WAJIDX | Discuss a Software Project`,
      description: 'Discuss a custom POS, ERP, AI, automation, or business software project with WAJIDX.'
    }
  };

  const meta = map[pathname] || map['/'];
  return {
    ...meta,
    canonical,
    image: publicUrl(siteUrl, '/assets/wajidx-logo.png'),
    schema: { '@context': 'https://schema.org', '@graph': baseSchema }
  };
}

async function renderPublicPage({ basePath, siteUrl, pathname }) {
  const shellPath = path.join(basePath, 'public', 'index.html');
  let html = fs.readFileSync(shellPath, 'utf8');
  const settings = await loadSettings();

  if (pathname === '/') {
    const projects = await loadProjects({ featuredOnly: true, limit: 6 });
    const marker = `<div id="home-featured-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div class="col-span-full py-12 text-center text-on-surface-variant">Loading featured projects...</div>
        </div>`;
    if (html.includes(marker)) {
      html = html.replace(marker, `<div id="home-featured-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">${projectCards(projects)}</div>`);
    }
    return { statusCode: 200, html: applySeo(html, metaFor('/', settings, siteUrl)) };
  }

  if (pathname.startsWith('/projects/') && pathname !== '/projects/') {
    let slug = pathname.slice('/projects/'.length).split('/')[0];
    try {
      slug = decodeURIComponent(slug);
    } catch (error) {
      // Keep the raw slug and let the lookup fail safely.
    }
    const project = await loadProjectBySlug(slug);
    if (!project) {
      const canonical = publicUrl(siteUrl, pathname);
      const notFound = `
        <section class="min-h-[65vh] flex items-center justify-center px-4 py-20 text-center">
          <div class="max-w-xl">
            <p class="font-code-sm text-xs text-red-400 mb-3">404 // PROJECT NOT FOUND</p>
            <h1 class="font-display-lg text-4xl font-bold text-on-surface mb-4">Project not found.</h1>
            <p class="text-on-surface-variant mb-6">The requested project is not published or the URL is incorrect.</p>
            <a href="/projects" class="text-on-tertiary-container font-semibold">Browse published projects →</a>
          </div>
        </section>
      `;
      html = replaceMain(html, notFound);
      html = applySeo(html, {
        title: 'Project Not Found | WAJIDX',
        description: 'The requested WAJIDX project could not be found.',
        canonical,
        image: publicUrl(siteUrl, '/assets/wajidx-logo.png'),
        schema: null,
        noindex: true
      });
      return { statusCode: 404, html };
    }

    html = replaceMain(html, projectDetailContent(project));
    return { statusCode: 200, html: applySeo(html, metaFor(pathname, settings, siteUrl, project)) };
  }

  const projects = pathname === '/projects' ? await loadProjects({ limit: 18 }) : [];
  const content = staticRouteContent(pathname, settings, projects);
  if (content) html = replaceMain(html, content);
  return { statusCode: 200, html: applySeo(html, metaFor(pathname, settings, siteUrl)) };
}

module.exports = {
  renderPublicPage,
  escapeHtml
};
