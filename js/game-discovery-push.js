function getApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || "http://localhost:3000/api";
}

function getToken() {
    return localStorage.getItem("adminToken");
}

const MAX_RECIPIENTS = 500;
const PAGE_SIZE = 50;

const state = {
    page: 1,
    total: 0,
    hasMore: false,
    withTokenCount: 0,
    selectedIds: new Set(),
    selectAllMatching: false,
    matchingTotal: 0,
    selectedSports: new Set(),
    selectedGame: null,
};

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str ?? "");
    return div.innerHTML;
}

function showError(msg) {
    const el = document.getElementById("error-message");
    const ok = document.getElementById("success-message");
    if (ok) ok.style.display = "none";
    if (!el) return;
    if (msg) {
        el.textContent = msg;
        el.style.display = "block";
    } else {
        el.style.display = "none";
    }
}

function showSuccess(msg) {
    const el = document.getElementById("success-message");
    const err = document.getElementById("error-message");
    if (err) err.style.display = "none";
    if (!el) return;
    el.textContent = msg;
    el.style.display = "block";
}

function sportLabel(slug) {
    return window.AdminSportLabels?.sportSlugToDisplayLabel(slug) || slug || "—";
}

function formatWhen(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function getSegmentFilter() {
    return (document.getElementById("segment-filter")?.value || "").trim();
}

function getSearchFilter() {
    return (document.getElementById("user-search")?.value || "").trim();
}

function getGenderFilter() {
    return (document.getElementById("gender-filter")?.value || "").trim();
}

function getRadiusKm() {
    const raw = (document.getElementById("radius-km")?.value || "").trim();
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
}

function getExcludeMembers() {
    return (document.getElementById("members-filter")?.value || "exclude") !== "include";
}

function getGameId() {
    return (document.getElementById("game-id")?.value || "").trim();
}

function getSportsFilterArray() {
    return Array.from(state.selectedSports);
}

function currentFiltersPayload() {
    return {
        segment: getSegmentFilter() || null,
        sports: getSportsFilterArray(),
        search: getSearchFilter() || null,
        gender: getGenderFilter() || null,
        radiusKm: getRadiusKm(),
        excludeMembers: getExcludeMembers(),
    };
}

function buildCandidatesQuery(page) {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    const segment = getSegmentFilter();
    const search = getSearchFilter();
    const sports = getSportsFilterArray();
    const gender = getGenderFilter();
    const radiusKm = getRadiusKm();
    const gameId = getGameId();
    if (segment) params.set("segment", segment);
    if (search) params.set("search", search);
    if (sports.length) params.set("sports", sports.join(","));
    if (gender) params.set("gender", gender);
    if (radiusKm) params.set("radiusKm", String(radiusKm));
    params.set("excludeMembers", getExcludeMembers() ? "true" : "false");
    if (gameId) params.set("gameId", gameId);
    return params.toString();
}

function gameMetaLine(game) {
    if (!game) return "";
    const sport = sportLabel(game.sport);
    const gender = game.genderRestriction || "mixed";
    const when = formatWhen(game.dateTime);
    const loc = game.hasLocation
        ? game.venueName || game.city || "has location"
        : "no location";
    const group = game.communityName ? ` · ${game.communityName}` : "";
    const spots = Number(game.participantCount) || 0;
    return `${sport} · ${gender} · ${loc}${group}${when ? ` · ${when}` : ""} · ${spots} participants`;
}

function updateRadiusHint() {
    const hint = document.getElementById("radius-hint");
    if (!hint) return;
    const game = state.selectedGame;
    if (!game) {
        hint.textContent = "Select a game with a location to filter by distance.";
        return;
    }
    if (game.hasLocation) {
        const where = game.venueName || game.city || "this game";
        hint.textContent = `Distance is measured from ${where}. Empty = no radius filter.`;
        return;
    }
    hint.textContent = "This game has no location — radius filter cannot be used.";
}

function renderSelectedGame() {
    const el = document.getElementById("selected-game");
    const game = state.selectedGame;
    if (!el) return;
    if (!game) {
        el.style.display = "none";
        el.innerHTML = "";
        updateRadiusHint();
        return;
    }
    el.style.display = "block";
    el.innerHTML = `<div class="title">${escapeHtml(game.title || "Untitled game")}</div>
        <div class="meta">${escapeHtml(gameMetaLine(game))}</div>`;
    updateRadiusHint();
}

function selectGame(game, { reload = true } = {}) {
    state.selectedGame = game || null;
    const input = document.getElementById("game-id");
    if (input && game?.id) input.value = game.id;
    renderSelectedGame();
    if (reload) {
        clearSelection();
        loadCandidates(1);
    }
}

async function searchGames() {
    const list = document.getElementById("game-search-results");
    const token = getToken();
    if (!list || !token) return;
    const q = (document.getElementById("game-search")?.value || "").trim();
    const gender = (document.getElementById("game-gender-filter")?.value || "").trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (gender) params.set("gender", gender);
    params.set("limit", "25");
    try {
        const response = await fetch(
            `${getApiBaseUrl()}/admin/growth/game-push/games?${params.toString()}`,
            { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } },
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
        }
        const results = data.results || [];
        if (results.length === 0) {
            list.innerHTML = `<li class="muted" style="padding:0.5rem 0;">No upcoming activities match.</li>`;
            return;
        }
        const selectedId = state.selectedGame?.id || getGameId();
        list.innerHTML = results
            .map((g) => {
                const id = escapeHtml(g.id || "");
                const selected = g.id === selectedId ? "selected" : "";
                return `<li class="result-item ${selected}" data-game-id="${id}">
                    <div class="title">${escapeHtml(g.title || "Untitled")}</div>
                    <div class="meta">${escapeHtml(gameMetaLine(g))}</div>
                </li>`;
            })
            .join("");
        list.querySelectorAll(".result-item").forEach((item) => {
            item.addEventListener("click", () => {
                const id = item.getAttribute("data-game-id");
                const match = results.find((g) => g.id === id);
                if (match) selectGame(match);
            });
        });
    } catch (e) {
        console.error(e);
        list.innerHTML = `<li class="muted" style="padding:0.5rem 0;">${escapeHtml(e.message || "Failed to search activities")}</li>`;
    }
}

