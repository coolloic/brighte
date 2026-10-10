import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import { handleMyData, type MyDataHandlerDeps } from "./handle-my-data";

const profile = { basics: { name: "Jane Citizen", email: "Jane@Example.com" }, work: [{ employer: "Acme", position: "Engineer", highlights: ["Led the React rebuild."] }] };
const coverLetter = { job: { title: "Engineer", employer: "Brightpath" }, greeting: "Dear Hiring Manager,", paragraphs: ["I led the React rebuild."], closing: "Kind regards," };

const deps = (overrides: Partial<MyDataHandlerDeps> = {}): MyDataHandlerDeps => ({ enabled: true, save: vi.fn(async () => ({})), ...overrides });
const post = (body: unknown, contentType = "application/json") =>
  new Request("http://localhost/api/my-data", { method: "POST", headers: { "content-type": contentType }, body: typeof body === "string" ? body : JSON.stringify(body) });

describe("handleMyData", () => {
  afterEach(() => vi.restoreAllMocks());

  it("saves a profile under its lowercased email, with its chunks", async () => {
    const d = deps();
    const response = await handleMyData(post({ profile }), d);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: "jane@example.com", kind: "PROFILE", title: "Jane Citizen" });
    expect(d.save).toHaveBeenCalledWith(
      expect.objectContaining({ email: "jane@example.com", kind: "PROFILE", content: profile, chunks: expect.arrayContaining(["Engineer · Acme\n- Led the React rebuild."]) }),
    );
  });

  it("saves a cover letter and a clean tailored CV, titled by their job", async () => {
    const d = deps();
    await handleMyData(post({ profile, coverLetter }), d);
    expect(d.save).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "COVER_LETTER", title: "Engineer · Brightpath" }));
    await handleMyData(post({ profile, tailored: { job: { title: "Engineer" }, work: [{ role: 0, highlights: [{ text: "Led the React rebuild of the portal.", from: [0] }] }] } }), d);
    expect(d.save).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "TAILORED_CV", title: "Engineer" }));
  });

  it("refuses a tailored CV with blocking flags", async () => {
    const response = await handleMyData(post({ profile, tailored: { job: { title: "Engineer" }, work: [{ role: 0, highlights: [{ text: "Led a team of 10." }] }] } }), deps());
    expect([response.status, await response.json()]).toEqual([409, { code: "HAS_BLOCKING_FLAGS" }]);
  });

  it("asks for an email when the profile has none", async () => {
    const response = await handleMyData(post({ profile: { basics: { name: "Jane" } } }), deps());
    expect([response.status, await response.json()]).toEqual([422, { code: "NO_EMAIL" }]);
  });

  it.each([
    ["an invalid profile", { profile: { basics: {} } }],
    ["a tailored CV and a letter at once", { profile, coverLetter, tailored: { job: { title: "X" } } }],
  ])("rejects %s", async (_, body) => {
    expect((await handleMyData(post(body), deps())).status).toBe(400);
  });

  it("is 404 when my data is off, and refuses non-JSON", async () => {
    expect((await handleMyData(post({ profile }), deps({ enabled: false }))).status).toBe(404);
    expect((await handleMyData(post({ profile }, "text/plain"), deps())).status).toBe(415);
  });

  it("explains an API that is off or down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const off = await handleMyData(post({ profile }), deps({ save: () => Promise.reject(new ApiError("FORBIDDEN", "off")) }));
    expect([off.status, await off.json()]).toEqual([404, { code: "OFF" }]);
    const down = await handleMyData(post({ profile }), deps({ save: () => Promise.reject(new ApiError("NETWORK_ERROR", "down")) }));
    expect([down.status, await down.json()]).toEqual([503, { code: "UNAVAILABLE" }]);
  });
});
