"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { uploadFiles, triggerRun } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

type Step = "idle" | "uploading" | "running" | "done" | "error";

export default function NewRunPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [settlementFile, setSettlementFile] = useState<File | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  const srcRef = useRef<HTMLInputElement>(null);
  const setRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceFile || !settlementFile) {
      setError("Please select both files.");
      return;
    }
    setError(null);

    try {
      // Step 1: Upload
      setStep("uploading");
      setProgress(20);
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
      setTimeout(() => router.push(`/runs/${run.run_id}`), 1200);
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

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">New Reconciliation Run</h1>
        <p className="text-muted-foreground text-sm">
          Upload your transaction source and settlement CSV files to start a reconciliation pipeline run.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload CSV Files</CardTitle>
          <CardDescription className="text-sm">
            Both files must contain columns:{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              transaction_id, account_id, transaction_date, amount, currency, transaction_type
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Source file */}
            <div className="space-y-1.5">
              <Label htmlFor="source">Transaction Source File</Label>
              <Input
                id="source"
                ref={srcRef}
                type="file"
                accept=".csv"
                disabled={busy}
                onChange={(e) => setSourceFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">transactions.csv</p>
            </div>

            <Separator />

            {/* Settlement file */}
            <div className="space-y-1.5">
              <Label htmlFor="settlement">Settlement File</Label>
              <Input
                id="settlement"
                ref={setRef}
                type="file"
                accept=".csv"
                disabled={busy}
                onChange={(e) => setSettlementFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">settlement.csv</p>
            </div>

            {/* Progress */}
            {busy && (
              <div className="space-y-1.5">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">
                  {step === "uploading" ? "Uploading files…" : "Triggering pipeline run…"}
                </p>
              </div>
            )}

            {/* Success */}
            {step === "done" && runId && (
              <Alert>
                <span className="text-sm">
                  Run started! Redirecting to{" "}
                  <span className="font-mono text-xs">{runId}</span>…
                </span>
              </Alert>
            )}

            {/* Error */}
            {step === "error" && error && (
              <Alert>
                <span className="text-sm text-destructive">{error}</span>
              </Alert>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50 disabled:pointer-events-none"
            >
              {busy ? "Processing…" : "Upload & Run Reconciliation"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
