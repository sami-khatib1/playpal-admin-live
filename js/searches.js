function getApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || "http://localhost:3000/api";
}

function getToken() {
    return localStorage.getItem("adminToken");
}

const SEARCH_STATE = {
    page: 1,
    limit: 50,
    totalPages: 1,
    loading: false,
    activeType: "all",
};

const TYPE_LABELS = {
    activity: "Activities",
    group: "Groups",
    user: "People",
    explore: "Explore chips",
};

const FILTER_LABELS = {
    city: "City",
    date: "Date",
    time: "Time",
    genderFilter: "Gender",
    maxDistance: "Distance",
    dateStart: "From",
    dateEnd: "Until",
    searchBy: "Search by",
    status: "Status",
    availableSlots: "Open spots",
    excludeCommunityGames: "Hide group games",
};

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str ?? "");
    return div.innerHTML;
}

function sportLabel(slug) {
    if (!slug) return "—";
    if (window.AdminSportLabels?.sportSlugToDisplayLabel) {
        return window.AdminSportLabels.sportSlugToDisplayLabel(slug);
    }
    return String(slug);
}

function dayStartIso(dateStr) {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || !month || !day) return "";
    return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function dayEndIso(dateStr) {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || !month || !day) return "";
    return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

function fillSportOptions() {
    const select = document.getElementById("filter-sport");
    if (!select || select.dataset.ready === "1") return;
    const slugs = window.AdminSportLabels?.SPORT_DISPLAY_ORDER || [];
    slugs.forEach((slug) => {
        const option = document.createElement("option");
        option.value = slug;
        option.textContent = sportLabel(slug);
        select.appendChild(option);
    });
    select.dataset.ready = "1";
}

function buildQuery() {
    const params = new URLSearchParams();
    params.set("page", String(SEARCH_STATE.page));
    params.set("limit", String(SEARCH_STATE.limit));

    const type = document.getElementById("filter-type")?.value || "all";
    const sport = document.getElementById("filter-sport")?.value || "all";
    const gender = document.getElementById("filter-gender")?.value || "all";
    const kind = document.getElementById("filter-kind")?.value || "any";
    const q = (document.getElementById("filter-q")?.value || "").trim();
    const user = (document.getElementById("filter-user")?.value || "").trim();
    const from = dayStartIso(document.getElementById("filter-from")?.value || "");
    const to = dayEndIso(document.getElementById("filter-to")?.value || "");

    SEARCH_STATE.activeType = type;
    if (type !== "all") params.set("type", type);
    if (sport !== "all") params.set("sport", sport);
    if (gender !== "all") params.set("gender", gender);
    if (kind !== "any") params.set("kind", kind);
    if (q) params.set("q", q);
    if (user) params.set("user", user);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
}

function formatFilters(filters) {
    if (!filters || typeof filters !== "object") return "—";
    // City / date / time have their own columns.
    const skip = new Set(["city", "date", "time", "lat", "lng", "refLatitude", "refLongitude"]);
    const lines = [];
    Object.keys(filters).forEach((key) => {
        if (skip.has(key)) return;
        const value = filters[key];
        if (value == null || value === "") return;
        const label = FILTER_LABELS[key] || key;
        let shown = value;
        if (key === "maxDistance") shown = `${value} km`;
        if (key === "genderFilter") shown = String(value).charAt(0).toUpperCase() + String(value).slice(1);
        if (value === true) shown = "Yes";
        lines.push(`${label}: ${shown}`);
    });
    return lines.length ? lines.join("\n") : "—";
}

function formatSearchDateTime(item) {
    const filters = item?.filters && typeof item.filters === "object" ? item.filters : {};
    if (filters.date || filters.time) {
        return {
            date: filters.date || "—",
            time: filters.time || "—",
        };
    }
    if (!item?.searchedAt) return { date: "—", time: "—" };
    const when = new Date(item.searchedAt);
    return {
        date: when.toLocaleDateString(),
        time: when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
}

function renderSummary(summary) {
    const host = document.getElementById("summary");
    const total = Number(summary?.total || 0);
    const byType = summary?.byType || {};
    const cards = [
        { type: "all", label: "Matching searches", count: total },
        { type: "activity", label: "Activities", count: byType.activity || 0 },
        { type: "group", label: "Groups", count: byType.group || 0 },
        { type: "user", label: "People", count: byType.user || 0 },
        { type: "explore", label: "Explore chips", count: byType.explore || 0 },
    ];
    host.innerHTML = cards
        .map((card) => {
            const active = SEARCH_STATE.activeType === card.type ? " is-active" : "";
            return (
                `<button type="button" class="summary-card${active}" data-type="${card.type}">` +
                `<span class="count">${escapeHtml(card.count)}</span>` +
                `<span class="label">${escapeHtml(card.label)}</span>` +
                `</button>`
            );
        })
        .join("");
    host.querySelectorAll("[data-type]").forEach((button) => {
        button.addEventListener("click", () => {
            const type = button.getAttribute("data-type") || "all";
            const select = document.getElementById("filter-type");
            if (select) select.value = type;
            SEARCH_STATE.page = 1;
            loadSearches();
        });
    });
}

function renderChips(id, items, onPick, emptyText) {
    const host = document.getElementById(id);
    if (!items || items.length === 0) {
        host.innerHTML = "";
        return;
    }
    host.innerHTML = items
        .map((item, index) => {
            return (
                `<button type="button" class="chip" data-index="${index}">` +
                `${escapeHtml(item.label)} <strong>${escapeHtml(item.count)}</strong>` +
                `</button>`
            );
        })
        .join("");
    host.querySelectorAll(".chip").forEach((button) => {
        button.addEventListener("click", () => {
            const index = Number(button.getAttribute("data-index"));
            onPick(items[index]);
        });
    });
    if (emptyText) host.setAttribute("aria-label", emptyText);
}

async function fetchSearches() {
    const token = getToken();
    const url = `${getApiBaseUrl()}/admin/searches?${buildQuery()}`;
    const response = await fetch(url, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.error || "Failed to fetch searches");
    }
    return data;
}

