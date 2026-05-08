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

function formatDateTime(value) {
    if (!value) return "—";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function renderRows(tbodyId, rows, emptyLabel) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    if (!Array.isArray(rows) || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="muted">${escapeHtml(emptyLabel)}</td></tr>`;
        return;
    }
    tbody.innerHTML = rows
        .map((row) => {
            return (
                `<tr>` +
                `<td>${escapeHtml(row.requesterName || "Unknown user")}</td>` +
                `<td>${escapeHtml(row.targetName || "—")}</td>` +
                `<td>${escapeHtml(formatDateTime(row.requestedAt))}</td>` +
                `</tr>`
            );
        })
        .join("");
}

async function loadJoinRequests() {
    showError("");
    const token = getToken();
    if (!token) {
        showError("Not signed in.");
        return;
    }

    const overviewMeta = document.getElementById("overview-meta");
    const gamesMeta = document.getElementById("games-meta");
    const communitiesMeta = document.getElementById("communities-meta");
    if (overviewMeta) overviewMeta.textContent = "Loading…";
    if (gamesMeta) gamesMeta.textContent = "Loading…";
    if (communitiesMeta) communitiesMeta.textContent = "Loading…";

    try {
        const response = await fetch(`${getApiBaseUrl()}/admin/join-requests`, {
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

        const gameRequests = Array.isArray(data.gameRequests) ? data.gameRequests : [];
        const communityRequests = Array.isArray(data.communityRequests) ? data.communityRequests : [];
        const counts = data.counts || {};

        if (overviewMeta) {
            overviewMeta.textContent = `Total pending: ${Number(counts.total) || 0} (${Number(counts.game) || 0} game, ${Number(counts.community) || 0} group)`;
        }
        if (gamesMeta) {
            gamesMeta.innerHTML = `<strong>${gameRequests.length}</strong> pending private game request${gameRequests.length === 1 ? "" : "s"} (pending games only)`;
        }
        if (communitiesMeta) {
            communitiesMeta.innerHTML = `<strong>${communityRequests.length}</strong> pending private group request${communityRequests.length === 1 ? "" : "s"}`;
        }

        renderRows("game-requests-body", gameRequests, "No pending private game requests.");
        renderRows("community-requests-body", communityRequests, "No pending private group requests.");
    } catch (error) {
        console.error(error);
        showError(error.message || "Failed to load join requests");
        renderRows("game-requests-body", [], "Error loading requests.");
        renderRows("community-requests-body", [], "Error loading requests.");
        if (overviewMeta) overviewMeta.textContent = "";
        if (gamesMeta) gamesMeta.textContent = "";
        if (communitiesMeta) communitiesMeta.textContent = "";
    }
}

window.loadJoinRequests = loadJoinRequests;
