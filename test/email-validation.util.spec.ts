import {
  isValidFormat,
  isDisposable,
  validateEmail,
} from '../src/common/utils/email-validation.util';

describe('email validation util', () => {
  it('accepts well-formed addresses', () => {
    expect(isValidFormat('user@example.com')).toBe(true);
    expect(isValidFormat('a.b+tag@sub.domain.co')).toBe(true);
  });

  it('rejects malformed addresses', () => {
    expect(isValidFormat('no-at-sign')).toBe(false);
    expect(isValidFormat('a@b')).toBe(false);
    expect(isValidFormat('')).toBe(false);
  });

  it('flags disposable domains', () => {
    expect(isDisposable('x@mailinator.com')).toBe(true);
    expect(isDisposable('x@gmail.com')).toBe(false);
  });

  it('validateEmail returns reasons without MX check', async () => {
    expect((await validateEmail('bad')).valid).toBe(false);
    expect((await validateEmail('x@mailinator.com')).reason).toMatch(/disposable/i);
    expect((await validateEmail('good@example.com')).valid).toBe(true);
  });
});
