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
    const url = `${getApiBaseUrl()}${path}`;
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
    return data;
}

function renderKpiGrid(containerId, pairs) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = pairs
        .map(
            ([label, value]) =>
                `<div class="kpi-tile"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(
                    String(value)
                )}</div></div>`
        )
        .join("");
}

function fmtWhen(v) {
    if (!v) return "—";
    try {
        return new Date(v).toLocaleString();
    } catch (_) {
        return String(v);
    }
}

const STATE = {
    tab: "groups",
    selectedChannelId: null,
    oldestId: null,
    hasMore: false,
    messages: [],
};

function setSearchTab(tab) {
    STATE.tab = tab === "pending" ? "pending" : "groups";
    document.getElementById("tab-groups")?.classList.toggle("active", STATE.tab === "groups");
    document.getElementById("tab-pending")?.classList.toggle("active", STATE.tab === "pending");
    const input = document.getElementById("chat-search-q");
    if (input) {
        input.placeholder =
            STATE.tab === "groups"
                ? "Group name, sport, city, or id…"
                : "Activity title, sport, or id…";
    }
    runSearch();
}

async function loadChatStats() {
    showError("");
    const kpis = document.getElementById("chat-stats-kpis");
    if (kpis) kpis.innerHTML = "Loading…";
    try {
        const data = await adminFetch("/admin/chat/stats");
        const cSample = data.communityChannelsSample;
        const pSample = data.pendingChannelsSample;
        renderKpiGrid("chat-stats-kpis", [
            ["Groups (total)", data.communitiesTotal ?? "—"],
            ["Pending activities", data.pendingGamesTotal ?? "—"],
            ["Games (rows)", data.gamesTotal ?? "—"],
            ["Groups created 7d", data.communitiesCreated7d ?? "—"],
            ["Pending created 7d", data.pendingCreated7d ?? "—"],
            ["Active group chats (7d sample)", data.activeCommunityChannels7d ?? "—"],
            ["Active game chats (7d sample)", data.activeGameChannels7d ?? "—"],
            [
                "Recent groups w/ channel",
                cSample
                    ? `${cSample.withChannel}/${cSample.sampled}`
                    : "—",
            ],
            [
                "Recent pending w/ channel",
                pSample
                    ? `${pSample.withChannel}/${pSample.sampled}`
                    : "—",
            ],
            ["Stream", data.streamAvailable ? "OK" : "Unavailable"],
        ]);
        const note = document.getElementById("chat-stats-note");
        if (note) note.textContent = data.note || "";
    } catch (e) {
        showError(e.message || "Failed to load chat stats");
        if (kpis) kpis.innerHTML = `<span class="muted">Error</span>`;
    }
}

function renderResults(results) {
    const list = document.getElementById("chat-search-results");
    if (!list) return;
    if (!results || results.length === 0) {
        list.innerHTML = `<li class="empty-state">No results.</li>`;
        return;
    }
    list.innerHTML = results
        .map((r) => {
            const selected = r.channelId === STATE.selectedChannelId ? " selected" : "";
            const channelPill = r.channelExists
                ? `<span class="pill pill-ok">chat</span>`
                : `<span class="pill pill-miss">no channel yet</span>`;
            const extra =
                r.kind === "community"
                    ? `${escapeHtml(r.sport || "")} · ${escapeHtml(r.city || "—")} · ${r.membersCount ?? 0} members`
                    : `${escapeHtml(r.sport || "")} · ${fmtWhen(r.dateTime)} · ${r.participantsCount ?? 0} players`;
            const preview = r.lastMessagePreview
                ? `<div class="preview">${escapeHtml(r.lastMessagePreview)}</div>`
                : "";
            return (
                `<li class="result-item${selected}" data-channel-id="${escapeHtml(r.channelId)}">` +
                `<div class="title">${channelPill}${escapeHtml(r.title || r.id)}</div>` +
                `<div class="meta">${extra}</div>` +
                preview +
                `</li>`
            );
        })
        .join("");

    list.querySelectorAll(".result-item").forEach((el) => {
        el.addEventListener("click", () => {
            const id = el.getAttribute("data-channel-id");
            if (id) openChat(id);
        });
    });
}

async function runSearch() {
    showError("");
    const q = document.getElementById("chat-search-q")?.value?.trim() || "";
    const list = document.getElementById("chat-search-results");
    if (list) list.innerHTML = `<li class="empty-state">Searching…</li>`;
    const params = new URLSearchParams({ limit: "30" });
    if (q) params.set("q", q);
    try {
        const path =
            STATE.tab === "pending"
                ? `/admin/chat/pending-games?${params}`
                : `/admin/chat/communities?${params}`;
        const data = await adminFetch(path);
        renderResults(data.results || []);
    } catch (e) {
        showError(e.message || "Search failed");
        if (list) list.innerHTML = `<li class="empty-state">Error</li>`;
    }
}

