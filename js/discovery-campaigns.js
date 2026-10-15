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

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const COPY_VARIANTS = {
    game: ["standard"],
    group: ["standard", "new", "rising", "low"],
};
const LANGS = [
    { id: "en", label: "English" },
    { id: "he", label: "Hebrew" },
    { id: "ar", label: "Arabic" },
];

function field(name, value, attrs = "") {
    return `<input id="${name}" class="form-input" value="${escapeHtml(value ?? "")}" ${attrs}>`;
}

function copyBlock(type, variant, lang, pair) {
    const prefix = `${type}-${variant}-${lang}`;
    return `
        <div class="form-group">
            <label>${escapeHtml(lang.toUpperCase())} title</label>
            ${field(`${prefix}-title`, pair?.title || "", 'maxlength="120"')}
            <label>${escapeHtml(lang.toUpperCase())} body</label>
            <textarea id="${prefix}-body" maxlength="2000">${escapeHtml(pair?.body || "")}</textarea>
        </div>
    `;
}

function sportChips(type, selected) {
    const selectedSet = new Set((selected || []).map((s) => String(s).toLowerCase()));
    const sportLabels = window.AdminSportLabels || window.SportLabels || {};
    const slugs = sportLabels.mergeSportOptions
        ? sportLabels.mergeSportOptions(selected)
        : ["soccer", "basketball", "tennis", "padel", "volleyball", "running"];
    const labelFn = sportLabels.sportSlugToDisplayLabel || ((s) => s);
    return slugs.map((slug) => `
        <label class="chip">
            <input type="checkbox" class="${type}-sport" value="${escapeHtml(slug)}" ${selectedSet.has(slug) ? "checked" : ""}>
            ${escapeHtml(labelFn(slug))}
        </label>
    `).join("");
}

function genderChips(type, selected) {
    const selectedSet = new Set((selected || []).map((s) => String(s).toLowerCase()));
    return ["mixed", "female", "male"].map((value) => `
        <label class="chip">
            <input type="checkbox" class="${type}-gender" value="${value}" ${selectedSet.has(value) ? "checked" : ""}>
            ${value}
        </label>
    `).join("");
}

