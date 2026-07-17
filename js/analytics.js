function getApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || "http://localhost:3000/api";
}

function getToken() {
    return localStorage.getItem("adminToken");
}

const UA_STATE = { page: 1, limit: 50, totalPages: 1 };

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

function renderKpiGrid(containerId, pairs) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = pairs
        .map(
            ([label, value]) =>
                `<div class="kpi-tile"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(
                    String(value)
                )}</div></div>`
        )
        .join("");
}

function renderTimelineTable(containerId, points, maxCount) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!points || points.length === 0) {
        el.innerHTML = '<p class="muted">No data in range.</p>';
        return;
    }
    const max = maxCount > 0 ? maxCount : Math.max(...points.map((p) => Number(p.count) || 0), 1);
    const rows = points
        .map((p) => {
            const c = Number(p.count) || 0;
            const pct = Math.round((c / max) * 100);
            return (
                `<tr><td>${escapeHtml(p.date || "")}</td><td>${c}</td>` +
                `<td class="bar-cell"><div class="bar-fill" style="width:${pct}%"></div></td></tr>`
            );
        })
        .join("");
    el.innerHTML =
        `<table class="timeline-table"><thead><tr><th>Date</th><th>Count</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function setDefaultDates() {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const toInput = document.getElementById("tl-to");
    const fromInput = document.getElementById("tl-from");
    if (toInput && !toInput.value) {
        toInput.value = to.toISOString().slice(0, 10);
    }
    if (fromInput && !fromInput.value) {
        fromInput.value = from.toISOString().slice(0, 10);
    }
}

async function loadSnapshot() {
    showError("");
    try {
        const data = await adminFetch("/admin/analytics/snapshot");
        renderKpiGrid("snapshot-kpis", [
            ["Users (total)", data.usersTotal ?? "—"],
            ["Signups last 7d", data.signupsLast7d ?? "—"],
            ["Signups last 30d", data.signupsLast30d ?? "—"],
            ["Pending games", data.pendingGamesTotal ?? "—"],
            ["Games (rows)", data.gamesTotal ?? "—"],
            ["Games created last 7d", data.gamesCreatedLast7d ?? "—"],
            ["Games created last 30d", data.gamesCreatedLast30d ?? "—"],
            ["Games started (scheduled past)", data.gamesStartedTotal ?? "—"],
            ["Pending upcoming (start ≥ now)", data.pendingGamesUpcoming ?? "—"],
            ["Users with lastActiveAt set", data.usersWithActivityRecorded ?? "—"],
            ["Unique game creators (30d)", data.uniqueGameCreatorsLast30d ?? "—"],
        ]);
    } catch (e) {
        showError(e.message || "Failed to load snapshot");
        document.getElementById("snapshot-kpis").innerHTML = `<span class="muted">Error</span>`;
    }
}

async function loadEngagement() {
    showError("");
    try {
        const data = await adminFetch("/admin/analytics/engagement");
        const stick = data.stickinessDauOverMau != null ? String(data.stickinessDauOverMau) : "—";
        renderKpiGrid("engagement-kpis", [
            ["DAU (UTC today)", data.dauUtcToday ?? "—"],
            ["WAU (rolling 7d)", data.wau7d ?? "—"],
            ["MAU (rolling 30d)", data.mau30d ?? "—"],
            ["Stickiness DAU/MAU", stick],
        ]);
    } catch (e) {
        showError(e.message || "Failed to load engagement");
        document.getElementById("engagement-kpis").innerHTML = `<span class="muted">Error</span>`;
    }
}

async function loadTimelines() {
    showError("");
    const fromEl = document.getElementById("tl-from");
    const toEl = document.getElementById("tl-to");
    const bucket = document.getElementById("tl-bucket")?.value || "day";
    const from = fromEl?.value ? new Date(fromEl.value + "T00:00:00.000Z").toISOString() : "";
    const to = toEl?.value ? new Date(toEl.value + "T23:59:59.999Z").toISOString() : "";
    const qs = (extra) => {
        const p = new URLSearchParams();
        if (from) p.set("from", from);
        if (to) p.set("to", to);
        p.set("bucket", bucket);
        Object.entries(extra || {}).forEach(([k, v]) => p.set(k, v));
        return p.toString();
    };

    try {
        const [signups, created, started] = await Promise.all([
            adminFetch(`/admin/analytics/signups-timeline?${qs()}`),
            adminFetch(`/admin/analytics/games-timeline?${qs({ metric: "created" })}`),
            adminFetch(`/admin/analytics/games-timeline?${qs({ metric: "started" })}`),
        ]);
        const maxS = Math.max(...(signups.points || []).map((p) => p.count || 0), 0);
        const maxC = Math.max(...(created.points || []).map((p) => p.count || 0), 0);
        const maxSt = Math.max(...(started.points || []).map((p) => p.count || 0), 0);
        renderTimelineTable("signups-timeline-wrap", signups.points, maxS);
        renderTimelineTable("games-created-wrap", created.points, maxC);
        renderTimelineTable("games-started-wrap", started.points, maxSt);
    } catch (e) {
        showError(e.message || "Failed to load timelines");
    }
}

async function loadUserActivity(page) {
    showError("");
    UA_STATE.page = page || 1;
    const sort = document.getElementById("ua-sort")?.value || "played";
    const qs = new URLSearchParams({
        page: String(UA_STATE.page),
        limit: String(UA_STATE.limit),
        sort,
    });
    try {
        const data = await adminFetch(`/admin/analytics/users-activity?${qs.toString()}`);
        UA_STATE.totalPages = data.totalPages || 1;
        const tbody = document.getElementById("ua-body");
        const users = data.users || [];
        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="muted">No users.</td></tr>`;
        } else {
            tbody.innerHTML = users
                .map((u) => {
                    const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "";
                    return (
                        `<tr>` +
                        `<td>${escapeHtml(u.name || u.username || u.id)}</td>` +
                        `<td>${escapeHtml(u.email || "")}</td>` +
                        `<td>${Number(u.gamesPlayed) || 0}</td>` +
                        `<td>${Number(u.gamesCreated) || 0}</td>` +
                        `<td>${escapeHtml(joined)}</td>` +
                        `</tr>`
                    );
                })
                .join("");
        }
        document.getElementById("ua-page").textContent = `Page ${data.page || UA_STATE.page} / ${UA_STATE.totalPages} (${data.total ?? 0} users)`;
        document.getElementById("ua-prev").disabled = UA_STATE.page <= 1;
        document.getElementById("ua-next").disabled = UA_STATE.page >= UA_STATE.totalPages;
    } catch (e) {
        showError(e.message || "Failed to load user activity");
        document.getElementById("ua-body").innerHTML = `<tr><td colspan="5" class="muted">Error</td></tr>`;
    }
}

