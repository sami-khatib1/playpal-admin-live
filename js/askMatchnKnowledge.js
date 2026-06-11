/** @typedef {{ id?: string, title?: string, subtitle?: string, answer?: string, children?: object[] }} KnowledgeNode */

let tree = null;
let lastVersion = null;
/** @type {string[] | null} */
let selectedPath = null;
/** @type {Set<string>} */
const collapsedPaths = new Set();

function getApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || "http://localhost:3000/api";
}

function getToken() {
    return localStorage.getItem("adminToken");
}

function pathKey(path) {
    return JSON.stringify(path || []);
}

function slugId(title) {
    const base = String(title || "item")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48);
    return base || `item-${Date.now()}`;
}

function isLeaf(node) {
    return !!node && typeof node.answer === "string" && !node.children?.length;
}

function isBranch(node) {
    return !!node && Array.isArray(node.children);
}

function getAtPath(root, path) {
    if (!path || path.length === 0) return root;
    let cur = root;
    for (let i = 0; i < path.length; i++) {
        cur = cur[path[i]];
        if (cur === undefined) return undefined;
    }
    return cur;
}

/** @returns {{ list: object[], index: number } | null} */
function getParentList(root, path) {
    if (!path || path.length < 2) return null;
    const parentPath = path.slice(0, -1);
    const index = path[path.length - 1];
    const listKey = parentPath[parentPath.length - 1];
    const listParentPath = parentPath.slice(0, -1);
    const container = listParentPath.length === 0 ? root : getAtPath(root, listParentPath);
    if (!container || !Array.isArray(container[listKey])) return null;
    return { list: container[listKey], index: Number(index) };
}

function showToast(msg, type = "success") {
    const el = document.getElementById("km-toast");
    if (!el) return;
    if (!msg) {
        el.className = "km-toast";
        el.textContent = "";
        return;
    }
    el.className = `km-toast ${type}`;
    el.textContent = msg;
    if (type === "success") {
        setTimeout(() => showToast(""), 4000);
    }
}

async function apiGet() {
    const response = await fetch(`${getApiBaseUrl()}/admin/ask-matchn/knowledge`, {
        headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to load");
    }
    return data;
}

async function apiSave(nextTree) {
    const response = await fetch(`${getApiBaseUrl()}/admin/ask-matchn/knowledge`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ tree: nextTree }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to save");
    }
    return data;
}

async function apiReset() {
    const response = await fetch(`${getApiBaseUrl()}/admin/ask-matchn/knowledge/reset`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to reset");
    }
    return data;
}

function normalizeTree(raw) {
    const next = raw && typeof raw === "object" ? JSON.parse(JSON.stringify(raw)) : {};
    if (!next.version) next.version = 1;
    if (!next.welcomeMessage) next.welcomeMessage = "";
    if (!Array.isArray(next.sections)) next.sections = [];
    return next;
}

function breadcrumbForPath(path) {
    if (!path || path.length === 0) return "Welcome";
    const parts = [];
    let cur = tree;
    for (let i = 0; i < path.length; i++) {
        const seg = path[i];
        if (seg === "sections" || seg === "children") continue;
        if (typeof seg === "number") {
            const node = cur?.[seg];
            if (node?.title) parts.push(node.title);
            cur = node;
        }
    }
    return parts.join(" › ") || "Item";
}

function ensureSelectedPath() {
    if (!tree?.sections?.length) {
        selectedPath = null;
        return;
    }
    if (selectedPath && getAtPath(tree, selectedPath)) return;
    selectedPath = ["sections", 0];
}

function syncWelcomeField() {
    const el = document.getElementById("welcome-message");
    if (el && tree) el.value = tree.welcomeMessage || "";
}

function syncJsonPreview() {
    const el = document.getElementById("knowledge-json");
    if (el && tree) el.value = JSON.stringify(tree, null, 2);
}

function setMeta(version) {
    lastVersion = version;
    document.getElementById("meta").textContent = version
        ? `Last saved: ${new Date(version).toLocaleString()}`
        : "";
}

function applyTree(nextTree, version) {
    tree = normalizeTree(nextTree);
    collapsedPaths.clear();
    ensureSelectedPath();
    syncWelcomeField();
    syncJsonPreview();
    setMeta(version);
    renderTree();
    renderEditor();
}

function renderTree() {
    const root = document.getElementById("km-tree");
    if (!root) return;
    root.innerHTML = "";

    if (!tree?.sections?.length) {
        root.innerHTML =
            '<p style="padding:0.75rem 1rem;color:var(--color-text-secondary);font-size:0.9rem;">No topics yet. Add a top-level topic to get started.</p>';
        return;
    }

    tree.sections.forEach((section, idx) => {
        root.appendChild(renderTreeNode(section, ["sections", idx], 0));
    });
}

