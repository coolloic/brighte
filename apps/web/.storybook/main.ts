import path from "node:path";
import type { StorybookConfig } from "@storybook/nextjs-vite";
import remarkGfm from "remark-gfm";
import { mergeConfig, type Plugin } from "vite";

// Tailwind (PostCSS) only scans for classes when its stylesheet is processed, and a file created while
// Storybook runs doesn't trigger that: its new classes had no CSS until globals.scss was saved again.
// Reload globals.scss whenever a source file is added, which is what that manual save did.
const globalsScss = path.resolve(import.meta.dirname, "../src/app/globals.scss");
const rescanTailwindOnNewFiles: Plugin = {
  name: "rescan-tailwind-on-new-files",
  configureServer(server) {
    server.watcher.on("add", (file) => {
      if (!/\.(tsx?|mdx)$/.test(file)) return;
      for (const mod of server.moduleGraph.getModulesByFile(globalsScss) ?? []) void server.reloadModule(mod);
    });
  },
};

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: [
    {
      name: "@storybook/addon-docs",
      // GitHub-flavoured Markdown (tables, task lists) in MDX docs pages.
      options: { mdxPluginOptions: { mdxCompileOptions: { remarkPlugins: [remarkGfm] } } },
    },
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
  ],
  framework: { name: "@storybook/nextjs-vite", options: {} },
  // Hide Storybook's own onboarding and release notices: the sidebar is for our components.
  features: { sidebarOnboardingChecklist: false, menuOnboardingChecklist: false },
  core: { disableWhatsNewNotifications: true },
  viteFinal: (config) => mergeConfig(config, { plugins: [rescanTailwindOnNewFiles] }),
};

export default config;
