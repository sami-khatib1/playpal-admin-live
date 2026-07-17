function getApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || "http://localhost:3000/api";
}

function getToken() {
    return localStorage.getItem("adminToken");
}

const STATE = {
    runsPage: 1,
    runsLimit: 15,
    runsTotalPages: 1,
    selectedRunId: null,
    selectedRun: null,
    deliveriesPage: 1,
    deliveriesLimit: 100,
    deliveriesTotalPages: 1,
    deliveryStatusFilter: "all",
};

const DELIVERY_FILTERS = [
    { value: "all", label: "All" },
    { value: "sent", label: "Sent" },
    { value: "skipped_recent", label: "Skipped (2d)" },
    { value: "no_match", label: "No match" },
    { value: "failed", label: "Failed" },
    { value: "dry_run", label: "Dry run" },
];

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str ?? "");
    return div.innerHTML;
}

function getErrorMessage(data, defaultMsg) {
    defaultMsg = defaultMsg || "Request failed";
    if (!data) return defaultMsg;
    if (typeof data.error === "string") return data.error;
    if (typeof data.message === "string") return data.message;
    return defaultMsg;
}

function showError(msg) {
    const el = document.getElementById("error-message");
    if (!el) return;
    if (msg) {
        el.textContent = msg;
        el.style.display = "block";
        window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
        el.style.display = "none";
    }
}

function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString();
}

function formatDuration(ms) {
    if (ms == null || !Number.isFinite(ms)) return "—";
    if (ms < 1000) return `${ms}ms`;
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function statusBadge(status) {
    const s = String(status || "").toLowerCase();
    let cls = "badge-pending";
    if (s === "completed" || s === "sent") cls = "badge-approved";
    else if (s === "failed") cls = "badge-rejected";
    else if (s === "skipped_lock" || s === "no_match" || s === "skipped_recent") cls = "badge-inactive";
    else if (s === "dry_run") cls = "badge-update";
    return `<span class="badge ${cls}">${escapeHtml(s || "—")}</span>`;
}

function kindLabel(kind) {
    const map = {
        members: "Members",
        activities: "Activities",
        looking_for_members: "Looking for players",
        open_spot: "Open spot",
    };
    return map[kind] || kind || "—";
}

async function adminFetch(path) {
    const token = getToken();
    const url = `${getApiBaseUrl()}/admin${path}`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(getErrorMessage(data, `HTTP ${response.status}`));
    }
    return data;
}

function renderJobStatus(job) {
    const wrap = document.getElementById("job-status");
    const loading = document.getElementById("job-status-loading");
    if (!wrap || !loading) return;

    loading.style.display = "none";
    wrap.style.display = "grid";

    const enabled = job?.enabled !== false;
    wrap.innerHTML = `
        <div class="stat-box">
            <div class="label">Enabled</div>
            <div class="value">${enabled ? "Yes" : "No"}</div>
        </div>
        <div class="stat-box">
            <div class="label">Interval</div>
            <div class="value">${escapeHtml(String(job?.intervalDays ?? 2))}d</div>
        </div>
        <div class="stat-box">
            <div class="label">Last run</div>
            <div class="value" style="font-size:0.95rem;">${escapeHtml(formatDate(job?.lastRunTime))}</div>
        </div>
        <div class="stat-box">
            <div class="label">Next run</div>
            <div class="value" style="font-size:0.95rem;">${escapeHtml(formatDate(job?.nextRunTime))}</div>
        </div>
        <div class="stat-box">
            <div class="label">Last sent</div>
            <div class="value">${escapeHtml(String(job?.lastRunStats?.sent ?? "—"))}</div>
        </div>
        <div class="stat-box">
            <div class="label">Running now</div>
            <div class="value">${job?.isRunning ? "Yes" : "No"}</div>
        </div>
    `;
}

