# dbt Analytics Engineering exam prep

A practice app for the dbt Analytics Engineering Certification exam, written for dbt Core 1.11. It runs in your browser and needs no account or backend.

You don't have to be taking the exam to use it. It also works as a dbt quiz, or as a knowledge check to find gaps in your understanding of dbt.

It is based on the dbt Labs [study guide for dbt Core 1.11](https://www.getdbt.com/dbt-assets/certifications/dbt-certificate-study-guide-version-1-11). Questions follow the guide's seven topics and use the exam's question formats: multiple choice, discrete option multiple choice (DOMC), fill in the blank, matching, build list and hotspot. Read the guide itself for what each topic covers.

## How answers are checked

The questions were written with an AI assistant. The app only serves a question if its answer is backed by one of these:

- **The dbt docs:** a verbatim quote, with a link to the docs page it comes from.
- **A dbt run:** where the docs don't settle the behaviour, it was reproduced on dbt Core 1.11. The app shows the commands and the output observed. The projects used for these runs are not part of this repo.

Separate AI reviewers were also told to assume the questions had mistakes and to hunt for them: wrong answers, a second defensible option, giveaways in the stem and missing setup. What they found was fixed or the question was withheld. I (Felipe) then went through the questions and removed/edited those that I perceived to be misleading or ambiguous, but some might still remain.

The app shows the evidence next to each explanation, so you can check it yourself. If an answer still looks wrong to you, mark the question as doubtful and the app stops serving it.

Evidence makes mistakes less likely, but it does not rule them out. A quote can be read the wrong way, and docs and dbt versions change.

## Disclaimer

This is a personal project, built in my own time. It is not affiliated with, endorsed by or connected to my employer or dbt Labs, and it does not reflect their views.

The content is provided as is, with no guarantee that the questions or answers are correct or complete. It does not promise any exam result. Check anything that matters against the [dbt docs](https://docs.getdbt.com/).

dbt is a trademark of dbt Labs, used here only to name the exam and the tool.

## Features

- **Full mock exam:** a timed run weighted across the seven topics, with a pass mark.
- **Quick practice quiz:** a short untimed quiz. You pick the number of questions.
- **Topic practice:** one topic at a time.
- **Infinite practice:** works through the whole bank. Questions you have not seen come first, then the ones you got wrong. No question repeats.
- **Answer history:** practice modes favour questions you have not answered yet or got wrong last time.
- **Ask about a question:** copies the question, your answer and its context, ready to paste into a chat assistant.

Your answer history and doubtful marks are stored in your browser's local storage and are never sent anywhere.

## Run it locally

You need [Node.js](https://nodejs.org/) 20.19 or later, which comes with npm.

```bash
git clone https://github.com/ffisc/dbt-ae-exam-prep.git
cd dbt-ae-exam-prep
npm install
npm run dev
```

Then open <http://localhost:3000>.

To build static files for hosting, run `npm run build`. The output goes to `dist/`.

## Built with

React, TypeScript, Vite, Tailwind CSS, Motion and Lucide icons. See `package.json` for versions.

## Project layout

- `src/questions.ts` and `src/formatQuestions.ts`: the question bank.
- `src/evidence.ts`: the source for each answer.
- `src/examTopics.ts`: the seven exam topics and their sub-topics.
- `docs/exam-style-guide.md`: the rules questions are written to.

## Questions added in this fork

This fork adds questions to the original bank and a check that runs on GitHub.

- `src/customQuestions.ts`: the added questions, with ids from 9001.
- `src/customEvidence.ts`: the evidence for each added question. Every entry has the commands and observed output of a run on dbt Core 1.11, and most also have a short quote from the dbt docs.
- `scripts/check-bank.ts`: checks the structure of every question, and looks up every evidence quote in the dbt docs source.
- `.github/workflows/check.yml`: runs the type check and that script on every push and pull request, and every Monday.

To add questions:

1. Add the question to `src/customQuestions.ts` with the next free id, following `docs/exam-style-guide.md`.
2. Add its evidence to `src/customEvidence.ts`.
3. Run the checks:

   ```bash
   git clone --depth 1 https://github.com/dbt-labs/docs.getdbt.com ../dbt-docs
   npm run lint
   npm run check -- --docs ../dbt-docs
   ```

A question added in this fork fails the check when it has no evidence or when one of its quotes is not in the docs source. A quote of the original repo that is not found is reported as a warning only.

## License

[MIT](LICENSE). You can use, change and share this project freely. Copies, changed or not, must keep the copyright notice and license text.

The quotes in `src/evidence.ts` are excerpts from the dbt docs ([docs.getdbt.com](https://docs.getdbt.com/)), copyright dbt Labs. They are used under the Apache License 2.0 of the [docs repository](https://github.com/dbt-labs/docs.getdbt.com), a copy of which is in [`third_party/dbt-docs-LICENSE`](third_party/dbt-docs-LICENSE). The MIT license does not cover them.
