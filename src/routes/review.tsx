import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CATEGORIES,
  priorityToneClass,
  type Category,
  type ReviewItem,
} from "@/lib/grievance";
import { ensureSeeded, getReviewQueue, resolveReviewItem } from "@/lib/mock-api";
import { useReviewVersion } from "@/lib/use-store";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Officer Review Queue · Smart Grievance Router" },
      {
        name: "description",
        content:
          "Review complaints flagged by the AI classifier — approve or override the predicted category.",
      },
    ],
  }),
  component: ReviewQueuePage,
});

function ReviewQueuePage() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [overrideCat, setOverrideCat] = useState<Record<string, Category>>({});
  const version = useReviewVersion();

  useEffect(() => {
    ensureSeeded();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getReviewQueue()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load queue");
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  async function handle(id: string, action: "approve" | "override") {
    setBusyId(id);
    try {
      const newCat = overrideCat[id];
      if (action === "override" && !newCat) {
        toast.error("Pick a category before overriding");
        setBusyId(null);
        return;
      }
      await resolveReviewItem(id, action, newCat);
      toast.success(action === "approve" ? "Complaint approved" : "Category overridden");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Officer Review Queue</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Complaints where classifier confidence fell below 75%. Approve to accept the tentative
            category or override with the correct one.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5" />
          {items?.length ?? 0} pending
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending Reviews</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {items === null && (
            <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading review queue…
            </div>
          )}
          {error && (
            <div className="p-8 text-sm text-destructive">Failed to load: {error}</div>
          )}
          {items && items.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 p-12 text-center text-sm text-muted-foreground">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-success/10">
                <ShieldCheck className="h-5 w-5 text-success" />
              </div>
              All caught up. No complaints awaiting review.
            </div>
          )}
          {items && items.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[38%]">Complaint</TableHead>
                    <TableHead>Tentative Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const busy = busyId === item.id;
                    const conf = Math.round(item.confidence * 100);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="align-top">
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {item.id}
                          </div>
                          <div className="mt-1 max-w-md text-sm text-foreground">
                            {item.complaintText.length > 160
                              ? item.complaintText.slice(0, 160) + "…"
                              : item.complaintText}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="secondary">{item.tentativeCategory}</Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge className={priorityToneClass(item.priority)}>
                            {item.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <span className="font-mono text-sm text-warning-foreground">
                            {conf}%
                          </span>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Select
                              value={overrideCat[item.id]}
                              onValueChange={(v) =>
                                setOverrideCat((s) => ({ ...s, [item.id]: v as Category }))
                              }
                            >
                              <SelectTrigger className="h-8 w-[180px]">
                                <SelectValue placeholder="Override category…" />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORIES.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy || !overrideCat[item.id]}
                              onClick={() => handle(item.id, "override")}
                            >
                              Override
                            </Button>
                            <Button
                              size="sm"
                              className="bg-success text-success-foreground hover:bg-success/90"
                              disabled={busy}
                              onClick={() => handle(item.id, "approve")}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Approve"
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}