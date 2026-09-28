// Surveys: each send has its own people and questions.

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
    var res = await fetch(getApiBaseUrl() + path, opts);
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

var directory = [];
var selectedUsers = [];

function userLabel(user) {
    var name = user.name || "Unnamed";
    return user.username ? name + " (@" + user.username + ")" : name;
}

function sportLabel(slug) {
    return window.AdminSportLabels?.sportSlugToDisplayLabel(slug) || slug;
}

function eligibleUsers() {
    return directory.filter(function (user) {
        return user.id && !user.deletedAt && user.accountType !== "guest";
    });
}

function selectedFilters() {
    return {
        query: (document.getElementById("user-search")?.value || "").trim().toLowerCase(),
        city: document.getElementById("filter-city")?.value || "",
        sport: document.getElementById("filter-sport")?.value || "",
        account: document.getElementById("filter-account")?.value || "",
        gender: document.getElementById("filter-gender")?.value || "",
    };
}

function userMatches(user, filters) {
    if (filters.query) {
        var name = String(user.name || "").toLowerCase();
        var username = String(user.username || "").toLowerCase();
        if (name.indexOf(filters.query) === -1 && username.indexOf(filters.query) === -1) return false;
    }
    if (filters.city && String(user.city || "") !== filters.city) return false;
    if (filters.account && String(user.accountType || "user") !== filters.account) return false;
    if (filters.gender && String(user.gender || "") !== filters.gender) return false;
    if (filters.sport) {
        var sports = Array.isArray(user.favoriteSports) ? user.favoriteSports : [];
        var needle = filters.sport.toLowerCase();
        if (!sports.some(function (sport) { return String(sport).toLowerCase() === needle; })) return false;
    }
    return true;
}

function matchingUsers() {
    var filters = selectedFilters();
    return eligibleUsers().filter(function (user) { return userMatches(user, filters); });
}

function fillFilterOptions() {
    var users = eligibleUsers();
    var citySel = document.getElementById("filter-city");
    var sportSel = document.getElementById("filter-sport");
    var cities = [];
    var sports = [];
    users.forEach(function (user) {
        var city = String(user.city || "").trim();
        if (city && cities.indexOf(city) === -1) cities.push(city);
        (user.favoriteSports || []).forEach(function (sport) {
            var raw = String(sport || "").trim();
            if (raw && sports.indexOf(raw) === -1) sports.push(raw);
        });
    });
    cities.sort(function (a, b) { return a.localeCompare(b); });
    if (window.AdminSportLabels?.mergeSportOptions) sports = window.AdminSportLabels.mergeSportOptions(sports);
    else sports.sort(function (a, b) { return a.localeCompare(b); });
    if (citySel) {
        var prevCity = citySel.value;
        citySel.innerHTML = '<option value="">All cities</option>' + cities.map(function (city) {
            return '<option value="' + escapeHtml(city) + '">' + escapeHtml(city) + "</option>";
        }).join("");
        citySel.value = cities.indexOf(prevCity) >= 0 ? prevCity : "";
    }
    if (sportSel) {
        var prevSport = sportSel.value;
        sportSel.innerHTML = '<option value="">All sports</option>' + sports.map(function (sport) {
            return '<option value="' + escapeHtml(sport) + '">' + escapeHtml(sportLabel(sport)) + "</option>";
        }).join("");
        sportSel.value = sports.indexOf(prevSport) >= 0 ? prevSport : "";
    }
}

function renderSelected() {
    var chips = document.getElementById("selected-chips");
    var empty = document.getElementById("selected-empty");
    if (!chips) return;
    chips.innerHTML = "";
    selectedUsers.forEach(function (user) {
        var chip = document.createElement("span");
        chip.className = "chip";
        chip.innerHTML = escapeHtml(userLabel(user)) + '<button type="button" aria-label="Remove">×</button>';
        chip.querySelector("button").addEventListener("click", function () {
            selectedUsers = selectedUsers.filter(function (item) { return item.id !== user.id; });
            renderSelected();
            renderUserList();
        });
        chips.appendChild(chip);
    });
    if (empty) empty.style.display = selectedUsers.length ? "none" : "block";
}

function renderUserList() {
    var list = document.getElementById("user-list");
    var countEl = document.getElementById("match-count");
    if (!list) return;
    var matches = matchingUsers().slice(0, 80);
    var total = matchingUsers().length;
    if (countEl) countEl.textContent = total + " matching · " + selectedUsers.length + " selected";
    list.innerHTML = "";
    if (!matches.length) {
        list.innerHTML = '<div class="user-row muted">No matching people</div>';
        return;
    }
    var selectedIds = {};
    selectedUsers.forEach(function (user) { selectedIds[user.id] = true; });
    matches.forEach(function (user) {
        var row = document.createElement("label");
        row.className = "user-row";
        var box = document.createElement("input");
        box.type = "checkbox";
        box.checked = !!selectedIds[user.id];
        box.addEventListener("change", function () {
            if (box.checked) {
                if (!selectedIds[user.id]) {
                    selectedUsers.push({ id: user.id, name: user.name || "", username: user.username || "" });
                }
            } else {
                selectedUsers = selectedUsers.filter(function (item) { return item.id !== user.id; });
            }
            renderSelected();
            if (countEl) countEl.textContent = total + " matching · " + selectedUsers.length + " selected";
        });
        var text = document.createElement("span");
        var city = user.city ? " · " + user.city : "";
        text.textContent = userLabel(user) + city;
        row.appendChild(box);
        row.appendChild(text);
        list.appendChild(row);
    });
}

