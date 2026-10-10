// "My data" is for one person's own machine: email is the only key, so anyone who can reach the API
// could read or delete any stored email's data. Off unless MY_DATA=on, and never in production.

type Env = Record<string, string | undefined>;

export function myDataEnabled(env: Env = process.env): boolean {
  return env.MY_DATA?.trim().toLowerCase() === 'on';
}

/** Throws at startup when MY_DATA=on in production. */
export function assertMyDataAllowed(env: Env = process.env): void {
  if (myDataEnabled(env) && env.NODE_ENV === 'production') {
    throw new Error('MY_DATA=on is for local use only: its data is keyed by email alone, with no sign-in. Turn it off in production.');
  }
}
