// In-app questions (admin CRUD)

function getApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || "http://localhost:3000/api";
}

function getAuthToken() {
    return localStorage.getItem("adminToken") || null;
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
    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
        opts.body = JSON.stringify(body);
    }
    var res = await fetch(url, opts);
    var text = await res.text();
    var data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(getErrorMessage(data));
    return data;
}

function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s == null ? "" : String(s);
    return div.innerHTML;
}

function addOptionRow(value, optionId) {
    var list = document.getElementById("options-list");
    if (!list) return;
    var row = document.createElement("div");
    row.className = "option-row";
    row.innerHTML =
        '<input type="hidden" class="option-id" value="' + escapeHtml(optionId || "") + '" />' +
        '<input type="text" class="option-text" placeholder="Answer" value="' + escapeHtml(value || "") + '" />' +
        '<button type="button" class="btn btn-sm btn-secondary option-remove">Remove</button>';
    row.querySelector(".option-remove").addEventListener("click", function () {
        if (list.querySelectorAll(".option-row").length <= 2) {
            alert("Keep at least two answers.");
            return;
        }
        row.remove();
    });
    list.appendChild(row);
}

function collectOptions() {
    var rows = document.querySelectorAll("#options-list .option-row");
    var options = [];
    rows.forEach(function (row, index) {
        var text = (row.querySelector(".option-text")?.value || "").trim();
        var id = (row.querySelector(".option-id")?.value || "").trim();
        if (!text) return;
        options.push({ id: id || undefined, text: text, displayOrder: index });
    });
    return options;
}

function resetForm() {
    document.getElementById("form-title").textContent = "Add question";
    document.getElementById("question-form").reset();
    document.getElementById("question-id").value = "";
    document.getElementById("displayOrder").value = "0";
    document.getElementById("isActive").checked = true;
    document.getElementById("form-success").style.display = "none";
    document.getElementById("form-error").style.display = "none";
    var list = document.getElementById("options-list");
    list.innerHTML = "";
    addOptionRow("");
    addOptionRow("");
}

async function loadQuestions() {
    var loading = document.getElementById("loading-message");
    var listWrap = document.getElementById("list-wrap");
    var listBody = document.getElementById("list-body");
    var errEl = document.getElementById("error-message");
    try {
        var data = await request("GET", "/admin/questions");
        loading.style.display = "none";
        errEl.style.display = "none";
        listWrap.style.display = "block";
        listBody.innerHTML = "";
        (data.questions || []).forEach(function (q) {
            var tr = document.createElement("tr");
            var answers = (q.options || []).map(function (o) { return o.text; }).join(", ");
            tr.innerHTML =
                "<td>" + escapeHtml(q.title || "") + "</td>" +
                "<td>" + escapeHtml(answers) + "</td>" +
                "<td>" + (q.displayOrder != null ? q.displayOrder : 0) + "</td>" +
                "<td>" + (q.answerCount != null ? q.answerCount : 0) + "</td>" +
                '<td><span class="badge ' + (q.isActive ? "badge-active" : "badge-inactive") + '">' +
                (q.isActive ? "Active" : "Inactive") + "</span></td>" +
                '<td class="actions-cell">' +
                '<button class="btn btn-secondary btn-sm" data-edit="' + q.id + '">Edit</button> ' +
                '<button class="btn btn-secondary btn-sm" data-responses="' + q.id + '">Responses</button> ' +
                '<button class="btn btn-danger btn-sm" data-delete="' + q.id + '">Delete</button>' +
                "</td>";
            listBody.appendChild(tr);
        });
        listBody.querySelectorAll("[data-edit]").forEach(function (btn) {
            btn.addEventListener("click", function () { editQuestion(btn.getAttribute("data-edit")); });
        });
        listBody.querySelectorAll("[data-responses]").forEach(function (btn) {
            btn.addEventListener("click", function () { loadResponses(btn.getAttribute("data-responses")); });
        });
        listBody.querySelectorAll("[data-delete]").forEach(function (btn) {
            btn.addEventListener("click", function () { deleteQuestion(btn.getAttribute("data-delete")); });
        });
    } catch (e) {
        loading.style.display = "none";
        listWrap.style.display = "none";
        errEl.textContent = e.message || "Failed to load questions";
        errEl.style.display = "block";
    }
}