function renderCampaign(config) {
    const type = config.id;
    const title = type === "game" ? "Standalone activity push" : "Group discovery push";
    const subtitle = type === "game"
        ? "Public standalone and weekly games. Matches users by favorite sport, gender, and radius."
        : "New, rising, and low-member public groups. One notification per user.";
    const weights = config.scoreWeights || {};
    const mix = config.groupMix || {};
    const nextRun = config.nextRunTime ? new Date(config.nextRunTime).toLocaleString() : "disabled";

    const variantHtml = COPY_VARIANTS[type].map((variant) => `
        <div class="form-group wide">
            <label>${variant} copy</label>
            <div class="copy-grid">
                ${LANGS.map((lang) => copyBlock(type, variant, lang.id, config.localizedCopy?.[variant]?.[lang.id])).join("")}
            </div>
        </div>
    `).join("");

    const mixHtml = type === "group" ? `
        <div class="form-grid three">
            <div class="form-group"><label>Low-member mix %</label>${field(`${type}-mix-low`, mix.low ?? 40, 'type="number" min="0" max="100"')}</div>
            <div class="form-group"><label>New-group mix %</label>${field(`${type}-mix-new`, mix.new ?? 30, 'type="number" min="0" max="100"')}</div>
            <div class="form-group"><label>Rising mix %</label>${field(`${type}-mix-rising`, mix.rising ?? 30, 'type="number" min="0" max="100"')}</div>
        </div>
        <div class="form-grid three">
            <div class="form-group"><label>Low-member max</label>${field(`${type}-lowMemberMax`, config.lowMemberMax, 'type="number" min="1" max="200"')}</div>
            <div class="form-group"><label>New group days</label>${field(`${type}-newEntityDays`, config.newEntityDays, 'type="number" min="1" max="180"')}</div>
            <div class="form-group"><label>Rising window days</label>${field(`${type}-risingWindowDays`, config.risingWindowDays, 'type="number" min="1" max="90"')}</div>
        </div>
    ` : `
        <div class="form-group">
            <label>Fan-out per open spot</label>
            ${field(`${type}-fanoutPerOpenSpot`, config.fanoutPerOpenSpot, 'type="number" min="1" max="50"')}
        </div>
    `;

    return `
        <div class="card" id="card-${type}">
            <h2>${title}</h2>
            <p class="muted">${subtitle} Next run: <strong>${escapeHtml(nextRun)}</strong></p>
            <label class="chip" style="margin: 0.75rem 0;">
                <input type="checkbox" id="${type}-enabled" ${config.enabled ? "checked" : ""}>
                Enabled
            </label>
            <div class="form-grid three">
                <div class="form-group">
                    <label>Weekday</label>
                    <select id="${type}-dayOfWeek">
                        ${DAYS.map((name, i) => `<option value="${i}" ${Number(config.dayOfWeek) === i ? "selected" : ""}>${name}</option>`).join("")}
                    </select>
                </div>
                <div class="form-group"><label>Hour</label>${field(`${type}-hour`, config.hour, 'type="number" min="0" max="23"')}</div>
                <div class="form-group"><label>Minute</label>${field(`${type}-minute`, config.minute, 'type="number" min="0" max="59"')}</div>
            </div>
            <div class="form-grid three">
                <div class="form-group"><label>Delay min (minutes)</label>${field(`${type}-delayMinMinutes`, config.delayMinMinutes, 'type="number" min="0" max="180"')}</div>
                <div class="form-group"><label>Delay max (minutes)</label>${field(`${type}-delayMaxMinutes`, config.delayMaxMinutes, 'type="number" min="0" max="180"')}</div>
                <div class="form-group"><label>Radius km</label>${field(`${type}-radiusKm`, config.radiusKm, 'type="number" min="1" max="500" step="0.5"')}</div>
            </div>
            <div class="form-group wide">
                <label>Sports (empty = all favorites)</label>
                <div class="chips">${sportChips(type, config.sports)}</div>
            </div>
            <div class="form-group wide">
                <label>Eligible game/group genders</label>
                <div class="chips">${genderChips(type, config.genders)}</div>
            </div>
            <div class="form-grid three">
                <div class="form-group"><label>Active within days</label>${field(`${type}-activeWithinDays`, config.activeWithinDays, 'type="number" min="1" max="365"')}</div>
                <div class="form-group"><label>Lookahead days</label>${field(`${type}-lookaheadDays`, config.lookaheadDays, 'type="number" min="1" max="60"')}</div>
                <div class="form-group"><label>Minimum score</label>${field(`${type}-minimumScore`, config.minimumScore, 'type="number" min="1" max="100"')}</div>
            </div>
            <div class="form-grid three">
                <div class="form-group"><label>Max recipients / run</label>${field(`${type}-maxRecipientsPerRun`, config.maxRecipientsPerRun, 'type="number" min="1" max="5000"')}</div>
                <div class="form-group"><label>Max recipients / entity</label>${field(`${type}-maxRecipientsPerEntity`, config.maxRecipientsPerEntity, 'type="number" min="1" max="500"')}</div>
                <div class="form-group"><label>Entity pool</label>${field(`${type}-entityPoolLimit`, config.entityPoolLimit, 'type="number" min="1" max="200"')}</div>
            </div>
            <div class="form-grid three">
                <div class="form-group"><label>Cooldown hours</label>${field(`${type}-cooldownHours`, config.cooldownHours, 'type="number" min="0" max="168"')}</div>
                <div class="form-group"><label>Weekly user limit</label>${field(`${type}-weeklyUserLimit`, config.weeklyUserLimit, 'type="number" min="1" max="7"')}</div>
                <div class="form-group"><label>Same-entity cooldown days</label>${field(`${type}-sameEntityCooldownDays`, config.sameEntityCooldownDays, 'type="number" min="1" max="365"')}</div>
            </div>
            ${mixHtml}
            <div class="form-grid three">
                <div class="form-group"><label>Sport weight</label>${field(`${type}-w-sport`, weights.sport ?? 30, 'type="number" min="0" max="100"')}</div>
                <div class="form-group"><label>Distance weight</label>${field(`${type}-w-distance`, weights.distance ?? 25, 'type="number" min="0" max="100"')}</div>
                <div class="form-group"><label>Activity weight</label>${field(`${type}-w-activity`, weights.activity ?? 15, 'type="number" min="0" max="100"')}</div>
                <div class="form-group"><label>Need weight</label>${field(`${type}-w-need`, weights.need ?? 15, 'type="number" min="0" max="100"')}</div>
                <div class="form-group"><label>Entity weight</label>${field(`${type}-w-entity`, weights.entity ?? 10, 'type="number" min="0" max="100"')}</div>
                <div class="form-group"><label>Novelty weight</label>${field(`${type}-w-novelty`, weights.novelty ?? 5, 'type="number" min="0" max="100"')}</div>
            </div>
            ${variantHtml}
            <div class="toolbar">
                <button class="btn btn-primary" type="button" onclick="saveDiscoveryCampaign('${type}')">Save ${type} config</button>
                <button class="btn btn-secondary" type="button" onclick="previewDiscoveryCampaign('${type}')">Preview matches</button>
                <button class="btn btn-secondary" type="button" onclick="runDiscoveryCampaign('${type}')">Queue a run now</button>
            </div>
            <div id="${type}-extra" class="muted" style="margin-top:0.75rem;"></div>
        </div>
    `;
}

