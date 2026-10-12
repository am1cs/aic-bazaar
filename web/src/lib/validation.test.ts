import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import { utf8Bytes, validateCreateForm, validateHttps, validateText, validateWalletAddress, type CreateFormValues } from './validation';

// Only public addresses are retained; these are ephemeral test wallets.
const client = Keypair.generate().publicKey.toBase58();
const creator = Keypair.generate().publicKey.toBase58();
const arbiter = Keypair.generate().publicKey.toBase58();

function form(): CreateFormValues {
  return {
    title: 'Vertical launch ad', brief: 'A 15-second vertical advertisement.',
    client, creator, arbiter, budgetSol: '0.001000001', referencesUrl: '',
    deadlines: ['2030-01-02T12:00', '2030-01-03T12:00', '2030-01-04T12:00'],
  };
}

describe('UTF-8 text limits', () => {
  it('counts encoded bytes for ASCII, Cyrillic, and emoji', () => {
    expect(utf8Bytes('abc')).toBe(3);
    expect(utf8Bytes('я')).toBe(2);
    expect(utf8Bytes('🙂')).toBe(4);
    expect(utf8Bytes('aя🙂')).toBe(7);
  });

  it('accepts exactly 64 title bytes and rejects overflow', () => {
    expect(() => validateText('🙂'.repeat(16), 'Title', 64)).not.toThrow();
    expect(() => validateText('🙂'.repeat(16) + 'a', 'Title', 64)).toThrow(/64 UTF-8 bytes/);
  });

  it('accepts exactly 200 brief bytes and rejects overflow', () => {
    expect(() => validateText('я'.repeat(100), 'Brief', 200)).not.toThrow();
    expect(() => validateText('я'.repeat(101), 'Brief', 200)).toThrow(/200 UTF-8 bytes/);
  });

  it.each(['', ' ', '\n\t', '\u00a0'])('rejects blank required text %j', (value) => {
    expect(() => validateText(value, 'Reason', 200)).toThrow(/must not be blank/);
  });
});

describe('HTTPS URLs', () => {
  it('allows a truly empty optional reference', () => {
    expect(() => validateHttps('', true)).not.toThrow();
    expect(() => validateHttps('')).toThrow();
    expect(() => validateHttps(' ', true)).toThrow();
  });

  it.each(['https://example.com', 'https://example.com/path?q=1#frame', 'https://example.com/a%20b'])('allows %s', (value) => {
    expect(() => validateHttps(value)).not.toThrow();
  });

  it.each([
    'http://example.com', 'HTTPS://example.com', 'https://', 'https:///example.com',
    'https://user@example.com', 'https://user:password@example.com', 'https://@example.com',
    'https://example.com/a b', 'https://example.com/\npath', 'https://example.com/\u0000path',
    'https://example.com/\u007fpath', 'https://example.com/\u0085path',
    'https://example.com\\path', ' https://example.com', 'https://example.com ',
  ])('rejects unsafe or malformed URL %j', (value) => {
    expect(() => validateHttps(value)).toThrow();
  });

  it('enforces the exact 200-byte URL limit', () => {
    const prefix = 'https://example.com/';
    const exact = prefix + 'a'.repeat(200 - prefix.length);
    expect(() => validateHttps(exact)).not.toThrow();
    expect(() => validateHttps(exact + 'a')).toThrow(/200 UTF-8 bytes/);
    expect(() => validateHttps(prefix + '🙂'.repeat(46))).toThrow(/200 UTF-8 bytes/);
  });
});

describe('signing participant wallets', () => {
  it('accepts an actual on-curve wallet public key', () => {
    expect(() => validateWalletAddress(creator)).not.toThrow();
  });

  it('rejects invalid, default, and off-curve addresses', () => {
    // Public completed demo deal from the SDK handoff: a PDA, not a signing wallet.
    const pda = new PublicKey('E6z3ZUSy9up26ttcYUDXUBWhGGpbw1y6trfHN4W61C8d');
    expect(PublicKey.isOnCurve(pda.toBytes())).toBe(false);
    for (const value of ['', 'not-a-wallet', SystemProgram.programId.toBase58(), pda.toBase58()]) {
      expect(() => validateWalletAddress(value)).toThrow();
    }
  });
});

