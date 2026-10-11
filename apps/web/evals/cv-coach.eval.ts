import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { it } from "vitest";
import { graphql, saveMyData, searchMyData } from "@/lib/api/server";
import {
  blockContents,
  COVER_LETTER_BLOCK,
  MATCH_BLOCK,
  parseCoverLetterBlock,
  parseMatchBlock,
  parseProfileBlock,
  parsePdfBlock,
  parseTailoredBlock,
  PDF_BLOCK,
  PROFILE_BLOCK,
  TAILORED_BLOCK,
  type PdfDocument,
  type Profile,
} from "@/lib/chat";
import { chatConfig, configuredPersona } from "@/lib/chat/server";
import type { ChatTurn, LlmClient, ProviderId } from "@/lib/llm";
import { getClient } from "@/lib/llm/server";
import { profileChunks } from "@/lib/my-data/server";
import { CASES, type EvalCase } from "./cases";
import { CALIBRATION, judgePrompt, parseVerdict } from "./judge";
import { expectedProfile, mean, scoreLetterShape, scoreMatch, scoreProfile, scoreRecall, scoreTailored } from "./score";

// The CV coach eval: each case through the real model, as the chat sends it (the career persona, the
// app's output cap and effort), scored against known answers. Costs money: run it on purpose, with
// `pnpm --filter @brighte/web eval` (see evals/README.md), not in `pnpm test`.

const env = process.env;
const config = chatConfig();
const persona = configuredPersona({ ...config, persona: "career" });
const RUNS = Number(env.EVAL_RUNS ?? 3);
const CONCURRENCY = Number(env.EVAL_CONCURRENCY ?? 4);
const TASKS = new Set((env.EVAL_TASKS ?? "profile,match,tailor,letter,judge,recall,pdf").split(",").map((task) => task.trim()));
const cases = env.EVAL_CASES ? CASES.filter((testCase) => env.EVAL_CASES!.split(",").includes(testCase.id)) : CASES;

type Model = { client: LlmClient; id: string; key: string };

/** "anthropic:claude-haiku-4-5": the provider's client and the full model id (a prefix finds the dated one). */
async function resolveModel(spec: string): Promise<Model> {
  const [provider, wanted] = spec.split(/:(.*)/) as [ProviderId, string];
  const client = getClient(provider);
  if (!client) throw new Error(`No API key for ${provider}: set it in the root .env.`);
  // Also loads each model's effort levels into the client.
  const models = await client.listModels();
  const model = models.find((candidate) => candidate.id === wanted) ?? models.find((candidate) => candidate.id.startsWith(wanted));
  if (!model) throw new Error(`${spec} isn't available. ${provider} has: ${models.map((candidate) => candidate.id).join(", ")}`);
  return { client, id: model.id, key: `${provider}:${model.id}` };
}

async function ask(model: Model, messages: ChatTurn[], system = persona.system): Promise<string> {
  let text = "";
  for await (const chunk of model.client.streamChat({ model: model.id, system, messages, maxOutputTokens: persona.maxOutputTokens, effort: config.effort, signal: AbortSignal.timeout(180_000) })) {
    text += chunk;
  }
  return text;
}

/** Runs `tasks` at most `limit` at a time, in order of results. */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array<T>(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (next < tasks.length) {
        const index = next++;
        results[index] = await tasks[index]();
      }
    }),
  );
  return results;
}

const withCv = (testCase: EvalCase, content: string): ChatTurn => ({ role: "user", content, attachments: [{ kind: "text", name: "cv.txt", text: testCase.cv }] });

/**
 * The conversation after the profile was read: the expected profile, so later steps are judged on
 * their own. The next message confirms it, as a visitor would (the persona tailors only once checked).
 */
const afterProfile = (testCase: EvalCase): ChatTurn[] => [
  withCv(testCase, "Read my CV into a profile"),
  { role: "assistant", content: `Here's your profile.\n\n\`\`\`${PROFILE_BLOCK}\n${JSON.stringify(expectedProfile(testCase))}\n\`\`\`` },
];

