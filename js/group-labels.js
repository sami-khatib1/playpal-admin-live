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

async function adminFetch(path, options = {}) {
    const token = getToken();
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
        method: options.method || "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
        body: options.body != null ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
        throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
    }
    return data;
}

const GL_STATE = {
    icons: [],
    communities: [],
};

function tintSvgWhite(svg) {
    if (!svg) return "";
    let out = String(svg);
    out = out.replace(/fill="(?!none)[^"]*"/gi, 'fill="#FFFFFF"');
    if (!/fill=/i.test(out)) {
        out = out.replace(/<svg\b/i, '<svg fill="#FFFFFF"');
    }
    return out;
}

function updatePreview() {
    const text = document.getElementById("label-text")?.value?.trim() || "Label";
    const color = document.getElementById("label-color")?.value || "#E11D48";
    const iconId = document.getElementById("label-icon")?.value || "";
    const icon = GL_STATE.icons.find((i) => i.id === iconId);
    const el = document.getElementById("label-preview");
    if (!el) return;
    el.style.background = color;
    el.innerHTML =
        (icon?.svg ? tintSvgWhite(icon.svg) : "") +
        `<span>${escapeHtml(text)}</span>`;
}

function renderIcons() {
    const el = document.getElementById("icon-list");
    const sel = document.getElementById("label-icon");
    if (!el || !sel) return;
    if (!GL_STATE.icons.length) {
        el.innerHTML = '<span class="muted">No icons yet — add one below.</span>';
        sel.innerHTML = "";
        return;
    }
    el.innerHTML = GL_STATE.icons
        .map(
            (i) =>
                `<span class="icon-chip" title="${escapeHtml(i.id)}">${i.svg || ""} <strong>${escapeHtml(
                    i.name
                )}</strong> <code>${escapeHtml(i.id)}</code></span>`
        )
        .join(" ");
    const current = sel.value;
    sel.innerHTML = GL_STATE.icons
        .filter((i) => i.enabled !== false)
        .map(
            (i) =>
                `<option value="${escapeHtml(i.id)}">${escapeHtml(i.name)} (${escapeHtml(i.id)})</option>`
        )
        .join("");
    if ([...sel.options].some((o) => o.value === current)) sel.value = current;
    updatePreview();
}

function renderCommunities() {
    const body = document.getElementById("comm-body");
    const countEl = document.getElementById("comm-count");
    const sel = document.getElementById("community-select");
    if (!body || !sel) return;

    const q = String(document.getElementById("comm-search")?.value || "")
        .trim()
        .toLowerCase();
    const labeledOnly = !!document.getElementById("comm-labeled-only")?.checked;

    let list = GL_STATE.communities.slice();
    if (labeledOnly) {
        list = list.filter((c) => c.labelText);
    }
    if (q) {
        list = list.filter((c) =>
            [c.name, c.sport, c.city, c.labelText]
                .map((x) => String(x || "").toLowerCase())
                .join(" ")
                .includes(q)
        );
    }

    if (countEl) countEl.textContent = `${list.length} shown / ${GL_STATE.communities.length} total`;

    const prev = sel.value;
    sel.innerHTML = GL_STATE.communities
        .map(
            (c) =>
                `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}${
                    c.labelText ? " ★" : ""
                }</option>`
        )
        .join("");
    if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;

    if (!list.length) {
        body.innerHTML = '<tr><td colspan="5" class="muted">No matching groups.</td></tr>';
        return;
    }

    body.innerHTML = list
        .map((c) => {
            const has = !!c.labelText;
            const color = c.labelColor || "#999";
            const icon = GL_STATE.icons.find((i) => i.id === c.labelIconId);
            const preview = has
                ? `<span class="preview-badge" style="background:${escapeHtml(color)}">${
                      icon?.svg ? tintSvgWhite(icon.svg) : ""
                  }<span>${escapeHtml(c.labelText)}</span></span>`
                : '<span class="muted">—</span>';
            return (
                `<tr>` +
                `<td>${escapeHtml(c.name)}</td>` +
                `<td>${escapeHtml(c.sport || "")}</td>` +
                `<td>${escapeHtml(c.city || "—")}</td>` +
                `<td>${preview}</td>` +
                `<td><button class="btn btn-secondary" type="button" data-edit="${escapeHtml(
                    c.id
                )}">Edit</button></td>` +
                `</tr>`
            );
        })
        .join("");

    body.querySelectorAll("button[data-edit]").forEach((btn) => {
        btn.addEventListener("click", () => selectCommunity(btn.getAttribute("data-edit")));
    });
}