function addQuestionBlock() {
    var wrap = document.getElementById("question-blocks");
    if (!wrap) return;
    var block = document.createElement("div");
    block.className = "question-block";
    block.innerHTML =
        '<div class="form-group"><label>Question *</label><input type="text" class="q-title" placeholder="Question" /></div>' +
        '<div class="form-group"><label>Extra text</label><input type="text" class="q-content" placeholder="Optional" /></div>' +
        '<div class="q-options"></div>' +
        '<button type="button" class="btn btn-secondary btn-sm q-add">+ Add answer</button> ' +
        '<button type="button" class="btn btn-secondary btn-sm q-remove">Remove question</button>';
    function addOption(value) {
        var row = document.createElement("div");
        row.className = "option-row";
        row.innerHTML = '<input type="text" class="q-option" placeholder="Answer" value="' + escapeHtml(value || "") + '" />' +
            '<button type="button" class="btn btn-sm btn-secondary">Remove</button>';
        row.querySelector("button").addEventListener("click", function () {
            if (block.querySelectorAll(".q-option").length <= 2) return;
            row.remove();
        });
        block.querySelector(".q-options").appendChild(row);
    }
    addOption("");
    addOption("");
    block.querySelector(".q-add").addEventListener("click", function () { addOption(""); });
    block.querySelector(".q-remove").addEventListener("click", function () {
        if (wrap.querySelectorAll(".question-block").length <= 1) return;
        block.remove();
    });
    wrap.appendChild(block);
}

function collectQuestions() {
    return Array.prototype.map.call(document.querySelectorAll(".question-block"), function (block) {
        return {
            title: (block.querySelector(".q-title")?.value || "").trim(),
            content: (block.querySelector(".q-content")?.value || "").trim(),
            options: Array.prototype.map.call(block.querySelectorAll(".q-option"), function (input) {
                return { text: input.value.trim() };
            }).filter(function (option) { return option.text; }),
        };
    });
}

function resetBuilder() {
    selectedUsers = [];
    document.getElementById("survey-name").value = "";
    document.getElementById("user-search").value = "";
    ["filter-city", "filter-sport", "filter-account", "filter-gender"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = "";
    });
    document.getElementById("question-blocks").innerHTML = "";
    addQuestionBlock();
    document.getElementById("builder-success").style.display = "none";
    document.getElementById("builder-error").style.display = "none";
    renderSelected();
    renderUserList();
}

async function ensureDirectory() {
    if (directory.length) return;
    var data = await request("GET", "/admin/users");
    directory = data.users || [];
    fillFilterOptions();
}

async function openBuilder() {
    var errorEl = document.getElementById("builder-error");
    document.getElementById("builder").style.display = "block";
    document.getElementById("results").style.display = "none";
    try {
        await ensureDirectory();
        resetBuilder();
    } catch (e) {
        errorEl.textContent = e.message || "Failed to load users";
        errorEl.style.display = "block";
    }
}

function renderBars(question) {
    var max = Math.max.apply(null, question.options.map(function (option) { return option.count; }).concat([1]));
    return question.options.map(function (option) {
        var width = Math.round((option.count / max) * 100);
        return '<div class="bar-row"><span>' + escapeHtml(option.text) + '</span>' +
            '<div class="bar-track"><div class="bar-fill" style="width:' + width + '%"></div></div>' +
            "<span>" + option.count + "</span></div>";
    }).join("");
}

function personList(people) {
    if (!people.length) return '<p class="muted">None</p>';
    return "<ul>" + people.map(function (person) {
        return "<li>" + escapeHtml(userLabel(person)) + "</li>";
    }).join("") + "</ul>";
}

async function openSurvey(id) {
    var wrap = document.getElementById("results");
    var body = document.getElementById("results-body");
    var errorEl = document.getElementById("results-error");
    document.getElementById("builder").style.display = "none";
    wrap.style.display = "block";
    body.textContent = "Loading…";
    errorEl.style.display = "none";
    try {
        var survey = await request("GET", "/admin/surveys/" + encodeURIComponent(id));
        document.getElementById("results-title").textContent = survey.name || "Survey";
        document.getElementById("results-meta").textContent =
            (survey.answeredCount || 0) + " of " + (survey.recipientCount || 0) +
            " finished every question" +
            (survey.sentAt ? " · sent " + new Date(survey.sentAt).toLocaleString() : "");
        var answered = (survey.recipients || []).filter(function (person) { return person.status === "answered"; });
        var partial = (survey.recipients || []).filter(function (person) { return person.status === "partial"; });
        var pending = (survey.recipients || []).filter(function (person) { return person.status === "not_answered"; });
        var charts = (survey.questions || []).map(function (question, index) {
            return "<h3>" + (index + 1) + ". " + escapeHtml(question.title) + "</h3>" +
                '<p class="muted">' + question.responseCount + " answers</p>" + renderBars(question);
        }).join("");
        body.innerHTML =
            '<div class="split"><div><h3>Answered</h3>' + personList(answered) +
            (partial.length ? "<h3>Answered some</h3>" + personList(partial) : "") +
            "</div><div><h3>Did not answer</h3>" + personList(pending) + "</div></div>" +
            charts;
    } catch (e) {
        body.textContent = "";
        errorEl.textContent = e.message || "Failed to load survey";
        errorEl.style.display = "block";
    }
}