async function resolveGameFromId(id) {
    const token = getToken();
    const gameId = (id || "").trim();
    if (!token || !gameId) {
        state.selectedGame = null;
        renderSelectedGame();
        return;
    }
    if (state.selectedGame?.id === gameId) return;
    try {
        const params = new URLSearchParams({ q: gameId, limit: "5" });
        const response = await fetch(
            `${getApiBaseUrl()}/admin/growth/game-push/games?${params.toString()}`,
            { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } },
        );
        const data = await response.json().catch(() => ({}));
        const match = (data.results || []).find((g) => g.id === gameId) || null;
        selectGame(match, { reload: false });
        if (match) {
            const input = document.getElementById("game-id");
            if (input) input.value = match.id;
        }
    } catch (e) {
        console.error(e);
        state.selectedGame = null;
        renderSelectedGame();
    }
}

function updateSelectionSummary() {
    const el = document.getElementById("selection-summary");
    const banner = document.getElementById("select-all-banner");
    if (state.selectAllMatching) {
        const n = Math.min(state.matchingTotal, MAX_RECIPIENTS);
        if (el) el.textContent = `All matching (${n}${state.matchingTotal > MAX_RECIPIENTS ? ` capped at ${MAX_RECIPIENTS}` : ""})`;
        if (banner) {
            banner.style.display = "block";
            banner.innerHTML = `Sending to <strong>all ${n}</strong> users matching current filters when you click Send. <button type="button" class="btn btn-secondary" style="margin-left:0.5rem;padding:0.15rem 0.5rem;font-size:0.8rem;" onclick="clearSelection()">Cancel</button>`;
        }
        return;
    }
    if (banner) banner.style.display = "none";
    const n = state.selectedIds.size;
    if (el) el.textContent = `${n} selected (max ${MAX_RECIPIENTS})`;
}