/**
 * The newest block of this language in the reply, parsed, or why it isn't there: `asked` when the
 * reply has no block at all (the model asked a question or pushed back instead), `broken` when the
 * block doesn't parse (cut off, or the wrong shape).
 */
function block<T>(reply: string, language: string, parse: (code: string) => T | undefined): { value: T } | { invalid: string; outcome: "asked" | "broken" } {
  const codes = blockContents(reply, language);
  const value = codes.map(parse).findLast((parsed) => parsed !== undefined);
  if (value !== undefined) return { value };
  if (codes.length) return { invalid: `a \`\`\`${language} block that doesn't parse`, outcome: "broken" };
  return { invalid: `asked instead: "${reply.slice(0, 200).replace(/\s+/g, " ")}…"`, outcome: "asked" };
}

/**
 * The pdf export tool: what the visitor types, and which document it should export (none: it must
 * not trigger). Asked after a conversation that already has a profile, a tailored CV and, last, a
 * cover letter, so "it" means the letter.
 */
const PDF_REQUESTS: { message: string; expect?: PdfDocument; withoutLetter?: boolean }[] = [
  { message: "PDF please", expect: "coverletter" },
  { message: "Great, download it", expect: "coverletter" },
  { message: "Can I get my CV as a PDF?", expect: "cv" },
  { message: "export the tailored CV", expect: "tailored" },
  { message: "I'd like to print my cover letter", expect: "coverletter" },
  { message: "save the tailored one as a file", expect: "tailored" },
  { message: "What would you change in the second paragraph of the letter?" },
  { message: "Download my cover letter", withoutLetter: true },
];

/** The conversation the pdf requests follow: profile, tailored CV, then (unless left out) a cover letter. */
function withDocuments(testCase: EvalCase, letter: boolean): ChatTurn[] {
  const job = { title: "the advertised role" };
  const tailored = { job, work: (expectedProfile(testCase).work ?? []).slice(0, 1).map((_, role) => ({ role })) };
  const coverLetter = { job, greeting: "Dear Hiring Manager,", paragraphs: ["I'm applying for the advertised role."], closing: "Kind regards," };
  return [
    ...afterProfile(testCase),
    { role: "user", content: `That profile is right. Tailor my CV for this job:\n\n${testCase.jobAd}` },
    { role: "assistant", content: `Here's your tailored CV.\n\n\`\`\`${TAILORED_BLOCK}\n${JSON.stringify(tailored)}\n\`\`\`` },
    ...(letter
      ? ([
          { role: "user", content: "Now write a cover letter for it." },
          { role: "assistant", content: `Here's your letter.\n\n\`\`\`${COVER_LETTER_BLOCK}\n${JSON.stringify(coverLetter)}\n\`\`\`` },
        ] satisfies ChatTurn[])
      : []),
  ];
}

type Run = { case: string; run: number; task: string; invalid?: string; outcome?: "asked" | "broken"; error?: string; score?: unknown; reply?: string };

