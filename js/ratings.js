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

function formatStars(rating) {
    const n = Number(rating);
    if (!Number.isFinite(n) || n < 1 || n > 5) return "—";
    const filled = "★".repeat(n);
    const empty = "☆".repeat(5 - n);
    return `${filled}${empty} (${n})`;
}

function formatUserCell(username, name) {
    const u = typeof username === "string" && username.trim() ? username.trim() : "";
    const n = typeof name === "string" && name.trim() ? name.trim() : "";
    if (u && n && u.toLowerCase() !== n.toLowerCase()) {
        return `<strong>${escapeHtml(u)}</strong><br><span class="muted">${escapeHtml(n)}</span>`;
    }
    if (u) return `<strong>${escapeHtml(u)}</strong>`;
    if (n) return escapeHtml(n);
    return "—";
}

async function fetchRatings() {
    const token = getToken();
    const rater = document.getElementById("rater-filter")?.value?.trim() || "";
    const rated = document.getElementById("rated-filter")?.value?.trim() || "";

    const params = new URLSearchParams();
    if (rater) params.set("rater", rater);
    if (rated) params.set("rated", rated);

    const qs = params.toString();
    const url = `${getApiBaseUrl()}/admin/sport-rankings${qs ? `?${qs}` : ""}`;
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
    return data;
}

function renderRows(items) {
    const body = document.getElementById("ratings-body");
    const wrap = document.getElementById("table-wrap");
    const empty = document.getElementById("empty-note");
    if (!body || !wrap || !empty) return;

    if (!items.length) {
        body.innerHTML = "";
        wrap.style.display = "none";
        empty.style.display = "block";
        return;
    }

    empty.style.display = "none";
    wrap.style.display = "block";
    body.innerHTML = items
        .map(
            (row) => `
            <tr>
                <td>${formatUserCell(row.raterUsername, row.raterName)}</td>
                <td>${formatUserCell(row.ratedUsername, row.ratedName)}</td>
                <td class="stars-cell">${escapeHtml(formatStars(row.rating))}</td>
                <td>${escapeHtml(
                    window.AdminSportLabels?.sportSlugToDisplayLabel(row.sportType) ||
                        row.sportType ||
                        "—",
                )}</td>
                <td>${formatDate(row.createdAt)}</td>
            </tr>
        `,
        )
        .join("");
}

async function loadRatings() {
    const loading = document.getElementById("loading");
    const meta = document.getElementById("meta");

    showError("");
    if (loading) loading.style.display = "block";
    if (meta) meta.textContent = "Loading…";

    try {
        const data = await fetchRatings();
        const rankings = Array.isArray(data.rankings) ? data.rankings : [];
        renderRows(rankings);

        const rater = document.getElementById("rater-filter")?.value?.trim() || "";
        const rated = document.getElementById("rated-filter")?.value?.trim() || "";
        const hasSearch = Boolean(rater || rated);

        if (meta) {
            if (hasSearch) {
                const parts = [];
                if (rater) parts.push(`rater: "${rater}"`);
                if (rated) parts.push(`got rated: "${rated}"`);
                meta.textContent = `${rankings.length} result(s) · search (${parts.join(" · ")})`;
            } else {
                meta.textContent = `Last ${rankings.length} rating(s)`;
            }
        }
        if (loading) loading.style.display = "none";
    } catch (e) {
        console.error(e);
        showError(e.message || "Failed to load ratings");
        if (loading) loading.style.display = "none";
        if (meta) meta.textContent = "";
    }
}

function bindFilters() {
    const raterInput = document.getElementById("rater-filter");
    const ratedInput = document.getElementById("rated-filter");
    const onEnter = (e) => {
        if (e.key === "Enter") loadRatings();
    };
    if (raterInput) raterInput.addEventListener("keydown", onEnter);
    if (ratedInput) ratedInput.addEventListener("keydown", onEnter);
}

window.loadRatings = loadRatings;
window.bindRatingsFilters = bindFilters;