function renderRunsTable(runs) {
    const tbody = document.getElementById("runs-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!runs.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="muted">No batch runs yet.</td></tr>`;
        return;
    }

    runs.forEach((run) => {
        const tr = document.createElement("tr");
        tr.className = "run-row" + (STATE.selectedRunId === run.id ? " is-selected" : "");
        tr.dataset.runId = run.id;
        tr.innerHTML = `
            <td>${escapeHtml(formatDate(run.startedAt))}</td>
            <td>${statusBadge(run.status)}</td>
            <td>${escapeHtml(run.trigger || "—")}</td>
            <td>${escapeHtml(String(run.sentCount ?? 0))}</td>
            <td>${escapeHtml(String(run.skippedRecent ?? 0))}</td>
            <td>${escapeHtml(String(run.remainingCount ?? 0))}</td>
            <td>${escapeHtml(formatDuration(run.durationMs))}</td>
            <td>${run.dryRun ? "yes" : "—"}</td>
        `;
        tr.addEventListener("click", () => selectRun(run));
        tbody.appendChild(tr);
    });
}

function renderDetailSummary(run) {
    const wrap = document.getElementById("detail-summary");
    if (!wrap || !run) return;
    wrap.innerHTML = `
        <div class="stat-box"><div class="label">Users total</div><div class="value">${run.usersTotal ?? 0}</div></div>
        <div class="stat-box"><div class="label">Sent</div><div class="value">${run.sentCount ?? 0}</div></div>
        <div class="stat-box"><div class="label">Skipped (2d)</div><div class="value">${run.skippedRecent ?? 0}</div></div>
        <div class="stat-box"><div class="label">No match / failed</div><div class="value">${run.remainingCount ?? 0}</div></div>
        <div class="stat-box"><div class="label">Groups scanned</div><div class="value">${run.communitiesScanned ?? 0}</div></div>
        <div class="stat-box"><div class="label">Delivery rows</div><div class="value">${run.deliveryRows ?? "—"}</div></div>
    `;
}

function renderDeliveryFilters() {
    const wrap = document.getElementById("delivery-filters");
    if (!wrap) return;
    wrap.innerHTML = DELIVERY_FILTERS.map(
        (f) =>
            `<button type="button" class="chip${STATE.deliveryStatusFilter === f.value ? " active" : ""}" data-status="${escapeHtml(f.value)}">${escapeHtml(f.label)}</button>`,
    ).join("");
    wrap.querySelectorAll(".chip").forEach((btn) => {
        btn.addEventListener("click", () => {
            STATE.deliveryStatusFilter = btn.getAttribute("data-status") || "all";
            STATE.deliveriesPage = 1;
            renderDeliveryFilters();
            loadDeliveries();
        });
    });
}

