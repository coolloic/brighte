// Ports come from the root .env (see .env.example), falling back to the defaults.
try {
  process.loadEnvFile(`${__dirname}/../../.env`);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const webPort = process.env.WEB_PORT ?? "3001";

module.exports = {
  ci: {
    collect: {
      url: [`http://localhost:${webPort}/`],
      numberOfRuns: 3,
      settings: { preset: "desktop" },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
      },
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci" },
  },
};
