// Target DB switch for the admin dashboard.
//
// Backend supports dual-DB routing (prod + staging) on a single Cloud Run
// service by reading the `X-PlayPal-DB: staging` request header
// (see backend/server.js + backend/src/services/pureDataService.js).
//
// This module:
//   1. Persists the admin's chosen target DB in localStorage
//      (key: "playpal_admin_db_target", values: "prod" | "staging").
//   2. Monkey-patches window.fetch so every request to the configured admin
//      API base URL automatically carries `X-PlayPal-DB: staging` when the
//      target is staging. This means every existing fetch call in
//      js/*.js benefits without per-call changes.
//   3. Auto-injects a toggle + visible indicator into `.header-actions` on
//      authenticated pages (gracefully no-op if the container is missing,
//      e.g. on login/signup).
//
// The toggle has no effect unless the backend is running in NODE_ENV=production
// with both DATABASE_URL and DATABASE_URL_STAGING configured (only then does
// the server hold two Prisma clients and honor the header). In LOCAL / NGROK
// modes the header is silently ignored.

(function () {
    const STORAGE_KEY = 'playpal_admin_db_target';
    const HEADER_NAME = 'X-PlayPal-DB';
    const STAGING_VALUE = 'staging';
    const LISTENERS = new Set();

    function readStoredTarget() {
        try {
            const v = localStorage.getItem(STORAGE_KEY);
            return v === 'staging' ? 'staging' : 'prod';
        } catch {
            return 'prod';
        }
    }

    function writeStoredTarget(t) {
        try {
            localStorage.setItem(STORAGE_KEY, t === 'staging' ? 'staging' : 'prod');
        } catch {
            // private mode / quota — ignore
        }
    }

    const DbTarget = {
        get() {
            return readStoredTarget();
        },
        set(t) {
            const next = t === 'staging' ? 'staging' : 'prod';
            const prev = readStoredTarget();
            if (prev === next) return;
            writeStoredTarget(next);
            LISTENERS.forEach((fn) => {
                try { fn(next, prev); } catch (err) { console.error(err); }
            });
            syncIndicatorFromState();
        },
        isStaging() {
            return readStoredTarget() === 'staging';
        },
        header() {
            return this.isStaging() ? { [HEADER_NAME]: STAGING_VALUE } : {};
        },
        onChange(fn) {
            LISTENERS.add(fn);
            return () => LISTENERS.delete(fn);
        },
    };

    window.DbTarget = DbTarget;

    // =====================================================================
    // Fetch monkey-patch
    // =====================================================================
    // We only inject the header on admin API calls (URL starts with the
    // configured API base URL). Other requests (e.g. to ngrok warning pages
    // or static assets) are left alone.
    function apiBaseForMatching() {
        // Strip trailing /api so we match both absolute and relative paths later.
        const base = (window.NetworkConfig && window.NetworkConfig.API_BASE_URL) || '';
        return base.replace(/\/api\/?$/, '');
    }

    function urlMatchesApi(input) {
        if (!input) return false;
        const base = apiBaseForMatching();
        const urlString = typeof input === 'string'
            ? input
            : (input && input.url) || '';
        if (!urlString) return false;
        // Absolute URL against configured base
        if (base && urlString.startsWith(base)) return true;
        // Any absolute URL containing "/api/" pointing to our backend host
        try {
            const u = new URL(urlString, window.location.href);
            if (u.pathname.startsWith('/api/')) return true;
        } catch {
            // relative path like "/api/..."
            if (urlString.startsWith('/api/')) return true;
        }
        return false;
    }

    const originalFetch = window.fetch.bind(window);
    window.fetch = function patchedFetch(input, init) {
        if (!DbTarget.isStaging() || !urlMatchesApi(input)) {
            return originalFetch(input, init);
        }

        const nextInit = Object.assign({}, init || {});
        const existingHeaders = (init && init.headers) || (input && input.headers) || {};

        let headers;
        if (existingHeaders instanceof Headers) {
            headers = new Headers(existingHeaders);
            headers.set(HEADER_NAME, STAGING_VALUE);
        } else if (Array.isArray(existingHeaders)) {
            headers = existingHeaders.filter(([k]) => k.toLowerCase() !== HEADER_NAME.toLowerCase());
            headers.push([HEADER_NAME, STAGING_VALUE]);
        } else {
            headers = Object.assign({}, existingHeaders);
            // Remove any case variants of the header first.
            Object.keys(headers).forEach((k) => {
                if (k.toLowerCase() === HEADER_NAME.toLowerCase()) delete headers[k];
            });
            headers[HEADER_NAME] = STAGING_VALUE;
        }
        nextInit.headers = headers;

        return originalFetch(input, nextInit);
    };

    // =====================================================================
    // UI: toggle + persistent indicator banner
    // =====================================================================
    const STYLE_ID = 'db-target-styles';
    const INDICATOR_ID = 'db-target-indicator';
    const SWITCH_ID = 'db-target-switch';

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .db-target-switch {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.3rem 0.6rem;
                margin-right: 0.75rem;
                border: 1px solid var(--color-border, #e1e5e9);
                border-radius: 999px;
                background: var(--color-surface, #ffffff);
                font-size: 0.85rem;
                line-height: 1;
                color: var(--color-text, #121212);
                user-select: none;
            }
            .db-target-switch[data-target="staging"] {
                border-color: #b45309;
                background: #fff7ed;
                color: #7c2d12;
                box-shadow: inset 0 0 0 1px #fdba74;
            }
            .db-target-switch label {
                font-weight: 600;
                letter-spacing: 0.02em;
                cursor: pointer;
            }
            .db-target-switch select {
                padding: 0.2rem 0.4rem;
                border: 1px solid var(--color-border, #e1e5e9);
                border-radius: 6px;
                background: var(--color-surface, #ffffff);
                color: var(--color-text, #121212);
                font-size: 0.85rem;
                cursor: pointer;
            }
            .db-target-switch[data-target="staging"] select {
                border-color: #fdba74;
                background: #ffffff;
                color: #7c2d12;
            }
            #db-target-indicator {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 9999;
                background: linear-gradient(90deg, #ea580c, #f59e0b);
                color: #ffffff;
                text-align: center;
                font-size: 0.8rem;
                font-weight: 600;
                letter-spacing: 0.05em;
                padding: 0.25rem 0.5rem;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
            }
            body.db-target-staging {
                padding-top: 22px;
            }
        `;
        document.head.appendChild(style);
    }

    function renderSwitchInto(container) {
        if (!container || container.querySelector('.db-target-switch')) return;
        const current = DbTarget.get();
        const wrapper = document.createElement('span');
        wrapper.className = 'db-target-switch';
        wrapper.id = SWITCH_ID;
        wrapper.dataset.target = current;
        wrapper.title = 'Target database for admin reads and writes';

        const label = document.createElement('label');
        label.htmlFor = SWITCH_ID + '-select';
        label.textContent = 'DB';

        const select = document.createElement('select');
        select.id = SWITCH_ID + '-select';
        select.innerHTML = `
            <option value="prod">Prod</option>
            <option value="staging">Staging</option>
        `;
        select.value = current;
        select.addEventListener('change', (e) => {
            DbTarget.set(e.target.value);
        });

        wrapper.appendChild(label);
        wrapper.appendChild(select);

        // Insert as the first element so it sits to the left of Logout etc.
        container.insertBefore(wrapper, container.firstChild);
    }

    function ensureBanner() {
        if (!DbTarget.isStaging()) {
            document.body?.classList.remove('db-target-staging');
            const existing = document.getElementById(INDICATOR_ID);
            if (existing) existing.remove();
            return;
        }
        document.body?.classList.add('db-target-staging');
        if (document.getElementById(INDICATOR_ID)) return;
        const bar = document.createElement('div');
        bar.id = INDICATOR_ID;
        bar.textContent = 'STAGING DB — all reads and writes are routed to the staging database';
        document.body?.prepend(bar);
    }

    function syncIndicatorFromState() {
        const current = DbTarget.get();
        const wrapper = document.getElementById(SWITCH_ID);
        if (wrapper) {
            wrapper.dataset.target = current;
            const select = document.getElementById(SWITCH_ID + '-select');
            if (select && select.value !== current) select.value = current;
        }
        ensureBanner();
    }

    function injectUI() {
        ensureStyles();
        const headerActions = document.querySelector('.header-actions');
        if (headerActions) renderSwitchInto(headerActions);
        ensureBanner();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectUI);
    } else {
        injectUI();
    }

    // Re-render across tabs when localStorage changes (e.g. toggle on another tab).
    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) syncIndicatorFromState();
    });

    // Log current state so it shows up in the same console block as NetworkConfig.
    console.log(`🎯 [Admin] DB target: ${DbTarget.get().toUpperCase()}`
        + (DbTarget.isStaging() ? ' (X-PlayPal-DB: staging)' : ''));
})();