function val(id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
}

function checkedValues(cls) {
    return Array.from(document.querySelectorAll(`input.${cls}:checked`)).map((el) => el.value);
}

function readCopy(type) {
    const localizedCopy = {};
    COPY_VARIANTS[type].forEach((variant) => {
        localizedCopy[variant] = {};
        LANGS.forEach((lang) => {
            localizedCopy[variant][lang.id] = {
                title: val(`${type}-${variant}-${lang.id}-title`),
                body: val(`${type}-${variant}-${lang.id}-body`),
            };
        });
    });
    return localizedCopy;
}

function readCampaign(type) {
    const payload = {
        enabled: document.getElementById(`${type}-enabled`)?.checked === true,
        dayOfWeek: Number(val(`${type}-dayOfWeek`)),
        hour: Number(val(`${type}-hour`)),
        minute: Number(val(`${type}-minute`)),
        delayMinMinutes: Number(val(`${type}-delayMinMinutes`)),
        delayMaxMinutes: Number(val(`${type}-delayMaxMinutes`)),
        radiusKm: Number(val(`${type}-radiusKm`)),
        activeWithinDays: Number(val(`${type}-activeWithinDays`)),
        lookaheadDays: Number(val(`${type}-lookaheadDays`)),
        minimumScore: Number(val(`${type}-minimumScore`)),
        maxRecipientsPerRun: Number(val(`${type}-maxRecipientsPerRun`)),
        maxRecipientsPerEntity: Number(val(`${type}-maxRecipientsPerEntity`)),
        entityPoolLimit: Number(val(`${type}-entityPoolLimit`)),
        cooldownHours: Number(val(`${type}-cooldownHours`)),
        weeklyUserLimit: Number(val(`${type}-weeklyUserLimit`)),
        sameEntityCooldownDays: Number(val(`${type}-sameEntityCooldownDays`)),
        sports: checkedValues(`${type}-sport`),
        genders: checkedValues(`${type}-gender`),
        scoreWeights: {
            sport: Number(val(`${type}-w-sport`)),
            distance: Number(val(`${type}-w-distance`)),
            activity: Number(val(`${type}-w-activity`)),
            need: Number(val(`${type}-w-need`)),
            entity: Number(val(`${type}-w-entity`)),
            novelty: Number(val(`${type}-w-novelty`)),
        },
        localizedCopy: readCopy(type),
    };
    if (type === "group") {
        payload.lowMemberMax = Number(val(`${type}-lowMemberMax`));
        payload.newEntityDays = Number(val(`${type}-newEntityDays`));
        payload.risingWindowDays = Number(val(`${type}-risingWindowDays`));
        payload.groupMix = {
            low: Number(val(`${type}-mix-low`)),
            new: Number(val(`${type}-mix-new`)),
            rising: Number(val(`${type}-mix-rising`)),
        };
    } else {
        payload.fanoutPerOpenSpot = Number(val(`${type}-fanoutPerOpenSpot`));
    }
    return payload;
}

