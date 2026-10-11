// In-app announcements (admin CRUD)

function getApiBaseUrl() {
    return window.NetworkConfig?.API_BASE_URL || 'http://localhost:3000/api';
}

function getAuthToken() {
    return localStorage.getItem('adminToken') || null;
}

async function request(method, path, body) {
    var url = getApiBaseUrl() + path;
    var opts = {
        method: method,
        headers: {
            'Authorization': 'Bearer ' + getAuthToken(),
            'Content-Type': 'application/json',
        },
    };
    if (body && (method === 'POST' || method === 'PUT')) opts.body = JSON.stringify(body);
    var res = await fetch(url, opts);
    var text = await res.text();
    var data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(getErrorMessage(data));
    return data;
}

// Extract a string from API error response (avoid "[object Object]")
function getErrorMessage(data, defaultMsg) {
    defaultMsg = defaultMsg || 'Request failed';
    if (!data) return defaultMsg;
    if (typeof data.error === 'string') return data.error;
    if (data.error && typeof data.error.message === 'string') return data.error.message;
    if (typeof data.message === 'string') return data.message;
    return defaultMsg;
}

var announcementUserDirectory = [];
var selectedAnnouncementUsers = [];

function announcementUserLabel(user) {
    var name = user.name || user.username || user.email || 'Unnamed';
    return user.username ? name + ' (@' + user.username + ')' : name;
}

function eligibleAnnouncementUsers() {
    return announcementUserDirectory.filter(function (user) {
        return user.id && !user.deletedAt && user.accountType !== 'guest';
    });
}

function announcementAudienceFilters() {
    return {
        query: (document.getElementById('user-search')?.value || '').trim().toLowerCase(),
        city: document.getElementById('filter-city')?.value || '',
        sport: document.getElementById('filter-sport')?.value || '',
        account: document.getElementById('filter-account')?.value || '',
        gender: document.getElementById('filter-gender')?.value || '',
    };
}

function announcementUserMatches(user, filters) {
    if (filters.query) {
        var haystack = [user.name, user.username, user.email].map(function (value) {
            return String(value || '').toLowerCase();
        }).join(' ');
        if (haystack.indexOf(filters.query) === -1) return false;
    }
    if (filters.city && String(user.city || '') !== filters.city) return false;
    if (filters.account && String(user.accountType || 'user') !== filters.account) return false;
    if (filters.gender && String(user.gender || '') !== filters.gender) return false;
    if (filters.sport) {
        var needle = filters.sport.toLowerCase();
        var sports = Array.isArray(user.favoriteSports) ? user.favoriteSports : [];
        if (!sports.some(function (sport) { return String(sport).toLowerCase() === needle; })) return false;
    }
    return true;
}

function matchingAnnouncementUsers() {
    var filters = announcementAudienceFilters();
    return eligibleAnnouncementUsers().filter(function (user) {
        return announcementUserMatches(user, filters);
    });
}

function fillAnnouncementFilterOptions() {
    var cities = [];
    var sports = [];
    eligibleAnnouncementUsers().forEach(function (user) {
        var city = String(user.city || '').trim();
        if (city && cities.indexOf(city) === -1) cities.push(city);
        (user.favoriteSports || []).forEach(function (sport) {
            var raw = String(sport || '').trim();
            if (raw && sports.indexOf(raw) === -1) sports.push(raw);
        });
    });
    cities.sort(function (a, b) { return a.localeCompare(b); });
    if (window.AdminSportLabels?.mergeSportOptions) {
        sports = window.AdminSportLabels.mergeSportOptions(sports);
    } else {
        sports.sort(function (a, b) { return a.localeCompare(b); });
    }
    var citySelect = document.getElementById('filter-city');
    var sportSelect = document.getElementById('filter-sport');
    citySelect.innerHTML = '<option value="">All cities</option>' + cities.map(function (city) {
        return '<option value="' + escapeHtml(city) + '">' + escapeHtml(city) + '</option>';
    }).join('');
    sportSelect.innerHTML = '<option value="">All sports</option>' + sports.map(function (sport) {
        var label = window.AdminSportLabels?.sportSlugToDisplayLabel(sport) || sport;
        return '<option value="' + escapeHtml(sport) + '">' + escapeHtml(label) + '</option>';
    }).join('');
}

