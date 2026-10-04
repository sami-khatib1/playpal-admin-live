function getApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || "http://localhost:3000/api";
}

function getToken() {
    return localStorage.getItem("adminToken");
}

const UNFILLED_STATE = {
    page: 1,
    limit: 50,
    totalPages: 1,
    total: 0,
    sportsLoaded: false,
};

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

function sportLabel(slug) {
    if (window.AdminSportLabels?.formatSportSlugList) {
        return window.AdminSportLabels.formatSportSlugList([slug]);
    }
    return slug || "—";
}

function formatWhen(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
}

function applyUnfilledFilters(event) {
    if (event) event.preventDefault();
    loadUnfilledGames(1);
}

function changeUnfilledPage(delta) {
    const next = UNFILLED_STATE.page + delta;
    if (next < 1 || next > UNFILLED_STATE.totalPages) return;
    loadUnfilledGames(next);
}

function fillSportOptions(sports) {
    const select = document.getElementById("filter-sport");
    if (!select) return;
    const current = select.value;
    const options = ['<option value="">All sports</option>'].concat(
        (sports || []).map((sport) => {
            const value = escapeHtml(sport);
            return `<option value="${value}">${escapeHtml(sportLabel(sport))}</option>`;
        }),
    );
    select.innerHTML = options.join("");
    if (current && (sports || []).includes(current)) select.value = current;
}

function renderRows(games) {
    const tbody = document.getElementById("unfilled-table-body");
    if (!tbody) return;
    if (!games || games.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="muted">No games under the minimum for these filters.</td></tr>`;
        return;
    }
    tbody.innerHTML = games
        .map((game) => {
            const creator = game.creatorName || game.creatorUsername || "—";
            const creatorSub = game.creatorUsername ? ` @${game.creatorUsername}` : "";
            const players = game.participantCount ?? 0;
            const min = game.minParticipants == null ? "—" : String(game.minParticipants);
            return `<tr>
                <td>${escapeHtml(formatWhen(game.dateTime))}</td>
                <td class="title-cell">${escapeHtml(game.title || "—")}</td>
                <td>${escapeHtml(sportLabel(game.sportType))}</td>
                <td>${escapeHtml(creator)}${creatorSub ? `<div class="muted">${escapeHtml(creatorSub.trim())}</div>` : ""}</td>
                <td>${escapeHtml(String(players))}</td>
                <td>${escapeHtml(min)}</td>
                <td>${escapeHtml(game.communityName || "—")}</td>
                <td>${escapeHtml(game.venueName || "—")}</td>
            </tr>`;
        })
        .join("");
}

async function loadUnfilledGames(page) {
    showError("");
    UNFILLED_STATE.page = page || 1;
    const loading = document.getElementById("loading");
    const wrap = document.getElementById("table-wrap");
    if (loading) loading.style.display = "block";
    if (wrap) wrap.style.display = "none";

    const params = new URLSearchParams();
    params.set("page", String(UNFILLED_STATE.page));
    params.set("limit", String(UNFILLED_STATE.limit));
    const sport = document.getElementById("filter-sport")?.value || "";
    const creator = document.getElementById("filter-creator")?.value || "";
    const title = document.getElementById("filter-title")?.value || "";
    const from = document.getElementById("filter-from")?.value || "";
    const to = document.getElementById("filter-to")?.value || "";
    if (sport) params.set("sportType", sport);
    if (creator.trim()) params.set("creator", creator.trim());
    if (title.trim()) params.set("title", title.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    try {
        const token = getToken();
        const response = await fetch(
            `${getApiBaseUrl()}/admin/analytics/games-under-minimum?${params.toString()}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            },
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            throw new Error(data.error || data.message || `Request failed (${response.status})`);
        }

        if (!UNFILLED_STATE.sportsLoaded || (data.sports || []).length) {
            fillSportOptions(data.sports || []);
            UNFILLED_STATE.sportsLoaded = true;
        }

        UNFILLED_STATE.total = data.total || 0;
        UNFILLED_STATE.totalPages = data.totalPages || 0;
        UNFILLED_STATE.page = data.page || UNFILLED_STATE.page;

        const meta = document.getElementById("meta");
        if (meta) {
            if (data.columnReady === false) {
                meta.textContent =
                    "This database does not keep unfilled games. Switch DB to Staging to see them.";
            } else {
                meta.textContent = `${UNFILLED_STATE.total} game${UNFILLED_STATE.total === 1 ? "" : "s"} under the minimum.`;
            }
        }
        renderRows(data.games || []);
        const pageLabel = document.getElementById("page-label");
        if (pageLabel) {
            pageLabel.textContent = UNFILLED_STATE.totalPages
                ? `Page ${UNFILLED_STATE.page} of ${UNFILLED_STATE.totalPages}`
                : "Page 1";
        }
        const prev = document.getElementById("prev-page");
        const next = document.getElementById("next-page");
        if (prev) prev.disabled = UNFILLED_STATE.page <= 1;
        if (next) next.disabled = UNFILLED_STATE.page >= UNFILLED_STATE.totalPages;
    } catch (err) {
        showError(err.message || "Failed to load games");
        const meta = document.getElementById("meta");
        if (meta) meta.textContent = "";
        renderRows([]);
    } finally {
        if (loading) loading.style.display = "none";
        if (wrap) wrap.style.display = "block";
    }
}
