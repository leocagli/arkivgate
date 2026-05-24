# Arkiv x ETHNS Builder Challenge Scorecard

Submission: ArkivGate
Theme: AI + Privacy hybrid
Date: May 2026
Evaluator: self-assessment

## Executive Assessment

ArkivGate is strong as an AI-security product demo and now has a clearer Arkiv challenge surface. The public app shows not only writes and explorer links, but also multi-filter Arkiv evidence queries, relationship navigation, and retention strategy. The main remaining rubric risk is ownership: the current model uses a backend service writer instead of end-user wallet ownership.

Estimated current score after polish: **3.86 / 5.00**

Realistic ceiling without end-user wallet ownership or encrypted access grants: **4.05 / 5.00**

Best next improvement: transfer or create selected Arkiv entities under the end-user wallet, or add encrypted prompt evidence with wallet-scoped access grants.

## Weighted Score

| Section | Avg | Weight | Weighted |
| --- | ---: | ---: | ---: |
| Arkiv Integration | 3.97 | 40% | 1.59 |
| Functionality | 3.60 | 30% | 1.08 |
| Design & UX | 4.10 | 20% | 0.82 |
| Code Quality & Docs | 4.10 | 10% | 0.41 |
| **Final** |  |  | **3.90 / 5.00** |

## Arkiv Integration - 3.97 / 5

### Entity schema design: 4 / 5

Strengths:

- Multiple entity types: `agent`, `payment_review`, `prompt_review`, `policy_decision`, `policy`, `rule_suggestion`.
- Unique project namespace: `project=arkivgate-leocagli-2026`.
- Structured payloads instead of one blob.
- Good typed attributes: string filters for entity identity and numeric filters for `createdAt` and `riskScore`.

Gap to 5:

- Add a visible schema explanation in the app or README with one sample payload per entity.
- Avoid any impression that Arkiv is only a log sink.

### Query usage: 4 / 5

Strengths:

- Entities are designed to be queryable.
- Explorer links and entity keys are shown.
- Public evidence API filters by `PROJECT_ATTRIBUTE`, `entityType`, `action`, `severity`, `agentKey`, `riskScore >=`, and `createdAt` window.
- Evidence Browser exposes those filters in the demo UI.
- Response shape is pagination-ready with cursor/hasNextPage.

Gap:

- Full pagination controls are not yet exposed in the UI.
- Query examples could be added as a README screenshot/GIF.

### Ownership model: 3 / 5

Strengths:

- Arkiv writes are wallet-backed by backend environment configuration.
- Backend writer creates tamper-resistant attribution at service level.
- UI now surfaces `owner` and `creator` metadata in selected evidence.
- Public flow supports Reown AppKit / WalletConnect on Arkiv Braga.
- Connected wallet address becomes the x402 payer and `agentKey`, so evidence can be filtered by the agent wallet identity.

Gap:

- Arkiv entity `$owner` is still the backend service wallet, not the end-user wallet.
- No user-owned update/delete model yet.

Fast fix:

- In docs/pitch, explicitly state current model: backend service wallet is trusted runtime writer.
- If time allows, add a small "writer identity" panel showing Arkiv project, chain, and service wallet attribution.

### Entity relationships: 4.5 / 5

Strengths:

- Consistent relationship keys:
  - `agentKey`
  - `agentEntityKey`
  - `paymentReviewKey`
  - `promptReviewKey`
  - `policyKey`
- Payment review, prompt review, and policy decision are linked.
- This maps well to parent-child evidence navigation.
- Evidence Browser renders the relationship tree for selected evidence.

Gap to 5:

- Delete/update integrity is not demonstrated.

Fast fix:

- In evidence output, render a small relationship tree:

```txt
agent
  -> payment_review
  -> prompt_review
      -> policy_decision
```

### Expiration dates: 4.25 / 5

Strengths:

- Uses `ExpirationTime` helpers.
- Differentiated lifetimes:
  - prompt review: 30 days
  - payment review: 180 days
  - policy decision: 180 days
  - agent: 365 days
  - rule suggestion: 7 days

Gap to 5:

- No `extendEntity()` behavior.
- `expiresIn` strategy is visible as retention days, while raw block expiry is still technical.

### Advanced features: 4 / 5

Strengths:

- Creative combination: x402 payment gate + prompt security + Arkiv evidence.
- Policy lifecycle vocabulary exists.
- Dual-lane policy evaluation is above average.

Gap to 5:

- No batch `mutateEntities`.
- No encrypted payload/access grant pattern.
- No ZK proof or advanced ownership model.

