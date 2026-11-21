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

const TIME_ORDER = { morning: 0, noon: 1, evening: 2, night: 3 };
const HISTOGRAM_TABLE_AT = 16;

function timeLabel(timeSection) {
    if (!timeSection) return "—";
    const v = String(timeSection).toLowerCase();
    if (v === "morning") return "Morning";
    if (v === "noon") return "Noon";
    if (v === "evening") return "Evening";
    if (v === "night") return "Night";
    return String(timeSection);
}

function titleCaseCity(city) {
    const raw = String(city ?? "").trim();
    if (!raw) return "—";
    return raw
        .split(" ")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function sportLabel(sportType) {
    return (
        window.AdminSportLabels?.sportSlugToDisplayLabel(sportType) ||
        sportType ||
        "—"
    );
}

function slotVoteCount(row) {
    const fromIds = Array.isArray(row?.voterIds) ? row.voterIds.length : 0;
    const fromCount = Number(row?.votesCount);
    return Math.max(fromIds, Number.isFinite(fromCount) ? fromCount : 0);
}

function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function compareSlots(a, b) {
    const dayDiff = Number(a.dayOfWeek) - Number(b.dayOfWeek);
    if (dayDiff !== 0) return dayDiff;
    const timeDiff =
        (TIME_ORDER[a.timeSection] ?? 99) - (TIME_ORDER[b.timeSection] ?? 99);
    if (timeDiff !== 0) return timeDiff;
    return String(a.sportType).localeCompare(String(b.sportType));
}

function buildPeople(votes, usersById) {
    const byUser = new Map();
    for (const row of votes) {
        const ids = Array.isArray(row.voterIds) ? row.voterIds : [];
        for (const rawId of ids) {
            const id = String(rawId || "").trim();
            if (!id) continue;
            if (!byUser.has(id)) byUser.set(id, []);
            byUser.get(id).push(row);
        }
    }

    return [...byUser.entries()]
        .map(([id, slots]) => {
            const user = usersById.get(id);
            const name = String(user?.name || "").trim();
            const username = String(user?.username || "").trim();
            slots.sort(compareSlots);
            return {
                id,
                name: name || (username ? `@${username}` : `User ${id.slice(0, 8)}`),
                username: name ? username : "",
                slots,
            };
        })
        .sort((a, b) => {
            const countDiff = b.slots.length - a.slots.length;
            if (countDiff !== 0) return countDiff;
            return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        });
}

function renderPeople(people, namesLoaded) {
    const list = document.getElementById("people-list");
    const meta = document.getElementById("people-meta");
    if (!list) return;

    const slotTotal = people.reduce((sum, person) => sum + person.slots.length, 0);
    const nameNote = namesLoaded ? "" : " Names could not be loaded, so ids are shown.";
    if (meta) {
        meta.textContent = people.length
            ? `${people.length} ${people.length === 1 ? "person" : "people"} · ${slotTotal} slot ${slotTotal === 1 ? "mark" : "marks"}.${nameNote}`
            : `No one has voted for the current filters.${nameNote}`;
    }

    if (!people.length) {
        list.innerHTML = "";
        return;
    }

    list.innerHTML = people
        .map((person) => {
            const byDay = new Map();
            for (const slot of person.slots) {
                const day = dayLabel(slot.dayOfWeek);
                if (!byDay.has(day)) byDay.set(day, []);
                byDay.get(day).push(slot);
            }
            const days = [...byDay.entries()]
                .map(([day, slots]) => {
                    const chips = slots
                        .map((slot) => {
                            const text = `${sportLabel(slot.sportType)} · ${timeLabel(slot.timeSection)} · ${titleCaseCity(slot.city)}`;
                            return `<span class="chip">${escapeHtml(text)}</span>`;
                        })
                        .join("");
                    return `<div class="day-row"><div class="day-label">${escapeHtml(day)}</div><div class="chips">${chips}</div></div>`;
                })
                .join("");
            const handle = person.username ? `@${person.username}` : "";
            return `<article class="person-card">
                <div class="person-head">
                    <span class="person-name">${escapeHtml(person.name)}</span>
                    ${handle ? `<span class="muted">${escapeHtml(handle)}</span>` : ""}
                    <span class="slot-count">${person.slots.length} ${person.slots.length === 1 ? "slot" : "slots"}</span>
                </div>
                ${days}
            </article>`;
        })
        .join("");
}

function buildHistogram(votes) {
    return votes
        .map((row) => ({
            row,
            count: slotVoteCount(row),
            label: `${titleCaseCity(row.city)} · ${sportLabel(row.sportType)} · ${dayLabel(row.dayOfWeek)} · ${timeLabel(row.timeSection)}`,
        }))
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function renderHistogram(items) {
    const body = document.getElementById("hist-body");
    const meta = document.getElementById("hist-meta");
    if (!body) return;

    if (meta) {
        meta.textContent = items.length
            ? `${items.length} slot${items.length === 1 ? "" : "s"} with votes`
            : "No slots with votes for the current filters.";
    }
    if (!items.length) {
        body.innerHTML = "";
        return;
    }

    if (items.length > HISTOGRAM_TABLE_AT) {
        if (meta) {
            meta.textContent = `${items.length} slots with votes. Shown as a table because the list is long.`;
        }
        body.innerHTML = `<div class="table-wrap" style="display:block; max-height:none;">
            <table class="table">
                <thead>
                    <tr>
                        <th>Slot</th>
                        <th>Votes</th>
                    </tr>
                </thead>
                <tbody>
                    ${items
                        .map(
                            (item) => `<tr>
                                <td>${escapeHtml(item.label)}</td>
                                <td>${escapeHtml(item.count)}</td>
                            </tr>`,
                        )
                        .join("")}
                </tbody>
            </table>
        </div>`;
        return;
    }

    const max = items[0].count || 1;
    body.innerHTML = `<div class="hist-list">${items
        .map((item) => {
            const width = Math.max(4, Math.round((item.count / max) * 100));
            return `<div class="hist-row">
                <div class="hist-label">${escapeHtml(item.label)}</div>
                <div class="hist-track" aria-hidden="true"><div class="hist-bar" style="width:${width}%"></div></div>
                <div class="hist-count">${escapeHtml(item.count)}</div>
            </div>`;
        })
        .join("")}</div>`;
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
    params.append("limit", "1000");
    return params;
}

async function fetchVoterDirectory(votes, token) {
    const ids = [];
    const seen = new Set();
    for (const row of votes) {
        const voterIds = Array.isArray(row?.voterIds) ? row.voterIds : [];
        for (const rawId of voterIds) {
            const id = String(rawId || "").trim();
            if (!id || seen.has(id)) continue;
            seen.add(id);
            ids.push(id);
        }
    }
    const usersById = new Map();
    const chunkSize = 80;
    for (let i = 0; i < ids.length; i += chunkSize) {
        const userIds = ids.slice(i, i + chunkSize);
        const res = await fetch(`${getApiBaseUrl()}/users/batch`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ userIds }),
        });
        const data = await res.json().catch(() => []);
        if (!res.ok) {
            throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
        }
        const list = Array.isArray(data) ? data : Array.isArray(data.users) ? data.users : [];
        for (const user of list) {
            if (user?.id) usersById.set(String(user.id), user);
        }
    }
    return usersById;
}

