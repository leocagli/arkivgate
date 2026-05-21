// AI Suggestor core logic â€” Layer 4 of ArkivGate.
// Analyzes LOG interactions for the given org and proposes new security rules
// using Claude Haiku with prompt caching.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// â”€â”€ Zod schema for Haiku response â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const HaikuSuggestionSchema = z.object({
  skip: z.boolean(),
  slug: z.string().min(1),
  domain: z.enum([
    "credentials",
    "pii",
    "internal_paths",
    "business_policy",
    "code",
  ]),
  layer: z.enum(["regex", "pattern", "nl"]),
  default_action: z.enum(["BLOCK", "REDACT", "WARN", "LOG"]),
  pattern: z.string().nullable(),
  rule: z.string().min(1),
  reasoning: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  match_indices: z.array(z.number().int().nonnegative()),
});

const HaikuResponseSchema = z.array(HaikuSuggestionSchema);

type HaikuSuggestion = z.infer<typeof HaikuSuggestionSchema>;

// â”€â”€ Return types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type SuggestorResult = {
  analyzed: number;
  proposed: number;
  inserted: number;
  skipped: number;
  suggestions: SuggestorSuggestion[];
};

export type SuggestorSuggestion = {
  slug: string;
  domain: string;
  layer: string;
  defaultAction: string;
  severity: string;
  rule: string;
  reasoning: string;
  matchCount: number;
  inserted: boolean;
  skipped: boolean;
};

// â”€â”€ Cacheable system prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SYSTEM_PROMPT = `Sos un asistente de seguridad de datos corporativos. AnalizÃ¡s prompts que devs enviaron a Claude Code â€” un coding assistant. Estos prompts pasaron sin ser bloqueados ni redactados (acciÃ³n LOG), lo que significa que no matchearon ninguna regla existente del firewall.

Tu tarea: identificar patrones de informaciÃ³n potencialmente sensible que el admin de seguridad probablemente quiera controlar. PensÃ¡ en: credenciales, PII, datos de clientes, informaciÃ³n interna de negocio, cÃ³digo propietario, M&A, compensaciones, etc.

DevolvÃ© un JSON array. MÃ¡ximo 5 sugerencias. Si un cluster de prompts no tiene un patrÃ³n claro de seguridad, no lo incluyas. PreferÃ­ calidad sobre cantidad.

Output schema (JSON estricto, array en el root):
[
  {
    "skip": false,
    "slug": "kebab-case-unico",
    "domain": "credentials|pii|internal_paths|business_policy|code",
    "layer": "regex|pattern|nl",
    "default_action": "BLOCK|REDACT|WARN|LOG",
    "pattern": "regex literal o null",
    "rule": "descripciÃ³n en espaÃ±ol rioplatense de quÃ© detecta la regla",
    "reasoning": "por quÃ© este patrÃ³n es un riesgo y cuÃ¡ntos prompts lo muestran",
    "severity": "low|medium|high",
    "match_indices": [lista de Ã­ndices (base 0) de los prompts que matchean este patrÃ³n]
  }
]

