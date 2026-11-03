"use client";

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
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
  Legend,
} from "recharts";

// ── Status helpers ─────────────────────────────────────────────────────────────

function runStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "SUCCESS") return "default";
  if (status === "FAILED") return "destructive";
  if (status === "RUNNING") return "secondary";
  return "outline";
}

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

// ── Semantic colors (shadcn ChartConfig pattern — not arbitrary CSS) ───────────
// These use the oklch color space consistent with the design system's destructive
// and muted tokens. Recharts requires explicit color values to render distinguishable
// data series; the neutral base theme provides no chroma on --chart-* variables.

const COLORS = {
  matched: "oklch(0.55 0.15 145)",          // green
  amtMismatch: "oklch(0.65 0.18 50)",       // amber
  detailMismatch: "oklch(0.62 0.18 35)",    // orange
  missingInSet: "oklch(0.55 0.15 240)",     // blue
  missingInSrc: "oklch(0.60 0.13 200)",     // cyan-blue
  invalid: "oklch(0.577 0.245 27.325)",     // = var(--destructive), red
  duplicate: "oklch(0.52 0.20 310)",        // purple
};

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | null;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground leading-tight">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4 px-4">
        {value === null ? (
          <Skeleton className="h-7 w-12" />
        ) : (
          <>
            <span className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</span>
            {sub && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Custom pie label ───────────────────────────────────────────────────────────

function PieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  name: string;
  value: number;
}) {
  if (percent < 0.03) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ── Chart configs ──────────────────────────────────────────────────────────────

const exceptionBarConfig = {
  count: { label: "Records" },
} satisfies ChartConfig;

const dailyVolumeConfig = {
  source: { label: "Source", color: COLORS.missingInSet },
  settlement: { label: "Settlement", color: COLORS.amtMismatch },
  matched: { label: "Matched", color: COLORS.matched },
} satisfies ChartConfig;

const dailyAmountConfig = {
  sourceAmount: { label: "Source (INR)", color: COLORS.missingInSet },
  settlementAmount: { label: "Settlement (INR)", color: COLORS.amtMismatch },
} satisfies ChartConfig;

// ── Main detail content ────────────────────────────────────────────────────────

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
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  // ── Derived chart data ───────────────────────────────────────────────────────

  const pieData = run
    ? [
        { name: "Matched", value: run.matched_count ?? 0, color: COLORS.matched },
        { name: "Amt Mismatch", value: run.amount_mismatch_count ?? 0, color: COLORS.amtMismatch },
        { name: "Detail Mismatch", value: run.detail_mismatch_count ?? 0, color: COLORS.detailMismatch },
        { name: "Missing in Set", value: run.missing_in_settlement_count ?? 0, color: COLORS.missingInSet },
        { name: "Missing in Src", value: run.missing_in_source_count ?? 0, color: COLORS.missingInSrc },
        { name: "Invalid", value: run.validation_error_count ?? 0, color: COLORS.invalid },
        { name: "Duplicate", value: run.duplicate_id_count ?? 0, color: COLORS.duplicate },
      ].filter((d) => d.value > 0)
    : [];

  const exceptionBarData = run
    ? [
        { category: "Amt Mismatch", count: run.amount_mismatch_count ?? 0, fill: COLORS.amtMismatch },
        { category: "Detail Mismatch", count: run.detail_mismatch_count ?? 0, fill: COLORS.detailMismatch },
        { category: "Missing in Set", count: run.missing_in_settlement_count ?? 0, fill: COLORS.missingInSet },
        { category: "Missing in Src", count: run.missing_in_source_count ?? 0, fill: COLORS.missingInSrc },
        { category: "Invalid Rows", count: run.validation_error_count ?? 0, fill: COLORS.invalid },
        { category: "Duplicates", count: run.duplicate_id_count ?? 0, fill: COLORS.duplicate },
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

  const totalReconcilable =
    (run?.matched_count ?? 0) +
    (run?.amount_mismatch_count ?? 0) +
    (run?.detail_mismatch_count ?? 0) +
    (run?.missing_in_settlement_count ?? 0) +
    (run?.missing_in_source_count ?? 0);

  const matchRate =
    totalReconcilable > 0
      ? (((run?.matched_count ?? 0) / totalReconcilable) * 100).toFixed(1)
      : "—";

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Run Detail</h1>
          {run ? (
            <Badge variant={runStatusVariant(run.status)}>{run.status}</Badge>
          ) : (
            <Skeleton className="h-5 w-20" />
          )}
        </div>
        {loading ? (
          <Skeleton className="h-4 w-64" />
        ) : (
          <p className="text-muted-foreground text-xs font-mono break-all">{id}</p>
        )}
      </div>

      {/* ── Meta card ── */}
      {run && (
        <Card>
          <CardContent className="py-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            {[
              { label: "Source File", value: run.source_file },
              { label: "Settlement File", value: run.settlement_file },
              { label: "Started", value: formatDate(run.started_at) },
              { label: "Completed", value: formatDate(run.completed_at) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">
                  {label}
                </p>
                <p className="font-medium text-sm truncate">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {run?.error_message && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <strong>Error:</strong> {run.error_message}
        </div>
      )}

      {/* ── Stat cards — 2 rows ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Source Rows" value={run?.source_rows ?? null} />
        <StatCard label="Settlement Rows" value={run?.settlement_rows ?? null} />
        <StatCard
          label="Matched"
          value={run?.matched_count ?? null}
          sub={run ? `${matchRate}% match rate` : undefined}
        />
        <StatCard label="Amt Mismatch" value={run?.amount_mismatch_count ?? null} />
        <StatCard label="Detail Mismatch" value={run?.detail_mismatch_count ?? null} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Missing in Settlement" value={run?.missing_in_settlement_count ?? null} />
        <StatCard label="Missing in Source" value={run?.missing_in_source_count ?? null} />
        <StatCard label="Invalid Rows" value={run?.validation_error_count ?? null} />
        <StatCard label="Duplicate IDs" value={run?.duplicate_id_count ?? null} />
      </div>

      <Separator />

      {/* ── Visual Analysis ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Visual Analysis</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Graphical breakdown of reconciliation outcomes and daily settlement trends.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chart 1 — Status distribution pie */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Reconciliation Status Distribution
              </CardTitle>
              <CardDescription className="text-xs">
                Proportional breakdown of all reconciliation outcomes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[280px] w-full rounded-md" />
              ) : pieData.length === 0 ? (
                <div className="h-[280px] flex items-center justify-center text-xs text-muted-foreground">
                  No data available yet
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <PieChart width={300} height={220}>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                      dataKey="value"
                      labelLine={false}
                      label={PieLabel as never}
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
                        border: "1px solid var(--border)",
                        background: "var(--background)",
                      }}
                    />
                  </PieChart>
                  {/* Custom legend */}
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                    {pieData.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-xs">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0"
                          style={{ background: entry.color }}
                        />
                        <span className="text-muted-foreground">{entry.name}</span>
                        <span className="font-medium tabular-nums">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chart 2 — Exception categories bar chart (excludes matched) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Exception Categories Breakdown
              </CardTitle>
              <CardDescription className="text-xs">
                Count of each non-matched exception type (matched records excluded for scale).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[280px] w-full rounded-md" />
              ) : (
                <ChartContainer
                  config={exceptionBarConfig}
                  className="h-[280px] w-full"
                >
                  <BarChart
                    data={exceptionBarData}
                    layout="vertical"
                    margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
                    barCategoryGap="25%"
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} fontSize={11} />
                    <YAxis
                      dataKey="category"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      width={110}
                      fontSize={11}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                    />
                    <Bar dataKey="count" radius={4} maxBarSize={28}>
                      {exceptionBarData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Chart 3 — Daily volume line chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Daily Transaction Volume
              </CardTitle>
              <CardDescription className="text-xs">
                Source, settlement, and matched record counts over time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[260px] w-full rounded-md" />
              ) : dailyVolumeData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-xs text-muted-foreground">
                  No daily data available
                </div>
              ) : (
                <ChartContainer
                  config={dailyVolumeConfig}
                  className="h-[260px] w-full"
                >
                  <LineChart
                    data={dailyVolumeData}
                    margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={10}
                      interval="preserveStartEnd"
                    />
                    <YAxis tickLine={false} axisLine={false} width={28} fontSize={10} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      type="monotone"
                      dataKey="source"
                      stroke={COLORS.missingInSet}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="settlement"
                      stroke={COLORS.amtMismatch}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="matched"
                      stroke={COLORS.matched}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Chart 4 — Daily amount trend line chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Financial Amount Trend (INR)
              </CardTitle>
              <CardDescription className="text-xs">
                Source vs settlement total amounts across transaction dates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[260px] w-full rounded-md" />
              ) : dailyAmountData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-xs text-muted-foreground">
                  No financial data available
                </div>
              ) : (
                <ChartContainer
                  config={dailyAmountConfig}
                  className="h-[260px] w-full"
                >
                  <LineChart
                    data={dailyAmountData}
                    margin={{ left: 4, right: 16, top: 8, bottom: 8 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={10}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={52}
                      fontSize={10}
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
                      stroke={COLORS.missingInSet}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="settlementAmount"
                      stroke={COLORS.amtMismatch}
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* ── Tables tabs ── */}
      <Tabs defaultValue="exceptions">
        <TabsList>
          <TabsTrigger value="exceptions">
            Exceptions&nbsp;
            <span className="text-muted-foreground">({exceptions.length})</span>
          </TabsTrigger>
          <TabsTrigger value="daily">
            Daily Summary&nbsp;
            <span className="text-muted-foreground">({dailySummary.length} dates)</span>
          </TabsTrigger>
        </TabsList>

        {/* Exceptions */}
        <TabsContent value="exceptions" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Row #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Src Amount</TableHead>
                    <TableHead className="text-right">Set Amount</TableHead>
                    <TableHead>Mismatch Fields</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        {[...Array(8)].map((__, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : exceptions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground py-10"
                      >
                        No exceptions found for this run.
                      </TableCell>
                    </TableRow>
                  ) : (
                    exceptions.map((exc, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">
                          {exc.transaction_id || "—"}
                        </TableCell>
                        <TableCell className="text-xs">{exc.source || "—"}</TableCell>
                        <TableCell className="text-xs tabular-nums">
                          {exc.source_row_number ?? "—"}
                        </TableCell>
                        <TableCell>
                          <ExceptionBadge status={exc.status} />
                        </TableCell>
                        <TableCell className="text-xs font-mono text-right">
                          {exc.source_amount
                            ? `₹${Number(exc.source_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-right">
                          {exc.settlement_amount
                            ? `₹${Number(exc.settlement_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {exc.mismatch_fields ? (
                            <span className="font-mono bg-muted px-1 py-0.5 rounded text-[10px]">
                              {exc.mismatch_fields}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell
                          className="text-xs text-muted-foreground max-w-[200px] truncate"
                          title={exc.reason ?? ""}
                        >
                          {exc.reason ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily summary */}
        <TabsContent value="daily" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Src Records</TableHead>
                    <TableHead className="text-right">Set Records</TableHead>
                    <TableHead className="text-right">Matched</TableHead>
                    <TableHead className="text-right">Amt Mismatch</TableHead>
                    <TableHead className="text-right">Detail Mismatch</TableHead>
                    <TableHead className="text-right">Missing Src</TableHead>
                    <TableHead className="text-right">Missing Set</TableHead>
                    <TableHead className="text-right">Src Total (INR)</TableHead>
                    <TableHead className="text-right">Set Total (INR)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        {[...Array(10)].map((__, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : dailySummary.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="text-center text-muted-foreground py-10"
                      >
                        No daily summary data available yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    dailySummary.map((day, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">
                          {day.transaction_date}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {day.source_record_count}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {day.settlement_record_count}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums font-medium">
                          {day.matched_count}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {day.amount_mismatch_count || "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {day.detail_mismatch_count || "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {day.missing_in_source_count || "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {day.missing_in_settlement_count || "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono tabular-nums">
                          {day.source_amount_total
                            ? `₹${Number(day.source_amount_total).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono tabular-nums">
                          {day.settlement_amount_total
                            ? `₹${Number(day.settlement_amount_total).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Exception status badge ─────────────────────────────────────────────────────

// Semantic color tokens using oklch (neutral Tailwind theme has no named palette)
const BADGE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  DUPLICATE_SOURCE:       { bg: "oklch(0.93 0.04 310)", text: "oklch(0.38 0.18 310)", border: "oklch(0.85 0.07 310)" },
  DUPLICATE_SETTLEMENT:   { bg: "oklch(0.93 0.04 310)", text: "oklch(0.38 0.18 310)", border: "oklch(0.85 0.07 310)" },
  AMOUNT_MISMATCH:        { bg: "oklch(0.96 0.06 85)",  text: "oklch(0.42 0.18 65)",  border: "oklch(0.88 0.10 75)"  },
  DETAIL_MISMATCH:        { bg: "oklch(0.95 0.06 50)",  text: "oklch(0.42 0.18 40)",  border: "oklch(0.87 0.10 45)"  },
  MISSING_IN_SETTLEMENT:  { bg: "oklch(0.93 0.05 240)", text: "oklch(0.38 0.18 240)", border: "oklch(0.85 0.08 240)" },
  MISSING_IN_SOURCE:      { bg: "oklch(0.93 0.05 220)", text: "oklch(0.40 0.14 220)", border: "oklch(0.85 0.08 220)" },
};

const INVALID_BADGE = { bg: "oklch(0.94 0.05 27)", text: "oklch(0.45 0.20 27)", border: "oklch(0.87 0.09 27)" };
const DEFAULT_BADGE = { bg: "var(--muted)", text: "var(--muted-foreground)", border: "var(--border)" };

function ExceptionBadge({ status }: { status: string }) {
  const isInvalid =
    status.startsWith("INVALID_") ||
    (status.startsWith("MISSING_") && !status.includes("SETTLEMENT") && !status.includes("SOURCE"));

  const token = BADGE_STYLES[status] ?? (isInvalid ? INVALID_BADGE : DEFAULT_BADGE);

  return (
    <span
      className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium"
      style={{ background: token.bg, color: token.text, borderColor: token.border }}
    >
      {status}
    </span>
  );
}

// ── Page export (wrapped in Suspense for useParams) ────────────────────────────

export default function RunDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <RunDetailContent />
    </Suspense>
  );
}
