import { describe, expect, it } from 'vitest';
import {
  API_HOST_VARIABLE,
  DEFAULT_API_HOST,
  bindMessage,
  isLoopbackHost,
  resolveBindHost,
} from '../../server/bindHost.js';

/**
 * The API carries no authentication, so *where it listens* is the whole access
 * control. These cases pin the default (this machine only), the explicit opt-in
 * that widens it, and the fact that the operator is told when it is widened.
 */
describe('the API listens on this machine unless it is asked not to', () => {
  it('defaults to loopback when nothing is configured', () => {
    expect(resolveBindHost({})).toEqual({ host: DEFAULT_API_HOST, loopback: true });
    expect(resolveBindHost({ PORT: '5000' })).toEqual({ host: DEFAULT_API_HOST, loopback: true });
  });

  it.each(['', '   '])('treats a blank setting (%j) as the default', (value) => {
    expect(resolveBindHost({ [API_HOST_VARIABLE]: value }).host).toBe(DEFAULT_API_HOST);
  });

  it('binds the address the operator names instead of every interface', () => {
    expect(resolveBindHost({ [API_HOST_VARIABLE]: '192.168.1.10' })).toEqual({
      host: '192.168.1.10',
      loopback: false,
    });
  });

  it.each(['127.0.0.1', '127.0.0.5', 'localhost', '::1'])('keeps %s on this machine', (host) => {
    expect(resolveBindHost({ [API_HOST_VARIABLE]: host })).toEqual({ host, loopback: true });
  });

  it.each(['0.0.0.0', '192.168.1.10', '10.0.0.1'])('does not treat %s as this machine', (host) => {
    expect(isLoopbackHost(host)).toBe(false);
  });

  it('names the exposure and the way back only when the API leaves this machine', () => {
    const local = bindMessage(resolveBindHost({}), 5000);
    const exposed = bindMessage(resolveBindHost({ [API_HOST_VARIABLE]: '0.0.0.0' }), 5000);

    // The local line reports the bind and nothing else.
    expect(local).toContain('127.0.0.1:5000');
    expect(local).not.toContain(API_HOST_VARIABLE);

    // The exposed line says what was published and how to undo it.
    expect(exposed).toContain('0.0.0.0:5000');
    expect(exposed).toContain(`${API_HOST_VARIABLE}=${DEFAULT_API_HOST}`);
    expect(exposed.length).toBeGreaterThan(local.length);
  });
});
