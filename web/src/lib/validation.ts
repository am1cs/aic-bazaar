import { PublicKey, SystemProgram } from '@solana/web3.js';
import type { CreateDealInput } from '../../../shared/api';
import { parseSol } from './money';

const encoder = new TextEncoder();

export interface CreateFormValues {
  title: string;
  brief: string;
  creator: string;
  arbiter: string;
  client: string;
  budgetSol: string;
  deadlines: [string, string, string];
  referencesUrl: string;
}

export function utf8Bytes(value: string): number {
  return encoder.encode(value).length;
}

export function validateText(value: string, label: string, max: number, allowEmpty = false): void {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
    throw new Error(`${label} must not be blank.`);
  }
  if (utf8Bytes(value) > max) throw new Error(`${label} must be at most ${max} UTF-8 bytes.`);
}

export function validateHttps(value: string, allowEmpty = false): void {
  validateText(value, 'URL', 200, allowEmpty);
  if (allowEmpty && value === '') return;
  if (!value.startsWith('https://') || /[\s\\\u0000-\u001f\u007f-\u009f]/.test(value)) {
    throw new Error('Use a lowercase HTTPS URL without spaces, control characters, or backslashes.');
  }
  const authority = value.slice(8).split(/[/?#]/, 1)[0];
  if (!authority) throw new Error('Use a valid HTTPS URL with a hostname.');
  if (authority.includes('@')) {
    throw new Error('URLs must not contain credentials.');
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
      throw new Error('invalid URL');
    }
  } catch {
    throw new Error('Use a valid HTTPS URL with a hostname and no credentials.');
  }
}

export function validateWalletAddress(value: string): void {
  let key: PublicKey;
  try {
    key = new PublicKey(value);
  } catch {
    throw new Error('Enter a valid Solana wallet address.');
  }
  if (key.equals(SystemProgram.programId) || !PublicKey.isOnCurve(key.toBytes())) {
    throw new Error('Participants must be non-default wallet addresses capable of signing.');
  }
}

function localDeadline(value: string, label: string): number {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new Error(`${label} must be a valid date and time in your local timezone.`);
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0'] = match;
  const [year, month, day, hour, minute, second] = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(hour, minute, second, 0);
  // Date normalizes invalid calendar dates and nonexistent local DST times.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day ||
      date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second) {
    throw new Error(`${label} must be a valid date and time in your local timezone.`);
  }
  const timestamp = date.getTime() / 1000;
  if (!Number.isSafeInteger(timestamp)) throw new Error(`${label} must resolve to whole Unix seconds.`);
  return timestamp;
}

export function validateCreateForm(values: CreateFormValues): CreateDealInput {
  validateText(values.title, 'Title', 64);
  validateText(values.brief, 'Brief', 200);
  validateHttps(values.referencesUrl, true);
  validateWalletAddress(values.client);
  validateWalletAddress(values.creator);
  validateWalletAddress(values.arbiter);
  const client = new PublicKey(values.client);
  const creator = new PublicKey(values.creator);
  const arbiter = new PublicKey(values.arbiter);
  if (client.equals(creator) || client.equals(arbiter) || creator.equals(arbiter)) {
    throw new Error('Customer, creator, and arbiter must be different wallets.');
  }
  const budgetLamports = parseSol(values.budgetSol);
  if (!Array.isArray(values.deadlines) || values.deadlines.length !== 3) {
    throw new Error('Enter three increasing future deadlines.');
  }
  const deadlines: [number, number, number] = [
    localDeadline(values.deadlines[0], 'Concept deadline'),
    localDeadline(values.deadlines[1], 'Draft deadline'),
    localDeadline(values.deadlines[2], 'Final deadline'),
  ];
  const now = Math.floor(Date.now() / 1000);
  if (!(now < deadlines[0] && deadlines[0] < deadlines[1] && deadlines[1] < deadlines[2])) {
    throw new Error('Deadlines must be strictly increasing and in the future.');
  }
  return {
    title: values.title,
    brief: values.brief,
    creator: values.creator,
    arbiter: values.arbiter,
    referencesUrl: values.referencesUrl,
    budgetLamports,
    deadlines,
  };
}
