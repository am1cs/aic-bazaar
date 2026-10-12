import { beforeAll, describe, expect, it } from 'vitest';
import { Connection } from '@solana/web3.js';
import { createBazaarClient } from '@aic-bazaar/sdk';
import type { Deal } from '../../shared/api';
import manifest from '../../deployment/devnet.json';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
describe('Live Devnet read-only frontend SDK verification',()=>{
  let completed:Deal, resolved:Deal;
  beforeAll(async()=>{
    const client=createBazaarClient({connection:new Connection(manifest.rpcUrl,'confirmed'),wallet:null,programId:manifest.programId});
    completed=await client.getDeal(manifest.demoDeals.completed);
    resolved=await client.getDeal(manifest.demoDeals.resolved);
  });
  it('reads the real completed PDA without a wallet and preserves exact monetary state',()=>{
    expect(completed.address).toBe(manifest.demoDeals.completed);expect(completed.status).toBe('completed');
    expect(completed.budgetLamports).toBe('300000000');expect(completed.remainingBudgetLamports).toBe('0');expect(completed.lockedBondLamports).toBe('0');
    expect(completed.milestones.every(x=>x.paidAt!==null&&x.submission!==null)).toBe(true);
    expect(completed.milestones.map(x=>x.amountLamports)).toEqual(['60000000','90000000','150000000']);
  });
  it('reads the real refund resolution and keeps previously paid materials',()=>{
    expect(resolved.address).toBe(manifest.demoDeals.resolved);expect(resolved.status).toBe('resolved');expect(resolved.resolution?.outcome).toBe('refund');
    expect(resolved.remainingBudgetLamports).toBe('0');expect(resolved.lockedBondLamports).toBe('0');
    expect(resolved.milestones[0].paidAt).not.toBeNull();expect(resolved.milestones[0].submission?.url).toMatch(/^https:\/\//);
    expect(resolved.milestones[1].paidAt).toBeNull();expect(resolved.currentMilestone).toBeNull();
  });
  it('public demo file bytes match all on-chain SHA-256 fingerprints',()=>{
    for(const [index,file] of ['concept.svg','draft.mp4','final.mp4'].entries()){
      const bytes=readFileSync(new URL(`../public/demo/${file}`,import.meta.url));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(completed.milestones[index].submission?.sha256);
    }
  });
});
