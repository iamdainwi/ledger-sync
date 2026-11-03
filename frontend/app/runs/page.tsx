"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listRuns, type RunListItem } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_COLORS = {
  SUCCESS: "#0f7f57",
  RUNNING: "#c98a00",
  FAILED:  "#d23f45",
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
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {status}
    </span>
  );
}

export default function RunsPage() {
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRuns()
      .then(setRuns)
      .catch(() => setError("Failed to load run history"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-[var(--color-ink)]">
            Run History
          </h1>
          <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
            {runs.length} recorded {runs.length === 1 ? "execution" : "executions"}
          </p>
        </div>

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

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[var(--color-down)]/30 bg-[var(--color-down)]/10 px-4 py-3 text-[13px] text-[var(--color-down)]"
        >
          {error} — check backend connectivity.
        </div>
      )}

      {/* ── Table Card ── */}
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] shadow-[var(--shadow-card)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[var(--color-line)] hover:bg-transparent">
              <TableHead className="text-[12px] font-medium text-[var(--color-muted)]">Run ID</TableHead>
              <TableHead className="text-[12px] font-medium text-[var(--color-muted)]">Source File</TableHead>
              <TableHead className="text-[12px] font-medium text-[var(--color-muted)]">Settlement File</TableHead>
              <TableHead className="text-[12px] font-medium text-[var(--color-muted)]">Started</TableHead>
              <TableHead className="text-[12px] font-medium text-[var(--color-muted)]">Completed</TableHead>
              <TableHead className="text-[12px] font-medium text-[var(--color-muted)]">Status</TableHead>
              <TableHead className="text-right text-[12px] font-medium text-[var(--color-muted)]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(4)].map((_, i) => (
                <TableRow key={i} className="border-b border-[var(--color-line)]">
                  {[...Array(7)].map((__, j) => (
                    <TableCell key={j} className="py-3.5">
                      <Skeleton className="h-4 w-full rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : runs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-[13px] text-[var(--color-muted)] py-12">
                  No reconciliation runs yet.{" "}
                  <Link href="/run" className="text-[var(--color-accent)] underline underline-offset-4">
                    Start a new run
                  </Link>
                </TableCell>
              </TableRow>
            ) : (
              runs.map((run) => (
                <TableRow
                  key={run.run_id}
                  className="border-b border-[var(--color-line)] transition-colors hover:bg-[var(--color-soft)]/50"
                >
                  <TableCell className="font-mono text-[12px] font-semibold text-[var(--color-ink)] py-3.5">
                    <span title={run.run_id}>{run.run_id.slice(0, 8)}…</span>
                  </TableCell>
                  <TableCell className="text-[12px] text-[var(--color-ink-2)] py-3.5">
                    {run.source_file}
                  </TableCell>
                  <TableCell className="text-[12px] text-[var(--color-ink-2)] py-3.5">
                    {run.settlement_file}
                  </TableCell>
                  <TableCell className="text-[12px] text-[var(--color-muted)] tnum py-3.5">
                    {formatDate(run.started_at)}
                  </TableCell>
                  <TableCell className="text-[12px] text-[var(--color-muted)] tnum py-3.5">
                    {formatDate(run.completed_at)}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <StatusChip status={run.status} />
                  </TableCell>
                  <TableCell className="text-right py-3.5">
                    <Link
                      href={`/runs/${run.run_id}`}
                      className="inline-flex h-7 items-center rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] px-2.5 text-[11px] font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-soft)]"
                    >
                      Details →
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
