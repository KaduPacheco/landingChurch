(() => {
  const COMMERCIAL_FORM_ENDPOINT = window.location.protocol.startsWith("http")
    ? new URL("/api/leads", window.location.origin).toString()
    : "";
  const COMMERCIAL_FORM_SOURCE = "landing_simplechurch";
  const SALES_WHATSAPP_URL =
    "https://wa.me/5521974340508?text=Ol%C3%A1%2C%20estou%20entrando%20em%20contato%20via%20landing%20page.";
  const header = document.querySelector("[data-header]");
  const menuButton = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector("[data-nav]");

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

  document.querySelectorAll("[data-commercial-cta]").forEach((link) => {
    const label = link.textContent.trim().replace(/\s+/g, " ");
    const isSalesContact = label === "Falar com vendas";

    link.setAttribute("href", isSalesContact ? SALES_WHATSAPP_URL : "#demonstracao");
    if (isSalesContact) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
      link.setAttribute("aria-label", "Falar com vendas pelo WhatsApp");
    }

    link.addEventListener("click", () => {
      trackConversion("commercial_cta_click", {
        label,
        section: link.closest("section")?.id || "header_footer",
      });
    });
  });

  const demoForm = document.querySelector("[data-demo-form]");
  const demoStatus = document.querySelector("[data-demo-status]");
  const demoSubmit = document.querySelector("[data-demo-submit]");
  const phoneInput = demoForm?.querySelector('input[name="phone"]');
  let isSubmitting = false;

  const setFormStatus = (message = "", type = "") => {
    if (!demoStatus) return;
    demoStatus.textContent = message;
    demoStatus.dataset.status = type;
  };

  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const validatePhone = () => {
    if (!phoneInput) return true;
    const digits = phoneInput.value.replace(/\D/g, "");
    const valid = digits.length >= 10 && digits.length <= 11;
    phoneInput.setCustomValidity(valid ? "" : "Informe um WhatsApp com DDD.");
    phoneInput.toggleAttribute("aria-invalid", !valid && phoneInput.value.length > 0);
    return valid;
  };

  phoneInput?.addEventListener("input", () => {
    phoneInput.value = formatPhone(phoneInput.value);
    validatePhone();
  });

  demoForm?.querySelectorAll("input, select").forEach((field) => {
    field.addEventListener("input", () => {
      field.toggleAttribute("aria-invalid", !field.validity.valid && field.value.length > 0);
      if (demoStatus?.dataset.status === "error") setFormStatus();
    });
    field.addEventListener("blur", () => field.toggleAttribute("aria-invalid", !field.validity.valid));
  });

  demoForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    validatePhone();
    if (!demoForm.reportValidity()) {
      setFormStatus("Revise os campos destacados antes de enviar.", "error");
      trackConversion("demo_form_validation_error");
      return;
    }

    trackConversion("demo_form_submit_attempt", { hasEndpoint: Boolean(COMMERCIAL_FORM_ENDPOINT) });
    setFormStatus("Enviando sua solicitação...", "loading");

    isSubmitting = true;
    const originalSubmitLabel = demoSubmit?.innerHTML;
    if (demoSubmit) {
      demoSubmit.disabled = true;
      demoSubmit.setAttribute("aria-busy", "true");
      demoSubmit.textContent = "Enviando...";
    }

    const restoreSubmit = () => {
      isSubmitting = false;
      if (!demoSubmit) return;
      demoSubmit.disabled = false;
      demoSubmit.removeAttribute("aria-busy");
      if (originalSubmitLabel) demoSubmit.innerHTML = originalSubmitLabel;
    };

    const formData = new FormData(demoForm);
    const lead = Object.fromEntries(formData.entries());
    const leadPayload = {
      ...lead,
      name: lead.name?.trim(),
      church: lead.church?.trim(),
      phone: lead.phone?.trim(),
      email: lead.email?.trim(),
      source: COMMERCIAL_FORM_SOURCE,
      page: window.location.pathname,
      submittedAt: new Date().toISOString(),
      tracking: getTrackingParams(),
    };

    if (COMMERCIAL_FORM_ENDPOINT) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch(COMMERCIAL_FORM_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(leadPayload),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Endpoint retornou ${response.status}`);
        trackConversion("demo_form_submit_success", { transport: "endpoint" });
        setFormStatus("Solicitação recebida. Redirecionando...", "success");
        demoForm.reset();
        restoreSubmit();
        window.location.assign("/obrigado");
        return;
      } catch {
        restoreSubmit();
        trackConversion("demo_form_submit_error", { transport: "endpoint" });
        setFormStatus("Não foi possível enviar agora. Seus dados continuam no formulário para você tentar novamente.", "error");
        return;
      } finally {
        window.clearTimeout(timeout);
      }
    }

    setFormStatus("Abra esta página pelo servidor do site para solicitar uma demonstração.", "error");
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
