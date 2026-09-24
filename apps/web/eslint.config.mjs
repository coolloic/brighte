import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";
import storybook from "eslint-plugin-storybook";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next already registers the jsx-a11y plugin; enable its strict rule set.
  { rules: jsxA11y.flatConfigs.strict.rules },
  // Atomic design: a layer may only import from layers below it.
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
          patterns: higher.map((h) => ({
            group: [`@/components/${h}/*`, `**/${h}/*`],
            message: `Atomic design: ${layer} must not import from ${h}.`,
          })),
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