function renderTreeNode(node, path, depth) {
    const wrap = document.createElement("div");
    const hasKids = isBranch(node) && node.children.length > 0;
    const pk = pathKey(path);
    const collapsed = collapsedPaths.has(pk);
    const selected = pathKey(selectedPath) === pk;

    const row = document.createElement("div");
    row.className = `km-tree-node${selected ? " selected" : ""}`;
    row.style.paddingLeft = `${8 + depth * 14}px`;
    row.dataset.path = pk;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = `km-tree-toggle${hasKids ? "" : " hidden"}`;
    toggle.textContent = collapsed ? "▶" : "▼";
    toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        if (collapsedPaths.has(pk)) collapsedPaths.delete(pk);
        else collapsedPaths.add(pk);
        renderTree();
    });

    const icon = document.createElement("span");
    icon.className = "km-tree-icon";
    icon.textContent = isLeaf(node) ? "💬" : "📁";

    const label = document.createElement("span");
    label.className = "km-tree-label";
    label.textContent = node.title || "(Untitled)";
    label.title = node.subtitle || node.answer?.slice(0, 80) || "";

    row.appendChild(toggle);
    row.appendChild(icon);
    row.appendChild(label);
    row.addEventListener("click", () => {
        selectedPath = path;
        renderTree();
        renderEditor();
    });

    wrap.appendChild(row);

    if (hasKids && !collapsed) {
        const kids = document.createElement("div");
        kids.className = "km-tree-children";
        node.children.forEach((child, idx) => {
            kids.appendChild(renderTreeNode(child, [...path, "children", idx], depth + 1));
        });
        wrap.appendChild(kids);
    }

    return wrap;
}

function fieldHtml(id, label, value, opts = {}) {
    const { textarea = false, hint = "", placeholder = "" } = opts;
    const control = textarea
        ? `<textarea id="${id}" placeholder="${placeholder}">${escapeHtml(value || "")}</textarea>`
        : `<input id="${id}" type="text" value="${escapeAttr(value || "")}" placeholder="${placeholder}" />`;
    return `
        <div class="km-field">
            <label for="${id}">${label}</label>
            ${control}
            ${hint ? `<p class="km-field-hint">${hint}</p>` : ""}
        </div>
    `;
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
}

function renderEditor() {
    const panel = document.getElementById("km-editor");
    const titleEl = document.getElementById("editor-title");
    if (!panel) return;

    if (!selectedPath) {
        panel.innerHTML =
            '<div class="km-editor-empty">Select a topic or question from the tree, or add a top-level topic.</div>';
        if (titleEl) titleEl.textContent = "Edit item";
        return;
    }

    const node = getAtPath(tree, selectedPath);
    if (!node) {
        panel.innerHTML = '<div class="km-editor-empty">Item not found.</div>';
        return;
    }

    const leaf = isLeaf(node);
    const branch = isBranch(node);
    const crumb = breadcrumbForPath(selectedPath);
    if (titleEl) titleEl.textContent = leaf ? "Edit Q&A" : "Edit topic";

    const childCount = branch ? node.children.length : 0;

    panel.innerHTML = `
        <span class="km-badge ${leaf ? "km-badge-qa" : "km-badge-topic"}">${leaf ? "Instant answer" : "Topic folder"}</span>
        <p class="km-breadcrumb">${escapeHtml(crumb)}</p>
        ${fieldHtml("edit-id", "ID", node.id, { hint: "Stable key — avoid changing after publish unless necessary." })}
        ${fieldHtml("edit-title", leaf ? "Question" : "Title", node.title, {
            placeholder: leaf ? "What users tap on…" : "e.g. Group, Activity, Polls",
        })}
        ${
            leaf
                ? fieldHtml("edit-answer", "Answer", node.answer, {
                      textarea: true,
                      placeholder: "Answer shown instantly in the app…",
                      hint: "Supports line breaks. Keep answers concise and actionable.",
                  })
                : fieldHtml("edit-subtitle", "Subtitle", node.subtitle || "", {
                      placeholder: "Short description under the title",
                      hint: branch
                          ? `${childCount} item${childCount === 1 ? "" : "s"} inside this folder.`
                          : "",
                  })
        }
        <div class="km-editor-actions">
            ${
                branch
                    ? `
                <button type="button" class="btn btn-secondary btn-sm" id="btn-add-subtopic">+ Sub-topic</button>
                <button type="button" class="btn btn-secondary btn-sm" id="btn-add-qa">+ Q&amp;A</button>
            `
                    : ""
            }
            <button type="button" class="btn btn-secondary btn-sm" id="btn-move-up">↑ Up</button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-move-down">↓ Down</button>
            <button type="button" class="btn btn-danger-outline btn-sm" id="btn-delete-node">Delete</button>
        </div>
    `;

    const bind = (id, fn) => document.getElementById(id)?.addEventListener("click", fn);

    document.getElementById("edit-id")?.addEventListener("input", (e) => {
        node.id = e.target.value.trim();
        syncJsonPreview();
    });
    document.getElementById("edit-title")?.addEventListener("input", (e) => {
        node.title = e.target.value;
        syncJsonPreview();
        renderTree();
    });
    document.getElementById("edit-subtitle")?.addEventListener("input", (e) => {
        node.subtitle = e.target.value;
        syncJsonPreview();
    });
    document.getElementById("edit-answer")?.addEventListener("input", (e) => {
        node.answer = e.target.value;
        syncJsonPreview();
    });

    bind("btn-add-subtopic", () => addChildNode(selectedPath, "branch"));
    bind("btn-add-qa", () => addChildNode(selectedPath, "leaf"));
    bind("btn-move-up", () => moveNode(selectedPath, -1));
    bind("btn-move-down", () => moveNode(selectedPath, 1));
    bind("btn-delete-node", () => deleteNode(selectedPath));
}

