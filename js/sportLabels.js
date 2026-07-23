/**
 * Canonical sport slugs and labels for the admin dashboard.
 * Keep in sync with backend sportDisplayLabel.js and frontend sportTags.ts.
 */
(function () {
    const SPORT_DISPLAY_ORDER = [
        "soccer",
        "basketball",
        "tennis",
        "padel",
        "volleyball",
        "running",
        "hiking",
        "swimming",
        "pilates",
        "dancing",
        "bingbong",
        "surfing",
        "calisthenics",
        "skateboard",
        "cycling",
        "other",
    ];

    const SPORTS_WITHOUT_RANKINGS = ["other"];
    const SPORTS_EXCLUDED_FROM_FAVORITES = ["other"];

    function sportSlugToDisplayLabel(slug) {
        if (slug == null || slug === "") return "";
        const low = String(slug).trim().toLowerCase();
        if (low === "bingbong") return "Table Tennis";
        const raw = String(slug).trim();
        return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }

    function formatSportSlugList(slugs) {
        if (!Array.isArray(slugs) || slugs.length === 0) return "—";
        return slugs
            .map((s) => sportSlugToDisplayLabel(s))
            .filter(Boolean)
            .join(", ");
    }

    function formatSportListText(raw) {
        if (!raw) return "—";
        const parts = String(raw)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        if (parts.length === 0) return "—";
        return parts.map((s) => sportSlugToDisplayLabel(s)).join(", ");
    }

    function compareSportSlugs(a, b) {
        const ai = SPORT_DISPLAY_ORDER.indexOf(String(a).toLowerCase());
        const bi = SPORT_DISPLAY_ORDER.indexOf(String(b).toLowerCase());
        const aRank = ai === -1 ? 999 : ai;
        const bRank = bi === -1 ? 999 : bi;
        if (aRank !== bRank) return aRank - bRank;
        return sportSlugToDisplayLabel(a).localeCompare(sportSlugToDisplayLabel(b), undefined, {
            sensitivity: "base",
        });
    }

    /** Merge canonical sports with values seen in data (for filter dropdowns). */
    function mergeSportOptions(seenSlugs) {
        const seen = new Set();
        const ordered = [];
        const add = (slug) => {
            const key = String(slug || "").trim().toLowerCase();
            if (!key || seen.has(key)) return;
            seen.add(key);
            ordered.push(key);
        };
        SPORT_DISPLAY_ORDER.filter((s) => !SPORTS_EXCLUDED_FROM_FAVORITES.includes(s)).forEach(add);
        (seenSlugs || []).forEach(add);
        ordered.sort(compareSportSlugs);
        return ordered;
    }

    window.AdminSportLabels = {
        SPORT_DISPLAY_ORDER,
        SPORTS_WITHOUT_RANKINGS,
        SPORTS_EXCLUDED_FROM_FAVORITES,
        sportSlugToDisplayLabel,
        formatSportSlugList,
        formatSportListText,
        compareSportSlugs,
        mergeSportOptions,
    };
})();