Si no ves ningÃºn patrÃ³n de seguridad relevante en los prompts, devolvÃ© [].`;

// â”€â”€ Main function â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function runSuggestor(
  orgId: string,
  opts?: { lookbackDays?: number; dryRun?: boolean }
): Promise<SuggestorResult> {
  const lookbackDays =
    opts?.lookbackDays ??
    (process.env.SUGGESTOR_LOOKBACK_DAYS
      ? parseInt(process.env.SUGGESTOR_LOOKBACK_DAYS, 10)
      : 7);
  const dryRun = opts?.dryRun ?? false;

  // 1. Fetch up to 80 LOG interactions in the lookback window
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);

  const interactions = await prisma.interaction.findMany({
    where: {
      orgId,
      action: "LOG",
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      id: true,
      traceId: true,
      prompt: true,
      createdAt: true,
    },
  });

  const analyzed = interactions.length;

  // 2. Below threshold â€” not enough data for meaningful analysis
  if (analyzed < 3) {
    return { analyzed, proposed: 0, inserted: 0, skipped: 0, suggestions: [] };
  }

  // 3. Fetch existing pending slugs to dedup
  const existingSuggestions = await prisma.ruleSuggestion.findMany({
    where: { orgId, status: "pending" },
    select: { proposedSlug: true },
  });
  const existingSlugs = new Set(existingSuggestions.map((s) => s.proposedSlug));

  // 4. Build user message with numbered prompts
  const numberedPrompts = interactions
    .map((ix, idx) => `[${idx}] ${ix.prompt}`)
    .join("\n\n");

  const userMessage = `AnalizÃ¡ los siguientes ${analyzed} prompts enviados por devs a Claude Code. Todos pasaron con acciÃ³n LOG (sin bloqueo ni redacciÃ³n):\n\n${numberedPrompts}\n\nIdentificÃ¡ patrones de seguridad y devolvÃ© el JSON array segÃºn el schema.`;

  // 5. Call Claude Haiku with prompt caching on system block
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY no configurada. Configurala en las variables de entorno del servidor.");
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: userMessage,
      },
    ],
  });

  // 6. Extract and parse JSON response
  const rawText =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  // Try to extract JSON array from the response (may have surrounding text)
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return { analyzed, proposed: 0, inserted: 0, skipped: 0, suggestions: [] };
  }

  let parsed: HaikuSuggestion[];
  try {
    const raw = JSON.parse(jsonMatch[0]);
    const result = HaikuResponseSchema.safeParse(raw);
    if (!result.success) {
      console.error("[suggestor] Zod validation failed:", result.error.message);
      return {
        analyzed,
        proposed: 0,
        inserted: 0,
        skipped: 0,
        suggestions: [],
      };
    }
    parsed = result.data;
  } catch {
    console.error("[suggestor] JSON parse failed for:", rawText.slice(0, 200));
    return { analyzed, proposed: 0, inserted: 0, skipped: 0, suggestions: [] };
  }

  // 7. Process each suggestion
  let inserted = 0;
  let skipped = 0;
  const suggestions: SuggestorSuggestion[] = [];

  for (const s of parsed) {
    if (s.skip) {
      skipped++;
      continue;
    }

    const isExisting = existingSlugs.has(s.slug);
    if (isExisting) {
      skipped++;
      suggestions.push({
        slug: s.slug,
        domain: s.domain,
        layer: s.layer,
        defaultAction: s.default_action,
        severity: s.severity,
        rule: s.rule,
        reasoning: s.reasoning,
        matchCount: s.match_indices.length,
        inserted: false,
        skipped: true,
      });
      continue;
    }

    // Build examples from match_indices
    const examples = s.match_indices
      .filter((idx) => idx >= 0 && idx < interactions.length)
      .slice(0, 5)
      .map((idx) => {
        const ix = interactions[idx];
        return {
          traceId: ix.traceId,
          promptRedacted: ix.prompt.slice(0, 200),
          createdAt: ix.createdAt.toISOString(),
        };
      });

    if (!dryRun) {
      try {
        await prisma.ruleSuggestion.create({
          data: {
            orgId,
            proposedSlug: s.slug,
            proposedDomain: s.domain,
            proposedLayer: s.layer,
            proposedRule: s.rule,
            proposedPattern: s.pattern ?? null,
            proposedAction: s.default_action,
            proposedSeverity: s.severity,
            matchCount: s.match_indices.length,
            examples,
            sourceHint: "ai_suggestor",
            status: "pending",
          },
        });
        inserted++;
      } catch (err) {
        // Ignore unique constraint violations (slug+orgId already exists)
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes("Unique constraint") ||
          msg.includes("unique constraint")
        ) {
          skipped++;
          suggestions.push({
            slug: s.slug,
            domain: s.domain,
            layer: s.layer,
            defaultAction: s.default_action,
            severity: s.severity,
            rule: s.rule,
            reasoning: s.reasoning,
            matchCount: s.match_indices.length,
            inserted: false,
            skipped: true,
          });
          continue;
        }
        throw err;
      }
    } else {
      inserted++;
    }

    suggestions.push({
      slug: s.slug,
      domain: s.domain,
      layer: s.layer,
      defaultAction: s.default_action,
      severity: s.severity,
      rule: s.rule,
      reasoning: s.reasoning,
      matchCount: s.match_indices.length,
      inserted: true,
      skipped: false,
    });
  }

  return {
    analyzed,
    proposed: parsed.filter((s) => !s.skip).length,
    inserted,
    skipped,
    suggestions,
  };
}