async function loadSurveys() {
    var loading = document.getElementById("list-loading");
    var wrap = document.getElementById("list-wrap");
    var body = document.getElementById("list-body");
    var errorEl = document.getElementById("list-error");
    try {
        var data = await request("GET", "/admin/surveys");
        loading.style.display = "none";
        errorEl.style.display = "none";
        wrap.style.display = "block";
        body.innerHTML = "";
        var surveys = data.surveys || [];
        if (!surveys.length) {
            body.innerHTML = '<tr><td colspan="4" class="muted">No surveys yet.</td></tr>';
            return;
        }
        surveys.forEach(function (survey) {
            var tr = document.createElement("tr");
            tr.className = "survey-row";
            tr.innerHTML =
                "<td>" + escapeHtml(survey.name || "") + "</td>" +
                "<td>" + (survey.recipientCount || 0) + "</td>" +
                "<td>" + (survey.questionCount || 0) + "</td>" +
                "<td>" + (survey.sentAt ? new Date(survey.sentAt).toLocaleString() : "") + "</td>";
            tr.addEventListener("click", function () { openSurvey(survey.id); });
            body.appendChild(tr);
        });
    } catch (e) {
        loading.style.display = "none";
        wrap.style.display = "none";
        errorEl.textContent = e.message || "Failed to load surveys";
        errorEl.style.display = "block";
    }
}

async function sendSurvey() {
    var successEl = document.getElementById("builder-success");
    var errorEl = document.getElementById("builder-error");
    var button = document.getElementById("send-survey");
    successEl.style.display = "none";
    errorEl.style.display = "none";
    var questions = collectQuestions().filter(function (question) {
        return question.title && question.options.length >= 2;
    });
    if (!document.getElementById("survey-name").value.trim()) {
        errorEl.textContent = "Name the survey.";
        errorEl.style.display = "block";
        return;
    }
    if (!selectedUsers.length) {
        errorEl.textContent = "Choose at least one person.";
        errorEl.style.display = "block";
        return;
    }
    if (!questions.length) {
        errorEl.textContent = "Add at least one question with two answers.";
        errorEl.style.display = "block";
        return;
    }
    button.disabled = true;
    try {
        await request("POST", "/admin/surveys", {
            name: document.getElementById("survey-name").value.trim(),
            userIds: selectedUsers.map(function (user) { return user.id; }),
            questions: questions,
        });
        successEl.textContent = "Survey sent.";
        successEl.style.display = "block";
        document.getElementById("builder").style.display = "none";
        loadSurveys();
    } catch (e) {
        errorEl.textContent = e.message || "Failed to send survey";
        errorEl.style.display = "block";
    } finally {
        button.disabled = false;
    }
}

function bindSurveyPage() {
    document.getElementById("new-survey")?.addEventListener("click", openBuilder);
    document.getElementById("cancel-survey")?.addEventListener("click", function () {
        document.getElementById("builder").style.display = "none";
    });
    document.getElementById("add-question")?.addEventListener("click", addQuestionBlock);
    document.getElementById("send-survey")?.addEventListener("click", sendSurvey);
    document.getElementById("close-results")?.addEventListener("click", function () {
        document.getElementById("results").style.display = "none";
    });
    document.getElementById("select-matching")?.addEventListener("click", function () {
        var selectedIds = {};
        selectedUsers.forEach(function (user) { selectedIds[user.id] = true; });
        matchingUsers().forEach(function (user) {
            if (!selectedIds[user.id]) {
                selectedUsers.push({ id: user.id, name: user.name || "", username: user.username || "" });
            }
        });
        renderSelected();
        renderUserList();
    });
    ["user-search", "filter-city", "filter-sport", "filter-account", "filter-gender"].forEach(function (id) {
        document.getElementById(id)?.addEventListener("input", renderUserList);
        document.getElementById(id)?.addEventListener("change", renderUserList);
    });
    if (window.DbTarget && typeof window.DbTarget.onChange === "function") {
        window.DbTarget.onChange(function () {
            directory = [];
            selectedUsers = [];
            loadSurveys();
            if (document.getElementById("builder").style.display !== "none") openBuilder();
        });
    }
}

bindSurveyPage();
window.loadSurveys = loadSurveys;