function uaPrev() {
    if (UA_STATE.page > 1) loadUserActivity(UA_STATE.page - 1);
}

function uaNext() {
    if (UA_STATE.page < UA_STATE.totalPages) loadUserActivity(UA_STATE.page + 1);
}

function exportUsersActivityCsv() {
    showError("");
    const sort = document.getElementById("ua-sort")?.value || "played";
    const token = getToken();
    const qs = new URLSearchParams({ sort, maxRows: "5000" });
    const url = `${getApiBaseUrl()}/admin/analytics/users-activity/export?${qs.toString()}`;
    fetch(url, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })
        .then((r) => {
            if (!r.ok) throw new Error("Export failed");
            return r.blob();
        })
        .then((blob) => {
            const u = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = u;
            link.download = "playpal-users-activity.csv";
            link.click();
            URL.revokeObjectURL(u);
        })
        .catch((e) => showError(e.message || "Export failed"));
}

function renderDistributionTable(containerId, rows, labelKey, countKey) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!rows || rows.length === 0) {
        el.innerHTML = '<p class="muted">No data.</p>';
        return;
    }
    const max = Math.max(...rows.map((r) => Number(r[countKey]) || 0), 1);
    const body = rows
        .map((r) => {
            const c = Number(r[countKey]) || 0;
            const pct = r.pct != null ? r.pct : Math.round((c / max) * 1000) / 10;
            const bar = Math.round((c / max) * 100);
            return (
                `<tr>` +
                `<td>${escapeHtml(r[labelKey])}</td>` +
                `<td>${c}</td>` +
                `<td>${pct}%</td>` +
                `<td class="bar-cell"><div class="bar-fill" style="width:${bar}%"></div></td>` +
                `</tr>`
            );
        })
        .join("");
    el.innerHTML =
        `<table class="timeline-table"><thead><tr><th>${escapeHtml(
            labelKey === "gender" ? "Gender" : "City"
        )}</th><th>Users</th><th>%</th><th></th></tr></thead><tbody>${body}</tbody></table>`;
}

async function loadDemographics() {
    showError("");
    const kpis = document.getElementById("demographics-kpis");
    if (kpis) kpis.innerHTML = "Loading…";
    try {
        const data = await adminFetch("/admin/analytics/demographics");
        const byGender = data.byGender || [];
        const byCity = data.byCity || [];
        const topCity = byCity[0];
        const female = byGender.find((g) => String(g.gender).toLowerCase() === "female");
        const male = byGender.find((g) => String(g.gender).toLowerCase() === "male");
        renderKpiGrid("demographics-kpis", [
            ["Users (total)", data.usersTotal ?? "—"],
            ["Female", female ? `${female.count} (${female.pct}%)` : "—"],
            ["Male", male ? `${male.count} (${male.pct}%)` : "—"],
            ["Cities with users", byCity.filter((c) => c.city !== "(no city)").length],
            ["Top city", topCity ? `${topCity.city} (${topCity.count})` : "—"],
        ]);
        renderDistributionTable("gender-breakdown", byGender, "gender", "count");
        renderDistributionTable("city-breakdown", byCity, "city", "count");
    } catch (e) {
        showError(e.message || "Failed to load demographics");
        if (kpis) kpis.innerHTML = `<span class="muted">Error</span>`;
        const g = document.getElementById("gender-breakdown");
        const c = document.getElementById("city-breakdown");
        if (g) g.innerHTML = `<p class="muted">Error</p>`;
        if (c) c.innerHTML = `<p class="muted">Error</p>`;
    }
}

function initAnalyticsPage() {
    setDefaultDates();
    loadSnapshot();
    loadEngagement();
    loadTimelines();
    loadDemographics();
    loadUserActivity(1);
}

window.loadSnapshot = loadSnapshot;
window.loadEngagement = loadEngagement;
window.loadTimelines = loadTimelines;
window.loadUserActivity = loadUserActivity;
window.loadDemographics = loadDemographics;
window.uaPrev = uaPrev;
window.uaNext = uaNext;
window.exportUsersActivityCsv = exportUsersActivityCsv;
window.initAnalyticsPage = initAnalyticsPage;
