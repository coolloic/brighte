/** @type {import('stylelint').Config} */
const config = {
  extends: ["stylelint-config-standard-scss"],
  rules: {
    // Tailwind v4 directives
    "scss/at-rule-no-unknown": [
      true,
      { ignoreAtRules: ["theme", "source", "utility", "variant", "custom-variant", "apply", "reference", "config", "plugin"] },
    ],
    // Mobile-first: only min-width media queries
    "media-feature-name-disallowed-list": [["max-width"], { message: "Mobile-first: use min-width breakpoints, not max-width." }],
  },
  ignoreFiles: [".next/**", "out/**", "playwright-report/**"],
};

export default config;
