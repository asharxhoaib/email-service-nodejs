import { promises as dns } from 'dns';

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Small, representative disposable-domain blocklist. In production this is
// usually loaded from a maintained list; kept inline here for zero-dep runtime.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  '10minutemail.com',
  'guerrillamail.com',
  'trashmail.com',
  'yopmail.com',
  'throwawaymail.com',
  'getnada.com',
  'dispostable.com',
]);

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function isValidFormat(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function isDisposable(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return !!domain && DISPOSABLE_DOMAINS.has(domain);
}

/** DNS MX lookup. Returns true if the domain can receive mail. */
export async function hasMxRecord(email: string): Promise<boolean> {
  const domain = email.split('@')[1];
  if (!domain) return false;
  try {
    const records = await dns.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
}

/**
 * Full validation. `checkMx` is optional because DNS lookups add latency and
 * are skipped in unit tests / offline environments.
 */
export async function validateEmail(
  email: string,
  checkMx = false,
): Promise<ValidationResult> {
  if (!email || !isValidFormat(email)) {
    return { valid: false, reason: 'Invalid email format' };
  }
  if (isDisposable(email)) {
    return { valid: false, reason: 'Disposable email addresses are not allowed' };
  }
  if (checkMx && !(await hasMxRecord(email))) {
    return { valid: false, reason: 'Domain has no MX record' };
  }
  return { valid: true };
}