function renderRows(items) {
    const tbody = document.getElementById("search-table-body");
    tbody.innerHTML = "";
    if (!items || items.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="8" class="muted">No searches match these filters.</td>`;
        tbody.appendChild(tr);
        return;
    }

    items.forEach((item) => {
        const { date, time } = formatSearchDateTime(item);
        const type = TYPE_LABELS[item.type] || item.type || "—";
        const query = String(item.query || "").trim();
        const queryHtml = query
            ? escapeHtml(query)
            : `<span class="query-empty">Filters only</span>`;
        const city =
            item?.filters && typeof item.filters === "object" && item.filters.city
                ? String(item.filters.city)
                : "—";
        const name = item.userName || (item.userId ? "Unknown user" : "Anonymous");
        const userTitle = [item.username, item.userId].filter(Boolean).join(" · ");
        const tr = document.createElement("tr");
        tr.innerHTML =
            `<td>${escapeHtml(date)}</td>` +
            `<td>${escapeHtml(time)}</td>` +
            `<td><span class="pill">${escapeHtml(type)}</span></td>` +
            `<td>${queryHtml}</td>` +
            `<td>${escapeHtml(sportLabel(item.sport))}</td>` +
            `<td>${escapeHtml(city)}</td>` +
            `<td title="${escapeHtml(userTitle)}">${escapeHtml(name)}</td>` +
            `<td class="filters-cell">${escapeHtml(formatFilters(item.filters))}</td>`;
        tbody.appendChild(tr);
    });
}

function setLoading(loading) {
    SEARCH_STATE.loading = loading;
    document.getElementById("loading").style.display = loading ? "block" : "none";
    document.getElementById("table-wrap").style.display = loading ? "none" : "block";
}

function setMeta(pagination) {
    const total = Number(pagination?.total || 0);
    const totalPages = Number(pagination?.totalPages || 1);
    SEARCH_STATE.totalPages = totalPages;
    const page = Number(pagination?.page || SEARCH_STATE.page || 1);
    SEARCH_STATE.page = page;
    document.getElementById("meta").textContent = `${total} search${total === 1 ? "" : "es"}`;
    document.getElementById("page-info").textContent = `Page ${page} of ${totalPages}`;
}

function showError(message) {
    const el = document.getElementById("error-message");
    if (!message) {
        el.style.display = "none";
        el.textContent = "";
        return;
    }
    el.style.display = "block";
    el.textContent = message;
}

async function loadSearches() {
    if (SEARCH_STATE.loading) return;
    setLoading(true);
    showError("");
    try {
        const payload = await fetchSearches();
        renderSummary(payload.summary);
        renderChips(
            "top-queries",
            (payload.summary?.topQueries || []).map((item) => ({
                label: item.query,
                count: item.count,
                query: item.query,
            })),
            (item) => {
                const input = document.getElementById("filter-q");
                if (input) input.value = item.query || "";
                const kind = document.getElementById("filter-kind");
                if (kind && kind.value === "filters") kind.value = "any";
                SEARCH_STATE.page = 1;
                loadSearches();
            },
        );
        renderChips(
            "top-sports",
            (payload.summary?.topSports || []).map((item) => ({
                label: sportLabel(item.sport),
                count: item.count,
                sport: item.sport,
            })),
            (item) => {
                const select = document.getElementById("filter-sport");
                if (select) {
                    const exists = Array.from(select.options).some((option) => option.value === item.sport);
                    if (!exists) {
                        const option = document.createElement("option");
                        option.value = item.sport;
                        option.textContent = sportLabel(item.sport);
                        select.appendChild(option);
                    }
                    select.value = item.sport;
                }
                SEARCH_STATE.page = 1;
                loadSearches();
            },
        );
        renderRows(payload.data);
        setMeta(payload.pagination);
    } catch (error) {
        showError(error.message || "Failed to load searches");
        renderRows([]);
        document.getElementById("meta").textContent = "Could not load searches";
    } finally {
        setLoading(false);
    }
}

function prevPage() {
    if (SEARCH_STATE.page <= 1 || SEARCH_STATE.loading) return;
    SEARCH_STATE.page -= 1;
    loadSearches();
}

function nextPage() {
    if (SEARCH_STATE.page >= SEARCH_STATE.totalPages || SEARCH_STATE.loading) return;
    SEARCH_STATE.page += 1;
    loadSearches();
}

function clearSearchFilters() {
    ["filter-type", "filter-sport", "filter-gender"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "all";
    });
    const kind = document.getElementById("filter-kind");
    if (kind) kind.value = "any";
    ["filter-from", "filter-to", "filter-q", "filter-user"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    SEARCH_STATE.page = 1;
    loadSearches();
}

function initSearchesPage() {
    fillSportOptions();
    const onFilterChange = () => {
        SEARCH_STATE.page = 1;
        loadSearches();
    };
    ["filter-type", "filter-sport", "filter-gender", "filter-kind", "filter-from", "filter-to"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", onFilterChange);
    });
    ["filter-q", "filter-user"].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        let timer = null;
        el.addEventListener("input", () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(onFilterChange, 300);
        });
    });
    loadSearches();
}

window.initSearchesPage = initSearchesPage;
window.loadSearches = loadSearches;
window.clearSearchFilters = clearSearchFilters;
window.prevPage = prevPage;
window.nextPage = nextPage;