it("CV coach eval", async () => {
  const model = await resolveModel(env.EVAL_MODEL ?? config.defaultModel);
  const judge = TASKS.has("judge") || TASKS.has("letter") ? await resolveModel(env.EVAL_JUDGE_MODEL ?? "anthropic:claude-sonnet-5-5") : undefined;
  console.log(`Model ${model.key}, judge ${judge?.key ?? "none"}, ${cases.length} cases × ${RUNS} runs, tasks: ${[...TASKS].join(", ")}`);

  const jobs: (() => Promise<Run>)[] = [];
  const attempt = (testCase: EvalCase, run: number, task: string, work: () => Promise<Omit<Run, "case" | "run" | "task">>) =>
    jobs.push(async () => {
      try {
        return { case: testCase.id, run, task, ...(await work()) };
      } catch (error) {
        return { case: testCase.id, run, task, error: String(error) };
      }
    });

  for (const testCase of cases) {
    for (let run = 1; run <= RUNS; run++) {
      if (TASKS.has("profile")) {
        attempt(testCase, run, "profile", async () => {
          const reply = await ask(model, [withCv(testCase, "Read my CV into a profile")]);
          const result = block(reply, PROFILE_BLOCK, parseProfileBlock);
          return { reply, ...("invalid" in result ? result : { score: scoreProfile(result.value, testCase) }) };
        });
      }
      if (TASKS.has("match")) {
        attempt(testCase, run, "match", async () => {
          const reply = await ask(model, [withCv(testCase, `How well does my CV match this job? This is the full job ad:\n\n${testCase.jobAd}`)]);
          const result = block(reply, MATCH_BLOCK, parseMatchBlock);
          return { reply, ...("invalid" in result ? result : { score: scoreMatch(result.value, testCase) }) };
        });
      }
      if (TASKS.has("tailor")) {
        attempt(testCase, run, "tailor", async () => {
          const reply = await ask(model, [...afterProfile(testCase), { role: "user", content: `That profile is right. Tailor my CV for this job. This is the full job ad:\n\n${testCase.jobAd}` }]);
          const result = block(reply, TAILORED_BLOCK, parseTailoredBlock);
          return { reply, ...("invalid" in result ? result : { score: scoreTailored(result.value, testCase) }) };
        });
      }
      if (TASKS.has("letter")) {
        attempt(testCase, run, "letter", async () => {
          const reply = await ask(model, [...afterProfile(testCase), { role: "user", content: `That profile is right. Write a cover letter for this job. This is the full job ad:\n\n${testCase.jobAd}` }]);
          const result = block(reply, COVER_LETTER_BLOCK, parseCoverLetterBlock);
          if ("invalid" in result) return { reply, ...result };
          const profile: Profile = expectedProfile(testCase);
          const verdict = parseVerdict(await ask(judge!, [{ role: "user", content: judgePrompt(profile, testCase.jobAd, result.value) }], "You are a careful fact checker."));
          const unsupported = verdict?.claims.filter((claim) => !claim.supported) ?? [];
          return {
            reply,
            score: {
              shape: scoreLetterShape(result.value, profile),
              claims: verdict?.claims.length,
              unsupported: verdict ? unsupported.map((claim) => `${claim.claim} (${claim.reason})`) : undefined,
              judgeFailed: !verdict,
            },
          };
        });
      }
    }
  }
  if (TASKS.has("pdf")) {
    // Only the first case: what's tested is the wording, not the CV.
    for (let run = 1; run <= RUNS; run++) {
      for (const request of PDF_REQUESTS) {
        attempt(cases[0], run, "pdf", async () => {
          const reply = await ask(model, [...withDocuments(cases[0], !request.withoutLetter), { role: "user", content: request.message }]);
          const got = blockContents(reply, PDF_BLOCK).map(parsePdfBlock).findLast(Boolean)?.document;
          return { reply, score: { message: request.message, expected: request.expect, got, right: got === request.expect, rewrote: Boolean(request.expect) && hasDocument(reply) } };
        });
      }
    }
  }
  const runs = await pool(jobs, CONCURRENCY);

  // The judge's calibration: letters with a known number of unsupported claims.
  const calibration = TASKS.has("judge")
    ? await pool(
        CALIBRATION.map((sample) => async () => {
          const reference = CASES.find((testCase) => testCase.id === "frontend-senior")!;
          const verdict = parseVerdict(await ask(judge!, [{ role: "user", content: judgePrompt(expectedProfile(reference), reference.jobAd, sample.letter) }], "You are a careful fact checker."));
          const found = verdict?.claims.filter((claim) => !claim.supported).length;
          return { name: sample.name, expected: sample.unsupported, found, flagged: verdict?.claims.filter((claim) => !claim.supported).map((claim) => claim.claim) };
        }),
        CONCURRENCY,
      )
    : [];

  // My data recall: the expected profile saved under a throwaway email, searched, deleted. Needs the
  // API running with MY_DATA=on; deterministic, so it runs once per case.
  const recall: { case: string; query: string; hit: boolean; rank?: number }[] = [];
  let recallSkipped: string | undefined;
  if (TASKS.has("recall")) {
    const headers = new Headers();
    for (const testCase of cases) {
      const email = `eval-${testCase.id}-${Date.now()}@eval.example.com`;
      try {
        const profile = expectedProfile(testCase);
        await saveMyData({ email, kind: "PROFILE", title: profile.basics.name, content: profile, chunks: profileChunks(profile) }, headers);
        for (const { query, expect } of testCase.recall) recall.push({ case: testCase.id, query, ...scoreRecall(await searchMyData(email, query, 6, headers), expect) });
      } catch (error) {
        recallSkipped = `Recall skipped: ${String(error)}. Run the API with MY_DATA=on (root .env) to include it.`;
        break;
      } finally {
        await graphql("mutation($email: String!) { deleteMyData(email: $email) }", { email }, { requestHeaders: headers }).catch(() => undefined);
      }
    }
  }

  const report = summarise(runs, calibration, recall, recallSkipped);
  console.log(report.text);
  const file = path.join(import.meta.dirname, "results", `${new Date().toISOString().replace(/[:.]/g, "-")}-${model.id}.json`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ model: model.key, judge: judge?.key, runs: RUNS, summary: report.summary, calibration, recall, results: runs }, null, 2));
  console.log(`\nFull results: ${path.relative(process.cwd(), file)}`);
});

