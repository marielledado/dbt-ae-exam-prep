/**
 * Checks the question bank.
 *
 *   npm run check                        structure of every question
 *   npm run check -- --docs <folder>     also looks up every evidence quote in a local copy of the dbt docs
 *
 * <folder> is a clone of https://github.com/dbt-labs/docs.getdbt.com.
 *
 * A problem in a question added in this fork (id 9001 and above) is an error. A quote of the original repo
 * that is not found is a warning: the docs site changes the text when it renders a page, so not every original
 * quote matches the docs source word for word.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { evidence } from "../src/evidenceBank";
import { CATEGORIES } from "../src/examTopics";
import { blankNumbers, formatOf, isMultipleChoice } from "../src/grading";
import { allQuestions } from "../src/questionBank";
import type { Question } from "../src/types";
import { outOfOutlineIds } from "../src/withheld";

const FIRST_CUSTOM_ID = 9001;
const errors: string[] = [];
const warnings: string[] = [];

const isCustom = (id: number) => id >= FIRST_CUSTOM_ID;
const inRange = (index: number, length: number) => Number.isInteger(index) && index >= 0 && index < length;

function checkStructure(q: Question): string[] {
  const problems: string[] = [];
  if (!CATEGORIES.includes(q.category)) problems.push(`unknown category "${q.category}"`);
  if (!q.explanation.trim()) problems.push("empty explanation");

  if (isMultipleChoice(q)) {
    if (q.options.length < 2) problems.push("fewer than two options");
    if (new Set(q.options).size !== q.options.length) problems.push("two options have the same text");
    if (q.correctAnswers.length === 0) problems.push("no correct answer");
    if (!q.correctAnswers.every((c) => inRange(c, q.options.length))) problems.push("correct answer index out of range");
  } else if (q.format === "fill_blank") {
    const numbers = [...new Set(blankNumbers(q))].sort((a, b) => a - b);
    const expected = q.blanks.map((_, i) => i + 1);
    if (numbers.join() !== expected.join()) problems.push(`blanks in the text are [${numbers}], but ${q.blanks.length} are defined`);
    if (q.blanks.some((b) => b.accepted.length === 0 || b.accepted.some((a) => !a.trim()))) problems.push("a blank has no accepted answer");
  } else if (q.format === "matching") {
    if (q.matches.length !== q.prompts.length) problems.push("number of matches differs from number of prompts");
    if (!q.matches.every((m) => inRange(m, q.choices.length))) problems.push("match index out of range");
  } else if (q.format === "build_list") {
    if (q.items.length < 2) problems.push("fewer than two items to order");
  } else if (q.format === "hotspot") {
    if (q.target.kind === "code_lines") {
      const lineCount = (q.codeSnippet ?? "").split("\n").length;
      if (q.target.correctLines.length === 0) problems.push("no correct line");
      if (!q.target.correctLines.every((l) => l >= 1 && l <= lineCount)) problems.push("correct line outside the code snippet");
    } else {
      const ids = new Set(q.target.nodes.map((n) => n.id));
      if (q.target.correctNodes.length === 0) problems.push("no correct node");
      if (!q.target.correctNodes.every((n) => ids.has(n))) problems.push("correct node is not in the DAG");
      if (!q.target.edges.every(([from, to]) => ids.has(from) && ids.has(to))) problems.push("edge names a node that is not in the DAG");
    }
  }
  return problems;
}

/** Removes markdown and markup so a quote can be compared with the docs source. */
function normalize(text: string): string {
  let t = text.replace(/<[^>]+>/g, "");
  for (let i = 0; i < 3; i++) t = t.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1");
  t = t
    .replace(/&mdash;/g, "-")
    .replace(/[`*_\\]/g, "")
    .replace(/[’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, "-")
    .replace(/^\s*[-*]\s+/gm, "");
  return t.replace(/\s+/g, " ").trim().toLowerCase();
}

function markdownFiles(folder: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) found.push(...markdownFiles(path));
    else if (/\.mdx?$/.test(name)) found.push(path);
  }
  return found;
}

// --- Structure ---------------------------------------------------------------------------------

const seenIds = new Set<number>();
for (const q of allQuestions) {
  if (seenIds.has(q.id)) errors.push(`#${q.id}: id is used by more than one question`);
  seenIds.add(q.id);
  for (const problem of checkStructure(q)) errors.push(`#${q.id}: ${problem}`);

  const entry = evidence[q.id];
  if (isCustom(q.id) && !entry) errors.push(`#${q.id}: added question has no evidence entry, so the app does not serve it`);
  if (entry && entry.quotes.length === 0 && !entry.run) errors.push(`#${q.id}: evidence entry has neither a quote nor a run`);
}
for (const id of Object.keys(evidence).map(Number)) {
  if (!seenIds.has(id) && !outOfOutlineIds.has(id)) errors.push(`#${id}: evidence entry has no question`);
}

// --- Quotes against the docs source ------------------------------------------------------------

const docsFlag = process.argv.indexOf("--docs");
let quotesChecked = 0;
if (docsFlag !== -1) {
  const root = join(process.argv[docsFlag + 1] ?? "", "website");
  if (!existsSync(root)) {
    errors.push(`--docs: no "website" folder in ${process.argv[docsFlag + 1]}`);
  } else {
    const docs = ["docs", "blog", "snippets"]
      .map((part) => join(root, part))
      .filter((folder) => existsSync(folder))
      .flatMap(markdownFiles)
      .map((path) => normalize(readFileSync(path, "utf8")));

    for (const q of allQuestions) {
      for (const quote of evidence[q.id]?.quotes ?? []) {
        quotesChecked++;
        const wanted = normalize(quote.text);
        if (docs.some((text) => text.includes(wanted))) continue;
        const message = `#${q.id}: quote not found in the docs source: "${quote.text.slice(0, 90)}" (${quote.url})`;
        (isCustom(q.id) ? errors : warnings).push(message);
      }
    }
  }
}

// --- Report ------------------------------------------------------------------------------------

const served = allQuestions.filter((q) => evidence[q.id]);
const perFormat = new Map<string, number>();
for (const q of served) perFormat.set(formatOf(q), (perFormat.get(formatOf(q)) ?? 0) + 1);

console.log(`${allQuestions.length} questions, ${served.length} with evidence, ${served.filter((q) => isCustom(q.id)).length} of them added in this fork.`);
console.log(`By format: ${[...perFormat].map(([format, count]) => `${format} ${count}`).join(", ")}.`);
console.log(`${outOfOutlineIds.size} original questions are left out as outside the 1.11 outline (src/withheld.ts).`);
if (docsFlag !== -1) console.log(`${quotesChecked} quotes looked up in the docs source.`);
for (const warning of warnings) console.log(`warning  ${warning}`);
for (const error of errors) console.log(`error    ${error}`);
console.log(`${errors.length} errors, ${warnings.length} warnings.`);
process.exit(errors.length > 0 ? 1 : 0);
