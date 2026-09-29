(() => {
  const config = window.SIMPLECHURCH_ANALYTICS || {};
  const { gtmId, ga4Id, metaPixelId, directEventForwarding = !gtmId } = config;
  const key = "simplechurch_privacy_v1";
  let consent;
  try {
    consent = localStorage.getItem(key);
  } catch {
    /* Storage can be unavailable. */
  }
  let started = false;
  let banner;
  let returnFocus;
  window.dataLayer = window.dataLayer || [];
  window.SimpleChurchPrivacy = { allowed: () => consent === "accepted" };

  const loadScript = (src) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
  };

  function startTracking() {
    if (started || consent !== "accepted") return;
    started = true;
    // GTM owns provider setup unless direct forwarding was explicitly enabled.
    if (gtmId) {
      window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      loadScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`);
    }
    if (ga4Id && (!gtmId || directEventForwarding)) {
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
      window.gtag("js", new Date());
      window.gtag("config", ga4Id, { page_location: location.origin + location.pathname });
      loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`);
    }
    if (metaPixelId && (!gtmId || directEventForwarding)) {
      const fbq = (window.fbq = function () {
        fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
      });
      window._fbq = fbq;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.queue = [];
      fbq("init", metaPixelId);
      fbq("track", "PageView");
      loadScript("https://connect.facebook.net/en_US/fbevents.js");
    }
  }

  function choose(value) {
    consent = value;
    try {
      localStorage.setItem(key, value);
    } catch {
      /* Keep choice for this page. */
    }
    banner?.remove();
    banner = null;
    returnFocus?.focus();
    if (value === "accepted") startTracking();
    else if (started) {
      // Stop already loaded provider code and expire accessible first-party cookies.
      document.cookie.split(";").forEach((cookie) => {
        const name = cookie.split("=")[0].trim();
        if (!/^(_ga|_gid|_gat|_fbp|_fbc)/.test(name)) return;
        document.cookie = `${name}=; Max-Age=0; Path=/`;
        const parts = location.hostname.split(".");
        for (let i = 0; i < parts.length - 1; i++)
          document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${parts.slice(i).join(".")}`;
      });
      location.reload();
    }
  }

  function showPreferences(focus = false) {
    if (banner) {
      if (focus) banner.querySelector("button").focus();
      return;
    }
    returnFocus = focus ? document.activeElement : null;
    banner = document.createElement("section");
    banner.className = "cookie-banner";
    banner.setAttribute("aria-label", "Preferências de privacidade");
    banner.innerHTML =
      '<strong>Sua privacidade, sua escolha.</strong><p>Com sua permissão, usamos ferramentas de análise e marketing para entender as visitas. Você pode continuar apenas com o essencial. <a href="/privacidade">Saiba mais</a>.</p><div class="cookie-actions"><button type="button" class="button button-outline" data-consent="denied">Só essenciais</button><button type="button" class="button button-primary" data-consent="accepted">Aceitar opcionais</button></div>';
    banner
      .querySelectorAll("button")
      .forEach((button) => button.addEventListener("click", () => choose(button.dataset.consent)));
    document.body.appendChild(banner);
    if (focus) banner.querySelector("button").focus();
  }

  document
    .querySelectorAll("[data-privacy-settings]")
    .forEach((button) => button.addEventListener("click", () => showPreferences(true)));
  if (consent === "accepted") startTracking();
  else if (consent !== "denied" && (gtmId || ga4Id || metaPixelId)) showPreferences();

  window.addEventListener("simplechurch:conversion", ({ detail = {} }) => {
    if (consent !== "accepted" || !directEventForwarding) return;
    const { event: eventName, ...params } = detail;
    if (!eventName) return;
    if (ga4Id && window.gtag) {
      window.gtag("event", eventName, params);
      if (eventName === "demo_form_submit_success") window.gtag("event", "generate_lead", params);
    }
    if (metaPixelId && window.fbq && eventName === "demo_form_submit_success")
      window.fbq("track", "Lead", params);
  });
})();
