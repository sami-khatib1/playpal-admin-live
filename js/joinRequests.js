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

function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function statusBadge(status) {
    const normalized = String(status || "pending").toLowerCase();
    let cls = "badge-pending";
    if (normalized === "approved") cls = "badge-approved";
    else if (normalized === "rejected") cls = "badge-rejected";
    return `<span class="badge ${cls}">${escapeHtml(normalized)}</span>`;
}

function pickValue(obj, keys, fallback = "—") {
    for (const key of keys) {
        const v = obj?.[key];
        if (v !== undefined && v !== null && String(v).trim() !== "") {
            return String(v);
        }
    }
    return fallback;
}

function pickUserName(obj, keyCandidates) {
    for (const key of keyCandidates) {
        const user = obj?.[key];
        if (typeof user === "string" && user.trim()) return user.trim();
        if (user && typeof user === "object") {
            const name = user.name || user.username || user.email || user.id;
            if (name) return String(name);
        }
    }
    return "—";
}

function normalizeResponse(data) {
    const source = data || {};

    let gameRequests =
        source.gameRequests ||
        source.gameJoinRequests ||
        source.games ||
        source.privateGameJoinRequests ||
        source.requests?.games ||
        source.data?.gameRequests ||
        source.data?.games ||
        [];

    let groupRequests =
        source.groupRequests ||
        source.communityRequests ||
        source.communityJoinRequests ||
        source.privateCommunityJoinRequests ||
        source.requests?.groups ||
        source.requests?.communities ||
        source.data?.groupRequests ||
        source.data?.communityRequests ||
        [];

    if (!Array.isArray(gameRequests) || !Array.isArray(groupRequests)) {
        const combined =
            source.requests ||
            source.data?.requests ||
            source.items ||
            source.data?.items ||
            [];
        if (Array.isArray(combined)) {
            gameRequests = combined.filter((r) => {
                const kind = String(r?.type || r?.requestType || "").toLowerCase();
                return kind.includes("game");
            });
            groupRequests = combined.filter((r) => {
                const kind = String(r?.type || r?.requestType || "").toLowerCase();
                return kind.includes("community") || kind.includes("group");
            });
        }
    }

    return {
        gameRequests: Array.isArray(gameRequests) ? gameRequests : [],
        groupRequests: Array.isArray(groupRequests) ? groupRequests : [],
        counts: source.counts || null,
    };
}

function applyFilters(items) {
    const status = document.getElementById("status-filter")?.value?.trim().toLowerCase() || "";
    const search = document.getElementById("search-filter")?.value?.trim().toLowerCase() || "";

    return items.filter((item) => {
        const itemStatus = String(item?.status || "").toLowerCase();
        if (status && itemStatus !== status) return false;

        if (!search) return true;
        const haystack = [
            pickValue(item, ["targetName", "title", "gameTitle", "communityName", "groupName", "name"], ""),
            pickUserName(item, ["requesterName", "requester", "user", "requestUser", "createdBy", "requesterUser"]),
            pickUserName(item, ["creator", "gameCreator", "admin", "communityAdmin"]),
        ]
            .join(" ")
            .toLowerCase();

        return haystack.includes(search);
    });
}

function renderGameRequests(items) {
    const body = document.getElementById("games-requests-body");
    const wrap = document.getElementById("games-wrap");
    const empty = document.getElementById("games-empty");
    if (!body || !wrap || !empty) return;

    if (!items.length) {
        body.innerHTML = "";
        wrap.style.display = "none";
        empty.style.display = "block";
        return;
    }

    body.innerHTML = items
        .map((row) => `
            <tr>
                <td>${escapeHtml(pickUserName(row, ["requesterName", "requester", "user", "requestUser", "createdBy", "requesterUser"]))}</td>
                <td>${escapeHtml(pickValue(row, ["targetName", "gameTitle", "title", "gameName", "name"]))}</td>
                <td>${escapeHtml(pickUserName(row, ["creator", "gameCreator", "owner", "admin"]))}</td>
                <td>${statusBadge(row.status)}</td>
                <td>${escapeHtml(formatDate(pickValue(row, ["createdAt", "requestedAt"], "")))}</td>
            </tr>
        `)
        .join("");
    wrap.style.display = "block";
    empty.style.display = "none";
}

function renderGroupRequests(items) {
    const body = document.getElementById("groups-requests-body");
    const wrap = document.getElementById("groups-wrap");
    const empty = document.getElementById("groups-empty");
    if (!body || !wrap || !empty) return;

    if (!items.length) {
        body.innerHTML = "";
        wrap.style.display = "none";
        empty.style.display = "block";
        return;
    }

    body.innerHTML = items
        .map((row) => `
            <tr>
                <td>${escapeHtml(pickUserName(row, ["requesterName", "requester", "user", "requestUser", "createdBy", "requesterUser"]))}</td>
                <td>${escapeHtml(pickValue(row, ["targetName", "communityName", "groupName", "title", "name"]))}</td>
                <td>${escapeHtml(pickUserName(row, ["admin", "communityAdmin", "creator", "owner"]))}</td>
                <td>${statusBadge(row.status)}</td>
                <td>${escapeHtml(formatDate(pickValue(row, ["createdAt", "requestedAt"], "")))}</td>
            </tr>
        `)
        .join("");
    wrap.style.display = "block";
    empty.style.display = "none";
}

async function fetchJoinRequests() {
    const token = getToken();
    if (!token) throw new Error("Not signed in.");

    const baseUrl = getApiBaseUrl();
    const endpoints = [
        "/admin/join-requests",
        "/admin/private-join-requests",
        "/admin/join-requests/private",
    ];

    let lastError = null;
    for (const endpoint of endpoints) {
        try {
            const url = `${baseUrl}${endpoint}`;
            const res = await fetch(url, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false) {
                throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
            }
            return normalizeResponse(data);
        } catch (error) {
            lastError = error;
        }
    }

    throw new Error(
        (lastError && lastError.message) ||
            "Failed to fetch join requests from admin endpoint."
    );
}

async function loadJoinRequests() {
    const loading = document.getElementById("loading");
    const content = document.getElementById("content");
    const meta = document.getElementById("meta");

    showError("");
    if (loading) loading.style.display = "block";
    if (content) content.style.display = "none";
    if (meta) meta.textContent = "Loading...";

    try {
        const { gameRequests, groupRequests, counts } = await fetchJoinRequests();
        const filteredGames = applyFilters(gameRequests);
        const filteredGroups = applyFilters(groupRequests);

        renderGameRequests(filteredGames);
        renderGroupRequests(filteredGroups);

        const total = filteredGames.length + filteredGroups.length;
        if (meta) {
            const apiLine =
                counts && typeof counts.total === "number"
                    ? `API pending: ${counts.total} (${counts.game ?? 0} game · ${counts.community ?? 0} group) · `
                    : "";
            meta.textContent = `${apiLine}${total} shown · ${filteredGames.length} games · ${filteredGroups.length} groups`;
        }
        if (loading) loading.style.display = "none";
        if (content) content.style.display = "grid";
    } catch (e) {
        console.error(e);
        showError(e.message || "Failed to load join requests");
        if (loading) loading.style.display = "none";
        if (meta) meta.textContent = "";
    }
}

window.loadJoinRequests = loadJoinRequests;
