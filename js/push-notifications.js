function getApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || "http://localhost:3000/api";
}

function getToken() {
    return localStorage.getItem("adminToken");
}

/** Must match backend default cap (ADMIN_PUSH_MAX_RECIPIENTS env override). */
const MAX_RECIPIENTS = 200;

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

let allUsers = [];

function getSelectedIds() {
    const boxes = document.querySelectorAll('input.user-check:checked');
    return Array.from(boxes).map((b) => b.getAttribute("data-user-id")).filter(Boolean);
}

function updateSelectionCount() {
    const n = getSelectedIds().length;
    const el = document.getElementById("selection-count");
    if (el) el.textContent = `${n} selected (max ${MAX_RECIPIENTS})`;
}

function filterTable() {
    const q = (document.getElementById("user-search")?.value || "").trim().toLowerCase();
    const rows = document.querySelectorAll("#user-picker-body tr[data-user-row]");
    rows.forEach((tr) => {
        const hay = tr.getAttribute("data-search") || "";
        if (!q || hay.includes(q)) tr.classList.remove("row-hidden");
        else tr.classList.add("row-hidden");
    });
}

async function loadUsersForPicker() {
    const loading = document.getElementById("picker-loading");
    const wrap = document.getElementById("picker-wrap");
    const tbody = document.getElementById("user-picker-body");
    const meta = document.getElementById("picker-meta");
    const token = getToken();
    if (!token) {
        showError("Not signed in.");
        return;
    }
    showError("");
    if (loading) loading.style.display = "block";
    if (wrap) wrap.style.display = "none";
    try {
        const url = `${getApiBaseUrl()}/admin/users`;
        const response = await fetch(url, {
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
        allUsers = data.users || [];
        if (meta) meta.textContent = `${allUsers.length} users loaded — pick recipients below`;
        if (tbody) {
            tbody.innerHTML = allUsers
                .map((u) => {
                    const id = escapeHtml(u.id || "");
                    const name = escapeHtml(u.name || "");
                    const username = escapeHtml(u.username || "");
                    const email = escapeHtml(u.email || "");
                    const search = `${String(u.name || "").toLowerCase()} ${String(u.username || "").toLowerCase()} ${String(u.email || "").toLowerCase()}`;
                    return `<tr data-user-row data-search="${escapeHtml(search)}">
                        <td><input type="checkbox" class="user-check form-input" data-user-id="${id}" /></td>
                        <td>${name}</td>
                        <td>${username}</td>
                        <td>${email}</td>
                    </tr>`;
                })
                .join("");
            tbody.querySelectorAll(".user-check").forEach((cb) => {
                cb.addEventListener("change", updateSelectionCount);
            });
        }
        if (loading) loading.style.display = "none";
        if (wrap) wrap.style.display = "block";
        updateSelectionCount();
    } catch (e) {
        console.error(e);
        showError(e.message || "Failed to load users");
        if (loading) loading.style.display = "none";
    }
}

function selectAllVisible() {
    const boxes = document.querySelectorAll("#user-picker-body tr[data-user-row]:not(.row-hidden) .user-check");
    let count = 0;
    boxes.forEach((cb) => {
        if (count >= MAX_RECIPIENTS) return;
        cb.checked = true;
        count++;
    });
    updateSelectionCount();
}

function clearSelection() {
    document.querySelectorAll(".user-check").forEach((cb) => {
        cb.checked = false;
    });
    updateSelectionCount();
}

async function sendPush() {
    const title = (document.getElementById("push-title")?.value || "").trim();
    const body = (document.getElementById("push-body")?.value || "").trim();
    const ids = getSelectedIds();
    const token = getToken();
    const resultEl = document.getElementById("send-result");

    showError("");
    showSuccess("");
    if (resultEl) resultEl.innerHTML = "";

    if (ids.length === 0) {
        showError("Select at least one user.");
        return;
    }
    if (ids.length > MAX_RECIPIENTS) {
        showError(`Select at most ${MAX_RECIPIENTS} users per batch.`);
        return;
    }
    if (!title) {
        showError("Enter a title.");
        return;
    }
    if (!body) {
        showError("Enter body text.");
        return;
    }
    if (!token) {
        showError("Not signed in.");
        return;
    }

    const btn = document.getElementById("btn-send-push");
    if (btn) btn.disabled = true;

    try {
        const url = `${getApiBaseUrl()}/admin/notifications/push`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ userIds: ids, title, body }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
        }
        const s = data.summary || {};
        const msg = `Sent: ${s.deliveredToUser ?? 0} · No device: ${s.noDeviceTokens ?? 0} · Failed: ${s.failed ?? 0}`;
        showSuccess(msg);
        if (resultEl) {
            const rows = (data.results || [])
                .filter((r) => !r.ok)
                .slice(0, 50)
                .map((r) => `<li><code>${escapeHtml(r.userId)}</code> — ${escapeHtml(r.error || "failed")}</li>`)
                .join("");
            resultEl.innerHTML =
                rows.length > 0
                    ? `<p class="muted" style="margin-top:0.75rem;">Failures (first 50):</p><ul style="margin:0;font-size:0.85rem;">${rows}</ul>`
                    : "";
        }
    } catch (e) {
        console.error(e);
        showError(e.message || "Send failed");
    } finally {
        if (btn) btn.disabled = false;
    }
}

window.loadUsersForPicker = loadUsersForPicker;
window.filterTable = filterTable;
window.selectAllVisible = selectAllVisible;
window.clearSelection = clearSelection;
window.sendPush = sendPush;