function renderSportsChips() {
    const wrap = document.getElementById("sports-chips");
    if (!wrap || !window.AdminSportLabels) return;
    const sports = window.AdminSportLabels.SPORT_DISPLAY_ORDER.filter(
        (s) => !window.AdminSportLabels.SPORTS_EXCLUDED_FROM_FAVORITES.includes(s),
    );
    wrap.innerHTML = sports
        .map((slug) => {
            const label = window.AdminSportLabels.sportSlugToDisplayLabel(slug);
            const checked = state.selectedSports.has(slug) ? "checked" : "";
            const active = state.selectedSports.has(slug) ? "active" : "";
            return `<label class="sport-chip ${active}">
                <input type="checkbox" data-sport="${escapeHtml(slug)}" ${checked} />
                ${escapeHtml(label)}
            </label>`;
        })
        .join("");
    wrap.querySelectorAll("input[data-sport]").forEach((cb) => {
        cb.addEventListener("change", () => {
            const slug = cb.getAttribute("data-sport");
            if (!slug) return;
            if (cb.checked) state.selectedSports.add(slug);
            else state.selectedSports.delete(slug);
            renderSportsChips();
            clearSelection();
        });
    });
}

function syncRowCheckboxes() {
    document.querySelectorAll("#candidates-body input.user-check").forEach((cb) => {
        const id = cb.getAttribute("data-user-id");
        if (!id) return;
        const row = cb.closest("tr");
        let isSelected = false;
        if (state.selectAllMatching) {
            cb.checked = true;
            cb.disabled = true;
            isSelected = true;
        } else {
            cb.disabled = false;
            isSelected = state.selectedIds.has(id);
            cb.checked = isSelected;
        }
        if (row) row.classList.toggle("selected", isSelected);
    });
}

async function loadCandidates(page) {
    const loading = document.getElementById("candidates-loading");
    const wrap = document.getElementById("candidates-wrap");
    const tbody = document.getElementById("candidates-body");
    const meta = document.getElementById("candidates-meta");
    const token = getToken();
    if (!token) {
        showError("Not signed in.");
        return;
    }
    showError("");
    state.page = page;
    if (loading) loading.style.display = "block";
    if (wrap) wrap.style.display = "none";

    try {
        const url = `${getApiBaseUrl()}/admin/growth/game-push/candidates?${buildCandidatesQuery(page)}`;
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

        state.total = data.total ?? 0;
        state.hasMore = Boolean(data.hasMore);
        state.withTokenCount = data.withTokenCount ?? 0;
        state.matchingTotal = state.total;

        const users = data.users || [];
        const segLabel = getSegmentFilter() || "all segments";
        const sportLabelText =
            getSportsFilterArray().length > 0
                ? window.AdminSportLabels?.formatSportSlugList(getSportsFilterArray()) || getSportsFilterArray().join(", ")
                : "any sport";
        const genderLabel = getGenderFilter() || "all genders";
        const radiusLabel = getRadiusKm() ? `${getRadiusKm()} km` : "no radius";
        const membersLabel = getExcludeMembers() ? "excluding participants" : "including participants";
        if (meta) {
            meta.textContent = `${state.total} matching · page ${state.page} · ${state.withTokenCount} with device token on this page · ${segLabel} · ${genderLabel} · ${sportLabelText} · ${radiusLabel} · ${membersLabel}`;
        }

        if (tbody) {
            tbody.innerHTML = users
                .map((u) => {
                    const id = escapeHtml(u.id || "");
                    const name = escapeHtml(u.name || "");
                    const username = escapeHtml(u.username || "");
                    const gender = escapeHtml(u.gender || "—");
                    const segment = escapeHtml(u.segment || "");
                    const sports = window.AdminSportLabels
                        ? escapeHtml(window.AdminSportLabels.formatSportSlugList(u.favoriteSports))
                        : escapeHtml((u.favoriteSports || []).join(", "));
                    const tokenCell = u.hasDeviceToken
                        ? '<span class="token-yes">Yes</span>'
                        : '<span class="token-no">No</span>';
                    const rowClass = u.hasDeviceToken ? "" : "no-token";
                    return `<tr class="${rowClass}" data-user-id="${id}">
                        <td><input type="checkbox" class="user-check" data-user-id="${id}" /></td>
                        <td>${name}</td>
                        <td>${username}</td>
                        <td>${gender}</td>
                        <td><span class="pill pill-${segment}">${segment.replace(/_/g, " ")}</span></td>
                        <td>${sports}</td>
                        <td>${tokenCell}</td>
                    </tr>`;
                })
                .join("");
            tbody.querySelectorAll(".user-check").forEach((cb) => {
                cb.addEventListener("change", () => {
                    if (state.selectAllMatching) return;
                    const uid = cb.getAttribute("data-user-id");
                    if (!uid) return;
                    if (cb.checked) {
                        if (state.selectedIds.size >= MAX_RECIPIENTS) {
                            cb.checked = false;
                            showError(`Select at most ${MAX_RECIPIENTS} users.`);
                            return;
                        }
                        state.selectedIds.add(uid);
                    } else {
                        state.selectedIds.delete(uid);
                    }
                    syncRowCheckboxes();
                    updateSelectionSummary();
                });
            });
            tbody.querySelectorAll("tr[data-user-id]").forEach((row) => {
                row.addEventListener("click", (event) => {
                    const target = event.target;
                    if (target instanceof HTMLInputElement && target.classList.contains("user-check")) return;
                    const cb = row.querySelector("input.user-check");
                    if (!cb || cb.disabled) return;
                    cb.checked = !cb.checked;
                    cb.dispatchEvent(new Event("change", { bubbles: true }));
                });
            });
        }

        syncRowCheckboxes();
        updateSelectionSummary();
        updatePagination();

        if (loading) loading.style.display = "none";
        if (wrap) wrap.style.display = "block";
    } catch (e) {
        console.error(e);
        showError(e.message || "Failed to load candidates");
        if (loading) loading.style.display = "none";
    }
}

