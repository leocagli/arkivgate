import { ACTION, ENTITY_TYPE, type ActionType, type SeverityType } from "./constants";
import { getArkivWalletClient } from "./client";
import {
  buildPolicyDecisionEntity,
  buildPolicyEntity,
  buildPromptReviewEntity,
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
  latencyMs?: number;
  createdAt?: number;
};

export type PersistArkivAuditResult = {
  policyKey: string;
  promptReviewKey: string;
  policyDecisionKey: string;
  policyTxHash?: string;
  promptReviewTxHash: string;
  policyDecisionTxHash: string;
  explorers: {
    policy?: string;
    promptReview: string;
    policyDecision: string;
    policyTx?: string;
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

  const promptReview = await createEntityWithRetry(
    buildPromptReviewEntity({
      orgKey: input.orgKey,
      sessionKey: input.sessionKey ?? `session_${input.traceId}`,
      agentKey: input.agentKey ?? "agent_arkivgate_playground",
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
    promptReviewKey: promptReview.entityKey,
    policyDecisionKey: policyDecision.entityKey,
    policyTxHash: policy.txHash,
    promptReviewTxHash: promptReview.txHash,
    policyDecisionTxHash: policyDecision.txHash,
    explorers: {
      policy: policy.explorer,
      promptReview: entityExplorerUrl(promptReview.entityKey),
      policyDecision: entityExplorerUrl(policyDecision.entityKey),
      policyTx: policy.txExplorer,
      promptReviewTx: transactionExplorerUrl(promptReview.txHash),
      policyDecisionTx: transactionExplorerUrl(policyDecision.txHash),
    },
  };
}