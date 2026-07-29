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
    const location = link.dataset.ctaLocation || link.closest("section")?.id || "footer";
    const isSalesContact = location === "footer_whatsapp" || link.href.startsWith("https://wa.me/");

    link.setAttribute("href", isSalesContact ? SALES_WHATSAPP_URL : "#demonstracao");
    if (isSalesContact) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
      link.setAttribute("aria-label", "Falar com vendas pelo WhatsApp");
    }

    link.addEventListener("click", () => {
      trackConversion("commercial_cta_click", { label, location });
    });
  });

  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    link.addEventListener("click", () => {
      trackConversion("navigation_click", {
        label: link.textContent.trim(),
        target: link.getAttribute("href"),
        menu: window.innerWidth <= 960 ? "mobile" : "desktop",
      });
    });
  });

  document.querySelector("[data-hero-secondary]")?.addEventListener("click", () => {
    trackConversion("hero_secondary_click", { target: "#recursos" });
  });

  document.querySelectorAll("[data-resource-link]").forEach((link) => {
    link.addEventListener("click", () => {
      trackConversion("resource_interest", {
        resource: link.dataset.resource,
        target: link.getAttribute("href"),
      });
    });
  });

  const demoForm = document.querySelector("[data-demo-form]");
  const demoStatus = document.querySelector("[data-demo-status]");
  const demoSubmit = document.querySelector("[data-demo-submit]");
  const phoneInput = demoForm?.querySelector('input[name="phone"]');
  const formFields = [...(demoForm?.querySelectorAll("input:not([name=companyWebsite]), select") || [])];
  let isSubmitting = false;
  let formStarted = false;

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
    return valid;
  };

  const getFieldMessage = (field) => {
    if (field.validity.valid) return "";
    if (field.name === "phone") return "Informe um WhatsApp válido com DDD.";
    if (field.name === "privacyConsent") return "Autorize o contato para continuar.";
    if (field.validity.valueMissing) return "Preencha este campo.";
    if (field.validity.typeMismatch && field.type === "email") return "Informe um e-mail válido.";
    if (field.validity.tooShort) return `Use pelo menos ${field.minLength} caracteres.`;
    return "Revise este campo.";
  };

  const updateFieldState = (field, showError = true) => {
    if (field.name === "phone") validatePhone();
    const message = showError ? getFieldMessage(field) : "";
    field.toggleAttribute("aria-invalid", Boolean(message));
    const error = field.getAttribute("aria-describedby")
      ?.split(" ")
      .map((id) => document.getElementById(id))
      .find((element) => element?.classList.contains("form-field-error"));
    if (error) error.textContent = message;
    return !message;
  };

  phoneInput?.addEventListener("input", () => {
    phoneInput.value = formatPhone(phoneInput.value);
  });

  formFields.forEach((field) => {
    field.addEventListener("input", () => {
      updateFieldState(field, false);
      if (demoStatus?.dataset.status === "error") setFormStatus();
    });
    field.addEventListener("change", () => updateFieldState(field, true));
    field.addEventListener("blur", () => updateFieldState(field, true));
  });

  demoForm?.addEventListener("focusin", (event) => {
    if (formStarted || event.target?.name === "companyWebsite") return;
    formStarted = true;
    trackConversion("demo_form_start");
  });

  demoForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    validatePhone();
    let firstInvalid;
    formFields.forEach((field) => {
      if (!updateFieldState(field, true) && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid || !demoForm.checkValidity()) {
      setFormStatus("Revise os campos destacados antes de enviar.", "error");
      trackConversion("demo_form_validation_error", { field: firstInvalid?.name || "unknown" });
      firstInvalid?.focus();
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
        formFields.forEach((field) => updateFieldState(field, false));
        restoreSubmit();
        window.location.assign("/obrigado");
        return;
      } catch (error) {
        restoreSubmit();
        trackConversion("demo_form_submit_error", {
          transport: "endpoint",
          reason: error?.name === "AbortError" ? "timeout" : "request_failed",
        });
        setFormStatus(
          error?.name === "AbortError"
            ? "O envio demorou mais que o esperado. Seus dados foram mantidos para você tentar novamente."
            : "Não foi possível enviar agora. Seus dados continuam no formulário para você tentar novamente.",
          "error",
        );
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
    trackConversion("mobile_menu_toggle", { state: isOpen ? "closed" : "opened" });
  });

  nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  window.addEventListener("resize", () => {
    if (window.innerWidth > 960) closeMenu();
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
      trackConversion("faq_toggle", {
        question: button.childNodes[0]?.textContent?.trim() || button.textContent.trim(),
        state: expanded ? "closed" : "opened",
      });
    });
  });

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());
})();