Fast fix:

- Present x402 + linked evidence as the advanced feature.
- Add a future section for encrypted prompt evidence if not implemented.

## Functionality - 3.60 / 5

### Core flows work: 4 / 5

Works:

- Playground runs.
- x402 demo challenge/signature flow works.
- Payment policy lane works.
- Prompt policy lane works.
- Combined final verdict works.
- Arkiv persistence is integrated.
- Railway interceptor is online.

Gap:

- Real upstream Claude API is not connected due cost constraints.
- Some runtime flows use fallback/demo paths.

### Filtering & search: 4 / 5

Works:

- Policy/playground controls let the user vary inputs.
- Evidence Browser supports combinable filters for entity type, action, severity, agent key, min risk, and time window.

Gap:

- Keyword text search is not implemented.
- Pagination controls are API-ready but not fully clickable in the UI.

### Wallet integration: 2.5 / 5

Works:

- x402 signature/payment simulation exists.
- Arkiv writer is configured by backend key.

Gap:

- No user wallet connect.
- Payment is demo settlement, not real facilitator.

### Error handling: 3.5 / 5

Works:

- Fallback paths exist for Vercel/Supabase/Prisma issues.
- 402 challenge states are explicit.
- Playground can operate without paid Claude API.

Gap:

- Some admin/auth/database errors could be more user-facing.
- Production fallback complexity should be surfaced in a health panel.

### Data integrity: 4.25 / 5

Works:

- Evidence keys are linked consistently.
- Final verdict uses highest severity across policy lanes.
- Prompt content is redacted before persistence.
- Relationship tree makes orphaned/missing references easier to see during the demo.

Gap:

- No UI showing orphan checks or relationship traversal.

## Design & UX - 4.10 / 5

### Visual design: 4 / 5

The app looks intentional and productized, not default. The visual identity is distinct enough for a hackathon demo.

### User experience: 4 / 5

The playground makes the core decision loop understandable, and the Evidence Browser makes the Arkiv value visible without asking judges to inspect code or raw explorer pages.

### Responsive: 3.5 / 5

Usable across screens based on current layout, but needs final mobile screenshot verification before submission.

### Blockchain abstraction: 4.5 / 5

The user does not need to understand Arkiv or wallets to run the demo. This is a strength.

## Code Quality & Documentation - 4.10 / 5

### README: 4 / 5

Strong setup and architecture notes are present. The challenge pitch and scorecard are linked. README now explains the Evidence Browser and Arkiv query model. To reach 5, add screenshots/GIF and a compact Arkiv schema diagram.

### Code organization: 4 / 5

Good separation:

- `web/` for Next.js app
- `interceptor/` for FastAPI runtime
- policy helpers separated
- Arkiv entity builders separated
- x402 helpers separated

### Code quality: 3.5 / 5

Types and tests exist for important TS helpers. Risk areas are fallback complexity and secret/env management. No committed secret was found in the latest push scan.

## Remaining Highest-Impact Fixes Before Judging

1. Add an Arkiv schema diagram to README.
   - This improves README and makes Entity Schema obvious.

2. Add a writer identity panel.
   - Explain backend Arkiv service wallet versus connected agent wallet.

3. Add clickable pagination in the Evidence Browser.
   - This pushes Query Usage closer to 5.

4. Record the video around the clean line:
   - "x402 proves the agent can pay. ArkivGate proves whether the action is safe. Arkiv proves the decision happened."

## Judge-Facing Scorecard

ARKIV INTEGRATION (40%)

- Entity schema design: 4 / 5
- Query usage: 4 / 5
- Ownership model: 3 / 5
- Entity relationships: 4.5 / 5
- Expiration dates: 4.25 / 5
- Advanced features: 4 / 5
- Section avg: 3.97 / 5

FUNCTIONALITY (30%)

- Core flows work: 4 / 5
- Filtering & search: 4 / 5
- Wallet integration: 2.5 / 5
- Error handling: 3.5 / 5
- Data integrity: 4.25 / 5
- Section avg: 3.60 / 5

DESIGN & UX (20%)

- Visual design: 4 / 5
- User experience: 4 / 5
- Responsive: 3.5 / 5
- Blockchain abstraction: 4.5 / 5
- Section avg: 4.10 / 5

CODE QUALITY (10%)

- README: 4.5 / 5
- Code organization: 4 / 5
- Code quality: 3.8 / 5
- Section avg: 4.10 / 5

WEIGHTED FINAL: 3.90 / 5
