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

function formatDate(d) {
    if (d == null) return "—";
    const t = d instanceof Date ? d : new Date(d);
    if (isNaN(t.getTime())) return "—";
    return t.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function formatSports(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return "—";
    return arr.map((s) => String(s).trim()).filter(Boolean).join(", ");
}

async function loadUsers() {
    const loading = document.getElementById("loading");
    const tableWrap = document.getElementById("table-wrap");
    const meta = document.getElementById("meta");
    const tbody = document.getElementById("users-table-body");
    const token = getToken();
    if (!token) {
        showError("Not signed in.");
        return;
    }
    showError("");
    if (loading) loading.style.display = "block";
    if (tableWrap) tableWrap.style.display = "none";
    if (meta) meta.textContent = "Loading…";
    try {
        const url = `${getApiBaseUrl()}/admin/users`;
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
        const users = data.users || [];
        if (meta) meta.textContent = `${users.length} user${users.length === 1 ? "" : "s"}`;
        if (tbody) {
            tbody.innerHTML = users
                .map((u) => {
                    const deleted =
                        u.deletedAt != null
                            ? '<span class="pill pill-deleted" title="Soft-deleted">deleted</span>'
                            : "";
                    return `<tr>
                        <td>${escapeHtml(u.name || "")}</td>
                        <td>${escapeHtml(u.username || "")}</td>
                        <td>${escapeHtml(u.email || "")}</td>
                        <td class="sports-cell">${escapeHtml(formatSports(u.favoriteSports))}</td>
                        <td>${escapeHtml(formatDate(u.lastActiveAt))}</td>
                        <td>${escapeHtml(formatDate(u.lastGameAt))}</td>
                        <td>${escapeHtml(u.accountType || "")}</td>
                        <td>${deleted}</td>
                    </tr>`;
                })
                .join("");
        }
        if (loading) loading.style.display = "none";
        if (tableWrap) tableWrap.style.display = "block";
    } catch (e) {
        console.error(e);
        showError(e.message || "Failed to load users");
        if (loading) loading.style.display = "none";
        if (meta) meta.textContent = "";
    }
}

window.loadUsers = loadUsers;
