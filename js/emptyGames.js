(function () {
    const FALLBACK_CITIES = [
        { name: "Haifa", latitude: 32.794, longitude: 34.9896 },
        { name: "Tel Aviv", latitude: 32.0853, longitude: 34.7818 },
        { name: "Jerusalem", latitude: 31.7683, longitude: 35.2137 },
        { name: "Nesher", latitude: 32.7667, longitude: 35.05 },
    ];

    function apiBase() {
        return window.NetworkConfig?.API_BASE_URL || "http://localhost:3000/api";
    }

    function token() {
        return localStorage.getItem("adminToken") || "";
    }

    function fillSelect(select, items, getValue, getLabel) {
        if (!select) return;
        select.innerHTML = "";
        items.forEach((item) => {
            const option = document.createElement("option");
            option.value = getValue(item);
            option.textContent = getLabel(item);
            select.appendChild(option);
        });
    }

    function defaultDateValue() {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        date.setHours(18, 0, 0, 0);
        const pad = (n) => String(n).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function showStatus(el, message, kind) {
        if (!el) return;
        el.hidden = !message;
        el.textContent = message || "";
        el.classList.toggle("is-error", kind === "error");
        el.classList.toggle("is-success", kind === "success");
    }

    function errorMessage(data, fallback) {
        if (!data) return fallback;
        if (typeof data.error === "string") return data.error;
        if (data.error && data.error.message) return data.error.message;
        if (typeof data.message === "string") return data.message;
        return fallback;
    }

    function normalizeCity(raw) {
        const name = typeof raw?.name === "string" ? raw.name.trim() : "";
        const latitude = Number(raw?.latitude);
        const longitude = Number(raw?.longitude);
        if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
        return { name, latitude, longitude };
    }

    function englishLocalities(payload) {
        const list = Array.isArray(payload?.localities) ? payload.localities : [];
        const seen = new Set();
        const out = [];
        list.forEach((raw) => {
            const city = normalizeCity(raw);
            if (!city) return;
            const key = city.name.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            out.push(city);
        });
        out.sort((a, b) => a.name.localeCompare(b.name, "en"));
        return out;
    }

    async function loadCities() {
        try {
            const res = await fetch(`${apiBase()}/localities`);
            const data = res.ok ? await res.json() : null;
            const cities = englishLocalities(data);
            return cities.length ? cities : FALLBACK_CITIES;
        } catch {
            return FALLBACK_CITIES;
        }
    }

    function filterCities(cities, query) {
        const q = String(query || "").trim().toLowerCase();
        if (!q) return cities.slice(0, 40);
        return cities.filter((city) => city.name.toLowerCase().includes(q)).slice(0, 40);
    }

    function bindCitySearch(cities) {
        const searchInput = document.getElementById("empty-game-city-search");
        const hiddenInput = document.getElementById("empty-game-city");
        const listEl = document.getElementById("empty-game-city-list");
        if (!searchInput || !hiddenInput || !listEl) return () => null;

        let activeIndex = -1;
        let visible = [];

        function selectedCity() {
            const name = hiddenInput.value.trim();
            return cities.find((city) => city.name === name) || null;
        }

        function closeList() {
            listEl.hidden = true;
            activeIndex = -1;
        }

        function renderList(query) {
            visible = filterCities(cities, query);
            listEl.innerHTML = "";
            if (visible.length === 0) {
                const empty = document.createElement("li");
                empty.className = "is-empty";
                empty.textContent = "No matching city";
                listEl.appendChild(empty);
            } else {
                visible.forEach((city, index) => {
                    const item = document.createElement("li");
                    item.textContent = city.name;
                    item.dataset.index = String(index);
                    if (index === activeIndex) item.classList.add("is-active");
                    item.addEventListener("mousedown", (event) => {
                        event.preventDefault();
                        chooseCity(city);
                    });
                    listEl.appendChild(item);
                });
            }
            listEl.hidden = false;
        }

        function chooseCity(city) {
            searchInput.value = city.name;
            hiddenInput.value = city.name;
            closeList();
        }

        searchInput.addEventListener("focus", () => {
            renderList(searchInput.value);
        });
        searchInput.addEventListener("input", () => {
            hiddenInput.value = "";
            activeIndex = -1;
            renderList(searchInput.value);
        });
        searchInput.addEventListener("keydown", (event) => {
            if (listEl.hidden && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                renderList(searchInput.value);
            }
            if (event.key === "ArrowDown") {
                event.preventDefault();
                if (!visible.length) return;
                activeIndex = (activeIndex + 1) % visible.length;
                renderList(searchInput.value);
            } else if (event.key === "ArrowUp") {
                event.preventDefault();
                if (!visible.length) return;
                activeIndex = activeIndex <= 0 ? visible.length - 1 : activeIndex - 1;
                renderList(searchInput.value);
            } else if (event.key === "Enter" && !listEl.hidden && activeIndex >= 0 && visible[activeIndex]) {
                event.preventDefault();
                chooseCity(visible[activeIndex]);
            } else if (event.key === "Escape") {
                closeList();
            }
        });
        searchInput.addEventListener("blur", () => {
            setTimeout(closeList, 120);
        });

        return selectedCity;
    }

    function fillSports(sportSelect) {
        const labels = window.AdminSportLabels;
        const slugs = labels?.SPORT_DISPLAY_ORDER || [
            "soccer",
            "basketball",
            "tennis",
            "padel",
            "volleyball",
            "running",
            "other",
        ];
        fillSelect(
            sportSelect,
            slugs,
            (slug) => slug,
            (slug) => labels?.sportSlugToDisplayLabel?.(slug) || slug,
        );
        if ([...sportSelect.options].some((o) => o.value === "tennis")) {
            sportSelect.value = "tennis";
        }
    }

    async function createEmptyGame(payload) {
        const res = await fetch(`${apiBase()}/admin/empty-games`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token()}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }
        if (!res.ok) {
            throw new Error(errorMessage(data, `Create failed (${res.status})`));
        }
        return data;
    }

    async function init() {
        const form = document.getElementById("empty-game-form");
        if (!form) return;

        const titleInput = document.getElementById("empty-game-title");
        const sportSelect = document.getElementById("empty-game-sport");
        const genderSelect = document.getElementById("empty-game-gender");
        const dateInput = document.getElementById("empty-game-date");
        const durationInput = document.getElementById("empty-game-duration");
        const statusEl = document.getElementById("empty-game-status");
        const submitBtn = document.getElementById("empty-game-submit");

        fillSports(sportSelect);
        const cities = await loadCities();
        const selectedCity = bindCitySearch(cities);
        if (dateInput && !dateInput.value) dateInput.value = defaultDateValue();

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            showStatus(statusEl, "", "");
            const title = titleInput.value.trim();
            const sportType = sportSelect.value;
            const city = selectedCity();
            const gender = genderSelect.value;
            const dateTime = dateInput.value
                ? new Date(dateInput.value).toISOString()
                : "";
            const duration = Number(durationInput.value);

            if (!title || !sportType || !city || !dateTime || !duration) {
                showStatus(statusEl, "Fill in every field, and pick a city from the list.", "error");
                return;
            }

            submitBtn.disabled = true;
            try {
                const result = await createEmptyGame({
                    title,
                    sportType,
                    city: city.name,
                    venueName: `${city.name}, Israel`,
                    venueAddress: `${city.name}, Israel`,
                    venueLat: city.latitude,
                    venueLng: city.longitude,
                    genderRestriction: gender,
                    dateTime,
                    duration,
                });
                const game = result?.game || {};
                showStatus(
                    statusEl,
                    `Created “${game.title || title}” with 0 participants.`,
                    "success",
                );
                titleInput.value = "";
                dateInput.value = defaultDateValue();
            } catch (err) {
                showStatus(statusEl, err.message || "Failed to create activity.", "error");
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
