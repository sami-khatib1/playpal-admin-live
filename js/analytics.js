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

async function adminFetch(path, options = {}) {
    const token = getToken();
    const url = `${getApiBaseUrl()}${path}`;
    const response = await fetch(url, {
        method: options.method || "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        body: options.body,
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
    const toStr = to.toISOString().slice(0, 10);
    const fromStr = from.toISOString().slice(0, 10);
    const pairs = [
        ["tl-to", toStr],
        ["tl-from", fromStr],
        ["eng-to", toStr],
        ["eng-from", fromStr],
    ];
    pairs.forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el && !el.value) el.value = val;
    });
}

function fmtNum(v) {
    if (v == null || Number.isNaN(Number(v))) return "—";
    return String(v);
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
            ["Avg DAU (7d)", fmtNum(data.avgDau7d)],
            ["Avg WAU (7d)", fmtNum(data.avgWau7d)],
            ["Avg MAU (7d)", fmtNum(data.avgMau7d)],
            ["Avg DAU (30d)", fmtNum(data.avgDau30d)],
            ["Avg WAU (30d)", fmtNum(data.avgWau30d)],
            ["Avg MAU (30d)", fmtNum(data.avgMau30d)],
        ]);
        const note = document.getElementById("engagement-avg-note");
        if (note) {
            const d7 = data.snapshotDays7d ?? 0;
            const d30 = data.snapshotDays30d ?? 0;
            note.textContent =
                d30 === 0
                    ? "No stored snapshots yet — use “Record snapshot now” to start history."
                    : `Averages from ${d7} snapshot day(s) in last 7d / ${d30} in last 30d.`;
        }
    } catch (e) {
        showError(e.message || "Failed to load engagement");
        document.getElementById("engagement-kpis").innerHTML = `<span class="muted">Error</span>`;
    }
}

let engagementChart = null;
let stickinessChart = null;

function renderEngagementChart(points) {
    const canvas = document.getElementById("engagement-chart");
    if (!canvas || typeof Chart === "undefined") return;
    const labels = (points || []).map((p) => p.date || "");
    const dau = (points || []).map((p) => Number(p.dau) || 0);
    const wau = (points || []).map((p) => Number(p.wau) || 0);
    const mau = (points || []).map((p) => Number(p.mau) || 0);
    if (engagementChart) {
        engagementChart.destroy();
        engagementChart = null;
    }
    engagementChart = new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "DAU",
                    data: dau,
                    borderColor: "#0d9488",
                    backgroundColor: "rgba(13, 148, 136, 0.12)",
                    tension: 0.25,
                    fill: false,
                },
                {
                    label: "WAU",
                    data: wau,
                    borderColor: "#2563eb",
                    backgroundColor: "rgba(37, 99, 235, 0.12)",
                    tension: 0.25,
                    fill: false,
                },
                {
                    label: "MAU",
                    data: mau,
                    borderColor: "#b45309",
                    backgroundColor: "rgba(180, 83, 9, 0.12)",
                    tension: 0.25,
                    fill: false,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { position: "top" },
            },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
            },
        },
    });
}

function renderStickinessChart(points) {
    const canvas = document.getElementById("stickiness-chart");
    if (!canvas || typeof Chart === "undefined") return;
    const labels = (points || []).map((p) => p.date || "");
    const stickiness = (points || []).map((p) =>
        p.stickiness != null && !Number.isNaN(Number(p.stickiness))
            ? Number(p.stickiness)
            : null
    );
    if (stickinessChart) {
        stickinessChart.destroy();
        stickinessChart = null;
    }
    stickinessChart = new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Stickiness (DAU/MAU)",
                    data: stickiness,
                    borderColor: "#7c3aed",
                    backgroundColor: "rgba(124, 58, 237, 0.12)",
                    tension: 0.25,
                    fill: true,
                    spanGaps: true,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { position: "top" },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: 1,
                    ticks: {
                        callback: (v) => Number(v).toFixed(2),
                    },
                },
            },
        },
    });
}

function renderEngagementHistoryTable(points, bucket) {
    const el = document.getElementById("engagement-history-wrap");
    if (!el) return;
    if (!points || points.length === 0) {
        el.innerHTML =
            '<p class="muted">No snapshots in range. Record a snapshot to create the first row.</p>';
        return;
    }
    const periodLabel = bucket === "week" ? "Week start" : bucket === "month" ? "Month" : "Date";
    const rows = points
        .map((p) => {
            return (
                `<tr>` +
                `<td>${escapeHtml(p.date || "")}</td>` +
                `<td>${fmtNum(p.dau)}</td>` +
                `<td>${fmtNum(p.wau)}</td>` +
                `<td>${fmtNum(p.mau)}</td>` +
                `<td>${fmtNum(p.stickiness)}</td>` +
                `<td>${fmtNum(p.signups)}</td>` +
                `<td>${fmtNum(p.gamesCreated)}</td>` +
                `<td>${fmtNum(p.usersTotal)}</td>` +
                (p.daysInBucket != null ? `<td>${fmtNum(p.daysInBucket)}</td>` : "") +
                `</tr>`
            );
        })
        .join("");
    const extraTh = bucket !== "day" ? "<th>Days</th>" : "";
    el.innerHTML =
        `<table class="timeline-table"><thead><tr>` +
        `<th>${periodLabel}</th><th>DAU</th><th>WAU</th><th>MAU</th><th>Stickiness</th>` +
        `<th>Signups</th><th>Games created</th><th>Users total</th>${extraTh}` +
        `</tr></thead><tbody>${rows}</tbody></table>`;
}

