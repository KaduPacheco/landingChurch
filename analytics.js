(() => {
  const config = window.SIMPLECHURCH_ANALYTICS || {};
  const { gtmId, ga4Id, metaPixelId, directEventForwarding = true } = config;

  window.dataLayer = window.dataLayer || [];

  const loadScript = (src) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
  };

  if (gtmId) {
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    loadScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`);
  }

  if (ga4Id) {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", ga4Id);
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`);
  }

  if (metaPixelId) {
    window.fbq =
      window.fbq ||
      function fbq() {
        window.fbq.callMethod
          ? window.fbq.callMethod.apply(window.fbq, arguments)
          : window.fbq.queue.push(arguments);
      };
    if (!window._fbq) window._fbq = window.fbq;
    window.fbq.push = window.fbq;
    window.fbq.loaded = true;
    window.fbq.version = "2.0";
    window.fbq.queue = window.fbq.queue || [];
    window.fbq("init", metaPixelId);
    window.fbq("track", "PageView");
    loadScript("https://connect.facebook.net/en_US/fbevents.js");
  }

  if (!directEventForwarding) return;

  window.addEventListener("simplechurch:conversion", (event) => {
    const detail = event.detail || {};
    const { event: eventName, ...params } = detail;
    if (!eventName) return;

    if (ga4Id && window.gtag) {
      window.gtag("event", eventName, params);
      if (eventName === "demo_form_submit_success") {
        window.gtag("event", "generate_lead", params);
      }
    }

    if (metaPixelId && window.fbq) {
      if (eventName === "commercial_cta_click") {
        window.fbq("track", "Contact", params);
      }
      if (eventName === "demo_form_submit_success") {
        window.fbq("track", "Lead", params);
      }
    }
  });
})();
