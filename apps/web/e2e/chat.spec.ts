import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { alertWith, visitorIp } from "./support";

// The e2e web server talks to a mock Anthropic API (e2e/mock-llm.mjs) and allows 3 messages per
// visitor (playwright.config.ts). Every test is a different visitor, so rate limits don't carry over.
test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": visitorIp() });
  await page.goto("/chat");
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
  test("is linked from the home page header", async ({ page }) => {
    await page.goto("/");
    // "Chat" on phones, "Chat with us" from sm up.
    await page.getByRole("banner").getByRole("link", { name: /^Chat/ }).click();

    await expect(page).toHaveURL("/chat");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chat with Brighte Eats");
    await expect(page.getByRole("banner").getByRole("link", { name: /^Chat/ })).toHaveAttribute("aria-current", "page");
  });

  test("has one h1, landmarks, SEO metadata and the model picker", async ({ page }) => {
    await expect(page).toHaveTitle("Chat with Brighte Eats | Brighte Eats");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Brighte Eats assistant/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new URL("/chat", page.url()).href);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chat with Brighte Eats");
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
    await expect(log(page)).toContainText("Hi! I can answer questions about Brighte Eats");
    await expectNoA11yViolations(page);
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

  test("sends a suggested question", async ({ page }) => {
    await page.getByRole("button", { name: "What is Brighte Eats?" }).click();
    await expect(log(page)).toContainText("You said: What is Brighte Eats?");
  });

  test("checks the length in the browser and sends nothing when too long", async ({ page }) => {
    let requests = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/api/chat")) requests += 1;
    });
    await sendMessage(page, "x".repeat(1001));

    await expect(messageBox(page)).toHaveAccessibleDescription(/Keep your message to 1000 characters \(it has 1001\)/);
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

