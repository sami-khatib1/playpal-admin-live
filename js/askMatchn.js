function getApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || "http://localhost:3000/api";
}

function getToken() {
    return localStorage.getItem("adminToken");
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str || "");
    return div.innerHTML;
}

async function fetchAskMatchn() {
    const status = document.getElementById("filter-status")?.value || "pending";
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    const url = `${getApiBaseUrl()}/admin/ask-matchn/requests?${params.toString()}`;
    const response = await fetch(url, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
        },
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to fetch Ask Matchn requests");
    }
    return data.data || [];
}

async function submitAnswer(id, answer) {
    const url = `${getApiBaseUrl()}/admin/ask-matchn/requests/${encodeURIComponent(id)}`;
    const response = await fetch(url, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ answer }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to save answer");
    }
    return data.data;
}

function renderRows(items) {
    const tbody = document.getElementById("requests-table-body");
    tbody.innerHTML = "";
    if (!items.length) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="6" class="muted">No requests for this filter.</td>`;
        tbody.appendChild(tr);
        return;
    }

    items.forEach((item) => {
        const tr = document.createElement("tr");
        const created = item.createdAt ? new Date(item.createdAt).toLocaleString() : "";
        const groupLabel = [item.communityName, item.communitySport].filter(Boolean).join(" · ");
        const asker = item.askedBy?.name || item.askedBy?.username || item.askedBy?.email || "—";
        const status = String(item.status || "pending").toLowerCase();
        const answerBlock =
            status === "answered"
                ? `<div class="answer-cell">${escapeHtml(item.answer || "")}</div>`
                : `<form class="answer-form" data-id="${escapeHtml(item.id)}">
                        <textarea placeholder="Type your answer…" required></textarea>
                        <button type="submit" class="btn btn-primary" style="margin-top:0.5rem;">Send answer</button>
                   </form>`;

        tr.innerHTML =
            `<td>${escapeHtml(created)}</td>` +
            `<td>${escapeHtml(groupLabel || item.communityId || "")}</td>` +
            `<td>${escapeHtml(asker)}</td>` +
            `<td class="message-cell">${escapeHtml(item.question || "")}</td>` +
            `<td><span class="pill pill-${escapeHtml(status)}">${escapeHtml(status)}</span></td>` +
            `<td>${answerBlock}</td>`;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll("form.answer-form").forEach((form) => {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = form.getAttribute("data-id");
            const textarea = form.querySelector("textarea");
            const answer = (textarea?.value || "").trim();
            if (!answer) return;
            const btn = form.querySelector('button[type="submit"]');
            if (btn) {
                btn.disabled = true;
                btn.textContent = "Saving…";
            }
            try {
                await submitAnswer(id, answer);
                await loadAskMatchn();
            } catch (err) {
                alert(err.message || "Failed to save");
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = "Send answer";
                }
            }
        });
    });
}

function setLoading(loading) {
    document.getElementById("loading").style.display = loading ? "block" : "none";
    document.getElementById("table-wrap").style.display = loading ? "none" : "block";
}

async function loadAskMatchn() {
    setLoading(true);
    try {
        const items = await fetchAskMatchn();
        document.getElementById("meta").textContent = `${items.length} request(s)`;
        renderRows(items);
    } catch (err) {
        document.getElementById("meta").textContent = err.message || "Error";
        renderRows([]);
    } finally {
        setLoading(false);
    }
}

function initAskMatchnPage() {
    document.getElementById("btn-refresh")?.addEventListener("click", loadAskMatchn);
    document.getElementById("filter-status")?.addEventListener("change", loadAskMatchn);
    loadAskMatchn();
}

window.initAskMatchnPage = initAskMatchnPage;
