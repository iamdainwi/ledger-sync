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

// ── Colour tokens (strictly adhering to dashboard-design-skill tokens) ─────────
const C = {
  page:    "var(--color-page, #f8f8f6)",
  card:    "var(--color-card, #ffffff)",
  soft:    "var(--color-soft, #f1f1ef)",
  ink:     "var(--color-ink, #17171a)",
  ink2:    "var(--color-ink-2, #48484d)",
  muted:   "var(--color-muted, #66666d)",
  line:    "var(--color-line, rgb(0 0 0 / .075))",
  accent:  "var(--color-accent, #3e63dd)",
  money:   "var(--color-money, #0f7f57)",
  down:    "var(--color-down, #d23f45)",
  warn:    "var(--color-warn, #c98a00)",
  tip:     "var(--color-tip, #1f2530)",
  live:    "var(--color-live, #12a150)",
} as const;

// Meaning-based status hues
const STATUS_COLORS = {
  SUCCESS: "#0f7f57",
  RUNNING: "#c98a00",
  FAILED:  "#d23f45",
} as const;

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

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────
// Follows dashboard-design-skill: label · big number · 1-word baseline.
// Sentences and detailed explanations live exclusively in tooltips.

interface KpiTileProps {
  label: string;
  value: number;
  loading: boolean;
  baseline?: string;
  color?: string;
  tooltipText: string;
}

