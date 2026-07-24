(() => {
  const COMMERCIAL_FORM_ENDPOINT = window.location.protocol.startsWith("http")
    ? new URL("/api/leads", window.location.origin).toString()
    : "";
  const COMMERCIAL_FORM_SOURCE = "landing_simplechurch";
  const header = document.querySelector("[data-header]");
  const menuButton = document.querySelector("[data-menu-toggle]");

  const trackConversion = (eventName, details = {}) => {
    const payload = { event: eventName, ...details };
    window.dataLayer?.push(payload);
    window.dispatchEvent(new CustomEvent("simplechurch:conversion", { detail: payload }));
  };

  const getTrackingParams = () => {
    const params = new URLSearchParams(window.location.search);
    const trackingKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];
    return trackingKeys.reduce((tracking, key) => {
      const value = params.get(key);
      if (value) tracking[key] = value;
      return tracking;
    }, {});
  };
  const nav = document.querySelector("[data-nav]");

  document.querySelectorAll("[data-commercial-cta]").forEach((link) => {
    link.setAttribute("href", "#demonstracao");
    link.addEventListener("click", () => {
      trackConversion("commercial_cta_click", {
        label: link.textContent.trim().replace(/\s+/g, " "),
        section: link.closest("section")?.id || "header_footer",
      });
    });
  });

  const demoForm = document.querySelector("[data-demo-form]");
  const demoStatus = document.querySelector("[data-demo-status]");
  const demoSubmit = document.querySelector("[data-demo-submit]");

  demoForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!demoForm.reportValidity()) return;

    trackConversion("demo_form_submit_attempt", { hasEndpoint: Boolean(COMMERCIAL_FORM_ENDPOINT) });

    const originalSubmitLabel = demoSubmit?.innerHTML;
    if (demoSubmit) {
      demoSubmit.disabled = true;
      demoSubmit.textContent = "Enviando...";
    }

    const restoreSubmit = () => {
      if (!demoSubmit) return;
      demoSubmit.disabled = false;
      if (originalSubmitLabel) demoSubmit.innerHTML = originalSubmitLabel;
    };

    const formData = new FormData(demoForm);
    const lead = Object.fromEntries(formData.entries());
    const leadPayload = {
      ...lead,
      source: COMMERCIAL_FORM_SOURCE,
      page: window.location.pathname,
      submittedAt: new Date().toISOString(),
      tracking: getTrackingParams(),
    };
    if (COMMERCIAL_FORM_ENDPOINT) {
      try {
        const response = await fetch(COMMERCIAL_FORM_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(leadPayload),
        });
        if (!response.ok) throw new Error(`Endpoint retornou ${response.status}`);
        demoForm.reset();
        restoreSubmit();
        trackConversion("demo_form_submit_success", { transport: "endpoint" });
        window.location.assign("/obrigado");
        return;
      } catch {
        restoreSubmit();
        trackConversion("demo_form_submit_error", { transport: "endpoint" });
        if (demoStatus) demoStatus.textContent = "Não foi possível enviar agora. Tente novamente em alguns instantes.";
        return;
      }
    }

    if (demoStatus) demoStatus.textContent = "Abra esta página pelo servidor do site para solicitar uma demonstração.";
    trackConversion("demo_form_submit_error", { transport: "missing_endpoint" });
    restoreSubmit();
  });
  const closeMenu = () => {
    if (!menuButton || !nav) return;
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Abrir menu");
    nav.classList.remove("open");
    document.body.classList.remove("menu-open");
  };

  menuButton?.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Abrir menu" : "Fechar menu");
    nav?.classList.toggle("open", !isOpen);
    document.body.classList.toggle("menu-open", !isOpen);
  });

  nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  window.addEventListener("resize", () => {
    if (window.innerWidth > 820) closeMenu();
  });

  const updateHeader = () => header?.classList.toggle("scrolled", window.scrollY > 12);
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  document.querySelectorAll("[data-accordion] button").forEach((button) => {
    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      const panel = document.getElementById(button.getAttribute("aria-controls"));
      button.setAttribute("aria-expanded", String(!expanded));
      if (panel) panel.hidden = expanded;
    });
  });

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());
})();

