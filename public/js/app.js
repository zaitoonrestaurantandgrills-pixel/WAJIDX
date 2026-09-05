// WAJIDX Public Application Controller & Router

(function () {
  'use strict';

  // Global State
  const state = {
    settings: {},
    categories: [],
    technologies: [],
    featuredProjects: [],
    currentProject: null,
    searchQuery: '',
    selectedCategory: 'all',
    selectedSort: 'featured',
    shaderInstance: null,
    universeCleanup: null,
    devMatrixCleanup: null
  };

  // Helper: Fetch JSON wrapper
  async function apiGet(endpoint) {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err);
      return null;
    }
  }

  // Helper: Escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Helper: Update SEO & JSON-LD
  function updateSEO({ title, description, keywords, ogImage, canonicalUrl, schema }) {
    const brandName = state.settings.site_brand_name || 'WAJIDX';
    const finalTitle = title ? `${title} | ${brandName}` : `${brandName} — ${state.settings.site_tagline || 'Build. Automate. Innovate.'}`;
    const finalDesc = description || state.settings.seo_default_description || state.settings.site_description || '';
    const finalKeywords = keywords || state.settings.seo_default_keywords || '';
    const finalCanonical = canonicalUrl || window.location.href;

    document.title = finalTitle;

    // Standard Meta
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = finalDesc;

    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.name = 'keywords';
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.content = finalKeywords;

    // Canonical
    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.rel = 'canonical';
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.href = finalCanonical;

    // OpenGraph
    const setOgMeta = (prop, val) => {
      let og = document.querySelector(`meta[property="${prop}"]`);
      if (!og) {
        og = document.createElement('meta');
        og.setAttribute('property', prop);
        document.head.appendChild(og);
      }
      og.content = val;
    };

    setOgMeta('og:title', finalTitle);
    setOgMeta('og:description', finalDesc);
    setOgMeta('og:url', finalCanonical);
    setOgMeta('og:type', 'website');
    if (ogImage) setOgMeta('og:image', ogImage);

    // JSON-LD Structured Data
    let scriptSchema = document.getElementById('jsonld-schema');
    if (!scriptSchema) {
      scriptSchema = document.createElement('script');
      scriptSchema.id = 'jsonld-schema';
      scriptSchema.type = 'application/ld+json';
      document.head.appendChild(scriptSchema);
    }

    const defaultOrgSchema = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${window.location.origin}/#organization`,
          'name': brandName,
          'url': window.location.origin,
          'logo': `${window.location.origin}/assets/logo.png`,
          'description': state.settings.site_description,
          'sameAs': [
            state.settings.social_github,
            state.settings.social_linkedin,
            state.settings.social_twitter
          ].filter(Boolean)
        },
        {
          '@type': 'WebSite',
          '@id': `${window.location.origin}/#website`,
          'url': window.location.origin,
          'name': brandName,
          'publisher': { '@id': `${window.location.origin}/#organization` }
        },
        ...(schema ? (Array.isArray(schema) ? schema : [schema]) : [])
      ]
    };

    scriptSchema.textContent = JSON.stringify(defaultOrgSchema, null, 2);
  }

  // Active Link Highlighter
  function updateNavActive(path) {
    document.querySelectorAll('[data-nav-link]').forEach(el => {
      const href = el.getAttribute('href');
      if (href === path || (path.startsWith('/projects') && href === '/projects')) {
        el.classList.add('text-on-tertiary-container', 'font-semibold', 'relative');
        el.classList.remove('text-on-surface-variant');
      } else {
        el.classList.remove('text-on-tertiary-container', 'font-semibold', 'relative');
        el.classList.add('text-on-surface-variant');
      }
    });
  }

  // Client Router
  async function router() {
    const fullPath = window.location.pathname;

    // Check if it's admin path
    if (fullPath.startsWith('/admin')) {
      if (window.initAdminApp) {
        window.initAdminApp();
      }
      return;
    }

    const appContainer = document.getElementById('app-root');
    if (!appContainer) return;

    // Ensure public header & footer are visible
    const siteHeader = document.getElementById('site-header');
    const siteFooter = document.getElementById('site-footer');
    if (siteHeader) siteHeader.style.display = 'block';
    if (siteFooter) siteFooter.style.display = 'block';

    // Auto-close mobile navigation drawer if open
    if (window.closeMobileNav) {
      window.closeMobileNav();
    }

    updateNavActive(fullPath);
    window.scrollTo({ top: 0, behavior: 'instant' });

    if (fullPath === '/' || fullPath === '') {
      await renderHomePage(appContainer);
    } else if (fullPath === '/projects') {
      await renderProjectsPage(appContainer);
    } else if (fullPath.startsWith('/projects/')) {
      const slug = fullPath.replace('/projects/', '').split('/')[0];
      await renderProjectDetailPage(appContainer, slug);
    } else if (fullPath === '/about') {
      renderAboutPage(appContainer);
    } else if (fullPath === '/services') {
      renderServicesPage(appContainer);
    } else if (fullPath === '/process') {
      renderProcessPage(appContainer);
    } else if (fullPath === '/contact') {
      renderContactPage(appContainer);
    } else {
      render404Page(appContainer);
    }

    // Attach internal link interception
    attachLinkInterception(appContainer);
  }

  // Intercept normal anchor clicks for seamless SPA navigation
  function attachLinkInterception(container) {
    const root = container || document;
    root.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href');
      if (
        href.startsWith('/') &&
        !href.startsWith('/api') &&
        !href.startsWith('/uploads') &&
        !link.hasAttribute('target') &&
        !link.hasAttribute('download')
      ) {
        link.onclick = (e) => {
          e.preventDefault();
          if (window.closeMobileNav) window.closeMobileNav();
          if (window.location.pathname !== href) {
            window.history.pushState({}, '', href);
            router();
          }
        };
      }
    });
  }

  // -------------------------------------------------------------
  // HOME PAGE
  // -------------------------------------------------------------
  async function renderHomePage(container) {
    updateSEO({
      title: 'Precision Technology & Software Studio',
      description: 'WAJIDX engineers practical business systems, POS platforms, computer vision AI, and custom software architecture.'
    });

    const alreadyRendered = container.querySelector('#home');
    if (!alreadyRendered) {
      container.innerHTML = `
      <!-- Hero Section (From Stitch Design - Enhanced Mobile Responsiveness) -->
      <section class="relative min-h-[85vh] sm:min-h-[90vh] flex items-center justify-center px-4 md:px-xl py-10 sm:py-16 md:py-24 overflow-hidden" id="home">
        <!-- Abstract background bloom -->
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-on-tertiary-container rounded-full blur-[150px] opacity-[0.04] pointer-events-none"></div>

      <div class="max-w-container-max mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center relative z-10">
        <!-- Left Column: Primary Pitch, Headline & Action Buttons (Appears after Hero Image on mobile, left column on desktop) -->
        <div class="flex flex-col gap-6 sm:gap-8 order-2 lg:order-1">
          <div class="inline-flex items-center gap-2 border border-outline-variant/30 bg-surface-dim/70 backdrop-blur-md px-3.5 py-1.5 rounded-full self-start shadow-sm">
            <span class="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse"></span>
            <span class="font-label-caps text-[11px] sm:text-label-caps text-on-surface-variant">WAJIDX TECHNOLOGY STUDIO</span>
          </div>

          <h1 class="font-display-lg text-3xl sm:text-4xl md:text-5xl lg:text-display-lg text-on-surface leading-[1.15] sm:leading-tight tracking-tight font-bold">
            We Build <span class="text-transparent bg-clip-text bg-gradient-to-r from-on-tertiary-container via-tertiary to-sky-300 drop-shadow-[0_0_20px_rgba(38,116,231,0.35)]">Digital Solutions</span> That Move Businesses Forward.
          </h1>

          <p class="font-body-lg text-sm sm:text-base md:text-lg text-on-surface-variant max-w-xl border-l-2 border-on-tertiary-container pl-4 sm:pl-6 py-1 bg-gradient-to-r from-on-tertiary-container/5 to-transparent leading-relaxed">
            Technology should solve problems, not create them. We engineer robust, scalable systems designed around your operational reality.
          </p>

          <!-- ACTION BUTTONS (WITH HIGH ATTENTION EXPLORE PROJECTS CTA) -->
          <div class="flex flex-col sm:flex-row gap-4 sm:gap-5 pt-2 sm:pt-4 items-stretch sm:items-center">
            <!-- Explore Projects CTA: Attention-Grabbing Glowing Pulse + Light Beam Sweep + Bounce Arrow -->
            <div class="relative group/cta w-full sm:w-auto">
              <div class="absolute -inset-1 bg-gradient-to-r from-on-tertiary-container via-cyan-400 to-tertiary rounded-lg blur-md opacity-70 group-hover/cta:opacity-100 transition duration-500 group-hover/cta:duration-200"></div>
              <a class="relative cta-explore-pulse bg-on-tertiary-container hover:bg-[#1b65d6] text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-DEFAULT font-semibold transition-all duration-300 text-center flex items-center justify-center gap-3 overflow-hidden border border-tertiary/70 shadow-[0_0_25px_rgba(38,116,231,0.6)] group w-full sm:w-auto min-h-[48px]" href="/projects">
                <!-- Radiant Gradient Light Beam Sweep Effect -->
                <span class="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent cta-beam pointer-events-none"></span>
                <span class="relative z-10 tracking-wide font-medium">Explore Projects</span>
                <span class="relative z-10 material-symbols-outlined text-base group-hover:translate-x-1.5 transition-transform duration-300 cta-arrow-bounce">arrow_forward</span>
              </a>
            </div>
            <a class="border border-outline-variant/60 bg-surface-dim/40 backdrop-blur-md text-on-surface px-6 sm:px-8 py-3.5 sm:py-4 rounded-DEFAULT font-semibold hover:border-on-tertiary-container hover:text-on-tertiary-container hover:bg-surface-container/50 transition-all duration-300 text-center w-full sm:w-auto min-h-[48px] flex items-center justify-center" href="/contact">
              Start a Conversation
            </a>
          </div>

          <div class="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 mt-4 sm:mt-8 pt-6 sm:pt-8 border-t border-outline-variant/30">
            <div class="flex flex-col gap-1">
              <span class="font-label-caps text-[10px] sm:text-label-caps text-on-surface-variant">EXPERTISE</span>
              <span class="font-code-sm text-xs sm:text-code-sm text-on-surface font-mono font-semibold">ERP &amp; POS Systems</span>
            </div>
            <div class="hidden sm:block w-px h-8 bg-outline-variant/30"></div>
            <div class="flex flex-col gap-1">
              <span class="font-label-caps text-[10px] sm:text-label-caps text-on-surface-variant">FOCUS</span>
              <span class="font-code-sm text-xs sm:text-code-sm text-on-surface font-mono font-semibold">Enterprise Automation</span>
            </div>
          </div>
        </div>

        <!-- Right Column: Founder Portrait Hero Card (Appears FIRST and PROMINENTLY on mobile, right on desktop) -->
        <div class="order-1 lg:order-2 flex justify-center lg:justify-end relative group overflow-visible w-full">
          <div class="absolute inset-0 bg-on-tertiary-container/10 blur-[80px] rounded-2xl group-hover:bg-on-tertiary-container/20 transition-all duration-700 pointer-events-none"></div>
          <div class="relative w-full max-w-[310px] sm:max-w-[360px] lg:max-w-[440px] rounded-xl border border-outline-variant/30 bg-surface-dim/80 backdrop-blur-md overflow-visible p-2.5 sm:p-3 shadow-2xl transition-all duration-500 hover:border-on-tertiary-container/50 mx-auto lg:mr-0">
            <div class="relative w-full aspect-[4/5] rounded-lg overflow-hidden border border-outline-variant/20 bg-surface-container-lowest z-10">
              <img alt="Wajid - Founder &amp; Lead Systems Architect" class="w-full h-full object-cover object-top filter contrast-[1.03] transition-transform duration-700 group-hover:scale-[1.02]" src="/assets/wajid-hero.jpg?v=2.4.2"/>
              <div class="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent pointer-events-none"></div>
              <div class="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-lowest/85 backdrop-blur-md border border-outline-variant/30 text-code-sm text-on-surface-variant">
                <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span class="text-[10px] sm:text-[11px] font-medium tracking-wide">Available for Advisory</span>
              </div>
              <div class="absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-3 sm:left-3 sm:right-3 p-3 sm:p-3.5 rounded-lg bg-surface-dim/95 backdrop-blur-md border border-outline-variant/30 flex items-center justify-between gap-2.5 sm:gap-3">
                <div class="min-w-0 flex-1">
                  <div class="text-on-surface font-headline-md font-semibold text-[15px] sm:text-[17px] leading-tight flex items-center gap-1.5 sm:gap-2 truncate">
                    <span>Wajid</span>
                    <span class="material-symbols-outlined text-on-tertiary-container text-[15px] sm:text-[16px] flex-shrink-0">verified</span>
                  </div>
                  <p class="font-code-sm text-[11px] sm:text-[12px] text-on-surface-variant mt-0.5 font-mono truncate">Founder &amp; Lead Systems Architect</p>
                </div>
                <div class="w-8 h-8 rounded bg-on-tertiary-container/10 border border-on-tertiary-container/20 flex items-center justify-center text-on-tertiary-container font-code-sm font-bold text-xs flex-shrink-0">
                  WX
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Interactive Scroll Indicator with animated dot and scroll response -->
      <div class="flex flex-col items-center justify-center pt-10 sm:pt-16 pb-4 opacity-75 hover:opacity-100 transition-opacity" id="scroll-prompt">
        <a class="flex flex-col items-center gap-2 text-on-surface-variant hover:text-on-tertiary-container group transition-colors" href="/projects">
          <span class="font-label-caps text-[10px] tracking-widest uppercase">Scroll to explore</span>
          <div class="w-5 h-8 rounded-full border border-outline-variant/60 flex items-start justify-center p-1 group-hover:border-on-tertiary-container transition-colors">
            <div class="w-1.5 h-2 bg-on-tertiary-container rounded-full animate-scroll-dot"></div>
          </div>
          <span class="material-symbols-outlined text-xs text-outline group-hover:text-on-tertiary-container group-hover:translate-y-0.5 transition-all">expand_more</span>
        </a>
      </div></section>

      <!-- Featured Projects Section -->
      <section class="py-24 px-4 md:px-xl border-t border-outline-variant/20 relative z-10 bg-surface-container-lowest/40">
        <div class="max-w-container-max mx-auto">
          <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-16">
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="w-1.5 h-1.5 rounded-full bg-on-tertiary-container"></span>
                <span class="font-label-caps text-label-caps text-on-tertiary-container tracking-widest uppercase">ENGINEERING PORTFOLIO</span>
              </div>
              <h2 class="font-display-lg text-3xl md:text-4xl text-on-surface font-bold">Featured Projects</h2>
            </div>
            <a href="/projects" class="text-on-surface-variant hover:text-on-tertiary-container font-semibold transition-colors flex items-center gap-2 group">
              View All Projects
              <span class="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </a>
          </div>

          <div id="home-featured-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div class="col-span-full py-12 text-center text-on-surface-variant">Loading featured projects...</div>
          </div>
        </div>
      </section>

      <!-- Services & Capabilities Overview -->
      <section class="py-24 px-4 md:px-xl border-t border-outline-variant/20 relative z-10">
        <div class="max-w-container-max mx-auto">
          <div class="max-w-2xl mb-16">
            <div class="flex items-center gap-2 mb-2">
              <span class="w-1.5 h-1.5 rounded-full bg-on-tertiary-container"></span>
              <span class="font-label-caps text-label-caps text-on-tertiary-container tracking-widest uppercase">CAPABILITIES</span>
            </div>
            <h2 class="font-display-lg text-3xl md:text-4xl text-on-surface font-bold mb-4">Engineered for Reliability</h2>
            <p class="font-body-lg text-on-surface-variant">We bridge complex operational challenges with precise software architecture. Every solution is custom-fitted to operational realities.</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <!-- Card 1 -->
            <div class="p-8 rounded-DEFAULT bg-surface-container-low/60 border border-outline-variant/30 glow-card flex flex-col justify-between">
              <div>
                <div class="w-12 h-12 rounded-DEFAULT bg-on-tertiary-container/10 border border-on-tertiary-container/20 flex items-center justify-center text-on-tertiary-container mb-6">
                  <span class="material-symbols-outlined text-2xl">point_of_sale</span>
                </div>
                <h3 class="font-headline-md text-xl font-bold text-on-surface mb-3">POS & Business ERP Systems</h3>
                <p class="text-on-surface-variant text-sm leading-relaxed mb-6">
                  High-speed transactional terminals, real-time Kitchen Display Systems, ingredient gram-level recipe costing, and strict shift audits.
                </p>
              </div>
              <span class="font-code-sm text-xs text-on-tertiary-container">01 // TRANSACTION ENGINES</span>
            </div>

            <!-- Card 2 -->
            <div class="p-8 rounded-DEFAULT bg-surface-container-low/60 border border-outline-variant/30 glow-card flex flex-col justify-between">
              <div>
                <div class="w-12 h-12 rounded-DEFAULT bg-on-tertiary-container/10 border border-on-tertiary-container/20 flex items-center justify-center text-on-tertiary-container mb-6">
                  <span class="material-symbols-outlined text-2xl">smart_toy</span>
                </div>
                <h3 class="font-headline-md text-xl font-bold text-on-surface mb-3">AI & Computer Vision</h3>
                <p class="text-on-surface-variant text-sm leading-relaxed mb-6">
                  Edge biometric attendance, anti-spoofing neural embeddings, real-time object tracking, and automated workforce intelligence pipelines.
                </p>
              </div>
              <span class="font-code-sm text-xs text-on-tertiary-container">02 // EDGE INFERENCE</span>
            </div>

            <!-- Card 3 -->
            <div class="p-8 rounded-DEFAULT bg-surface-container-low/60 border border-outline-variant/30 glow-card flex flex-col justify-between">
              <div>
                <div class="w-12 h-12 rounded-DEFAULT bg-on-tertiary-container/10 border border-on-tertiary-container/20 flex items-center justify-center text-on-tertiary-container mb-6">
                  <span class="material-symbols-outlined text-2xl">precision_manufacturing</span>
                </div>
                <h3 class="font-headline-md text-xl font-bold text-on-surface mb-3">Workflow Automation</h3>
                <p class="text-on-surface-variant text-sm leading-relaxed mb-6">
                  Eliminate repetitive human error through robust event-driven microservices, supplier price indexers, and automated ledger sync.
                </p>
              </div>
              <span class="font-code-sm text-xs text-on-tertiary-container">03 // AUTOMATION PIPELINES</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Conversion CTA Section -->
      <section class="py-24 px-4 md:px-xl border-t border-outline-variant/20 relative z-10 bg-surface-container-lowest/60">
        <div class="max-w-container-max mx-auto p-10 md:p-16 rounded-xl border border-on-tertiary-container/30 bg-gradient-to-b from-surface-container-low to-surface-container-lowest relative overflow-hidden text-center flex flex-col items-center">
          <div class="absolute inset-0 bg-on-tertiary-container/5 pointer-events-none"></div>
          <span class="font-label-caps text-label-caps text-on-tertiary-container tracking-widest uppercase mb-4">START A PROJECT</span>
          <h2 class="font-display-lg text-3xl md:text-5xl font-bold text-on-surface max-w-2xl mb-6">
            Ready to engineer your next operational advantage?
          </h2>
          <p class="font-body-lg text-on-surface-variant max-w-xl mb-8">
            Tell us about your operational bottlenecks or technology vision. We design and deliver production-ready software.
          </p>
          <a href="/contact" class="bg-on-tertiary-container text-white px-10 py-4 rounded-DEFAULT font-semibold hover:bg-opacity-90 transition-all duration-300 hover:shadow-[0_0_30px_rgba(38,116,231,0.4)] flex items-center gap-2">
            Let's Talk
            <span class="material-symbols-outlined">arrow_forward</span>
          </a>
        </div>
      </section>
    `;
    }

    // Initialize High-Tech Developer Environment (From Stitch Design: Animated Scroll Stitching)
    if (window.initDeveloperEnvironment) {
      if (state.devMatrixCleanup) state.devMatrixCleanup();
      state.devMatrixCleanup = window.initDeveloperEnvironment();
    }

    // Initialize Full-Page 3D Web & Dev Universe (From Stitch Design)
    if (window.initUniverse3D) {
      if (state.universeCleanup) state.universeCleanup();
      state.universeCleanup = window.initUniverse3D('threejs-universe-container');
    }

    // Load Featured Projects
    loadFeaturedProjects();
  }

  async function loadFeaturedProjects() {
    const grid = document.getElementById('home-featured-grid');
    if (!grid) return;

    const data = await apiGet('/api/projects/featured');
    if (!data || !data.projects || data.projects.length === 0) {
      grid.innerHTML = `<div class="col-span-full py-12 text-center text-on-surface-variant">No featured projects available at the moment.</div>`;
      return;
    }

    grid.innerHTML = data.projects.map(proj => renderProjectCard(proj)).join('');
  }

  // -------------------------------------------------------------
  // PROJECTS DIRECTORY PAGE
  // -------------------------------------------------------------
  async function renderProjectsPage(container) {
    updateSEO({
      title: 'Projects & Case Studies',
      description: 'Explore the complete portfolio of systems, POS engines, AI platforms, and web applications engineered by WAJIDX.'
    });

    container.innerHTML = `
      <section class="py-16 px-4 md:px-xl max-w-container-max mx-auto w-full animate-fade-in-up">
        <!-- Header -->
        <div class="mb-12 border-b border-outline-variant/30 pb-8">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-1.5 h-1.5 rounded-full bg-on-tertiary-container"></span>
            <span class="font-label-caps text-label-caps text-on-tertiary-container uppercase tracking-widest">SYSTEM SHOWCASE</span>
          </div>
          <h1 class="font-display-lg text-4xl md:text-5xl font-bold text-on-surface mb-4">Engineering Portfolio</h1>
          <p class="font-body-lg text-on-surface-variant max-w-2xl">
            Explore our deployed applications, enterprise architectures, and automation case studies. Every project represents tailored engineering.
          </p>
        </div>

        <!-- Filter & Search Controls -->
        <div class="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 mb-10 pb-6 border-b border-outline-variant/20">
          <!-- Search Bar -->
          <div class="relative flex-1 max-w-md">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">search</span>
            <input 
              type="text" 
              id="project-search-input" 
              placeholder="Search projects, technologies, features..." 
              value="${escapeHtml(state.searchQuery)}"
              class="w-full bg-surface-container-low border border-outline-variant/40 rounded-DEFAULT pl-10 pr-4 py-2.5 text-on-surface focus:border-on-tertiary-container focus:outline-none text-sm transition-colors"
            />
          </div>

          <!-- Category Pills -->
          <div class="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-none" id="category-pills-container">
            <button 
              data-cat="all" 
              class="category-pill whitespace-nowrap px-4 py-2 rounded-DEFAULT font-label-caps text-xs font-medium transition-all ${state.selectedCategory === 'all' ? 'bg-on-tertiary-container text-white shadow-[0_0_15px_rgba(38,116,231,0.3)]' : 'bg-surface-container-low border border-outline-variant/30 text-on-surface-variant hover:text-on-surface'}"
            >
              ALL
            </button>
            ${state.categories.map(cat => `
              <button 
                data-cat="${escapeHtml(cat.slug)}" 
                class="category-pill whitespace-nowrap px-4 py-2 rounded-DEFAULT font-label-caps text-xs font-medium transition-all ${state.selectedCategory === cat.slug ? 'bg-on-tertiary-container text-white shadow-[0_0_15px_rgba(38,116,231,0.3)]' : 'bg-surface-container-low border border-outline-variant/30 text-on-surface-variant hover:text-on-surface'}"
              >
                ${escapeHtml(cat.name.toUpperCase())}
              </button>
            `).join('')}
          </div>

          <!-- Sort Dropdown -->
          <div class="flex items-center gap-2">
            <span class="font-label-caps text-xs text-on-surface-variant whitespace-nowrap">SORT:</span>
            <select 
              id="project-sort-select" 
              class="bg-surface-container-low border border-outline-variant/40 text-on-surface text-xs rounded-DEFAULT px-3 py-2 focus:border-on-tertiary-container focus:outline-none cursor-pointer"
            >
              <option value="featured" ${state.selectedSort === 'featured' ? 'selected' : ''}>Featured First</option>
              <option value="newest" ${state.selectedSort === 'newest' ? 'selected' : ''}>Newest First</option>
              <option value="oldest" ${state.selectedSort === 'oldest' ? 'selected' : ''}>Oldest First</option>
              <option value="order" ${state.selectedSort === 'order' ? 'selected' : ''}>Default Order</option>
            </select>
          </div>
        </div>

        <!-- Project Grid -->
        <div id="projects-directory-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div class="col-span-full py-16 text-center text-on-surface-variant">Loading projects...</div>
        </div>
      </section>
    `;

    // Bind Search Input
    const searchInput = document.getElementById('project-search-input');
    if (searchInput) {
      let debounceTimer;
      searchInput.oninput = (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          state.searchQuery = e.target.value;
          fetchAndRenderProjects();
        }, 300);
      };
    }

    // Bind Category Pills
    document.querySelectorAll('.category-pill').forEach(btn => {
      btn.onclick = () => {
        state.selectedCategory = btn.getAttribute('data-cat');
        document.querySelectorAll('.category-pill').forEach(b => {
          b.classList.remove('bg-on-tertiary-container', 'text-white', 'shadow-[0_0_15px_rgba(38,116,231,0.3)]');
          b.classList.add('bg-surface-container-low', 'border', 'border-outline-variant/30', 'text-on-surface-variant');
        });
        btn.classList.add('bg-on-tertiary-container', 'text-white', 'shadow-[0_0_15px_rgba(38,116,231,0.3)]');
        btn.classList.remove('bg-surface-container-low', 'border', 'text-on-surface-variant');
        fetchAndRenderProjects();
      };
    });

    // Bind Sort Select
    const sortSelect = document.getElementById('project-sort-select');
    if (sortSelect) {
      sortSelect.onchange = (e) => {
        state.selectedSort = e.target.value;
        fetchAndRenderProjects();
      };
    }

    // Initial Load
    fetchAndRenderProjects();
  }

  async function fetchAndRenderProjects() {
    const grid = document.getElementById('projects-directory-grid');
    if (!grid) return;

    let url = `/api/projects?sort=${state.selectedSort}`;
    if (state.searchQuery) url += `&search=${encodeURIComponent(state.searchQuery)}`;
    if (state.selectedCategory && state.selectedCategory !== 'all') url += `&category=${encodeURIComponent(state.selectedCategory)}`;

    grid.innerHTML = `<div class="col-span-full py-16 text-center text-on-surface-variant flex flex-col items-center gap-3">
      <div class="w-6 h-6 border-2 border-on-tertiary-container border-t-transparent rounded-full animate-spin"></div>
      <span class="font-code-sm text-xs text-on-surface-variant">QUERYING DEV DATABASE...</span>
    </div>`;

    const res = await apiGet(url);
    if (!res || !res.projects || res.projects.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-20 text-center text-on-surface-variant flex flex-col items-center gap-4 bg-surface-container-low/30 border border-outline-variant/20 rounded-DEFAULT p-8">
          <span class="material-symbols-outlined text-4xl text-on-tertiary-container">inventory_2</span>
          <h3 class="font-headline-md text-lg font-bold text-on-surface">No Projects Match Your Search</h3>
          <p class="text-sm text-on-surface-variant max-w-md">Try searching for other keywords, selecting a different category, or resetting your filters.</p>
          <button id="reset-filters-btn" class="px-5 py-2 rounded-DEFAULT bg-on-tertiary-container/10 border border-on-tertiary-container/30 text-on-tertiary-container hover:bg-on-tertiary-container hover:text-white transition-all text-xs font-semibold">
            Reset Filters
          </button>
        </div>
      `;
      const resetBtn = document.getElementById('reset-filters-btn');
      if (resetBtn) {
        resetBtn.onclick = () => {
          state.searchQuery = '';
          state.selectedCategory = 'all';
          state.selectedSort = 'featured';
          const searchInput = document.getElementById('project-search-input');
          if (searchInput) searchInput.value = '';
          document.querySelectorAll('.category-pill').forEach(b => {
            if (b.getAttribute('data-cat') === 'all') {
              b.classList.add('bg-on-tertiary-container', 'text-white');
            } else {
              b.classList.remove('bg-on-tertiary-container', 'text-white');
            }
          });
          fetchAndRenderProjects();
        };
      }
      return;
    }

    grid.innerHTML = res.projects.map(proj => renderProjectCard(proj)).join('');
    attachLinkInterception(grid);
  }

  // Render a Single Project Card
  function renderProjectCard(proj) {
    const thumb = proj.thumbnail_url || 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80';
    const catName = proj.category_name || 'System Engineering';
    const year = proj.year || '2024';
    const techs = Array.isArray(proj.technologies) ? proj.technologies : [];

    return `
      <article class="group rounded-DEFAULT bg-surface-container-low/70 border border-outline-variant/30 overflow-hidden flex flex-col justify-between glow-card transition-all duration-300">
        <div>
          <!-- Thumbnail Header with Overlay -->
          <div class="relative aspect-video w-full overflow-hidden bg-surface-container-highest">
            <img 
              src="${escapeHtml(thumb)}" 
              alt="${escapeHtml(proj.title)}" 
              class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100"
              loading="lazy"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-transparent to-transparent opacity-80"></div>
            
            <!-- Category & Year Badge -->
            <div class="absolute top-3 left-3 flex items-center gap-2">
              <span class="font-label-caps text-[10px] bg-surface-container-lowest/90 backdrop-blur-md text-on-tertiary-container border border-on-tertiary-container/30 px-2 py-0.5 rounded-DEFAULT">
                ${escapeHtml(catName.toUpperCase())}
              </span>
              ${proj.is_featured ? `
                <span class="font-label-caps text-[10px] bg-on-tertiary-container text-white px-2 py-0.5 rounded-DEFAULT flex items-center gap-1 shadow-sm">
                  <span class="material-symbols-outlined text-[12px]">star</span> FEATURED
                </span>
              ` : ''}
            </div>

            <div class="absolute top-3 right-3 font-code-sm text-[11px] text-on-surface-variant bg-surface-container-lowest/80 px-2 py-0.5 rounded">
              ${escapeHtml(year)}
            </div>
          </div>

          <!-- Content Body -->
          <div class="p-6 flex flex-col gap-3">
            <h3 class="font-headline-md text-xl font-bold text-on-surface group-hover:text-on-tertiary-container transition-colors">
              <a href="/projects/${escapeHtml(proj.slug)}">
                ${escapeHtml(proj.title)}
              </a>
            </h3>

            <p class="text-on-surface-variant text-sm leading-relaxed line-clamp-2 font-body-md">
              ${escapeHtml(proj.short_description)}
            </p>

            <!-- Tech Pills -->
            <div class="flex flex-wrap gap-1.5 pt-2">
              ${techs.slice(0, 4).map(t => `
                <span class="tech-badge px-2 py-0.5 rounded bg-surface-container-highest/80 border border-outline-variant/30 text-on-surface-variant text-[11px]">
                  ${escapeHtml(t.name || t)}
                </span>
              `).join('')}
              ${techs.length > 4 ? `
                <span class="tech-badge px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant text-[11px]">
                  +${techs.length - 4}
                </span>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Card Footer Actions -->
        <div class="px-6 py-4 border-t border-outline-variant/20 bg-surface-container-low flex items-center justify-between">
          <a href="/projects/${escapeHtml(proj.slug)}" class="font-body-md text-xs font-semibold text-on-tertiary-container hover:underline flex items-center gap-1">
            Read Case Study
            <span class="material-symbols-outlined text-sm">arrow_forward</span>
          </a>

          <div class="flex items-center gap-2">
            ${proj.live_url ? `
              <a href="${escapeHtml(proj.live_url)}" target="_blank" rel="noopener noreferrer" title="Visit Live" class="p-1.5 rounded hover:bg-on-tertiary-container/10 text-on-surface-variant hover:text-on-tertiary-container transition-colors">
                <span class="material-symbols-outlined text-lg">open_in_new</span>
              </a>
            ` : ''}
            ${proj.github_url ? `
              <a href="${escapeHtml(proj.github_url)}" target="_blank" rel="noopener noreferrer" title="View Source" class="p-1.5 rounded hover:bg-on-tertiary-container/10 text-on-surface-variant hover:text-on-tertiary-container transition-colors">
                <span class="material-symbols-outlined text-lg">code</span>
              </a>
            ` : ''}
          </div>
        </div>
      </article>
    `;
  }

  // -------------------------------------------------------------
  // PROJECT DETAIL PAGE
  // -------------------------------------------------------------
  async function renderProjectDetailPage(container, slug) {
    container.innerHTML = `
      <div class="py-20 text-center text-on-surface-variant flex flex-col items-center gap-3">
        <div class="w-8 h-8 border-2 border-on-tertiary-container border-t-transparent rounded-full animate-spin"></div>
        <span class="font-code-sm text-xs">LOADING PROJECT ARCHITECTURE...</span>
      </div>
    `;

    const res = await apiGet(`/api/projects/${encodeURIComponent(slug)}`);
    if (!res || !res.project) {
      render404Page(container, 'Project Not Found');
      return;
    }

    const proj = res.project;
    const catName = proj.category_name || 'System Engineering';
    const year = proj.year || '2024';
    const techs = Array.isArray(proj.technologies) ? proj.technologies : [];
    const features = Array.isArray(proj.features) ? proj.features : [];
    const images = Array.isArray(proj.images) ? proj.images : [];
    const related = Array.isArray(proj.related) ? proj.related : [];

    // SEO structured data
    updateSEO({
      title: proj.seo_title || proj.title,
      description: proj.seo_description || proj.short_description,
      keywords: proj.seo_keywords,
      ogImage: proj.hero_image_url || proj.thumbnail_url,
      schema: {
        '@type': 'SoftwareApplication',
        'name': proj.title,
        'description': proj.short_description,
        'applicationCategory': catName,
        'operatingSystem': 'Web, Cloud, Linux',
        'url': window.location.href,
        'author': { '@id': `${window.location.origin}/#organization` }
      }
    });

    container.innerHTML = `
      <article class="max-w-container-max mx-auto px-4 md:px-xl py-12 animate-fade-in-up">
        <!-- Breadcrumbs -->
        <nav class="flex items-center gap-2 text-xs font-label-caps text-on-surface-variant mb-8">
          <a href="/" class="hover:text-on-surface">HOME</a>
          <span>/</span>
          <a href="/projects" class="hover:text-on-surface">PROJECTS</a>
          <span>/</span>
          <span class="text-on-tertiary-container">${escapeHtml(proj.title.toUpperCase())}</span>
        </nav>

        <!-- Project Hero Header -->
        <header class="flex flex-col gap-6 border-b border-outline-variant/30 pb-10 mb-12">
          <div class="flex flex-wrap items-center gap-3">
            <span class="font-label-caps text-xs bg-on-tertiary-container/10 text-on-tertiary-container px-3 py-1 border border-on-tertiary-container/30 rounded-DEFAULT">
              ${escapeHtml(catName.toUpperCase())}
            </span>
            <span class="font-label-caps text-xs text-on-surface-variant border border-outline-variant/30 px-3 py-1 rounded-DEFAULT">
              YEAR // ${escapeHtml(year)}
            </span>
            ${proj.client_type ? `
              <span class="font-label-caps text-xs text-on-surface-variant border border-outline-variant/30 px-3 py-1 rounded-DEFAULT">
                TYPE // ${escapeHtml(proj.client_type)}
              </span>
            ` : ''}
          </div>

          <h1 class="font-display-lg text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-on-surface font-bold tracking-tight">
            ${escapeHtml(proj.title)}
          </h1>

          <p class="font-body-lg text-base sm:text-lg md:text-xl text-on-surface-variant max-w-3xl leading-relaxed">
            ${escapeHtml(proj.short_description)}
          </p>

          <!-- Action Buttons (Rendered only when valid URLs exist) -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-4">
            ${proj.live_url ? `
              <a href="${escapeHtml(proj.live_url)}" target="_blank" rel="noopener noreferrer" class="bg-on-tertiary-container text-white px-6 py-3.5 rounded-DEFAULT font-semibold hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(38,116,231,0.3)] glow-button w-full sm:w-auto text-center">
                Visit Live Project
                <span class="material-symbols-outlined text-lg">open_in_new</span>
              </a>
            ` : ''}

            ${proj.github_url ? `
              <a href="${escapeHtml(proj.github_url)}" target="_blank" rel="noopener noreferrer" class="border border-outline-variant bg-surface-container-low text-on-surface px-6 py-3.5 rounded-DEFAULT font-semibold hover:border-on-tertiary-container hover:text-on-tertiary-container transition-all flex items-center justify-center gap-2 w-full sm:w-auto text-center">
                <span class="material-symbols-outlined text-lg">code</span>
                View Source
              </a>
            ` : ''}

            ${proj.docs_url ? `
              <a href="${escapeHtml(proj.docs_url)}" target="_blank" rel="noopener noreferrer" class="border border-outline-variant/60 text-on-surface-variant px-5 py-3.5 rounded-DEFAULT font-medium hover:text-on-surface transition-all flex items-center justify-center gap-2 text-sm w-full sm:w-auto text-center">
                <span class="material-symbols-outlined text-lg">menu_book</span>
                Documentation
              </a>
            ` : ''}
          </div>

          <!-- Technologies Badges -->
          <div class="flex flex-wrap items-center gap-2 pt-4">
            <span class="font-label-caps text-xs text-on-surface-variant mr-2">TECH STACK:</span>
            ${techs.map(t => `
              <span class="tech-badge px-3 py-1 rounded bg-surface-container-high border border-outline-variant/40 text-on-surface text-xs flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full" style="background-color: ${escapeHtml(t.color || '#2674e7')}"></span>
                ${escapeHtml(t.name)}
              </span>
            `).join('')}
          </div>
        </header>

        <!-- Hero Preview Image -->
        ${proj.hero_image_url || proj.thumbnail_url ? `
          <div class="mb-16 rounded-xl overflow-hidden border border-outline-variant/30 bg-surface-container-highest shadow-2xl">
            <img 
              src="${escapeHtml(proj.hero_image_url || proj.thumbnail_url)}" 
              alt="${escapeHtml(proj.title)}" 
              class="w-full h-auto max-h-[600px] object-cover object-top"
            />
          </div>
        ` : ''}

        <!-- Overview & Deep Dive -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16">
          <div class="lg:col-span-8 flex flex-col gap-10">
            <!-- Full Description / Overview -->
            ${proj.full_description ? `
              <section>
                <h2 class="font-headline-md text-2xl font-bold text-on-surface mb-4">Architectural Overview</h2>
                <div class="prose prose-invert text-on-surface-variant leading-relaxed text-base">
                  ${escapeHtml(proj.full_description).replace(/\n/g, '<br>')}
                </div>
              </section>
            ` : ''}

            <!-- Problem Statement -->
            ${proj.problem ? `
              <section class="p-8 rounded-DEFAULT bg-red-950/15 border border-red-500/20">
                <div class="flex items-center gap-2 text-red-400 font-label-caps text-xs tracking-widest uppercase mb-3">
                  <span class="material-symbols-outlined text-lg">warning</span>
                  THE PROBLEM &amp; OPERATIONAL BOTTLENECKS
                </div>
                <p class="text-on-surface-variant text-base leading-relaxed">
                  ${escapeHtml(proj.problem)}
                </p>
              </section>
            ` : ''}

            <!-- Engineered Solution -->
            ${proj.solution ? `
              <section class="p-8 rounded-DEFAULT bg-on-tertiary-container/10 border border-on-tertiary-container/30">
                <div class="flex items-center gap-2 text-on-tertiary-container font-label-caps text-xs tracking-widest uppercase mb-3">
                  <span class="material-symbols-outlined text-lg">psychology</span>
                  THE ENGINEERED SOLUTION
                </div>
                <p class="text-on-surface-variant text-base leading-relaxed">
                  ${escapeHtml(proj.solution)}
                </p>
              </section>
            ` : ''}

            <!-- Key Features Grid -->
            ${features.length > 0 ? `
              <section>
                <h2 class="font-headline-md text-2xl font-bold text-on-surface mb-6">Key Engineering Features</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  ${features.map(f => `
                    <div class="p-5 rounded-DEFAULT bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2 glow-card">
                      <div class="flex items-center gap-2 text-on-tertiary-container">
                        <span class="material-symbols-outlined text-xl">${escapeHtml(f.icon || 'check_circle')}</span>
                        <h3 class="font-headline-md text-base font-bold text-on-surface">${escapeHtml(f.title)}</h3>
                      </div>
                      ${f.description ? `
                        <p class="text-on-surface-variant text-sm leading-relaxed">${escapeHtml(f.description)}</p>
                      ` : ''}
                    </div>
                  `).join('')}
                </div>
              </section>
            ` : ''}

            <!-- Workflow Lifecycle -->
            ${proj.workflow ? `
              <section>
                <h2 class="font-headline-md text-2xl font-bold text-on-surface mb-4">Operational Workflow</h2>
                <div class="p-6 rounded-DEFAULT bg-surface-container-lowest border border-outline-variant/30 font-code-sm text-sm text-on-surface-variant leading-relaxed overflow-x-auto">
                  ${escapeHtml(proj.workflow).replace(/->/g, '<span class="text-on-tertiary-container font-bold"> &rarr; </span>')}
                </div>
              </section>
            ` : ''}

            <!-- Results & Impact -->
            ${proj.results ? `
              <section class="p-8 rounded-DEFAULT bg-green-950/15 border border-green-500/20">
                <div class="flex items-center gap-2 text-green-400 font-label-caps text-xs tracking-widest uppercase mb-3">
                  <span class="material-symbols-outlined text-lg">trending_up</span>
                  MEASURED RESULTS &amp; IMPACT
                </div>
                <p class="text-on-surface-variant text-base leading-relaxed">
                  ${escapeHtml(proj.results)}
                </p>
              </section>
            ` : ''}
          </div>

          <!-- Right Sticky Summary Sidebar -->
          <div class="lg:col-span-4">
            <div class="sticky top-28 p-6 rounded-DEFAULT bg-surface-container-low/80 border border-outline-variant/30 flex flex-col gap-6">
              <span class="font-label-caps text-xs text-on-surface-variant border-b border-outline-variant/30 pb-3 block uppercase">
                PROJECT SPECIFICATION
              </span>

              <div class="flex flex-col gap-1">
                <span class="text-xs text-on-surface-variant font-label-caps">CLIENT DOMAIN</span>
                <span class="text-sm font-semibold text-on-surface">${escapeHtml(proj.client_type || 'Enterprise Custom')}</span>
              </div>

              <div class="flex flex-col gap-1">
                <span class="text-xs text-on-surface-variant font-label-caps">PRIMARY CATEGORY</span>
                <span class="text-sm font-semibold text-on-surface">${escapeHtml(catName)}</span>
              </div>

              <div class="flex flex-col gap-1">
                <span class="text-xs text-on-surface-variant font-label-caps">STATUS</span>
                <span class="text-sm font-semibold text-green-400 flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-green-500"></span> Production Deployed
                </span>
              </div>

              <div class="border-t border-outline-variant/30 pt-4 flex flex-col gap-3">
                <span class="text-xs text-on-surface-variant font-label-caps">PROJECT LINKS</span>
                ${proj.live_url ? `
                  <a href="${escapeHtml(proj.live_url)}" target="_blank" rel="noopener noreferrer" class="text-xs text-on-tertiary-container hover:underline flex items-center justify-between">
                    <span>Live Deployment</span>
                    <span class="material-symbols-outlined text-sm">open_in_new</span>
                  </a>
                ` : '<span class="text-xs text-on-surface-variant">Live demo not public</span>'}

                ${proj.github_url ? `
                  <a href="${escapeHtml(proj.github_url)}" target="_blank" rel="noopener noreferrer" class="text-xs text-on-tertiary-container hover:underline flex items-center justify-between">
                    <span>Repository Code</span>
                    <span class="material-symbols-outlined text-sm">code</span>
                  </a>
                ` : ''}
              </div>

              <div class="pt-4 border-t border-outline-variant/30">
                <a href="/contact" class="w-full bg-on-tertiary-container text-white py-3 rounded-DEFAULT text-center font-semibold text-sm hover:bg-opacity-90 transition-all block">
                  Inquire About Similar Build
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Screenshots Gallery -->
        ${images.length > 0 ? `
          <section class="border-t border-outline-variant/30 pt-12 mb-16">
            <h2 class="font-headline-md text-2xl font-bold text-on-surface mb-6">Visual Interface &amp; Gallery</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              ${images.map((img, idx) => `
                <div class="group relative rounded-DEFAULT overflow-hidden border border-outline-variant/30 bg-surface-container-highest cursor-pointer gallery-item" data-img-url="${escapeHtml(img.image_url)}" data-caption="${escapeHtml(img.caption || proj.title)}">
                  <img 
                    src="${escapeHtml(img.image_url)}" 
                    alt="${escapeHtml(img.alt_text || img.caption || proj.title)}" 
                    class="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4 text-center">
                    <span class="text-xs font-semibold text-white">${escapeHtml(img.caption || 'Click to enlarge')}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}

        <!-- Related Projects -->
        ${related.length > 0 ? `
          <section class="border-t border-outline-variant/30 pt-12 mb-16">
            <h2 class="font-headline-md text-2xl font-bold text-on-surface mb-6">Related Projects</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              ${related.map(r => `
                <a href="/projects/${escapeHtml(r.slug)}" class="p-5 rounded-DEFAULT bg-surface-container-low border border-outline-variant/30 glow-card flex flex-col justify-between group">
                  <div>
                    <span class="font-label-caps text-[10px] text-on-tertiary-container block mb-1">${escapeHtml(r.category_name || '')}</span>
                    <h3 class="font-headline-md text-lg font-bold text-on-surface group-hover:text-on-tertiary-container transition-colors mb-2">${escapeHtml(r.title)}</h3>
                    <p class="text-on-surface-variant text-xs line-clamp-2">${escapeHtml(r.short_description)}</p>
                  </div>
                  <span class="font-body-md text-xs font-semibold text-on-tertiary-container mt-4 flex items-center gap-1">
                    Explore &rarr;
                  </span>
                </a>
              `).join('')}
            </div>
          </section>
        ` : ''}

        <!-- Bottom CTA -->
        <div class="p-10 rounded-xl bg-gradient-to-r from-surface-container-low to-surface-container-lowest border border-on-tertiary-container/30 text-center flex flex-col items-center">
          <h2 class="font-display-lg text-2xl md:text-3xl font-bold text-on-surface mb-3">Want to build something similar?</h2>
          <p class="text-on-surface-variant max-w-lg mb-6 text-sm">We can customize or build a dedicated platform designed specifically for your organization.</p>
          <a href="/contact" class="bg-on-tertiary-container text-white px-8 py-3.5 rounded-DEFAULT font-semibold text-sm hover:bg-opacity-90 transition-all flex items-center gap-2">
            Let's Talk
            <span class="material-symbols-outlined text-base">arrow_forward</span>
          </a>
        </div>
      </article>

      <!-- Lightbox Modal Container -->
      <div id="lightbox-modal" class="fixed inset-0 z-50 modal-backdrop hidden flex items-center justify-center p-4">
        <div class="relative max-w-5xl w-full flex flex-col items-center">
          <button id="close-lightbox" class="absolute -top-12 right-0 text-white hover:text-on-tertiary-container transition-colors p-2">
            <span class="material-symbols-outlined text-3xl">close</span>
          </button>
          <img id="lightbox-img" src="" alt="" class="max-h-[85vh] w-auto max-w-full rounded-DEFAULT border border-white/20 shadow-2xl object-contain"/>
          <p id="lightbox-caption" class="mt-3 text-sm text-white/90 font-medium text-center"></p>
        </div>
      </div>
    `;

    // Bind Gallery Lightbox
    const modal = document.getElementById('lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCap = document.getElementById('lightbox-caption');
    const closeBtn = document.getElementById('close-lightbox');

    document.querySelectorAll('.gallery-item').forEach(item => {
      item.onclick = () => {
        const url = item.getAttribute('data-img-url');
        const cap = item.getAttribute('data-caption');
        if (lightboxImg && modal) {
          lightboxImg.src = url;
          if (lightboxCap) lightboxCap.textContent = cap;
          modal.classList.remove('hidden');
        }
      };
    });

    if (closeBtn && modal) {
      closeBtn.onclick = () => modal.classList.add('hidden');
      modal.onclick = (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      };
    }
  }

  // -------------------------------------------------------------
  // ABOUT PAGE
  // -------------------------------------------------------------
  function renderAboutPage(container) {
    updateSEO({
      title: 'About WAJIDX — Build. Automate. Innovate.',
      description: 'Learn about the philosophy, engineering discipline, and technical principles behind WAJIDX.'
    });

    container.innerHTML = `
      <section class="max-w-container-max mx-auto px-4 md:px-xl py-10 sm:py-16 animate-fade-in-up">
        <!-- Header -->
        <div class="mb-10 sm:mb-16 border-b border-outline-variant/30 pb-8 sm:pb-10">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-1.5 h-1.5 rounded-full bg-on-tertiary-container"></span>
            <span class="font-label-caps text-label-caps text-on-tertiary-container uppercase tracking-widest">ABOUT THE STUDIO</span>
          </div>
          <h1 class="font-display-lg text-3xl sm:text-4xl md:text-6xl font-bold text-on-surface mb-4 sm:mb-6">
            Precision Minimalism &amp; High-Performance Software.
          </h1>
          <p class="font-body-lg text-base sm:text-xl text-on-surface-variant max-w-3xl leading-relaxed">
            WAJIDX is a specialized software and digital engineering brand. We create practical business systems, automated POS pipelines, and edge AI applications that eliminate friction and unlock scale.
          </p>
        </div>

        <!-- Founder & Principal Architect Showcase -->
        <div class="mb-12 sm:mb-20 p-6 sm:p-8 md:p-12 rounded-2xl bg-gradient-to-br from-surface-container-low via-surface-container-lowest to-surface-container-low border border-outline-variant/40 shadow-2xl relative overflow-hidden">
          <div class="absolute top-0 right-0 w-96 h-96 bg-on-tertiary-container/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 items-center relative z-10">
            <!-- Left: Founder Portrait Frame -->
            <div class="lg:col-span-4 flex flex-col items-center">
              <div class="relative w-full max-w-[260px] sm:max-w-[290px] rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-surface-container-lowest group">
                <div class="hero-corner-tl"></div>
                <div class="hero-corner-tr"></div>
                <div class="hero-corner-bl"></div>
                <div class="hero-corner-br"></div>
                <img 
                  src="/assets/wajid-hero.jpg" 
                  alt="Wajid — Principal Architect &amp; Founder" 
                  class="w-full h-auto object-cover object-top filter contrast-[1.04] brightness-[1.02] group-hover:scale-105 transition-transform duration-700"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-transparent to-transparent opacity-80 pointer-events-none"></div>
                <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10">
                  <span class="font-label-caps text-[10px] text-white bg-black/70 backdrop-blur-md px-2.5 py-1 rounded border border-white/15">FOUNDER &amp; ARCHITECT</span>
                  <span class="flex items-center gap-1.5 text-[11px] font-code-sm text-green-400 bg-black/70 px-2 py-1 rounded border border-white/15">
                    <span class="beacon-dot scale-75"></span> ACTIVE
                  </span>
                </div>
              </div>
            </div>

            <!-- Right: Founder Statement & Engineering DNA -->
            <div class="lg:col-span-8 flex flex-col gap-5">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-on-tertiary-container"></span>
                <span class="font-label-caps text-xs text-on-tertiary-container tracking-widest uppercase font-semibold">STUDIO LEADERSHIP</span>
              </div>
              
              <h2 class="font-display-lg text-2xl sm:text-3xl md:text-4xl font-bold text-on-surface tracking-tight">
                Architected &amp; Engineered by Wajid.
              </h2>

              <p class="font-body-lg text-sm sm:text-base md:text-lg text-on-surface-variant leading-relaxed">
                "Software in mission-critical environments must never be brittle or sluggish. When hundreds of live orders are firing across kitchen display stations, or edge camera feeds are running neural attendance verifications, precision engineering is non-negotiable."
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div class="p-4 rounded-xl bg-surface-container/70 border border-outline-variant/30 flex items-start gap-3.5">
                  <div class="w-10 h-10 rounded-lg bg-on-tertiary-container/15 flex items-center justify-center text-on-tertiary-container flex-shrink-0">
                    <span class="material-symbols-outlined text-xl">terminal</span>
                  </div>
                  <div>
                    <h4 class="font-headline-md text-sm font-bold text-on-surface">Systems Architecture</h4>
                    <p class="text-xs text-on-surface-variant mt-1 leading-relaxed">Local-first point-of-sale platforms, recipe costing engines, and sub-second transaction dispatch.</p>
                  </div>
                </div>

                <div class="p-4 rounded-xl bg-surface-container/70 border border-outline-variant/30 flex items-start gap-3.5">
                  <div class="w-10 h-10 rounded-lg bg-on-tertiary-container/15 flex items-center justify-center text-on-tertiary-container flex-shrink-0">
                    <span class="material-symbols-outlined text-xl">smart_toy</span>
                  </div>
                  <div>
                    <h4 class="font-headline-md text-sm font-bold text-on-surface">Edge AI &amp; Vision</h4>
                    <p class="text-xs text-on-surface-variant mt-1 leading-relaxed">Low-latency biometric verification, anti-spoof neural embeddings, and automated workflow pipelines.</p>
                  </div>
                </div>
              </div>

              <div class="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <a href="/contact" class="bg-on-tertiary-container text-white px-6 py-3.5 rounded-lg font-semibold text-sm hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(38,116,231,0.3)] w-full sm:w-auto text-center">
                  <span>Schedule Architectural Review</span>
                  <span class="material-symbols-outlined text-base">arrow_forward</span>
                </a>
                <a href="/projects" class="text-on-surface-variant hover:text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors py-2 w-full sm:w-auto text-center">
                  <span>View Project Case Studies</span>
                  <span class="material-symbols-outlined text-sm">arrow_forward</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- 3 Brand Pillars -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <div class="p-8 rounded-DEFAULT bg-surface-container-low border border-outline-variant/30 glow-card flex flex-col gap-4">
            <span class="font-headline-lg text-4xl font-bold text-on-tertiary-container">01</span>
            <h3 class="font-headline-md text-2xl font-bold text-on-surface">BUILD</h3>
            <p class="text-on-surface-variant text-sm leading-relaxed">
              We engineer custom software systems from the ground up, designed around real-world operational workflows rather than generic off-the-shelf constraints.
            </p>
          </div>

          <div class="p-8 rounded-DEFAULT bg-surface-container-low border border-outline-variant/30 glow-card flex flex-col gap-4">
            <span class="font-headline-lg text-4xl font-bold text-on-tertiary-container">02</span>
            <h3 class="font-headline-md text-2xl font-bold text-on-surface">AUTOMATE</h3>
            <p class="text-on-surface-variant text-sm leading-relaxed">
              Repetitive operational tasks bleed efficiency. We create autonomous pipelines, price indexers, and real-time synchronizations to keep systems running error-free.
            </p>
          </div>

          <div class="p-8 rounded-DEFAULT bg-surface-container-low border border-outline-variant/30 glow-card flex flex-col gap-4">
            <span class="font-headline-lg text-4xl font-bold text-on-tertiary-container">03</span>
            <h3 class="font-headline-md text-2xl font-bold text-on-surface">INNOVATE</h3>
            <p class="text-on-surface-variant text-sm leading-relaxed">
              We leverage modern edge AI, computer vision embeddings, and WebGL graphics to deliver next-generation user experiences and computational speed.
            </p>
          </div>
        </div>

        <!-- Technical Principles -->
        <div class="p-10 rounded-xl bg-surface-container-low border border-outline-variant/30 mb-20">
          <h2 class="font-headline-md text-2xl font-bold text-on-surface mb-8">Architectural Principles</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div class="flex gap-4">
              <span class="material-symbols-outlined text-on-tertiary-container text-2xl mt-1">speed</span>
              <div>
                <h3 class="font-headline-md text-lg font-bold text-on-surface mb-1">Sub-Second Execution</h3>
                <p class="text-on-surface-variant text-sm leading-relaxed">We optimize every query, payload, and client render for instant responsiveness under high concurrency.</p>
              </div>
            </div>

            <div class="flex gap-4">
              <span class="material-symbols-outlined text-on-tertiary-container text-2xl mt-1">offline_pin</span>
              <div>
                <h3 class="font-headline-md text-lg font-bold text-on-surface mb-1">Offline-First Resilience</h3>
                <p class="text-on-surface-variant text-sm leading-relaxed">Operational hardware and POS systems must never stop when internet connectivity drops.</p>
              </div>
            </div>

            <div class="flex gap-4">
              <span class="material-symbols-outlined text-on-tertiary-container text-2xl mt-1">lock</span>
              <div>
                <h3 class="font-headline-md text-lg font-bold text-on-surface mb-1">Strict Server Authorization</h3>
                <p class="text-on-surface-variant text-sm leading-relaxed">Security is enforced at the database and API layer with token verification and granular role audits.</p>
              </div>
            </div>

            <div class="flex gap-4">
              <span class="material-symbols-outlined text-on-tertiary-container text-2xl mt-1">layers</span>
              <div>
                <h3 class="font-headline-md text-lg font-bold text-on-surface mb-1">Clean Modular Design</h3>
                <p class="text-on-surface-variant text-sm leading-relaxed">Codebases built with distinct separation of concerns that scale gracefully as features evolve.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  // -------------------------------------------------------------
  // SERVICES PAGE
  // -------------------------------------------------------------
  function renderServicesPage(container) {
    updateSEO({
      title: 'Services & Engineering Capabilities',
      description: 'Discover WAJIDX custom software services: Point-of-Sale systems, AI computer vision, business ERPs, and automation pipelines.'
    });

    container.innerHTML = `
      <section class="max-w-container-max mx-auto px-4 md:px-xl py-10 sm:py-16 animate-fade-in-up">
        <!-- Header -->
        <div class="mb-10 sm:mb-16 border-b border-outline-variant/30 pb-8 sm:pb-10">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-1.5 h-1.5 rounded-full bg-on-tertiary-container"></span>
            <span class="font-label-caps text-label-caps text-on-tertiary-container uppercase tracking-widest">CORE OFFERINGS</span>
          </div>
          <h1 class="font-display-lg text-3xl sm:text-4xl md:text-6xl font-bold text-on-surface mb-4 sm:mb-6">
            Engineered Software Services
          </h1>
          <p class="font-body-lg text-base sm:text-xl text-on-surface-variant max-w-3xl leading-relaxed">
            We provide end-to-end engineering from architectural planning and database modeling to high-throughput deployment and operational maintenance.
          </p>
        </div>

        <!-- Service Blocks -->
        <div class="flex flex-col gap-8 sm:gap-12 mb-16 sm:mb-20">
          <!-- Service 1 -->
          <div class="p-6 sm:p-8 md:p-12 rounded-xl bg-surface-container-low border border-outline-variant/30 glow-card grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
            <div class="lg:col-span-8 flex flex-col gap-4">
              <div class="flex items-center gap-2 text-on-tertiary-container font-label-caps text-xs">
                <span class="material-symbols-outlined text-lg">point_of_sale</span>
                SERVICE // 01
              </div>
              <h2 class="font-headline-md text-2xl md:text-3xl font-bold text-on-surface">Custom POS &amp; Hospitality Engines</h2>
              <p class="text-on-surface-variant text-sm sm:text-base leading-relaxed">
                Specialized point-of-sale platforms for restaurants and retail. Features include sub-second dispatch, live recipe Bill-of-Materials depletion, multi-station Kitchen Display Systems, thermal printer routing, and blind shift drop auditing.
              </p>
              <div class="flex flex-wrap gap-2 pt-2">
                <span class="tech-badge px-2.5 py-1 rounded bg-surface-container-highest text-on-surface text-xs">Local-First POS</span>
                <span class="tech-badge px-2.5 py-1 rounded bg-surface-container-highest text-on-surface text-xs">Recipe Costing Engine</span>
                <span class="tech-badge px-2.5 py-1 rounded bg-surface-container-highest text-on-surface text-xs">KDS Multi-Station</span>
              </div>
            </div>
            <div class="lg:col-span-4 flex justify-start lg:justify-end w-full lg:w-auto">
              <a href="/contact" class="bg-on-tertiary-container text-white px-6 py-3.5 rounded-DEFAULT font-semibold text-sm hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 w-full sm:w-auto text-center">
                Inquire Service
                <span class="material-symbols-outlined text-base">arrow_forward</span>
              </a>
            </div>
          </div>

          <!-- Service 2 -->
          <div class="p-6 sm:p-8 md:p-12 rounded-xl bg-surface-container-low border border-outline-variant/30 glow-card grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
            <div class="lg:col-span-8 flex flex-col gap-4">
              <div class="flex items-center gap-2 text-on-tertiary-container font-label-caps text-xs">
                <span class="material-symbols-outlined text-lg">smart_toy</span>
                SERVICE // 02
              </div>
              <h2 class="font-headline-md text-2xl md:text-3xl font-bold text-on-surface">Computer Vision &amp; Edge AI Systems</h2>
              <p class="text-on-surface-variant text-sm sm:text-base leading-relaxed">
                High-throughput visual recognition pipelines executed directly on edge hardware. Implement biometric attendance, automated quality control inspection, anti-spoofing verification, and continuous video stream classification.
              </p>
              <div class="flex flex-wrap gap-2 pt-2">
                <span class="tech-badge px-2.5 py-1 rounded bg-surface-container-highest text-on-surface text-xs">OpenCV / Python</span>
                <span class="tech-badge px-2.5 py-1 rounded bg-surface-container-highest text-on-surface text-xs">Edge Neural Inference</span>
                <span class="tech-badge px-2.5 py-1 rounded bg-surface-container-highest text-on-surface text-xs">Automated Payroll Sync</span>
              </div>
            </div>
            <div class="lg:col-span-4 flex justify-start lg:justify-end w-full lg:w-auto">
              <a href="/contact" class="bg-on-tertiary-container text-white px-6 py-3.5 rounded-DEFAULT font-semibold text-sm hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 w-full sm:w-auto text-center">
                Inquire Service
                <span class="material-symbols-outlined text-base">arrow_forward</span>
              </a>
            </div>
          </div>

          <!-- Service 3 -->
          <div class="p-6 sm:p-8 md:p-12 rounded-xl bg-surface-container-low border border-outline-variant/30 glow-card grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
            <div class="lg:col-span-8 flex flex-col gap-4">
              <div class="flex items-center gap-2 text-on-tertiary-container font-label-caps text-xs">
                <span class="material-symbols-outlined text-lg">schema</span>
                SERVICE // 03
              </div>
              <h2 class="font-headline-md text-2xl md:text-3xl font-bold text-on-surface">Enterprise Business Software &amp; ERP</h2>
              <p class="text-on-surface-variant text-sm sm:text-base leading-relaxed">
                Centralized ERP and inventory management platforms. Seamlessly track multi-warehouse inventory, procurement purchase orders, supplier price variance, and automated accounts reconciliation.
              </p>
              <div class="flex flex-wrap gap-2 pt-2">
                <span class="tech-badge px-2.5 py-1 rounded bg-surface-container-highest text-on-surface text-xs">Relational SQL Modeling</span>
                <span class="tech-badge px-2.5 py-1 rounded bg-surface-container-highest text-on-surface text-xs">REST APIs</span>
                <span class="tech-badge px-2.5 py-1 rounded bg-surface-container-highest text-on-surface text-xs">Role Audits</span>
              </div>
            </div>
            <div class="lg:col-span-4 flex justify-start lg:justify-end w-full lg:w-auto">
              <a href="/contact" class="bg-on-tertiary-container text-white px-6 py-3.5 rounded-DEFAULT font-semibold text-sm hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 w-full sm:w-auto text-center">
                Inquire Service
                <span class="material-symbols-outlined text-base">arrow_forward</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  // -------------------------------------------------------------
  // PROCESS PAGE (From Stitch Design)
  // -------------------------------------------------------------
  function renderProcessPage(container) {
    updateSEO({
      title: 'Our Engineering Process',
      description: 'The 5-phase engineering methodology powering WAJIDX software development and deployment.'
    });

    container.innerHTML = `
      <section class="max-w-container-max mx-auto px-4 md:px-xl py-10 sm:py-16 animate-fade-in-up">
        <!-- Header -->
        <div class="mb-10 sm:mb-16 border-b border-outline-variant/30 pb-8 sm:pb-10">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-1.5 h-1.5 rounded-full bg-on-tertiary-container"></span>
            <span class="font-label-caps text-label-caps text-on-tertiary-container uppercase tracking-widest">METHODOLOGY</span>
          </div>
          <h1 class="font-display-lg text-3xl sm:text-4xl md:text-6xl font-bold text-on-surface mb-4 sm:mb-6">
            The WAJIDX Engineering Lifecycle
          </h1>
          <p class="font-body-lg text-base sm:text-xl text-on-surface-variant max-w-3xl leading-relaxed">
            A disciplined, 5-stage architectural process that turns complex operational chaos into rock-solid software systems.
          </p>
        </div>

        <!-- 5 Steps Timeline -->
        <div class="flex flex-col gap-6 sm:gap-10 mb-16 sm:mb-20 relative">
          <!-- Step 1 -->
          <div class="p-6 sm:p-8 md:p-10 rounded-xl bg-surface-container-low border border-outline-variant/30 glow-card flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
            <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-DEFAULT bg-on-tertiary-container/10 border border-on-tertiary-container/30 flex items-center justify-center text-on-tertiary-container font-headline-lg text-xl sm:text-2xl font-bold flex-shrink-0">
              01
            </div>
            <div class="flex-1 flex flex-col gap-2 sm:gap-3">
              <span class="font-label-caps text-xs text-on-tertiary-container">PHASE ONE // SCOPING</span>
              <h2 class="font-headline-md text-xl sm:text-2xl font-bold text-on-surface">Operational Discovery &amp; Bottleneck Analysis</h2>
              <p class="text-on-surface-variant text-sm sm:text-base leading-relaxed">
                We sit with your operational managers, operators, and staff to uncover the exact friction points, latency bottlenecks, and manual error vulnerabilities in existing workflows.
              </p>
            </div>
          </div>

          <!-- Step 2 -->
          <div class="p-6 sm:p-8 md:p-10 rounded-xl bg-surface-container-low border border-outline-variant/30 glow-card flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
            <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-DEFAULT bg-on-tertiary-container/10 border border-on-tertiary-container/30 flex items-center justify-center text-on-tertiary-container font-headline-lg text-xl sm:text-2xl font-bold flex-shrink-0">
              02
            </div>
            <div class="flex-1 flex flex-col gap-2 sm:gap-3">
              <span class="font-label-caps text-xs text-on-tertiary-container">PHASE TWO // BLUEPRINT</span>
              <h2 class="font-headline-md text-xl sm:text-2xl font-bold text-on-surface">System Architecture &amp; Database Modeling</h2>
              <p class="text-on-surface-variant text-sm sm:text-base leading-relaxed">
                Before writing a line of frontend code, we construct complete relational SQL schemas, API specifications, edge fallback protocols, and security authorization matrices.
              </p>
            </div>
          </div>

          <!-- Step 3 -->
          <div class="p-6 sm:p-8 md:p-10 rounded-xl bg-surface-container-low border border-outline-variant/30 glow-card flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
            <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-DEFAULT bg-on-tertiary-container/10 border border-on-tertiary-container/30 flex items-center justify-center text-on-tertiary-container font-headline-lg text-xl sm:text-2xl font-bold flex-shrink-0">
              03
            </div>
            <div class="flex-1 flex flex-col gap-2 sm:gap-3">
              <span class="font-label-caps text-xs text-on-tertiary-container">PHASE THREE // BUILD</span>
              <h2 class="font-headline-md text-xl sm:text-2xl font-bold text-on-surface">Iterative Sprint Builds &amp; Prototype Lab</h2>
              <p class="text-on-surface-variant text-sm sm:text-base leading-relaxed">
                Rapid bi-weekly milestone builds deploying live test environments for stakeholder review. Direct feedback loops eliminate scope drift and ensure ergonomic interface design.
              </p>
            </div>
          </div>

          <!-- Step 4 -->
          <div class="p-6 sm:p-8 md:p-10 rounded-xl bg-surface-container-low border border-outline-variant/30 glow-card flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
            <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-DEFAULT bg-on-tertiary-container/10 border border-on-tertiary-container/30 flex items-center justify-center text-on-tertiary-container font-headline-lg text-xl sm:text-2xl font-bold flex-shrink-0">
              04
            </div>
            <div class="flex-1 flex flex-col gap-2 sm:gap-3">
              <span class="font-label-caps text-xs text-on-tertiary-container">PHASE FOUR // VALIDATION</span>
              <h2 class="font-headline-md text-xl sm:text-2xl font-bold text-on-surface">Load Testing, Edge Simulation &amp; Hardening</h2>
              <p class="text-on-surface-variant text-sm sm:text-base leading-relaxed">
                Simulated network failure tests, high-concurrency order dispatch simulations, biometric spoof tests, and strict vulnerability audits to guarantee unshakeable stability.
              </p>
            </div>
          </div>

          <!-- Step 5 -->
          <div class="p-6 sm:p-8 md:p-10 rounded-xl bg-surface-container-low border border-outline-variant/30 glow-card flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
            <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-DEFAULT bg-on-tertiary-container/10 border border-on-tertiary-container/30 flex items-center justify-center text-on-tertiary-container font-headline-lg text-xl sm:text-2xl font-bold flex-shrink-0">
              05
            </div>
            <div class="flex-1 flex flex-col gap-2 sm:gap-3">
              <span class="font-label-caps text-xs text-on-tertiary-container">PHASE FIVE // DEPLOYMENT</span>
              <h2 class="font-headline-md text-xl sm:text-2xl font-bold text-on-surface">Production Rollout &amp; Continuous Evolution</h2>
              <p class="text-on-surface-variant text-sm sm:text-base leading-relaxed">
                Live deployment with automated backup scripts, real-time health monitoring, staff onboarding support, and planned incremental feature roadmaps.
              </p>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  // -------------------------------------------------------------
  // CONTACT PAGE
  // -------------------------------------------------------------
  function renderContactPage(container) {
    updateSEO({
      title: 'Contact WAJIDX — Start a Conversation',
      description: 'Get in touch with WAJIDX to discuss custom software development, business systems, or technical partnerships.'
    });

    const email = state.settings.contact_email || 'contact@wajidx.com';
    const phone = state.settings.contact_phone || '+923351362639';
    const address = state.settings.contact_address || 'Karachi, Pakistan';

    container.innerHTML = `
      <section class="max-w-container-max mx-auto px-4 md:px-xl py-10 sm:py-16 animate-fade-in-up">
        <!-- Header -->
        <div class="mb-10 sm:mb-16 border-b border-outline-variant/30 pb-8 sm:pb-10">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-1.5 h-1.5 rounded-full bg-on-tertiary-container"></span>
            <span class="font-label-caps text-label-caps text-on-tertiary-container uppercase tracking-widest">GET IN TOUCH</span>
          </div>
          <h1 class="font-display-lg text-3xl sm:text-4xl md:text-6xl font-bold text-on-surface mb-4">
            Let's Engineer Something Exceptional.
          </h1>
          <p class="font-body-lg text-base sm:text-xl text-on-surface-variant max-w-2xl leading-relaxed">
            Have a project in mind, an operational bottleneck to solve, or want to discuss enterprise architecture? Send us a direct inquiry below.
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 mb-16 sm:mb-20">
          <!-- Left: Interactive Form -->
          <div class="lg:col-span-7 p-6 sm:p-8 md:p-10 rounded-xl bg-surface-container-low border border-outline-variant/30">
            <h2 class="font-headline-md text-xl sm:text-2xl font-bold text-on-surface mb-6">Send an Inquiry</h2>
            
            <form id="contact-form" class="flex flex-col gap-6">
              <div id="contact-form-alert" class="hidden p-4 rounded-DEFAULT text-sm"></div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="flex flex-col gap-2">
                  <label class="font-label-caps text-xs text-on-surface-variant">YOUR NAME *</label>
                  <input 
                    type="text" 
                    name="name" 
                    required 
                    placeholder="e.g. Alex Morgan" 
                    class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-DEFAULT px-4 py-3 text-on-surface text-sm focus:border-on-tertiary-container focus:outline-none transition-colors"
                  />
                </div>

                <div class="flex flex-col gap-2">
                  <label class="font-label-caps text-xs text-on-surface-variant">EMAIL ADDRESS *</label>
                  <input 
                    type="email" 
                    name="email" 
                    required 
                    placeholder="e.g. alex@company.com" 
                    class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-DEFAULT px-4 py-3 text-on-surface text-sm focus:border-on-tertiary-container focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <label class="font-label-caps text-xs text-on-surface-variant">PROJECT TYPE / SUBJECT</label>
                <input 
                  type="text" 
                  name="subject" 
                  placeholder="e.g. Custom POS &amp; Inventory System" 
                  class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-DEFAULT px-4 py-3 text-on-surface text-sm focus:border-on-tertiary-container focus:outline-none transition-colors"
                />
              </div>

              <div class="flex flex-col gap-2">
                <label class="font-label-caps text-xs text-on-surface-variant">PROJECT DETAILS &amp; REQUIREMENTS *</label>
                <textarea 
                  name="message" 
                  rows="5" 
                  required 
                  placeholder="Describe your project, current systems, timeline, and goals..." 
                  class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-DEFAULT px-4 py-3 text-on-surface text-sm focus:border-on-tertiary-container focus:outline-none transition-colors resize-y"
                ></textarea>
              </div>

              <button 
                type="submit" 
                id="contact-submit-btn"
                class="bg-on-tertiary-container text-white py-4 rounded-DEFAULT font-semibold text-sm hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 hover:shadow-[0_0_25px_rgba(38,116,231,0.3)] glow-button w-full"
              >
                <span>Submit Inquiry</span>
                <span class="material-symbols-outlined text-base">send</span>
              </button>
            </form>
          </div>

          <!-- Right: Contact Cards -->
          <div class="lg:col-span-5 flex flex-col gap-6">
            <div class="p-6 sm:p-8 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-6">
              <h3 class="font-headline-md text-xl font-bold text-on-surface">Direct Communication</h3>
              
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 rounded-DEFAULT bg-on-tertiary-container/10 border border-on-tertiary-container/20 flex items-center justify-center text-on-tertiary-container flex-shrink-0">
                  <span class="material-symbols-outlined text-xl">mail</span>
                </div>
                <div>
                  <span class="font-label-caps text-xs text-on-surface-variant block mb-1">DIRECT INQUIRY</span>
                  <a href="mailto:${escapeHtml(email)}" class="text-sm font-semibold text-on-surface hover:text-on-tertiary-container transition-colors">
                    ${escapeHtml(email)}
                  </a>
                </div>
              </div>

              <div class="flex items-start gap-4">
                <div class="w-10 h-10 rounded-DEFAULT bg-on-tertiary-container/10 border border-on-tertiary-container/20 flex items-center justify-center text-on-tertiary-container flex-shrink-0">
                  <span class="material-symbols-outlined text-xl">call</span>
                </div>
                <div>
                  <span class="font-label-caps text-xs text-on-surface-variant block mb-1">OFFICE PHONE</span>
                  <a href="tel:${escapeHtml(phone)}" class="text-sm font-semibold text-on-surface hover:text-on-tertiary-container transition-colors">
                    ${escapeHtml(phone)}
                  </a>
                </div>
              </div>

              <div class="flex items-start gap-4">
                <div class="w-10 h-10 rounded-DEFAULT bg-on-tertiary-container/10 border border-on-tertiary-container/20 flex items-center justify-center text-on-tertiary-container flex-shrink-0">
                  <span class="material-symbols-outlined text-xl">location_on</span>
                </div>
                <div>
                  <span class="font-label-caps text-xs text-on-surface-variant block mb-1">LOCATION</span>
                  <span class="text-sm font-semibold text-on-surface">
                    ${escapeHtml(address)}
                  </span>
                </div>
              </div>
            </div>

            <!-- Operational Status Card -->
            <div class="p-6 rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-center gap-4">
              <span class="w-3 h-3 rounded-full bg-green-500 animate-ping"></span>
              <div>
                <span class="text-xs font-bold text-on-surface block">Engineering Status: Online</span>
                <span class="text-xs text-on-surface-variant">Accepting new custom enterprise builds &amp; consultations.</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    // Bind Contact Form Submission
    const form = document.getElementById('contact-form');
    const alertBox = document.getElementById('contact-form-alert');
    const submitBtn = document.getElementById('contact-submit-btn');

    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Sending...</span><div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>`;

        const formData = new FormData(form);
        const payload = {
          name: formData.get('name'),
          email: formData.get('email'),
          subject: formData.get('subject'),
          message: formData.get('message')
        };

        try {
          const res = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await res.json();
          if (data.success) {
            alertBox.className = 'p-4 rounded-DEFAULT text-sm bg-green-950/40 border border-green-500/40 text-green-300 mb-2';
            alertBox.textContent = data.message;
            alertBox.classList.remove('hidden');
            form.reset();
          } else {
            alertBox.className = 'p-4 rounded-DEFAULT text-sm bg-red-950/40 border border-red-500/40 text-red-300 mb-2';
            alertBox.textContent = data.error || 'Failed to send message. Please try again.';
            alertBox.classList.remove('hidden');
          }
        } catch (err) {
          alertBox.className = 'p-4 rounded-DEFAULT text-sm bg-red-950/40 border border-red-500/40 text-red-300 mb-2';
          alertBox.textContent = 'Network error. Please try again later.';
          alertBox.classList.remove('hidden');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Submit Inquiry</span><span class="material-symbols-outlined text-base">send</span>`;
        }
      };
    }
  }

  // -------------------------------------------------------------
  // 404 NOT FOUND PAGE
  // -------------------------------------------------------------
  function render404Page(container, message) {
    updateSEO({
      title: '404 // Route Not Found',
      description: 'The requested system resource could not be located.'
    });

    container.innerHTML = `
      <section class="min-h-[70vh] flex items-center justify-center px-4 py-20 animate-fade-in-up">
        <div class="max-w-md w-full p-10 rounded-xl bg-surface-container-low border border-outline-variant/40 text-center flex flex-col items-center gap-6">
          <div class="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <span class="material-symbols-outlined text-3xl">error_outline</span>
          </div>

          <div>
            <span class="font-code-sm text-xs text-red-400 block mb-1">STATUS: 404 // ROUTE_NOT_FOUND</span>
            <h1 class="font-display-lg text-3xl font-bold text-on-surface mb-2">${escapeHtml(message || 'Page Not Found')}</h1>
            <p class="text-on-surface-variant text-sm">The requested URL does not match any public endpoint or deployed project in the registry.</p>
          </div>

          <div class="flex flex-col sm:flex-row gap-3 w-full">
            <a href="/" class="flex-1 bg-on-tertiary-container text-white py-3 rounded-DEFAULT text-sm font-semibold hover:bg-opacity-90 transition-all text-center">
              Return Home
            </a>
            <a href="/projects" class="flex-1 border border-outline-variant/40 text-on-surface py-3 rounded-DEFAULT text-sm font-semibold hover:border-on-tertiary-container transition-all text-center">
              Browse Projects
            </a>
          </div>
        </div>
      </section>
    `;
  }

  // -------------------------------------------------------------
  // INITIALIZATION
  // -------------------------------------------------------------
  async function init() {
    // 1. Listen to back/forward browser history
    window.addEventListener('popstate', router);

    // 2. Execute router immediately so initial screen renders with zero network lag
    router();

    // 3. Fetch Global Settings, Categories, and Technologies in parallel in background
    Promise.all([
      apiGet('/api/settings').then(res => {
        if (res && res.settings) state.settings = res.settings;
      }),
      apiGet('/api/categories').then(res => {
        if (res && res.categories) state.categories = res.categories;
      }),
      apiGet('/api/technologies').then(res => {
        if (res && res.technologies) state.technologies = res.technologies;
      })
    ]).catch(err => {
      console.warn('[Sync background error]:', err);
    });
  }

  // Export to window
  window.wajidxApp = {
    state,
    router,
    init
  };

  // Run on DOM loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