function renderSelectedAnnouncementUsers() {
    var chips = document.getElementById('selected-chips');
    var empty = document.getElementById('selected-empty');
    chips.innerHTML = '';
    selectedAnnouncementUsers.forEach(function (user) {
        var chip = document.createElement('span');
        chip.className = 'chip';
        chip.innerHTML = escapeHtml(announcementUserLabel(user)) + '<button type="button" aria-label="Remove">×</button>';
        chip.querySelector('button').addEventListener('click', function () {
            selectedAnnouncementUsers = selectedAnnouncementUsers.filter(function (item) {
                return item.id !== user.id;
            });
            renderSelectedAnnouncementUsers();
            renderAnnouncementUserList();
        });
        chips.appendChild(chip);
    });
    empty.style.display = selectedAnnouncementUsers.length ? 'none' : 'block';
}

function renderAnnouncementUserList() {
    var list = document.getElementById('user-list');
    var count = document.getElementById('match-count');
    var matches = matchingAnnouncementUsers();
    var visibleMatches = matches.slice(0, 80);
    var selectedIds = {};
    selectedAnnouncementUsers.forEach(function (user) { selectedIds[user.id] = true; });
    count.textContent = matches.length + ' matching · ' + selectedAnnouncementUsers.length + ' selected';
    list.innerHTML = '';
    if (!visibleMatches.length) {
        list.innerHTML = '<div class="user-row help-text">No matching users</div>';
        return;
    }
    visibleMatches.forEach(function (user) {
        var row = document.createElement('label');
        row.className = 'user-row';
        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !!selectedIds[user.id];
        checkbox.addEventListener('change', function () {
            if (checkbox.checked && !selectedIds[user.id]) {
                selectedAnnouncementUsers.push(user);
            } else if (!checkbox.checked) {
                selectedAnnouncementUsers = selectedAnnouncementUsers.filter(function (item) {
                    return item.id !== user.id;
                });
            }
            renderSelectedAnnouncementUsers();
            renderAnnouncementUserList();
        });
        var text = document.createElement('span');
        text.textContent = announcementUserLabel(user) + (user.city ? ' · ' + user.city : '');
        row.appendChild(checkbox);
        row.appendChild(text);
        list.appendChild(row);
    });
}

async function ensureAnnouncementUserDirectory() {
    if (announcementUserDirectory.length) return;
    var loading = document.getElementById('audience-loading');
    loading.style.display = 'block';
    try {
        var data = await request('GET', '/admin/users');
        announcementUserDirectory = data.users || [];
        fillAnnouncementFilterOptions();
    } finally {
        loading.style.display = 'none';
    }
}

async function setAnnouncementAudienceMode(mode) {
    var selectedMode = mode === 'selected' ? 'selected' : 'all';
    var radio = document.querySelector('input[name="announcementAudience"][value="' + selectedMode + '"]');
    if (radio) radio.checked = true;
    document.getElementById('audience-picker').style.display = selectedMode === 'selected' ? 'block' : 'none';
    if (selectedMode === 'selected') {
        await ensureAnnouncementUserDirectory();
        renderSelectedAnnouncementUsers();
        renderAnnouncementUserList();
    }
}

