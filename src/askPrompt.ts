import { evidence } from "./evidenceBank";
import { formatOf } from "./grading";
import { Answer, Presentation, Question } from "./types";

export interface AskContext {
  question: Question; // as shown in the session (options already in display order)
  presentation: Presentation;
  answer?: Answer;
  revealed: boolean; // the answer key was shown to the user
  position?: string; // e.g. "Question 3 of 10 in a Quick Practice Quiz"
  /** Display order of a matching question's choices or a build list's pool (indices into the question's arrays). */
  displayOrder?: number[];
}

const letter = (i: number) => String.fromCharCode(65 + i);
const sourceFile = (q: Question) => (formatOf(q) === "multiple_choice" ? "src/questions.ts" : "src/formatQuestions.ts");
const numbered = (code: string) => code.split("\n").map((line, i) => `${String(i + 1).padStart(2, " ")} | ${line}`).join("\n");
const fence = (code: string, lang = "") => "```" + lang + "\n" + code + "\n```";

/** What the question shows: stem, code, and the format's answer area, in the order the user saw it. */
function questionBlock(q: Question, ctx: AskContext): string[] {
  const out = [q.questionText];
  const format = formatOf(q);
  if (q.codeSnippet && !(q.format === "hotspot" && q.target.kind === "code_lines")) out.push(fence(q.codeSnippet, q.codeLanguage));
  if (q.format === "fill_blank") out.push(`(Blanks are marked [[1]]${q.blanks.length > 1 ? ", [[2]] and so on" : ""}.)`);
  if (format === "multiple_choice" && "options" in q) {
    out.push(ctx.presentation === "domc" ? "Options (shown one at a time, answered yes or no):" : "Options:");
    q.options.forEach((o, i) => out.push(`${letter(i)}. ${o}`));
  } else if (q.format === "matching") {
    out.push("Items to match:");
    q.prompts.forEach((p, i) => out.push(`${i + 1}. ${p}`));
    const order = ctx.displayOrder ?? q.choices.map((_, i) => i);
    out.push("Choices:");
    order.forEach((c, pos) => out.push(`${letter(pos)}. ${q.choices[c]}`));
  } else if (q.format === "build_list") {
    const pool = [...q.items, ...(q.distractors ?? [])];
    const order = ctx.displayOrder ?? pool.map((_, i) => i);
    out.push("Items to put in order (some may not belong):");
    order.forEach((i) => out.push(`- ${pool[i]}`));
  } else if (q.format === "hotspot" && q.target.kind === "code_lines") {
    out.push("Code (the answer is one or more line numbers):", fence(numbered(q.codeSnippet ?? ""), q.codeLanguage));
  } else if (q.format === "hotspot" && q.target.kind === "dag") {
    out.push("DAG nodes: " + q.target.nodes.map((n) => n.label).join(", "));
    out.push("Edges: " + q.target.edges.map(([from, to]) => `${label(q, from)} -> ${label(q, to)}`).join(", "));
  }
  return out;
}

const label = (q: Question, id: string) => (q.format === "hotspot" && q.target.kind === "dag" ? q.target.nodes.find((n) => n.id === id)?.label ?? id : id);

/** The user's answer, in the same terms as the question block. Empty when nothing was answered. */
function answerLine(q: Question, ctx: AskContext): string {
  const a = ctx.answer;
  if (!a) return "";
  if (a.kind === "choice" && "options" in q) return a.selected.map((i) => `${letter(i)}. ${q.options[i]}`).join("; ");
  if (a.kind === "domc" && "options" in q) return a.decisions.map((d) => `${d.accepted ? "Yes" : "No"} to "${q.options[d.option]}"`).join("; ");
  if (a.kind === "text") return a.values.map((v, i) => `blank ${i + 1}: ${v || "(empty)"}`).join("; ");
  if (a.kind === "matching" && q.format === "matching") {
    const order = ctx.displayOrder ?? q.choices.map((_, i) => i);
    return a.picks.map((p, i) => `${i + 1} -> ${p === null ? "(none)" : letter(order.indexOf(p))}`).join("; ");
  }
  if (a.kind === "order" && q.format === "build_list") {
    const pool = [...q.items, ...(q.distractors ?? [])];
    return a.sequence.map((i, n) => `${n + 1}. ${pool[i]}`).join("; ");
  }
  if (a.kind === "lines") return `lines ${a.picks.join(", ")}`;
  if (a.kind === "nodes") return a.picks.map((id) => label(q, id)).join(", ");
  return "";
}

/** The answer key, stated in the same terms as the question block. */
function keyLines(q: Question, ctx: AskContext): string[] {
  if ("options" in q && formatOf(q) === "multiple_choice") return q.correctAnswers.map((i) => `${letter(i)}. ${q.options[i]}`);
  if (q.format === "fill_blank") return q.blanks.map((b, i) => `blank ${i + 1}: ${b.accepted.join(" or ")}`);
  if (q.format === "matching") {
    const order = ctx.displayOrder ?? q.choices.map((_, i) => i);
    return q.matches.map((m, i) => `${i + 1} -> ${letter(order.indexOf(m))}`);
  }
  if (q.format === "build_list") return q.items.map((item, i) => `${i + 1}. ${item}`);
  if (q.format === "hotspot" && q.target.kind === "code_lines") return [`lines ${q.target.correctLines.join(", ")}`];
  if (q.format === "hotspot" && q.target.kind === "dag") return [q.target.correctNodes.map((id) => label(q, id)).join(", ")];
  return [];
}

/**
 * The message the user pastes into an LLM: the question as they saw it, their answer, optionally the key with
 * its explanation and documentation evidence, and their question. Names the question id and file so a coding
 * agent working on this app can find and fix it.
 */
export function buildAskPrompt(ctx: AskContext, userQuestion: string, quote: string, includeKey: boolean): string {
  const q = ctx.question;
  const lines: string[] = [
    "I am preparing for the dbt Analytics Engineering Certification exam (dbt Core 1.11) with a practice app, and I have a question about one of its practice questions.",
    "",
    `Question id ${q.id} (${sourceFile(q)}) · Topic: ${q.category} · Difficulty: ${q.difficulty} · Format: ${ctx.presentation === "domc" ? "DOMC" : formatOf(q).replace("_", " ")}${ctx.position ? ` · ${ctx.position}` : ""}`,
    "",
    "## The question",
    ...questionBlock(q, ctx),
  ];
  const mine = answerLine(q, ctx);
  if (mine) lines.push("", "## My answer", mine);
  if (includeKey) {
    lines.push("", "## Answer key", ...keyLines(q, ctx), "", "## Explanation given", q.explanation);
    const ev = evidence[q.id];
    if (ev) {
      lines.push("", "## Evidence the app cites");
      ev.quotes.forEach((x) => lines.push(`> ${x.text.replace(/\n+/g, " ")}`, `(dbt docs: ${x.page}, ${x.url})`));
      if (ev.run) lines.push(`Checked by running dbt Core ${ev.run.dbtVersion}: ${ev.run.commands.join("; ")}. Observed: ${ev.run.observed}`);
    }
  } else {
    lines.push("", "(I have not seen the answer key yet. Do not reveal which answer is correct unless I ask.)");
  }
  if (quote) lines.push("", "## The part I am asking about", `"${quote}"`);
  lines.push("", "## My question", userQuestion);
  return lines.join("\n");
}
