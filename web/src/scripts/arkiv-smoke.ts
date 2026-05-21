import { getArkivWalletClient } from "../lib/arkiv/client";
import { ACTION } from "../lib/arkiv/constants";
import {
  buildPolicyDecisionEntity,
  buildPolicyEntity,
  buildPromptReviewEntity,
} from "../lib/arkiv/entities";
import { evaluatePromptRisk, promptHash, redactPrompt } from "../lib/arkiv/mappers";
import { entityExplorerUrl } from "../lib/arkiv/queries";

async function main() {
  const walletClient = getArkivWalletClient();
  const orgKey = process.env.DEMO_ORG_ID ?? "demo";
  const prompt = process.env.TEST_PROMPT ?? "Use AKIA1234567890ABCDEF to deploy now";

  const { entityKey: policyKey } = await walletClient.createEntity(
    buildPolicyEntity({
      orgKey,
      name: "Block AWS key leakage",
      pattern: "AKIA[0-9A-Z]{16}",
      action: ACTION.block,
      severity: "high",
    }),
  );

  const risk = evaluatePromptRisk(prompt);
  const { entityKey: reviewKey } = await walletClient.createEntity(
    buildPromptReviewEntity({
      orgKey,
      sessionKey: `session_${Date.now()}`,
      agentKey: "agent_arkivgate_proxy",
      model: "claude-sonnet",
      promptHash: promptHash(prompt),
      promptRedacted: redactPrompt(prompt),
      matchedRules: risk.matchedRules,
      action: risk.action,
      severity: risk.severity,
      riskScore: risk.riskScore,
      latencyMs: 0,
    }),
  );

  const { entityKey: decisionKey } = await walletClient.createEntity(
    buildPolicyDecisionEntity({
      orgKey,
      promptReviewKey: reviewKey,
      policyKey,
      finalAction: risk.action,
      severity: risk.severity,
      reason: risk.reason,
    }),
  );

  console.log("policy", policyKey, entityExplorerUrl(policyKey));
  console.log("prompt_review", reviewKey, entityExplorerUrl(reviewKey));
  console.log("policy_decision", decisionKey, entityExplorerUrl(decisionKey));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