function setupAnnouncementAudience() {
    document.querySelectorAll('input[name="announcementAudience"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
            setAnnouncementAudienceMode(radio.value).catch(function (error) {
                var errorEl = document.getElementById('form-error');
                errorEl.textContent = error.message || 'Failed to load users';
                errorEl.style.display = 'block';
            });
        });
    });
    ['user-search', 'filter-city', 'filter-sport', 'filter-account', 'filter-gender'].forEach(function (id) {
        var element = document.getElementById(id);
        element.addEventListener(id === 'user-search' ? 'input' : 'change', renderAnnouncementUserList);
    });
    document.getElementById('select-matching').addEventListener('click', function () {
        var selectedById = {};
        selectedAnnouncementUsers.forEach(function (user) { selectedById[user.id] = user; });
        matchingAnnouncementUsers().forEach(function (user) { selectedById[user.id] = user; });
        selectedAnnouncementUsers = Object.keys(selectedById).map(function (id) { return selectedById[id]; });
        renderSelectedAnnouncementUsers();
        renderAnnouncementUserList();
    });
    document.getElementById('clear-selected').addEventListener('click', function () {
        selectedAnnouncementUsers = [];
        renderSelectedAnnouncementUsers();
        renderAnnouncementUserList();
    });
}

// Upload announcement image (FormData); returns { objectPath, url }
async function uploadAnnouncementImage(file) {
    var url = getApiBaseUrl() + '/admin/announcements/upload-image';
    var form = new FormData();
    form.append('image', file);
    var res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getAuthToken() },
        body: form,
    });
    var text = await res.text();
    var data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(getErrorMessage(data, 'Upload failed'));
    if (!data || typeof data.objectPath !== 'string') throw new Error('Invalid response: missing objectPath');
    return data;
}

// Upload announcement icon (SVG or PNG); returns { objectPath, url }
async function uploadAnnouncementIcon(file) {
    var url = getApiBaseUrl() + '/admin/announcements/upload-icon';
    var form = new FormData();
    form.append('icon', file);
    var res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getAuthToken() },
        body: form,
    });
    var text = await res.text();
    var data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(getErrorMessage(data, 'Upload failed'));
    if (!data || typeof data.objectPath !== 'string') throw new Error('Invalid response: missing objectPath');
    return data;
}

async function loadAnnouncements() {
    var loading = document.getElementById('loading-message');
    var listWrap = document.getElementById('list-wrap');
    var listBody = document.getElementById('list-body');
    var errEl = document.getElementById('error-message');
    try {
        var data = await request('GET', '/admin/announcements');
        loading.style.display = 'none';
        errEl.style.display = 'none';
        listWrap.style.display = 'block';
        listBody.innerHTML = '';
        (data.announcements || []).forEach(function (a) {
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td>' + escapeHtml(a.title || '') + '</td>' +
                '<td>' + (a.displayOrder != null ? a.displayOrder : 0) + '</td>' +
                '<td><span class="badge audience-badge">' + (a.targetAllUsers === false ? ((a.recipientCount || 0) + ' users') : 'All users') + '</span></td>' +
                '<td>' + (a.buttonClickCount || 0) + '</td>' +
                '<td>' + (a.uniqueClickerCount || 0) + '</td>' +
                '<td><span class="badge ' + (a.isActive ? 'badge-active' : 'badge-inactive') + '">' + (a.isActive ? 'Active' : 'Inactive') + '</span></td>' +
                '<td>' + (a.updatedAt ? new Date(a.updatedAt).toLocaleDateString() : '') + '</td>' +
                '<td class="actions-cell">' +
                '<button class="btn btn-secondary btn-sm" onclick="editAnnouncement(\'' + a.id + '\')">Edit</button> ' +
                '<button class="btn btn-danger btn-sm" onclick="deleteAnnouncement(\'' + a.id + '\')">Delete</button>' +
                '</td>';
            listBody.appendChild(tr);
        });
    } catch (e) {
        loading.style.display = 'none';
        listWrap.style.display = 'none';
        errEl.textContent = e.message || 'Failed to load announcements';
        errEl.style.display = 'block';
    }
}

function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