function renderMessages() {
    const body = document.getElementById("messages-body");
    if (!body) return;
    if (!STATE.messages.length) {
        body.innerHTML = `<div class="empty-state">No messages in this channel (or channel not created yet).</div>`;
        return;
    }
    body.innerHTML = STATE.messages
        .map((m) => {
            const sys = m.type && m.type !== "regular" ? " system" : "";
            return (
                `<div class="msg${sys}">` +
                `<span class="who">${escapeHtml(m.userName)}</span>` +
                `<span class="when">${escapeHtml(fmtWhen(m.createdAt))}</span>` +
                `<div class="body">${escapeHtml(m.text)}</div>` +
                `</div>`
            );
        })
        .join("");
    body.scrollTop = body.scrollHeight;
}

function setMessagesHeader(entity, meta) {
    const title = document.getElementById("messages-title");
    const metaEl = document.getElementById("messages-meta");
    if (title) {
        title.textContent = entity?.title || entity?.id || "Chat";
    }
    if (metaEl) {
        const bits = [];
        if (entity?.kind) bits.push(entity.kind.replace("_", " "));
        if (entity?.sport) bits.push(entity.sport);
        if (entity?.channelId) bits.push(entity.channelId);
        if (meta?.memberCount != null) bits.push(`${meta.memberCount} members`);
        if (meta?.lastMessageAt) bits.push(`last ${fmtWhen(meta.lastMessageAt)}`);
        if (entity?.deleted) bits.push("deleted");
        metaEl.textContent = bits.join(" · ");
    }
}

async function openChat(channelId) {
    showError("");
    STATE.selectedChannelId = channelId;
    STATE.messages = [];
    STATE.oldestId = null;
    STATE.hasMore = false;
    document.getElementById("msg-refresh-btn").disabled = false;
    document.getElementById("msg-older-btn").disabled = true;
    document.getElementById("messages-body").innerHTML =
        `<div class="empty-state">Loading messages…</div>`;
    document.querySelectorAll(".result-item").forEach((el) => {
        el.classList.toggle("selected", el.getAttribute("data-channel-id") === channelId);
    });

    try {
        const data = await adminFetch(
            `/admin/chat/channels/${encodeURIComponent(channelId)}/messages?limit=50`
        );
        STATE.messages = data.messages || [];
        STATE.oldestId = data.oldestId || null;
        STATE.hasMore = !!data.hasMore;
        document.getElementById("msg-older-btn").disabled = !STATE.hasMore;
        setMessagesHeader(data.entity, {
            memberCount: data.memberCount,
            lastMessageAt: data.lastMessageAt,
        });
        if (data.error && !data.exists) {
            showError(data.error);
        }
        renderMessages();
    } catch (e) {
        showError(e.message || "Failed to load messages");
        document.getElementById("messages-body").innerHTML =
            `<div class="empty-state">Error loading messages.</div>`;
    }
}

async function loadOlderMessages() {
    if (!STATE.selectedChannelId || !STATE.oldestId || !STATE.hasMore) return;
    showError("");
    try {
        const qs = new URLSearchParams({
            limit: "50",
            before: STATE.oldestId,
        });
        const data = await adminFetch(
            `/admin/chat/channels/${encodeURIComponent(STATE.selectedChannelId)}/messages?${qs}`
        );
        const older = data.messages || [];
        const existingIds = new Set(STATE.messages.map((m) => m.id));
        const merged = [...older.filter((m) => !existingIds.has(m.id)), ...STATE.messages];
        STATE.messages = merged;
        STATE.oldestId = data.oldestId || STATE.oldestId;
        STATE.hasMore = !!data.hasMore;
        document.getElementById("msg-older-btn").disabled = !STATE.hasMore;
        renderMessages();
    } catch (e) {
        showError(e.message || "Failed to load older messages");
    }
}

function refreshSelectedMessages() {
    if (STATE.selectedChannelId) openChat(STATE.selectedChannelId);
}

function initChatMonitorPage() {
    const input = document.getElementById("chat-search-q");
    if (input) {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") runSearch();
        });
    }
    loadChatStats();
    runSearch();
}

window.loadChatStats = loadChatStats;
window.setSearchTab = setSearchTab;
window.runSearch = runSearch;
window.openChat = openChat;
window.loadOlderMessages = loadOlderMessages;
window.refreshSelectedMessages = refreshSelectedMessages;
window.initChatMonitorPage = initChatMonitorPage;
