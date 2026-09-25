// Ports come from the root .env (see .env.example), falling back to the defaults.
try {
  process.loadEnvFile(`${__dirname}/../../.env`);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const webPort = process.env.WEB_PORT ?? "3001";

const quality = {
  "categories:performance": ["error", { minScore: 0.9 }],
  "categories:accessibility": ["error", { minScore: 0.95 }],
  "categories:best-practices": ["error", { minScore: 0.9 }],
};

module.exports = {
  ci: {
    collect: {
      url: [`http://localhost:${webPort}/`, `http://localhost:${webPort}/admin/login`],
      numberOfRuns: 3,
      settings: { preset: "desktop" },
    },
    assert: {
      assertMatrix: [
        { matchingUrlPattern: "^(?!.*/admin).*$", assertions: { ...quality, "categories:seo": ["error", { minScore: 0.9 }] } },
        // Admin pages are noindex on purpose (they fail is-crawlable), so SEO doesn't apply to them.
        { matchingUrlPattern: "/admin", assertions: quality },
      ],
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci" },
  },
};