describe('create form boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2030, 0, 1, 0, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('returns SDK terms with exact lamports and local Unix seconds', () => {
    const result = validateCreateForm(form());
    expect(result).toEqual({
      creator, arbiter, title: 'Vertical launch ad', brief: 'A 15-second vertical advertisement.',
      referencesUrl: '', budgetLamports: '1000001',
      deadlines: [new Date(2030, 0, 2, 12).getTime() / 1000, new Date(2030, 0, 3, 12).getTime() / 1000, new Date(2030, 0, 4, 12).getTime() / 1000],
    });
    expect(result).not.toHaveProperty('client');
  });

  it.each([
    { creator: client }, { arbiter: client }, { arbiter: creator },
  ])('rejects duplicate participant wallets %j', (overrides) => {
    expect(() => validateCreateForm({ ...form(), ...overrides })).toThrow(/different wallets/);
  });

  it.each([
    '2030-02-29T12:00', '2030-02-31T12:00', '2030-13-01T12:00', '2030-01-02T24:00',
    '2030-01-02T12:60', '2030-01-02T12:00:60', '2030-01-02T12:00:00.500',
    '2030-01-02T12:00Z', '2030-01-02T12:00+05:00', '', 'not-a-date',
  ])('rejects invalid or normalized calendar input %j', (deadline) => {
    const values = form();
    values.deadlines[0] = deadline;
    expect(() => validateCreateForm(values)).toThrow(/date and time/);
  });

  it('accepts a valid leap day and explicit whole seconds', () => {
    const values = form();
    values.deadlines = ['2032-02-29T12:00:01', '2032-02-29T12:00:02', '2032-02-29T12:00:03'];
    expect(validateCreateForm(values).deadlines).toEqual([
      new Date(2032, 1, 29, 12, 0, 1).getTime() / 1000,
      new Date(2032, 1, 29, 12, 0, 2).getTime() / 1000,
      new Date(2032, 1, 29, 12, 0, 3).getTime() / 1000,
    ]);
  });

  it('rejects a nonexistent local time during a daylight-saving transition', () => {
    vi.stubEnv('TZ', 'America/New_York');
    const values = form();
    values.deadlines = ['2030-03-10T02:30', '2030-03-10T04:00', '2030-03-10T05:00'];
    expect(new Date(2030, 2, 10, 2, 30).getHours()).toBe(3);
    expect(() => validateCreateForm(values)).toThrow(/valid date and time/);
    values.deadlines[0] = '2030-03-10T01:30';
    expect(validateCreateForm(values).deadlines[0]).toBe(new Date(2030, 2, 10, 1, 30).getTime() / 1000);
  });

  it('rejects equal and out-of-order deadlines', () => {
    const values = form();
    values.deadlines[1] = values.deadlines[0];
    expect(() => validateCreateForm(values)).toThrow(/strictly increasing/);
    values.deadlines = ['2030-01-04T12:00', '2030-01-03T12:00', '2030-01-02T12:00'];
    expect(() => validateCreateForm(values)).toThrow(/strictly increasing/);
  });

  it('revalidates a deadline that became past while the form was open', () => {
    const values = form();
    expect(() => validateCreateForm(values)).not.toThrow();
    vi.setSystemTime(new Date(2030, 0, 2, 12));
    expect(() => validateCreateForm(values)).toThrow(/in the future/);
  });

  it('validates all money, text, and reference fields before returning terms', () => {
    expect(() => validateCreateForm({ ...form(), title: '🙂'.repeat(17) })).toThrow(/64 UTF-8 bytes/);
    expect(() => validateCreateForm({ ...form(), brief: ' ' })).toThrow(/must not be blank/);
    expect(() => validateCreateForm({ ...form(), budgetSol: '1e-3' })).toThrow();
    expect(() => validateCreateForm({ ...form(), referencesUrl: 'http://example.com' })).toThrow(/HTTPS/);
  });
});
