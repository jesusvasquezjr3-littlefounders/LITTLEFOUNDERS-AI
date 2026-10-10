/*
 * Logs are one JSON object per line on stdout. They never carry personal data: no address, no
 * username, no code, no token, no cookie. A request is described by its method, its route pattern
 * (never the raw URL, which can hold a code in a query string), its status and how long it took.
 */
type Fields = Record<string, string | number | boolean | null | undefined>;

function write(level: 'info' | 'warn' | 'error', event: string, fields: Fields): void {
  const line = JSON.stringify({ at: new Date().toISOString(), level, service: 'core', event, ...fields });

  if (level === 'error') console.error(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields: Fields = {}) => write('info', event, fields),
  warn: (event: string, fields: Fields = {}) => write('warn', event, fields),
  error: (event: string, fields: Fields = {}) => write('error', event, fields),
};

/** What is safe to log about a failure: its kind and message, never a value the user sent. */
export function describeError(error: Error): Fields {
  return { errorName: error.name, errorMessage: error.message.slice(0, 200) };
}

/** Anything thrown becomes an Error, so the rest of the code never handles a value of unknown shape. */
export function toError(thrown: unknown): Error {
  return thrown instanceof Error ? thrown : new Error(String(thrown));
}
