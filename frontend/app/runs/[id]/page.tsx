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
} from "recharts";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "SUCCESS") return "default";
  if (status === "FAILED") return "destructive";
  if (status === "RUNNING") return "secondary";
  return "outline";
}

function exceptionBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "AMOUNT_MISMATCH" || status === "DETAIL_MISMATCH") return "secondary";
  if (status.startsWith("DUPLICATE")) return "destructive";
  if (status.startsWith("MISSING")) return "outline";
  if (status.startsWith("INVALID") || status.startsWith("MISSING_ACCOUNT")) return "destructive";
  return "outline";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function StatCard({ label, value }: { label: string; value: number | null }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {value === null ? (
          <Skeleton className="h-6 w-10" />
        ) : (
          <span className="text-xl font-bold">{value}</span>
        )}
      </CardContent>
    </Card>
  );
}

// Chart Configurations using default shadcn theme variables
const outcomeChartConfig = {
  count: {
    label: "Records",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const dailyVolumeChartConfig = {
  source: {
    label: "Source",
    color: "var(--chart-1)",
  },
  settlement: {
    label: "Settlement",
    color: "var(--chart-2)",
  },
  matched: {
    label: "Matched",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

const dailyAmountChartConfig = {
  sourceAmount: {
    label: "Source (INR)",
    color: "var(--chart-1)",
  },
  settlementAmount: {
    label: "Settlement (INR)",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

function RunDetailContent() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
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

    // Poll every 3s while run is RUNNING
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

  // Prepared chart data
  const outcomeData = run
    ? [
        { category: "Matched", count: run.matched_count ?? 0, fill: "var(--chart-1)" },
        { category: "Amt Mismatch", count: run.amount_mismatch_count ?? 0, fill: "var(--chart-2)" },
        { category: "Detail Mismatch", count: run.detail_mismatch_count ?? 0, fill: "var(--chart-3)" },
        { category: "Missing in Set", count: run.missing_in_settlement_count ?? 0, fill: "var(--chart-4)" },
        { category: "Missing in Src", count: run.missing_in_source_count ?? 0, fill: "var(--chart-5)" },
        { category: "Invalid Rows", count: run.validation_error_count ?? 0, fill: "var(--destructive)" },
        { category: "Duplicates", count: run.duplicate_id_count ?? 0, fill: "var(--destructive)" },
      ]
    : [];

  const dailyVolumeData = dailySummary.map((d) => ({
    date: d.transaction_date.slice(5), // MM-DD for cleaner ticks
    fullDate: d.transaction_date,
    source: d.source_record_count,
    settlement: d.settlement_record_count,
    matched: d.matched_count,
  }));

  const dailyAmountData = dailySummary.map((d) => ({
    date: d.transaction_date.slice(5),
    fullDate: d.transaction_date,
    sourceAmount: Number(d.source_amount_total ?? 0),
    settlementAmount: Number(d.settlement_amount_total ?? 0),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Run Detail</h1>
          {run ? (
            <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
          ) : (
            <Skeleton className="h-5 w-20" />
          )}
        </div>
        {loading ? (
          <Skeleton className="h-4 w-64" />
        ) : (
          <p className="text-muted-foreground text-xs font-mono">{id}</p>
        )}
      </div>

      {/* Meta */}
      {run && (
        <Card>
          <CardContent className="py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Source File</p>
              <p className="font-medium">{run.source_file}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Settlement File</p>
              <p className="font-medium">{run.settlement_file}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Started</p>
              <p className="font-medium">{formatDate(run.started_at)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="font-medium">{formatDate(run.completed_at)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {run?.error_message && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <strong>Error:</strong> {run.error_message}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
        {[
          { label: "Src Rows", value: run?.source_rows ?? null },
          { label: "Set Rows", value: run?.settlement_rows ?? null },
          { label: "Matched", value: run?.matched_count ?? null },
          { label: "Amt Mismatch", value: run?.amount_mismatch_count ?? null },
          { label: "Detail Mismatch", value: run?.detail_mismatch_count ?? null },
          { label: "Missing in Set", value: run?.missing_in_settlement_count ?? null },
          { label: "Missing in Src", value: run?.missing_in_source_count ?? null },
          { label: "Invalid", value: run?.validation_error_count ?? null },
          { label: "Duplicates", value: run?.duplicate_id_count ?? null },
        ].map(({ label, value }) => (
          <StatCard key={label} label={label} value={value} />
        ))}
      </div>

      <Separator />

      {/* Visual Charts & Graphs Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Visual Analysis</h2>
          <p className="text-xs text-muted-foreground">
            Graphical breakdown of reconciliation outcomes and daily settlement trends.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Outcome Breakdown Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Reconciliation Outcomes Breakdown
              </CardTitle>
              <CardDescription className="text-xs">
                Distribution of matched vs exception categories.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[260px] w-full" />
              ) : (
                <ChartContainer
                  config={outcomeChartConfig}
                  className="h-[260px] w-full"
                >
                  <BarChart
                    data={outcomeData}
                    layout="vertical"
                    margin={{ left: 16, right: 16, top: 8, bottom: 8 }}
                  >
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" />
                    <YAxis
                      dataKey="category"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      width={95}
                      className="text-[11px]"
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" radius={4} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Daily Record Volume Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Daily Transaction Volume
              </CardTitle>
              <CardDescription className="text-xs">
                Comparison of source, settlement, and matched records per date.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[260px] w-full" />
              ) : dailyVolumeData.length === 0 ? (
                <div className="h-[260px] flex items-center justify-center text-xs text-muted-foreground">
                  No daily data available
                </div>
              ) : (
                <ChartContainer
                  config={dailyVolumeChartConfig}
                  className="h-[260px] w-full"
                >
                  <BarChart
                    data={dailyVolumeData}
                    margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis tickLine={false} axisLine={false} width={30} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="source" fill="var(--color-source)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="settlement" fill="var(--color-settlement)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="matched" fill="var(--color-matched)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Daily Amount Trend (Full width on large screens) */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Financial Amount Reconciliation Trend (INR)
              </CardTitle>
              <CardDescription className="text-xs">
                Total transacted currency amounts between source and settlement across dates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[240px] w-full" />
              ) : dailyAmountData.length === 0 ? (
                <div className="h-[240px] flex items-center justify-center text-xs text-muted-foreground">
                  No financial data available
                </div>
              ) : (
                <ChartContainer
                  config={dailyAmountChartConfig}
                  className="h-[240px] w-full"
                >
                  <LineChart
                    data={dailyAmountData}
                    margin={{ left: 16, right: 16, top: 8, bottom: 8 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={65}
                      tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <div className="flex items-center justify-between gap-2 w-full">
                              <span className="text-muted-foreground">{name}:</span>
                              <span className="font-mono font-medium">
                                ₹{Number(value).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line
                      type="monotone"
                      dataKey="sourceAmount"
                      stroke="var(--color-sourceAmount)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="settlementAmount"
                      stroke="var(--color-settlementAmount)"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Tables Tabs */}
      <Tabs defaultValue="exceptions">
        <TabsList>
          <TabsTrigger value="exceptions">
            Exceptions ({exceptions.length})
          </TabsTrigger>
          <TabsTrigger value="daily">
            Daily Summary ({dailySummary.length} dates)
          </TabsTrigger>
        </TabsList>

        {/* Exceptions tab */}
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
                    <TableHead>Src Amount</TableHead>
                    <TableHead>Set Amount</TableHead>
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
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No exceptions found for this run.
                      </TableCell>
                    </TableRow>
                  ) : (
                    exceptions.map((exc, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{exc.transaction_id || "—"}</TableCell>
                        <TableCell className="text-xs">{exc.source || "—"}</TableCell>
                        <TableCell className="text-xs">{exc.source_row_number ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={exceptionBadgeVariant(exc.status)} className="text-xs">
                            {exc.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{exc.source_amount ?? "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{exc.settlement_amount ?? "—"}</TableCell>
                        <TableCell className="text-xs">{exc.mismatch_fields ?? "—"}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate" title={exc.reason ?? ""}>
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

        {/* Daily summary tab */}
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
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        No daily summary data available yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    dailySummary.map((day, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{day.transaction_date}</TableCell>
                        <TableCell className="text-right text-xs">{day.source_record_count}</TableCell>
                        <TableCell className="text-right text-xs">{day.settlement_record_count}</TableCell>
                        <TableCell className="text-right text-xs">{day.matched_count}</TableCell>
                        <TableCell className="text-right text-xs">{day.amount_mismatch_count}</TableCell>
                        <TableCell className="text-right text-xs">{day.detail_mismatch_count}</TableCell>
                        <TableCell className="text-right text-xs">{day.missing_in_source_count}</TableCell>
                        <TableCell className="text-right text-xs">{day.missing_in_settlement_count}</TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {day.source_amount_total ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {day.settlement_amount_total ?? "—"}
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

export default function RunDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <RunDetailContent />
    </Suspense>
  );
}
