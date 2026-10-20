(function () {
    const FALLBACK_CITIES = [
        { id: "haifa", name: "Haifa, Israel" },
        { id: "tel-aviv", name: "Tel-Aviv, Israel" },
        { id: "jerusalem", name: "Jerusalem, Israel" },
        { id: "nesher", name: "Nesher, Israel" },
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

    async function loadCities(citySelect) {
        try {
            const res = await fetch(`${apiBase()}/admin/empty-games/cities`, {
                headers: { Authorization: `Bearer ${token()}` },
            });
            const data = res.ok ? await res.json() : null;
            const cities = Array.isArray(data?.cities) && data.cities.length
                ? data.cities
                : FALLBACK_CITIES;
            fillSelect(citySelect, cities, (c) => c.id, (c) => c.name);
        } catch {
            fillSelect(citySelect, FALLBACK_CITIES, (c) => c.id, (c) => c.name);
        }
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

    function init() {
        const form = document.getElementById("empty-game-form");
        if (!form) return;

        const titleInput = document.getElementById("empty-game-title");
        const sportSelect = document.getElementById("empty-game-sport");
        const citySelect = document.getElementById("empty-game-city");
        const genderSelect = document.getElementById("empty-game-gender");
        const dateInput = document.getElementById("empty-game-date");
        const durationInput = document.getElementById("empty-game-duration");
        const statusEl = document.getElementById("empty-game-status");
        const submitBtn = document.getElementById("empty-game-submit");

        fillSports(sportSelect);
        loadCities(citySelect);
        if (dateInput && !dateInput.value) dateInput.value = defaultDateValue();

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            showStatus(statusEl, "", "");
            const title = titleInput.value.trim();
            const sportType = sportSelect.value;
            const city = citySelect.value;
            const gender = genderSelect.value;
            const dateTime = dateInput.value
                ? new Date(dateInput.value).toISOString()
                : "";
            const duration = Number(durationInput.value);

            if (!title || !sportType || !city || !dateTime || !duration) {
                showStatus(statusEl, "Fill in every field.", "error");
                return;
            }

            submitBtn.disabled = true;
            try {
                const result = await createEmptyGame({
                    title,
                    sportType,
                    city,
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
