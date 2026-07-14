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
import { CheckCircle2, ClipboardList, Gauge, Target, Timer } from "lucide-react";

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
        <StatCard
          icon={<Timer className="h-4 w-4" />}
          label="Avg SLA (days)"
          value={data ? data.averageSlaDays.toString() : "—"}
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
    </div>
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