async function loadEngagementHistory() {
    showError("");
    const fromEl = document.getElementById("eng-from");
    const toEl = document.getElementById("eng-to");
    const bucket = document.getElementById("eng-bucket")?.value || "day";
    const from = fromEl?.value ? new Date(fromEl.value + "T00:00:00.000Z").toISOString() : "";
    const to = toEl?.value ? new Date(toEl.value + "T23:59:59.999Z").toISOString() : "";
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    p.set("bucket", bucket);

    try {
        const data = await adminFetch(`/admin/analytics/engagement-history?${p.toString()}`);
        const avg = data.averages || {};
        renderKpiGrid("engagement-range-kpis", [
            ["Range avg DAU", fmtNum(avg.avgDau)],
            ["Range avg WAU", fmtNum(avg.avgWau)],
            ["Range avg MAU", fmtNum(avg.avgMau)],
            ["Range avg stickiness", fmtNum(avg.avgStickiness)],
            ["Snapshot days", avg.days ?? 0],
        ]);
        renderEngagementChart(data.points || []);
        renderStickinessChart(data.points || []);
        renderEngagementHistoryTable(data.points || [], data.bucket || bucket);
    } catch (e) {
        showError(e.message || "Failed to load engagement history");
        const wrap = document.getElementById("engagement-history-wrap");
        if (wrap) wrap.innerHTML = `<p class="muted">Error</p>`;
    }
}

async function recordEngagementSnapshot() {
    showError("");
    try {
        const data = await adminFetch("/admin/analytics/engagement-snapshot", {
            method: "POST",
            body: "{}",
        });
        const s = data.snapshot || {};
        showError("");
        await loadEngagement();
        await loadEngagementHistory();
        const note = document.getElementById("engagement-avg-note");
        if (note && s.date) {
            note.textContent = `Snapshot recorded for ${s.date} (DAU=${s.dau}, WAU=${s.wau}, MAU=${s.mau}).`;
        }
    } catch (e) {
        showError(e.message || "Failed to record snapshot");
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

function distributionColumnLabel(labelKey) {
    if (labelKey === "gender") return "Gender";
    if (labelKey === "city") return "City";
    if (labelKey === "version") return "Version";
    if (labelKey === "platform") return "Platform";
    return labelKey;
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
            distributionColumnLabel(labelKey)
        )}</th><th>Users</th><th>%</th><th></th></tr></thead><tbody>${body}</tbody></table>`;
}

function renderVersionPlatformTable(containerId, rows) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!rows || rows.length === 0) {
        el.innerHTML = '<p class="muted">No known versions yet.</p>';
        return;
    }
    const max = Math.max(...rows.map((r) => Number(r.count) || 0), 1);
    const body = rows
        .map((r) => {
            const c = Number(r.count) || 0;
            const bar = Math.round((c / max) * 100);
            return (
                `<tr>` +
                `<td>${escapeHtml(r.version || "")}</td>` +
                `<td>${escapeHtml(r.platform || "")}</td>` +
                `<td>${c}</td>` +
                `<td class="bar-cell"><div class="bar-fill" style="width:${bar}%"></div></td>` +
                `</tr>`
            );
        })
        .join("");
    el.innerHTML =
        `<table class="timeline-table"><thead><tr><th>Version</th><th>Platform</th><th>Users</th><th></th></tr></thead><tbody>${body}</tbody></table>`;
}

async function loadAppVersions() {
    showError("");
    const kpis = document.getElementById("app-versions-kpis");
    if (kpis) kpis.innerHTML = "Loading…";
    try {
        const data = await adminFetch("/admin/analytics/app-versions");
        const withV = data.usersWithVersion ?? 0;
        const total = data.usersTotal ?? 0;
        const unknown = data.usersUnknownVersion ?? Math.max(0, total - withV);
        const coverage =
            total > 0 ? `${Math.round((withV / total) * 1000) / 10}%` : "—";
        renderKpiGrid("app-versions-kpis", [
            ["Users (total)", total || "—"],
            ["With version recorded", withV],
            ["Unknown / not yet seen", unknown],
            ["Coverage", coverage],
        ]);
        renderDistributionTable("app-version-breakdown", data.byVersion || [], "version", "count");
        renderDistributionTable("app-platform-breakdown", data.byPlatform || [], "platform", "count");
        renderVersionPlatformTable("app-version-platform-breakdown", data.byVersionPlatform || []);
    } catch (e) {
        showError(e.message || "Failed to load app versions");
        if (kpis) kpis.innerHTML = `<span class="muted">Error</span>`;
        const ids = [
            "app-version-breakdown",
            "app-platform-breakdown",
            "app-version-platform-breakdown",
        ];
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = `<p class="muted">Error</p>`;
        });
    }
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
    loadEngagementHistory();
    loadTimelines();
    loadAppVersions();
    loadDemographics();
    loadUserActivity(1);
}

window.loadSnapshot = loadSnapshot;
window.loadEngagement = loadEngagement;
window.loadEngagementHistory = loadEngagementHistory;
window.recordEngagementSnapshot = recordEngagementSnapshot;
window.loadTimelines = loadTimelines;
window.loadUserActivity = loadUserActivity;
window.loadAppVersions = loadAppVersions;
window.loadDemographics = loadDemographics;
window.uaPrev = uaPrev;
window.uaNext = uaNext;
window.exportUsersActivityCsv = exportUsersActivityCsv;
window.initAnalyticsPage = initAnalyticsPage;
