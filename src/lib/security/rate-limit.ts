// KhanhOS AI — Rate limiting in-memory (sliding window)
// Phù hợp cho demo/single-instance. Khi scale: thay bằng Redis.

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * @param key    định danh (vd: `login:ip:1.2.3.4`, `chat:user:xyz`)
 * @param limit  số request tối đa
 * @param windowMs khoảng thời gian cửa sổ (ms)
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    if (buckets.size > MAX_KEYS) buckets.clear(); // chống memory leak
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  bucket.hits.push(now);
  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSec: 0 };
}

/** Lấy IP client từ headers (đi qua proxy Caddy của sandbox). */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