type Calibration = { name: string; expected: number; found?: number; flagged?: string[] };

/** The reply wrote a document again, which an export request shouldn't (an edit request should). */
const hasDocument = (reply: string) => [PROFILE_BLOCK, TAILORED_BLOCK, COVER_LETTER_BLOCK].some((language) => blockContents(reply, language).length > 0);

const pct = (value?: number) => (value === undefined ? "–" : `${Math.round(value * 100)}%`);

/** The headline numbers per task, and the problems worth reading, as text. */
function summarise(runs: Run[], calibration: Calibration[], recall: { case: string; query: string; hit: boolean; rank?: number }[], recallSkipped?: string) {
  const lines: string[] = [];
  const problems: string[] = [];
  const of = (task: string) => runs.filter((run) => run.task === task);
  const scored = <T>(task: string) => of(task).flatMap((run) => (run.score ? [{ run, score: run.score as T }] : []));
  const failures = (task: string) => {
    for (const run of of(task)) if (run.invalid || run.error) problems.push(`[${task}] ${run.case} #${run.run}: ${run.invalid ?? run.error}`);
    return of(task).filter((run) => run.score).length;
  };
  /** Of a task's runs: how many asked instead of answering, and how many broke (bad block or an error). */
  const outcomes = (task: string) => ({
    askedInstead: of(task).filter((run) => run.outcome === "asked").length / of(task).length,
    broken: of(task).filter((run) => run.outcome === "broken" || run.error).length / of(task).length,
  });
  const summary: Record<string, unknown> = {};

  if (of("profile").length) {
    const ok = failures("profile");
    const scores = scored<ReturnType<typeof scoreProfile>>("profile");
    for (const { run, score } of scores) {
      for (const item of score.invented) problems.push(`[profile] ${run.case} #${run.run}: not in the CV: ${item.path} = "${item.text}"`);
      for (const role of score.extraRoles) problems.push(`[profile] ${run.case} #${run.run}: role not in the CV: ${role}`);
      for (const date of score.wrongDates) problems.push(`[profile] ${run.case} #${run.run}: ${date}`);
      if (score.extraSkills.length) problems.push(`[profile] ${run.case} #${run.run}: skills not in the CV's skills section: ${score.extraSkills.join(", ")}`);
      if (!score.emailRight) problems.push(`[profile] ${run.case} #${run.run}: wrong or invented email`);
    }
    summary.profile = {
      valid: ok / of("profile").length,
      ...outcomes("profile"),
      runsWithoutInventions: scores.filter(({ score }) => score.invented.length === 0 && score.extraRoles.length === 0).length / Math.max(scores.length, 1),
      roleRecall: mean(scores.map(({ score }) => score.roleRecall)),
      dateAccuracy: mean(scores.map(({ score }) => score.dateAccuracy)),
      bulletRecall: mean(scores.map(({ score }) => score.bulletRecall)),
      skillRecall: mean(scores.map(({ score }) => score.skillRecall)),
      emailRight: scores.filter(({ score }) => score.emailRight).length / Math.max(scores.length, 1),
    };
  }

  if (of("match").length) {
    const ok = failures("match");
    const scores = scored<ReturnType<typeof scoreMatch>>("match");
    for (const { run, score } of scores) {
      for (const credit of score.falseCredits) problems.push(`[match] ${run.case} #${run.run}: FALSE CREDIT: "${credit}" reported as met`);
      for (const disagreement of score.disagreements) problems.push(`[match] ${run.case} #${run.run}: ${disagreement}`);
    }
    summary.match = {
      valid: ok / of("match").length,
      ...outcomes("match"),
      coverage: mean(scores.map(({ score }) => score.coverage)),
      statusAccuracy: mean(scores.map(({ score }) => score.statusAccuracy)),
      falseCredits: scores.reduce((total, { score }) => total + score.falseCredits.length, 0),
    };
  }

  if (of("tailor").length) {
    const ok = failures("tailor");
    const scores = scored<ReturnType<typeof scoreTailored>>("tailor");
    for (const { run, score } of scores) for (const flag of score.blocking) problems.push(`[tailor] ${run.case} #${run.run}: BLOCKING: ${flag}`);
    summary.tailor = {
      valid: ok / of("tailor").length,
      ...outcomes("tailor"),
      downloadable: scores.filter(({ score }) => score.blocking.length === 0).length / Math.max(scores.length, 1),
      warningsPerCv: mean(scores.map(({ score }) => score.warnings.length)),
    };
  }

  if (of("letter").length) {
    const ok = failures("letter");
    type LetterScore = { shape: ReturnType<typeof scoreLetterShape>; claims?: number; unsupported?: string[]; judgeFailed: boolean };
    const scores = scored<LetterScore>("letter");
    for (const { run, score } of scores) {
      for (const claim of score.unsupported ?? []) problems.push(`[letter] ${run.case} #${run.run}: UNSUPPORTED: ${claim}`);
      if (score.judgeFailed) problems.push(`[letter] ${run.case} #${run.run}: the judge's answer didn't parse`);
      if (!score.shape.inRange) problems.push(`[letter] ${run.case} #${run.run}: ${score.shape.paragraphs} paragraphs, ${score.shape.words} words (asked: 3-5, 250-400)`);
      if (score.shape.contactInBody.length) problems.push(`[letter] ${run.case} #${run.run}: contact details in the body: ${score.shape.contactInBody.join(", ")}`);
    }
    const judged = scores.filter(({ score }) => !score.judgeFailed);
    summary.letter = {
      valid: ok / of("letter").length,
      ...outcomes("letter"),
      lettersWithoutUnsupportedClaims: judged.filter(({ score }) => score.unsupported?.length === 0).length / Math.max(judged.length, 1),
      unsupportedClaims: judged.reduce((total, { score }) => total + (score.unsupported?.length ?? 0), 0),
      claimsChecked: judged.reduce((total, { score }) => total + (score.claims ?? 0), 0),
      inShape: scores.filter(({ score }) => score.shape.inRange).length / Math.max(scores.length, 1),
    };
  }

  if (of("pdf").length) {
    type PdfScore = { message: string; expected?: PdfDocument; got?: PdfDocument; right: boolean; rewrote: boolean };
    failures("pdf");
    const scores = scored<PdfScore>("pdf");
    for (const { run, score } of scores) {
      if (!score.right) problems.push(`[pdf] #${run.run} "${score.message}": expected ${score.expected ?? "no export"}, got ${score.got ?? "no export"}`);
      if (score.rewrote) problems.push(`[pdf] #${run.run} "${score.message}": wrote the document again`);
    }
    summary.pdf = {
      right: scores.filter(({ score }) => score.right).length / Math.max(scores.length, 1),
      exportsRight: mean(scores.filter(({ score }) => score.expected).map(({ score }) => (score.right ? 1 : 0))),
      falseExports: scores.filter(({ score }) => !score.expected && score.got).length,
      rewrote: scores.filter(({ score }) => score.rewrote).length,
    };
  }

  if (calibration.length) {
    summary.judgeCalibration = { correct: calibration.filter((sample) => sample.found === sample.expected).length, of: calibration.length };
  }
  if (recall.length) {
    summary.recall = { hitAt6: recall.filter((item) => item.hit).length / recall.length, mrr: mean(recall.map((item) => (item.rank ? 1 / item.rank : 0))) };
    for (const item of recall.filter((entry) => !entry.hit)) problems.push(`[recall] ${item.case}: "${item.query}" didn't find its chunk in the top 6`);
  }

  const s = summary as Record<string, Record<string, number | undefined>>;
  lines.push("", "CV coach eval", "=============");
  if (s.profile) lines.push(`Profile       wrote it ${pct(s.profile.valid)} (asked instead ${pct(s.profile.askedInstead)}, broken ${pct(s.profile.broken)}) · runs without inventions ${pct(s.profile.runsWithoutInventions)} · roles ${pct(s.profile.roleRecall)} · dates ${pct(s.profile.dateAccuracy)} · bullets ${pct(s.profile.bulletRecall)} · skills ${pct(s.profile.skillRecall)} · email ${pct(s.profile.emailRight)}`);
  if (s.match) lines.push(`Match report  wrote it ${pct(s.match.valid)} (asked instead ${pct(s.match.askedInstead)}, broken ${pct(s.match.broken)}) · coverage ${pct(s.match.coverage)} · status right ${pct(s.match.statusAccuracy)} · false credits ${s.match.falseCredits}`);
  if (s.tailor) lines.push(`Tailored CV   wrote it ${pct(s.tailor.valid)} (asked instead ${pct(s.tailor.askedInstead)}, broken ${pct(s.tailor.broken)}) · downloadable (no blocking flags) ${pct(s.tailor.downloadable)} · warnings per CV ${s.tailor.warningsPerCv?.toFixed(1)}`);
  if (s.letter) lines.push(`Cover letter  wrote it ${pct(s.letter.valid)} (asked instead ${pct(s.letter.askedInstead)}, broken ${pct(s.letter.broken)}) · without unsupported claims ${pct(s.letter.lettersWithoutUnsupportedClaims)} (${s.letter.unsupportedClaims} of ${s.letter.claimsChecked} claims) · in shape ${pct(s.letter.inShape)}`);
  if (s.pdf) lines.push(`PDF export    right ${pct(s.pdf.right)} · exported the right document ${pct(s.pdf.exportsRight)} · exported when it shouldn't ${s.pdf.falseExports} · wrote the document again ${s.pdf.rewrote}`);
  if (s.judgeCalibration) lines.push(`Judge         calibration ${s.judgeCalibration.correct}/${s.judgeCalibration.of} letters scored right${calibration.some((sample) => sample.found !== sample.expected) ? `: ${calibration.filter((sample) => sample.found !== sample.expected).map((sample) => `"${sample.name}" found ${sample.found ?? "nothing"}`).join("; ")}` : ""}`);
  if (s.recall) lines.push(`Recall        hit@6 ${pct(s.recall.hitAt6)} · MRR ${s.recall.mrr?.toFixed(2)}`);
  if (recallSkipped) lines.push(recallSkipped);
  lines.push("", problems.length ? `Problems (${problems.length})` : "No problems found.", ...problems.map((problem) => `- ${problem}`));
  return { summary, text: lines.join("\n") };
}