function resetForm() {
    document.getElementById('form-title').textContent = 'Add announcement';
    document.getElementById('announcement-form').reset();
    document.getElementById('announcement-id').value = '';
    document.getElementById('displayOrder').value = '0';
    document.getElementById('isActive').checked = true;
    document.getElementById('form-success').style.display = 'none';
    document.getElementById('form-error').style.display = 'none';
    document.getElementById('imageUrl').value = '';
    document.getElementById('announcement-image-status').textContent = '';
    var previewWrap = document.getElementById('announcement-image-preview');
    var previewImg = document.getElementById('announcement-image-preview-img');
    previewWrap.style.display = 'none';
    previewImg.src = '';
    document.getElementById('announcement-image-file').value = '';
    document.getElementById('linkIcon').value = '';
    document.getElementById('announcement-icon-status').textContent = '';
    var iconPreviewWrap = document.getElementById('announcement-icon-preview');
    var iconPreviewImg = document.getElementById('announcement-icon-preview-img');
    if (iconPreviewWrap) iconPreviewWrap.style.display = 'none';
    if (iconPreviewImg) iconPreviewImg.src = '';
    var iconFileInput = document.getElementById('announcement-icon-file');
    if (iconFileInput) iconFileInput.value = '';
    selectedAnnouncementUsers = [];
    ['user-search', 'filter-city', 'filter-sport', 'filter-account', 'filter-gender'].forEach(function (id) {
        var element = document.getElementById(id);
        if (element) element.value = '';
    });
    setAnnouncementAudienceMode('all');
    renderSelectedAnnouncementUsers();
}

function setAnnouncementIconPreview(objectPath, iconUrlForPreview) {
    document.getElementById('linkIcon').value = objectPath || '';
    var status = document.getElementById('announcement-icon-status');
    var previewWrap = document.getElementById('announcement-icon-preview');
    var previewImg = document.getElementById('announcement-icon-preview-img');
    if (objectPath && iconUrlForPreview) {
        status.textContent = 'Icon uploaded.';
        previewImg.src = iconUrlForPreview;
        previewWrap.style.display = 'block';
    } else {
        status.textContent = '';
        previewWrap.style.display = 'none';
        previewImg.src = '';
    }
}

function setAnnouncementImagePreview(objectPath, imageUrlForPreview) {
    document.getElementById('imageUrl').value = objectPath || '';
    var status = document.getElementById('announcement-image-status');
    var previewWrap = document.getElementById('announcement-image-preview');
    var previewImg = document.getElementById('announcement-image-preview-img');
    if (objectPath && imageUrlForPreview) {
        status.textContent = 'Image uploaded.';
        previewImg.src = imageUrlForPreview;
        previewWrap.style.display = 'block';
    } else {
        status.textContent = '';
        previewWrap.style.display = 'none';
        previewImg.src = '';
    }
}

