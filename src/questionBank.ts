import { customQuestions } from "./customQuestions";
import { formatQuestions } from "./formatQuestions";
import { examQuestions } from "./questions";
import { Question } from "./types";
import { outOfOutlineIds } from "./withheld";

/** Every question in the app: the multiple-choice bank, the fill-in-the-blank, matching, build-list and hotspot items, and the questions added in this fork, without the ones listed in `withheld.ts`. */
export const allQuestions: Question[] = [...examQuestions, ...formatQuestions, ...customQuestions].filter((q) => !outOfOutlineIds.has(q.id));
