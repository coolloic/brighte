/** Fail fast on startup if required configuration is missing or weak. */
export function validateEnv(env: Record<string, unknown>) {
  const errors: string[] = [];
  if (!env.DATABASE_URL) errors.push('DATABASE_URL is required');
  if (typeof env.JWT_SECRET !== 'string' || env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  } else if (env.JWT_SECRET.startsWith('change-me')) {
    errors.push('JWT_SECRET is still the .env.example placeholder');
  }
  if (errors.length) throw new Error(`Invalid environment: ${errors.join('; ')}`);
  return { JWT_EXPIRES_IN: '15m', ...env };
}