function updatePagination() {
    const prev = document.getElementById("btn-prev");
    const next = document.getElementById("btn-next");
    const label = document.getElementById("page-label");
    if (prev) prev.disabled = state.page <= 1;
    if (next) next.disabled = !state.hasMore;
    const totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
    if (label) label.textContent = `Page ${state.page} of ${totalPages}`;
}

function prevPage() {
    if (state.page <= 1) return;
    loadCandidates(state.page - 1);
}

function nextPage() {
    if (!state.hasMore) return;
    loadCandidates(state.page + 1);
}

function selectAllOnPage() {
    state.selectAllMatching = false;
    document.getElementById("select-all-banner").style.display = "none";
    const boxes = document.querySelectorAll("#candidates-body .user-check");
    boxes.forEach((cb) => {
        const uid = cb.getAttribute("data-user-id");
        if (!uid) return;
        if (state.selectedIds.size >= MAX_RECIPIENTS && !state.selectedIds.has(uid)) {
            cb.checked = false;
            return;
        }
        cb.checked = true;
        state.selectedIds.add(uid);
    });
    syncRowCheckboxes();
    updateSelectionSummary();
}

function selectAllMatching() {
    state.selectAllMatching = true;
    state.selectedIds.clear();
    syncRowCheckboxes();
    updateSelectionSummary();
}

function clearSelection() {
    state.selectAllMatching = false;
    state.selectedIds.clear();
    syncRowCheckboxes();
    updateSelectionSummary();
}

