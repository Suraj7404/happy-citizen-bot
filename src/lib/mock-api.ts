// Mock API layer for the Smart Grievance Router.
//
// Every function mirrors a real REST endpoint and is designed to be a drop-in
// swap for `fetch("/api/...")` once the backend is connected. Swap the body
// of each function with the real fetch call — the shape of the returned data
// already matches the documented contract.
//
//   POST /api/classify        -> classifyComplaint(text)
//   GET  /api/review-queue    -> getReviewQueue()
//   POST /api/review/:id      -> resolveReviewItem(id, action)
//   GET  /api/analytics       -> getAnalytics()
//   GET  /api/audit-log       -> getAuditLog()

import {
  CATEGORIES,
  CONFIDENCE_THRESHOLD,
  DEPARTMENT_MAP,
  type AnalyticsSnapshot,
  type AuditRecord,
  type Category,
  type ClassifyResponse,
  type Priority,
  type ReviewItem,
  type RoutingDecision,
} from "./grievance";

// ---------- in-memory store ----------
const auditLog: AuditRecord[] = [];
const reviewQueue: ReviewItem[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const snapshot = {
  audit: () => auditLog as readonly AuditRecord[],
  review: () => reviewQueue as readonly ReviewItem[],
};

// ---------- helpers ----------
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now()
    .toString(36)
    .slice(-3)
    .toUpperCase()}`;
}

const KEYWORDS: Record<Category, string[]> = {
  "Pension & Retirement": ["pension", "retire", "epfo", "gratuity", "pensioner"],
  "Land & Housing": ["land", "plot", "house", "allotment", "mutation", "housing", "flat"],
  "Financial Services": ["bank", "loan", "atm", "upi", "account", "rbi", "transaction"],
  "Public Infrastructure": ["road", "pothole", "streetlight", "bridge", "drain", "water supply"],
  Healthcare: ["hospital", "doctor", "medicine", "clinic", "phc", "vaccine", "ambulance"],
  Education: ["school", "college", "scholarship", "exam", "teacher", "student"],
  "Employment & Labour": ["salary", "wage", "job", "employer", "labour", "worker", "unemployment"],
  "Taxation & Revenue": ["tax", "refund", "itr", "gst", "income tax", "assessment"],
};

function pickPriority(text: string): Priority {
  const t = text.toLowerCase();
  if (/(urgent|immediately|emergency|not received|dying|dangerous)/.test(t)) return "High";
  if (/(pending|delay|waiting|month)/.test(t)) return "Medium";
  return "Low";
}

function classifyLocally(text: string): ClassifyResponse {
  const lower = text.toLowerCase();
  const scores = CATEGORIES.map((cat) => {
    const hits = KEYWORDS[cat].reduce((sum, kw) => sum + (lower.includes(kw) ? 1 : 0), 0);
    return { cat, raw: hits + 0.05 };
  });
  const expSum = scores.reduce((s, x) => s + Math.exp(x.raw), 0);
  const withProb = scores.map((s) => ({ cat: s.cat, prob: Math.exp(s.raw) / expSum, hits: s.raw }));
  withProb.sort((a, b) => b.prob - a.prob);
  const top = withProb[0];

  // Calibrated so clear complaints average ~90–92% confidence.
  // Ambiguous complaints (no keyword hits) still fall below the review threshold.
  const confidence =
    top.hits < 0.5
      ? 0.35 + Math.random() * 0.25 // 0.35–0.60 → routed to human review
      : Math.min(0.94, 0.9 + (Math.random() * 0.02 - 0.005)); // ~0.895–0.915

  return {
    category: top.cat,
    priority: pickPriority(text),
    status: "Open",
    confidence: Number(confidence.toFixed(3)),
  };
}

function buildAuditRecord(
  text: string,
  cls: ClassifyResponse,
  decision: RoutingDecision,
  officer?: string,
): AuditRecord {
  const dept = DEPARTMENT_MAP[cls.category];
  return {
    id: newId("CMP"),
    complaintText: text,
    category: cls.category,
    priority: cls.priority,
    status: cls.status,
    confidence: cls.confidence,
    routingDecision: decision,
    department: dept.department,
    slaDays: dept.slaDays,
    officer,
    timestamp: new Date().toISOString(),
  };
}

// ---------- API surface ----------

// POST /api/classify
export async function classifyComplaint(
  complaintText: string,
): Promise<{ classification: ClassifyResponse; auditRecord?: AuditRecord; queuedForReview?: ReviewItem }> {
  await wait(600);
  const classification = classifyLocally(complaintText);

  if (classification.confidence < CONFIDENCE_THRESHOLD) {
    const item: ReviewItem = {
      id: newId("RVW"),
      complaintText,
      tentativeCategory: classification.category,
      priority: classification.priority,
      confidence: classification.confidence,
      timestamp: new Date().toISOString(),
    };
    reviewQueue.unshift(item);
    // Log the flagged event to the audit log as well.
    const rec = buildAuditRecord(complaintText, classification, "HUMAN-REVIEW");
    // Rewrite the audit record id to share the review item id for traceability.
    rec.id = item.id;
    auditLog.unshift(rec);
    emit();
    return { classification, queuedForReview: item };
  }

  const record = buildAuditRecord(complaintText, classification, "AUTO-APPROVED");
  auditLog.unshift(record);
  emit();
  return { classification, auditRecord: record };
}

// GET /api/review-queue
export async function getReviewQueue(): Promise<ReviewItem[]> {
  await wait(200);
  return [...reviewQueue];
}

// POST /api/review/:id
export async function resolveReviewItem(
  id: string,
  action: "approve" | "override",
  newCategory?: Category,
  officer = "Officer Sharma",
): Promise<AuditRecord | null> {
  await wait(300);
  const idx = reviewQueue.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const item = reviewQueue[idx];
  reviewQueue.splice(idx, 1);

  const chosenCategory: Category =
    action === "override" && newCategory ? newCategory : item.tentativeCategory;
  const dept = DEPARTMENT_MAP[chosenCategory];

  // Update the matching audit record (same id).
  const existing = auditLog.find((a) => a.id === id);
  if (existing) {
    existing.category = chosenCategory;
    existing.department = dept.department;
    existing.slaDays = dept.slaDays;
    existing.routingDecision = action === "override" ? "OVERRIDDEN" : "AUTO-APPROVED";
    existing.officer = officer;
    existing.status = "In-Progress";
    emit();
    return existing;
  }
  emit();
  return null;
}

// GET /api/analytics
export async function getAnalytics(): Promise<AnalyticsSnapshot> {
  await wait(150);
  const total = auditLog.length;
  const approved = auditLog.filter((a) => a.routingDecision !== "HUMAN-REVIEW").length;
  const avgConf =
    total === 0 ? 0 : auditLog.reduce((s, a) => s + a.confidence, 0) / total;
  const avgSla =
    total === 0 ? 0 : auditLog.reduce((s, a) => s + a.slaDays, 0) / total;

  const perCategoryMap = new Map<string, number>();
  for (const cat of CATEGORIES) perCategoryMap.set(cat, 0);
  for (const a of auditLog) perCategoryMap.set(a.category, (perCategoryMap.get(a.category) ?? 0) + 1);

  const priorityMap: Record<Priority, number> = { High: 0, Medium: 0, Low: 0 };
  for (const a of auditLog) priorityMap[a.priority]++;

  return {
    totalComplaints: total,
    autoApprovedPct: total === 0 ? 0 : Math.round((approved / total) * 100),
    averageConfidence: Number(avgConf.toFixed(2)),
    averageSlaDays: Number(avgSla.toFixed(1)),
    perCategory: [...perCategoryMap.entries()].map(([category, count]) => ({ category, count })),
    priorityDistribution: (["High", "Medium", "Low"] as Priority[]).map((name) => ({
      name,
      value: priorityMap[name],
    })),
  };
}

// GET /api/audit-log
export async function getAuditLog(): Promise<AuditRecord[]> {
  await wait(150);
  return [...auditLog];
}

// ---------- seed demo data so dashboards aren't empty on first load ----------
let seeded = false;
export function ensureSeeded() {
  if (seeded) return;
  seeded = true;
  const samples: string[] = [
    "My pension has not been credited for the last 3 months. Please help urgently!",
    "Streetlights on MG Road are broken and there is a huge pothole near the bridge.",
    "I filed my ITR in July but the income tax refund is still pending.",
    "The government hospital PHC in our village has no doctor and no medicine stock.",
    "Property mutation for my flat allotment has been stuck for 6 months.",
    "EPFO has not processed my provident fund withdrawal claim.",
    "Bank did not reverse a wrong UPI transaction from my account.",
    "School has not disbursed the scholarship money for this semester.",
    "Something is not right with the situation in my area, please look into it soon.",
    "There are some issues that need attention nearby, kindly do something.",
  ];
  for (const s of samples) {
    void classifyComplaint(s);
  }
}