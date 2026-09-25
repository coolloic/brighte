import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { readToken } from "@/stories/foundations/color";
import { LEADS, leadHref } from "@/stories/fixtures/leads";
import { LeadsTable } from "./LeadsTable";

const meta = {
  title: "Organisms/LeadsTable",
  component: LeadsTable,
  args: { leads: LEADS, hrefFor: leadHref },
  parameters: { layout: "padded" },
} satisfies Meta<typeof LeadsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  play: async ({ canvas, canvasElement }) => {
    // Works at any width: only one layout is visible, so role queries find the visible one.
    await expect(canvas.getByRole("link", { name: "Ada Lovelace" })).toHaveAttribute("href", `/leads/${LEADS[0].id}`);

    // Mobile cards: one per lead, with the formatted mobile and date.
    const cards = canvasElement.querySelector('ul[aria-label="Leads"]')!;
    await expect(cards.querySelectorAll(":scope > li")).toHaveLength(3);
    await expect(cards).toHaveTextContent("0412 345 678");
    await expect(cards).toHaveTextContent("Registered 25 Sept 2026, 9:15 am");

    // Desktop table: column headers, the name as each row's header, one row per lead.
    const table = canvasElement.querySelector("table")!;
    await expect([...table.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual([
      "Name", "Email", "Mobile", "Postcode", "Services", "Registered",
    ]);
    await expect(table.querySelectorAll('tbody th[scope="row"]')).toHaveLength(3);
    await expect(table.querySelector("caption")).toHaveTextContent("Leads");

    // Exactly one layout is shown.
    const shown = [cards, table].filter((el) => getComputedStyle(el).display !== "none");
    await expect(shown).toHaveLength(1);
  },
};

/**
 * The whole row (or card) is the lead's link, not just the name. Hover it in Storybook to see the
 * highlight: CSS :hover needs a real pointer, which story tests don't have.
 */
export const RowIsTheLink: Story = {
  play: async ({ canvasElement }) => {
    // Whichever layout is showing at this width.
    const cards = canvasElement.querySelector('ul[aria-label="Leads"]') as HTMLElement;
    const table = canvasElement.querySelector("table") as HTMLElement;
    const rows = getComputedStyle(cards).display === "none" ? table.querySelectorAll("tbody tr") : cards.querySelectorAll(":scope > li");
    const row = rows[2] as HTMLElement;

    // A point far from the name (the row's right edge) still lands on the lead's link.
    const box = row.getBoundingClientRect();
    await expect(document.elementFromPoint(box.right - 12, box.top + box.height / 2)?.closest("a")).toBe(row.querySelector("a"));
  },
};

/** The lead open in the detail view is highlighted and marked as current. */
export const WithSelection: Story = {
  args: { selectedId: LEADS[1].id },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("link", { name: "Grace Hopper" })).toHaveAttribute("aria-current", "page");
    await expect(canvas.getByRole("link", { name: "Ada Lovelace" })).not.toHaveAttribute("aria-current");

    // The selected lead is tinted, and its badges must not disappear into the tint.
    const tint = `rgb(${readToken("surface-brand")!.join(", ")})`;
    const selectedRow = canvasElement.querySelectorAll("tbody tr")[1] as HTMLElement;
    const selectedCard = canvasElement.querySelectorAll('ul[aria-label="Leads"] > li')[1] as HTMLElement;
    for (const container of [selectedRow, selectedCard]) {
      await expect(getComputedStyle(container).backgroundColor).toBe(tint);
      for (const badge of container.querySelectorAll('[aria-label="Services"] span')) {
        await expect(getComputedStyle(badge).backgroundColor).not.toBe(tint);
      }
    }
  },
};

/** Skeletons in the same layout as the loaded list: cards on mobile, the table from md. */
/**
 * Sortable columns: each header is a link to its sort; the sorted one has aria-sort and an arrow.
 * Mobile, Services have no sort.
 */
export const Sortable: Story = {
  args: {
    leads: LEADS,
    sort: { column: "name", direction: "ascending" },
    sortHrefFor: (column) => `?sort=${column}`,
  },
  play: async ({ canvasElement }) => {
    const headers = [...canvasElement.querySelectorAll<HTMLTableCellElement>("table thead th")];
    const header = (label: string) => headers.find((th) => th.textContent?.trim() === label)!;

    await expect(header("Name")).toHaveAttribute("aria-sort", "ascending");
    await expect(header("Name").querySelector("a")).toHaveAttribute("href", "?sort=name");
    // Only the sorted column carries aria-sort.
    await expect(header("Email")).not.toHaveAttribute("aria-sort");
    await expect(header("Registered").querySelector("a")).toHaveAttribute("href", "?sort=registered");
    await expect(header("Mobile").querySelector("a")).toBeNull();
    await expect(header("Services").querySelector("a")).toBeNull();
    // 44px targets.
    await expect(header("Postcode").querySelector("a")!.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  },
};

export const Loading: Story = {
  args: { status: "loading" },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector("[aria-busy='true']")).not.toBeNull();
    await expect(canvas.getByText("Loading leads")).toBeInTheDocument();

    const cards = canvasElement.querySelector("ul")!;
    const table = canvasElement.querySelector("table")!;
    await expect(cards.querySelectorAll(":scope > li")).toHaveLength(3);
    // The table skeleton has the real column headers and one skeleton row per placeholder.
    await expect([...table.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual([
      "Name", "Email", "Mobile", "Postcode", "Services", "Registered",
    ]);
    await expect(table.querySelectorAll("tbody tr")).toHaveLength(3);
    // Like the loaded list, exactly one layout is shown.
    await expect([cards, table].filter((el) => getComputedStyle(el).display !== "none")).toHaveLength(1);
  },
};

export const Empty: Story = {
  args: { leads: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "No leads yet" })).toBeInTheDocument();
  },
};

export const EmptyForFilter: Story = {
  args: {
    leads: [],
    emptyTitle: "No leads for Pick-up",
    emptyMessage: "Nobody has chosen this service yet.",
    emptyAction: (
      <a href="?" className="font-semibold text-fg-brand underline focus-visible:focus-ring">
        Show all services
      </a>
    ),
  },
};

export const Error: Story = {
  args: { status: "error", retryHref: "?page=2" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("We couldn't load the leads");
    await expect(canvas.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "?page=2");
  },
};
