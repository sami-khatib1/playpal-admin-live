function liquidityApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || "http://localhost:3000/api";
}

function liquidityToken() {
    return localStorage.getItem("adminToken");
}

const LIQUIDITY_AGENT_PROMPT = `You are PlayPal's daily marketplace-liquidity analyst.

Analyze the attached Liquidity - Claude JSON using only evidence present in the data.

Goals:
1. Identify pending games most at risk of not reaching their minimum.
2. Find sports, cities, days, and time slots where demand appears greater than supply.
3. Explain which recent games met or missed their minimum and identify recurring patterns.
4. Analyze recorded joins, waiting-list activity, cancellations, removals, and reported no-shows.
5. Check whether games with more participant friendships appear to perform differently.
6. Identify repeated underperformance by anonymized organizer, sport, city, venue, schedule, privacy setting, price, or lead time.
7. Recommend specific product or operational experiments that can be measured with the currently available data.
8. Report data-quality problems that reduce confidence.

Compare today, the last 7 days, and the last 30 days where those windows are available.

Important constraints:
- There are no game impression or detail-view events. Do not calculate or claim view-to-join conversion.
- Remaining on a roster is not verified physical attendance.
- Only call someone a no-show when a reported no-show exists.
- Join/leave history may be incomplete because it comes from retained notification roster-log rows.
- Correlation is not causation. Clearly separate facts, hypotheses, and experiments.
- Do not invent missing values or explanations.

Return:
1. Executive summary (maximum 6 bullets)
2. Urgent pending-game risks
3. Important metrics and changes
4. Demand-supply gaps
5. Patterns associated with minimum success or failure
6. Five prioritized recommendations, each with expected impact, confidence, effort, and success metric
7. Data limitations`;

let liquidityPayload = null;

function liquidityEscapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
}

function liquidityShowError(message) {
    const element = document.getElementById("error-message");
    if (!element) return;
    if (message) {
        element.textContent = message;
        element.style.display = "block";
    } else {
        element.textContent = "";
        element.style.display = "none";
    }
}