async function sendGameDiscoveryPush() {
    const gameId = getGameId();
    const title = (document.getElementById("push-title")?.value || "").trim();
    const body = (document.getElementById("push-body")?.value || "").trim();
    const token = getToken();
    const resultEl = document.getElementById("send-result");

    showError("");
    showSuccess("");
    if (resultEl) resultEl.innerHTML = "";

    if (!gameId) {
        showError("Enter the game ID.");
        return;
    }
    if (!state.selectAllMatching && state.selectedIds.size === 0) {
        showError("Select at least one user or use \u201cSelect all matching filters\u201d.");
        return;
    }
    if (!state.selectAllMatching && state.selectedIds.size > MAX_RECIPIENTS) {
        showError(`Select at most ${MAX_RECIPIENTS} users.`);
        return;
    }
    if (!title) {
        showError("Enter a title.");
        return;
    }
    if (!body) {
        showError("Enter body text.");
        return;
    }
    if (!token) {
        showError("Not signed in.");
        return;
    }

    const btn = document.getElementById("btn-send");
    if (btn) btn.disabled = true;

    const payload = {
        gameId,
        title,
        body,
        selectAll: state.selectAllMatching,
        filters: currentFiltersPayload(),
    };
    if (!state.selectAllMatching) {
        payload.userIds = Array.from(state.selectedIds);
    }

    try {
        const url = `${getApiBaseUrl()}/admin/growth/game-push`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
        }
        const s = data.summary || {};
        const gameTitle = data.game?.title ? ` \u2192 \u201c${data.game.title}\u201d` : "";
        const msg = `Sent: ${s.deliveredToUser ?? 0} · No device: ${s.noDeviceTokens ?? 0} · Failed: ${s.failed ?? 0}${gameTitle}`;
        showSuccess(msg);
        if (resultEl) {
            const rows = (data.results || [])
                .filter((r) => !r.ok)
                .slice(0, 50)
                .map((r) => `<li><code>${escapeHtml(r.userId)}</code> — ${escapeHtml(r.error || "failed")}</li>`)
                .join("");
            resultEl.innerHTML =
                rows.length > 0
                    ? `<p class="muted" style="margin-top:0.75rem;">Issues (first 50):</p><ul style="margin:0;font-size:0.85rem;">${rows}</ul>`
                    : "";
        }
    } catch (e) {
        console.error(e);
        showError(e.message || "Send failed");
    } finally {
        if (btn) btn.disabled = false;
    }
}

function bindFilterReload(el, { debounceMs = 0 } = {}) {
    if (!el) return;
    const eventName = el.tagName === "SELECT" || el.type === "number" ? "change" : "input";
    let t;
    el.addEventListener(eventName, () => {
        const run = () => {
            clearSelection();
            loadCandidates(1);
        };
        if (debounceMs) {
            clearTimeout(t);
            t = setTimeout(run, debounceMs);
        } else {
            run();
        }
    });
}

function initGameDiscoveryPush() {
    renderSportsChips();
    searchGames();

    const gameSearch = document.getElementById("game-search");
    const gameGender = document.getElementById("game-gender-filter");
    const gameId = document.getElementById("game-id");
    let gameSearchTimer;
    if (gameSearch) {
        gameSearch.addEventListener("input", () => {
            clearTimeout(gameSearchTimer);
            gameSearchTimer = setTimeout(searchGames, 300);
        });
    }
    if (gameGender) gameGender.addEventListener("change", searchGames);
    if (gameId) {
        let idTimer;
        gameId.addEventListener("change", () => {
            resolveGameFromId(gameId.value).then(() => {
                clearSelection();
                loadCandidates(1);
            });
        });
        gameId.addEventListener("input", () => {
            clearTimeout(idTimer);
            idTimer = setTimeout(() => resolveGameFromId(gameId.value), 400);
        });
    }

    bindFilterReload(document.getElementById("segment-filter"));
    bindFilterReload(document.getElementById("gender-filter"));
    bindFilterReload(document.getElementById("members-filter"));
    bindFilterReload(document.getElementById("radius-km"));
    bindFilterReload(document.getElementById("user-search"), { debounceMs: 350 });

    loadCandidates(1);
}

window.initGameDiscoveryPush = initGameDiscoveryPush;
window.loadCandidates = loadCandidates;
window.selectAllOnPage = selectAllOnPage;
window.selectAllMatching = selectAllMatching;
window.clearSelection = clearSelection;
window.sendGameDiscoveryPush = sendGameDiscoveryPush;
window.prevPage = prevPage;
window.nextPage = nextPage;
window.searchGames = searchGames;
