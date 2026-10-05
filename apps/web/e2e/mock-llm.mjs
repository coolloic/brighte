// A stand-in for the Anthropic API, so the e2e chat tests never call (or pay for) a real model.
// The web server's Anthropic SDK is pointed here with ANTHROPIC_BASE_URL (playwright.config.ts).
// It lists one model and streams "You said: <message>". Markers in the message change that:
// "[fail]" answers an API error, "[slow]" streams slowly (to test Stop), "[markdown]" replies with a
// Markdown list and table, split mid-syntax across chunks as a real stream would be. "[match]" replies
// with text and a match block whose JSON is split across chunks, "[match-broken]" with a match block
// that never completes. "[profile]" replies with a profile block split across chunks,
// "[profile-broken]" with one that never completes. "[tailored]" replies with a tailored CV block
// (one bullet without a source, one skill not in the profile), "[tailored-broken]" with one that never
// completes. When files were sent, the
// reply says which (in this message, and how many in the whole context), and whether prompt
// caching was asked for: "[files: photo.png, notes.txt; in context: 2; cached]".
import { createServer } from "node:http";

const MODEL = { type: "model", id: "claude-haiku-4-5", display_name: "Claude Haiku 4.5", created_at: "2025-10-01T00:00:00Z" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  return JSON.parse(body);
}

const MATCH_JSON = JSON.stringify({
  title: "Front-end Engineer · Acme",
  score: 72,
  items: [
    { requirement: "React", status: "met", evidence: "8 years of React" },
    { requirement: "GraphQL", status: "missing", suggestion: "Add it if you've used it." },
  ],
});
const half = Math.floor(MATCH_JSON.length / 2);
const MATCH_REPLY = ["Here's how you match.\n\n```match\n", MATCH_JSON.slice(0, half), MATCH_JSON.slice(half), "\n```\n\nWant me to tailor your CV?"];
// Cut off mid-JSON, as when the reply hits the length cap.
const MATCH_BROKEN_REPLY = ["Here's how you match.\n\n```match\n", MATCH_JSON.slice(0, half)];
const PROFILE_JSON = JSON.stringify({
  basics: { name: "Jane Citizen", headline: "Front-end Engineer", email: "jane@example.com" },
  work: [
    {
      employer: "Acme Lending",
      position: "Senior Front-end Engineer",
      start: "2021-03",
      end: "present",
      highlights: ["Led the React rebuild of the loan portal.", "Mentored 2 graduate engineers."],
      skills: ["React", "TypeScript"],
    },
    { employer: "Globex Insurance", position: "Front-end Engineer", start: "2017", end: "2021" },
  ],
});
const profileHalf = Math.floor(PROFILE_JSON.length / 2);
const PROFILE_REPLY = ["Here's your profile.\n\n```profile\n", PROFILE_JSON.slice(0, profileHalf), PROFILE_JSON.slice(profileHalf), "\n```"];
const PROFILE_BROKEN_REPLY = ["Here's your profile.\n\n```profile\n", PROFILE_JSON.slice(0, profileHalf)];
const TAILORED_JSON = JSON.stringify({
  job: { title: "Senior Front-end Engineer", employer: "Brightpath" },
  headline: "Senior Front-end Engineer · React",
  work: [
    {
      role: 0,
      highlights: [
        { text: "Led the React and TypeScript rebuild of the loan portal.", from: [0] },
        { text: "Led a team of 10 engineers." },
      ],
    },
  ],
  skills: [{ keywords: ["React", "GraphQL"] }],
});
const tailoredHalf = Math.floor(TAILORED_JSON.length / 2);
const TAILORED_REPLY = ["Here's your CV tailored for the role.\n\n```tailored\n", TAILORED_JSON.slice(0, tailoredHalf), TAILORED_JSON.slice(tailoredHalf), "\n```"];
const TAILORED_BROKEN_REPLY = ["Here's your CV tailored for the role.\n\n```tailored\n", TAILORED_JSON.slice(0, tailoredHalf)];
const MARKDOWN_REPLY = ["## Services\n\n- **Deli", "very** to your door\n- Pick-up\n\n| Service | When |\n|---|---|\n| Delivery | At launch |\n"];
// Checked in order: a marker that contains another comes first.
const MARKER_REPLIES = [
  ["[match-broken]", MATCH_BROKEN_REPLY],
  ["[match]", MATCH_REPLY],
  ["[profile-broken]", PROFILE_BROKEN_REPLY],
  ["[profile]", PROFILE_REPLY],
  ["[tailored-broken]", TAILORED_BROKEN_REPLY],
  ["[tailored]", TAILORED_REPLY],
  ["[markdown]", MARKDOWN_REPLY],
];

const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");

  if (request.method === "GET" && url.pathname === "/health") return response.end("ok");

  if (request.method === "GET" && url.pathname === "/v1/models") {
    response.setHeader("content-type", "application/json");
    return response.end(JSON.stringify({ data: [MODEL], has_more: false, first_id: MODEL.id, last_id: MODEL.id }));
  }

  if (request.method === "POST" && url.pathname === "/v1/messages") {
    const body = await readJson(request);
    const { messages } = body;
    const blocksOf = (message) => (Array.isArray(message.content) ? message.content : [{ type: "text", text: message.content }]);
    const isFile = (block) => block.type === "image" || block.type === "document";
    const last = blocksOf(messages.at(-1));
    const text = last.filter((block) => block.type === "text").map((block) => block.text).join(" ");
    const files = last.filter(isFile).map((block) => block.title ?? `${block.type}`);
    const inContext = messages.flatMap(blocksOf).filter(isFile).length;
    const fileNote = inContext ? ` [files: ${files.join(", ") || "none"}; in context: ${inContext}${body.cache_control ? "; cached" : ""}]` : "";
    if (text.includes("[fail]")) {
      // 400: the SDK doesn't retry it, so the test sees the failure at once.
      response.writeHead(400, { "content-type": "application/json" });
      return response.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "mock failure" } }));
    }

    response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    const send = (type, data) => response.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
    send("message_start", {
      message: { id: "msg_mock", type: "message", role: "assistant", model: MODEL.id, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } },
    });
    send("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
    const slow = text.includes("[slow]");
    const marked = MARKER_REPLIES.find(([marker]) => text.includes(marker));
    const words = slow ? Array.from({ length: 60 }, (_, i) => `word${i} `) : marked ? marked[1] : ["You said: ", text, fileNote];
    for (const word of words) {
      if (response.destroyed) return;
      send("content_block_delta", { index: 0, delta: { type: "text_delta", text: word } });
      await sleep(slow ? 250 : 20);
    }
    send("content_block_stop", { index: 0 });
    send("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: words.length } });
    send("message_stop", {});
    return response.end();
  }

  response.writeHead(404).end();
});

server.listen(Number(process.env.PORT ?? 3103));
