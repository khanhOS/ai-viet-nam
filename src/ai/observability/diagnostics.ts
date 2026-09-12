// KhanhOS AI — Observability: số liệu vận hành THẬT (không fake).
// Vòng đệm in-memory N request gần nhất + API diagnostics cho owner.

import type { DiagnosticsSummary } from "@/ai/core/types";

export interface RequestRecord extends DiagnosticsSummary {
  at: number;
  conversationId: string | null;
  userId: string | null;
}

const MAX_RECORDS = 50;

const g = globalThis as unknown as {
  __khanhosDiag?: RequestRecord[];
  __khanhosDiagTotals?: { requests: number; errors: number };
};

const records = (g.__khanhosDiag ??= []);
const totals = (g.__khanhosDiagTotals ??= { requests: 0, errors: 0 });

export function recordRequest(rec: RequestRecord): void {
  records.push(rec);
  if (records.length > MAX_RECORDS) records.shift();
  totals.requests += 1;
  if (rec.verification === null && rec.totalMs === null) totals.errors += 1;
}

export function getRecentRequests(): RequestRecord[] {
  return [...records].reverse();
}

export function getDiagnosticsSummary() {
  const done = records.filter((r) => r.totalMs !== null);
  const avgTtft =
    done.length > 0
      ? done.reduce((s, r) => s + (r.timeToFirstTokenMs ?? 0), 0) / done.length
      : null;
  const avgTps =
    done.length > 0 && done.some((r) => r.tokensPerSecond)
      ? done.filter((r) => r.tokensPerSecond).reduce((s, r) => s + (r.tokensPerSecond ?? 0), 0) /
        done.filter((r) => r.tokensPerSecond).length
      : null;
  return {
    totals: { ...totals },
    averages: {
      timeToFirstTokenMs: avgTtft !== null ? Math.round(avgTtft) : null,
      tokensPerSecond: avgTps !== null ? Math.round(avgTps * 10) / 10 : null,
      totalMs: done.length ? Math.round(done.reduce((s, r) => s + (r.totalMs ?? 0), 0) / done.length) : null,
    },
    window: records.length,
  };
}
