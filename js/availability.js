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

function dayLabel(day) {
    const map = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const n = Number(day);
    return Number.isInteger(n) && n >= 0 && n <= 6 ? map[n] : String(day ?? "—");
}

function timeLabel(timeSection) {
    if (!timeSection) return "—";
    const v = String(timeSection).toLowerCase();
    if (v === "morning") return "Morning";
    if (v === "noon") return "Noon";
    if (v === "evening") return "Evening";
    return String(timeSection);
}

function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function renderRows(votes) {
    const tbody = document.getElementById("availability-table-body");
    if (!tbody) return;
    tbody.innerHTML = votes
        .map((row) => `
            <tr>
                <td>${escapeHtml(row.city || "—")}</td>
                <td>${escapeHtml(
                    window.AdminSportLabels?.sportSlugToDisplayLabel(row.sportType) ||
                        row.sportType ||
                        "—",
                )}</td>
                <td>${escapeHtml(dayLabel(row.dayOfWeek))}</td>
                <td>${escapeHtml(timeLabel(row.timeSection))}</td>
                <td>${escapeHtml(row.votesCount ?? 0)}</td>
                <td>${escapeHtml(row.organizersCount ?? 0)}</td>
                <td>${escapeHtml(formatDate(row.updatedAt))}</td>
            </tr>
        `)
        .join("");
}

function collectFilters() {
    const city = document.getElementById("city-filter")?.value?.trim() || "";
    const sportType = document.getElementById("sport-filter")?.value?.trim() || "";
    const dayOfWeek = document.getElementById("day-filter")?.value ?? "";
    const timeSection = document.getElementById("time-filter")?.value ?? "";

    const params = new URLSearchParams();
    if (city) params.append("city", city);
    if (sportType) params.append("sportType", sportType);
    if (dayOfWeek !== "") params.append("dayOfWeek", dayOfWeek);
    if (timeSection) params.append("timeSection", timeSection);
    params.append("limit", "500");
    return params;
}

async function loadAvailability() {
    const loading = document.getElementById("loading");
    const tableWrap = document.getElementById("table-wrap");
    const meta = document.getElementById("meta");
    const token = getToken();
    if (!token) {
        showError("Not signed in.");
        return;
    }

    showError("");
    if (loading) loading.style.display = "block";
    if (tableWrap) tableWrap.style.display = "none";
    if (meta) meta.textContent = "Loading...";

    try {
        const params = collectFilters();
        const url = `${getApiBaseUrl()}/admin/availability?${params.toString()}`;
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

        const votes = Array.isArray(data.votes) ? data.votes : [];
        renderRows(votes);
        if (meta) meta.textContent = `${votes.length} cluster${votes.length === 1 ? "" : "s"}`;
        if (loading) loading.style.display = "none";
        if (tableWrap) tableWrap.style.display = "block";
    } catch (e) {
        console.error(e);
        showError(e.message || "Failed to load availability");
        if (loading) loading.style.display = "none";
        if (meta) meta.textContent = "";
    }
}

window.loadAvailability = loadAvailability;
