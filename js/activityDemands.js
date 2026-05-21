function getApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || "http://localhost:3000/api";
}

function getToken() {
    return localStorage.getItem("adminToken");
}

const ACTIVITY_DEMAND_STATE = {
    page: 1,
    limit: 50,
    totalPages: 1,
    loading: false,
};

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str || "");
    return div.innerHTML;
}

function formatSportList(item) {
    if (Array.isArray(item.sportTypes) && item.sportTypes.length > 0) {
        return item.sportTypes.join(", ");
    }
    const raw = item.sportType || "";
    if (!raw) return "—";
    return raw.includes(",") ? raw.split(",").map((s) => s.trim()).join(", ") : raw;
}

function formatAnswers(item) {
    const lines = [
        `Sports: ${formatSportList(item)}`,
        `Area: ${item.city || "—"}`,
        `Notify: ${item.notifyWhenAvailable ? "Yes" : "No"}`,
    ];
    if (item.note) lines.push(`Note: ${item.note}`);
    if (item.source) lines.push(`Source: ${item.source}`);
    return lines.join("\n");
}

async function fetchActivityDemands() {
    const token = getToken();
    const params = new URLSearchParams();
    params.set("page", String(ACTIVITY_DEMAND_STATE.page));
    params.set("limit", String(ACTIVITY_DEMAND_STATE.limit));
    const url = `${getApiBaseUrl()}/admin/activity-demands?${params.toString()}`;
    const response = await fetch(url, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.error || "Failed to fetch requests");
    }
    return data;
}

function renderRows(items) {
    const tbody = document.getElementById("demand-table-body");
    tbody.innerHTML = "";
    if (!items || items.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="3" class="muted">No activity demand requests yet.</td>`;
        tbody.appendChild(tr);
        return;
    }

    items.forEach((item) => {
        const tr = document.createElement("tr");
        const created = item.createdAt ? new Date(item.createdAt).toLocaleString() : "";
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
        } else {
            userTitle = escapeHtml(item.userId);
            userCellHtml = `<span class="muted">Unknown user</span>`;
        }
        const answers = formatAnswers(item);
        tr.innerHTML =
            `<td>${escapeHtml(created)}</td>` +
            `<td title="${userTitle}">${userCellHtml}</td>` +
            `<td class="answers-cell">${escapeHtml(answers)}</td>`;
        tbody.appendChild(tr);
    });
}

function setLoading(loading) {
    ACTIVITY_DEMAND_STATE.loading = loading;
    document.getElementById("loading").style.display = loading ? "block" : "none";
    document.getElementById("table-wrap").style.display = loading ? "none" : "block";
}

function setMeta(meta) {
    const total = Number(meta?.total || 0);
    const totalPages = Number(meta?.totalPages || 1);
    ACTIVITY_DEMAND_STATE.totalPages = totalPages;
    const page = Number(meta?.page || ACTIVITY_DEMAND_STATE.page || 1);
    ACTIVITY_DEMAND_STATE.page = page;
    document.getElementById("meta").textContent = `${total} total requests`;
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

async function loadActivityDemands() {
    if (ACTIVITY_DEMAND_STATE.loading) return;
    setError("");
    setLoading(true);
    try {
        const data = await fetchActivityDemands();
        renderRows(data.data || []);
        setMeta(data.pagination || {});
    } catch (e) {
        setError(e?.message || "Failed to load requests.");
        renderRows([]);
        setMeta({ page: ACTIVITY_DEMAND_STATE.page, totalPages: 1, total: 0 });
    } finally {
        setLoading(false);
    }
}

function prevPage() {
    if (ACTIVITY_DEMAND_STATE.page <= 1 || ACTIVITY_DEMAND_STATE.loading) return;
    ACTIVITY_DEMAND_STATE.page -= 1;
    loadActivityDemands();
}

function nextPage() {
    if (
        ACTIVITY_DEMAND_STATE.page >= ACTIVITY_DEMAND_STATE.totalPages ||
        ACTIVITY_DEMAND_STATE.loading
    )
        return;
    ACTIVITY_DEMAND_STATE.page += 1;
    loadActivityDemands();
}

function initActivityDemandsPage() {
    loadActivityDemands();
}

window.initActivityDemandsPage = initActivityDemandsPage;
window.loadActivityDemands = loadActivityDemands;
window.prevPage = prevPage;
window.nextPage = nextPage;
