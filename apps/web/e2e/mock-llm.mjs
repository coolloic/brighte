// A stand-in for the Anthropic API, so the e2e chat tests never call (or pay for) a real model.
// The web server's Anthropic SDK is pointed here with ANTHROPIC_BASE_URL (playwright.config.ts).
// It lists one model and streams "You said: <message>". Markers in the message change that:
// "[fail]" answers an API error, "[slow]" streams slowly (to test Stop).
import { createServer } from "node:http";

const MODEL = { type: "model", id: "claude-haiku-4-5", display_name: "Claude Haiku 4.5", created_at: "2025-10-01T00:00:00Z" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  return JSON.parse(body);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");

  if (request.method === "GET" && url.pathname === "/health") return response.end("ok");

  if (request.method === "GET" && url.pathname === "/v1/models") {
    response.setHeader("content-type", "application/json");
    return response.end(JSON.stringify({ data: [MODEL], has_more: false, first_id: MODEL.id, last_id: MODEL.id }));
  }

  if (request.method === "POST" && url.pathname === "/v1/messages") {
    const { messages } = await readJson(request);
    const text = String(messages.at(-1)?.content ?? "");
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
    const words = slow ? Array.from({ length: 60 }, (_, i) => `word${i} `) : ["You said: ", text];
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
