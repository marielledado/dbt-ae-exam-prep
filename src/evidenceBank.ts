import { customEvidence } from "./customEvidence";
import { evidence as originalEvidence, type Evidence } from "./evidence";

export type { Evidence };

/** Evidence for every question: the original repo's entries plus the entries for the questions added in this fork. */
export const evidence: Record<number, Evidence> = { ...originalEvidence, ...customEvidence };
