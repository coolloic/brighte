import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { alertWith, visitorIp } from "./support";

// The e2e web server talks to a mock Anthropic API (e2e/mock-llm.mjs) and allows 3 messages per
// visitor (playwright.config.ts). Every test is a different visitor, so rate limits don't carry over.
test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": visitorIp() });
  await page.goto("/");
});

const messageBox = (page: Page) => page.getByRole("textbox", { name: "Message" });
const log = (page: Page) => page.getByRole("log", { name: "Conversation" });

async function sendMessage(page: Page, text: string) {
  await messageBox(page).fill(text);
  await messageBox(page).press("Enter");
}

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
}

test.describe("chat page", () => {
  test("is the home page, and the old /chat address leads to it", async ({ page }) => {
    const response = await page.goto("/chat");
    expect(response?.request().redirectedFrom()?.url()).toMatch(/\/chat$/);
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("CV coach");
    // The header's wordmark links home.
    await expect(page.getByRole("banner").getByRole("link", { name: "CV coach" })).toHaveAttribute("href", "/");
  });

  test("has one h1, landmarks, SEO metadata and the model picker", async ({ page }) => {
    await expect(page).toHaveTitle("CV coach");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /how well your CV matches a job/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new URL(page.url()).origin);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("CV coach");
    await expect(page.getByRole("main")).toBeVisible();
    // The models come from the provider's models API (here the mock's one model).
    // A compact button under the message box opens the provider and model selects.
    const picker = page.getByRole("button", { name: "Model: Claude Haiku 4.5, Anthropic" });
    await expect(picker).toHaveAttribute("aria-expanded", "false");
    await expectNoA11yViolations(page);
    await picker.click();
    await expect(page.getByRole("combobox", { name: "Provider" })).toHaveValue("anthropic");
    await expect(page.getByRole("combobox", { name: "Model" })).toHaveValue("anthropic:claude-haiku-4-5");
    // Escape closes it and puts focus back on the button.
    await page.getByRole("combobox", { name: "Model" }).focus();
    await page.keyboard.press("Escape");
    await expect(picker).toHaveAttribute("aria-expanded", "false");
    await expect(picker).toBeFocused();
    await expect(log(page)).toContainText("Hi! Attach your CV and the job description");
    await expectNoA11yViolations(page);
  });

  test("uses 90% of the screen width on desktop: header, chat and footer", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "A desktop layout; phones keep theirs");
    // Wider than the other pages' 1152px cap, so 90% (1440px) can't match it by chance.
    await page.setViewportSize({ width: 1600, height: 900 });
    const target = 1600 * 0.9;
    const width = async (locator: ReturnType<Page["locator"]>) => (await locator.boundingBox())!.width;
    expect(await width(page.getByRole("banner").locator(":scope > div"))).toBeCloseTo(target, 0);
    expect(await width(page.getByRole("main"))).toBeCloseTo(target, 0);
    expect(await width(page.getByRole("contentinfo").locator(":scope > p"))).toBeCloseTo(target, 0);
    // The chat card fills the main area (inside its side padding), not a narrow column.
    const main = await page.getByRole("main").evaluate((el) => el.clientWidth - parseFloat(getComputedStyle(el).paddingLeft) - parseFloat(getComputedStyle(el).paddingRight));
    expect(await width(page.getByRole("region", { name: "CV coach" }))).toBeCloseTo(main, 0);
  });

  test("sends a message with Enter and streams the reply", async ({ page }) => {
    await sendMessage(page, "Which services will you offer?");

    await expect(log(page)).toContainText("You: Which services will you offer?");
    await expect(log(page)).toContainText("You said: Which services will you offer?");
    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    // Ready for the next message: the box is empty and still focused, the suggestions are gone.
    await expect(messageBox(page)).toHaveValue("");
    await expect(messageBox(page)).toBeFocused();
    await expect(page.getByRole("list", { name: "Suggested questions" })).toBeHidden();
    await expectNoA11yViolations(page);
  });

  test("shows a Markdown reply as a list and table, and the visitor's text as typed", async ({ page }) => {
    await sendMessage(page, "**Services?** [markdown]");

    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    await expect(log(page)).toContainText("You: **Services?** [markdown]");
    // "##" sits under the chat's h2.
    await expect(log(page).getByRole("heading", { level: 4, name: "Services" })).toBeVisible();
    await expect(log(page).getByRole("listitem").first()).toHaveText("Delivery to your door");
    await expect(log(page).locator("strong")).toHaveText("Delivery");
    await expect(log(page).getByRole("table")).toContainText("At launch");
    await expectNoA11yViolations(page);
  });

  test("shows a match block as a match report", async ({ page }) => {
    await sendMessage(page, "How well do I fit? [match]");

    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    await expect(log(page).getByRole("heading", { level: 3, name: "Front-end Engineer · Acme" })).toBeVisible();
    await expect(log(page)).toContainText("72% match");
    await expect(log(page)).toContainText("1 met · 1 missing");
    await expect(log(page)).toContainText("Want me to tailor your CV?");
    await expect(log(page).getByText("Preparing match report…")).toHaveCount(0);
    await expectNoA11yViolations(page);
  });

  test("explains a match block it can't show", async ({ page }) => {
    await sendMessage(page, "How well do I fit? [match-broken]");

    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    await expect(log(page)).toContainText("This match report couldn't be shown. It may have been cut off: ask me to try again, or to check fewer requirements.");
    await expect(log(page).getByText("Preparing match report…")).toHaveCount(0);
  });

  test("shows a profile, and collapses the earlier one after a correction", async ({ page }) => {
    await sendMessage(page, "Read my CV into a profile [profile]");
    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    await expect(log(page).getByRole("heading", { level: 3, name: "Jane Citizen" })).toBeVisible();
    await expect(log(page)).toContainText("Mar 2021 – Present");

    await sendMessage(page, "My Globex role ended in 2020 [profile]");
    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    const earlier = log(page).getByText("Earlier version of your profile");
    await expect(earlier).toHaveCount(1);
    // Both replies hold a profile; only the newest is shown until the earlier one is opened.
    const shownProfiles = log(page).locator("h3", { hasText: "Jane Citizen" }).filter({ visible: true });
    await expect(shownProfiles).toHaveCount(1);
    // A real click opens the earlier version.
    await earlier.click();
    await expect(shownProfiles).toHaveCount(2);
    await expectNoA11yViolations(page);
  });

  test("explains a profile it can't show", async ({ page }) => {
    await sendMessage(page, "Read my CV into a profile [profile-broken]");
    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    await expect(log(page)).toContainText("This profile couldn't be shown. It may have been cut off: ask me to try again.");
    await expect(log(page).getByText("Preparing your profile…")).toHaveCount(0);
  });

  test("tailors the CV against the profile, flagging what's new", async ({ page }) => {
    await sendMessage(page, "Read my CV into a profile [profile]");
    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    await sendMessage(page, "Tailor my CV for this job [tailored]");
    await expect(log(page)).toHaveAttribute("aria-busy", "false");

    await expect(log(page).getByRole("heading", { level: 3, name: "Tailored for Senior Front-end Engineer · Brightpath" })).toBeVisible();
    await expect(log(page).getByRole("heading", { level: 4, name: "2 things to check" })).toBeVisible();
    await expect(log(page).getByRole("list", { name: "Fix before downloading" })).toContainText("Led a team of 10 engineers.");
    await expect(log(page).getByRole("list", { name: "Worth a look" })).toContainText("Not in your profile: GraphQL");
    // Facts come from the profile. Checked inside the tailored CV: the profile above shows the same role.
    const tailored = log(page).locator("article").filter({ has: page.getByRole("heading", { level: 3, name: /^Tailored for/ }) });
    await expect(tailored.getByText("Senior Front-end Engineer · Acme Lending", { exact: true })).toBeVisible();
    await tailored.getByText(/^Review changes:/).click();
    await expect(tailored.getByText("Original: Led the React rebuild of the loan portal.")).toBeVisible();
    await expect(tailored.getByText("Front-end Engineer · Globex Insurance")).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("explains a tailored CV it can't show", async ({ page }) => {
    await sendMessage(page, "Read my CV into a profile [profile]");
    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    await sendMessage(page, "Tailor my CV [tailored-broken]");
    await expect(log(page)).toHaveAttribute("aria-busy", "false");
    await expect(log(page)).toContainText("This tailored CV couldn't be shown. It may have been cut off: ask me to try again.");
  });

  test.describe("CV files", () => {
    test("downloads the profile as a PDF and saves it as JSON", async ({ page }) => {
      await sendMessage(page, "Read my CV into a profile [profile]");
      await expect(log(page)).toHaveAttribute("aria-busy", "false");
      const profile = log(page).locator("article").filter({ has: page.getByRole("heading", { level: 3, name: "Jane Citizen" }) });

      const pdfDownload = page.waitForEvent("download");
      await profile.getByRole("button", { name: "Download PDF" }).click();
      const pdf = await pdfDownload;
      expect(pdf.suggestedFilename()).toBe("Jane-Citizen-CV.pdf");
      const bytes = await readFile((await pdf.path())!);
      expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

      const jsonDownload = page.waitForEvent("download");
      await profile.getByRole("button", { name: "Save profile" }).click();
      const json = await jsonDownload;
      expect(json.suggestedFilename()).toBe("Jane-Citizen-profile.json");
      const saved = JSON.parse(await readFile((await json.path())!, "utf8"));
      expect(saved.basics.name).toBe("Jane Citizen");
      expect(saved.work[0].employer).toBe("Acme Lending");
    });

    test("won't download a tailored CV with things to fix, and does once it's clean", async ({ page }) => {
      await sendMessage(page, "Read my CV into a profile [profile]");
      await expect(log(page)).toHaveAttribute("aria-busy", "false");
      await sendMessage(page, "Tailor my CV [tailored]");
      await expect(log(page)).toHaveAttribute("aria-busy", "false");
      const blocked = log(page).locator("article").filter({ has: page.getByRole("heading", { level: 3, name: /^Tailored for/ }) });
      await expect(blocked.getByRole("button", { name: "Download PDF" })).toBeDisabled();
      await expect(blocked).toContainText("Fix 1 thing before downloading");

      await sendMessage(page, "Fix it [tailored-clean]");
      await expect(log(page)).toHaveAttribute("aria-busy", "false");
      const clean = log(page).locator("article").filter({ has: page.getByRole("heading", { level: 3, name: /^Tailored for/ }) }).filter({ visible: true }).last();
      const download = page.waitForEvent("download");
      await clean.getByRole("button", { name: "Download PDF" }).click();
      expect((await download).suggestedFilename()).toBe("Jane-Citizen-CV-Brightpath.pdf");
    });

    test("writes a cover letter signed from the profile, and downloads it as a PDF", async ({ page }) => {
      await sendMessage(page, "Read my CV into a profile [profile]");
      await expect(log(page)).toHaveAttribute("aria-busy", "false");
      await sendMessage(page, "Write a cover letter for this job [coverletter]");
      await expect(log(page)).toHaveAttribute("aria-busy", "false");
      const letter = log(page).locator("article").filter({ has: page.getByRole("heading", { level: 3, name: "Cover letter for Senior Front-end Engineer · Brightpath" }) });
      await expect(letter).toContainText("Dear Hiring Manager,");
      // The sender's details come from the profile, not the letter block.
      await expect(letter).toContainText("jane@example.com");
      await expectNoA11yViolations(page);

      const download = page.waitForEvent("download");
      await letter.getByRole("button", { name: "Download PDF" }).click();
      const pdf = await download;
      expect(pdf.suggestedFilename()).toBe("Jane-Citizen-Cover-Letter-Brightpath.pdf");
      const bytes = await readFile((await pdf.path())!);
      expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    });

    test("saves the profile to my data, and a new chat recalls it from the email alone", async ({ page }) => {
      await sendMessage(page, "Read my CV into a profile [profile]");
      await expect(log(page)).toHaveAttribute("aria-busy", "false");
      const profile = log(page).locator("article").filter({ has: page.getByRole("heading", { level: 3, name: "Jane Citizen" }) });
      await profile.getByRole("button", { name: "Save to my data" }).click();
      await expect(profile.getByRole("status")).toContainText("Saved to my data (jane@example.com).");

      // A new chat: nothing in the tab, only the email.
      await page.reload();
      await sendMessage(page, "My email is jane@example.com [recall]");
      await expect(log(page)).toContainText(/Recall: saved profile yes, [1-9]\d* saved chunks\./);
    });

    test("saves a cover letter to my data", async ({ page }) => {
      await sendMessage(page, "Read my CV into a profile [profile]");
      await expect(log(page)).toHaveAttribute("aria-busy", "false");
      await sendMessage(page, "Write a cover letter for this job [coverletter]");
      await expect(log(page)).toHaveAttribute("aria-busy", "false");
      const letter = log(page).locator("article").filter({ has: page.getByRole("heading", { level: 3, name: /^Cover letter for/ }) });
      await letter.getByRole("button", { name: "Save to my data" }).click();
      await expect(letter.getByRole("status")).toContainText("Saved to my data (jane@example.com).");
      await expectNoA11yViolations(page);
    });

    test("doesn't recall anything without an email", async ({ page }) => {
      await sendMessage(page, "What do you know about me? [recall]");
      await expect(log(page)).toContainText("Recall: saved profile no, 0 saved chunks.");
    });

    test("previews the PDF in a dialog", async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "Phones open a new tab instead");
      await sendMessage(page, "Read my CV into a profile [profile]");
      await expect(log(page)).toHaveAttribute("aria-busy", "false");
      const preview = log(page).getByRole("button", { name: "Preview PDF" });
      await preview.click();
      const dialog = page.getByRole("dialog", { name: "CV preview" });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator("iframe")).toHaveAttribute("src", /^blob:/);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(preview).toBeFocused();
    });
  });

  test("sends a suggested question", async ({ page }) => {
    await page.getByRole("button", { name: "How well does my CV match this job?" }).click();
    await expect(log(page)).toContainText("You said: How well does my CV match this job?");
  });

  test("checks the length in the browser and sends nothing when too long", async ({ page }) => {
    let requests = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/api/chat")) requests += 1;
    });
    await sendMessage(page, "x".repeat(8001));

    await expect(messageBox(page)).toHaveAccessibleDescription(/Keep your message to 8000 characters \(it has 8001\)/);
    await expect(messageBox(page)).toHaveAttribute("aria-invalid", "true");
    expect(requests).toBe(0);
  });

  test("explains a failed reply and offers to try again", async ({ page }) => {
    await sendMessage(page, "Please [fail]");

    await expect(alertWith(page, "The assistant couldn't answer just now")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    // The visitor's message stays; the failed reply doesn't.
    await expect(log(page)).toContainText("You: Please [fail]");
  });

  test("rate-limits a visitor after 3 messages", async ({ page }) => {
    for (const n of [1, 2, 3]) {
      await sendMessage(page, `Message ${n}`);
      await expect(log(page)).toContainText(`You said: Message ${n}`);
      // Enter doesn't send while a reply is still streaming in.
      await expect(log(page)).toHaveAttribute("aria-busy", "false");
    }
    await sendMessage(page, "Message 4");

    await expect(alertWith(page, "You've sent a lot of messages")).toBeVisible();
    // Waiting is the only fix: no Try again.
    await expect(page.getByRole("button", { name: "Try again" })).toBeHidden();
  });

  test("stops a reply and keeps what arrived", async ({ page }) => {
    await sendMessage(page, "Tell me a long story [slow]");
    await expect(log(page)).toContainText("word1 ");
    // The provider and model can be switched mid-reply (for the next message).
    const picker = page.getByRole("button", { name: /^Model:/ });
    await picker.click();
    await expect(page.getByRole("combobox", { name: "Model" })).toBeEnabled();
    // A click outside closes it again.
    await page.getByRole("heading", { level: 1 }).click();
    await expect(picker).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "Stop the reply" }).click();

    await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
    await expect(log(page)).toContainText("word1 ");
    await expect(log(page)).not.toContainText("word59");
    // Stopping isn't an error. (Filtered: Next's route announcer is a role="alert" element too.)
    await expect(page.getByRole("alert").filter({ hasText: "Try again" })).toHaveCount(0);
    await expect(alertWith(page, "The reply was cut off")).toHaveCount(0);
  });

  test.describe("attaching files", () => {
    // A real PNG header (the server checks content, not names) and a text file.
    const png = { name: "storefront.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]) };
    const notes = { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("Open 9 to 5.") };
    const fileInput = (page: Page) => page.locator('input[type="file"]');

    test("sends files with a message, and keeps them in context for the next one", async ({ page }) => {
      await fileInput(page).setInputFiles([png, notes]);
      const chips = page.getByRole("list", { name: "Attached files" });
      await expect(chips).toContainText("storefront.png");
      await expect(chips).toContainText("notes.txt");
      await expectNoA11yViolations(page);

      await sendMessage(page, "What are these?");
      // The mock reports what reached it: both files, and prompt caching asked for.
      await expect(log(page)).toContainText("You said: What are these? [files: image, notes.txt; in context: 2; cached]");
      await expect(log(page).getByRole("list", { name: "Attached files" })).toContainText("notes.txt");
      await expect(page.getByRole("button", { name: "Remove notes.txt" })).toBeHidden();
      await expect(log(page)).toHaveAttribute("aria-busy", "false");

      // A follow-up without files: the earlier ones are re-sent, so the model can still see them.
      await sendMessage(page, "And the hours?");
      await expect(log(page)).toContainText("You said: And the hours? [files: none; in context: 2; cached]");
    });

    test("sends files without any text", async ({ page }) => {
      await fileInput(page).setInputFiles([notes]);
      await page.getByRole("button", { name: "Send message" }).click();
      await expect(log(page)).toContainText("[files: notes.txt; in context: 1; cached]");
    });

    test("a removed file isn't sent", async ({ page }) => {
      await fileInput(page).setInputFiles([png, notes]);
      await page.getByRole("button", { name: "Remove storefront.png" }).click();
      await sendMessage(page, "Just the notes");
      await expect(log(page)).toContainText("You said: Just the notes [files: notes.txt; in context: 1; cached]");
    });

    test("sends a large request whole: 9 MB of files, about 12 MB as base64", async ({ page }) => {
      // Above the 10 MB a proxied request body is buffered to: /api/ routes are outside the proxy.
      const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(3 * 1024 * 1024 - 9)]) });
      await fileInput(page).setInputFiles([pdf("a.pdf"), pdf("b.pdf"), pdf("c.pdf")]);
      await sendMessage(page, "Three big ones");
      await expect(log(page)).toContainText("You said: Three big ones [files: a.pdf, b.pdf, c.pdf; in context: 3; cached]");
    });

    test("explains files that can't be attached, and sends nothing for them", async ({ page }) => {
      let requests = 0;
      page.on("request", (request) => {
        if (request.url().endsWith("/api/chat")) requests += 1;
      });
      await fileInput(page).setInputFiles([
        { name: "setup.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ program") },
        // Named like an image, but isn't one.
        { name: "photo.png", mimeType: "image/png", buffer: Buffer.from("not an image") },
        { name: "huge.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) },
      ]);

      await expect(messageBox(page)).toHaveAccessibleDescription(/setup\.exe can't be attached/);
      await expect(messageBox(page)).toHaveAccessibleDescription(/photo\.png can't be attached/);
      await expect(messageBox(page)).toHaveAccessibleDescription(/huge\.pdf is too big: files can be up to 5 MB/);
      await expect(page.getByRole("list", { name: "Attached files" })).toBeHidden();
      expect(requests).toBe(0);
    });
  });
});

