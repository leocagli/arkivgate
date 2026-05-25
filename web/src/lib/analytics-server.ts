import { prisma } from "@/lib/prisma";
import { hasSupabaseRestConfig, restEq, supabaseRestFetch } from "@/lib/supabase-rest";
import { padHourly, type HourlyBucket } from "@/lib/volume-buckets";

const RANGES = { "24h": 1, "7d": 7, "30d": 30 } as const;
export type AnalyticsRange = keyof typeof RANGES;

type Action = "BLOCK" | "REDACT" | "WARN" | "LOG";
type ActionStats = { count: number; avgLatencyMs: number };

export type AnalyticsData = {
  range: AnalyticsRange;
  total: number;
  avgLatencyMs: number;
  byAction: Record<Action, ActionStats>;
  hourly: HourlyBucket[];
  topPolicies: { slug: string; count: number }[];
};

type RestInteraction = {
  action: Action;
  policy_hits: unknown;
  latency_total_ms: number;
  created_at: string;
};

type InteractionLite = {
  action: Action;
  policyHits: unknown;
  latencyTotalMs: number;
  createdAt: Date;
};

const ACTIONS: Action[] = ["BLOCK", "REDACT", "WARN", "LOG"];

function emptyByAction(): Record<Action, ActionStats> {
  return {
    BLOCK: { count: 0, avgLatencyMs: 0 },
    REDACT: { count: 0, avgLatencyMs: 0 },
    WARN: { count: 0, avgLatencyMs: 0 },
    LOG: { count: 0, avgLatencyMs: 0 },
  };
}

function daysForRange(range: string | null | undefined): {
  range: AnalyticsRange;
  days: number;
} {
  const normalized = range && range in RANGES ? (range as AnalyticsRange) : "7d";
  return { range: normalized, days: RANGES[normalized] };
}

function isPolicyHit(value: unknown): value is { slug?: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function countPolicyHits(policyHits: unknown, counts: Map<string, number>) {
  if (!Array.isArray(policyHits)) return;
  for (const hit of policyHits) {
    if (!isPolicyHit(hit) || typeof hit.slug !== "string" || !hit.slug) continue;
    counts.set(hit.slug, (counts.get(hit.slug) ?? 0) + 1);
  }
}

function floorToHour(date: Date): Date {
  const copy = new Date(date);
  copy.setMinutes(0, 0, 0);
  return copy;
}

function aggregateRows(
  rows: InteractionLite[],
  range: AnalyticsRange,
  since: Date,
): AnalyticsData {
  const byAction = emptyByAction();
  const latencyByAction = new Map<Action, number>();
  const hourlyCounts = new Map<number, number>();
  const policyCounts = new Map<string, number>();
  let latencyTotal = 0;

  for (const row of rows) {
    byAction[row.action].count += 1;
    latencyByAction.set(row.action, (latencyByAction.get(row.action) ?? 0) + row.latencyTotalMs);
    latencyTotal += row.latencyTotalMs;

    const hour = floorToHour(row.createdAt).getTime();
    hourlyCounts.set(hour, (hourlyCounts.get(hour) ?? 0) + 1);
    countPolicyHits(row.policyHits, policyCounts);
  }

  for (const action of ACTIONS) {
    const count = byAction[action].count;
    byAction[action].avgLatencyMs =
      count > 0 ? Math.round((latencyByAction.get(action) ?? 0) / count) : 0;
  }

  const hourlyRows = Array.from(hourlyCounts.entries()).map(([hour, count]) => ({
    hour: new Date(hour),
    count,
  }));

  return {
    range,
    total: rows.length,
    avgLatencyMs: rows.length > 0 ? Math.round(latencyTotal / rows.length) : 0,
    byAction,
    hourly: padHourly(hourlyRows, since),
    topPolicies: Array.from(policyCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([slug, count]) => ({ slug, count })),
  };
}

async function analyticsWithPrisma(input: {
  orgId: string;
  range: AnalyticsRange;
  since: Date;
}): Promise<AnalyticsData> {
  const [byAction, aggregate, hourlyRows, topPoliciesRows] = await Promise.all([
    prisma.interaction.groupBy({
      by: ["action"],
      where: { orgId: input.orgId, createdAt: { gte: input.since } },
      _count: { action: true },
      _avg: { latencyTotalMs: true },
    }),

    prisma.interaction.aggregate({
      where: { orgId: input.orgId, createdAt: { gte: input.since } },
      _avg: { latencyTotalMs: true },
      _count: { id: true },
    }),

    prisma.$queryRaw<{ hour: Date; count: bigint }[]>`
      SELECT
        date_trunc('hour', created_at) AS hour,
        COUNT(*)::bigint AS count
      FROM interactions
      WHERE org_id = ${input.orgId}
        AND created_at >= ${input.since}
      GROUP BY 1
      ORDER BY 1 ASC
    `,

    prisma.$queryRaw<{ slug: string; count: bigint }[]>`
      SELECT
        hit->>'slug' AS slug,
        COUNT(*)::bigint AS count
      FROM interactions,
           jsonb_array_elements(policy_hits::jsonb) AS hit
      WHERE org_id = ${input.orgId}
        AND created_at >= ${input.since}
        AND jsonb_array_length(policy_hits::jsonb) > 0
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 8
    `,
  ]);

  const actionMap = Object.fromEntries(
    byAction.map((r) => [
      r.action,
      { count: r._count.action, avgLatencyMs: Math.round(r._avg.latencyTotalMs ?? 0) },
    ]),
  ) as Partial<Record<Action, ActionStats>>;

  return {
    range: input.range,
    total: Number(aggregate._count.id),
    avgLatencyMs: Math.round(aggregate._avg.latencyTotalMs ?? 0),
    byAction: {
      BLOCK: actionMap.BLOCK ?? { count: 0, avgLatencyMs: 0 },
      REDACT: actionMap.REDACT ?? { count: 0, avgLatencyMs: 0 },
      WARN: actionMap.WARN ?? { count: 0, avgLatencyMs: 0 },
      LOG: actionMap.LOG ?? { count: 0, avgLatencyMs: 0 },
    },
    hourly: padHourly(hourlyRows, input.since),
    topPolicies: topPoliciesRows.map((r) => ({ slug: r.slug, count: Number(r.count) })),
  };
}

async function analyticsWithRest(input: {
  orgId: string;
  range: AnalyticsRange;
  since: Date;
}): Promise<AnalyticsData> {
  const rows = await supabaseRestFetch<RestInteraction[]>(
    `/interactions?select=action,policy_hits,latency_total_ms,created_at&org_id=eq.${restEq(input.orgId)}&created_at=gte.${encodeURIComponent(input.since.toISOString())}&order=created_at.desc&limit=10000`,
  );
  return aggregateRows(
    rows.map((row) => ({
      action: row.action,
      policyHits: row.policy_hits,
      latencyTotalMs: row.latency_total_ms,
      createdAt: new Date(row.created_at),
    })),
    input.range,
    input.since,
  );
}

export async function getAnalytics(input: {
  orgId: string;
  range?: string | null;
}): Promise<AnalyticsData> {
  const { range, days } = daysForRange(input.range);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    return await analyticsWithPrisma({ orgId: input.orgId, range, since });
  } catch (err) {
    if (!hasSupabaseRestConfig()) throw err;
    console.warn("[analytics] Prisma failed, falling back to Supabase REST:", err);
    return analyticsWithRest({ orgId: input.orgId, range, since });
  }
}