async function fetchAdminJson(path, token) {
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
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

async function loadAvailability() {
    const loading = document.getElementById("loading");
    const meta = document.getElementById("meta");
    const token = getToken();
    if (!token) {
        showError("Not signed in.");
        return;
    }

    showError("");
    if (loading) loading.style.display = "block";
    if (meta) meta.textContent = "Loading...";

    try {
        const params = collectFilters();
        const data = await fetchAdminJson(`/admin/availability?${params.toString()}`, token);
        const votes = Array.isArray(data.votes) ? data.votes : [];
        let usersById = new Map();
        let namesLoaded = true;
        try {
            usersById = await fetchVoterDirectory(votes, token);
        } catch (error) {
            console.error(error);
            namesLoaded = false;
        }
        renderPeople(buildPeople(votes, usersById), namesLoaded);
        renderHistogram(buildHistogram(votes));
        if (meta) meta.textContent = `${votes.length} slot${votes.length === 1 ? "" : "s"}`;
        if (loading) loading.style.display = "none";
    } catch (e) {
        console.error(e);
        showError(e.message || "Failed to load availability");
        if (loading) loading.style.display = "none";
        if (meta) meta.textContent = "";
        const peopleMeta = document.getElementById("people-meta");
        const histMeta = document.getElementById("hist-meta");
        if (peopleMeta) peopleMeta.textContent = "";
        if (histMeta) histMeta.textContent = "";
    }
}

window.loadAvailability = loadAvailability;
