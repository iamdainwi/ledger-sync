"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listRuns, type RunListItem } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "SUCCESS") return "default";
  if (status === "FAILED") return "destructive";
  return "secondary";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

const runStatusChartConfig = {
  count: {
    label: "Runs",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export default function DashboardPage() {
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRuns()
      .then(setRuns)
      .catch(() => setError("Could not connect to the backend. Is it running?"))
      .finally(() => setLoading(false));
  }, []);

  const total = runs.length;
  const successful = runs.filter((r) => r.status === "SUCCESS").length;
  const failed = runs.filter((r) => r.status === "FAILED").length;
  const running = runs.filter((r) => r.status === "RUNNING").length;
  const recent = runs.slice(0, 5);

  const statusChartData = [
    { status: "Successful", count: successful, fill: "var(--chart-1)" },
    { status: "Running", count: running, fill: "var(--chart-2)" },
    { status: "Failed", count: failed, fill: "var(--destructive)" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Overview of reconciliation pipeline runs.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Runs", value: total },
          { label: "Successful", value: successful },
          { label: "Failed", value: failed },
          { label: "Running", value: running },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <span className="text-2xl font-bold">{value}</span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Graphical overview of execution health if runs exist */}
      {!loading && runs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Execution Health</CardTitle>
            <CardDescription className="text-xs">
              Status distribution across all recorded reconciliation executions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={runStatusChartConfig}
              className="h-[180px] w-full"
            >
              <BarChart
                data={statusChartData}
                layout="vertical"
                margin={{ left: 16, right: 16, top: 8, bottom: 8 }}
              >
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  dataKey="status"
                  type="category"
                  tickLine={false}
                  axisLine={false}
                  width={85}
                  className="text-xs"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Recent runs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Runs</h2>
          <div className="flex gap-2">
            <Link
              href="/runs"
              className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-muted"
            >
              View All
            </Link>
            <Link
              href="/run"
              className="inline-flex h-7 items-center rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              New Run
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No runs yet.{" "}
              <Link href="/run" className="underline underline-offset-4">
                Start your first reconciliation run
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recent.map((run) => (
              <Card key={run.run_id} className="hover:bg-muted/30 transition-colors">
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-mono truncate text-muted-foreground">
                      {run.run_id}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {run.source_file} ↔ {run.settlement_file}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(run.started_at)}
                    </span>
                    <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                    <Link
                      href={`/runs/${run.run_id}`}
                      className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-muted"
                    >
                      Details
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