function renderDeliveriesTable(rows) {
    const tbody = document.getElementById("deliveries-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="muted">No rows for this filter.</td></tr>`;
        return;
    }

    rows.forEach((row) => {
        const tr = document.createElement("tr");
        const user = row.username ? `@${row.username}` : row.userId || "—";
        tr.innerHTML = `
            <td title="${escapeHtml(row.userId || "")}">${escapeHtml(user)}</td>
            <td>${statusBadge(row.status)}</td>
            <td>${escapeHtml(row.communityName || "—")}</td>
            <td>${escapeHtml(kindLabel(row.milestoneKind))}</td>
            <td class="body-cell">${escapeHtml(row.body || row.errorMessage || "—")}</td>
            <td>${row.distanceKm != null ? escapeHtml(Number(row.distanceKm).toFixed(1)) : "—"}</td>
            <td>${row.memberOverride ? "yes" : "—"}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function loadJobStatus() {
    const data = await adminFetch("/group-milestone-job/status");
    renderJobStatus(data.data);
}

async function loadRuns() {
    const loading = document.getElementById("runs-loading");
    const wrap = document.getElementById("runs-table-wrap");
    loading.style.display = "block";
    wrap.style.display = "none";

    const params = new URLSearchParams({
        page: String(STATE.runsPage),
        limit: String(STATE.runsLimit),
    });
    const data = await adminFetch(`/group-milestone-runs?${params}`);
    const runs = data.data || [];
    const pg = data.pagination || {};

    STATE.runsTotalPages = pg.pages || 1;
    document.getElementById("runs-meta").textContent =
        `${pg.total ?? runs.length} run(s) — page ${pg.page ?? STATE.runsPage} of ${STATE.runsTotalPages}`;
    document.getElementById("runs-page-info").textContent = `Page ${STATE.runsPage}`;

    renderRunsTable(runs);
    loading.style.display = "none";
    wrap.style.display = "block";
}

async function loadDeliveries() {
    if (!STATE.selectedRunId) return;

    const loading = document.getElementById("deliveries-loading");
    loading.style.display = "block";

    const params = new URLSearchParams({
        page: String(STATE.deliveriesPage),
        limit: String(STATE.deliveriesLimit),
    });
    if (STATE.deliveryStatusFilter !== "all") {
        params.set("status", STATE.deliveryStatusFilter);
    }

    const data = await adminFetch(
        `/group-milestone-runs/${encodeURIComponent(STATE.selectedRunId)}/deliveries?${params}`,
    );
    const rows = data.data || [];
    const pg = data.pagination || {};

    STATE.deliveriesTotalPages = pg.pages || 1;
    document.getElementById("deliveries-meta").textContent =
        `${pg.total ?? rows.length} row(s) — page ${pg.page ?? STATE.deliveriesPage} of ${STATE.deliveriesTotalPages}`;
    document.getElementById("deliveries-page-info").textContent = `Page ${STATE.deliveriesPage}`;

    renderDeliveriesTable(rows);
    loading.style.display = "none";
}

async function selectRun(run) {
    STATE.selectedRunId = run.id;
    STATE.selectedRun = run;
    STATE.deliveriesPage = 1;
    STATE.deliveryStatusFilter = "all";

    document.getElementById("detail-panel").classList.add("is-open");
    document.getElementById("detail-title").textContent =
        `Run — ${formatDate(run.startedAt)}`;

    document.querySelectorAll(".run-row").forEach((tr) => {
        tr.classList.toggle("is-selected", tr.dataset.runId === run.id);
    });

    renderDetailSummary(run);
    renderDeliveryFilters();
    await loadDeliveries();
    document.getElementById("detail-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeDetail() {
    STATE.selectedRunId = null;
    STATE.selectedRun = null;
    document.getElementById("detail-panel").classList.remove("is-open");
    loadRuns();
}

function prevRunsPage() {
    if (STATE.runsPage <= 1) return;
    STATE.runsPage -= 1;
    loadRuns().catch((e) => showError(e.message));
}

function nextRunsPage() {
    if (STATE.runsPage >= STATE.runsTotalPages) return;
    STATE.runsPage += 1;
    loadRuns().catch((e) => showError(e.message));
}

function prevDeliveriesPage() {
    if (STATE.deliveriesPage <= 1) return;
    STATE.deliveriesPage -= 1;
    loadDeliveries().catch((e) => showError(e.message));
}

function nextDeliveriesPage() {
    if (STATE.deliveriesPage >= STATE.deliveriesTotalPages) return;
    STATE.deliveriesPage += 1;
    loadDeliveries().catch((e) => showError(e.message));
}

async function refreshAll() {
    showError("");
    try {
        await Promise.all([loadJobStatus(), loadRuns()]);
        if (STATE.selectedRunId) await loadDeliveries();
    } catch (e) {
        showError(e.message);
    }
}

async function initGroupMilestoneReports() {
    renderDeliveryFilters();
    try {
        await refreshAll();
    } catch (e) {
        showError(e.message);
    }
}

window.prevRunsPage = prevRunsPage;
window.nextRunsPage = nextRunsPage;
window.prevDeliveriesPage = prevDeliveriesPage;
window.nextDeliveriesPage = nextDeliveriesPage;
window.closeDetail = closeDetail;
window.refreshAll = refreshAll;
window.initGroupMilestoneReports = initGroupMilestoneReports;
