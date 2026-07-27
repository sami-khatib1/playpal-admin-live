/**
 * Admin Score page — raw metrics from API; weights & formulas live here for easy edits.
 *
 * Contribution rules:
 *  1–8, 11: value * weight
 *  9 stickiness: stickiness * STICKINESS_MULTIPLIER (default 50)
 *  10 signups: (signups / usersTotal) * SIGNUPS_SCALE / SIGNUPS_TARGET_RATE
 *     default: (signups/total) * 10 / 0.04
 */

const SCORE_WEIGHTS = {
    friendRequests: 7,
    dmsSent: 7,
    groupMessages: 9,
    activityMessages: 15,
    polls: 12,
    pendingGames: 12,
    chatCardsCreated: 12,
    communitiesCreated: 10,
    /** stickiness contribution = stickiness * this */
    stickinessMultiplier: 50,
    /** signup share contribution = (signups/usersTotal) * scale / targetRate */
    signupsScale: 10,
    signupsTargetRate: 0.04,
    /** joinRequests + joins, combined raw count */
    joinRequestsOrJoins: 17,
};

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

function round2(n) {
    if (n == null || Number.isNaN(Number(n))) return null;
    return Math.round(Number(n) * 100) / 100;
}

/**
 * Compute overall score + per-parameter breakdown from raw metrics.
 * Edit SCORE_WEIGHTS above to rebalance.
 */
function computeScore(metrics) {
    const m = metrics || {};
    const friendRequests = Number(m.friendRequests) || 0;
    const dmsSent = Number(m.dmsSent) || 0;
    const groupMessages = Number(m.groupMessages) || 0;
    const activityMessages = Number(m.activityMessages) || 0;
    const polls = Number(m.polls) || 0;
    const pendingGames = Number(m.pendingGames) || 0;
    const chatCardsCreated = Number(m.chatCardsCreated) || 0;
    const communitiesCreated = Number(m.communitiesCreated) || 0;
    const stickiness = m.stickiness != null ? Number(m.stickiness) : 0;
    const signups = Number(m.signups) || 0;
    const usersTotal = Number(m.usersTotal) || 0;
    const joinRequests = Number(m.joinRequests) || 0;
    const joins = Number(m.joins) || 0;
    const joinCombo = joinRequests + joins;

    const signupRate = usersTotal > 0 ? signups / usersTotal : 0;
    const signupsContribution =
        (signupRate * SCORE_WEIGHTS.signupsScale) / SCORE_WEIGHTS.signupsTargetRate;

    const params = [
        {
            key: "friendRequests",
            label: "New friend requests",
            value: friendRequests,
            weightLabel: `× ${SCORE_WEIGHTS.friendRequests}`,
            contribution: friendRequests * SCORE_WEIGHTS.friendRequests,
        },
        {
            key: "dmsSent",
            label: "DMs sent",
            value: dmsSent,
            weightLabel: `× ${SCORE_WEIGHTS.dmsSent}`,
            contribution: dmsSent * SCORE_WEIGHTS.dmsSent,
        },
        {
            key: "groupMessages",
            label: "Group chat messages",
            value: groupMessages,
            weightLabel: `× ${SCORE_WEIGHTS.groupMessages}`,
            contribution: groupMessages * SCORE_WEIGHTS.groupMessages,
        },
        {
            key: "activityMessages",
            label: "Activity chat messages",
            value: activityMessages,
            weightLabel: `× ${SCORE_WEIGHTS.activityMessages}`,
            contribution: activityMessages * SCORE_WEIGHTS.activityMessages,
        },
        {
            key: "polls",
            label: "Polls",
            value: polls,
            weightLabel: `× ${SCORE_WEIGHTS.polls}`,
            contribution: polls * SCORE_WEIGHTS.polls,
        },
        {
            key: "pendingGames",
            label: "Pending games",
            value: pendingGames,
            weightLabel: `× ${SCORE_WEIGHTS.pendingGames}`,
            contribution: pendingGames * SCORE_WEIGHTS.pendingGames,
        },
        {
            key: "chatCardsCreated",
            label: "Chat cards created",
            value: chatCardsCreated,
            weightLabel: `× ${SCORE_WEIGHTS.chatCardsCreated}`,
            contribution: chatCardsCreated * SCORE_WEIGHTS.chatCardsCreated,
            note: "proxy: new groups + pending games",
        },
        {
            key: "communitiesCreated",
            label: "Newly created groups",
            value: communitiesCreated,
            weightLabel: `× ${SCORE_WEIGHTS.communitiesCreated}`,
            contribution: communitiesCreated * SCORE_WEIGHTS.communitiesCreated,
        },
        {
            key: "stickiness",
            label: "Stickiness (DAU/MAU)",
            value: round2(stickiness),
            weightLabel: `× ${SCORE_WEIGHTS.stickinessMultiplier}`,
            contribution: stickiness * SCORE_WEIGHTS.stickinessMultiplier,
        },
        {
            key: "signups",
            label: "Signups rate",
            value: usersTotal
                ? `${signups} / ${usersTotal} (${round2(signupRate * 100)}%)`
                : signups,
            weightLabel: `(rate × ${SCORE_WEIGHTS.signupsScale} / ${SCORE_WEIGHTS.signupsTargetRate})`,
            contribution: signupsContribution,
        },
        {
            key: "joinRequestsOrJoins",
            label: "Join requests + joins",
            value: joinCombo,
            weightLabel: `× ${SCORE_WEIGHTS.joinRequestsOrJoins} (${joinRequests} req + ${joins} joins)`,
            contribution: joinCombo * SCORE_WEIGHTS.joinRequestsOrJoins,
        },
    ];

    const total = params.reduce((s, p) => s + (Number(p.contribution) || 0), 0);
    return { total: round2(total), params, signupRate };
}

