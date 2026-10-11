# CV coach eval

How accurate the CV coach is, measured: synthetic CVs and job ads with known answers (`cases.ts`), run
through the real model the way the chat sends them (the career persona, the app's output cap and
effort), and scored. It calls paid models, so it's its own command, never part of `pnpm test`.

```bash
pnpm --filter @brighte/web eval
```

Needs a provider key in the root `.env`. The **recall** part also needs the API running with
`MY_DATA=on` (`pnpm dev`); without it, recall is skipped and the rest still runs.

| Variable | Default | What |
|---|---|---|
| `EVAL_MODEL` | `CHAT_DEFAULT_MODEL` (`anthropic:claude-haiku-4-5`) | The model under test (`provider:model`; a prefix finds the dated id) |
| `EVAL_JUDGE_MODEL` | `anthropic:claude-sonnet-5-5` | The cover letter judge. Use a stronger model than the one under test |
| `EVAL_RUNS` | `3` | Runs per case: outputs vary from run to run, so rates matter, not single results |
| `EVAL_CASES` | all | Case ids, comma-separated, e.g. `frontend-senior,no-email` |
| `EVAL_TASKS` | `profile,match,tailor,letter,judge,recall` | Which parts to run |
| `EVAL_CONCURRENCY` | `4` | Model calls at once |

The report prints the headline numbers and every problem found; the full results (every run, with
its scores) go to `evals/results/<time>-<model>.json` (gitignored).

## What is scored

| Output | How | The number to watch |
|---|---|---|
| **Profile** | Every string must be in the CV word for word (the rule is to copy), roles found by employer and title, dates exactly right, bullets and skills against the expected answer | Runs without inventions (target 100%) |
| **Match report** | Each labelled requirement (`match` in a case) must have an item with the expected status | False credits: a requirement the CV doesn't meet, reported as met (target 0) |
| **Tailored CV** | `tailorCv`, the app's own check, against the expected profile | Downloadable: no blocking flags (target 100%) |
| **Cover letter** | A judge model lists each factual claim and whether the profile supports it; plus length (250–400 words, 3–5 paragraphs) and no contact details in the body | Letters without unsupported claims (target 100%) |
| **Recall** (my data) | The expected profile saved under a throwaway email (deleted after), each `recall` question searched | Hit@6 and MRR |

Each output is scored on its own: the tailor and letter steps start from the case's expected
profile, not the model's own extraction, so a profile mistake doesn't count twice.

**"Asked instead"** is a reply with no block at all: the model asked a question or pushed back (e.g.
"you don't have the 3+ years this job asks for") instead of writing it. Not always wrong, but it's
not what was asked for; read those replies in the problems list.

## Trusting the judge

The judge is calibrated on every run: three letters with a known number of unsupported claims (0, 3
and 1; `CALIBRATION` in `judge.ts`). If it doesn't score all three right, don't trust its letter
numbers. Its first run found a claim I'd missed when writing them ("comfortable owning
deployments"), so the expected count was corrected from 2 to 3. Spot-check its verdicts on real
letters too.

## Adding a case

Add an `EvalCase` to `cases.ts`: a CV, a job ad, the expected profile (`expected`, following the
profile rules: dates as precise as the CV, "present" only when the CV says so, skills only from a
skills section), the requirements whose status is clear, and recall questions. `pnpm test` checks
that each expected profile is copied from its CV word for word (`score.test.ts`). Give every case a
trap: the cases that tempt the model to invent are the ones that matter.
