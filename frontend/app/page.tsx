"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listRuns, type RunListItem } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

// ── Colour tokens (match globals.css --color-* tokens) ────────────────────────
const C = {
  accent:  "#3e63dd",
  money:   "#0f7f57",
  down:    "#d23f45",
  warn:    "#c98a00",
  ink:     "#17171a",
  ink2:    "#48484d",
  muted:   "#66666d",
  line:    "rgb(0 0 0 / .075)",
  card:    "#ffffff",
  soft:    "#f1f1ef",
} as const;

// Status → semantic colour (meaning-driven, not direction-driven)
const STATUS_COLOR: Record<string, string> = {
  SUCCESS: C.money,   // green = good outcome
  RUNNING: C.warn,    // amber = in-progress / needs watching
  FAILED:  C.down,    // red = bad outcome
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Compact number: 1234 → 1.2k */
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// ── KPI tile ─────────────────────────────────────────────────────────────────
// One card divided by hairlines; each tile: label · big number · delta hint

function KpiTile({
  label,
  value,
  loading,
  color,
  hint,
}: {
  label: string;
  value: number;
  loading: boolean;
  color?: string;
  hint?: string;
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-1 px-6 py-5 border-r last:border-r-0"
      style={{ borderColor: C.line }}
    >
      <span className="text-[13px]" style={{ color: C.muted }}>
        {label}
      </span>
      {loading ? (
        <Skeleton className="mt-1 h-8 w-16" />
      ) : (
        <span
          className="tnum text-[32px] font-semibold leading-none tracking-tight"
          style={{ color: color ?? C.ink }}
          title={value.toLocaleString()}
        >
          {compact(value)}
        </span>
      )}
      {hint && !loading && (
        <span className="text-[12px]" style={{ color: C.muted }}>
          {hint}
        </span>
      )}
    </div>
  );
}

// ── Status chip ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? C.muted;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tnum"
      style={{
        background: `${color}18`,
        color,
        border: `1px solid ${color}30`,
      }}
    >
      {status}
    </span>
  );
}

// ── Chart config ──────────────────────────────────────────────────────────────

