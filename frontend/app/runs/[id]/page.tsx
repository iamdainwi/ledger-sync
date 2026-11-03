"use client";

import { useEffect, useState, use } from "react";
import { getRun, getExceptions, getDailySummary, type RunSummary, type ExceptionRow, type DailySummaryRow } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
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

      {/* Tabs */}
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

