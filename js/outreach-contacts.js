function getApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || "http://localhost:3000/api";
}

function getToken() {
    return localStorage.getItem("adminToken");
}

const STATUS_OPTIONS = [
    { value: "still_nothing", label: "Still nothing" },
    { value: "spoke_with", label: "Spoke with" },
    { value: "rejected", label: "Rejected our request" },
    { value: "approved", label: "Approved our request" },
];

let allContacts = [];
let statusFilter = "all";

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
        window.scrollTo({ top: 0, behavior: "smooth" });
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
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function instagramToUrl(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    const handle = s.replace(/^@+/, "").replace(/^instagram\.com\//i, "").split(/[/?#]/)[0];
    if (!handle) return null;
    return `https://instagram.com/${encodeURIComponent(handle)}`;
}

function phoneToTel(raw) {
    if (!raw) return null;
    const digits = String(raw).replace(/[^\d+]/g, "");
    if (!digits) return null;
    return `tel:${digits}`;
}

function renderStatusChips() {
    const wrap = document.getElementById("status-chips");
    if (!wrap) return;
    const chips = [{ value: "all", label: "All" }, ...STATUS_OPTIONS];
    wrap.innerHTML = chips
        .map(
            (c) =>
                `<button type="button" class="chip${statusFilter === c.value ? " active" : ""}" data-status="${escapeHtml(c.value)}">${escapeHtml(c.label)}</button>`,
        )
        .join("");
    wrap.querySelectorAll(".chip").forEach((btn) => {
        btn.addEventListener("click", () => {
            statusFilter = btn.getAttribute("data-status") || "all";
            renderStatusChips();
            renderContactList();
        });
    });
}

function filteredContacts() {
    const q = (document.getElementById("search-input")?.value || "").trim().toLowerCase();
    return allContacts.filter((c) => {
        if (statusFilter !== "all" && c.status !== statusFilter) return false;
        if (!q) return true;
        const hay = `${c.name} ${c.phoneNumber || ""} ${c.instagram || ""}`.toLowerCase();
        return hay.includes(q);
    });
}

function statusSelectOptions(selected) {
    return STATUS_OPTIONS.map(
        (o) =>
            `<option value="${escapeHtml(o.value)}"${o.value === selected ? " selected" : ""}>${escapeHtml(o.label)}</option>`,
    ).join("");
}

function renderContactList() {
    const list = document.getElementById("contact-list");
    const empty = document.getElementById("empty-state");
    const meta = document.getElementById("list-meta");
    const items = filteredContacts();

    if (meta) meta.textContent = `${items.length} contact${items.length === 1 ? "" : "s"}`;

    if (!list) return;

    if (items.length === 0) {
        list.style.display = "none";
        list.innerHTML = "";
        if (empty) empty.style.display = "block";
        return;
    }

    if (empty) empty.style.display = "none";
    list.style.display = "flex";

    list.innerHTML = items
        .map((c) => {
            const tel = phoneToTel(c.phoneNumber);
            const igUrl = instagramToUrl(c.instagram);
            const phoneBlock = c.phoneNumber
                ? tel
                    ? `<a href="${escapeHtml(tel)}"><span class="icon">📞</span>${escapeHtml(c.phoneNumber)}</a>`
                    : `<span class="muted">${escapeHtml(c.phoneNumber)}</span>`
                : "";
            const igBlock = c.instagram
                ? igUrl
                    ? `<a href="${escapeHtml(igUrl)}" target="_blank" rel="noopener noreferrer"><span class="icon">📷</span>${escapeHtml(c.instagram)}</a>`
                    : `<span class="muted">${escapeHtml(c.instagram)}</span>`
                : "";
            const links =
                phoneBlock || igBlock
                    ? `<div class="contact-links">${phoneBlock}${igBlock}</div>`
                    : `<p class="muted">No contact details</p>`;

            return `<article class="contact-card" data-id="${escapeHtml(c.id)}">
                <header>
                    <div class="name">${escapeHtml(c.name)}</div>
                    <span class="pill pill-${escapeHtml(c.status)}">${escapeHtml(c.statusLabel || c.status)}</span>
                </header>
                ${links}
                <label class="muted" style="font-size:0.75rem;display:block;margin-bottom:0.2rem;">Update status</label>
                <select class="status-select form-input" data-id="${escapeHtml(c.id)}" aria-label="Status for ${escapeHtml(c.name)}">
                    ${statusSelectOptions(c.status)}
                </select>
                <div class="card-actions">
                    <button type="button" class="btn btn-secondary btn-delete" data-id="${escapeHtml(c.id)}">Delete</button>
                </div>
            </article>`;
        })
        .join("");

    list.querySelectorAll(".status-select").forEach((sel) => {
        sel.addEventListener("change", () => {
            const id = sel.getAttribute("data-id");
            if (id) updateContactStatus(id, sel.value);
        });
    });
    list.querySelectorAll(".btn-delete").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            if (id) deleteContact(id);
        });
    });
}