function renderFormulaBox() {
    const el = document.getElementById("score-formula-box");
    if (!el) return;
    el.textContent =
        `SCORE_WEIGHTS (edit in js/score.js)\n` +
        JSON.stringify(SCORE_WEIGHTS, null, 2) +
        `\n\n` +
        `overall = Σ (value × weight)\n` +
        `stickiness term = stickiness × ${SCORE_WEIGHTS.stickinessMultiplier}\n` +
        `signups term = (signups / usersTotal) × ${SCORE_WEIGHTS.signupsScale} / ${SCORE_WEIGHTS.signupsTargetRate}`;
}

function renderLiveScore(metrics) {
    const { total, params } = computeScore(metrics);
    const overall = document.getElementById("overall-score-value");
    const note = document.getElementById("overall-score-note");
    if (overall) overall.textContent = total != null ? String(total) : "—";
    if (note) {
        const bits = [`UTC day ${metrics.date || "today"}`];
        if (metrics.streamCountsPartial) bits.push("Stream message counts may be capped/partial");
        if (metrics.streamAvailable === false) bits.push("Stream unavailable — chat counts = 0");
        note.textContent = bits.join(" · ");
    }

    const grid = document.getElementById("score-param-kpis");
    if (!grid) return;
    grid.innerHTML = params
        .map((p) => {
            const contrib = round2(p.contribution);
            return (
                `<div class="kpi-tile">` +
                `<div class="label">${escapeHtml(p.label)}</div>` +
                `<div class="value">${escapeHtml(String(p.value ?? "—"))}</div>` +
                `<div class="contrib">Score +${escapeHtml(String(contrib ?? "—"))}</div>` +
                `<div class="weight">${escapeHtml(p.weightLabel)}${
                    p.note ? ` · ${escapeHtml(p.note)}` : ""
                }</div>` +
                `</div>`
            );
        })
        .join("");
}

async function loadScoreLive() {
    showError("");
    try {
        const data = await adminFetch("/admin/analytics/score");
        renderLiveScore(data.metrics || {});
    } catch (e) {
        showError(e.message || "Failed to load score");
        document.getElementById("overall-score-value").textContent = "—";
        document.getElementById("score-param-kpis").innerHTML =
            `<span class="muted">Error</span>`;
    }
}

async function recordScoreSnapshot() {
    showError("");
    try {
        await adminFetch("/admin/analytics/score-snapshot", {
            method: "POST",
            body: "{}",
        });
        await loadScoreLive();
        await loadScoreHistory();
    } catch (e) {
        showError(e.message || "Failed to record score snapshot");
    }
}

