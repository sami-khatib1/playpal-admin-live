function getApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || "http://localhost:3000/api";
}

function getToken() {
    return localStorage.getItem("adminToken");
}

let lastScrapePayload = null;

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

function renderRows(games) {
    const tbody = document.getElementById("games-table-body");
    if (!tbody) return;
    if (!games || games.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="muted">No pending games.</td></tr>`;
        return;
    }
    tbody.innerHTML = games
        .map((game) => {
            const people = Array.isArray(game.users) ? game.users.length : 0;
            const friends = Array.isArray(game.friendships) ? game.friendships.length : 0;
            return `<tr>
                <td>${escapeHtml(formatWhen(game.createdAt))}</td>
                <td>${escapeHtml(formatWhen(game.dateTime))}</td>
                <td class="title-cell">${escapeHtml(game.title || "—")}</td>
                <td>${escapeHtml(sportLabel(game.sportType))}</td>
                <td>${escapeHtml(String(people))}</td>
                <td>${escapeHtml(String(friends))}</td>
            </tr>`;
        })
        .join("");
}

function scrapeFileName() {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `claude-games-scraping-pending-${stamp}.json`;
}

function copyScrapeJson() {
    if (!lastScrapePayload) return;
    const text = JSON.stringify(lastScrapePayload, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {
            showError("Could not copy JSON");
        });
        return;
    }
    showError("Clipboard is not available in this browser");
}

function downloadScrapeJson() {
    if (!lastScrapePayload) return;
    const blob = new Blob([JSON.stringify(lastScrapePayload, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = scrapeFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function loadPendingGamesScrape() {
    showError("");
    const loading = document.getElementById("loading");
    const wrap = document.getElementById("table-wrap");
    const jsonView = document.getElementById("json-view");
    if (loading) loading.style.display = "block";
    if (wrap) wrap.style.display = "none";
    if (jsonView) jsonView.textContent = "Loading…";

    try {
        const token = getToken();
        const response = await fetch(`${getApiBaseUrl()}/admin/claude-games-scraping`, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            const errBody = data && data.error;
            const errText = typeof errBody === "string"
                ? errBody
                : (errBody && errBody.message) || data.message || `Request failed (${response.status})`;
            throw new Error(response.status === 404
                ? "The pending-games scrape API is not on this server yet."
                : errText);
        }

        lastScrapePayload = data;
        const games = data.games || [];
        const meta = document.getElementById("meta");
        if (meta) {
            const when = data.scrapedAt ? formatWhen(data.scrapedAt) : "just now";
            const db = data.database ? ` · ${data.database}` : "";
            meta.textContent = `${data.total ?? games.length} pending game${(data.total ?? games.length) === 1 ? "" : "s"} · scraped ${when}${db}`;
        }
        renderRows(games);
        if (jsonView) jsonView.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
        lastScrapePayload = null;
        const raw = err && err.message ? err.message : "Failed to load pending games";
        const msg = /failed to fetch|networkerror/i.test(raw)
            ? "Cannot reach the API. Check the dashboard network mode, then refresh."
            : raw;
        showError(msg);
        const meta = document.getElementById("meta");
        if (meta) meta.textContent = "";
        renderRows([]);
        if (jsonView) jsonView.textContent = "";
    } finally {
        if (loading) loading.style.display = "none";
        if (wrap) wrap.style.display = "block";
    }
}
