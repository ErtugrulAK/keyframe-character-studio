/**
 * Where the REST API listens.
 *
 * The editor is a local, single-user application: it persists through the
 * browser's local storage, and this API is a separate documented surface that
 * carries **no authentication and no authorization** at all. Binding every
 * interface by default therefore published a writable project store to whatever
 * network the machine is on. It now binds the loopback interface, and reaching
 * beyond this machine is an explicit opt-in.
 */
export const DEFAULT_API_HOST = '127.0.0.1';

/** The variable that opts into a wider bind; nothing else changes the host. */
export const API_HOST_VARIABLE = 'KCS_API_HOST';

/** True for the addresses that only accept connections from this machine. */
export const isLoopbackHost = (host) =>
  host === 'localhost' || host === '::1' || /^127\./u.test(host);

/**
 * The host to bind and whether that keeps the API on this machine. A blank or
 * absent setting is the default; the value is taken verbatim otherwise, so an
 * operator can name a specific interface instead of every interface.
 */
export const resolveBindHost = (env = process.env) => {
  const requested = typeof env?.[API_HOST_VARIABLE] === 'string' ? env[API_HOST_VARIABLE].trim() : '';
  const host = requested === '' ? DEFAULT_API_HOST : requested;
  return { host, loopback: isLoopbackHost(host) };
};

/** What the server prints once it is listening, so the operator knows what it published. */
export const bindMessage = ({ host, loopback }, port) =>
  loopback
    ? `Keyframe Studio REST API listening on http://${host}:${port} (this machine only)`
    : `Keyframe Studio REST API listening on http://${host}:${port} — reachable from the network, and it has NO authentication: anyone who can reach this port can read, overwrite and delete the stored projects. Set ${API_HOST_VARIABLE}=${DEFAULT_API_HOST} to keep it on this machine.`;
