import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { Pagination } from "@/components/molecules/Pagination";
import { LeadDetail } from "@/components/organisms/LeadDetail";
import { LeadsTable } from "@/components/organisms/LeadsTable";
import { LeadsToolbar } from "@/components/organisms/LeadsToolbar";
import { LEADS, leadHref, SERVICE_OPTIONS } from "@/stories/fixtures/leads";
import { DashboardTemplate } from "./DashboardTemplate";

const toolbar = <LeadsToolbar serviceOptions={SERVICE_OPTIONS} hrefFor={(code) => (code ? `?service=${code}` : "?")} total={LEADS.length} />;
const pagination = <Pagination page={1} pageSize={20} total={LEADS.length} itemLabel="leads" hrefFor={(page) => `?page=${page}`} />;

const meta = {
  title: "Templates/DashboardTemplate",
  component: DashboardTemplate,
  parameters: { layout: "fullscreen" },
  args: {
    title: "Leads",
    toolbar,
    list: <LeadsTable leads={LEADS} hrefFor={leadHref} />,
    pagination,
  },
} satisfies Meta<typeof DashboardTemplate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const List: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    await expect(canvas.getByRole("navigation", { name: "Filter by service" })).toBeInTheDocument();
    await expect(canvas.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    await expect(canvas.queryByRole("complementary", { name: "Selected lead" })).toBeNull();
  },
};

/** From lg: list and detail side by side. Below lg: the detail replaces the list, with a link back. */
export const WithDetail: Story = {
  args: {
    list: <LeadsTable leads={LEADS} hrefFor={leadHref} selectedId={LEADS[0].id} />,
    detail: <LeadDetail lead={LEADS[0]} />,
    backToListHref: "/leads",
  },
  play: async ({ canvas, canvasElement }) => {
    const aside = canvas.getByRole("complementary", { name: "Selected lead" });
    await expect(aside).toContainElement(canvas.getByRole("article", { name: "Ada Lovelace" }));
    const listColumn = canvasElement.querySelector("aside")!.previousElementSibling as HTMLElement;
    const back = canvasElement.querySelector('a[href="/leads"]') as HTMLElement;

    if (window.matchMedia("(min-width: 64rem)").matches) {
      await expect(getComputedStyle(listColumn).display).not.toBe("none");
      await expect(getComputedStyle(back).display).toBe("none");
    } else {
      await expect(getComputedStyle(listColumn).display).toBe("none");
      await expect(back).toBeVisible();
    }
  },
};

export const Loading: Story = {
  args: { list: <LeadsTable leads={[]} hrefFor={leadHref} status="loading" /> },
};
