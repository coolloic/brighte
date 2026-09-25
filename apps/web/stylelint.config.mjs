/** @type {import('stylelint').Config} */
const config = {
  extends: ["stylelint-config-standard-scss"],
  rules: {
    // Tailwind v4 directives
    "scss/at-rule-no-unknown": [
      true,
      { ignoreAtRules: ["theme", "source", "utility", "variant", "custom-variant", "apply", "reference", "config", "plugin"] },
    ],
    // kebab-case, plus Tailwind's `--token--modifier` form (e.g. --text-body--line-height)
    "custom-property-pattern": [
      "^[a-z][a-z0-9]*(-[a-z0-9]+)*(--[a-z0-9]+(-[a-z0-9]+)*)?$",
      { message: "Use kebab-case custom properties (Tailwind's --token--modifier is allowed)." },
    ],
    // Mobile-first: only min-width media queries
    "media-feature-name-disallowed-list": [["max-width"], { message: "Mobile-first: use min-width breakpoints, not max-width." }],
  },
  ignoreFiles: [".next/**", "out/**", "playwright-report/**"],
};

export default config;
