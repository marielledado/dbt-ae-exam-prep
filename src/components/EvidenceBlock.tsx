import { ExternalLink, FlaskConical, Quote } from "lucide-react";
import { evidence } from "../evidenceBank";
import FormattedText from "./FormattedText";

/** Quotes are verbatim docs markdown; show a link's text and drop its target, which the page link already covers. */
const withoutLinkTargets = (text: string) => text.replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1");

/** The documentation quote (or dbt run) that backs a question's answer key. */
export default function EvidenceBlock({ questionId }: { questionId: number }) {
  const entry = evidence[questionId];
  if (!entry) return null;
  return (
    <div className="mt-4 space-y-2">
      {entry.quotes.map((q, i) => (
        <figure key={i} className="border-l-2 border-[#FF694B]/50 pl-3 text-xs text-gray-700">
          <blockquote className="flex gap-1.5">
            <Quote className="w-3 h-3 text-[#FF694B]/70 shrink-0 mt-0.5" />
            <span className="select-text">
              <FormattedText text={withoutLinkTargets(q.text)} />
            </span>
          </blockquote>
          <figcaption className="mt-1">
            <a href={q.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#FF694B] hover:underline font-medium">
              dbt docs: {q.page} <ExternalLink className="w-3 h-3" />
            </a>
          </figcaption>
        </figure>
      ))}
      {entry.run && (
        <div className="flex gap-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-3">
          <FlaskConical className="w-4 h-4 text-[#FF694B] shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">Checked by running dbt Core {entry.run.dbtVersion}</p>
            <pre className="mt-1 text-[11px] text-gray-600 whitespace-pre-wrap break-words font-mono">{entry.run.commands.join("\n")}</pre>
            <p className="mt-1 text-gray-600">{entry.run.observed}</p>
          </div>
        </div>
      )}
    </div>
  );
}
