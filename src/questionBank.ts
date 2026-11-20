import { customQuestions } from "./customQuestions";
import { formatQuestions } from "./formatQuestions";
import { examQuestions } from "./questions";
import { Question } from "./types";

/** Every question in the app: the multiple-choice bank, the fill-in-the-blank, matching, build-list and hotspot items, and the questions added in this fork. */
export const allQuestions: Question[] = [...examQuestions, ...formatQuestions, ...customQuestions];
