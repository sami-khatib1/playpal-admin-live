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
