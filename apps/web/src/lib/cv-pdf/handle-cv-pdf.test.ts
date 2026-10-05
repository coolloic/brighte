import { describe, expect, it, vi } from "vitest";
import { handleCvPdf, type CvPdfHandlerDeps } from "./handle-cv-pdf";

const profile = {
  basics: { name: "Jane Citizen" },
  work: [{ employer: "Acme Lending", position: "Engineer", highlights: ["Led the React rebuild."] }],
};
const tailored = (from?: number[]) => ({ job: { title: "Senior Engineer", employer: "Brightpath" }, work: [{ role: 0, highlights: [{ text: "Led the React rebuild of the portal.", from }] }] });

const deps = (overrides: Partial<CvPdfHandlerDeps> = {}): CvPdfHandlerDeps => ({
  takeRateLimit: () => ({ ok: true }),
  trustedHops: 1,
  render: vi.fn(async () => Buffer.from("%PDF-1.3 fake")),
  ...overrides,
});
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/cv-pdf", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("handleCvPdf", () => {
  it("renders the profile as a PDF download", async () => {
    const d = deps();
    const response = await handleCvPdf(post({ profile }), d);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="Jane-Citizen-CV.pdf"');
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(Buffer.from(await response.arrayBuffer()).toString("latin1")).toBe("%PDF-1.3 fake");
    expect(d.render).toHaveBeenCalledWith(expect.objectContaining({ basics: { name: "Jane Citizen" } }));
  });

  it("gives a name with accents an ASCII fallback and the exact UTF-8 filename", async () => {
    const response = await handleCvPdf(post({ profile: { basics: { name: "José Citizen" } } }), deps());
    expect(response.headers.get("content-disposition")).toBe(`attachment; filename="Jos--Citizen-CV.pdf"; filename*=UTF-8''Jos%C3%A9-Citizen-CV.pdf`);
  });

  it("renders a tailored CV merged by the server", async () => {
    const d = deps();
    const response = await handleCvPdf(post({ profile, tailored: tailored([0]) }), d);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="Jane-Citizen-CV-Brightpath.pdf"');
    expect(d.render).toHaveBeenCalledWith(expect.objectContaining({ work: [expect.objectContaining({ employer: "Acme Lending", highlights: ["Led the React rebuild of the portal."] })] }));
  });

  it("refuses a tailored CV with blocking flags", async () => {
    const response = await handleCvPdf(post({ profile, tailored: tailored() }), deps());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "HAS_BLOCKING_FLAGS" });
  });

  it("refuses a tailored CV whose references don't fit the profile sent", async () => {
    const response = await handleCvPdf(post({ profile, tailored: { job: { title: "X" }, work: [{ role: 3 }] } }), deps());
    expect(response.status).toBe(409);
  });

  it.each([
    ["an invalid profile", { profile: { basics: {} } }],
    ["an invalid tailored block", { profile, tailored: { work: [] } }],
    ["no profile", {}],
  ])("rejects %s", async (_, body) => {
    const response = await handleCvPdf(post(body), deps());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "BAD_REQUEST" });
  });

  it("rejects unreadable JSON and other content types", async () => {
    expect((await handleCvPdf(post("{"), deps())).status).toBe(400);
    expect((await handleCvPdf(post({ profile }, { "content-type": "text/plain" }), deps())).status).toBe(415);
  });

  it("rejects a body over 256 KB", async () => {
    const response = await handleCvPdf(post({ profile: { basics: { name: "Jane", summary: "x".repeat(300_000) } } }), deps());
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ code: "TOO_LARGE" });
  });

  it("stops reading a streamed body (no content-length) once it passes the limit", async () => {
    let pulled = 0;
    const chunk = new TextEncoder().encode("x".repeat(64 * 1024));
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += chunk.length;
        if (pulled > 10 * 1024 * 1024) controller.close();
        else controller.enqueue(chunk);
      },
    });
    const request = new Request("http://localhost/api/cv-pdf", { method: "POST", headers: { "content-type": "application/json" }, body, duplex: "half" } as RequestInit);
    const response = await handleCvPdf(request, deps());
    expect(response.status).toBe(413);
    // Not the whole 10 MB: reading stops a chunk or two past 256 KB.
    expect(pulled).toBeLessThan(512 * 1024);
  });

  it("rate-limits per visitor", async () => {
    const takeRateLimit = vi.fn(() => ({ ok: false as const, retryAfterSeconds: 90 }));
    const response = await handleCvPdf(post({ profile }), deps({ takeRateLimit }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("90");
    expect(await response.json()).toEqual({ code: "RATE_LIMITED", retryAfterSeconds: 90 });
    expect(takeRateLimit).toHaveBeenCalledWith("203.0.113.7");
  });

  it("refuses characters the PDF font can't show", async () => {
    const response = await handleCvPdf(post({ profile: { basics: { name: "王小明" } } }), deps());
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ code: "UNSUPPORTED_CHARACTERS", characters: ["王", "小", "明"] });
  });

  it("prints common typographic characters the font lacks, mapped", async () => {
    const d = deps();
    const response = await handleCvPdf(post({ profile: { basics: { name: "Jane Citizen", summary: "React → Next.js, −20% churn" } } }), d);
    expect(response.status).toBe(200);
    expect(d.render).toHaveBeenCalledWith(expect.objectContaining({ basics: expect.objectContaining({ summary: "React -> Next.js, -20% churn" }) }));
  });

  it("reports a render failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleCvPdf(post({ profile }), deps({ render: async () => Promise.reject(new Error("boom")) }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "RENDER_FAILED" });
  });
});
