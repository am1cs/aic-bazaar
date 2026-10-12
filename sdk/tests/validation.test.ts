import { describe, expect, it } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { amounts, hash, httpsUrl, lamports, text, validateCreate } from '../src/validation';
import type { CreateDealInput } from '../../shared/api';

const client = Keypair.generate().publicKey;
const creator = Keypair.generate().publicKey;
const arbiter = Keypair.generate().publicKey;
function input(): CreateDealInput {
  return { creator: creator.toBase58(), arbiter: arbiter.toBase58(), title: 'Launch ad', brief: 'Vertical ad for the launch', referencesUrl: '', budgetLamports: '300000000', deadlines: [1001, 1002, 1003] };
}

describe('money and immutable terms', () => {
  it('matches the agreed 0.3SOL budget and0.03SOL bond', () => {
    expect(amounts('300000000')).toEqual({ budget: 300000000n, bond: 30000000n, milestones: [60000000n, 90000000n, 150000000n] });
  });
  it('preserves every lamport when percentages round down', () => {
    const result = amounts('1000003');
    expect(result.milestones).toEqual([200000n, 300000n, 500003n]);
    expect(result.milestones.reduce((a, b) => a + b, 0n)).toBe(result.budget);
    expect(result.bond).toBe(100000n);
  });
  it.each(['1.5', '-1', '1e9', '1000000001', '999999', '0300000000', 'Infinity', ''])('rejects invalid lamport input%s', (value) => {
    expect(() => lamports(value)).toThrowError(expect.objectContaining({ code: 'invalid_input' }));
  });
  it('requires increasing future integer Unix times', () => {
    expect(() => validateCreate(input(), client, 1000)).not.toThrow();
    for (const deadlines of [[1000, 1002, 1003], [1001, 1001, 1003], [1001.5, 1002, 1003], [1001, 1003, 1002]]) {
      expect(() => validateCreate({ ...input(), deadlines: deadlines as [number, number, number] }, client, 1000)).toThrow();
    }
  });
  it('rejects duplicate participants and default addresses', () => {
    expect(() => validateCreate({ ...input(), creator: client.toBase58() }, client, 1000)).toThrow();
    expect(() => validateCreate({ ...input(), arbiter: creator.toBase58() }, client, 1000)).toThrow();
    expect(() => validateCreate({ ...input(), creator: '11111111111111111111111111111111' }, client, 1000)).toThrow();
  });
});

describe('byte and file bounds', () => {
  it('countsUTF8bytes rather thancharacters', () => {
    expect(() => text('🎬'.repeat(16), 'Title', 64)).not.toThrow();
    expect(() => text('🎬'.repeat(17), 'Title', 64)).toThrow();
    expect(() => text('   ', 'Title', 64)).toThrow();
  });
  it.each(['http://example.com', 'javascript:alert(1)', 'https://user:password@example.com', 'https://example.com/a b', 'https://example.com\\file', 'HTTPS://example.com', 'https://', ''])('rejects unsafeURL%s', (value) => {
    expect(() => httpsUrl(value)).toThrow();
  });
  it('allows empty references and standard HTTPS URLs', () => {
    expect(httpsUrl('', 'References', true)).toBe('');
    expect(httpsUrl('https://example.com/result.mp4?version=2')).toContain('https://');
  });
  it('requires64lowercase hexadecimal hash characters', () => {
    expect(hash('ab'.repeat(32))).toEqual(Array(32).fill(0xab));
    expect(() => hash('AB'.repeat(32))).toThrow();
    expect(() => hash('ab'.repeat(31))).toThrow();
    expect(() => hash('zz'.repeat(32))).toThrow();
  });
});
