import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  Loader2,
  Send,
  ShieldAlert,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CONFIDENCE_THRESHOLD,
  DEPARTMENT_MAP,
  RESOLUTION_STEPS,
  priorityToneClass,
  type AuditRecord,
  type Category,
  type ClassifyResponse,
  type Priority,
  type ReviewItem,
} from "@/lib/grievance";
import { classifyBatch, classifyComplaint, ensureSeeded } from "@/lib/mock-api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Submit Complaint · Smart Grievance Router" },
      {
        name: "description",
        content:
          "Submit a citizen complaint and see the AI classification, department routing, and recommended resolution steps.",
      },
    ],
  }),
  component: SubmitComplaintPage,
});

interface ClassifyResult {
  classification: ClassifyResponse;
  auditRecord?: AuditRecord;
  queuedForReview?: ReviewItem;
  complaintText: string;
}

function SubmitComplaintPage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClassifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureSeeded();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const complaintText = text.trim();
    if (!complaintText) return;
    setLoading(true);
    setError(null);
    try {
      const res = await classifyComplaint(complaintText);
      setResult({ ...res, complaintText });
      toast.success(
        res.classification.confidence >= CONFIDENCE_THRESHOLD
          ? "Complaint auto-approved and routed"
          : "Complaint flagged for human review",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to classify complaint";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const SAMPLES = [
    "My pension has not been credited for the last 3 months. Please help urgently!",
    "Streetlights on MG Road are broken and there is a huge pothole near the bridge.",
    "Something is not right in my area, please look into it soon.",
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Submit a Complaint</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a citizen grievance below. The AI classifier assigns a category, priority, and
          department in under a second.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Complaint Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. My pension has not been credited for the last 3 months. Please help urgently!"
                rows={7}
                maxLength={2000}
                className="resize-none"
                aria-label="Complaint text"
                required
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {text.length}/2000 characters
                </div>
                <Button type="submit" disabled={loading || !text.trim()} className="gap-2">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Classify & Route
                </Button>
              </div>
              {error && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </form>

            <div className="mt-6 border-t border-border pt-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Try a sample
              </div>
              <div className="flex flex-wrap gap-2">
                {SAMPLES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setText(s)}
                    className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:bg-muted"
                  >
                    {s.length > 60 ? s.slice(0, 60) + "…" : s}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {!result && !loading && (
            <Card className="h-full border-dashed">
              <CardContent className="flex h-full min-h-64 flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-muted">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                Classification results will appear here after you submit a complaint.
              </CardContent>
            </Card>
          )}
          {loading && (
            <Card>
              <CardContent className="flex h-full min-h-64 flex-col items-center justify-center gap-3 p-8 text-sm text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                Analysing complaint…
              </CardContent>
            </Card>
          )}
          {result && <ClassificationCard result={result} />}
        </div>
      </div>

      {result && result.classification.confidence >= CONFIDENCE_THRESHOLD && (
        <div className="grid gap-6 lg:grid-cols-2">
          <DepartmentRoutingCard classification={result.classification} />
          <ResolutionStepsCard classification={result.classification} />
        </div>
      )}

      {result && result.classification.confidence < CONFIDENCE_THRESHOLD && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-warning/20 text-warning-foreground">
                <ShieldAlert className="h-5 w-5 text-warning" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-foreground">Sent to Officer Review Queue</div>
                <p className="text-sm text-muted-foreground">
                  Confidence is below {Math.round(CONFIDENCE_THRESHOLD * 100)}%. A human officer will
                  verify the category before routing.
                </p>
              </div>
            </div>
            <Button asChild variant="secondary" className="gap-2">
              <Link to="/review">Open Review Queue</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <BatchClassifyCard />
    </div>
  );
}

interface BatchRow {
  complaintText: string;
  category: Category;
  priority: Priority;
  confidence: number;
  routing: "AUTO-APPROVED" | "HUMAN-REVIEW";
  department: string;
}

function BatchClassifyCard() {
  const [batchText, setBatchText] = useState("");
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  function parseComplaints(raw: string): string[] {
    return raw
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*"|"\s*$/g, "").trim())
      .filter((l) => l.length > 0);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setBatchText(content);
    e.target.value = "";
  }

  async function runBatch() {
    const items = parseComplaints(batchText);
    if (items.length === 0) {
      toast.error("No complaints found. Paste one complaint per line.");
      return;
    }
    setLoading(true);
    setRows([]);
    setProgress(0);
    // Run the store update once so Analytics/Audit never refresh against a half-built batch.
    const out = classifyBatch(items);
    setProgress(100);
    // Cap the on-screen preview so rendering 2000 rows doesn't stall the page.
    setRows(out.slice(0, 500));
    setLoading(false);
    const flagged = out.filter((r) => r.routing === "HUMAN-REVIEW").length;
    toast.success(
      `Classified ${out.length} complaint${out.length === 1 ? "" : "s"} · ${flagged} flagged for review${out.length > 500 ? " · showing first 500" : ""}`,
    );
  }

  function downloadCsv() {
    const header = ["complaint", "category", "priority", "confidence", "routing", "department"];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          escape(r.complaintText),
          escape(r.category),
          escape(r.priority),
          r.confidence.toFixed(3),
          escape(r.routing),
          escape(r.department),
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grievance-batch-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const flaggedCount = rows.filter((r) => r.routing === "HUMAN-REVIEW").length;
  const approvedCount = rows.length - flaggedCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Batch Classify Dataset
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Paste multiple complaints (one per line) or upload a .txt / .csv file. Each row is
          classified, routed, and logged to the audit trail.
        </p>
        <Textarea
          value={batchText}
          onChange={(e) => setBatchText(e.target.value)}
          placeholder={"My pension has not been credited for 3 months\nStreetlights on MG Road are broken\nITR refund still pending for July filing"}
          rows={6}
          className="resize-none font-mono text-xs"
          aria-label="Batch complaints"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-muted">
              <Upload className="h-3.5 w-3.5" />
              Upload .txt / .csv
              <input
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                className="hidden"
                onChange={handleFile}
              />
            </label>
            <span className="text-xs text-muted-foreground">
              {parseComplaints(batchText).length} complaint(s) detected
            </span>
          </div>
          <div className="flex items-center gap-2">
            {rows.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={downloadCsv}>
                Export CSV
              </Button>
            )}
            <Button
              type="button"
              onClick={runBatch}
              disabled={loading || !batchText.trim()}
              className="gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Classify Batch
            </Button>
          </div>
        </div>

        {loading && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Processing…</span>
              <span className="font-mono">{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="flex flex-wrap gap-4 rounded-md border border-border bg-muted/40 p-3 text-xs">
              <div>
                <span className="text-muted-foreground">Total:</span>{" "}
                <span className="font-semibold text-foreground">{rows.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Auto-approved:</span>{" "}
                <span className="font-semibold text-success">{approvedCount}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Flagged for review:</span>{" "}
                <span className="font-semibold text-warning">{flaggedCount}</span>
              </div>
            </div>
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[38%]">Complaint</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Routing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="max-w-xs truncate text-sm" title={r.complaintText}>
                        {r.complaintText}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="whitespace-nowrap text-xs">
                          {r.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${priorityToneClass(r.priority)}`}>
                          {r.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {Math.round(r.confidence * 100)}%
                      </TableCell>
                      <TableCell>
                        {r.routing === "AUTO-APPROVED" ? (
                          <Badge className="gap-1 bg-success text-success-foreground hover:bg-success">
                            <CheckCircle2 className="h-3 w-3" />
                            Auto
                          </Badge>
                        ) : (
                          <Badge className="gap-1 bg-warning text-warning-foreground hover:bg-warning">
                            <ShieldAlert className="h-3 w-3" />
                            Review
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ClassificationCard({ result }: { result: ClassifyResult }) {
  const { classification } = result;
  const approved = classification.confidence >= CONFIDENCE_THRESHOLD;
  const confPct = Math.round(classification.confidence * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>Classification</span>
          {approved ? (
            <Badge className="gap-1 bg-success text-success-foreground hover:bg-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Auto-Approved
            </Badge>
          ) : (
            <Badge className="gap-1 bg-warning text-warning-foreground hover:bg-warning">
              <ShieldAlert className="h-3.5 w-3.5" />
              Human Review
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Category
          </div>
          <Badge variant="secondary" className="mt-1 text-sm font-medium">
            {classification.category}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Priority
            </div>
            <Badge className={`mt-1 ${priorityToneClass(classification.priority)}`}>
              {classification.priority}
            </Badge>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </div>
            <Badge variant="outline" className="mt-1">
              {classification.status}
            </Badge>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium uppercase tracking-wide text-muted-foreground">
              Confidence
            </span>
            <span className="font-mono font-medium text-foreground">{confPct}%</span>
          </div>
          <Progress value={confPct} />
        </div>
      </CardContent>
    </Card>
  );
}

function DepartmentRoutingCard({ classification }: { classification: ClassifyResponse }) {
  const info = DEPARTMENT_MAP[classification.category];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-5 w-5 text-primary" />
          Department Routing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Responsible Department
          </div>
          <div className="mt-1 text-base font-semibold text-foreground">{info.department}</div>
        </div>
        <div className="flex items-center gap-3 rounded-md bg-muted/60 p-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <span className="text-sm font-bold">{info.slaDays}</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">SLA</div>
            <div className="text-xs text-muted-foreground">
              Must resolve within {info.slaDays} days
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ResolutionStepsCard({ classification }: { classification: ClassifyResponse }) {
  const steps = RESOLUTION_STEPS[classification.category];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          Recommended Resolution Steps
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span className="text-sm text-foreground/90">{step}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
