import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  CONFIDENCE_THRESHOLD,
  DEPARTMENT_MAP,
  RESOLUTION_STEPS,
  priorityToneClass,
  type AuditRecord,
  type ClassifyResponse,
  type ReviewItem,
} from "@/lib/grievance";
import { classifyComplaint, ensureSeeded } from "@/lib/mock-api";

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
    </div>
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
