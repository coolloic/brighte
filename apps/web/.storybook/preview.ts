import type { Preview } from "@storybook/nextjs-vite";
import "../src/app/globals.scss";

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: {
      // Same rules as the Playwright axe scans (e2e/), and a violation fails the story test.
      options: { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } },
      test: "error",
    },
  },
};

export default preview;
