// Matchn Support Chat — admin sends Stream DMs as the official Matchn account

function getApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || "http://localhost:3000/api";
}

function getAuthToken() {
    return localStorage.getItem("adminToken") || null;
}

function escapeHtml(str) {
    return String(str == null ? "" : str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function showError(msg) {
    var err = document.getElementById("error-message");
    var ok = document.getElementById("success-message");
    if (ok) ok.style.display = "none";
    if (!err) return;
    err.textContent = msg || "Request failed";
    err.style.display = "block";
}

function showSuccess(msg) {
    var err = document.getElementById("error-message");
    var ok = document.getElementById("success-message");
    if (err) err.style.display = "none";
    if (!ok) return;
    ok.textContent = msg || "Done";
    ok.style.display = "block";
}

function getErrorMessage(data, defaultMsg) {
    defaultMsg = defaultMsg || "Request failed";
    if (!data) return defaultMsg;
    if (typeof data.error === "string") return data.error;
    if (data.error && typeof data.error.message === "string") return data.error.message;
    if (typeof data.message === "string") return data.message;
    return defaultMsg;
}

async function request(method, path, body) {
    var url = getApiBaseUrl() + path;
    var opts = {
        method: method,
        headers: {
            Authorization: "Bearer " + getAuthToken(),
            "Content-Type": "application/json",
        },
    };
    if (body && (method === "POST" || method === "PUT")) {
        opts.body = JSON.stringify(body);
    }
    var res = await fetch(url, opts);
    var text = await res.text();
    var data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(getErrorMessage(data));
    return data;
}

function formatWhen(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString();
    } catch (_) {
        return String(iso);
    }
}

function fillTargetFromConversation(userId, username) {
    var idEl = document.getElementById("target-user-id");
    var userEl = document.getElementById("target-username");
    if (idEl) idEl.value = userId || "";
    if (userEl) userEl.value = username || "";
    var textEl = document.getElementById("support-text");
    if (textEl) textEl.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function sendSupportDm() {
    var btn = document.getElementById("btn-send-support");
    var userId = (document.getElementById("target-user-id")?.value || "").trim();
    var username = (document.getElementById("target-username")?.value || "").trim();
    var text = (document.getElementById("support-text")?.value || "").trim();

    if (!userId && !username) {
        showError("Enter a user ID or username.");
        return;
    }
    if (!text) {
        showError("Message text is required.");
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = "Sending…";
    }
    try {
        var body = { text: text };
        if (userId) body.userId = userId;
        if (username) body.username = username;
        var data = await request("POST", "/admin/support/dm", body);
        var targetName =
            (data.target && (data.target.name || data.target.username)) ||
            username ||
            userId;
        showSuccess("Sent to " + targetName + " (channel " + (data.channelId || "") + ").");
        var textEl = document.getElementById("support-text");
        if (textEl) textEl.value = "";
        await loadSupportConversations();
    } catch (e) {
        showError(e.message || "Failed to send");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Send as Matchn";
        }
    }
}

async function loadSupportConversations() {
    var body = document.getElementById("conversations-body");
    var meta = document.getElementById("conversations-meta");
    var badge = document.getElementById("official-badge");
    if (body) {
        body.innerHTML = '<tr><td colspan="4" class="muted">Loading…</td></tr>';
    }
    try {
        var data = await request("GET", "/admin/support/conversations?limit=40");
        if (data.official && badge) {
            badge.textContent =
                "Sending as " +
                (data.official.name || "Matchn Support") +
                " (@" +
                (data.official.username || "matchn") +
                "). Channel opens only when you send.";
        }
        var list = data.conversations || [];
        if (meta) {
            meta.textContent =
                list.length === 0
                    ? "No Matchn DMs yet — send the first message above."
                    : list.length + " recent conversation(s).";
        }
        if (!body) return;
        body.innerHTML = "";
        if (list.length === 0) {
            body.innerHTML =
                '<tr><td colspan="4" class="muted">No conversations yet.</td></tr>';
            return;
        }
        list.forEach(function (c) {
            var tr = document.createElement("tr");
            var fromPill =
                c.lastMessageFromMatchn === true
                    ? '<span class="pill pill-out">Matchn</span>'
                    : c.lastMessageFromMatchn === false
                      ? '<span class="pill pill-in">User</span>'
                      : "";
            var nameLine = escapeHtml(c.otherUserName || "Unknown");
            if (c.otherUsername) {
                nameLine +=
                    ' <span class="muted">@' +
                    escapeHtml(c.otherUsername) +
                    "</span>";
            }
            tr.innerHTML =
                "<td>" +
                nameLine +
                (c.otherEmail
                    ? '<div class="muted">' + escapeHtml(c.otherEmail) + "</div>"
                    : "") +
                "</td>" +
                '<td class="preview-cell">' +
                fromPill +
                " " +
                escapeHtml(c.lastMessagePreview || "—") +
                "</td>" +
                "<td>" +
                escapeHtml(formatWhen(c.lastMessageAt)) +
                "</td>" +
                "<td>" +
                '<button class="btn btn-secondary btn-sm" type="button" data-uid="' +
                escapeHtml(c.otherUserId || "") +
                '" data-uname="' +
                escapeHtml(c.otherUsername || "") +
                '">Reply</button>' +
                "</td>";
            var btn = tr.querySelector("button");
            if (btn) {
                btn.addEventListener("click", function () {
                    fillTargetFromConversation(
                        btn.getAttribute("data-uid"),
                        btn.getAttribute("data-uname"),
                    );
                });
            }
            body.appendChild(tr);
        });
    } catch (e) {
        if (body) {
            body.innerHTML =
                '<tr><td colspan="4" class="muted">' +
                escapeHtml(e.message || "Failed to load") +
                "</td></tr>";
        }
        showError(e.message || "Failed to load conversations");
    }
}

function initSupportChatPage() {
    loadSupportConversations();
}

window.sendSupportDm = sendSupportDm;
window.loadSupportConversations = loadSupportConversations;
window.initSupportChatPage = initSupportChatPage;
window.fillTargetFromConversation = fillTargetFromConversation;
