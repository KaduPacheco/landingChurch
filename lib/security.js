export const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; script-src 'self' https://www.googletagmanager.com https://connect.facebook.net; connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://www.facebook.com; img-src 'self' data: https://www.facebook.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
  },
];
