/**
 * Parses the single command line into either a question or a new fact.
 *
 * Grammar (intentionally tiny and forgiving):
 *   ask   :  "<relation> of <subject>"               e.g. "capital of France"
 *   teach :  "<relation> of <subject> is <object>"   e.g. "capital of Spain is Madrid"
 *
 * A trailing question mark is ignored. The presence of " is " switches from a
 * question to a statement the brain should learn.
 */

export type Command =
  | { kind: "empty" }
  | { kind: "ask"; subject: string; relation: string }
  | { kind: "teach"; subject: string; relation: string; object: string }
  | { kind: "invalid"; message: string };

const ASK_HINT = 'Try: "capital of France"';
const TEACH_HINT = 'Try: "capital of Spain is Madrid"';

export function parseCommand(raw: string): Command {
  const text = raw.trim().replace(/\?+\s*$/, "").trim();
  if (!text) return { kind: "empty" };

  const lower = text.toLowerCase();
  const isIndex = lower.lastIndexOf(" is ");

  if (isIndex !== -1) {
    const left = text.slice(0, isIndex).trim();
    const object = text.slice(isIndex + 4).trim();
    const ofIndex = left.toLowerCase().indexOf(" of ");
    if (ofIndex === -1 || !object) {
      return { kind: "invalid", message: TEACH_HINT };
    }
    const relation = left.slice(0, ofIndex).trim();
    const subject = left.slice(ofIndex + 4).trim();
    if (!relation || !subject) return { kind: "invalid", message: TEACH_HINT };
    return { kind: "teach", subject, relation, object };
  }

  const ofIndex = lower.indexOf(" of ");
  if (ofIndex === -1) return { kind: "invalid", message: ASK_HINT };
  const relation = text.slice(0, ofIndex).trim();
  const subject = text.slice(ofIndex + 4).trim();
  if (!relation || !subject) return { kind: "invalid", message: ASK_HINT };
  return { kind: "ask", subject, relation };
}