async function editAnnouncement(id) {
    try {
        var a = await request('GET', '/admin/announcements/' + id);
        document.getElementById('form-title').textContent = 'Edit announcement';
        document.getElementById('announcement-id').value = a.id;
        document.getElementById('title').value = a.title || '';
        document.getElementById('imageUrl').value = a.imageUrl || '';
        document.getElementById('linkIcon').value = a.linkIcon || '';
        document.getElementById('content').value = a.content || '';
        document.getElementById('link').value = a.link || '';
        document.getElementById('linkLabel').value = a.linkLabel || '';
        document.getElementById('linkIcon').value = a.linkIcon || '';
        var iconPreviewWrap = document.getElementById('announcement-icon-preview');
        var iconPreviewImg = document.getElementById('announcement-icon-preview-img');
        if (a.linkIcon && a.linkIcon.indexOf('images/') === 0) {
            document.getElementById('announcement-icon-status').textContent = 'Icon set (saved).';
            try {
                var signedRes = await fetch(getApiBaseUrl() + '/images/user-signed?objectPath=' + encodeURIComponent(a.linkIcon), {
                    headers: { 'Authorization': 'Bearer ' + getAuthToken() },
                });
                var signedData = signedRes.ok ? await signedRes.json() : null;
                if (signedData && signedData.url) {
                    iconPreviewImg.src = signedData.url;
                    iconPreviewWrap.style.display = 'block';
                }
            } catch (err) {
                iconPreviewWrap.style.display = 'none';
            }
        } else {
            document.getElementById('announcement-icon-status').textContent = '';
            iconPreviewWrap.style.display = 'none';
            iconPreviewImg.src = '';
        }
        document.getElementById('announcement-icon-file').value = '';
        var linkAction = (a.linkAction === 'share') ? 'share' : 'open';
        var radio = document.querySelector('input[name="linkAction"][value="' + linkAction + '"]');
        if (radio) radio.checked = true;
        document.getElementById('displayOrder').value = a.displayOrder != null ? a.displayOrder : 0;
        document.getElementById('isActive').checked = a.isActive !== false;
        if (a.targetAllUsers === false) {
            await ensureAnnouncementUserDirectory();
            var recipientIds = Array.isArray(a.recipientUserIds) ? a.recipientUserIds : [];
            var usersById = {};
            eligibleAnnouncementUsers().forEach(function (user) { usersById[user.id] = user; });
            selectedAnnouncementUsers = recipientIds.map(function (userId) {
                return usersById[userId] || { id: userId, name: 'User ' + userId };
            });
            await setAnnouncementAudienceMode('selected');
        } else {
            selectedAnnouncementUsers = [];
            await setAnnouncementAudienceMode('all');
        }
        document.getElementById('form-success').style.display = 'none';
        document.getElementById('form-error').style.display = 'none';
        var previewWrap = document.getElementById('announcement-image-preview');
        var previewImg = document.getElementById('announcement-image-preview-img');
        if (a.imageUrl && a.imageUrl.indexOf('images/') === 0) {
            document.getElementById('announcement-image-status').textContent = 'Image set (saved).';
            try {
                var signedRes = await fetch(getApiBaseUrl() + '/images/user-signed?objectPath=' + encodeURIComponent(a.imageUrl), {
                    headers: { 'Authorization': 'Bearer ' + getAuthToken() },
                });
                var signedData = signedRes.ok ? await signedRes.json() : null;
                if (signedData && signedData.url) {
                    previewImg.src = signedData.url;
                    previewWrap.style.display = 'block';
                }
            } catch (err) {
                previewWrap.style.display = 'none';
            }
        } else {
            document.getElementById('announcement-image-status').textContent = '';
            previewWrap.style.display = 'none';
            previewImg.src = '';
        }
        document.getElementById('announcement-image-file').value = '';
    } catch (e) {
        alert(e.message || 'Failed to load announcement');
    }
}

async function saveAnnouncement(e) {
    e.preventDefault();
    var id = document.getElementById('announcement-id').value;
    var linkActionRadio = document.querySelector('input[name="linkAction"]:checked');
    var audienceRadio = document.querySelector('input[name="announcementAudience"]:checked');
    var targetAllUsers = !audienceRadio || audienceRadio.value === 'all';
    if (!targetAllUsers && !selectedAnnouncementUsers.length) {
        var audienceError = document.getElementById('form-error');
        audienceError.textContent = 'Choose at least one user or select All users.';
        audienceError.style.display = 'block';
        return false;
    }
    var payload = {
        title: document.getElementById('title').value.trim(),
        imageUrl: document.getElementById('imageUrl').value.trim() || null,
        linkIcon: document.getElementById('linkIcon').value.trim() || null,
        content: document.getElementById('content').value.trim(),
        link: document.getElementById('link').value.trim() || null,
        linkLabel: document.getElementById('linkLabel').value.trim() || null,
        linkAction: (linkActionRadio && linkActionRadio.value === 'share') ? 'share' : 'open',
        displayOrder: parseInt(document.getElementById('displayOrder').value, 10) || 0,
        isActive: document.getElementById('isActive').checked,
        targetAllUsers: targetAllUsers,
        recipientUserIds: targetAllUsers ? [] : selectedAnnouncementUsers.map(function (user) { return user.id; }),
    };
    var successEl = document.getElementById('form-success');
    var errorEl = document.getElementById('form-error');
    successEl.style.display = 'none';
    errorEl.style.display = 'none';
    try {
        if (id) {
            await request('PUT', '/admin/announcements/' + id, payload);
            successEl.textContent = 'Announcement updated. App will show this card once per user until they dismiss it or you change the announcement.';
        } else {
            await request('POST', '/admin/announcements', payload);
            successEl.textContent = 'Announcement created. It will show in the app for users who have not seen this id yet.';
        }
        successEl.style.display = 'block';
        resetForm();
        loadAnnouncements();
    } catch (err) {
        errorEl.textContent = err.message || 'Save failed';
        errorEl.style.display = 'block';
    }
    return false;
}