async function loadContacts() {
    const loading = document.getElementById("list-loading");
    const token = getToken();
    if (!token) {
        showError("Not signed in.");
        return;
    }
    showError("");
    if (loading) loading.style.display = "block";

    try {
        const url = `${getApiBaseUrl()}/admin/outreach-contacts`;
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            throw new Error(data?.error || `Request failed (${response.status})`);
        }
        allContacts = data.data || [];
        renderContactList();
    } catch (e) {
        console.error(e);
        showError(e.message || "Failed to load contacts");
    } finally {
        if (loading) loading.style.display = "none";
    }
}

async function createContact() {
    const name = (document.getElementById("add-name")?.value || "").trim();
    const phoneNumber = (document.getElementById("add-phone")?.value || "").trim();
    const instagram = (document.getElementById("add-instagram")?.value || "").trim();
    const status = document.getElementById("add-status")?.value || "still_nothing";
    const token = getToken();

    showError("");
    if (!name) {
        showError("Name is required.");
        return;
    }
    if (!phoneNumber && !instagram) {
        showError("Add a phone number or Instagram handle.");
        return;
    }
    if (!token) {
        showError("Not signed in.");
        return;
    }

    const btn = document.getElementById("btn-add");
    if (btn) btn.disabled = true;

    try {
        const response = await fetch(`${getApiBaseUrl()}/admin/outreach-contacts`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ name, phoneNumber, instagram, status }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            throw new Error(data?.error || "Create failed");
        }
        document.getElementById("add-name").value = "";
        document.getElementById("add-phone").value = "";
        document.getElementById("add-instagram").value = "";
        document.getElementById("add-status").value = "still_nothing";
        showSuccess("Contact added.");
        await loadContacts();
    } catch (e) {
        showError(e.message || "Failed to add contact");
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function updateContactStatus(id, status) {
    const token = getToken();
    if (!token) return;
    try {
        const response = await fetch(`${getApiBaseUrl()}/admin/outreach-contacts/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ status }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            throw new Error(data?.error || "Update failed");
        }
        const idx = allContacts.findIndex((c) => c.id === id);
        if (idx >= 0 && data.data) allContacts[idx] = data.data;
        renderContactList();
    } catch (e) {
        showError(e.message || "Failed to update status");
        await loadContacts();
    }
}

async function deleteContact(id) {
    if (!window.confirm("Delete this contact?")) return;
    const token = getToken();
    if (!token) return;
    try {
        const response = await fetch(`${getApiBaseUrl()}/admin/outreach-contacts/${encodeURIComponent(id)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            throw new Error(data?.error || "Delete failed");
        }
        allContacts = allContacts.filter((c) => c.id !== id);
        renderContactList();
        showSuccess("Contact deleted.");
    } catch (e) {
        showError(e.message || "Failed to delete");
    }
}

function initOutreachContacts() {
    renderStatusChips();
    const search = document.getElementById("search-input");
    if (search) {
        let t;
        search.addEventListener("input", () => {
            clearTimeout(t);
            t = setTimeout(renderContactList, 200);
        });
    }
    loadContacts();
}

window.initOutreachContacts = initOutreachContacts;
window.loadContacts = loadContacts;
window.createContact = createContact;