function liquidityFormatWhen(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function liquidityPercent(value) {
    if (value == null || Number.isNaN(Number(value))) return "—";
    return `${(Number(value) * 100).toFixed(1)}%`;
}

function liquidityRenderMetrics(data) {
    const host = document.getElementById("liquidity-metrics");
    if (!host) return;
    const pending = data?.summary?.currentPending || {};
    const outcomes = data?.summary?.outcomes30d || {};
    const demand = data?.demand?.totals || {};
    const metrics = [
        ["Pending games", pending.total ?? "—"],
        ["Pending at risk", pending.atRisk ?? "—"],
        ["Started (30d)", outcomes.gamesStarted ?? "—"],
        ["Minimum success (30d)", liquidityPercent(outcomes.minimumSuccessRate)],
        ["Under minimum (30d)", outcomes.gamesUnderMinimum ?? "—"],
        ["Reported no-shows (30d)", outcomes.reportedNoShows ?? "—"],
        ["Activity searches (30d)", demand.searches30d ?? "—"],
        ["Availability votes", demand.availabilityVotesCurrent ?? "—"],
    ];
    host.innerHTML = metrics
        .map(
            ([label, value]) =>
                `<div class="metric-card"><span>${liquidityEscapeHtml(label)}</span>` +
                `<strong>${liquidityEscapeHtml(value)}</strong></div>`,
        )
        .join("");
}

function liquidityRenderUrgent(games) {
    const body = document.getElementById("urgent-games-body");
    if (!body) return;
    if (!Array.isArray(games) || games.length === 0) {
        body.innerHTML =
            '<tr><td colspan="7" class="muted">No pending games currently match the risk rule.</td></tr>';
        return;
    }
    body.innerHTML = games
        .map((game) => {
            const reasons = Array.isArray(game.riskReasons)
                ? game.riskReasons.join(", ")
                : "";
            return `<tr>
                <td>${liquidityEscapeHtml(liquidityFormatWhen(game.startsAt))}</td>
                <td class="title-cell">${liquidityEscapeHtml(game.title || "—")}</td>
                <td>${liquidityEscapeHtml(game.sport || "—")}</td>
                <td>${liquidityEscapeHtml(game.city || "—")}</td>
                <td>${liquidityEscapeHtml(`${game.participantCount ?? 0}/${game.minimumParticipants ?? "—"}`)}</td>
                <td>${liquidityEscapeHtml(game.friendPairCount ?? 0)}</td>
                <td>${liquidityEscapeHtml(reasons)}</td>
            </tr>`;
        })
        .join("");
}

async function liquidityCopyText(text, successMessage) {
    try {
        await navigator.clipboard.writeText(text);
        const status = document.getElementById("copy-status");
        if (status) {
            status.textContent = successMessage;
            window.setTimeout(() => {
                status.textContent = "";
            }, 2500);
        }
    } catch {
        liquidityShowError("Could not copy to the clipboard.");
    }
}

function copyLiquidityJson() {
    if (!liquidityPayload) return;
    liquidityCopyText(
        JSON.stringify(liquidityPayload, null, 2),
        "JSON copied.",
    );
}

function copyLiquidityPrompt() {
    liquidityCopyText(LIQUIDITY_AGENT_PROMPT, "Agent prompt copied.");
}

function copyLiquidityPackage() {
    if (!liquidityPayload) return;
    liquidityCopyText(
        `${LIQUIDITY_AGENT_PROMPT}\n\nLIQUIDITY DATA:\n${JSON.stringify(liquidityPayload, null, 2)}`,
        "Prompt and JSON copied.",
    );
}

function downloadLiquidityJson() {
    if (!liquidityPayload) return;
    const blob = new Blob([JSON.stringify(liquidityPayload, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `playpal-liquidity-claude-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function loadLiquidityClaude() {
    liquidityShowError("");
    const loading = document.getElementById("loading");
    const content = document.getElementById("liquidity-content");
    const jsonView = document.getElementById("json-view");
    if (loading) loading.style.display = "block";
    if (content) content.style.display = "none";
    if (jsonView) jsonView.textContent = "Loading…";

    try {
        const response = await fetch(
            `${liquidityApiBaseUrl()}/admin/liquidity-claude`,
            {
                cache: "no-store",
                headers: {
                    Authorization: `Bearer ${liquidityToken()}`,
                    "Content-Type": "application/json",
                },
            },
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            const errorText =
                typeof data.error === "string"
                    ? data.error
                    : data.message || `Request failed (${response.status})`;
            throw new Error(
                response.status === 404
                    ? "The Liquidity - Claude API is not deployed on this server yet."
                    : errorText,
            );
        }

        liquidityPayload = data;
        liquidityRenderMetrics(data);
        liquidityRenderUrgent(data.urgentPendingGames || []);
        if (jsonView) jsonView.textContent = JSON.stringify(data, null, 2);
        const meta = document.getElementById("meta");
        if (meta) {
            const sizeKb = Math.round(
                new Blob([JSON.stringify(data)]).size / 1024,
            );
            meta.textContent =
                `Generated ${liquidityFormatWhen(data.generatedAt)} · ` +
                `${data.database || "database unknown"} · ${sizeKb} KB · ` +
                `${data.pendingGames?.length || 0} pending + ${data.recentGames?.length || 0} recent games`;
        }
    } catch (error) {
        liquidityPayload = null;
        const raw =
            error && error.message
                ? error.message
                : "Failed to load liquidity data";
        liquidityShowError(
            /failed to fetch|networkerror/i.test(raw)
                ? "Cannot reach the API. Check the dashboard network mode, then refresh."
                : raw,
        );
        if (jsonView) jsonView.textContent = "";
    } finally {
        if (loading) loading.style.display = "none";
        if (content) content.style.display = "block";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const prompt = document.getElementById("agent-prompt");
    if (prompt) prompt.textContent = LIQUIDITY_AGENT_PROMPT;
});

window.loadLiquidityClaude = loadLiquidityClaude;
window.copyLiquidityJson = copyLiquidityJson;
window.copyLiquidityPrompt = copyLiquidityPrompt;
window.copyLiquidityPackage = copyLiquidityPackage;
window.downloadLiquidityJson = downloadLiquidityJson;