let scoreChart = null;

function renderScoreChart(rows) {
    const canvas = document.getElementById("score-chart");
    if (!canvas || typeof Chart === "undefined") return;
    const labels = rows.map((r) => r.date);
    const totals = rows.map((r) => r.total);
    if (scoreChart) {
        scoreChart.destroy();
        scoreChart = null;
    }
    scoreChart = new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Overall score",
                    data: totals,
                    borderColor: "#0d9488",
                    backgroundColor: "rgba(13, 148, 136, 0.15)",
                    tension: 0.25,
                    fill: true,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: { legend: { position: "top" } },
            scales: { y: { beginAtZero: true } },
        },
    });
}

function renderScoreHistoryTable(rows) {
    const el = document.getElementById("score-history-wrap");
    if (!el) return;
    if (!rows.length) {
        el.innerHTML =
            '<p class="muted">No score snapshots in range. Use “Record snapshot”.</p>';
        return;
    }
    const head =
        `<table class="timeline-table"><thead><tr>` +
        `<th>Date</th><th>Score</th>` +
        `<th>Friends</th><th>DMs</th><th>Group msgs</th><th>Activity msgs</th>` +
        `<th>Polls</th><th>Pending</th><th>Chat cards</th><th>Groups</th>` +
        `<th>Stickiness</th><th>Signups</th><th>Joins combo</th>` +
        `</tr></thead><tbody>`;
    const body = rows
        .map((r) => {
            const joinCombo = (Number(r.joinRequests) || 0) + (Number(r.joins) || 0);
            return (
                `<tr>` +
                `<td>${escapeHtml(r.date)}</td>` +
                `<td><strong>${escapeHtml(String(r.total))}</strong></td>` +
                `<td>${r.friendRequests}</td>` +
                `<td>${r.dmsSent}</td>` +
                `<td>${r.groupMessages}</td>` +
                `<td>${r.activityMessages}</td>` +
                `<td>${r.polls}</td>` +
                `<td>${r.pendingGames}</td>` +
                `<td>${r.chatCardsCreated}</td>` +
                `<td>${r.communitiesCreated}</td>` +
                `<td>${r.stickiness ?? "—"}</td>` +
                `<td>${r.signups}/${r.usersTotal}</td>` +
                `<td>${joinCombo}</td>` +
                `</tr>`
            );
        })
        .join("");
    el.innerHTML = head + body + `</tbody></table>`;
}

async function loadScoreHistory() {
    showError("");
    const fromEl = document.getElementById("score-from");
    const toEl = document.getElementById("score-to");
    const from = fromEl?.value
        ? new Date(fromEl.value + "T00:00:00.000Z").toISOString()
        : "";
    const to = toEl?.value
        ? new Date(toEl.value + "T23:59:59.999Z").toISOString()
        : "";
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    try {
        const data = await adminFetch(`/admin/analytics/score-history?${p}`);
        const rows = (data.points || []).map((raw) => {
            const computed = computeScore(raw);
            return { ...raw, total: computed.total, params: computed.params };
        });
        renderScoreChart(rows);
        renderScoreHistoryTable(rows);
    } catch (e) {
        showError(e.message || "Failed to load score history");
    }
}

function setDefaultDates() {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const toStr = to.toISOString().slice(0, 10);
    const fromStr = from.toISOString().slice(0, 10);
    const toEl = document.getElementById("score-to");
    const fromEl = document.getElementById("score-from");
    if (toEl && !toEl.value) toEl.value = toStr;
    if (fromEl && !fromEl.value) fromEl.value = fromStr;
}

function initScorePage() {
    setDefaultDates();
    renderFormulaBox();
    loadScoreLive();
    loadScoreHistory();
}

window.loadScoreLive = loadScoreLive;
window.loadScoreHistory = loadScoreHistory;
window.recordScoreSnapshot = recordScoreSnapshot;
window.initScorePage = initScorePage;
window.SCORE_WEIGHTS = SCORE_WEIGHTS;
window.computeScore = computeScore;
