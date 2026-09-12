// KhanhOS AI — CSRF / origin protection
// Chiến lược: SameSite cookie + kiểm tra Sec-Fetch-Site (browser tự sinh, JS không thể
// giả mạo) làm lớp chính; fallback so khớp Origin/Referer với Host (+ X-Forwarded-Host
// khi đi qua reverse proxy preview — Caddy giữ Host gốc nhưng có thể bị edge ghi đè).

/**
 * Kiểm tra request POST/PATCH/DELETE đến từ cùng origin (chống CSRF).
 *
 * Lớp 1 — Sec-Fetch-Site (chuẩn Fetch Metadata, browser đưa vào, không spoof được):
 *   same-origin / same-site / none → cho phép; cross-site → chặn.
 * Lớp 2 — fallback cho browser cũ / non-browser: Origin (hoặc Referer) phải khớp
 *   với Host hoặc một trong các host trong X-Forwarded-Host (proxy preview).
 *   Non-browser client không gửi cả Origin lẫn Referer → cho qua (cookie SameSite
 *   vẫn là lớp bảo vệ, đây là hành vi chuẩn cho API client/server-side).
 */
export function isSameOrigin(req: Request): boolean {
  // ── Lớp 1: Fetch Metadata (Sec-Fetch-*) ──
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite) {
    const v = secFetchSite.trim().toLowerCase();
    if (v === "same-origin" || v === "same-site" || v === "none") return true;
    return false; // "cross-site" → CSRF
  }

  // ── Lớp 2: so khớp host (browser cũ, tool) ──
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // Tập host hợp lệ: Host + mọi host trong X-Forwarded-Host (chuỗi proxy)
  const forwardedHosts = (req.headers.get("x-forwarded-host") ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  const host = req.headers.get("host")?.toLowerCase() ?? "";

  const allowedHosts = new Set<string>([host, ...forwardedHosts].filter(Boolean));
  const allowedHostnames = new Set<string>(
    [...allowedHosts].map((h) => h.split(":")[0])
  );

  const matchUrl = (raw: string): boolean => {
    try {
      const u = new URL(raw);
      const h = u.host.toLowerCase();
      const hn = u.hostname.toLowerCase();
      return allowedHosts.has(h) || allowedHostnames.has(hn);
    } catch {
      return false;
    }
  };

  if (origin) return matchUrl(origin);
  if (referer) return matchUrl(referer);

  // Không Origin/Referer/Sec-Fetch-Site → non-browser (curl, server-to-server)
  return true;
}
