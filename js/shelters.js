function shelterApiBase() {
    return window.NetworkConfig?.API_BASE_URL || "http://localhost:3000/api";
}

function shelterAuthHeaders() {
    return {
        Authorization: "Bearer " + (localStorage.getItem("adminToken") || ""),
        "Content-Type": "application/json",
    };
}

function setStatus(id, message, ok) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = message || "";
    el.className = "status" + (message ? (ok ? " ok" : " error") : "");
}

async function shelterRequest(method, path, body) {
    var opts = { method: method, headers: shelterAuthHeaders() };
    if (body) opts.body = JSON.stringify(body);
    var res = await fetch(shelterApiBase() + path, opts);
    var text = await res.text();
    var data = text ? JSON.parse(text) : null;
    if (!res.ok || (data && data.success === false)) {
        throw new Error((data && (data.error || data.message)) || "Request failed");
    }
    return data;
}

function paintSettings(data) {
    document.getElementById("label-enabled").checked = data.venueShelterLabelEnabled !== false;
    document.getElementById("map-enabled").checked = data.publicSheltersOnMapEnabled !== false;
    document.getElementById("layer-id").value = data.govmapLayerId || "";
    var count = document.getElementById("shelter-count");
    if (count && typeof data.shelterCount === "number") {
        count.textContent = data.shelterCount + " public shelters saved";
    }
}

async function loadShelterSettings() {
    try {
        var data = await shelterRequest("GET", "/admin/shelters/settings");
        paintSettings(data.data || {});
    } catch (error) {
        setStatus("save-status", error.message || "Could not load settings", false);
    }
}

async function saveShelterSettings() {
    setStatus("save-status", "", true);
    try {
        var data = await shelterRequest("PUT", "/admin/shelters/settings", {
            venueShelterLabelEnabled: document.getElementById("label-enabled").checked,
            publicSheltersOnMapEnabled: document.getElementById("map-enabled").checked,
            govmapLayerId: document.getElementById("layer-id").value.trim(),
        });
        paintSettings(Object.assign({ shelterCount: undefined }, data.data || {}));
        setStatus("save-status", "Saved", true);
        loadShelterSettings();
    } catch (error) {
        setStatus("save-status", error.message || "Save failed", false);
    }
}

async function syncShelters() {
    setStatus("sync-status", "Fetching from GovMap…", true);
    try {
        var data = await shelterRequest("POST", "/admin/shelters/sync");
        var result = data.data || {};
        var parts = [
            "Queried " + (result.areasQueried || 0) + " areas",
            (result.sheltersSaved || 0) + " shelter rows saved",
            (result.venuesUpdated || 0) + " venues updated",
        ];
        if (result.areasRemaining) parts.push(result.areasRemaining + " areas left — run again");
        if (typeof result.shelterCount === "number") parts.push(result.shelterCount + " shelters stored");
        setStatus("sync-status", (result.error ? result.error + ". " : "") + parts.join(". "), !result.error);
        loadShelterSettings();
    } catch (error) {
        setStatus("sync-status", error.message || "Fetch failed", false);
    }
}

async function recomputeShelters() {
    setStatus("sync-status", "Recalculating…", true);
    try {
        var data = await shelterRequest("POST", "/admin/shelters/recompute");
        var result = data.data || {};
        setStatus(
            "sync-status",
            "Updated " + (result.venuesUpdated || 0) + " venues from " + (result.shelterCount || 0) + " shelters",
            true,
        );
        loadShelterSettings();
    } catch (error) {
        setStatus("sync-status", error.message || "Recalculate failed", false);
    }
}
