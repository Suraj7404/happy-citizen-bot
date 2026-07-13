import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  priorityToneClass,
  type AuditRecord,
  type RoutingDecision,
} from "@/lib/grievance";
import { ensureSeeded, getAuditLog } from "@/lib/mock-api";
import { useAuditVersion } from "@/lib/use-store";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit Log · Smart Grievance Router" },
      {
        name: "description",
        content: "Chronological audit log of every processed complaint and routing decision.",
      },
    ],
  }),
  component: AuditLogPage,
});

function decisionBadge(d: RoutingDecision) {
  if (d === "AUTO-APPROVED")
    return <Badge className="bg-success text-success-foreground hover:bg-success">Auto-Approved</Badge>;
  if (d === "OVERRIDDEN")
    return <Badge className="bg-accent text-accent-foreground hover:bg-accent">Overridden</Badge>;
  return (
    <Badge className="bg-warning text-warning-foreground hover:bg-warning">Human Review</Badge>
  );
}

function AuditLogPage() {
  const [records, setRecords] = useState<AuditRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const version = useAuditVersion();

  useEffect(() => {
    ensureSeeded();
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAuditLog()
      .then((d) => {
        if (!cancelled) setRecords(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load audit log");
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const filtered = useMemo(() => {
    if (!records) return [];
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.complaintText.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q),
    );
  }, [records, query]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Audit Log</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every classified complaint, in reverse-chronological order.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search complaint, category, department…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {records ? `${filtered.length} record${filtered.length === 1 ? "" : "s"}` : "Records"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {records === null && (
            <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading audit log…
            </div>
          )}
          {error && <div className="p-8 text-sm text-destructive">Failed to load: {error}</div>}
          {records && filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No matching records.</div>
          )}
          {records && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Complaint</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Conf.</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Officer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {new Date(r.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="font-mono text-[10px] text-muted-foreground">{r.id}</div>
                        <div className="mt-0.5 truncate text-sm text-foreground" title={r.complaintText}>
                          {r.complaintText.length > 80
                            ? r.complaintText.slice(0, 80) + "…"
                            : r.complaintText}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{r.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={priorityToneClass(r.priority)}>{r.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.status}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {Math.round(r.confidence * 100)}%
                      </TableCell>
                      <TableCell>{decisionBadge(r.routingDecision)}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-sm" title={r.department}>
                        {r.department}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.officer ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}