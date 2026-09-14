const PROTOTYPE_SENSITIVE_KEYS = {
  ['__proto__']: true,
  constructor: true,
  prototype: true,
} as const;
const WINDOWS_RESERVED_NAMES: Record<string, true> = {
  CON: true,
  PRN: true,
  AUX: true,
  NUL: true,
  'CLOCK$': true,
  COM0: true,
  COM1: true,
  COM2: true,
  COM3: true,
  COM4: true,
  COM5: true,
  COM6: true,
  COM7: true,
  COM8: true,
  COM9: true,
  LPT0: true,
  LPT1: true,
  LPT2: true,
  LPT3: true,
  LPT4: true,
  LPT5: true,
  LPT6: true,
  LPT7: true,
  LPT8: true,
  LPT9: true,
};
const WINDOWS_INVALID_FILENAME_CHARACTERS = /[<>:"/\\|?*]/u;
const WINDOWS_INVALID_FILENAME_CHARACTERS_GLOBAL = /[<>:"/\\|?*]/gu;
const PACKAGE_UNSAFE_URL_CHARACTERS = /[?#%]/u;
function replaceControlCharacters(value: string): string {
  return Array.from(value, (character) => character.charCodeAt(0) < 0x20 ? '-' : character).join('');
}

export function normalizePackagePath(value: string): string {
  return value.replace(/\\/gu, '/');
}

export function isReservedWindowsName(component: string): boolean {
  const trimmed = component.normalize('NFKC').trim().replace(/[. ]+$/gu, '');
  const stem = trimmed.split('.')[0]?.toUpperCase() || '';
  return WINDOWS_RESERVED_NAMES[stem] === true;
}

export function isPrototypeSensitiveKey(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(PROTOTYPE_SENSITIVE_KEYS, value);
}


export function sanitizeFilenameComponent(input: string, fallback = 'untitled'): string {
  const sanitized = replaceControlCharacters(input.normalize('NFKC'))
    .replace(WINDOWS_INVALID_FILENAME_CHARACTERS_GLOBAL, '-')
    .trim()
    .replace(/[. ]+$/gu, '')
    .replace(/-+/gu, '-');

  if (!sanitized || sanitized === '.' || sanitized === '..' || isReservedWindowsName(sanitized)) {
    return fallback;
  }
  return sanitized;
}

export function isSafePackageRelativePath(value: string): boolean {
  const normalized = normalizePackagePath(value);
  if (!normalized
    || normalized.startsWith('/')
    || /^[a-zA-Z]:/u.test(normalized)
    || PACKAGE_UNSAFE_URL_CHARACTERS.test(normalized)
    || normalized.endsWith('/')
    || /[^\x20-\x7E]/u.test(normalized)) {
    return false;
  }

  const segments = normalized.split('/');
  return segments.every((segment) => segment.length > 0
    && segment !== '.'
    && segment !== '..'
    && !isPrototypeSensitiveKey(segment)
    && !WINDOWS_INVALID_FILENAME_CHARACTERS.test(segment)
    && !/[. ]$/u.test(segment)
    && !isReservedWindowsName(segment));
}

export function hasCaseInsensitiveCollision(values: string[]): boolean {
  const normalized = new Set<string>();
  for (const value of values) {
    const key = normalizePackagePath(value).toLowerCase();
    if (normalized.has(key)) return true;
    normalized.add(key);
  }
  return false;
}
