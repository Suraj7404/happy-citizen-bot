import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CheckCircle2, ClipboardList, Gauge, Languages, Target } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureSeeded, getAnalytics } from "@/lib/mock-api";
import { useAuditVersion } from "@/lib/use-store";
import type { AnalyticsSnapshot } from "@/lib/grievance";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics · Smart Grievance Router" },
      {
        name: "description",
        content:
          "Dashboard of complaint volume by category, priority mix, auto-approval rate and SLA.",
      },
    ],
  }),
  component: AnalyticsPage,
});

const PRIORITY_COLORS: Record<string, string> = {
  High: "var(--priority-high)",
  Medium: "var(--priority-medium)",
  Low: "var(--priority-low)",
};

function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const version = useAuditVersion();

  useEffect(() => {
    ensureSeeded();
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAnalytics()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load analytics");
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Analytics Dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Real-time overview of complaint volume, priority mix, and classifier performance.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<ClipboardList className="h-4 w-4" />}
          label="Total Complaints"
          value={data ? data.totalComplaints.toLocaleString() : "—"}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Auto-Approved"
          value={data ? `${data.autoApprovedPct}%` : "—"}
          tone="success"
        />
        <StatCard
          icon={<Target className="h-4 w-4" />}
          label="Classification Accuracy"
          value={data ? `${Math.round(data.averageAccuracy * 100)}%` : "—"}
          tone="success"
        />
        <StatCard
          icon={<Gauge className="h-4 w-4" />}
          label="Avg Confidence"
          value={data ? `${Math.round(data.averageConfidence * 100)}%` : "—"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Complaints per Category</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {data && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.perCategory}
                  margin={{ top: 10, right: 12, left: -8, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Priority Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {data && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.priorityDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {data.priorityDistribution.map((entry) => (
                      <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {data && <ConfusionMatrixCard data={data} />}
      {data && <MetricsCard data={data} />}
      {data && <LanguageCard data={data} />}
    </div>
  );
}

function MetricsCard({ data }: { data: AnalyticsSnapshot }) {
  const { metrics } = data;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const rows = [
    { label: "Macro avg", p: metrics.macroPrecision, r: metrics.macroRecall, f: metrics.macroF1 },
    { label: "Weighted avg", p: metrics.weightedPrecision, r: metrics.weightedRecall, f: metrics.weightedF1 },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Classifier Metrics</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Precision, recall and F1 per category — derived from the multilingual confusion matrix.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <MiniStat label="Accuracy" value={pct(metrics.accuracy)} />
          <MiniStat label="Macro F1" value={pct(metrics.macroF1)} />
          <MiniStat label="Weighted F1" value={pct(metrics.weightedF1)} tone="success" />
          <MiniStat label="Weighted Precision" value={pct(metrics.weightedPrecision)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-2 font-medium">Category</th>
                <th className="p-2 font-medium text-right">Precision</th>
                <th className="p-2 font-medium text-right">Recall</th>
                <th className="p-2 font-medium text-right">F1</th>
                <th className="p-2 font-medium text-right">Support</th>
              </tr>
            </thead>
            <tbody>
              {metrics.perClass.map((c) => (
                <tr key={c.category} className="border-b border-border/60">
                  <td className="p-2 text-foreground">{c.category}</td>
                  <td className="p-2 text-right font-mono">{pct(c.precision)}</td>
                  <td className="p-2 text-right font-mono">{pct(c.recall)}</td>
                  <td className="p-2 text-right font-mono">{pct(c.f1)}</td>
                  <td className="p-2 text-right font-mono text-muted-foreground">{c.support}</td>
                </tr>
              ))}
              {rows.map((row) => (
                <tr key={row.label} className="bg-muted/40 font-medium">
                  <td className="p-2">{row.label}</td>
                  <td className="p-2 text-right font-mono">{pct(row.p)}</td>
                  <td className="p-2 text-right font-mono">{pct(row.r)}</td>
                  <td className="p-2 text-right font-mono">{pct(row.f)}</td>
                  <td className="p-2 text-right font-mono text-muted-foreground">
                    {metrics.perClass.reduce((s, c) => s + c.support, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function LanguageCard({ data }: { data: AnalyticsSnapshot }) {
  const total = data.languageDistribution.reduce((s, l) => s + l.value, 0);
  const sorted = [...data.languageDistribution].sort((a, b) => b.value - a.value);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Languages className="h-4 w-4 text-primary" />
          Detected Languages
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Distribution of complaint languages classified by the multilingual model.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 && (
          <p className="text-sm text-muted-foreground">No complaints yet.</p>
        )}
        {sorted.map((l) => {
          const pct = total === 0 ? 0 : Math.round((l.value / total) * 100);
          return (
            <div key={l.language} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">
                  {l.label}{" "}
                  <span className="text-muted-foreground">({l.language.toUpperCase()})</span>
                </span>
                <span className="font-mono text-muted-foreground">
                  {l.value} · {pct}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  const cls = tone === "success" ? "text-success" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function ConfusionMatrixCard({ data }: { data: AnalyticsSnapshot }) {
  const labels = data.confusion?.labels ?? [];
  const sourceMatrix = data.confusion?.matrix ?? [];
  const matrix = labels.map((_, r) =>
    labels.map((_, c) => Number(sourceMatrix[r]?.[c] ?? 0)),
  );
  const rowTotals = matrix.map((row) => row.reduce((s, v) => s + v, 0));
  const max = Math.max(1, ...matrix.flat());

  const shortLabel = (l: string) =>
    l
      .replace(/&/g, "&")
      .split(" ")
      .map((w) => (w.length > 4 ? w.slice(0, 4) : w))
      .join(" ");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Confusion Matrix</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Rows are true categories, columns are predicted. Diagonal cells are correct
          classifications; darker cells indicate higher counts.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card p-2 text-left font-medium text-muted-foreground">
                True ↓ / Pred →
              </th>
              {labels.map((l) => (
                <th
                  key={l}
                  className="p-2 text-center font-medium text-muted-foreground"
                  title={l}
                >
                  <div className="mx-auto max-w-[72px] leading-tight">{shortLabel(l)}</div>
                </th>
              ))}
              <th className="p-2 text-center font-medium text-muted-foreground">Recall</th>
            </tr>
          </thead>
          <tbody>
            {labels.map((rowLabel, r) => {
              const total = rowTotals[r];
              const correct = matrix[r]?.[r] ?? 0;
              const recall = total === 0 ? 0 : Math.round((correct / total) * 100);
              return (
                <tr key={rowLabel}>
                  <th
                    className="sticky left-0 z-10 bg-card p-2 text-left font-medium text-foreground"
                    title={rowLabel}
                  >
                    <div className="max-w-[160px] truncate">{rowLabel}</div>
                  </th>
                  {labels.map((colLabel, c) => {
                    const v = matrix[r]?.[c] ?? 0;
                    const intensity = v === 0 ? 0 : 0.12 + (v / max) * 0.78;
                    const diag = r === c;
                    const bg = diag
                      ? `color-mix(in oklch, var(--success) ${Math.round(intensity * 100)}%, transparent)`
                      : `color-mix(in oklch, var(--destructive) ${Math.round(intensity * 100)}%, transparent)`;
                    return (
                      <td
                        key={colLabel}
                        className="border border-border p-0 text-center"
                        title={`True: ${rowLabel} · Pred: ${colLabel} · ${v}`}
                      >
                        <div
                          className="grid h-10 w-full place-items-center font-mono text-xs"
                          style={{ background: bg }}
                        >
                          <span
                            className={
                              v === 0
                                ? "text-muted-foreground"
                                : intensity > 0.55
                                  ? "font-semibold text-foreground"
                                  : "text-foreground/80"
                            }
                          >
                            {v}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                  <td className="border border-border p-2 text-center font-mono text-xs text-muted-foreground">
                    {total === 0 ? "—" : `${recall}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-6 rounded-sm bg-success/60" />
            Correct (diagonal)
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-6 rounded-sm bg-destructive/50" />
            Misclassified
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "success";
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : "bg-primary/10 text-primary";
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${toneClass}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-0.5 text-2xl font-semibold text-foreground">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}