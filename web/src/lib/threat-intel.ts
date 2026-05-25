import type { PolicyVerdict } from "@/lib/payment-policy-types";

export type ThreatType =
  | "approval_drain"
  | "phishing"
  | "seed_phrase_theft"
  | "unknown";

export type ThreatIntelResult = {
  recipientAddress: string;
  isFlagged: boolean;
  verdict: PolicyVerdict;
  confidence: "low" | "medium" | "high";
  reportCount: number;
  confirmationCount: number;
  maxSeverity: number;
  dominantThreatType: ThreatType;
  totalAmountLostUsd: number;
  matchedReportId?: string;
  aiSummary: string;
  matchedRules: string[];
};

type ThreatRecord = {
  reportId: string;
  address: string;
  threatType: ThreatType;
  severityScore: number;
  reportCount: number;
  confirmationCount: number;
  amountLostUsd: number;
  aiSummary: string;
};

export const DEMO_THREAT_ADDRESS = "0xa11ce0000000000000000000000000000000d3ad";

const THREAT_REGISTRY: ThreatRecord[] = [
  {
    reportId: "arkivgate-approval-drain-demo-001",
    address: DEMO_THREAT_ADDRESS,
    threatType: "approval_drain",
    severityScore: 8,
    reportCount: 2,
    confirmationCount: 9,
    amountLostUsd: 0,
    aiSummary:
      "Recipient is associated with active approval-drain style interactions. Avoid signing unlimited approvals or deposit flows with this contract.",
  },
  {
    reportId: "ag-phishing-bridge-002",
    address: "0x111111125421ca6dc452d289314280a0f8842a65",
    threatType: "phishing",
    severityScore: 5,
    reportCount: 1,
    confirmationCount: 2,
    amountLostUsd: 420,
    aiSummary:
      "Recipient has weak community signal for phishing-like routing. Require manual review before allowing material transfers.",
  },
];

export function normalizeAddress(value?: string | null): string {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return /^0x[a-f0-9]{40}$/.test(trimmed) ? trimmed : "";
}

export function evaluateThreatIntel(recipientAddress?: string | null): ThreatIntelResult {
  const normalized = normalizeAddress(recipientAddress);
  const record = THREAT_REGISTRY.find((item) => item.address.toLowerCase() === normalized);

  if (!normalized) {
    return {
      recipientAddress: "",
      isFlagged: false,
      verdict: "PASS",
      confidence: "low",
      reportCount: 0,
      confirmationCount: 0,
      maxSeverity: 0,
      dominantThreatType: "unknown",
      totalAmountLostUsd: 0,
      aiSummary: "No recipient address supplied for threat-intel lookup.",
      matchedRules: [],
    };
  }

  if (!record) {
    return {
      recipientAddress: normalized,
      isFlagged: false,
      verdict: "PASS",
      confidence: "low",
      reportCount: 0,
      confirmationCount: 0,
      maxSeverity: 0,
      dominantThreatType: "unknown",
      totalAmountLostUsd: 0,
      aiSummary: "No active ArkivGate threat report matched this recipient.",
      matchedRules: [],
    };
  }

  const verdict =
    record.severityScore >= 8 || record.confirmationCount >= 5 ? "BLOCK" : "WARN";

  return {
    recipientAddress: normalized,
    isFlagged: true,
    verdict,
    confidence: record.confirmationCount >= 5 ? "high" : "medium",
    reportCount: record.reportCount,
    confirmationCount: record.confirmationCount,
    maxSeverity: record.severityScore,
    dominantThreatType: record.threatType,
    totalAmountLostUsd: record.amountLostUsd,
    matchedReportId: record.reportId,
    aiSummary: record.aiSummary,
    matchedRules: [`threat-intel:${record.threatType}`, `threat-report:${record.reportId}`],
  };
}
