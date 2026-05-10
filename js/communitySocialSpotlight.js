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

async function loadPending() {
    showError("");
    const loading = document.getElementById("loading");
    const wrap = document.getElementById("table-wrap");
    const tbody = document.getElementById("table-body");
    const meta = document.getElementById("meta");
    const token = getToken();
    if (!token) {
        window.navigate("/login");
        return;
    }
    loading.style.display = "block";
    tbody.innerHTML = "";
    meta.textContent = "Loading…";

    try {
        const res = await fetch(
            `${getApiBaseUrl()}/admin/community-social-spotlight/pending`,
            {
                headers: {
                    Authorization: "Bearer " + token,
                    Accept: "application/json",
                },
            },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || data.message || "Request failed");
        }
        const submissions = Array.isArray(data.submissions) ? data.submissions : [];
        meta.textContent =
            submissions.length === 0
                ? "No pending spotlight photos."
                : submissions.length + " pending submission(s).";

        if (loading) loading.style.display = "none";
        if (wrap) wrap.style.display = "block";

        if (submissions.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="6" class="muted">Nothing pending — group admins submit from the community screen.</td></tr>';
            return;
        }

        submissions.forEach((row) => {
            const tr = document.createElement("tr");
            const groupName = escapeHtml(row.community?.name || "—");
            const sport = escapeHtml(row.community?.sport || "—");
            const who = escapeHtml(
                row.uploadedBy?.name || row.uploadedBy?.username || "—",
            );
            const thumb = row.imageUrl
                ? `<img src="${escapeHtml(row.imageUrl)}" alt="" style="max-height:72px;border-radius:8px;" />`
                : escapeHtml(row.objectPath || "");
            tr.innerHTML = `
                <td>${thumb}</td>
                <td>${groupName}</td>
                <td>${sport}</td>
                <td>${who}</td>
                <td>${formatDate(row.createdAt)}</td>
                <td>
                    <button type="button" class="btn btn-primary btn-sm" onclick="approveSubmission('${escapeHtml(row.id)}')">Approve</button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="rejectSubmission('${escapeHtml(row.id)}')">Reject</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        if (loading) loading.style.display = "none";
        if (wrap) wrap.style.display = "block";
        meta.textContent = "";
        showError(e.message || "Failed to load");
    }
}

async function approveSubmission(submissionId) {
    const token = getToken();
    if (!confirm("Approve this photo for in-app community spotlight?")) return;
    try {
        const res = await fetch(
            `${getApiBaseUrl()}/admin/community-social-spotlight/${submissionId}/approve`,
            {
                method: "PUT",
                headers: {
                    Authorization: "Bearer " + token,
                    Accept: "application/json",
                },
            },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Approve failed");
        await loadPending();
    } catch (e) {
        alert(e.message || "Approve failed");
    }
}

async function rejectSubmission(submissionId) {
    const token = getToken();
    if (!confirm("Reject this submission? It will not appear in the app."))
        return;
    try {
        const res = await fetch(
            `${getApiBaseUrl()}/admin/community-social-spotlight/${submissionId}/reject`,
            {
                method: "PUT",
                headers: {
                    Authorization: "Bearer " + token,
                    Accept: "application/json",
                },
            },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Reject failed");
        await loadPending();
    } catch (e) {
        alert(e.message || "Reject failed");
    }
}
