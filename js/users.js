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

/** Safe for HTML attribute values (e.g. option value). */
function escapeAttr(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
}

/** Full user list from last successful fetch; filtered client-side only. */
let cachedUsers = [];
let currentFilteredUsers = [];

function getLastActiveSortValue(user) {
    const raw = user?.lastActiveAt;
    if (raw == null) return Number.NEGATIVE_INFINITY;
    const d = raw instanceof Date ? raw : new Date(raw);
    const t = d.getTime();
    return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

function sortUsersByLastActiveDesc(users) {
    return [...users].sort((a, b) => {
        const diff = getLastActiveSortValue(b) - getLastActiveSortValue(a);
        if (diff !== 0) return diff;
        return String(a?.name ?? "").localeCompare(String(b?.name ?? ""), undefined, {
            sensitivity: "base",
        });
    });
}

function normalizeSportKey(s) {
    return String(s ?? "").trim().toLowerCase();
}

function userMatchesFavoriteSportFilter(user, selectedSport) {
    if (!selectedSport) return true;
    const arr = user.favoriteSports;
    if (!Array.isArray(arr) || arr.length === 0) return false;
    const needle = normalizeSportKey(selectedSport);
    return arr.some((x) => normalizeSportKey(x) === needle);
}

function collectSportsFromUsers(users) {
    const seen = new Set();
    const ordered = [];
    for (const u of users) {
        if (!Array.isArray(u.favoriteSports)) continue;
        for (const s of u.favoriteSports) {
            const raw = String(s).trim();
            if (!raw) continue;
            const key = normalizeSportKey(raw);
            if (seen.has(key)) continue;
            seen.add(key);
            ordered.push(raw);
        }
    }
    ordered.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return ordered;
}

function populateSportFilterOptions(users) {
    const sel = document.getElementById("sport-filter");
    if (!sel) return;
    const prev = sel.value;
    const sports = collectSportsFromUsers(users);
    sel.innerHTML =
        '<option value="">All sports</option>' +
        sports
            .map(
                (s) =>
                    `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`
            )
            .join("");
    const stillValid = prev === "" || sports.some((s) => s === prev);
    sel.value = stillValid ? prev : "";
}

function renderUsersRows(users) {
    const tbody = document.getElementById("users-table-body");
    if (!tbody) return;
    tbody.innerHTML = users
        .map((u) => {
            return `<tr>
                        <td>${escapeHtml(u.name || "")}</td>
                        <td>${escapeHtml(u.username || "")}</td>
                        <td>${escapeHtml(u.email || "")}</td>
                        <td>${formatUserLocation(u)}</td>
                        <td class="sports-cell">${escapeHtml(formatSports(u.favoriteSports))}</td>
                        <td>${escapeHtml(formatDateOnly(u.lastActiveAt))}</td>
                        <td>${escapeHtml(formatDate(u.lastGameAt))}</td>
                        <td>${escapeHtml(u.accountType || "")}</td>
                        <td>${formatStatus(u)}</td>
                    </tr>`;
        })
        .join("");
}

function applyFavoriteSportFilter() {
    const sel = document.getElementById("sport-filter");
    const meta = document.getElementById("meta");
    const sport = sel ? sel.value : "";
    const filtered = sport
        ? cachedUsers.filter((u) => userMatchesFavoriteSportFilter(u, sport))
        : cachedUsers;
    const sortedFiltered = sortUsersByLastActiveDesc(filtered);
    currentFilteredUsers = sortedFiltered;
    if (meta) {
        if (sport) {
            meta.textContent = `${filtered.length} of ${cachedUsers.length} users · favorite sport: ${sport}`;
        } else {
            meta.textContent = `${cachedUsers.length} user${cachedUsers.length === 1 ? "" : "s"}`;
        }
    }
    renderUsersRows(sortedFiltered);
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

function formatDateOnly(d) {
    if (d == null) return "—";
    const t = d instanceof Date ? d : new Date(d);
    if (isNaN(t.getTime())) return "—";
    return `${t.getDate()}.${t.getMonth() + 1}.${t.getFullYear()}`;
}

function formatSports(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return "—";
    return arr.map((s) => String(s).trim()).filter(Boolean).join(", ");
}

/** Location column: backend `locationSummary`, then `city`, then raw `location` JSON. */
function formatUserLocation(u) {
    return escapeHtml(getPlainUserLocation(u));
}

function getPlainUserLocation(u) {
    const sum = u.locationSummary;
    if (sum != null && String(sum).trim() !== "") {
        return String(sum).trim();
    }
    if (u.city != null && String(u.city).trim() !== "") {
        return String(u.city).trim();
    }
    const loc = u.location;
    if (loc == null) return "—";
    if (typeof loc === "object" && loc !== null && loc.city != null) {
        const s = String(loc.city).trim();
        return s || "—";
    }
    if (typeof loc === "string") {
        try {
            const o = JSON.parse(loc);
            if (o && o.city != null && String(o.city).trim()) {
                return String(o.city).trim();
            }
            if (o && (o.lat != null || o.latitude != null) && (o.lng != null || o.longitude != null)) {
                const lat = Number(o.lat ?? o.latitude);
                const lng = Number(o.lng ?? o.longitude);
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                }
            }
        } catch {
            /* ignore */
        }
    }
    return "—";
}

/** Status column = last active time; soft-deleted users also show deleted badge. */
function formatStatus(u) {
    const when = formatDateOnly(u.lastActiveAt);
    const safeWhen = when === "—" ? "—" : escapeHtml(when);
    if (u.deletedAt != null) {
        return `<span class="pill pill-deleted" title="Soft-deleted">deleted</span> · ${safeWhen}`;
    }
    return safeWhen;
}

function csvValue(value) {
    const raw = value == null ? "" : String(value);
    return `"${raw.replace(/"/g, '""')}"`;
}

function exportUsersCsv() {
    showError("");
    const users = currentFilteredUsers.length > 0 ? currentFilteredUsers : cachedUsers;
    if (!users.length) {
        showError("No users to export.");
        return;
    }

    const headers = [
        "Name",
        "Username",
        "Email",
        "City",
        "Favorite sports",
        "Last activity",
        "Last game",
        "Account",
        "Deleted",
    ];
    const rows = users.map((u) => [
        u.name || "",
        u.username || "",
        u.email || "",
        getPlainUserLocation(u),
        formatSports(u.favoriteSports),
        formatDateOnly(u.lastActiveAt),
        formatDate(u.lastGameAt),
        u.accountType || "",
        u.deletedAt != null ? "yes" : "no",
    ]);
    const csv = [headers, ...rows]
        .map((row) => row.map(csvValue).join(","))
        .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "playpal-users.csv";
    link.click();
    URL.revokeObjectURL(url);
}

async function loadUsers() {
    const loading = document.getElementById("loading");
    const tableWrap = document.getElementById("table-wrap");
    const meta = document.getElementById("meta");
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
        cachedUsers = users;
        populateSportFilterOptions(users);
        applyFavoriteSportFilter();
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
window.exportUsersCsv = exportUsersCsv;

/** Script is loaded at end of body; sport-filter exists when this runs. */
(function bindSportFilter() {
    const sel = document.getElementById("sport-filter");
    if (sel) {
        sel.addEventListener("change", () => applyFavoriteSportFilter());
    }
})();
