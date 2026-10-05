import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";
import storybook from "eslint-plugin-storybook";

// Import from src/ through the @/ alias (tsconfig paths), not long ../../ chains.
const noDeepRelative = { group: ["../../*"], message: "Use the @/ alias (src/) instead of ../../ paths." };

// Feature folders in src/lib with barrels (apps/web/CLAUDE.md, "Barrels"): from outside the folder,
// import only its index.ts ("@/lib/llm") or its server.ts ("@/lib/llm/server"), never its files.
// Covers relative paths too, from files in src/lib ("./api/...") and its folders ("../llm/...").
// Files inside a folder import each other directly ("./types"), which these patterns don't match.
const LIB_BARRELS = ["api", "chat", "cv-pdf", "llm"];
const libBarrels = LIB_BARRELS.map((folder) => ({
  group: [
    `@/lib/${folder}/*`,
    `!@/lib/${folder}/server`,
    `./${folder}/*`,
    `!./${folder}/server`,
    `../${folder}/*`,
    `!../${folder}/server`,
  ],
  message: `Import from the barrel: "@/lib/${folder}" (safe anywhere) or "@/lib/${folder}/server" (server only).`,
}));

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next already registers the jsx-a11y plugin; enable its strict rule set.
  { rules: jsxA11y.flatConfigs.strict.rules },
  // Our atoms render native controls; tell jsx-a11y so <label><Checkbox /> Delivery</label> counts as labelled.
  {
    rules: {
      "jsx-a11y/label-has-associated-control": ["error", { controlComponents: ["Input", "Checkbox"], depth: 3 }],
      // A scrollable box must be focusable for keyboard users (axe: scrollable-region-focusable), as a
      // labelled <div role="region" tabIndex={0}>.
      "jsx-a11y/no-noninteractive-tabindex": ["error", { tags: [], roles: ["tabpanel", "region"] }],
    },
  },
  { files: ["src/**"], rules: { "no-restricted-imports": ["error", { patterns: [noDeepRelative, ...libBarrels] }] } },
  // Atomic design: a layer may only import from layers below it. These entries replace the rule
  // above for their folders, so they repeat noDeepRelative and libBarrels.
  ...[
    ["atoms", ["molecules", "organisms", "templates"]],
    ["molecules", ["organisms", "templates"]],
    ["organisms", ["templates"]],
  ].map(([layer, higher]) => ({
    files: [`src/components/${layer}/**`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            noDeepRelative,
            ...libBarrels,
            ...higher.map((h) => ({
              group: [`@/components/${h}/*`, `**/${h}/*`],
              message: `Atomic design: ${layer} must not import from ${h}.`,
            })),
          ],
        },
      ],
    },
  })),
  ...storybook.configs["flat/recommended"],
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    ".lighthouseci/**",
    "storybook-static/**",
  ]),
]);

export default eslintConfig;