function selectCommunity(id) {
    const c = GL_STATE.communities.find((x) => x.id === id);
    if (!c) return;
    const sel = document.getElementById("community-select");
    if (sel) sel.value = c.id;
    const text = document.getElementById("label-text");
    const color = document.getElementById("label-color");
    const icon = document.getElementById("label-icon");
    if (text) text.value = c.labelText || "";
    if (color) color.value = c.labelColor || "#E11D48";
    if (icon && c.labelIconId) icon.value = c.labelIconId;
    updatePreview();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadAll() {
    showError("");
    try {
        const [iconsRes, commRes] = await Promise.all([
            adminFetch("/admin/group-label-icons"),
            adminFetch("/admin/communities/labels"),
        ]);
        GL_STATE.icons = Array.isArray(iconsRes.icons) ? iconsRes.icons : [];
        GL_STATE.communities = Array.isArray(commRes.communities)
            ? commRes.communities
            : [];
        renderIcons();
        renderCommunities();
    } catch (e) {
        showError(e.message || "Failed to load");
    }
}

async function createIcon() {
    showError("");
    try {
        const id = document.getElementById("icon-id")?.value?.trim();
        const name = document.getElementById("icon-name")?.value?.trim();
        const svg = document.getElementById("icon-svg")?.value?.trim();
        const sortOrder = Number(document.getElementById("icon-sort")?.value || 99);
        await adminFetch("/admin/group-label-icons", {
            method: "POST",
            body: { id, name, svg, sortOrder, enabled: true },
        });
        document.getElementById("icon-id").value = "";
        document.getElementById("icon-name").value = "";
        document.getElementById("icon-svg").value = "";
        await loadAll();
    } catch (e) {
        showError(e.message || "Failed to create icon");
    }
}

async function saveLabel() {
    showError("");
    try {
        const id = document.getElementById("community-select")?.value;
        if (!id) throw new Error("Pick a group");
        await adminFetch(`/admin/communities/${encodeURIComponent(id)}/label`, {
            method: "PUT",
            body: {
                labelText: document.getElementById("label-text")?.value?.trim(),
                labelColor: document.getElementById("label-color")?.value,
                labelIconId: document.getElementById("label-icon")?.value,
            },
        });
        await loadAll();
        selectCommunity(id);
    } catch (e) {
        showError(e.message || "Failed to save label");
    }
}

async function clearLabel() {
    showError("");
    try {
        const id = document.getElementById("community-select")?.value;
        if (!id) throw new Error("Pick a group");
        await adminFetch(`/admin/communities/${encodeURIComponent(id)}/label`, {
            method: "PUT",
            body: { clear: true },
        });
        await loadAll();
        selectCommunity(id);
    } catch (e) {
        showError(e.message || "Failed to clear label");
    }
}

function initGroupLabelsPage() {
    ["label-text", "label-color", "label-icon"].forEach((id) => {
        document.getElementById(id)?.addEventListener("input", updatePreview);
        document.getElementById(id)?.addEventListener("change", updatePreview);
    });
    document.getElementById("comm-search")?.addEventListener("input", renderCommunities);
    document
        .getElementById("comm-labeled-only")
        ?.addEventListener("change", renderCommunities);
    document.getElementById("community-select")?.addEventListener("change", (e) => {
        selectCommunity(e.target.value);
    });
    loadAll();
}

window.loadAll = loadAll;
window.createIcon = createIcon;
window.saveLabel = saveLabel;
window.clearLabel = clearLabel;
window.initGroupLabelsPage = initGroupLabelsPage;
