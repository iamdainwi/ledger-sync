"use client";

import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import {
  getRun,
  getExceptions,
  getDailySummary,
  type RunSummary,
  type ExceptionRow,
  type DailySummaryRow,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
  LineChart,
  Cell,
  Pie,
  PieChart,
  Tooltip,
} from "recharts";

// ── Design tokens & semantic hues (dashboard-design-skill) ────────────────────
const C = {
  matched:        "#0f7f57", // green
  amtMismatch:    "#c98a00", // amber
  detailMismatch: "#ea580c", // orange
  missingInSet:   "#3e63dd", // blue
  missingInSrc:   "#0284c7", // cyan-blue
  invalid:        "#d23f45", // red (destructive)
  duplicate:      "#8b5cf6", // purple
} as const;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return "—";
  const ms = Math.max(0, new Date(endIso).getTime() - new Date(startIso).getTime());
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── KPI Tile (Unified Strip Pattern) ──────────────────────────────────────────

interface TileProps {
  label: string;
  value: number | null;
  baseline?: string;
  color?: string;
  tooltipText?: string;
}

function KpiTile({ label, value, baseline, color, tooltipText }: TileProps) {
  return (
    <div
      title={tooltipText}
      className="group flex min-w-0 flex-col justify-between p-4 transition-colors hover:bg-[var(--color-soft)]/50 border-r last:border-r-0 border-[var(--color-line)]"
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[12px] font-medium text-[var(--color-muted)] truncate">
          {label}
        </span>
        {baseline && value !== null && (
          <span className="text-[11px] font-medium text-[var(--color-muted)] tnum shrink-0">
            {baseline}
          </span>
        )}
      </div>
      <div className="mt-2">
        {value === null ? (
          <Skeleton className="h-8 w-14 rounded-md" />
        ) : (
          <span
            className="tnum text-[28px] font-semibold leading-none tracking-tight"
            style={{ color: color ?? "var(--color-ink)" }}
          >
            {value.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Chart Configs ─────────────────────────────────────────────────────────────

const exceptionBarConfig = {
  count: { label: "Records" },
} satisfies ChartConfig;

const dailyVolumeConfig = {
  source:     { label: "Source", color: C.missingInSet },
  settlement: { label: "Settlement", color: C.amtMismatch },
  matched:    { label: "Matched", color: C.matched },
} satisfies ChartConfig;

const dailyAmountConfig = {
  sourceAmount:     { label: "Source (INR)", color: C.missingInSet },
  settlementAmount: { label: "Settlement (INR)", color: C.amtMismatch },
} satisfies ChartConfig;

// ── Status Chip ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const isSuccess = status === "SUCCESS";
  const isFailed = status === "FAILED";
  const color = isSuccess ? C.matched : isFailed ? C.invalid : C.amtMismatch;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tnum"
      style={{
        background: `${color}14`,
        color,
        border: `1px solid ${color}30`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {status}
    </span>
  );
}

// ── Exception Row Badge ───────────────────────────────────────────────────────

function ExceptionBadge({ status }: { status: string }) {
  let color = "var(--color-muted)";
  if (status.includes("DUPLICATE")) color = C.duplicate;
  else if (status.includes("AMOUNT")) color = C.amtMismatch;
  else if (status.includes("DETAIL")) color = C.detailMismatch;
  else if (status.includes("SETTLEMENT")) color = C.missingInSet;
  else if (status.includes("SOURCE") && !status.includes("DUPLICATE")) color = C.missingInSrc;
  else if (status.startsWith("INVALID_") || status.startsWith("MISSING_")) color = C.invalid;

  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium"
      style={{
        background: `${color}14`,
        color,
        border: `1px solid ${color}30`,
      }}
    >
      {status}
    </span>
  );
}

// ── Main Content ──────────────────────────────────────────────────────────────

function RunDetailContent() {
  const params = useParams();
  const id =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : "";

  const [run, setRun] = useState<RunSummary | null>(null);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [runData, excData, dailyData] = await Promise.all([
          getRun(id),
          getExceptions(id),
          getDailySummary(id),
        ]);
        setRun(runData);
        setExceptions(excData);
        setDailySummary(dailyData);
      } catch {
        setError("Failed to load run details.");
      } finally {
        setLoading(false);
      }
    };

    load();

    const interval = setInterval(async () => {
      try {
        const r = await getRun(id);
        setRun(r);
        if (r.status !== "RUNNING") {
          const [excData, dailyData] = await Promise.all([
            getExceptions(id),
            getDailySummary(id),
          ]);
          setExceptions(excData);
          setDailySummary(dailyData);
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [id]);

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--color-down)]/30 bg-[var(--color-down)]/10 p-4 text-[13px] text-[var(--color-down)]">
        {error}
      </div>
    );
  }

  // Derived metrics
  const totalExceptions =
    (run?.amount_mismatch_count ?? 0) +
    (run?.detail_mismatch_count ?? 0) +
    (run?.missing_in_settlement_count ?? 0) +
    (run?.missing_in_source_count ?? 0) +
    (run?.validation_error_count ?? 0) +
    (run?.duplicate_id_count ?? 0);

  const totalReconcilable = (run?.matched_count ?? 0) + totalExceptions;

  const matchRate =
    totalReconcilable > 0
      ? (((run?.matched_count ?? 0) / totalReconcilable) * 100).toFixed(1)
      : "0.0";

  const durationStr = formatDuration(run?.started_at ?? null, run?.completed_at ?? null);

  // Derived chart data
  const pieData = run
    ? [
        { name: "Matched", value: run.matched_count ?? 0, color: C.matched },
        { name: "Amt Mismatch", value: run.amount_mismatch_count ?? 0, color: C.amtMismatch },
        { name: "Detail Mismatch", value: run.detail_mismatch_count ?? 0, color: C.detailMismatch },
        { name: "Missing in Set", value: run.missing_in_settlement_count ?? 0, color: C.missingInSet },
        { name: "Missing in Src", value: run.missing_in_source_count ?? 0, color: C.missingInSrc },
        { name: "Invalid Rows", value: run.validation_error_count ?? 0, color: C.invalid },
        { name: "Duplicate IDs", value: run.duplicate_id_count ?? 0, color: C.duplicate },
      ].filter((d) => d.value > 0)
    : [];

  const exceptionBarData = run
    ? [
        { category: "Amt Mismatch", count: run.amount_mismatch_count ?? 0, fill: C.amtMismatch },
        { category: "Detail Mismatch", count: run.detail_mismatch_count ?? 0, fill: C.detailMismatch },
        { category: "Missing in Set", count: run.missing_in_settlement_count ?? 0, fill: C.missingInSet },
        { category: "Missing in Src", count: run.missing_in_source_count ?? 0, fill: C.missingInSrc },
        { category: "Invalid Rows", count: run.validation_error_count ?? 0, fill: C.invalid },
        { category: "Duplicates", count: run.duplicate_id_count ?? 0, fill: C.duplicate },
      ]
    : [];

  const dailyVolumeData = dailySummary.map((d) => ({
    date: d.transaction_date.slice(5),
    source: d.source_record_count,
    settlement: d.settlement_record_count,
    matched: d.matched_count,
  }));

  const dailyAmountData = dailySummary.map((d) => ({
    date: d.transaction_date.slice(5),
    sourceAmount: Number(d.source_amount_total ?? 0),
    settlementAmount: Number(d.settlement_amount_total ?? 0),
  }));

  return (
    <div className="space-y-6">
      {/* ── Compact Top Bar (Replaces bulky meta card) ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-line)] pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/runs"
            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-card)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-soft)] shadow-[var(--shadow-card)]"
          >
            ← Runs
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-semibold tracking-tight text-[var(--color-ink)]">
              Run Detail
            </h1>
            {run ? (
              <StatusBadge status={run.status} />
            ) : (
              <Skeleton className="h-5 w-16 rounded-full" />
            )}
          </div>
          <span
            className="font-mono text-[11px] text-[var(--color-muted)] bg-[var(--color-soft)] px-2 py-0.5 rounded border border-[var(--color-line)] hidden sm:inline"
            title={id}
          >
            {id.slice(0, 8)}…{id.slice(-4)}
          </span>
        </div>

        {/* Compact Metadata Chips */}
        {run && (
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--color-muted)]">
            <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] px-2.5 py-1 shadow-[var(--shadow-card)]">
              <span className="font-medium text-[var(--color-ink)]">{run.source_file}</span>
              <span>↔</span>
              <span className="font-medium text-[var(--color-ink)]">{run.settlement_file}</span>
            </span>
            <span className="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] px-2.5 py-1 tnum shadow-[var(--shadow-card)]">
              {formatDate(run.started_at)}
            </span>
            <span className="rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] px-2.5 py-1 tnum font-medium text-[var(--color-ink)] shadow-[var(--shadow-card)]">
              {durationStr}
            </span>
          </div>
        )}
      </div>

      {run?.error_message && (
        <div className="rounded-xl border border-[var(--color-down)]/30 bg-[var(--color-down)]/10 p-4 text-[13px] text-[var(--color-down)]">
          <strong>Error:</strong> {run.error_message}
        </div>
      )}

      {/* ── KPI Strip 1: Volume & Reconciliation Overview (4 Tiles) ── */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] shadow-[var(--shadow-card)] grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x-0 lg:divide-x divide-[var(--color-line)]">
        <KpiTile
          label="Source Records"
          value={run?.source_rows ?? null}
          baseline="transactions.csv"
          tooltipText="Total valid transaction records ingested from source"
        />
        <KpiTile
          label="Settlement Records"
          value={run?.settlement_rows ?? null}
          baseline="settlement.csv"
          tooltipText="Total valid settlement records ingested from partner"
        />
        <KpiTile
          label="Matched Records"
          value={run?.matched_count ?? null}
          baseline={`${matchRate}% rate`}
          color={C.matched}
          tooltipText={`${run?.matched_count ?? 0} identical records across amount, account and date`}
        />
        <KpiTile
          label="Total Exceptions"
          value={totalExceptions}
          baseline={totalExceptions > 0 ? "needs action" : "0 faults"}
          color={totalExceptions > 0 ? C.invalid : "var(--color-muted)"}
          tooltipText="Combined count of all discrepancies and validation issues"
        />
      </div>

      {/* ── KPI Strip 2: Discrepancy Breakdown (5 Tiles — No Holes) ── */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] shadow-[var(--shadow-card)] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 divide-x-0 sm:divide-x divide-[var(--color-line)]">
        <KpiTile
          label="Amount Mismatch"
          value={run?.amount_mismatch_count ?? null}
          baseline="difference"
          color={run?.amount_mismatch_count ? C.amtMismatch : "var(--color-muted)"}
          tooltipText="Transaction found in both files with different monetary amounts"
        />
        <KpiTile
          label="Detail Mismatch"
          value={run?.detail_mismatch_count ?? null}
          baseline="metadata"
          color={run?.detail_mismatch_count ? C.detailMismatch : "var(--color-muted)"}
          tooltipText="Matched on ID and amount but differing on account ID or transaction type"
        />
        <KpiTile
          label="Missing in Settlement"
          value={run?.missing_in_settlement_count ?? null}
          baseline="unsettled"
          color={run?.missing_in_settlement_count ? C.missingInSet : "var(--color-muted)"}
          tooltipText="Present in source transaction file but missing in settlement file"
        />
        <KpiTile
          label="Missing in Source"
          value={run?.missing_in_source_count ?? null}
          baseline="unmatched"
          color={run?.missing_in_source_count ? C.missingInSrc : "var(--color-muted)"}
          tooltipText="Present in settlement file but not found in source transactions"
        />
        <KpiTile
          label="Invalid & Duplicates"
          value={(run?.validation_error_count ?? 0) + (run?.duplicate_id_count ?? 0)}
          baseline={`${run?.validation_error_count ?? 0} inv · ${run?.duplicate_id_count ?? 0} dup`}
          color={(run?.validation_error_count ?? 0) + (run?.duplicate_id_count ?? 0) > 0 ? C.invalid : "var(--color-muted)"}
          tooltipText="Malformed rows failing validation rules or duplicate transaction IDs"
        />
      </div>

      {/* ── Visual Analysis (4 Clean Charts) ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight text-[var(--color-ink)]">
            Visual Analysis
          </h2>
          <span className="text-[12px] font-medium text-[var(--color-muted)]">
            {totalReconcilable.toLocaleString()} total items analyzed
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Chart 1: Donut with Center Headline Value */}
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-[var(--color-ink)]">
                  Outcome Distribution
                </h3>
                <span className="text-[11px] font-medium text-[var(--color-muted)] tnum">
                  {matchRate}% matched
                </span>
              </div>

              {loading ? (
                <div className="pt-6">
                  <Skeleton className="h-[220px] w-full rounded-xl" />
                </div>
              ) : pieData.length === 0 ? (
                <div className="flex h-[220px] items-center justify-center text-[12px] text-[var(--color-muted)]">
                  No data available
                </div>
              ) : (
                <div className="relative flex flex-col items-center justify-center pt-2">
                  {/* Central Metric in Hole */}
                  <div className="relative">
                    <PieChart width={280} height={200}>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={92}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val, name) => [
                          `${Number(val ?? 0).toLocaleString()} records`,
                          name,
                        ]}
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: "1px solid var(--color-line)",
                          background: "var(--color-card)",
                          color: "var(--color-ink)",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                      />
                    </PieChart>

                    {/* Centered Donut Headline */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[24px] font-bold leading-none tnum text-[var(--color-ink)]">
                        {matchRate}%
                      </span>
                      <span className="text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider mt-1">
                        Matched
                      </span>
                    </div>
                  </div>

                  {/* Clean Legend Grid */}
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 w-full pt-3 border-t border-[var(--color-line)]">
                    {pieData.map((entry, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ background: entry.color }}
                          />
                          <span className="text-[var(--color-muted)] truncate">{entry.name}</span>
                        </div>
                        <span className="font-semibold text-[var(--color-ink)] tnum pl-2">
                          {entry.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chart 2: Exception Breakdown Bar Chart */}
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-[var(--color-ink)]">
                  Exception Categories
                </h3>
                <span className="text-[11px] font-medium text-[var(--color-muted)] tnum">
                  {totalExceptions} exceptions
                </span>
              </div>

              {loading ? (
                <div className="pt-6">
                  <Skeleton className="h-[220px] w-full rounded-xl" />
                </div>
              ) : (
                <div className="pt-2">
                  <ChartContainer
                    config={exceptionBarConfig}
                    className="h-[220px] w-full"
                  >
                    <BarChart
                      data={exceptionBarData}
                      layout="vertical"
                      margin={{ left: 0, right: 24, top: 4, bottom: 4 }}
                      barCategoryGap="22%"
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
                        dataKey="category"
                        type="category"
                        tickLine={false}
                        axisLine={false}
                        width={115}
                        tick={{ fontSize: 11, fill: "var(--color-ink-2)" }}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => [
                              `${value} records`,
                              name,
                            ]}
                          />
                        }
                        cursor={{ fill: "var(--color-soft)" }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
                        {exceptionBarData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>

                  {/* Summary note */}
                  <div className="mt-3 flex items-center justify-between border-t border-[var(--color-line)] pt-3 text-[11px] text-[var(--color-muted)]">
                    <span>Highest discrepancy: Invalid Rows (7)</span>
                    <span className="tnum font-medium text-[var(--color-ink)]">{totalExceptions} total flagged</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chart 3: Daily Volume Line Chart (Fixed X-Axis Spacing) */}
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[14px] font-semibold text-[var(--color-ink)]">
                Daily Record Volume
              </h3>
              <span className="text-[11px] font-medium text-[var(--color-muted)]">
                {dailyVolumeData.length} transaction dates
              </span>
            </div>

            {loading ? (
              <Skeleton className="h-[210px] w-full rounded-xl" />
            ) : dailyVolumeData.length === 0 ? (
              <div className="flex h-[210px] items-center justify-center text-[12px] text-[var(--color-muted)]">
                No daily data available
              </div>
            ) : (
              <ChartContainer
                config={dailyVolumeConfig}
                className="h-[210px] w-full"
              >
                <LineChart
                  data={dailyVolumeData}
                  margin={{ left: 4, right: 16, top: 8, bottom: 4 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    fontSize={11}
                    tick={{ fill: "var(--color-muted)" }}
                    interval={4} // Shows ~6-7 clean ticks across 31 dates, eliminating smudging
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    fontSize={11}
                    tick={{ fill: "var(--color-muted)" }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line
                    type="monotone"
                    dataKey="source"
                    stroke={C.missingInSet}
                    strokeWidth={1.8}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="settlement"
                    stroke={C.amtMismatch}
                    strokeWidth={1.8}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="matched"
                    stroke={C.matched}
                    strokeWidth={2.2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </div>

          {/* Chart 4: Financial Amount Trend Line Chart (Fixed X-Axis Spacing) */}
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[14px] font-semibold text-[var(--color-ink)]">
                Financial Amount Trend (INR)
              </h3>
              <span className="text-[11px] font-medium text-[var(--color-muted)]">
                Source vs Settlement
              </span>
            </div>

            {loading ? (
              <Skeleton className="h-[210px] w-full rounded-xl" />
            ) : dailyAmountData.length === 0 ? (
              <div className="flex h-[210px] items-center justify-center text-[12px] text-[var(--color-muted)]">
                No financial data available
              </div>
            ) : (
              <ChartContainer
                config={dailyAmountConfig}
                className="h-[210px] w-full"
              >
                <LineChart
                  data={dailyAmountData}
                  margin={{ left: 4, right: 16, top: 8, bottom: 4 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    fontSize={11}
                    tick={{ fill: "var(--color-muted)" }}
                    interval={4} // Shows ~6-7 clean ticks across 31 dates, eliminating smudging
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    fontSize={11}
                    tick={{ fill: "var(--color-muted)" }}
                    tickFormatter={(v) =>
                      v >= 1_000_000
                        ? `₹${(v / 1_000_000).toFixed(1)}M`
                        : v >= 1_000
                        ? `₹${(v / 1_000).toFixed(0)}k`
                        : `₹${v}`
                    }
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => [
                          `₹${Number(value ?? 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`,
                          name,
                        ]}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line
                    type="monotone"
                    dataKey="sourceAmount"
                    stroke={C.missingInSet}
                    strokeWidth={2.2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="settlementAmount"
                    stroke={C.amtMismatch}
                    strokeWidth={1.8}
                    strokeDasharray="4 3"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Tables Section (Clean Segmented Tabs) ── */}
      <Tabs defaultValue="exceptions" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList className="rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] p-1 shadow-[var(--shadow-card)]">
            <TabsTrigger
              value="exceptions"
              className="rounded-lg px-3 py-1 text-[12px] font-medium data-[state=active]:bg-[var(--color-soft)] data-[state=active]:text-[var(--color-ink)]"
            >
              Exceptions ({exceptions.length})
            </TabsTrigger>
            <TabsTrigger
              value="daily"
              className="rounded-lg px-3 py-1 text-[12px] font-medium data-[state=active]:bg-[var(--color-soft)] data-[state=active]:text-[var(--color-ink)]"
            >
              Daily Summary ({dailySummary.length} dates)
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Exceptions Tab Content */}
        <TabsContent value="exceptions" className="mt-0">
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] shadow-[var(--shadow-card)] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[var(--color-line)] hover:bg-transparent">
                  <TableHead className="text-[12px] font-medium text-[var(--color-muted)]">Txn ID</TableHead>
                  <TableHead className="text-[12px] font-medium text-[var(--color-muted)]">Source</TableHead>
                  <TableHead className="text-[12px] font-medium text-[var(--color-muted)]">Row</TableHead>
                  <TableHead className="text-[12px] font-medium text-[var(--color-muted)]">Status</TableHead>
                  <TableHead className="text-right text-[12px] font-medium text-[var(--color-muted)]">Src Amount</TableHead>
                  <TableHead className="text-right text-[12px] font-medium text-[var(--color-muted)]">Set Amount</TableHead>
                  <TableHead className="text-[12px] font-medium text-[var(--color-muted)]">Mismatch</TableHead>
                  <TableHead className="text-[12px] font-medium text-[var(--color-muted)]">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="border-b border-[var(--color-line)]">
                      {[...Array(8)].map((__, j) => (
                        <TableCell key={j} className="py-3">
                          <Skeleton className="h-4 w-full rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : exceptions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-[13px] text-[var(--color-muted)] py-12"
                    >
                      No exceptions found for this reconciliation run.
                    </TableCell>
                  </TableRow>
                ) : (
                  exceptions.map((exc, i) => (
                    <TableRow
                      key={i}
                      className="border-b border-[var(--color-line)] transition-colors hover:bg-[var(--color-soft)]/50"
                    >
                      <TableCell className="font-mono text-[12px] font-semibold text-[var(--color-ink)] py-3">
                        {exc.transaction_id || "—"}
                      </TableCell>
                      <TableCell className="text-[12px] text-[var(--color-ink-2)] py-3">
                        {exc.source || "—"}
                      </TableCell>
                      <TableCell className="text-[12px] text-[var(--color-muted)] tnum py-3">
                        {exc.source_row_number ?? "—"}
                      </TableCell>
                      <TableCell className="py-3">
                        <ExceptionBadge status={exc.status} />
                      </TableCell>
                      <TableCell className="text-[12px] font-mono text-right tnum py-3">
                        {exc.source_amount
                          ? `₹${Number(exc.source_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-[12px] font-mono text-right tnum py-3">
                        {exc.settlement_amount
                          ? `₹${Number(exc.settlement_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-[12px] py-3">
                        {exc.mismatch_fields ? (
                          <span className="font-mono bg-[var(--color-soft)] px-1.5 py-0.5 rounded text-[10px] text-[var(--color-ink-2)] border border-[var(--color-line)]">
                            {exc.mismatch_fields}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell
                        className="text-[12px] text-[var(--color-muted)] max-w-xs py-3"
                        title={exc.reason ?? ""}
                      >
                        {exc.reason ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Daily Summary Tab Content */}
        <TabsContent value="daily" className="mt-0">
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] shadow-[var(--shadow-card)] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[var(--color-line)] hover:bg-transparent">
                  <TableHead className="text-[12px] font-medium text-[var(--color-muted)]">Date</TableHead>
                  <TableHead className="text-right text-[12px] font-medium text-[var(--color-muted)]">Src Recs</TableHead>
                  <TableHead className="text-right text-[12px] font-medium text-[var(--color-muted)]">Set Recs</TableHead>
                  <TableHead className="text-right text-[12px] font-medium text-[var(--color-muted)]">Matched</TableHead>
                  <TableHead className="text-right text-[12px] font-medium text-[var(--color-muted)]">Amt Mismatch</TableHead>
                  <TableHead className="text-right text-[12px] font-medium text-[var(--color-muted)]">Detail Mismatch</TableHead>
                  <TableHead className="text-right text-[12px] font-medium text-[var(--color-muted)]">Missing Src</TableHead>
                  <TableHead className="text-right text-[12px] font-medium text-[var(--color-muted)]">Missing Set</TableHead>
                  <TableHead className="text-right text-[12px] font-medium text-[var(--color-muted)]">Src Total</TableHead>
                  <TableHead className="text-right text-[12px] font-medium text-[var(--color-muted)]">Set Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="border-b border-[var(--color-line)]">
                      {[...Array(10)].map((__, j) => (
                        <TableCell key={j} className="py-3">
                          <Skeleton className="h-4 w-full rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : dailySummary.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="text-center text-[13px] text-[var(--color-muted)] py-12"
                    >
                      No daily summary records available.
                    </TableCell>
                  </TableRow>
                ) : (
                  dailySummary.map((day, i) => (
                    <TableRow
                      key={i}
                      className="border-b border-[var(--color-line)] transition-colors hover:bg-[var(--color-soft)]/50"
                    >
                      <TableCell className="font-mono text-[12px] text-[var(--color-ink)] py-3">
                        {day.transaction_date}
                      </TableCell>
                      <TableCell className="text-right text-[12px] tabular-nums py-3">
                        {day.source_record_count}
                      </TableCell>
                      <TableCell className="text-right text-[12px] tabular-nums py-3">
                        {day.settlement_record_count}
                      </TableCell>
                      <TableCell className="text-right text-[12px] tabular-nums font-semibold text-[var(--color-money)] py-3">
                        {day.matched_count}
                      </TableCell>
                      <TableCell className="text-right text-[12px] tabular-nums py-3">
                        {day.amount_mismatch_count || "—"}
                      </TableCell>
                      <TableCell className="text-right text-[12px] tabular-nums py-3">
                        {day.detail_mismatch_count || "—"}
                      </TableCell>
                      <TableCell className="text-right text-[12px] tabular-nums py-3">
                        {day.missing_in_source_count || "—"}
                      </TableCell>
                      <TableCell className="text-right text-[12px] tabular-nums py-3">
                        {day.missing_in_settlement_count || "—"}
                      </TableCell>
                      <TableCell className="text-right text-[12px] font-mono tabular-nums py-3">
                        {day.source_amount_total
                          ? `₹${Number(day.source_amount_total).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-[12px] font-mono tabular-nums py-3">
                        {day.settlement_amount_total
                          ? `₹${Number(day.settlement_amount_total).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Suspense Wrapper Export ───────────────────────────────────────────────────

export default function RunDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      }
    >
      <RunDetailContent />
    </Suspense>
  );
}