function addTopLevelTopic() {
    if (!tree) return;
    const title = "New topic";
    const node = {
        id: slugId(title),
        title,
        subtitle: "",
        children: [],
    };
    tree.sections.push(node);
    selectedPath = ["sections", tree.sections.length - 1];
    syncJsonPreview();
    renderTree();
    renderEditor();
}

/** @param {string[]} path @param {"branch"|"leaf"} kind */
function addChildNode(path, kind) {
    const node = getAtPath(tree, path);
    if (!node) return;
    if (!Array.isArray(node.children)) {
        delete node.answer;
        node.children = [];
    }
    const title = kind === "leaf" ? "New question" : "New sub-topic";
    const child =
        kind === "leaf"
            ? { id: slugId(title), title, answer: "" }
            : { id: slugId(title), title, subtitle: "", children: [] };
    node.children.push(child);
    const childPath = [...path, "children", node.children.length - 1];
    collapsedPaths.delete(pathKey(path));
    selectedPath = childPath;
    syncJsonPreview();
    renderTree();
    renderEditor();
}

function moveNode(path, delta) {
    const parent = getParentList(tree, path);
    if (!parent) return;
    const { list, index } = parent;
    const next = index + delta;
    if (next < 0 || next >= list.length) return;
    const tmp = list[index];
    list[index] = list[next];
    list[next] = tmp;
    selectedPath = [...path.slice(0, -1), next];
    syncJsonPreview();
    renderTree();
    renderEditor();
}

function deleteNode(path) {
    const node = getAtPath(tree, path);
    const name = node?.title || "this item";
    if (!confirm(`Delete "${name}" and everything inside it?`)) return;

    const parent = getParentList(tree, path);
    if (!parent) return;
    parent.list.splice(parent.index, 1);

    if (parent.list.length === 0) {
        if (path[0] === "sections") selectedPath = tree.sections.length ? ["sections", 0] : null;
        else selectedPath = path.slice(0, -2);
    } else {
        const newIndex = Math.min(parent.index, parent.list.length - 1);
        selectedPath = [...path.slice(0, -1), newIndex];
    }

    ensureSelectedPath();
    syncJsonPreview();
    renderTree();
    renderEditor();
}

function validateTree(t) {
    if (!t || typeof t !== "object") return "Invalid tree";
    if (!Array.isArray(t.sections)) return "Tree must have a sections array";
    return null;
}

async function loadKnowledge() {
    showToast("");
    const data = await apiGet();
    applyTree(data.tree, data.version);
}

async function saveKnowledge() {
    showToast("");
    const welcomeEl = document.getElementById("welcome-message");
    if (welcomeEl) tree.welcomeMessage = welcomeEl.value.trim();

    const err = validateTree(tree);
    if (err) {
        showToast(err, "error");
        return;
    }

    const data = await apiSave(tree);
    applyTree(data.tree, data.version);
    showToast("Saved. The app picks this up on next launch or new session.");
}

function initAskMatchnKnowledgePage() {
    document.getElementById("welcome-message")?.addEventListener("input", () => {
        if (tree) {
            tree.welcomeMessage = document.getElementById("welcome-message").value;
            syncJsonPreview();
        }
    });

    document.getElementById("btn-add-topic")?.addEventListener("click", addTopLevelTopic);

    document.getElementById("btn-reload")?.addEventListener("click", () => {
        if (
            !confirm(
                "Reload from server? Unsaved changes on this page will be lost.",
            )
        ) {
            return;
        }
        loadKnowledge().catch((e) => showToast(e.message, "error"));
    });

    document.getElementById("btn-save")?.addEventListener("click", () => {
        saveKnowledge().catch((e) => showToast(e.message, "error"));
    });

    document.getElementById("btn-reset")?.addEventListener("click", async () => {
        if (!confirm("Reset the entire FAQ tree to the server default?")) return;
        showToast("");
        try {
            const data = await apiReset();
            applyTree(data.tree, data.version);
            showToast("Reset to default knowledge tree.");
        } catch (e) {
            showToast(e.message, "error");
        }
    });

    document.getElementById("km-advanced")?.addEventListener("toggle", (e) => {
        if (e.target.open) syncJsonPreview();
    });

    loadKnowledge().catch((e) => showToast(e.message, "error"));
}

window.initAskMatchnKnowledgePage = initAskMatchnKnowledgePage;
