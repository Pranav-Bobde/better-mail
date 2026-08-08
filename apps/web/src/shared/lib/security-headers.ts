export function createSecurityHeaders() {
  return [
    {
      key: "Content-Security-Policy",
      value: "base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
    },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Strict-Transport-Security", value: "max-age=31536000" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
  ];
}
