function liquidityApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || "http://localhost:3000/api";
}

function liquidityToken() {
    return localStorage.getItem("adminToken");
}

const LIQUIDITY_AGENT_PROMPT = `You are PlayPal's daily marketplace-liquidity analyst.

Your purpose is to help PlayPal increase:
1. the probability that a pending game reaches its minimum number of players; and
2. the probability that people who join remain committed and physically attend.

ACCESSING THE REPORT
If the Liquidity - Claude JSON is already attached to this prompt, skip these access steps and analyze it directly.

If you have browser access:
1. Open https://sami-khatib1.github.io/playpal-admin-live/pages/login.html
2. Sign in using authorized PlayPal admin credentials supplied separately. Never request, expose, repeat, or store the password in your report.
3. After login, open the "Liquidity - Claude" card under "Users & analytics". The direct authenticated page is:
   https://sami-khatib1.github.io/playpal-admin-live/pages/liquidity-claude.html
4. Ensure the database selector is set to "Prod" for the daily production report unless the operator explicitly asks for Staging.
5. Press "Refresh" and wait until the generated timestamp and JSON appear.
6. Use "Copy prompt + JSON" to obtain the complete analysis package, or "Download JSON" to obtain the data alone.
7. Work read-only. Do not use any dashboard control that creates games, sends notifications, changes settings, or modifies users.

DATA SCOPE
- All current, non-deleted pending games.
- Games that started during the previous 30 days.
- Retained game roster events from the previous 90 days.
- Activity/explore searches and activity-demand requests from the previous 30 days.
- Current accumulated availability-vote totals.
- Current user activity and signup totals.
- No names, emails, phone numbers, passwords, or raw user IDs are included.

FIELD GUIDE

Top-level metadata:
- schemaVersion: structure version of this JSON.
- generatedAt: when the report was generated.
- database: database used. For normal daily analysis this should be the production database.
- scope: exact time windows and tables represented.
- definitions: authoritative definitions for ambiguous metrics.

summary.users:
- total: all non-deleted users.
- active1d, active7d, active30d: users whose lastActiveAt falls within each rolling window.
- signups1d, signups7d, signups30d: newly created non-deleted users in each window.

summary.currentPending:
- total: current pending games.
- belowMinimum: pending games whose current participant count is below the game minimum.
- atRisk: pending games below minimum that start within 72 hours, are overdue, or have zero participants.
- withWaitlist: pending games that currently have at least one waitlisted user.

summary.outcomes30d:
- gamesStarted: games whose scheduled start occurred in the last 30 days.
- gamesMeetingMinimum / gamesUnderMinimum: outcome based on metMinimum, with final roster size used only when metMinimum is unavailable.
- minimumSuccessRate: gamesMeetingMinimum divided by gamesStarted.
- finalRosterParticipants: participants remaining in stored game rosters; this is not verified attendance.
- reportedNoShows: explicit organizer no-show reports.
- rosterEventsFound: retained join, waitlist, leave, and removal events found for these games.

summary.byWindow:
- todayUtc, last7Days, and last30Days contain comparable creation, start, minimum-success, roster, and reported-no-show metrics.
- todayUtc starts at 00:00 UTC and may be a partial day.

urgentPendingGames:
- A compact list of the most urgent current risks.
- riskReasons can include no_organizer, zero_participants, below_minimum, start_time_passed, starts_within_24h, or starts_within_72h.
- participantCount/minimumParticipants shows the remaining gap.
- friendPairCount is the number of friendship pairs within the current participant roster.

pendingGames and recentGames:
- pendingGames contains detailed current pending-game records.
- recentGames contains detailed games that started in the last 30 days.
- state identifies which collection the record belongs to.
- organizerId is a stable anonymous identifier. Use it only to detect repeated patterns; it cannot identify the person.
- hoursFromCreationToStart measures how much lead time the game had.
- hoursUntilStart is positive before start and negative after start.
- fillRatioToMinimum = participantCount / minimumParticipants.
- capacityUtilization = participantCount / capacity when capacity is known.
- metMinimum is the stored/derived minimum outcome; belowMinimum describes roster size relative to minimum.
- atRisk and riskReasons apply to pending games.
- communityGame, isPrivate, allowOutsideJoin, price, recurring, genderRestriction, city, sport, and venue support segment comparisons.

friendships:
- pairCount: friendship edges where both users are participants in that game.
- participantsWithAtLeastOneFriend: unique participants connected to another participant.
- participantShareWithFriend: share of participants who have at least one friend in the roster.
- This describes the current/final roster, not necessarily friendship state at the exact join time.

participantRows:
- total and byStatus summarize stored GameParticipant rows.
- These rows describe roster state and do not verify physical attendance.

rosterActivity:
- joined, waiting, left, leftWaiting, and removed are counts reconstructed from retained notification roster-log rows.
- lateCancellationsWithin24h counts voluntary leaves recorded within 24 hours before the scheduled start.
- recordedEventCount indicates event coverage for that game.
- firstRecordedJoinAt and hoursFromCreationToFirstRecordedJoin estimate early traction.
- averageJoinLeadHours estimates how far before start recorded joins happened.
- Missing or zero events may mean no activity or incomplete retained history; inspect recordedEventCount before drawing conclusions.

joinRequests:
- total and byStatus summarize private-game join requests.

reportedNoShows:
- Explicit organizer reports only. Never infer additional no-shows.

gameLinkedNotifications:
- sent, read, and clicked summarize stored game-linked inbox notifications.
- clickedByCurrentRosterMember means the clicked recipient is currently in the roster.
- These are not clean acquisition-attribution events. Do not claim that a notification caused a join.

demand.totals:
- searches30d: activity/explore searches in the last 30 days.
- activityDemandRequests30d: explicit "can't find a game" requests in the last 30 days.
- availabilityVotesCurrent: accumulated votes in the current availability slots.

demand.marketSegments:
- Each row combines sport and city.
- demandSignals is searches + activity-demand requests + availability votes. It is a prioritization signal, not a unique-user count.
- pendingGames and pendingGamesAtRisk describe current supply.
- gamesStarted30d, gamesUnderMinimum30d, participantsOnStartedGames30d, and reportedNoShows30d describe recent outcomes.
- recentMinimumSuccessRate compares recent games meeting minimum with all recent games in that segment.
- Only the highest-priority segment rows are returned; totals state how many existed before the limit.

demand.topAvailabilitySlots:
- Current city/sport/dayOfWeek/timeSection demand.
- dayOfWeek uses 0=Sunday through 6=Saturday.
- Availability totals are accumulated current state, not a 30-day event count.

dataQuality:
- Treat every caution as a hard analytical constraint.
- canMeasureGameViews=false means view-to-join conversion cannot be calculated.
- canVerifyPhysicalAttendance=false means final roster participation is not proof of attendance.

ANALYSIS METHOD
1. Confirm generatedAt is recent and database is production. If not, lead with a warning.
2. Establish the current baseline from summary and compare UTC today, 7 days, and 30 days. Do not overinterpret the partial current day.
3. Rank urgent pending games using hoursUntilStart, player gap, fillRatioToMinimum, organizer presence, first-join timing, and waitlist size.
4. Find demand-supply gaps:
   - high demandSignals with few/no pending games;
   - high demandSignals with a poor recentMinimumSuccessRate;
   - availability concentration in city/sport/time combinations without matching supply.
5. Compare successful and unsuccessful recent games by sport, city, start time, lead time, community status, privacy, outside-join setting, price, recurring status, friendship share, and early traction.
6. Analyze commitment friction using voluntary leaves, late cancellations, waiting-list exits, removals, join-request outcomes, and reported no-shows.
7. Compare games with friendships against games without friendships. Always report sample sizes and describe this as association, not causation.
8. Group by anonymous organizerId to find repeated success or failure, but avoid conclusions when the organizer has only one or two games.
9. Prefer repeated patterns with meaningful sample sizes over isolated anecdotes.
10. Turn findings into measurable experiments using fields already present in this JSON.

IMPORTANT CONSTRAINTS
- There are no game-impression or game-detail-view events. Do not calculate or claim view-to-join conversion.
- Remaining on a roster is not verified physical attendance.
- Only call someone a no-show when reportedNoShows is greater than zero.
- Join/leave history may be incomplete because it comes from retained notification roster-log rows.
- Searches, demand requests, and availability votes are different signals and must not be described as equivalent unique users.
- Correlation is not causation. Clearly separate facts, hypotheses, and experiments.
- State the sample size behind comparisons.
- Do not invent missing values, motivations, or explanations.

REQUIRED OUTPUT
1. Data receipt: generated time, database, scope, and any freshness warning.
2. Executive summary: maximum 6 concise bullets.
3. Core metrics: UTC today, 7-day, and 30-day liquidity picture.
4. Urgent pending-game risks: ranked, with gameId/title, player gap, time remaining, evidence, and recommended immediate action.
5. Demand-supply gaps: ranked city/sport/time opportunities with supporting numbers.
6. Success/failure patterns: evidence, sample sizes, confidence, and alternative explanations.
7. Commitment findings: cancellations, waitlists, join requests, friendships, and reported no-shows.
8. Five prioritized recommendations. For each include:
   - recommendation;
   - evidence;
   - expected impact (high/medium/low);
   - confidence (high/medium/low);
   - implementation effort (high/medium/low);
   - exact success metric available in this JSON;
   - suggested evaluation period.
9. Data limitations and the single most valuable missing event to track next.

Use plain language. Be direct, quantitative, and concise.`;

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
