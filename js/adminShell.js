/**
 * Mobile-native shell: brand mark, back nav, safe areas.
 */
(function () {
    function enhanceHeader() {
        const header = document.querySelector(".header");
        if (!header || header.dataset.shellReady === "1") return;

        const h1 = header.querySelector("h1");
        if (!h1) return;

        const titleText = h1.textContent.trim();
        const isDashboard = /dashboard/i.test(titleText) || /dashboard/i.test(document.title);

        const brand = document.createElement("div");
        brand.className = "header-brand";

        const mark = document.createElement("div");
        mark.className = "header-mark";
        mark.setAttribute("aria-hidden", "true");

        const titleWrap = document.createElement("div");
        titleWrap.style.minWidth = "0";

        const newH1 = document.createElement("h1");
        newH1.textContent = isDashboard ? "Matchn Admin" : titleText;

        if (isDashboard) {
            const sub = document.createElement("span");
            sub.className = "header-sub";
            sub.textContent = "Operations dashboard";
            titleWrap.appendChild(newH1);
            titleWrap.appendChild(sub);
        } else {
            titleWrap.appendChild(newH1);
        }

        brand.appendChild(mark);
        brand.appendChild(titleWrap);

        const actions = header.querySelector(".header-actions");
        h1.remove();

        if (!isDashboard && actions) {
            const backBtn = document.createElement("button");
            backBtn.type = "button";
            backBtn.className = "btn btn-ghost btn-back btn-icon";
            backBtn.setAttribute("aria-label", "Back to dashboard");
            backBtn.innerHTML = "←";
            backBtn.addEventListener("click", () => {
                if (typeof window.navigate === "function") window.navigate("/dashboard");
            });
            header.insertBefore(backBtn, header.firstChild);
        }

        header.insertBefore(brand, header.firstChild);
        header.dataset.shellReady = "1";
    }

    function init() {
        document.body.classList.add("app-body");
        enhanceHeader();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
