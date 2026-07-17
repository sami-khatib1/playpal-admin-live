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

async function adminFetch(path) {
    const token = getToken();
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
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

const GS_STATE = {
    groups: [],
    bySport: [],
};

function scoreClass(score) {
    const n = Number(score) || 0;
    if (n >= 7) return "score-high";
    if (n >= 4) return "score-mid";
    return "score-low";
}

function filteredSortedGroups() {
    const q = String(document.getElementById("gs-search")?.value || "")
        .trim()
        .toLowerCase();
    const sport = String(document.getElementById("gs-sport")?.value || "");
    const sort = String(document.getElementById("gs-sort")?.value || "activity");

    let list = GS_STATE.groups.slice();
    if (sport) {
        list = list.filter((g) => String(g.sport || "") === sport);
    }
    if (q) {
        list = list.filter((g) => {
            const hay = [g.name, g.city, g.sport, g.status]
                .map((x) => String(x || "").toLowerCase())
                .join(" ");
            return hay.includes(q);
        });
    }

    const cmpNum = (a, b, key) => (Number(b[key]) || 0) - (Number(a[key]) || 0);
    list.sort((a, b) => {
        if (sort === "chats") return cmpNum(a, b, "chatsLast30d") || String(a.name).localeCompare(String(b.name));
        if (sort === "members") return cmpNum(a, b, "membersCount") || String(a.name).localeCompare(String(b.name));
        if (sort === "joins") return cmpNum(a, b, "joinRequestsLast30d") || String(a.name).localeCompare(String(b.name));
        if (sort === "polls") return cmpNum(a, b, "activePolls") || String(a.name).localeCompare(String(b.name));
        if (sort === "name") return String(a.name || "").localeCompare(String(b.name || ""));
        return cmpNum(a, b, "activityScore") || cmpNum(a, b, "chatsLast30d") || String(a.name).localeCompare(String(b.name));
    });
    return list;
}

function renderOverview(data) {
    const el = document.getElementById("groups-overview");
    if (!el) return;
    const bySport = data.bySport || [];
    const topSport = bySport[0];
    el.innerHTML = [
        ["Groups (total)", data.groupsTotal ?? "—"],
        ["Sports with groups", bySport.length],
        ["Top sport", topSport ? `${topSport.sport} (${topSport.count})` : "—"],
        [
            "Avg activity score",
            data.groups?.length
                ? (
                      data.groups.reduce((s, g) => s + (Number(g.activityScore) || 0), 0) /
                      data.groups.length
                  ).toFixed(1)
                : "—",
        ],
    ]
        .map(
            ([label, value]) =>
                `<div class="kpi-tile"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(
                    String(value)
                )}</div></div>`
        )
        .join("");

    const note = document.getElementById("groups-chat-note");
    if (note) {
        const chat = data.chatStats || {};
        note.textContent = chat.note || "";
    }
}

function renderSportBreakdown(bySport) {
    const el = document.getElementById("sport-breakdown");
    if (!el) return;
    if (!bySport.length) {
        el.innerHTML = '<p class="muted">No groups.</p>';
        return;
    }
    const max = Math.max(...bySport.map((r) => Number(r.count) || 0), 1);
    const rows = bySport
        .map((r) => {
            const c = Number(r.count) || 0;
            const pct = Math.round((c / max) * 100);
            return (
                `<tr><td>${escapeHtml(r.sport)}</td><td>${c}</td>` +
                `<td class="bar-cell"><div class="bar-fill" style="width:${pct}%"></div></td></tr>`
            );
        })
        .join("");
    el.innerHTML =
        `<table class="stats-table"><thead><tr><th>Sport</th><th>Groups</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function fillSportFilter(bySport) {
    const sel = document.getElementById("gs-sport");
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML =
        '<option value="">All</option>' +
        bySport
            .map(
                (r) =>
                    `<option value="${escapeHtml(r.sport)}">${escapeHtml(r.sport)} (${Number(r.count) || 0})</option>`
            )
            .join("");
    if ([...sel.options].some((o) => o.value === current)) {
        sel.value = current;
    }
}

function renderGroupsTable() {
    const body = document.getElementById("gs-body");
    const countEl = document.getElementById("gs-count");
    if (!body) return;
    const list = filteredSortedGroups();
    if (countEl) countEl.textContent = `${list.length} shown`;
    if (!list.length) {
        body.innerHTML = '<tr><td colspan="10" class="muted">No matching groups.</td></tr>';
        return;
    }
    body.innerHTML = list
        .map((g) => {
            const score = Number(g.activityScore) || 1;
            return (
                `<tr>` +
                `<td class="name-cell">${escapeHtml(g.name)}</td>` +
                `<td>${escapeHtml(g.sport || "")}</td>` +
                `<td>${escapeHtml(g.city || "—")}</td>` +
                `<td>${escapeHtml(g.status || "")}</td>` +
                `<td>${Number(g.membersCount) || 0}</td>` +
                `<td>${Number(g.adminsCount) || 0}</td>` +
                `<td>${Number(g.chatsLast30d) || 0}</td>` +
                `<td>${Number(g.activePolls) || 0}</td>` +
                `<td>${Number(g.joinRequestsLast30d) || 0}</td>` +
                `<td><span class="score-pill ${scoreClass(score)}">${score}/10</span></td>` +
                `</tr>`
            );
        })
        .join("");
}

async function loadGroupStats() {
    showError("");
    const body = document.getElementById("gs-body");
    if (body) body.innerHTML = '<tr><td colspan="10" class="muted">Loading…</td></tr>';
    try {
        const data = await adminFetch("/admin/analytics/groups");
        GS_STATE.groups = Array.isArray(data.groups) ? data.groups : [];
        GS_STATE.bySport = Array.isArray(data.bySport) ? data.bySport : [];
        renderOverview(data);
        renderSportBreakdown(GS_STATE.bySport);
        fillSportFilter(GS_STATE.bySport);
        renderGroupsTable();
    } catch (e) {
        showError(e.message || "Failed to load group stats");
        if (body) body.innerHTML = '<tr><td colspan="10" class="muted">Error</td></tr>';
    }
}

function initGroupStatsPage() {
    const search = document.getElementById("gs-search");
    const sport = document.getElementById("gs-sport");
    const sort = document.getElementById("gs-sort");
    if (search) search.addEventListener("input", renderGroupsTable);
    if (sport) sport.addEventListener("change", renderGroupsTable);
    if (sort) sort.addEventListener("change", renderGroupsTable);
    loadGroupStats();
}

window.loadGroupStats = loadGroupStats;
window.initGroupStatsPage = initGroupStatsPage;