async function deleteAnnouncement(id) {
    if (!confirm('Delete this announcement? This cannot be undone.')) return;
    try {
        await request('DELETE', '/admin/announcements/' + id);
        loadAnnouncements();
        resetForm();
    } catch (e) {
        alert(e.message || 'Delete failed');
    }
}

// Setup: upload image button, file input, clear image
function setupAnnouncementImageUpload() {
    var fileInput = document.getElementById('announcement-image-file');
    var uploadBtn = document.getElementById('announcement-upload-btn');
    var statusEl = document.getElementById('announcement-image-status');
    var clearBtn = document.getElementById('announcement-image-clear');
    if (!fileInput || !uploadBtn) return;
    uploadBtn.addEventListener('click', function () {
        fileInput.click();
    });
    fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        var allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.type)) {
            statusEl.textContent = 'Invalid file type. Use JPEG, PNG or WebP.';
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            statusEl.textContent = 'File too large (max 10MB).';
            return;
        }
        statusEl.textContent = 'Uploading...';
        uploadBtn.disabled = true;
        uploadAnnouncementImage(file).then(function (data) {
            setAnnouncementImagePreview(data.objectPath, data.url || null);
            statusEl.textContent = 'Image uploaded. Save the announcement to use it.';
        }).catch(function (err) {
            statusEl.textContent = (err && typeof err.message === 'string' ? err.message : 'Upload failed');
        }).finally(function () {
            uploadBtn.disabled = false;
            fileInput.value = '';
        });
    });
    if (clearBtn) {
        clearBtn.addEventListener('click', function () {
            document.getElementById('imageUrl').value = '';
            setAnnouncementImagePreview(null, null);
            document.getElementById('announcement-image-file').value = '';
        });
    }
}

function setupAnnouncementIconUpload() {
    var fileInput = document.getElementById('announcement-icon-file');
    var uploadBtn = document.getElementById('announcement-icon-upload-btn');
    var statusEl = document.getElementById('announcement-icon-status');
    var clearBtn = document.getElementById('announcement-icon-clear');
    if (!fileInput || !uploadBtn) return;
    uploadBtn.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        var allowed = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg'];
        if (!allowed.includes(file.type)) {
            statusEl.textContent = 'Invalid file type. Use SVG or PNG.';
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            statusEl.textContent = 'File too large (max 2MB).';
            return;
        }
        statusEl.textContent = 'Uploading...';
        uploadBtn.disabled = true;
        uploadAnnouncementIcon(file).then(function (data) {
            setAnnouncementIconPreview(data.objectPath, data.url || null);
            statusEl.textContent = 'Icon uploaded.';
        }).catch(function (err) {
            statusEl.textContent = (err && typeof err.message === 'string' ? err.message : 'Upload failed');
        }).finally(function () {
            uploadBtn.disabled = false;
            fileInput.value = '';
        });
    });
    if (clearBtn) {
        clearBtn.addEventListener('click', function () {
            document.getElementById('linkIcon').value = '';
            setAnnouncementIconPreview(null, null);
            document.getElementById('announcement-icon-file').value = '';
        });
    }
}
