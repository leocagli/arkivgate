import { ACTION, ENTITY_TYPE, type ActionType, type SeverityType } from "./constants";
import { getArkivWalletClient } from "./client";
import {
  buildAgentEntity,
  buildPaymentReviewEntity,
  buildPolicyDecisionEntity,
  buildPolicyEntity,
  buildPromptReviewEntity,
  buildThreatConfirmationEntity,
  buildThreatReportEntity,
} from "./entities";
import { evaluatePromptRisk, promptHash, redactPrompt } from "./mappers";
import {
  entityExplorerUrl,
  fetchByEntityType,
  isHexIdentifier,
  maybeEntityExplorerUrl,
  transactionExplorerUrl,
} from "./queries";

export type PersistArkivAuditInput = {
  orgKey: string;
  traceId: string;
  model: string;
  prompt?: string;
  promptRedacted?: string;
  promptHash?: string;
  action?: ActionType | "PASS";
  severity?: SeverityType;
  reason?: string;
  matchedRules?: string[];
  riskScore?: number;
  policyKeyHint?: string;
  policySlugHint?: string;
  sessionKey?: string;
  agentKey?: string;
  agentPaymentRail?: "x402-demo" | "none";
  paymentPolicy?: {
    verdict: ActionType | "PASS";
    severity: SeverityType;
    riskScore: number;
    reason: string;
    matchedRules: string[];
    walletBalanceUsd?: number;
    transferUsd?: number;
    adjustedTransferUsd?: number;
    recentMaxTransferUsd?: number;
    perTxLimitUsd?: number;
    recipientRisk?: "low" | "unknown" | "high";
    recipientAddress?: string;
    threatIntel?: {
      isFlagged: boolean;
      confidence: "low" | "medium" | "high";
      reportCount: number;
      confirmationCount: number;
      maxSeverity: number;
      dominantThreatType: string;
      totalAmountLostUsd: number;
      matchedReportId?: string;
      aiSummary: string;
    };
  };
  latencyMs?: number;
  createdAt?: number;
};

export type PersistArkivAuditResult = {
  policyKey: string;
  promptReviewKey: string;
  policyDecisionKey: string;
  agentEntityKey: string;
  paymentReviewKey?: string;
  threatReportKey?: string;
  threatConfirmationKey?: string;
  policyTxHash?: string;
  agentTxHash: string;
  paymentReviewTxHash?: string;
  threatReportTxHash?: string;
  threatConfirmationTxHash?: string;
  promptReviewTxHash: string;
  policyDecisionTxHash: string;
  explorers: {
    policy?: string;
    agent: string;
    paymentReview?: string;
    threatReport?: string;
    threatConfirmation?: string;
    promptReview: string;
    policyDecision: string;
    policyTx?: string;
    agentTx: string;
    paymentReviewTx?: string;
    threatReportTx?: string;
    threatConfirmationTx?: string;
    promptReviewTx: string;
    policyDecisionTx: string;
  };
};

type PolicyReference = {
  key: string;
  txHash?: string;
  explorer?: string;
  txExplorer?: string;
};

let arkivWriteQueue: Promise<void> = Promise.resolve();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withArkivWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = arkivWriteQueue.catch(() => undefined).then(operation);
  arkivWriteQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function retryBackoffMs(attempt: number): number {
  const base = 450 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}

function isRetryableEntityError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("replacement transaction underpriced") ||
    message.includes("nonce too low") ||
    message.includes("already known")
  );
}

