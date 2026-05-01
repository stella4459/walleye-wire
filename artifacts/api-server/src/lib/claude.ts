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

  const text = msg.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  if (!text) throw new Error("No text response from Claude");
  return text;
}
