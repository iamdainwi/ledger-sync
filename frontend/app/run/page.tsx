"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { uploadFiles, triggerRun } from "@/lib/api";
import { Progress } from "@/components/ui/progress";

type Step = "idle" | "uploading" | "running" | "done" | "error";

interface FileDropzoneProps {
  id: string;
  label: string;
  expectedFilename: string;
  file: File | null;
  onFileSelect: (f: File | null) => void;
  disabled: boolean;
}

function FileDropzone({
  id,
  label,
  expectedFilename,
  file,
  onFileSelect,
  disabled,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.name.endsWith(".csv") || droppedFile.type === "text/csv")) {
      onFileSelect(droppedFile);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[13px] font-medium text-[var(--color-ink)]">
        <span>{label}</span>
        <span className="text-[11px] font-mono text-[var(--color-muted)]">{expectedFilename}</span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !file && inputRef.current?.click()}
        className={`group relative flex items-center justify-between gap-3 rounded-xl border border-dashed p-4 transition-all ${
          file
            ? "border-[var(--color-money)]/40 bg-[var(--color-money)]/5"
            : isDragging
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]/5 scale-[1.01]"
            : "border-[var(--color-line-strong)] hover:border-[var(--color-ink-2)] bg-[var(--color-soft)]/30 cursor-pointer"
        }`}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept=".csv"
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            onFileSelect(f);
          }}
        />

        {file ? (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="size-9 rounded-lg bg-[var(--color-money)]/15 grid place-items-center text-[var(--color-money)] shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[var(--color-ink)] truncate font-mono">
                {file.name}
              </p>
              <p className="text-[11px] text-[var(--color-muted)] tnum">
                {(file.size / 1024).toFixed(1)} KB · Ready to ingest
              </p>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onFileSelect(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-down)] px-2 py-1 rounded transition-colors"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3.5 w-full">
            <div className="size-9 rounded-lg bg-[var(--color-card)] border border-[var(--color-line)] grid place-items-center text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors shrink-0 shadow-[var(--shadow-card)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--color-ink)]">
                Choose CSV or drop file here
              </p>
              <p className="text-[11px] text-[var(--color-muted)]">
                Standard banking transaction format (.csv)
              </p>
            </div>
            <span className="inline-flex items-center rounded-lg border border-[var(--color-line)] bg-[var(--color-card)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-ink-2)] group-hover:bg-[var(--color-soft)] transition-colors shadow-[var(--shadow-card)]">
              Browse
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewRunPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [settlementFile, setSettlementFile] = useState<File | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceFile || !settlementFile) {
      setError("Please select both source and settlement CSV files.");
      return;
    }
    setError(null);

    try {
      // Step 1: Upload
      setStep("uploading");
      setProgress(25);
      const uploaded = await uploadFiles(sourceFile, settlementFile);
      setProgress(50);

      if (!uploaded.source_filename || !uploaded.settlement_filename) {
        throw new Error("Upload response missing filenames.");
      }

      // Step 2: Trigger run
      setStep("running");
      setProgress(75);
      const run = await triggerRun(uploaded.source_filename, uploaded.settlement_filename);
      setProgress(100);
      setRunId(run.run_id);
      setStep("done");

      // Navigate after a short delay
      setTimeout(() => router.push(`/runs/${run.run_id}`), 900);
    } catch (err: unknown) {
      setStep("error");
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? String(err)
          : String(err);
      setError(message);
    }
  }

  const busy = step === "uploading" || step === "running";
  const bothFilesReady = Boolean(sourceFile && settlementFile);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Breadcrumb & Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/"
              className="text-[12px] font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
            >
              Dashboard
            </Link>
            <span className="text-[12px] text-[var(--color-line-strong)]">/</span>
            <span className="text-[12px] font-medium text-[var(--color-ink-2)]">New Run</span>
          </div>
          <h1 className="text-[20px] font-semibold tracking-tight text-[var(--color-ink)]">
            New Reconciliation Run
          </h1>
          <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
            Ingest transaction source and settlement datasets to trigger ETL reconciliation.
          </p>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[var(--color-down)]/30 bg-[var(--color-down)]/10 px-4 py-3 text-[13px] text-[var(--color-down)]"
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* ── Main Two-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Left Column: Upload Form (7 cols) ── */}
        <div className="lg:col-span-7 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-card)] space-y-6">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">
              Upload Reconciliation Files
            </h2>
            <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
              Select or drop the two datasets to match against each other.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Source Dropzone */}
            <FileDropzone
              id="source-file"
              label="Transaction Source Dataset"
              expectedFilename="transactions.csv"
              file={sourceFile}
              onFileSelect={setSourceFile}
              disabled={busy}
            />

            {/* Settlement Dropzone */}
            <FileDropzone
              id="settlement-file"
              label="Settlement Dataset"
              expectedFilename="settlement.csv"
              file={settlementFile}
              onFileSelect={setSettlementFile}
              disabled={busy}
            />

            {/* Upload Progress State */}
            {busy && (
              <div className="space-y-2 rounded-xl bg-[var(--color-soft)]/50 p-4 border border-[var(--color-line)]">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-medium text-[var(--color-ink)]">
                    {step === "uploading" ? "Uploading CSV files…" : "Triggering reconciliation pipeline…"}
                  </span>
                  <span className="tnum font-semibold text-[var(--color-accent)]">{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            )}

            {/* Success Notification */}
            {step === "done" && runId && (
              <div className="flex items-center gap-2.5 rounded-xl border border-[var(--color-money)]/30 bg-[var(--color-money)]/10 p-3.5 text-[13px] text-[var(--color-money)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>
                  Pipeline started! Redirecting to run <span className="font-mono font-semibold">{runId.slice(0, 8)}</span>…
                </span>
              </div>
            )}

            {/* Submit Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={busy || !bothFilesReady}
                className="w-full inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 text-[13px] font-medium text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none shadow-sm"
              >
                {busy ? (
                  <>
                    <span className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Processing Pipeline…</span>
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                      <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
                    </svg>
                    <span>Run Reconciliation</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ── Right Column: Schema & Verification Rules (5 cols) ── */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)] space-y-4">
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--color-ink)]">
                Required CSV Schema
              </h3>
              <p className="text-[12px] text-[var(--color-muted)] mt-0.5">
                Both datasets must adhere to these 6 exact column headers:
              </p>
            </div>

            <div className="divide-y divide-[var(--color-line)] text-[12px]">
              {[
                { name: "transaction_id", desc: "Unique identifier (TX...)", req: "Required" },
                { name: "account_id", desc: "Account identifier (ACC...)", req: "Required" },
                { name: "transaction_date", desc: "ISO date format (YYYY-MM-DD)", req: "Required" },
                { name: "amount", desc: "Numeric value with max 2 decimals", req: "> 0.00" },
                { name: "currency", desc: "ISO currency code (INR, USD, EUR)", req: "3-letter" },
                { name: "transaction_type", desc: "Transaction direction (CREDIT, DEBIT)", req: "Enum" },
              ].map((col) => (
                <div key={col.name} className="py-2.5 flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[11px] font-semibold text-[var(--color-ink)] bg-[var(--color-soft)] px-1.5 py-0.5 rounded border border-[var(--color-line)]">
                      {col.name}
                    </span>
                    <p className="text-[11px] text-[var(--color-muted)] mt-0.5">{col.desc}</p>
                  </div>
                  <span className="text-[10px] font-medium text-[var(--color-muted)] shrink-0 tnum">
                    {col.req}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-card)] space-y-2">
            <h3 className="text-[13px] font-semibold text-[var(--color-ink)]">
              Reconciliation Pipeline Checks
            </h3>
            <ul className="text-[11px] text-[var(--color-muted)] space-y-1.5 list-disc list-inside">
              <li>Full schema validation and invalid row isolation</li>
              <li>Duplicate transaction ID detection within datasets</li>
              <li>Monetary amount mismatch tolerance checks</li>
              <li>Unsettled and missing transaction tagging</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