async function createEntityWithRetry(
  entityBuilder: Parameters<ReturnType<typeof getArkivWalletClient>["createEntity"]>[0],
  retries = 3,
) {
  const walletClient = getArkivWalletClient();
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await withArkivWriteLock(() => walletClient.createEntity(entityBuilder));
    } catch (error) {
      lastError = error;
      if (!isRetryableEntityError(error) || attempt === retries) {
        throw error;
      }
      await delay(retryBackoffMs(attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to create Arkiv entity");
}

async function resolvePolicyReference(
  orgKey: string,
  options: {
    policyKeyHint?: string;
    policySlugHint?: string;
    action: ActionType;
    severity: SeverityType;
  },
): Promise<PolicyReference> {
  if (options.policyKeyHint?.trim() && isHexIdentifier(options.policyKeyHint.trim())) {
    const key = options.policyKeyHint.trim();
    return {
      key,
      explorer: maybeEntityExplorerUrl(key),
    };
  }

  if (options.policySlugHint?.trim()) {
    const slug = options.policySlugHint.trim();
    const createdPolicy = await createEntityWithRetry(
      buildPolicyEntity({
        orgKey,
        name: `Runtime policy: ${slug}`,
        pattern: slug,
        action: options.action,
        severity: options.severity,
      }),
    );

    return {
      key: createdPolicy.entityKey,
      txHash: createdPolicy.txHash,
      explorer: entityExplorerUrl(createdPolicy.entityKey),
      txExplorer: transactionExplorerUrl(createdPolicy.txHash),
    };
  }

  const latestPolicies = await fetchByEntityType(ENTITY_TYPE.policy, 1);
  const latestPolicy = latestPolicies.entities[0] as
    | { key?: string | null; entityKey?: string | null }
    | undefined;

  const existingKey = latestPolicy?.key ?? latestPolicy?.entityKey ?? null;
  if (existingKey) {
    return {
      key: existingKey,
      explorer: maybeEntityExplorerUrl(existingKey),
    };
  }

  const createdPolicy = await createEntityWithRetry(
    buildPolicyEntity({
      orgKey,
      name: "Playground safety policy",
      pattern: "sensitive content detection",
      action: ACTION.warn,
      severity: "medium",
    }),
  );

  return {
    key: createdPolicy.entityKey,
    txHash: createdPolicy.txHash,
    explorer: entityExplorerUrl(createdPolicy.entityKey),
    txExplorer: transactionExplorerUrl(createdPolicy.txHash),
  };
}

function normalizeAction(action?: ActionType | "PASS") {
  if (!action || action === "PASS") return undefined;
  return action;
}

export async function persistArkivPromptAudit(input: PersistArkivAuditInput): Promise<PersistArkivAuditResult> {
  const evaluation =
    typeof input.prompt === "string" && input.prompt.trim().length > 0
      ? evaluatePromptRisk(input.prompt)
      : {
          action: normalizeAction(input.action) ?? ACTION.log,
          severity: input.severity ?? "low",
          riskScore: input.riskScore ?? 0,
          matchedRules: input.matchedRules ?? [],
          reason: input.reason ?? "Prompt evaluation persisted from external source",
        };

  const finalAction: ActionType = normalizeAction(input.action) ?? evaluation.action;
  const finalSeverity = input.severity ?? evaluation.severity;
  const finalReason = input.reason ?? evaluation.reason;
  const finalRiskScore = input.riskScore ?? evaluation.riskScore;
  const finalMatchedRules = input.matchedRules ?? evaluation.matchedRules;
  const finalPromptRedacted = input.promptRedacted ?? (input.prompt ? redactPrompt(input.prompt) : "");
  const finalPromptHash =
    input.promptHash ?? (input.prompt ? promptHash(input.prompt) : promptHash(finalPromptRedacted));

  const policy = await resolvePolicyReference(input.orgKey, {
    policyKeyHint: input.policyKeyHint,
    policySlugHint: input.policySlugHint,
    action: finalAction,
    severity: finalSeverity,
  });
  const agentKey = input.agentKey ?? "agent_arkivgate_playground";
  const agent = await createEntityWithRetry(
    buildAgentEntity({
      orgKey: input.orgKey,
      agentKey,
      paymentRail: input.agentPaymentRail ?? "none",
      createdAt: input.createdAt,
    }),
  );
  const threatReport =
    input.paymentPolicy?.recipientAddress && input.paymentPolicy.threatIntel?.isFlagged
      ? await createEntityWithRetry(
          buildThreatReportEntity({
            orgKey: input.orgKey,
            recipientAddress: input.paymentPolicy.recipientAddress,
            threatType: input.paymentPolicy.threatIntel.dominantThreatType,
            severityScore: input.paymentPolicy.threatIntel.maxSeverity,
            reportCount: input.paymentPolicy.threatIntel.reportCount,
            confirmationCount: input.paymentPolicy.threatIntel.confirmationCount,
            totalAmountLostUsd: input.paymentPolicy.threatIntel.totalAmountLostUsd,
            aiSummary: input.paymentPolicy.threatIntel.aiSummary,
            matchedReportId: input.paymentPolicy.threatIntel.matchedReportId,
            createdAt: input.createdAt,
          }),
        )
      : null;
  const threatConfirmation =
    threatReport && input.paymentPolicy?.recipientAddress && input.paymentPolicy.threatIntel
      ? await createEntityWithRetry(
          buildThreatConfirmationEntity({
            orgKey: input.orgKey,
            threatReportKey: threatReport.entityKey,
            recipientAddress: input.paymentPolicy.recipientAddress,
            confirmerAddress: agentKey,
            confidence: input.paymentPolicy.threatIntel.confidence,
            createdAt: input.createdAt,
          }),
        )
      : null;
  const paymentReview = input.paymentPolicy
    ? await createEntityWithRetry(
        buildPaymentReviewEntity({
          orgKey: input.orgKey,
          agentKey,
          agentEntityKey: agent.entityKey,
          paymentRail: input.agentPaymentRail ?? "none",
          verdict: input.paymentPolicy.verdict,
          severity: input.paymentPolicy.severity,
          riskScore: input.paymentPolicy.riskScore,
          reason: input.paymentPolicy.reason,
          matchedRules: input.paymentPolicy.matchedRules,
          walletBalanceUsd: input.paymentPolicy.walletBalanceUsd,
          transferUsd: input.paymentPolicy.transferUsd,
          adjustedTransferUsd: input.paymentPolicy.adjustedTransferUsd,
          recentMaxTransferUsd: input.paymentPolicy.recentMaxTransferUsd,
          perTxLimitUsd: input.paymentPolicy.perTxLimitUsd,
          recipientRisk: input.paymentPolicy.recipientRisk,
          recipientAddress: input.paymentPolicy.recipientAddress,
          threatReportKey: threatReport?.entityKey,
          threatConfirmationKey: threatConfirmation?.entityKey,
          threatReportCount: input.paymentPolicy.threatIntel?.reportCount,
          threatConfirmationCount: input.paymentPolicy.threatIntel?.confirmationCount,
          threatSeverityScore: input.paymentPolicy.threatIntel?.maxSeverity,
          threatType: input.paymentPolicy.threatIntel?.dominantThreatType,
          createdAt: input.createdAt,
        }),
      )
    : null;

  const promptReview = await createEntityWithRetry(
    buildPromptReviewEntity({
      orgKey: input.orgKey,
      sessionKey: input.sessionKey ?? `session_${input.traceId}`,
      agentKey,
      agentEntityKey: agent.entityKey,
      paymentReviewKey: paymentReview?.entityKey,
      model: input.model,
      promptHash: finalPromptHash,
      promptRedacted: finalPromptRedacted,
      matchedRules: finalMatchedRules,
      action: finalAction,
      severity: finalSeverity,
      riskScore: finalRiskScore,
      latencyMs: input.latencyMs ?? 0,
      createdAt: input.createdAt,
    }),
  );

  const policyDecision = await createEntityWithRetry(
    buildPolicyDecisionEntity({
      orgKey: input.orgKey,
      promptReviewKey: promptReview.entityKey,
      paymentReviewKey: paymentReview?.entityKey,
      policyKey: policy.key,
      finalAction,
      severity: finalSeverity,
      reason: finalReason,
      policyLayer: "regex",
      createdAt: input.createdAt,
    }),
  );

  return {
    policyKey: policy.key,
    agentEntityKey: agent.entityKey,
    paymentReviewKey: paymentReview?.entityKey,
    threatReportKey: threatReport?.entityKey,
    threatConfirmationKey: threatConfirmation?.entityKey,
    promptReviewKey: promptReview.entityKey,
    policyDecisionKey: policyDecision.entityKey,
    policyTxHash: policy.txHash,
    agentTxHash: agent.txHash,
    paymentReviewTxHash: paymentReview?.txHash,
    threatReportTxHash: threatReport?.txHash,
    threatConfirmationTxHash: threatConfirmation?.txHash,
    promptReviewTxHash: promptReview.txHash,
    policyDecisionTxHash: policyDecision.txHash,
    explorers: {
      policy: policy.explorer,
      agent: entityExplorerUrl(agent.entityKey),
      paymentReview: paymentReview ? entityExplorerUrl(paymentReview.entityKey) : undefined,
      threatReport: threatReport ? entityExplorerUrl(threatReport.entityKey) : undefined,
      threatConfirmation: threatConfirmation ? entityExplorerUrl(threatConfirmation.entityKey) : undefined,
      promptReview: entityExplorerUrl(promptReview.entityKey),
      policyDecision: entityExplorerUrl(policyDecision.entityKey),
      policyTx: policy.txExplorer,
      agentTx: transactionExplorerUrl(agent.txHash),
      paymentReviewTx: paymentReview ? transactionExplorerUrl(paymentReview.txHash) : undefined,
      threatReportTx: threatReport ? transactionExplorerUrl(threatReport.txHash) : undefined,
      threatConfirmationTx: threatConfirmation ? transactionExplorerUrl(threatConfirmation.txHash) : undefined,
      promptReviewTx: transactionExplorerUrl(promptReview.txHash),
      policyDecisionTx: transactionExplorerUrl(policyDecision.txHash),
    },
  };
}
