function getApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || "http://localhost:3000/api";
}

function getToken() {
    return localStorage.getItem("adminToken");
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str ?? "");
    return div.innerHTML;
}

function showError(msg) {
    const el = document.getElementById("error-message");
    if (!el) return;
    if (msg) {
        el.textContent = msg;
        el.style.display = "block";
    } else {
        el.style.display = "none";
    }
}

function fmtWhen(v) {
    if (!v) return "—";
    try {
        return new Date(v).toLocaleString();
    } catch (_) {
        return String(v);
    }
}

const STATE = {
    search: "",
    page: 1,
    limit: 50,
    total: 0,
};

async function adminFetch(path) {
    const token = getToken();
    const url = `${getApiBaseUrl()}${path}`;
    const response = await fetch(url, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
        throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
    }
    return data;
}

function setLoading(on) {
    const loading = document.getElementById("loading");
    const wrap = document.getElementById("table-wrap");
    if (loading) loading.style.display = on ? "block" : "none";
    if (wrap && on) wrap.style.display = "none";
}

function renderRows(users) {
    const body = document.getElementById("results-body");
    const wrap = document.getElementById("table-wrap");
    if (!body || !wrap) return;

    if (!users.length) {
        body.innerHTML = "";
        wrap.style.display = "none";
        return;
    }

    body.innerHTML = users
        .map((u) => {
            const has = !!u.hasDeviceToken;
            const tokenLabel = has
                ? `Yes${u.deviceTokenCount > 1 ? ` (${u.deviceTokenCount})` : ""}`
                : "No";
            const tokenClass = has ? "pill-yes" : "pill-no";
            return `<tr class="${has ? "" : "no-token"}">
                <td>${escapeHtml(u.name || "—")}</td>
                <td>@${escapeHtml(u.username || "—")}</td>
                <td>${escapeHtml(u.email || "—")}</td>
                <td><span class="pill ${tokenClass}">${escapeHtml(tokenLabel)}</span></td>
                <td>${escapeHtml(fmtWhen(u.lastActiveAt))}</td>
            </tr>`;
        })
        .join("");
    wrap.style.display = "block";
}

function renderMeta() {
    const meta = document.getElementById("meta");
    if (!meta) return;
    if (!STATE.search) {
        meta.textContent = "Type a name and search.";
        return;
    }
    const from = STATE.total === 0 ? 0 : (STATE.page - 1) * STATE.limit + 1;
    const to = Math.min(STATE.page * STATE.limit, STATE.total);
    meta.textContent = `Showing ${from}–${to} of ${STATE.total} for “${STATE.search}”`;
}

function renderPagination() {
    const el = document.getElementById("pagination");
    if (!el) return;
    const totalPages = Math.max(1, Math.ceil(STATE.total / STATE.limit));
    if (!STATE.search || STATE.total <= STATE.limit) {
        el.style.display = "none";
        el.innerHTML = "";
        return;
    }
    el.style.display = "flex";
    el.innerHTML = `
        <button class="btn btn-secondary" type="button" id="prev-page" ${STATE.page <= 1 ? "disabled" : ""}>Prev</button>
        <span class="muted">Page ${STATE.page} / ${totalPages}</span>
        <button class="btn btn-secondary" type="button" id="next-page" ${STATE.page >= totalPages ? "disabled" : ""}>Next</button>
    `;
    document.getElementById("prev-page")?.addEventListener("click", () => {
        if (STATE.page > 1) {
            STATE.page -= 1;
            runSearch({ keepPage: true });
        }
    });
    document.getElementById("next-page")?.addEventListener("click", () => {
        if (STATE.page < totalPages) {
            STATE.page += 1;
            runSearch({ keepPage: true });
        }
    });
}

async function runSearch({ keepPage = false } = {}) {
    showError("");
    const input = document.getElementById("user-search");
    const q = String(input?.value || "").trim();
    if (!keepPage) STATE.page = 1;
    STATE.search = q;

    if (!q) {
        STATE.total = 0;
        renderRows([]);
        renderMeta();
        renderPagination();
        return;
    }

    setLoading(true);
    try {
        const params = new URLSearchParams({
            search: q,
            page: String(STATE.page),
            limit: String(STATE.limit),
        });
        const data = await adminFetch(`/admin/users/tokens-last-active?${params}`);
        STATE.total = Number(data.total) || 0;
        STATE.page = Number(data.page) || STATE.page;
        renderRows(Array.isArray(data.users) ? data.users : []);
        renderMeta();
        renderPagination();
        const wrap = document.getElementById("table-wrap");
        if (wrap && STATE.total === 0) {
            wrap.style.display = "none";
            const meta = document.getElementById("meta");
            if (meta) meta.textContent = `No users found for “${q}”`;
        }
    } catch (e) {
        renderRows([]);
        renderPagination();
        showError(e?.message || "Search failed");
        const meta = document.getElementById("meta");
        if (meta) meta.textContent = "Search failed.";
    } finally {
        setLoading(false);
    }
}

function initTokensLastActive() {
    document.getElementById("search-btn")?.addEventListener("click", () => runSearch());
    document.getElementById("user-search")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            runSearch();
        }
    });
}
