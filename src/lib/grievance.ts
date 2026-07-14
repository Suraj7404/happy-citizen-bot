// Shared domain data for the Smart Grievance Router.
// Categories, department mapping, SLAs, and resolution templates.

export type Priority = "High" | "Medium" | "Low";
export type Status = "Open" | "In-Progress" | "Resolved";
export type RoutingDecision = "AUTO-APPROVED" | "HUMAN-REVIEW" | "OVERRIDDEN";

export const CATEGORIES = [
  "Pension & Retirement",
  "Land & Housing",
  "Financial Services",
  "Public Infrastructure",
  "Healthcare",
  "Education",
  "Employment & Labour",
  "Taxation & Revenue",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CONFIDENCE_THRESHOLD = 0.75;

export const DEPARTMENT_MAP: Record<Category, { department: string; slaDays: number }> = {
  "Pension & Retirement":  { department: "Ministry of Personnel, PG & Pensions", slaDays: 30 },
  "Land & Housing":        { department: "Ministry of Housing & Urban Affairs", slaDays: 45 },
  "Financial Services":    { department: "Ministry of Finance / RBI", slaDays: 21 },
  "Public Infrastructure": { department: "Ministry of Road Transport & Highways", slaDays: 60 },
  "Healthcare":            { department: "Ministry of Health & Family Welfare", slaDays: 30 },
  "Education":             { department: "Ministry of Education", slaDays: 30 },
  "Employment & Labour":   { department: "Ministry of Labour & Employment", slaDays: 45 },
  "Taxation & Revenue":    { department: "Central Board of Direct Taxes (CBDT)", slaDays: 30 },
};

export const RESOLUTION_STEPS: Record<Category, string[]> = {
  "Pension & Retirement": [
    "Verify pensioner ID and service record",
    "Cross-check disbursement history with bank",
    "Escalate to Pension Disbursing Authority",
    "Notify citizen with resolution timeline",
  ],
  "Land & Housing": [
    "Fetch land/property records from registry",
    "Schedule field verification by revenue officer",
    "Update mutation/allotment status",
    "Send outcome letter to complainant",
  ],
  "Financial Services": [
    "Retrieve transaction and account details",
    "Coordinate with concerned bank branch",
    "Initiate reversal or file RBI CMS ticket",
    "Confirm resolution via SMS/email",
  ],
  "Public Infrastructure": [
    "Log location on PWD/NHAI works dashboard",
    "Assign junior engineer for site inspection",
    "Raise work order for repair/construction",
    "Close ticket after citizen re-verification",
  ],
  "Healthcare": [
    "Route to concerned CMO / hospital administrator",
    "Verify patient records and identify service gap",
    "Take corrective action on staff/supply/process",
    "Feedback call to complainant",
  ],
  "Education": [
    "Forward to concerned school or university authority",
    "Verify records (admission, scholarship, exam)",
    "Direct corrective action and issue advisory",
    "Update citizen on portal",
  ],
  "Employment & Labour": [
    "Register grievance on SHRAM SUVIDHA / EPFO portal",
    "Verify employer and establishment records",
    "Initiate inspection or claim settlement",
    "Communicate outcome to worker",
  ],
  "Taxation & Revenue": [
    "Pull assessee record from CPC",
    "Reconcile refund and demand ledger",
    "Route to jurisdictional AO for rectification",
    "Send intimation u/s 143(1) or refund confirmation",
  ],
};

export interface ClassifyResponse {
  category: Category;
  priority: Priority;
  status: Status;
  confidence: number;
}

export interface AuditRecord {
  id: string;
  complaintText: string;
  category: Category;
  priority: Priority;
  status: Status;
  confidence: number;
  routingDecision: RoutingDecision;
  department: string;
  slaDays: number;
  officer?: string;
  timestamp: string; // ISO
}

export interface ReviewItem {
  id: string;
  complaintText: string;
  tentativeCategory: Category;
  priority: Priority;
  confidence: number;
  timestamp: string;
}

export interface AnalyticsSnapshot {
  totalComplaints: number;
  autoApprovedPct: number;
  averageConfidence: number;
  averageAccuracy: number; // 0..1, classifier accuracy vs. reviewed ground truth
  averageSlaDays: number;
  perCategory: { category: string; count: number }[];
  priorityDistribution: { name: Priority; value: number }[];
  confusion: {
    labels: Category[];
    matrix: number[][]; // matrix[trueIdx][predictedIdx]
  };
}

export function priorityToneClass(priority: Priority): string {
  switch (priority) {
    case "High":
      return "bg-priority-high text-priority-high-foreground";
    case "Medium":
      return "bg-priority-medium text-priority-medium-foreground";
    case "Low":
      return "bg-priority-low text-priority-low-foreground";
  }
}