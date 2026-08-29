// WAJIDX Admin Dashboard Application Controller
// Complete, Protected Single-Page CMS

(function () {
  'use strict';

  const adminState = {
    token: localStorage.getItem('wajidx_admin_token') || null,
    user: null,
    currentTab: 'dashboard',
    stats: null,
    projects: [],
    categories: [],
    technologies: [],
    messages: [],
    settings: {}
  };

  // Helper: Admin Authenticated Fetch
  async function adminFetch(endpoint, options = {}) {
    const headers = {
      ...(options.headers || {})
    };

    if (adminState.token) {
      headers['Authorization'] = `Bearer ${adminState.token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(endpoint, {
        ...options,
        headers
      });

      if (res.status === 401 || res.status === 403) {
        // Token expired or unauthorized
        localStorage.removeItem('wajidx_admin_token');
        adminState.token = null;
        adminState.user = null;
        renderAdminLogin();
        return null;
      }

      return await res.json();
    } catch (err) {
      console.error(`[Admin Fetch Error] ${endpoint}:`, err);
      return null;
    }
  }

  // Escape HTML helper
  function escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initialize Admin App
  async function initAdminApp() {
    const appContainer = document.getElementById('app-root');
    const siteHeader = document.getElementById('site-header');
    const siteFooter = document.getElementById('site-footer');

    // Hide public header/footer on admin
    if (siteHeader) siteHeader.style.display = 'none';
    if (siteFooter) siteFooter.style.display = 'none';

    // Verify Auth State
    if (!adminState.token) {
      renderAdminLogin();
      return;
    }

    const meRes = await adminFetch('/api/auth/me');
    if (!meRes || !meRes.success || !meRes.admin) {
      localStorage.removeItem('wajidx_admin_token');
      adminState.token = null;
      renderAdminLogin();
      return;
    }

    adminState.user = meRes.admin;
    renderAdminShell();
  }

  // -------------------------------------------------------------
  // ADMIN LOGIN VIEW
  // -------------------------------------------------------------
  function renderAdminLogin() {
    document.title = 'WAJIDX // Admin Authentication';
    const container = document.getElementById('app-root');
    if (!container) return;

    container.innerHTML = `
      <div class="min-h-screen flex items-center justify-center px-4 bg-primary-container blueprint-grid relative">
        <div class="absolute inset-0 bg-on-tertiary-container/5 pointer-events-none"></div>

        <div class="max-w-md w-full p-8 md:p-10 rounded-xl bg-surface-container-low border border-outline-variant/40 shadow-2xl relative z-10 glow-card flex flex-col gap-6">
          <div class="text-center flex flex-col items-center gap-2">
            <div class="w-16 h-16 rounded-xl bg-surface-container-lowest border border-white/10 p-1 flex items-center justify-center shadow-[0_0_25px_rgba(38,116,231,0.4)]">
              <img src="/assets/wajidx-logo.png" alt="WAJIDX Logo" class="w-full h-full object-contain rounded-lg"/>
            </div>
            <h1 class="font-headline-md text-2xl font-bold text-on-surface">WAJIDX Studio CMS</h1>
            <span class="font-label-caps text-xs text-on-surface-variant">AUTHENTICATED ACCESS ONLY</span>
          </div>

          <div id="login-alert" class="hidden p-3.5 rounded text-xs"></div>

          <form id="admin-login-form" class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-on-surface-variant">USERNAME OR EMAIL</label>
              <input 
                type="text" 
                name="username" 
                required 
                autocomplete="username"
                placeholder="admin@wajidx.com"
                class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-4 py-2.5 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-on-surface-variant">MASTER PASSWORD</label>
              <input 
                type="password" 
                name="password" 
                required 
                autocomplete="current-password"
                placeholder="••••••••••••"
                class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-4 py-2.5 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none"
              />
            </div>

            <button 
              type="submit" 
              id="login-submit-btn"
              class="mt-2 bg-on-tertiary-container text-white py-3 rounded font-semibold text-sm hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 glow-button"
            >
              <span>Authenticate Session</span>
              <span class="material-symbols-outlined text-base">lock_open</span>
            </button>
          </form>

          <div class="pt-4 border-t border-outline-variant/20 flex justify-between items-center text-xs text-on-surface-variant font-code-sm">
            <a href="/" class="hover:text-on-surface flex items-center gap-1">
              &larr; Public Site
            </a>
            <span>v1.0 // Production</span>
          </div>
        </div>
      </div>
    `;

    const form = document.getElementById('admin-login-form');
    const alertBox = document.getElementById('login-alert');
    const submitBtn = document.getElementById('login-submit-btn');

    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Verifying...</span><div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>`;

        const formData = new FormData(form);
        const payload = {
          username: formData.get('username'),
          password: formData.get('password')
        };

        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();

          if (data.success && data.token) {
            localStorage.setItem('wajidx_admin_token', data.token);
            adminState.token = data.token;
            adminState.user = data.admin;
            renderAdminShell();
          } else {
            alertBox.className = 'p-3.5 rounded text-xs bg-red-950/50 border border-red-500/40 text-red-300';
            alertBox.textContent = data.error || 'Invalid credentials.';
            alertBox.classList.remove('hidden');
          }
        } catch (err) {
          alertBox.className = 'p-3.5 rounded text-xs bg-red-950/50 border border-red-500/40 text-red-300';
          alertBox.textContent = 'Server connection error.';
          alertBox.classList.remove('hidden');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Authenticate Session</span><span class="material-symbols-outlined text-base">lock_open</span>`;
        }
      };
    }
  }

  // -------------------------------------------------------------
  // ADMIN DASHBOARD SHELL
  // -------------------------------------------------------------
  function renderAdminShell() {
    document.title = 'WAJIDX // Control Panel';
    const container = document.getElementById('app-root');
    if (!container) return;

    container.innerHTML = `
      <div class="min-h-screen flex bg-primary-container text-on-surface">
        <!-- Sidebar Navigation -->
        <aside class="w-64 bg-surface-container-low border-r border-outline-variant/30 flex flex-col justify-between flex-shrink-0 min-h-screen p-4 hidden md:flex">
          <div class="flex flex-col gap-6">
            <!-- Brand -->
            <div class="flex items-center gap-3 px-3 py-2">
              <div class="w-8 h-8 rounded-lg bg-surface-container-lowest border border-white/10 p-0.5 flex items-center justify-center">
                <img src="/assets/wajidx-logo.png" alt="WAJIDX Logo" class="w-full h-full object-contain rounded"/>
              </div>
              <div class="flex flex-col">
                <span class="font-headline-md text-base font-bold leading-tight">WAJIDX CMS</span>
                <span class="font-label-caps text-[10px] text-on-surface-variant">CONTROL CENTER</span>
              </div>
            </div>

            <!-- Nav Links -->
            <nav class="flex flex-col gap-1 text-sm font-medium">
              <button data-tab="dashboard" class="admin-nav-btn flex items-center gap-3 px-3 py-2.5 rounded hover:bg-surface-container-highest transition-colors text-left text-on-surface">
                <span class="material-symbols-outlined text-xl text-on-tertiary-container">dashboard</span>
                Dashboard
              </button>
              <button data-tab="projects" class="admin-nav-btn flex items-center gap-3 px-3 py-2.5 rounded hover:bg-surface-container-highest transition-colors text-left text-on-surface-variant">
                <span class="material-symbols-outlined text-xl">folder</span>
                Projects CMS
              </button>
              <button data-tab="categories" class="admin-nav-btn flex items-center gap-3 px-3 py-2.5 rounded hover:bg-surface-container-highest transition-colors text-left text-on-surface-variant">
                <span class="material-symbols-outlined text-xl">category</span>
                Categories
              </button>
              <button data-tab="technologies" class="admin-nav-btn flex items-center gap-3 px-3 py-2.5 rounded hover:bg-surface-container-highest transition-colors text-left text-on-surface-variant">
                <span class="material-symbols-outlined text-xl">code</span>
                Technologies
              </button>
              <button data-tab="media" class="admin-nav-btn flex items-center gap-3 px-3 py-2.5 rounded hover:bg-surface-container-highest transition-colors text-left text-on-surface-variant">
                <span class="material-symbols-outlined text-xl">photo_library</span>
                Media Library
              </button>
              <button data-tab="messages" class="admin-nav-btn flex items-center gap-3 px-3 py-2.5 rounded hover:bg-surface-container-highest transition-colors text-left text-on-surface-variant">
                <span class="material-symbols-outlined text-xl">mail</span>
                Inquiries Inbox
              </button>
              <button data-tab="settings" class="admin-nav-btn flex items-center gap-3 px-3 py-2.5 rounded hover:bg-surface-container-highest transition-colors text-left text-on-surface-variant">
                <span class="material-symbols-outlined text-xl">settings</span>
                Site &amp; SEO Settings
              </button>
            </nav>
          </div>

          <!-- Bottom Profile / Logout -->
          <div class="border-t border-outline-variant/30 pt-4 flex flex-col gap-3">
            <div class="flex items-center justify-between px-2">
              <div class="flex flex-col">
                <span class="text-xs font-bold text-on-surface">${escape(adminState.user?.name || 'Admin')}</span>
                <span class="text-[11px] text-on-surface-variant truncate max-w-[120px]">${escape(adminState.user?.email || '')}</span>
              </div>
              <a href="/" target="_blank" title="View Public Site" class="p-1.5 rounded hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface">
                <span class="material-symbols-outlined text-lg">open_in_new</span>
              </a>
            </div>

            <button id="admin-logout-btn" class="w-full flex items-center justify-center gap-2 py-2 px-3 rounded bg-red-950/30 border border-red-500/20 text-red-300 hover:bg-red-900/40 text-xs font-semibold transition-colors">
              <span class="material-symbols-outlined text-sm">logout</span>
              Sign Out
            </button>
          </div>
        </aside>

        <!-- Main Content Area -->
        <main class="flex-1 flex flex-col min-w-0 overflow-y-auto max-h-screen">
          <!-- Top bar -->
          <header class="h-16 border-b border-outline-variant/30 bg-surface-container-low/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
            <div class="flex items-center gap-3">
              <span class="font-headline-md text-lg font-bold" id="admin-view-title">Dashboard Overview</span>
            </div>

            <div class="flex items-center gap-4">
              <span class="font-code-sm text-xs text-on-surface-variant hidden sm:inline">DATABASE: devaj // ONLINE</span>
              <a href="/" class="text-xs text-on-tertiary-container hover:underline flex items-center gap-1 font-semibold">
                Visit Website &rarr;
              </a>
            </div>
          </header>

          <!-- Tab Content Container -->
          <div id="admin-tab-container" class="p-6 md:p-8 flex-1">
            <div class="py-12 text-center text-on-surface-variant">Loading workspace...</div>
          </div>
        </main>
      </div>

      <!-- Generic Dynamic Modal Container -->
      <div id="admin-modal" class="fixed inset-0 z-50 modal-backdrop hidden flex items-center justify-center p-4 overflow-y-auto">
        <div id="admin-modal-body" class="bg-surface-container-low border border-outline-variant/40 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-2xl relative">
        </div>
      </div>
    `;

    // Bind Nav Buttons
    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
      btn.onclick = () => {
        const tab = btn.getAttribute('data-tab');
        switchAdminTab(tab);
      };
    });

    // Bind Logout
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        await adminFetch('/api/auth/logout', { method: 'POST' });
        localStorage.removeItem('wajidx_admin_token');
        adminState.token = null;
        adminState.user = null;
        renderAdminLogin();
      };
    }

    // Default Load Tab
    switchAdminTab('dashboard');
  }

  // Switch Admin Tab Handler
  function switchAdminTab(tab) {
    adminState.currentTab = tab;
    document.querySelectorAll('.admin-nav-btn').forEach(b => {
      if (b.getAttribute('data-tab') === tab) {
        b.classList.add('bg-surface-container-highest', 'text-on-surface', 'font-semibold');
        b.classList.remove('text-on-surface-variant');
      } else {
        b.classList.remove('bg-surface-container-highest', 'text-on-surface', 'font-semibold');
        b.classList.add('text-on-surface-variant');
      }
    });

    const titleEl = document.getElementById('admin-view-title');
    const container = document.getElementById('admin-tab-container');
    if (!container) return;

    if (tab === 'dashboard') {
      if (titleEl) titleEl.textContent = 'Dashboard Overview';
      renderDashboardTab(container);
    } else if (tab === 'projects') {
      if (titleEl) titleEl.textContent = 'Projects Management';
      renderProjectsTab(container);
    } else if (tab === 'categories') {
      if (titleEl) titleEl.textContent = 'Categories Manager';
      renderCategoriesTab(container);
    } else if (tab === 'technologies') {
      if (titleEl) titleEl.textContent = 'Technologies Manager';
      renderTechnologiesTab(container);
    } else if (tab === 'media') {
      if (titleEl) titleEl.textContent = 'Media & Asset Library';
      renderMediaTab(container);
    } else if (tab === 'messages') {
      if (titleEl) titleEl.textContent = 'Contact Inquiries Inbox';
      renderMessagesTab(container);
    } else if (tab === 'settings') {
      if (titleEl) titleEl.textContent = 'Site & SEO Settings';
      renderSettingsTab(container);
    }
  }

  // -------------------------------------------------------------
  // TAB: DASHBOARD OVERVIEW
  // -------------------------------------------------------------
  async function renderDashboardTab(container) {
    container.innerHTML = `<div class="py-12 text-center text-on-surface-variant">Gathering telemetry...</div>`;
    const res = await adminFetch('/api/admin/stats');
    if (!res || !res.stats) {
      container.innerHTML = `<div class="p-6 rounded bg-red-950/20 text-red-400">Failed to load statistics.</div>`;
      return;
    }

    const s = res?.stats || {
      projects: { total_projects: 0, published_projects: 0, draft_projects: 0, featured_projects: 0 },
      categories: 0,
      technologies: 0,
      messages: { total_messages: 0, unread_messages: 0 },
      recentMessages: [],
      recentProjects: []
    };
    adminState.stats = s;

    const proj = s.projects || {};
    const msgs = s.messages || {};

    container.innerHTML = `
      <div class="flex flex-col gap-8 animate-fade-in-up">
        <!-- Metric Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="p-6 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
            <span class="font-label-caps text-xs text-on-surface-variant">TOTAL PROJECTS</span>
            <div class="flex items-baseline justify-between mt-3">
              <span class="font-display-lg text-4xl font-bold text-on-surface">${proj.total_projects || 0}</span>
              <span class="text-xs text-green-400 font-semibold">${proj.published_projects || 0} Published</span>
            </div>
          </div>

          <div class="p-6 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
            <span class="font-label-caps text-xs text-on-surface-variant">FEATURED SHOWCASES</span>
            <div class="flex items-baseline justify-between mt-3">
              <span class="font-display-lg text-4xl font-bold text-on-tertiary-container">${proj.featured_projects || 0}</span>
              <span class="text-xs text-on-surface-variant">Homepage Active</span>
            </div>
          </div>

          <div class="p-6 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
            <span class="font-label-caps text-xs text-on-surface-variant">CATEGORIES &amp; TECH</span>
            <div class="flex items-baseline justify-between mt-3">
              <span class="font-display-lg text-4xl font-bold text-on-surface">${s.categories || 0}</span>
              <span class="text-xs text-on-surface-variant">${s.technologies || 0} Technologies</span>
            </div>
          </div>

          <div class="p-6 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
            <span class="font-label-caps text-xs text-on-surface-variant">CONTACT INQUIRIES</span>
            <div class="flex items-baseline justify-between mt-3">
              <span class="font-display-lg text-4xl font-bold text-on-surface">${msgs.total_messages || 0}</span>
              <span class="text-xs font-semibold ${msgs.unread_messages > 0 ? 'text-amber-400' : 'text-on-surface-variant'}">
                ${msgs.unread_messages || 0} Unread
              </span>
            </div>
          </div>
        </div>

        <!-- Quick Action Shortcuts -->
        <div class="flex flex-wrap gap-4">
          <button id="dash-new-project-btn" class="bg-on-tertiary-container text-white px-5 py-2.5 rounded font-semibold text-xs hover:bg-opacity-90 transition-all flex items-center gap-2 glow-button">
            <span class="material-symbols-outlined text-sm">add</span>
            Create New Project
          </button>
          <button id="dash-view-messages-btn" class="bg-surface-container-highest border border-outline-variant/40 text-on-surface px-5 py-2.5 rounded font-medium text-xs hover:border-on-tertiary-container transition-all flex items-center gap-2">
            <span class="material-symbols-outlined text-sm">mail</span>
            Review Inquiries (${msgs.unread_messages || 0})
          </button>
        </div>

        <!-- Recent Projects & Messages Split View -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Recent Projects -->
          <div class="p-6 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <h3 class="font-headline-md text-lg font-bold text-on-surface">Recent Projects</h3>
              <button onclick="window.wajidxAdmin.switchTab('projects')" class="text-xs text-on-tertiary-container hover:underline">View All &rarr;</button>
            </div>

            <div class="flex flex-col divide-y divide-outline-variant/20 text-sm">
              ${s.recentProjects && s.recentProjects.length > 0 ? s.recentProjects.map(p => `
                <div class="py-3 flex items-center justify-between">
                  <div class="flex flex-col">
                    <span class="font-semibold text-on-surface">${escape(p.title)}</span>
                    <span class="text-xs text-on-surface-variant font-code-sm">/projects/${escape(p.slug)}</span>
                  </div>
                  <span class="px-2 py-0.5 rounded text-[11px] font-label-caps ${p.status === 'published' ? 'bg-green-950/40 text-green-400 border border-green-500/30' : 'bg-amber-950/40 text-amber-400 border border-amber-500/30'}">
                    ${escape(p.status.toUpperCase())}
                  </span>
                </div>
              `).join('') : '<div class="py-4 text-xs text-on-surface-variant">No projects created yet.</div>'}
            </div>
          </div>

          <!-- Recent Inquiries -->
          <div class="p-6 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <h3 class="font-headline-md text-lg font-bold text-on-surface">Recent Inquiries</h3>
              <button onclick="window.wajidxAdmin.switchTab('messages')" class="text-xs text-on-tertiary-container hover:underline">View All &rarr;</button>
            </div>

            <div class="flex flex-col divide-y divide-outline-variant/20 text-sm">
              ${s.recentMessages && s.recentMessages.length > 0 ? s.recentMessages.map(m => `
                <div class="py-3 flex items-center justify-between">
                  <div class="flex flex-col">
                    <span class="font-semibold text-on-surface">${escape(m.name)} &lt;${escape(m.email)}&gt;</span>
                    <span class="text-xs text-on-surface-variant truncate max-w-[200px]">${escape(m.subject || 'Project Inquiry')}</span>
                  </div>
                  <span class="text-[11px] text-on-surface-variant font-code-sm">
                    ${new Date(m.created_at).toLocaleDateString()}
                  </span>
                </div>
              `).join('') : '<div class="py-4 text-xs text-on-surface-variant">No inquiries received yet.</div>'}
            </div>
          </div>
        </div>
      </div>
    `;

    const newProjBtn = document.getElementById('dash-new-project-btn');
    if (newProjBtn) newProjBtn.onclick = () => openProjectModal();

    const viewMsgBtn = document.getElementById('dash-view-messages-btn');
    if (viewMsgBtn) viewMsgBtn.onclick = () => switchAdminTab('messages');
  }

  // -------------------------------------------------------------
  // TAB: PROJECTS CMS
  // -------------------------------------------------------------
  async function renderProjectsTab(container) {
    container.innerHTML = `<div class="py-12 text-center text-on-surface-variant">Loading projects registry...</div>`;

    const [projRes, catRes, techRes] = await Promise.all([
      adminFetch('/api/admin/projects'),
      adminFetch('/api/admin/categories'),
      adminFetch('/api/admin/technologies')
    ]);

    if (!projRes || !projRes.projects) {
      container.innerHTML = `<div class="p-6 rounded bg-red-950/20 text-red-400">Failed to load projects.</div>`;
      return;
    }

    adminState.projects = projRes.projects;
    adminState.categories = catRes?.categories || [];
    adminState.technologies = techRes?.technologies || [];

    container.innerHTML = `
      <div class="flex flex-col gap-6 animate-fade-in-up">
        <!-- Top Toolbar -->
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div class="flex items-center gap-3">
            <span class="font-label-caps text-xs text-on-surface-variant">${adminState.projects.length} Total Projects</span>
          </div>

          <button id="add-project-btn" class="bg-on-tertiary-container text-white px-5 py-2.5 rounded font-semibold text-xs hover:bg-opacity-90 transition-all flex items-center gap-2 glow-button">
            <span class="material-symbols-outlined text-sm">add</span>
            New Project
          </button>
        </div>

        <!-- Table Container -->
        <div class="rounded-xl border border-outline-variant/30 bg-surface-container-low overflow-hidden admin-table-container">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr class="border-b border-outline-variant/30 bg-surface-container-highest/60 text-on-surface-variant font-label-caps text-xs">
                <th class="py-3.5 px-4">Title &amp; Slug</th>
                <th class="py-3.5 px-4">Category</th>
                <th class="py-3.5 px-4">Status</th>
                <th class="py-3.5 px-4">Featured</th>
                <th class="py-3.5 px-4">Order</th>
                <th class="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/20">
              ${adminState.projects.map(p => `
                <tr class="hover:bg-surface-container-highest/40 transition-colors">
                  <td class="py-3.5 px-4">
                    <div class="flex flex-col">
                      <span class="font-bold text-on-surface">${escape(p.title)}</span>
                      <span class="font-code-sm text-xs text-on-surface-variant">/projects/${escape(p.slug)}</span>
                    </div>
                  </td>
                  <td class="py-3.5 px-4 text-on-surface-variant font-medium">
                    ${escape(p.category_name || 'Unassigned')}
                  </td>
                  <td class="py-3.5 px-4">
                    <button class="toggle-status-btn px-2.5 py-1 rounded text-xs font-label-caps font-semibold cursor-pointer ${p.status === 'published' ? 'bg-green-950/40 text-green-400 border border-green-500/30' : 'bg-amber-950/40 text-amber-400 border border-amber-500/30'}" data-id="${p.id}">
                      ${escape(p.status.toUpperCase())}
                    </button>
                  </td>
                  <td class="py-3.5 px-4">
                    <button class="toggle-featured-btn px-2.5 py-1 rounded text-xs font-label-caps font-semibold cursor-pointer ${p.is_featured ? 'bg-on-tertiary-container/20 text-on-tertiary-container border border-on-tertiary-container/40' : 'bg-surface-container-highest text-on-surface-variant'}" data-id="${p.id}">
                      ${p.is_featured ? '★ YES' : '☆ NO'}
                    </button>
                  </td>
                  <td class="py-3.5 px-4 font-code-sm text-xs text-on-surface-variant">
                    ${p.display_order}
                  </td>
                  <td class="py-3.5 px-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <a href="/projects/${escape(p.slug)}" target="_blank" class="p-1.5 rounded hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface" title="View Public Page">
                        <span class="material-symbols-outlined text-lg">visibility</span>
                      </a>
                      <button class="edit-project-btn p-1.5 rounded hover:bg-on-tertiary-container/10 text-on-tertiary-container" data-id="${p.id}" title="Edit Project">
                        <span class="material-symbols-outlined text-lg">edit</span>
                      </button>
                      <button class="delete-project-btn p-1.5 rounded hover:bg-red-950/30 text-red-400" data-id="${p.id}" data-title="${escape(p.title)}" title="Delete Project">
                        <span class="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Bind Add Project
    const addBtn = document.getElementById('add-project-btn');
    if (addBtn) addBtn.onclick = () => openProjectModal();

    // Bind Edit Buttons
    document.querySelectorAll('.edit-project-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        openProjectModal(id);
      };
    });

    // Bind Toggle Status
    document.querySelectorAll('.toggle-status-btn').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        const res = await adminFetch(`/api/admin/projects/${id}/toggle-status`, { method: 'PATCH' });
        if (res && res.success) {
          renderProjectsTab(container);
        }
      };
    });

    // Bind Toggle Featured
    document.querySelectorAll('.toggle-featured-btn').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        const res = await adminFetch(`/api/admin/projects/${id}/toggle-featured`, { method: 'PATCH' });
        if (res && res.success) {
          renderProjectsTab(container);
        }
      };
    });

    // Bind Delete Buttons
    document.querySelectorAll('.delete-project-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        const title = btn.getAttribute('data-title');
        openDeleteModal(id, title, async () => {
          const res = await adminFetch(`/api/admin/projects/${id}`, { method: 'DELETE' });
          if (res && res.success) {
            closeModal();
            renderProjectsTab(container);
          }
        });
      };
    });
  }

  // -------------------------------------------------------------
  // MODAL: PROJECT EDITOR (CREATE & EDIT)
  // -------------------------------------------------------------
  async function openProjectModal(projectId = null) {
    const modal = document.getElementById('admin-modal');
    const modalBody = document.getElementById('admin-modal-body');
    if (!modal || !modalBody) return;

    // Ensure categories and technologies are loaded
    if (!adminState.categories || adminState.categories.length === 0 || !adminState.technologies || adminState.technologies.length === 0) {
      try {
        const [catRes, techRes] = await Promise.all([
          adminFetch('/api/admin/categories'),
          adminFetch('/api/admin/technologies')
        ]);
        if (catRes && Array.isArray(catRes.categories) && catRes.categories.length > 0) {
          adminState.categories = catRes.categories;
        }
        if (techRes && Array.isArray(techRes.technologies) && techRes.technologies.length > 0) {
          adminState.technologies = techRes.technologies;
        }
      } catch (e) {
        console.warn('[ADMIN NOTE] Fallback to default categories/technologies');
      }
    }

    const categoriesList = (adminState.categories && adminState.categories.length > 0)
      ? adminState.categories
      : [
          { id: 1, name: 'Business Systems', slug: 'business-systems' },
          { id: 2, name: 'POS & Hospitality', slug: 'pos-hospitality' },
          { id: 3, name: 'AI & Automation', slug: 'ai-automation' },
          { id: 4, name: 'Web Applications', slug: 'web-applications' },
          { id: 5, name: 'Inventory & ERP', slug: 'inventory-erp' }
        ];

    const technologiesList = (adminState.technologies && adminState.technologies.length > 0)
      ? adminState.technologies
      : [
          { id: 1, name: 'React', color: '#61DAFB' },
          { id: 2, name: 'Node.js', color: '#68A063' },
          { id: 3, name: 'MySQL', color: '#00758F' },
          { id: 4, name: 'PostgreSQL', color: '#336791' },
          { id: 5, name: 'Tailwind CSS', color: '#38BDF8' },
          { id: 6, name: 'Python & OpenCV', color: '#3776AB' },
          { id: 7, name: 'FastAPI', color: '#059669' },
          { id: 8, name: 'Docker', color: '#2496ED' },
          { id: 9, name: 'REST API', color: '#2674E7' }
        ];

    let project = {
      title: '',
      slug: '',
      category_id: '',
      short_description: '',
      full_description: '',
      problem: '',
      solution: '',
      results: '',
      workflow: '',
      client_type: 'Enterprise Custom',
      year: new Date().getFullYear().toString(),
      status: 'published',
      is_featured: 0,
      display_order: 0,
      thumbnail_url: '',
      hero_image_url: '',
      live_url: '',
      github_url: '',
      docs_url: '',
      seo_title: '',
      seo_description: '',
      seo_keywords: '',
      technology_ids: [],
      features: [],
      images: []
    };

    if (projectId) {
      modalBody.innerHTML = `<div class="py-12 text-center text-on-surface-variant">Loading project details...</div>`;
      modal.classList.remove('hidden');
      const res = await adminFetch(`/api/admin/projects/${projectId}`);
      if (res && res.project) {
        project = res.project;
      }
    }

    modalBody.innerHTML = `
      <div class="flex flex-col gap-6">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-outline-variant/30 pb-4">
          <h2 class="font-headline-md text-xl font-bold text-on-surface">
            ${projectId ? 'Edit Project' : 'Create New Project'}
          </h2>
          <button id="close-modal-btn" class="p-1 rounded hover:bg-surface-container-highest text-on-surface-variant">
            <span class="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        <div id="project-form-alert" class="hidden p-3.5 rounded text-xs"></div>

        <form id="project-editor-form" class="flex flex-col gap-6">
          <!-- Basic Info -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-on-surface-variant">PROJECT TITLE *</label>
              <input type="text" name="title" required value="${escape(project.title)}" placeholder="e.g. Zaitoon Restaurant Management System" class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none"/>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-on-surface-variant">SLUG (URL KEY)</label>
              <input type="text" name="slug" value="${escape(project.slug)}" placeholder="leave empty to auto-generate" class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none font-code-sm"/>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-on-surface-variant">CATEGORY</label>
              <select name="category_id" class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none">
                <option value="">-- Select Category --</option>
                ${categoriesList.map(c => `
                  <option value="${c.id}" ${project.category_id == c.id ? 'selected' : ''}>${escape(c.name)}</option>
                `).join('')}
              </select>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-on-surface-variant">STATUS</label>
              <select name="status" class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none">
                <option value="published" ${project.status === 'published' ? 'selected' : ''}>Published</option>
                <option value="draft" ${project.status === 'draft' ? 'selected' : ''}>Draft</option>
              </select>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-on-surface-variant">FEATURED SHOWCASE</label>
              <select name="is_featured" class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none">
                <option value="1" ${project.is_featured ? 'selected' : ''}>Featured (Homepage)</option>
                <option value="0" ${!project.is_featured ? 'selected' : ''}>Standard</option>
              </select>
            </div>
          </div>

          <!-- Descriptions -->
          <div class="flex flex-col gap-1.5">
            <label class="font-label-caps text-xs text-on-surface-variant">SHORT DESCRIPTION *</label>
            <textarea name="short_description" required rows="2" placeholder="Brief 1-2 sentence overview for cards and meta snippets..." class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none">${escape(project.short_description)}</textarea>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="font-label-caps text-xs text-on-surface-variant">FULL ARCHITECTURAL DESCRIPTION</label>
            <textarea name="full_description" rows="4" placeholder="Comprehensive project overview and system architecture description..." class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none">${escape(project.full_description)}</textarea>
          </div>

          <!-- Problem & Solution Deep Dive -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-red-400">PROBLEM STATEMENT</label>
              <textarea name="problem" rows="3" placeholder="What operational friction or business bottlenecks did this solve?" class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none">${escape(project.problem)}</textarea>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-on-tertiary-container">ENGINEERED SOLUTION</label>
              <textarea name="solution" rows="3" placeholder="How was the platform engineered to solve the problem?" class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none">${escape(project.solution)}</textarea>
            </div>
          </div>

          <!-- Results & Workflow -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-green-400">RESULTS &amp; METRIC IMPACT</label>
              <textarea name="results" rows="2" placeholder="e.g. 94% reduction in order latency, $12k monthly savings..." class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none">${escape(project.results)}</textarea>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-on-surface-variant">WORKFLOW LIFECYCLE</label>
              <input type="text" name="workflow" value="${escape(project.workflow)}" placeholder="1. Ingest -> 2. Process -> 3. Output" class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none font-code-sm"/>
            </div>
          </div>

          <!-- External Links -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-on-surface-variant">LIVE DEMO URL</label>
              <input type="url" name="live_url" value="${escape(project.live_url)}" placeholder="https://..." class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none font-code-sm"/>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-on-surface-variant">GITHUB / SOURCE URL</label>
              <input type="url" name="github_url" value="${escape(project.github_url)}" placeholder="https://github.com/..." class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none font-code-sm"/>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-on-surface-variant">DOCUMENTATION URL</label>
              <input type="url" name="docs_url" value="${escape(project.docs_url)}" placeholder="https://docs.wajidx.com/..." class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none font-code-sm"/>
            </div>
          </div>

          <!-- Media URLs -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-on-surface-variant">THUMBNAIL IMAGE URL</label>
              <div class="flex gap-2">
                <input type="text" id="proj-thumbnail-input" name="thumbnail_url" value="${escape(project.thumbnail_url)}" placeholder="https://... or /uploads/..." class="flex-1 bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none font-code-sm"/>
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-on-surface-variant">HERO BANNER IMAGE URL</label>
              <div class="flex gap-2">
                <input type="text" id="proj-hero-input" name="hero_image_url" value="${escape(project.hero_image_url)}" placeholder="https://... or /uploads/..." class="flex-1 bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none font-code-sm"/>
              </div>
            </div>
          </div>

          <!-- Technologies Selector -->
          <div class="flex flex-col gap-2">
            <label class="font-label-caps text-xs text-on-surface-variant">TECHNOLOGY STACK</label>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 p-3 rounded bg-surface-container-lowest border border-outline-variant/30 max-h-40 overflow-y-auto">
              ${technologiesList.map(t => {
                const checked = project.technology_ids && project.technology_ids.includes(t.id);
                return `
                  <label class="flex items-center gap-2 text-xs text-on-surface cursor-pointer select-none">
                    <input type="checkbox" name="tech_${t.id}" value="${t.id}" ${checked ? 'checked' : ''} class="rounded text-on-tertiary-container focus:ring-0"/>
                    <span class="truncate">${escape(t.name)}</span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>

          <!-- SEO Overrides -->
          <div class="border-t border-outline-variant/30 pt-4 flex flex-col gap-4">
            <span class="font-label-caps text-xs text-on-tertiary-container">SEO METADATA OVERRIDES</span>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="font-label-caps text-xs text-on-surface-variant">SEO TITLE</label>
                <input type="text" name="seo_title" value="${escape(project.seo_title)}" placeholder="Custom title tag..." class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none"/>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="font-label-caps text-xs text-on-surface-variant">SEO KEYWORDS</label>
                <input type="text" name="seo_keywords" value="${escape(project.seo_keywords)}" placeholder="comma, separated, keywords..." class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none"/>
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-on-surface-variant">SEO META DESCRIPTION</label>
              <textarea name="seo_description" rows="2" placeholder="Custom meta description for search engines..." class="w-full bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none">${escape(project.seo_description)}</textarea>
            </div>
          </div>

          <!-- Actions -->
          <div class="border-t border-outline-variant/30 pt-4 flex justify-end gap-3">
            <button type="button" id="cancel-project-btn" class="px-5 py-2.5 rounded border border-outline-variant/40 text-on-surface text-xs font-semibold hover:border-on-surface transition-colors">
              Cancel
            </button>
            <button type="submit" id="save-project-btn" class="bg-on-tertiary-container text-white px-6 py-2.5 rounded text-xs font-semibold hover:bg-opacity-90 transition-all glow-button flex items-center gap-2">
              <span>${projectId ? 'Save Changes' : 'Create Project'}</span>
              <span class="material-symbols-outlined text-sm">check</span>
            </button>
          </div>
        </form>
      </div>
    `;

    modal.classList.remove('hidden');

    const closeBtn = document.getElementById('close-modal-btn');
    const cancelBtn = document.getElementById('cancel-project-btn');
    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    // Handle Form Submit
    const form = document.getElementById('project-editor-form');
    const alertBox = document.getElementById('project-form-alert');
    const saveBtn = document.getElementById('save-project-btn');

    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span>Saving...</span><div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>`;

        const formData = new FormData(form);
        const selectedTechIds = [];
        technologiesList.forEach(t => {
          if (formData.get(`tech_${t.id}`)) {
            selectedTechIds.push(t.id);
          }
        });

        const payload = {
          title: formData.get('title'),
          slug: formData.get('slug'),
          category_id: formData.get('category_id') || null,
          short_description: formData.get('short_description'),
          full_description: formData.get('full_description'),
          problem: formData.get('problem'),
          solution: formData.get('solution'),
          results: formData.get('results'),
          workflow: formData.get('workflow'),
          status: formData.get('status'),
          is_featured: parseInt(formData.get('is_featured') || '0', 10),
          thumbnail_url: formData.get('thumbnail_url'),
          hero_image_url: formData.get('hero_image_url'),
          live_url: formData.get('live_url'),
          github_url: formData.get('github_url'),
          docs_url: formData.get('docs_url'),
          seo_title: formData.get('seo_title'),
          seo_description: formData.get('seo_description'),
          seo_keywords: formData.get('seo_keywords'),
          technology_ids: selectedTechIds,
          features: project.features || [],
          images: project.images || []
        };

        const endpoint = projectId ? `/api/admin/projects/${projectId}` : '/api/admin/projects';
        const method = projectId ? 'PUT' : 'POST';

        const res = await adminFetch(endpoint, {
          method,
          body: JSON.stringify(payload)
        });

        if (res && res.success) {
          closeModal();
          const tabContainer = document.getElementById('admin-tab-container');
          if (tabContainer) {
            if (adminState.currentTab === 'dashboard') {
              renderDashboardTab(tabContainer);
            } else {
              renderProjectsTab(tabContainer);
            }
          }
        } else {
          alertBox.className = 'p-3.5 rounded text-xs bg-red-950/50 border border-red-500/40 text-red-300';
          alertBox.textContent = res?.error || 'Failed to save project. Ensure database is connected.';
          alertBox.classList.remove('hidden');
          saveBtn.disabled = false;
          saveBtn.innerHTML = `<span>Save</span>`;
        }
      };
    }
  }

  // -------------------------------------------------------------
  // TAB: CATEGORIES MANAGER
  // -------------------------------------------------------------
  async function renderCategoriesTab(container) {
    container.innerHTML = `<div class="py-12 text-center text-on-surface-variant">Loading categories...</div>`;
    const res = await adminFetch('/api/admin/categories');
    if (!res || !res.categories) {
      container.innerHTML = `<div class="p-6 rounded bg-red-950/20 text-red-400">Failed to load categories.</div>`;
      return;
    }

    adminState.categories = res.categories;

    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in-up">
        <!-- Categories List -->
        <div class="lg:col-span-8 flex flex-col gap-4">
          <div class="rounded-xl border border-outline-variant/30 bg-surface-container-low overflow-hidden admin-table-container">
            <table class="w-full text-left border-collapse text-sm">
              <thead>
                <tr class="border-b border-outline-variant/30 bg-surface-container-highest/60 text-on-surface-variant font-label-caps text-xs">
                  <th class="py-3 px-4">Name &amp; Slug</th>
                  <th class="py-3 px-4">Projects</th>
                  <th class="py-3 px-4">Order</th>
                  <th class="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-outline-variant/20">
                ${adminState.categories.map(c => `
                  <tr class="hover:bg-surface-container-highest/30">
                    <td class="py-3 px-4">
                      <div class="flex flex-col">
                        <span class="font-bold text-on-surface">${escape(c.name)}</span>
                        <span class="font-code-sm text-xs text-on-surface-variant">${escape(c.slug)}</span>
                      </div>
                    </td>
                    <td class="py-3 px-4 font-code-sm text-xs text-on-surface-variant">
                      ${c.project_count || 0}
                    </td>
                    <td class="py-3 px-4 font-code-sm text-xs text-on-surface-variant">
                      ${c.display_order}
                    </td>
                    <td class="py-3 px-4 text-right">
                      <button class="delete-cat-btn p-1.5 rounded hover:bg-red-950/30 text-red-400" data-id="${c.id}" data-name="${escape(c.name)}">
                        <span class="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Add Category Form -->
        <div class="lg:col-span-4 p-6 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-4 h-fit">
          <h3 class="font-headline-md text-lg font-bold text-on-surface">Add Category</h3>
          <form id="add-cat-form" class="flex flex-col gap-3.5">
            <div class="flex flex-col gap-1">
              <label class="font-label-caps text-xs text-on-surface-variant">NAME *</label>
              <input type="text" name="name" required placeholder="e.g. AI & Automation" class="bg-surface-container-lowest border border-outline-variant/40 rounded px-3 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none"/>
            </div>

            <div class="flex flex-col gap-1">
              <label class="font-label-caps text-xs text-on-surface-variant">SLUG (OPTIONAL)</label>
              <input type="text" name="slug" placeholder="e.g. ai-automation" class="bg-surface-container-lowest border border-outline-variant/40 rounded px-3 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none font-code-sm"/>
            </div>

            <div class="flex flex-col gap-1">
              <label class="font-label-caps text-xs text-on-surface-variant">DISPLAY ORDER</label>
              <input type="number" name="display_order" value="0" class="bg-surface-container-lowest border border-outline-variant/40 rounded px-3 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none"/>
            </div>

            <button type="submit" class="mt-2 bg-on-tertiary-container text-white py-2.5 rounded font-semibold text-xs hover:bg-opacity-90 transition-all glow-button">
              Add Category
            </button>
          </form>
        </div>
      </div>
    `;

    // Bind Add Category
    const catForm = document.getElementById('add-cat-form');
    if (catForm) {
      catForm.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(catForm);
        const res = await adminFetch('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify({
            name: fd.get('name'),
            slug: fd.get('slug'),
            display_order: parseInt(fd.get('display_order') || '0', 10)
          })
        });
        if (res && res.success) {
          renderCategoriesTab(container);
        }
      };
    }

    // Bind Delete Category
    document.querySelectorAll('.delete-cat-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        openDeleteModal(id, `Category: ${name}`, async () => {
          const res = await adminFetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
          if (res && res.success) {
            closeModal();
            renderCategoriesTab(container);
          }
        });
      };
    });
  }

  // -------------------------------------------------------------
  // TAB: TECHNOLOGIES MANAGER
  // -------------------------------------------------------------
  async function renderTechnologiesTab(container) {
    container.innerHTML = `<div class="py-12 text-center text-on-surface-variant">Loading tech stack...</div>`;
    const res = await adminFetch('/api/admin/technologies');
    if (!res || !res.technologies) {
      container.innerHTML = `<div class="p-6 rounded bg-red-950/20 text-red-400">Failed to load technologies.</div>`;
      return;
    }

    adminState.technologies = res.technologies;

    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in-up">
        <!-- Tech List -->
        <div class="lg:col-span-8 flex flex-col gap-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            ${adminState.technologies.map(t => `
              <div class="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between glow-card">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded flex items-center justify-center text-white" style="background-color: ${escape(t.color || '#2674e7')}">
                    <span class="material-symbols-outlined text-base">${escape(t.icon || 'code')}</span>
                  </div>
                  <div class="flex flex-col">
                    <span class="font-bold text-sm text-on-surface">${escape(t.name)}</span>
                    <span class="text-[11px] text-on-surface-variant font-label-caps">${escape(t.category || 'General')}</span>
                  </div>
                </div>
                <button class="delete-tech-btn p-1.5 rounded hover:bg-red-950/30 text-red-400" data-id="${t.id}" data-name="${escape(t.name)}">
                  <span class="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Add Tech Form -->
        <div class="lg:col-span-4 p-6 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-4 h-fit">
          <h3 class="font-headline-md text-lg font-bold text-on-surface">Add Technology</h3>
          <form id="add-tech-form" class="flex flex-col gap-3.5">
            <div class="flex flex-col gap-1">
              <label class="font-label-caps text-xs text-on-surface-variant">NAME *</label>
              <input type="text" name="name" required placeholder="e.g. FastAPI" class="bg-surface-container-lowest border border-outline-variant/40 rounded px-3 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none"/>
            </div>

            <div class="flex flex-col gap-1">
              <label class="font-label-caps text-xs text-on-surface-variant">CATEGORY</label>
              <input type="text" name="category" placeholder="e.g. Backend / AI" class="bg-surface-container-lowest border border-outline-variant/40 rounded px-3 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none"/>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="font-label-caps text-xs text-on-surface-variant">COLOR</label>
                <input type="color" name="color" value="#2674e7" class="w-full h-9 bg-surface-container-lowest border border-outline-variant/40 rounded p-1 cursor-pointer"/>
              </div>
              <div class="flex flex-col gap-1">
                <label class="font-label-caps text-xs text-on-surface-variant">ICON NAME</label>
                <input type="text" name="icon" value="code" placeholder="code, database..." class="bg-surface-container-lowest border border-outline-variant/40 rounded px-3 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none font-code-sm"/>
              </div>
            </div>

            <button type="submit" class="mt-2 bg-on-tertiary-container text-white py-2.5 rounded font-semibold text-xs hover:bg-opacity-90 transition-all glow-button">
              Add Technology
            </button>
          </form>
        </div>
      </div>
    `;

    // Bind Add Tech
    const techForm = document.getElementById('add-tech-form');
    if (techForm) {
      techForm.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(techForm);
        const res = await adminFetch('/api/admin/technologies', {
          method: 'POST',
          body: JSON.stringify({
            name: fd.get('name'),
            category: fd.get('category'),
            color: fd.get('color'),
            icon: fd.get('icon')
          })
        });
        if (res && res.success) {
          renderTechnologiesTab(container);
        }
      };
    }

    // Bind Delete Tech
    document.querySelectorAll('.delete-tech-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        openDeleteModal(id, `Technology: ${name}`, async () => {
          const res = await adminFetch(`/api/admin/technologies/${id}`, { method: 'DELETE' });
          if (res && res.success) {
            closeModal();
            renderTechnologiesTab(container);
          }
        });
      };
    });
  }

  // -------------------------------------------------------------
  // TAB: MEDIA & ASSET LIBRARY
  // -------------------------------------------------------------
  function renderMediaTab(container) {
    container.innerHTML = `
      <div class="flex flex-col gap-8 animate-fade-in-up">
        <!-- Upload Dropzone -->
        <div class="p-10 rounded-xl bg-surface-container-low border-2 border-dashed border-outline-variant/40 flex flex-col items-center justify-center text-center gap-4 hover:border-on-tertiary-container transition-colors cursor-pointer" id="media-dropzone">
          <input type="file" id="media-file-input" accept="image/*" class="hidden"/>
          <div class="w-16 h-16 rounded-full bg-on-tertiary-container/10 border border-on-tertiary-container/30 flex items-center justify-center text-on-tertiary-container">
            <span class="material-symbols-outlined text-3xl">cloud_upload</span>
          </div>
          <div>
            <h3 class="font-headline-md text-lg font-bold text-on-surface">Upload Project Screenshot or Asset</h3>
            <p class="text-xs text-on-surface-variant mt-1">Supports PNG, JPG, WebP, SVG up to 10MB.</p>
          </div>
          <button id="media-browse-btn" class="bg-on-tertiary-container text-white px-6 py-2.5 rounded font-semibold text-xs hover:bg-opacity-90 transition-all glow-button">
            Browse Files
          </button>
        </div>

        <div id="media-upload-status" class="hidden p-4 rounded text-xs"></div>

        <!-- Recent Uploads / Instructions -->
        <div class="p-6 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3">
          <h4 class="font-headline-md text-base font-bold text-on-surface">Media Integration Guide</h4>
          <p class="text-xs text-on-surface-variant leading-relaxed">
            Uploaded images are stored in <code class="font-code-sm text-on-tertiary-container">/public/uploads/</code> and accessible globally at <code class="font-code-sm text-on-tertiary-container">/uploads/filename.ext</code>. Once uploaded, copy the URL and paste it into the Project Thumbnail or Hero Image field.
          </p>
        </div>
      </div>
    `;

    const dropzone = document.getElementById('media-dropzone');
    const fileInput = document.getElementById('media-file-input');
    const browseBtn = document.getElementById('media-browse-btn');
    const statusBox = document.getElementById('media-upload-status');

    if (browseBtn && fileInput) {
      browseBtn.onclick = (e) => {
        e.stopPropagation();
        fileInput.click();
      };
      dropzone.onclick = () => fileInput.click();
    }

    if (fileInput) {
      fileInput.onchange = async () => {
        if (!fileInput.files || fileInput.files.length === 0) return;
        const file = fileInput.files[0];
        const fd = new FormData();
        fd.append('image', file);

        statusBox.className = 'p-4 rounded text-xs bg-on-tertiary-container/20 border border-on-tertiary-container text-on-tertiary-container';
        statusBox.textContent = `Uploading ${file.name}...`;
        statusBox.classList.remove('hidden');

        const res = await adminFetch('/api/admin/upload', {
          method: 'POST',
          body: fd
        });

        if (res && res.success && res.file) {
          statusBox.className = 'p-4 rounded text-xs bg-green-950/40 border border-green-500/40 text-green-300';
          statusBox.innerHTML = `
            <div class="flex flex-col gap-2">
              <span>✓ Uploaded: <strong>${escape(res.file.originalName)}</strong></span>
              <div class="flex items-center gap-2">
                <input type="text" readonly value="${window.location.origin}${escape(res.file.url)}" class="w-full bg-surface-container-lowest border border-outline-variant/30 rounded px-2.5 py-1 text-xs font-code-sm text-on-surface"/>
                <button onclick="navigator.clipboard.writeText('${window.location.origin}${escape(res.file.url)}'); alert('Copied URL to clipboard!');" class="px-3 py-1 bg-on-tertiary-container text-white rounded text-xs font-semibold whitespace-nowrap">
                  Copy URL
                </button>
              </div>
            </div>
          `;
        } else {
          statusBox.className = 'p-4 rounded text-xs bg-red-950/40 border border-red-500/40 text-red-300';
          statusBox.textContent = res?.error || 'Failed to upload image.';
        }
      };
    }
  }

  // -------------------------------------------------------------
  // TAB: CONTACT INQUIRIES INBOX
  // -------------------------------------------------------------
  async function renderMessagesTab(container) {
    container.innerHTML = `<div class="py-12 text-center text-on-surface-variant">Loading inbox...</div>`;
    const res = await adminFetch('/api/admin/messages');
    if (!res || !res.messages) {
      container.innerHTML = `<div class="p-6 rounded bg-red-950/20 text-red-400">Failed to load messages.</div>`;
      return;
    }

    adminState.messages = res.messages;

    container.innerHTML = `
      <div class="flex flex-col gap-6 animate-fade-in-up">
        <div class="flex items-center justify-between">
          <span class="font-label-caps text-xs text-on-surface-variant">${adminState.messages.length} Inquiries Received</span>
        </div>

        <div class="flex flex-col gap-4">
          ${adminState.messages.map(m => `
            <div class="p-6 rounded-xl bg-surface-container-low border ${m.is_read ? 'border-outline-variant/30' : 'border-on-tertiary-container/50 bg-on-tertiary-container/5'} flex flex-col gap-3">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/20 pb-3">
                <div class="flex items-center gap-2">
                  ${!m.is_read ? '<span class="w-2 h-2 rounded-full bg-on-tertiary-container"></span>' : ''}
                  <span class="font-bold text-on-surface text-base">${escape(m.name)}</span>
                  <a href="mailto:${escape(m.email)}" class="text-xs text-on-tertiary-container hover:underline font-code-sm">&lt;${escape(m.email)}&gt;</a>
                </div>
                <span class="font-code-sm text-xs text-on-surface-variant">
                  ${new Date(m.created_at).toLocaleString()}
                </span>
              </div>

              <div class="font-semibold text-sm text-on-surface">${escape(m.subject || 'Project Inquiry')}</div>
              <p class="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">${escape(m.message)}</p>

              <div class="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/20 text-xs">
                ${!m.is_read ? `
                  <button class="mark-read-btn text-on-tertiary-container hover:underline font-semibold" data-id="${m.id}">
                    Mark as Read
                  </button>
                ` : ''}
                <a href="mailto:${escape(m.email)}?subject=Re: ${encodeURIComponent(m.subject || 'WAJIDX Inquiry')}" class="bg-on-tertiary-container text-white px-3.5 py-1.5 rounded font-semibold hover:bg-opacity-90 flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">reply</span> Reply Email
                </a>
                <button class="delete-msg-btn text-red-400 hover:text-red-300 p-1" data-id="${m.id}">
                  <span class="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>
          `).join('')}

          ${adminState.messages.length === 0 ? '<div class="p-12 text-center text-on-surface-variant bg-surface-container-low rounded-xl">Inbox is clean. No inquiries received yet.</div>' : ''}
        </div>
      </div>
    `;

    // Bind Mark Read
    document.querySelectorAll('.mark-read-btn').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        const res = await adminFetch(`/api/admin/messages/${id}/read`, { method: 'PATCH' });
        if (res && res.success) {
          renderMessagesTab(container);
        }
      };
    });

    // Bind Delete
    document.querySelectorAll('.delete-msg-btn').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        const res = await adminFetch(`/api/admin/messages/${id}`, { method: 'DELETE' });
        if (res && res.success) {
          renderMessagesTab(container);
        }
      };
    });
  }

  // -------------------------------------------------------------
  // TAB: SITE & SEO SETTINGS
  // -------------------------------------------------------------
  async function renderSettingsTab(container) {
    container.innerHTML = `<div class="py-12 text-center text-on-surface-variant">Loading configuration...</div>`;
    const res = await adminFetch('/api/admin/settings');
    if (!res || !res.settings) {
      container.innerHTML = `<div class="p-6 rounded bg-red-950/20 text-red-400">Failed to load settings.</div>`;
      return;
    }

    const s = res.settings;
    adminState.settings = s;

    container.innerHTML = `
      <div class="max-w-4xl flex flex-col gap-8 animate-fade-in-up">
        <div id="settings-alert" class="hidden p-4 rounded text-xs"></div>

        <form id="settings-form" class="flex flex-col gap-8">
          <!-- Branding Section -->
          <div class="p-6 md:p-8 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-4">
            <h3 class="font-headline-md text-lg font-bold text-on-surface border-b border-outline-variant/20 pb-3">
              Brand Identity
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="font-label-caps text-xs text-on-surface-variant">BRAND NAME</label>
                <input type="text" name="site_brand_name" value="${escape(s.site_brand_name || 'WAJIDX')}" class="bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none"/>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="font-label-caps text-xs text-on-surface-variant">TAGLINE</label>
                <input type="text" name="site_tagline" value="${escape(s.site_tagline || 'Build. Automate. Innovate.')}" class="bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none"/>
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-on-surface-variant">BRAND DESCRIPTION</label>
              <textarea name="site_description" rows="2" class="bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none">${escape(s.site_description)}</textarea>
            </div>
          </div>

          <!-- Contact & Social -->
          <div class="p-6 md:p-8 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-4">
            <h3 class="font-headline-md text-lg font-bold text-on-surface border-b border-outline-variant/20 pb-3">
              Contact &amp; Social Links
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="font-label-caps text-xs text-on-surface-variant">EMAIL ADDRESS</label>
                <input type="email" name="contact_email" value="${escape(s.contact_email)}" class="bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none"/>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="font-label-caps text-xs text-on-surface-variant">PHONE</label>
                <input type="text" name="contact_phone" value="${escape(s.contact_phone)}" class="bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none"/>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="font-label-caps text-xs text-on-surface-variant">LOCATION</label>
                <input type="text" name="contact_address" value="${escape(s.contact_address)}" class="bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none"/>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="font-label-caps text-xs text-on-surface-variant">LINKEDIN URL</label>
                <input type="url" name="social_linkedin" value="${escape(s.social_linkedin)}" placeholder="https://linkedin.com/..." class="bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none font-code-sm"/>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="font-label-caps text-xs text-on-surface-variant">GITHUB URL</label>
                <input type="url" name="social_github" value="${escape(s.social_github)}" placeholder="https://github.com/..." class="bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none font-code-sm"/>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="font-label-caps text-xs text-on-surface-variant">X / TWITTER URL</label>
                <input type="url" name="social_twitter" value="${escape(s.social_twitter)}" placeholder="https://x.com/..." class="bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none font-code-sm"/>
              </div>
            </div>
          </div>

          <!-- SEO Defaults & Footer -->
          <div class="p-6 md:p-8 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-4">
            <h3 class="font-headline-md text-lg font-bold text-on-surface border-b border-outline-variant/20 pb-3">
              SEO Engine Defaults
            </h3>

            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-on-surface-variant">GLOBAL DEFAULT TITLE</label>
              <input type="text" name="seo_default_title" value="${escape(s.seo_default_title)}" class="bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none"/>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-on-surface-variant">GLOBAL DEFAULT DESCRIPTION</label>
              <textarea name="seo_default_description" rows="2" class="bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none">${escape(s.seo_default_description)}</textarea>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="font-label-caps text-xs text-on-surface-variant">FOOTER COPY</label>
              <input type="text" name="footer_text" value="${escape(s.footer_text)}" class="bg-surface-container-lowest border border-outline-variant/40 rounded px-3.5 py-2 text-sm text-on-surface focus:border-on-tertiary-container focus:outline-none"/>
            </div>
          </div>

          <button type="submit" id="save-settings-btn" class="bg-on-tertiary-container text-white py-3.5 rounded font-semibold text-sm hover:bg-opacity-90 transition-all glow-button flex items-center justify-center gap-2 self-end px-8">
            <span>Save All Settings</span>
            <span class="material-symbols-outlined text-base">check</span>
          </button>
        </form>
      </div>
    `;

    const form = document.getElementById('settings-form');
    const alertBox = document.getElementById('settings-alert');
    const saveBtn = document.getElementById('save-settings-btn');

    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span>Saving...</span>`;

        const fd = new FormData(form);
        const settingsObj = {};
        for (const [key, val] of fd.entries()) {
          settingsObj[key] = val;
        }

        const res = await adminFetch('/api/admin/settings', {
          method: 'PUT',
          body: JSON.stringify({ settings: settingsObj })
        });

        if (res && res.success) {
          alertBox.className = 'p-3.5 rounded text-xs bg-green-950/40 border border-green-500/40 text-green-300';
          alertBox.textContent = 'Site settings updated successfully.';
          alertBox.classList.remove('hidden');
        } else {
          alertBox.className = 'p-3.5 rounded text-xs bg-red-950/40 border border-red-500/40 text-red-300';
          alertBox.textContent = res?.error || 'Failed to update settings.';
          alertBox.classList.remove('hidden');
        }

        saveBtn.disabled = false;
        saveBtn.innerHTML = `<span>Save All Settings</span><span class="material-symbols-outlined text-base">check</span>`;
      };
    }
  }

  // -------------------------------------------------------------
  // MODAL UTILITIES
  // -------------------------------------------------------------
  function closeModal() {
    const modal = document.getElementById('admin-modal');
    if (modal) modal.classList.add('hidden');
  }

  function openDeleteModal(id, title, onConfirm) {
    const modal = document.getElementById('admin-modal');
    const modalBody = document.getElementById('admin-modal-body');
    if (!modal || !modalBody) return;

    modalBody.innerHTML = `
      <div class="flex flex-col gap-6 text-center items-center">
        <div class="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
          <span class="material-symbols-outlined text-3xl">warning</span>
        </div>

        <div>
          <h3 class="font-headline-md text-xl font-bold text-on-surface mb-2">Confirm Deletion</h3>
          <p class="text-xs text-on-surface-variant max-w-sm">
            Are you sure you want to permanently delete <strong>${escape(title)}</strong>? This action cannot be undone.
          </p>
        </div>

        <div class="flex gap-3 w-full justify-center">
          <button id="cancel-del-btn" class="px-5 py-2.5 rounded border border-outline-variant/40 text-on-surface text-xs font-semibold hover:border-on-surface transition-colors">
            Cancel
          </button>
          <button id="confirm-del-btn" class="bg-red-600 text-white px-6 py-2.5 rounded text-xs font-semibold hover:bg-red-700 transition-colors">
            Confirm Delete
          </button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');

    const cancelBtn = document.getElementById('cancel-del-btn');
    const confirmBtn = document.getElementById('confirm-del-btn');
    if (cancelBtn) cancelBtn.onclick = closeModal;
    if (confirmBtn) confirmBtn.onclick = onConfirm;
  }

  // Export to window
  window.wajidxAdmin = {
    init: initAdminApp,
    switchTab: switchAdminTab,
    openProjectModal
  };

  window.initAdminApp = initAdminApp;
})();
