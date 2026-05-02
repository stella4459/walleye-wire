import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "./logger";

export function parseArr(raw: string): unknown[] {
  try {
    const c = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(c.slice(c.indexOf("["), c.lastIndexOf("]") + 1));
  } catch {
    return [];
  }
}

export function parseObj(raw: string): Record<string, unknown> | null {
  try {
    const c = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(c.slice(c.indexOf("{"), c.lastIndexOf("}") + 1));
  } catch {
    return null;
  }
}

export async function callClaude(
  messages: { role: "user" | "assistant"; content: string }[],
  system: string
): Promise<string> {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system,
    messages,
  });

  const text = (msg.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n");

  if (!text) throw new Error("No text response from Claude");
  return text;
}

/** Call Claude with one or more PDF documents (base64 encoded). */
export async function callClaudeWithDocs(
  pdfDocs: Array<{ base64: string; sourceUrl: string }>,
  userPrompt: string,
  system: string
): Promise<string> {
  const content: Array<Record<string, unknown>> = [];

  for (const doc of pdfDocs) {
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: doc.base64,
      },
      title: doc.sourceUrl,
    });
  }

  content.push({ type: "text", text: userPrompt });

  const msg = await (anthropic.messages.create as Function)({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system,
    messages: [{ role: "user", content }],
  });

  const text = (msg.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n");

  if (!text) throw new Error("No text response from Claude");
  return text;
}
