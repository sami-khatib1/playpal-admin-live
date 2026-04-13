function getApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || "http://localhost:3000/api";
}

function getToken() {
    return localStorage.getItem("adminToken");
}

const HELP_US_STATE = {
    page: 1,
    limit: 50,
    totalPages: 1,
    loading: false,
};

function buildQuery() {
    const params = new URLSearchParams();
    params.set("page", String(HELP_US_STATE.page));
    params.set("limit", String(HELP_US_STATE.limit));

    const type = document.getElementById("filter-type")?.value || "all";
    const screen = document.getElementById("filter-screen")?.value || "all";
    const priority = document.getElementById("filter-priority")?.value || "all";
    const search = (document.getElementById("filter-search")?.value || "").trim();

    if (type !== "all") params.set("type", type);
    if (screen !== "all") params.set("screen", screen);
    if (priority !== "all") params.set("priority", priority);
    if (search) params.set("search", search);

    return params.toString();
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str || "");
    return div.innerHTML;
}

async function fetchHelpUs() {
    const token = getToken();
    const url = `${getApiBaseUrl()}/admin/help-us?${buildQuery()}`;
    const response = await fetch(url, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.error || "Failed to fetch feedback");
    }
    return data;
}

function renderRows(items) {
    const tbody = document.getElementById("feedback-table-body");
    tbody.innerHTML = "";
    if (!items || items.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="6" class="muted">No feedback found for current filters.</td>`;
        tbody.appendChild(tr);
        return;
    }

    items.forEach((item) => {
        const tr = document.createElement("tr");
        const created = item.createdAt ? new Date(item.createdAt).toLocaleString() : "";
        const priority = String(item.priority || "medium").toLowerCase();
        // userName: from API after user lookup (name / username / email). If the key is missing, the
        // server is older — show userId again. If key exists but null, user row not found in DB.
        const hasUserNameKey = Object.prototype.hasOwnProperty.call(item, "userName");
        const resolvedName =
            hasUserNameKey &&
            item.userName != null &&
            String(item.userName).trim() !== ""
                ? String(item.userName).trim()
                : null;
        let userCellHtml;
        let userTitle = "";
        if (resolvedName) {
            userTitle = item.userId ? escapeHtml(item.userId) : "";
            userCellHtml = escapeHtml(resolvedName);
        } else if (!item.userId) {
            userCellHtml = "Anonymous";
        } else if (!hasUserNameKey) {
            userCellHtml = escapeHtml(item.userId);
            userTitle = "";
        } else {
            userTitle = escapeHtml(item.userId);
            userCellHtml = `<span class="muted">Unknown user</span>`;
        }
        tr.innerHTML =
            `<td>${escapeHtml(created)}</td>` +
            `<td><span class="pill">${escapeHtml(item.type)}</span></td>` +
            `<td><span class="pill">${escapeHtml(item.screen)}</span></td>` +
            `<td><span class="pill pill-${escapeHtml(priority)}">${escapeHtml(item.priority)}</span></td>` +
            `<td title="${userTitle}">${userCellHtml}</td>` +
            `<td class="message-cell">${escapeHtml(item.message || "")}</td>`;
        tbody.appendChild(tr);
    });
}

function setLoading(loading) {
    HELP_US_STATE.loading = loading;
    document.getElementById("loading").style.display = loading ? "block" : "none";
    document.getElementById("table-wrap").style.display = loading ? "none" : "block";
}

function setMeta(meta) {
    const total = Number(meta?.total || 0);
    const totalPages = Number(meta?.totalPages || 1);
    HELP_US_STATE.totalPages = totalPages;
    const page = Number(meta?.page || HELP_US_STATE.page || 1);
    HELP_US_STATE.page = page;
    document.getElementById("meta").textContent = `${total} total results`;
    document.getElementById("page-info").textContent = `Page ${page} / ${totalPages}`;
}

function setError(message) {
    const el = document.getElementById("error-message");
    if (!message) {
        el.style.display = "none";
        el.textContent = "";
        return;
    }
    el.style.display = "block";
    el.textContent = message;
}

async function loadHelpUsFeedback() {
    if (HELP_US_STATE.loading) return;
    setError("");
    setLoading(true);
    try {
        const data = await fetchHelpUs();
        renderRows(data.data || []);
        setMeta(data.pagination || {});
    } catch (e) {
        setError(e?.message || "Failed to load feedback.");
        renderRows([]);
        setMeta({ page: HELP_US_STATE.page, totalPages: HELP_US_STATE.totalPages, total: 0 });
    } finally {
        setLoading(false);
    }
}

function prevPage() {
    if (HELP_US_STATE.page <= 1 || HELP_US_STATE.loading) return;
    HELP_US_STATE.page -= 1;
    loadHelpUsFeedback();
}

function nextPage() {
    if (HELP_US_STATE.page >= HELP_US_STATE.totalPages || HELP_US_STATE.loading) return;
    HELP_US_STATE.page += 1;
    loadHelpUsFeedback();
}

function initHelpUsPage() {
    const onFilterChange = () => {
        HELP_US_STATE.page = 1;
        loadHelpUsFeedback();
    };
    ["filter-type", "filter-screen", "filter-priority"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", onFilterChange);
    });
    const searchInput = document.getElementById("filter-search");
    if (searchInput) {
        let timer = null;
        searchInput.addEventListener("input", () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(onFilterChange, 250);
        });
    }
    loadHelpUsFeedback();
}

window.initHelpUsPage = initHelpUsPage;
window.loadHelpUsFeedback = loadHelpUsFeedback;
window.prevPage = prevPage;
window.nextPage = nextPage;