function KpiTile({
  label,
  value,
  loading,
  baseline,
  color,
  tooltipText,
}: KpiTileProps) {
  return (
    <div
      title={tooltipText}
      className="group relative flex flex-col justify-between p-5 transition-colors hover:bg-[var(--color-soft)]/50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-[var(--color-muted)]">
          {label}
        </span>
        {baseline && !loading && (
          <span className="text-[11px] font-medium text-[var(--color-muted)] tnum">
            {baseline}
          </span>
        )}
      </div>

      <div className="mt-2">
        {loading ? (
          <Skeleton className="h-8 w-16 rounded-md" />
        ) : (
          <span
            className="tnum text-[30px] font-semibold leading-none tracking-[-0.03em]"
            style={{ color: color ?? "var(--color-ink)" }}
          >
            {compact(value)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Status Chip ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: "SUCCESS" | "RUNNING" | "FAILED" }) {
  const color = STATUS_COLORS[status] ?? "var(--color-muted)";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium tnum"
      style={{
        background: `${color}14`,
        color: color,
        border: `1px solid ${color}30`,
      }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: color }}
      />
      {status}
    </span>
  );
}

// ── Slim Share Bar (from dashboard-design-skill snippets) ─────────────────────

function SlimShareBar({ pct, color }: { pct: number; color: string }) {
  return (
    <span
      aria-hidden
      className="absolute inset-x-3 bottom-0 h-[2.5px] overflow-hidden rounded-full bg-[var(--color-line)]/80"
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full opacity-80 transition-all duration-300 group-hover:opacity-100"
        style={{
          width: `${Math.max(2, Math.min(100, pct))}%`,
          background: color,
        }}
      />
    </span>
  );
}

// ── Chart Config ──────────────────────────────────────────────────────────────

const healthChartConfig = {
  count: { label: "Runs" },
} satisfies ChartConfig;

// ── Dashboard Page ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRuns()
      .then(setRuns)
      .catch(() => setError("Backend service unavailable"))
      .finally(() => setLoading(false));
  }, []);

  const total = runs.length;
  const successful = runs.filter((r) => r.status === "SUCCESS").length;
  const failed = runs.filter((r) => r.status === "FAILED").length;
  const running = runs.filter((r) => r.status === "RUNNING").length;
  const recent = runs.slice(0, 8);

  const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;

  // Chart data with semantic per-bar fills
  const healthData = [
    { status: "Successful", count: successful, fill: STATUS_COLORS.SUCCESS },
    { status: "Running",    count: running,    fill: STATUS_COLORS.RUNNING },
    { status: "Failed",     count: failed,     fill: STATUS_COLORS.FAILED  },
  ];

  const firstFailedRun = runs.find((r) => r.status === "FAILED");
  const firstRunningRun = runs.find((r) => r.status === "RUNNING");

  return (
    <div className="space-y-6">
      {/* ── Header Toolbar (pill group pattern from dashboard-design-skill) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-[20px] font-semibold tracking-tight text-[var(--color-ink)]">
            Dashboard
          </h1>
          {/* Live system state pill */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-card)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-ink-2)] shadow-[var(--shadow-card)]"
            title="Realtime connection to reconciliation engine"
          >
            <span className="size-2 rounded-full bg-[var(--color-live)] animate-pulse" />
            Live Engine
          </span>
        </div>

        {/* Action pills */}
        <div className="flex items-center gap-2">
          <Link
            href="/runs"
            className="inline-flex h-8 items-center rounded-full border border-[var(--color-line)] bg-[var(--color-card)] px-3 text-[12px] font-medium text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-soft)] shadow-[var(--shadow-card)]"
          >
            All Runs
          </Link>
          <Link
            href="/run"
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-3.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 shadow-sm"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
            </svg>
            New Run
          </Link>
        </div>
      </div>

      {/* ── Page-level error note (honest state) ── */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[var(--color-down)]/30 bg-[var(--color-down)]/10 px-4 py-3 text-[13px] text-[var(--color-down)]"
        >
          {error} — ensure FastAPI backend is running on port 8000.
        </div>
      )}

      {/* ── Attention Row (Step 2: Monitor what needs action) ── */}
      {firstFailedRun && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-down)]/20 bg-[var(--color-down)]/5 px-4 py-2.5">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--color-down)]">
            <span className="size-2 rounded-full bg-[var(--color-down)]" />
            1 failed run · {firstFailedRun.run_id.slice(0, 8)}
          </div>
          <Link
            href={`/runs/${firstFailedRun.run_id}`}
            className="text-[12px] font-medium text-[var(--color-down)] underline underline-offset-4 hover:opacity-80"
          >
            Inspect →
          </Link>
        </div>
      )}

      {firstRunningRun && !firstFailedRun && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-warn)]/20 bg-[var(--color-warn)]/5 px-4 py-2.5">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--color-warn)]">
            <span className="size-2 rounded-full bg-[var(--color-warn)] animate-ping" />
            1 run in progress · {firstRunningRun.run_id.slice(0, 8)}
          </div>
          <Link
            href={`/runs/${firstRunningRun.run_id}`}
            className="text-[12px] font-medium text-[var(--color-warn)] underline underline-offset-4 hover:opacity-80"
          >
            Track →
          </Link>
        </div>
      )}

      {/* ── KPI Strip (Step 1: Overview - one unified card divided by hairlines) ── */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] shadow-[var(--shadow-card)] grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x-0 lg:divide-x divide-[var(--color-line)]">
        <KpiTile
          label="Total Runs"
          value={total}
          loading={loading}
          baseline="all time"
          tooltipText="Total reconciliation pipeline runs recorded"
        />
        <KpiTile
          label="Successful"
          value={successful}
          loading={loading}
          baseline={`${successRate}% rate`}
          color={successful > 0 ? "var(--color-money)" : undefined}
          tooltipText={`${successful} of ${total} runs completed without execution faults`}
        />
        <KpiTile
          label="Running"
          value={running}
          loading={loading}
          baseline={running > 0 ? "active" : "idle"}
          color={running > 0 ? "var(--color-warn)" : "var(--color-muted)"}
          tooltipText="Reconciliation batches currently executing"
        />
        <KpiTile
          label="Failed"
          value={failed}
          loading={loading}
          baseline={failed > 0 ? "needs review" : "0 faults"}
          color={failed > 0 ? "var(--color-down)" : "var(--color-muted)"}
          tooltipText="Pipeline runs that failed validation or execution"
        />
      </div>

      {/* ── Main View: Visual Analysis & Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* ── Pipeline Health Card (Step 3: Closer look) ── */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[var(--color-ink)]">
                Pipeline Health
              </h2>
              <span className="text-[12px] font-medium text-[var(--color-muted)] tnum">
                {total} {total === 1 ? "run" : "runs"}
              </span>
            </div>

            {loading ? (
              <div className="pt-6">
                <Skeleton className="h-[150px] w-full rounded-xl" />
              </div>
            ) : total === 0 ? (
              <div className="flex h-[170px] items-center justify-center text-[12px] text-[var(--color-muted)]">
                No runs recorded yet
              </div>
            ) : (
              <div className="pt-4">
                <ChartContainer
                  config={healthChartConfig}
                  className="h-[160px] w-full"
                >
                  <BarChart
                    data={healthData}
                    layout="vertical"
                    margin={{ left: 0, right: 28, top: 8, bottom: 8 }}
                    barCategoryGap="28%"
                  >
                    <CartesianGrid horizontal={false} stroke="var(--color-line)" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey="status"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      width={80}
                      tick={{ fontSize: 12, fill: "var(--color-ink-2)" }}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => [
                            `${value} ${Number(value) === 1 ? "run" : "runs"}`,
                            name,
                          ]}
                        />
                      }
                      cursor={{ fill: "var(--color-soft)" }}
                    />
                    <Bar dataKey="count" radius={4} maxBarSize={22}>
                      {healthData.map((entry) => (
                        <Cell key={entry.status} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </div>

          {/* Calm categorical summary legend */}
          <div className="mt-4 flex items-center justify-between border-t border-[var(--color-line)] pt-3 text-[11px] text-[var(--color-muted)]">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: STATUS_COLORS.SUCCESS }} />
              <span>Successful</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: STATUS_COLORS.RUNNING }} />
              <span>Running</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: STATUS_COLORS.FAILED }} />
              <span>Failed</span>
            </div>
          </div>
        </div>

        {/* ── Recent Runs Card (Step 4: Act - direct action beside problem) ── */}
        <div className="lg:col-span-7 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-semibold text-[var(--color-ink)]">
              Recent Runs
            </h2>
            <Link
              href="/runs"
              className="text-[12px] font-medium text-[var(--color-accent)] hover:underline"
            >
              History →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2.5 pt-1">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            /* Guiding Empty State per components.md */
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-2 size-9 rounded-full bg-[var(--color-soft)] grid place-items-center text-[var(--color-muted)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <p className="text-[14px] font-medium text-[var(--color-ink)] mb-1">
                No runs recorded
              </p>
              <p className="text-[12px] text-[var(--color-muted)] max-w-xs mb-4">
                Upload transaction and settlement CSV files to run your first reconciliation.
              </p>
              <Link
                href="/run"
                className="inline-flex h-8 items-center rounded-full bg-[var(--color-accent)] px-4 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
              >
                Upload Files
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-line)]">
              {recent.map((run) => {
                const runColor = STATUS_COLORS[run.status] ?? "var(--color-muted)";
                return (
                  <div
                    key={run.run_id}
                    className="group relative flex items-center justify-between gap-3 py-3 px-2 rounded-xl transition-colors hover:bg-[var(--color-soft)]/60"
                  >
                    <SlimShareBar pct={run.status === "SUCCESS" ? 100 : 35} color={runColor} />

                    {/* Run Identity & Files */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono text-[12px] font-semibold text-[var(--color-ink)]"
                          title={run.run_id}
                        >
                          {run.run_id.slice(0, 8)}
                        </span>
                        <StatusChip status={run.status} />
                      </div>
                      <div className="mt-0.5 text-[11px] text-[var(--color-muted)] truncate">
                        {run.source_file} ↔ {run.settlement_file}
                      </div>
                    </div>

                    {/* Timestamp & Action */}
                    <div className="shrink-0 flex items-center gap-4 text-right">
                      <span className="text-[11px] text-[var(--color-muted)] tnum hidden sm:inline">
                        {formatDate(run.started_at)}
                      </span>
                      <Link
                        href={`/runs/${run.run_id}`}
                        className="inline-flex h-7 items-center rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] px-2.5 text-[11px] font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-soft)]"
                      >
                        Details
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
