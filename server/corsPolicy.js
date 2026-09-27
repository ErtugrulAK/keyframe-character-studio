const DEFAULT_EDITOR_HOSTS = ['localhost', '127.0.0.1'];
const DEFAULT_EDITOR_PORTS = [5173, 5187, 5188, 5189];

export const CORS_ORIGINS_VARIABLE = 'KCS_CORS_ORIGINS';

/** Exact browser origins used by the documented local editor and isolated QA servers. */
export const DEFAULT_CORS_ORIGINS = Object.freeze(
  DEFAULT_EDITOR_HOSTS.flatMap((host) => DEFAULT_EDITOR_PORTS.map((port) => `http://${host}:${port}`)),
);

const invalidOrigin = (value) =>
  new Error(
    `${CORS_ORIGINS_VARIABLE} must contain comma-separated exact http(s) origins without paths, credentials, queries or fragments; invalid value: ${JSON.stringify(value)}`,
  );

const parseExactOrigin = (value) => {
  if (value === '' || value === '*' || value === 'null') throw invalidOrigin(value);

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw invalidOrigin(value);
  }

  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.pathname !== '/' ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    throw invalidOrigin(value);
  }

  return parsed.origin;
};

/** Resolves the fixed local allowlist plus explicitly configured extra browser origins. */
export const resolveAllowedCorsOrigins = (env = process.env) => {
  const raw = typeof env?.[CORS_ORIGINS_VARIABLE] === 'string' ? env[CORS_ORIGINS_VARIABLE].trim() : '';
  if (raw === '') return [...DEFAULT_CORS_ORIGINS];

  const extras = raw.split(',').map((value) => parseExactOrigin(value.trim()));
  return [...new Set([...DEFAULT_CORS_ORIGINS, ...extras])];
};

/**
 * CORS controls browser response visibility, not API authorization. Origin-less
 * CLI/server requests remain valid; browser origins receive ACAO only when exact.
 */
export const createCorsOptions = (env = process.env) => {
  const allowedOrigins = new Set(resolveAllowedCorsOrigins(env));
  return {
    origin(origin, callback) {
      callback(null, origin === undefined || allowedOrigins.has(origin));
    },
  };
};
