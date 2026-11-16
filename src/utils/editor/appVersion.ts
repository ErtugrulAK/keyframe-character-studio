/**
 * The editor's version, as package.json states it. The build defines
 * `__KCS_VERSION__` (vite.config); a run without that definition (the unit
 * tests) reads "dev" instead of failing.
 */
declare const __KCS_VERSION__: string | undefined;

export const APP_VERSION: string = typeof __KCS_VERSION__ === 'string' ? __KCS_VERSION__ : 'dev';