const healthChartConfig = {
  count: { label: "Runs" },
} satisfies ChartConfig;

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRuns()
      .then(setRuns)
      .catch(() => setError("Backend unreachable"))
      .finally(() => setLoading(false));
  }, []);

  const total      = runs.length;
  const successful = runs.filter((r) => r.status === "SUCCESS").length;
  const failed     = runs.filter((r) => r.status === "FAILED").length;
  const running    = runs.filter((r) => r.status === "RUNNING").length;
  const recent     = runs.slice(0, 8);

  const healthData = [
    { status: "Successful", count: successful, fill: STATUS_COLOR.SUCCESS },
    { status: "Running",    count: running,    fill: STATUS_COLOR.RUNNING },
    { status: "Failed",     count: failed,     fill: STATUS_COLOR.FAILED  },
  ];

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: C.ink }}>
            Dashboard
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: C.muted }}>
            Reconciliation pipeline overview
          </p>
        </div>

        {/* Action pill */}
        <Link
          href="/run"
          className="inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors"
          style={{ background: C.accent, color: "#fff" }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
          </svg>
          New Run
        </Link>
      </div>

      {/* ── Error banner (page-level, not repeated per card) ── */}
      {error && (
        <div
          className="rounded-xl border px-4 py-3 text-[13px]"
          style={{ borderColor: `${C.down}30`, background: `${C.down}0d`, color: C.down }}
        >
          {error} — check the backend is running.
        </div>
      )}

      {/* ── KPI strip (one card, hairline dividers) ── */}
      <div
        className="overflow-hidden rounded-2xl border grid grid-cols-2 sm:grid-cols-4"
        style={{ borderColor: C.line, background: C.card, boxShadow: "0 1px 2px rgb(0 0 0/.04)" }}
      >
        <KpiTile label="Total Runs"  value={total}      loading={loading} />
        <KpiTile label="Successful"  value={successful} loading={loading} color={C.money} hint={total ? `${Math.round((successful / total) * 100)}% success rate` : undefined} />
        <KpiTile label="Failed"      value={failed}     loading={loading} color={failed > 0 ? C.down : C.ink} />
        <KpiTile label="Running"     value={running}    loading={loading} color={running > 0 ? C.warn : C.ink} />
      </div>

      {/* ── Two-column layout: chart + recent runs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Pipeline Health bar chart */}
        {!loading && total > 0 && (
          <div
            className="lg:col-span-2 rounded-2xl border p-5"
            style={{ borderColor: C.line, background: C.card, boxShadow: "0 1px 2px rgb(0 0 0/.04)" }}
          >
            <p className="text-[14px] font-semibold mb-0.5" style={{ color: C.ink }}>
              Pipeline Health
            </p>
            <p className="text-[12px] mb-4" style={{ color: C.muted }}>
              Status distribution · {total} {total === 1 ? "run" : "runs"}
            </p>
            <ChartContainer config={healthChartConfig} className="h-[160px] w-full">
              <BarChart
                data={healthData}
                layout="vertical"
                margin={{ left: 0, right: 32, top: 4, bottom: 4 }}
                barCategoryGap="28%"
              >
                <CartesianGrid horizontal={false} stroke={C.line} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: C.muted }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="status"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={80}
                  tick={{ fontSize: 12, fill: C.ink2 }}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  cursor={{ fill: C.soft }}
                />
                <Bar dataKey="count" radius={4} maxBarSize={24}>
                  {healthData.map((entry) => (
                    <Cell key={entry.status} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        )}

        {/* Recent runs list */}
        <div
          className={`rounded-2xl border p-5 ${!loading && total > 0 ? "lg:col-span-3" : "lg:col-span-5"}`}
          style={{ borderColor: C.line, background: C.card, boxShadow: "0 1px 2px rgb(0 0 0/.04)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-[14px] font-semibold" style={{ color: C.ink }}>
              Recent Runs
            </p>
            <Link
              href="/runs"
              className="text-[12px] transition-colors hover:underline"
              style={{ color: C.accent }}
            >
              View all →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-xl" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed text-center"
              style={{ borderColor: C.line }}
            >
              <p className="text-[14px] mb-1" style={{ color: C.ink2 }}>No runs yet</p>
              <p className="text-[13px] mb-4" style={{ color: C.muted }}>
                Upload CSVs to start reconciling
              </p>
              <Link
                href="/run"
                className="inline-flex h-8 items-center rounded-full px-4 text-[13px] font-medium"
                style={{ background: C.accent, color: "#fff" }}
              >
                Start first run
              </Link>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: C.line }}>
              {recent.map((run) => {
                // Match rate from run data (matched / (matched + exceptions), approximate from list)
                return (
                  <div
                    key={run.run_id}
                    className="group relative flex items-center gap-3 py-3 px-1 rounded-[10px] transition-colors hover:bg-[var(--color-soft)]"
                  >
                    {/* Status dot */}
                    <span
                      className="mt-0.5 size-2 shrink-0 rounded-full"
                      style={{ background: STATUS_COLOR[run.status] ?? C.muted }}
                    />

                    {/* Run info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="font-mono text-[12px] truncate"
                          style={{ color: C.ink2 }}
                          title={run.run_id}
                        >
                          {run.run_id.slice(0, 8)}
                        </span>
                        <StatusChip status={run.status} />
                      </div>
                      <span className="text-[12px]" style={{ color: C.muted }}>
                        {run.source_file} ↔ {run.settlement_file}
                      </span>
                    </div>

                    {/* Date + Details */}
                    <div className="shrink-0 text-right">
                      <p className="text-[12px] tnum mb-1" style={{ color: C.muted }}>
                        {formatDate(run.started_at)}
                      </p>
                      <Link
                        href={`/runs/${run.run_id}`}
                        className="text-[12px] font-medium transition-colors hover:underline"
                        style={{ color: C.accent }}
                      >
                        Details →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