async function api(path, options = {}) {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
}

function renderRuns(runs) {
    const el = document.getElementById("runs");
    if (!el) return;
    if (!runs || runs.length === 0) {
        el.innerHTML = "No runs yet.";
        return;
    }
    el.innerHTML = `
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>When</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Planned</th>
                        <th>Sent</th>
                        <th>Failed</th>
                        <th>Users / entities</th>
                    </tr>
                </thead>
                <tbody>
                    ${runs.map((run) => `
                        <tr>
                            <td>${escapeHtml(run.startedAt ? new Date(run.startedAt).toLocaleString() : "")}</td>
                            <td>${escapeHtml(run.campaignType)}</td>
                            <td>${escapeHtml(run.status)}</td>
                            <td>${escapeHtml(run.deliveriesPlanned)}</td>
                            <td>${escapeHtml(run.sentCount)}</td>
                            <td>${escapeHtml(run.failedCount)}</td>
                            <td>${escapeHtml(run.usersConsidered)} / ${escapeHtml(run.entitiesConsidered)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

async function loadDiscoveryCampaigns() {
    showError("");
    try {
        const data = await api("/admin/growth/discovery-campaigns");
        const root = document.getElementById("campaigns");
        const campaigns = data.campaigns || [];
        root.innerHTML = campaigns.map(renderCampaign).join("");
        renderRuns(data.runs || []);
    } catch (error) {
        showError(error.message);
    }
}

async function saveDiscoveryCampaign(type) {
    showError("");
    try {
        await api(`/admin/growth/discovery-campaigns/${type}`, {
            method: "PATCH",
            body: JSON.stringify(readCampaign(type)),
        });
        showSuccess(`${type} campaign saved.`);
        await loadDiscoveryCampaigns();
    } catch (error) {
        showError(error.message);
    }
}

async function previewDiscoveryCampaign(type) {
    const extra = document.getElementById(`${type}-extra`);
    if (extra) extra.textContent = "Previewing…";
    showError("");
    try {
        const data = await api(`/admin/growth/discovery-campaigns/${type}/preview`);
        const preview = data.preview || {};
        const rows = (preview.selected || []).slice(0, 20).map((row) =>
            `${row.entityName} → ${row.userId.slice(0, 8)}… (${row.score}, ${row.distanceKm}km)`
        );
        if (extra) {
            extra.innerHTML = `
                Considered ${escapeHtml(preview.usersConsidered)} users and ${escapeHtml(preview.entitiesConsidered)} ${type}s.
                Would send ${escapeHtml(preview.selectedTotal)}.
                ${rows.length ? `<br>${rows.map(escapeHtml).join("<br>")}` : ""}
            `;
        }
    } catch (error) {
        if (extra) extra.textContent = "";
        showError(error.message);
    }
}

async function runDiscoveryCampaign(type) {
    if (!window.confirm(`Queue a ${type} discovery run now? Sends still wait a few minutes.`)) return;
    showError("");
    try {
        const data = await api(`/admin/growth/discovery-campaigns/${type}/run`, { method: "POST" });
        const result = data.result || {};
        showSuccess(result.skipped
            ? `${type} run skipped: ${result.reason}`
            : `${type} run queued ${result.deliveriesPlanned || 0} delayed sends.`);
        await loadDiscoveryCampaigns();
    } catch (error) {
        showError(error.message);
    }
}

window.loadDiscoveryCampaigns = loadDiscoveryCampaigns;
window.saveDiscoveryCampaign = saveDiscoveryCampaign;
window.previewDiscoveryCampaign = previewDiscoveryCampaign;
window.runDiscoveryCampaign = runDiscoveryCampaign;