async function editQuestion(id) {
    try {
        var q = await request("GET", "/admin/questions/" + id);
        document.getElementById("form-title").textContent = "Edit question";
        document.getElementById("question-id").value = q.id;
        document.getElementById("title").value = q.title || "";
        document.getElementById("content").value = q.content || "";
        document.getElementById("displayOrder").value = q.displayOrder != null ? q.displayOrder : 0;
        document.getElementById("isActive").checked = q.isActive !== false;
        document.getElementById("form-success").style.display = "none";
        document.getElementById("form-error").style.display = "none";
        var list = document.getElementById("options-list");
        list.innerHTML = "";
        var options = q.options || [];
        if (options.length < 2) {
            addOptionRow("");
            addOptionRow("");
        } else {
            options.forEach(function (opt) {
                addOptionRow(opt.text || "", opt.id);
            });
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
        alert(e.message || "Failed to load question");
    }
}

async function saveQuestion(e) {
    e.preventDefault();
    var id = document.getElementById("question-id").value;
    var options = collectOptions();
    var payload = {
        title: document.getElementById("title").value.trim(),
        content: document.getElementById("content").value.trim() || null,
        displayOrder: parseInt(document.getElementById("displayOrder").value, 10) || 0,
        isActive: document.getElementById("isActive").checked,
        options: options,
    };
    var successEl = document.getElementById("form-success");
    var errorEl = document.getElementById("form-error");
    successEl.style.display = "none";
    errorEl.style.display = "none";
    if (options.length < 2) {
        errorEl.textContent = "Add at least two answers.";
        errorEl.style.display = "block";
        return false;
    }
    try {
        if (id) {
            await request("PUT", "/admin/questions/" + id, payload);
            successEl.textContent = "Question updated.";
        } else {
            await request("POST", "/admin/questions", payload);
            successEl.textContent = "Question created. Mark users on the Users page to show it in the app.";
        }
        successEl.style.display = "block";
        resetForm();
        loadQuestions();
    } catch (err) {
        errorEl.textContent = err.message || "Save failed";
        errorEl.style.display = "block";
    }
    return false;
}

async function deleteQuestion(id) {
    if (!confirm("Delete this question and its answers? This cannot be undone.")) return;
    try {
        await request("DELETE", "/admin/questions/" + id);
        document.getElementById("responses-wrap").style.display = "none";
        loadQuestions();
        resetForm();
    } catch (e) {
        alert(e.message || "Delete failed");
    }
}

async function loadResponses(id) {
    var wrap = document.getElementById("responses-wrap");
    var title = document.getElementById("responses-title");
    var body = document.getElementById("responses-body");
    wrap.style.display = "block";
    body.textContent = "Loading…";
    try {
        var data = await request("GET", "/admin/questions/" + id + "/responses");
        title.textContent = "Responses — " + (data.question?.title || "");
        var rows = data.responses || [];
        if (!rows.length) {
            body.textContent = "No answers yet.";
            return;
        }
        var table =
            '<table class="list-table"><thead><tr><th>User</th><th>Username</th><th>Answer</th><th>When</th></tr></thead><tbody>' +
            rows.map(function (r) {
                return "<tr><td>" + escapeHtml(r.user?.name || "") + "</td><td>" +
                    escapeHtml(r.user?.username || "") + "</td><td>" +
                    escapeHtml(r.optionText || "") + "</td><td>" +
                    (r.answeredAt ? new Date(r.answeredAt).toLocaleString() : "") +
                    "</td></tr>";
            }).join("") +
            "</tbody></table>";
        body.innerHTML = table;
    } catch (e) {
        body.textContent = e.message || "Failed to load responses";
    }
}

window.addOptionRow = addOptionRow;
window.resetForm = resetForm;
window.saveQuestion = saveQuestion;
window.loadQuestions = loadQuestions;
