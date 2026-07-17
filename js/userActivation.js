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

const SEGMENT_LABELS = {
    both: "Both",
    community_only: "Community only",
    game_only: "Game only",
    neither: "Neither",
};

let cachedUsers = [];
let cachedSummary = null;
let activeSegmentFilter = "";

function formatDate(d) {
    if (d == null) return "—";
    const t = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(t.getTime())) return "—";
    return t.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function formatDateOnly(d) {
    if (d == null) return "—";
    const t = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(t.getTime())) return "—";
    return `${t.getDate()}.${t.getMonth() + 1}.${t.getFullYear()}`;
}

function segmentPill(segment) {
    const key = String(segment || "neither");
    const label = SEGMENT_LABELS[key] || key;
    return `<span class="pill pill-${escapeHtml(key)}">${escapeHtml(label)}</span>`;
}

function pct(count, total) {
    if (!total) return "0%";
    return `${Math.round((count / total) * 100)}%`;
}

function renderSummaryTiles(summary) {
    const grid = document.getElementById("segment-kpis");
    if (!grid || !summary) return;
    const total = summary.total || 0;
    const tiles = [
        { key: "", label: "All users", count: total },
        { key: "both", label: SEGMENT_LABELS.both, count: summary.both || 0 },
        {
            key: "community_only",
            label: SEGMENT_LABELS.community_only,
            count: summary.community_only || 0,
        },
        { key: "game_only", label: SEGMENT_LABELS.game_only, count: summary.game_only || 0 },
        { key: "neither", label: SEGMENT_LABELS.neither, count: summary.neither || 0 },
    ];
    grid.innerHTML = tiles
        .map((t) => {
            const active =
                activeSegmentFilter === t.key ? " active" : "";
            return `<div class="kpi-tile${active}" data-segment="${escapeHtml(t.key)}" role="button" tabindex="0">
                <div class="label">${escapeHtml(t.label)}</div>
                <div class="value">${t.count}</div>
                <div class="pct">${t.key === "" ? "100% base" : pct(t.count, total)}</div>
            </div>`;
        })
        .join("");

    grid.querySelectorAll(".kpi-tile").forEach((tile) => {
        const seg = tile.getAttribute("data-segment") ?? "";
        tile.addEventListener("click", () => {
            activeSegmentFilter = seg;
            const sel = document.getElementById("segment-filter");
            if (sel) sel.value = seg;
            renderSummaryTiles(cachedSummary);
            applySegmentFilter();
        });
        tile.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                tile.click();
            }
        });
    });
}

function applySegmentFilter() {
    const sel = document.getElementById("segment-filter");
    const segment = sel ? sel.value : activeSegmentFilter;
    activeSegmentFilter = segment;
    const filtered = segment
        ? cachedUsers.filter((u) => u.segment === segment)
        : cachedUsers;
    const meta = document.getElementById("meta");
    if (meta) {
        if (segment) {
            meta.textContent = `${filtered.length} of ${cachedUsers.length} users · ${SEGMENT_LABELS[segment] || segment}`;
        } else {
            meta.textContent = `${cachedUsers.length} user${cachedUsers.length === 1 ? "" : "s"}`;
        }
    }
    renderTableRows(filtered);
    if (cachedSummary) renderSummaryTiles(cachedSummary);
}

function renderTableRows(users) {
    const tbody = document.getElementById("activation-table-body");
    if (!tbody) return;
    tbody.innerHTML = users
        .map(
            (u) => `<tr>
            <td>${escapeHtml(u.name || "")}</td>
            <td>${escapeHtml(u.username || "")}</td>
            <td>${escapeHtml(u.email || "")}</td>
            <td>${segmentPill(u.segment)}</td>
            <td>${u.inCommunity ? escapeHtml(String(u.communityCount ?? 0)) : "0"}</td>
            <td>${escapeHtml(String(u.joinedGames ?? 0))}</td>
            <td>${escapeHtml(formatDateOnly(u.lastActiveAt))}</td>
            <td>${escapeHtml(formatDate(u.lastGameAt))}</td>
            <td>${escapeHtml(u.accountType || "")}</td>
        </tr>`,
        )
        .join("");
}

async function loadUserActivation() {
    showError("");
    const loading = document.getElementById("loading");
    const tableWrap = document.getElementById("table-wrap");
    if (loading) loading.style.display = "block";
    if (tableWrap) tableWrap.style.display = "none";

    const token = getToken();
    if (!token) {
        showError("Not authenticated.");
        if (loading) loading.style.display = "none";
        return;
    }

    try {
        const res = await fetch(`${getApiBaseUrl()}/admin/users/activation`, {
            headers: {
                Authorization: `Bearer ${token}`,
                ...(window.getAdminDbHeaders?.() || {}),
            },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            throw new Error(data.error || `HTTP ${res.status}`);
        }

        cachedUsers = Array.isArray(data.users) ? data.users : [];
        cachedSummary = data.summary || null;

        renderSummaryTiles(cachedSummary);

        const summaryMeta = document.getElementById("summary-meta");
        if (summaryMeta && cachedSummary) {
            const deleted = data.deletedUserCount ?? 0;
            summaryMeta.textContent = `${cachedSummary.total} active users in funnel · ${deleted} soft-deleted excluded`;
        }

        const sel = document.getElementById("segment-filter");
        if (sel) {
            sel.onchange = () => {
                activeSegmentFilter = sel.value;
                applySegmentFilter();
            };
        }

        applySegmentFilter();

        if (loading) loading.style.display = "none";
        if (tableWrap) tableWrap.style.display = "block";
    } catch (e) {
        if (loading) loading.style.display = "none";
        showError(e.message || "Failed to load user activation");
    }
}

function csvValue(value) {
    const raw = value == null ? "" : String(value);
    return `"${raw.replace(/"/g, '""')}"`;
}

function exportActivationCsv() {
    showError("");
    const sel = document.getElementById("segment-filter");
    const segment = sel ? sel.value : "";
    const users = segment
        ? cachedUsers.filter((u) => u.segment === segment)
        : cachedUsers;
    if (!users.length) {
        showError("No users to export.");
        return;
    }
    const headers = [
        "Name",
        "Username",
        "Email",
        "Segment",
        "Community count",
        "Joined games counter",
        "Last activity",
        "Last game",
        "Account type",
    ];
    const rows = users.map((u) =>
        [
            u.name,
            u.username,
            u.email,
            SEGMENT_LABELS[u.segment] || u.segment,
            u.communityCount,
            u.joinedGames,
            u.lastActiveAt,
            u.lastGameAt,
            u.accountType,
        ]
            .map(csvValue)
            .join(","),
    );
    const csv = [headers.map(csvValue).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `user-activation${segment ? `-${segment}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
