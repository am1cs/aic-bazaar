import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { createBazaarClient } from '@aic-bazaar/sdk';
import type { Deal } from '../../shared/api';
import { deployment } from './config';
export function useBazaarClient() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  return useMemo(() => createBazaarClient({ connection, wallet: wallet ?? null, programId: deployment.programId }), [connection, wallet]);
}
export function useDeal(address: string) {
  const client = useBazaarClient();
  const context = useMemo(() => ({ client, address }), [client, address]);
  const currentContext = useRef(context); currentContext.current = context;
  const mounted = useRef(true);
  const [record, setRecord] = useState<{context: typeof context; deal: Deal} | null>(null);
  const [readContext,setReadContext] = useState<typeof context|null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fresh, setFresh] = useState(false);
  const requestId = useRef(0);
  const refresh = useCallback(async () => {
    if (!mounted.current || currentContext.current !== context) return;
    const id = ++requestId.current;
    setReadContext(context); setLoading(true); setFresh(false); setError(null);
    const active = () => mounted.current && currentContext.current === context && id === requestId.current;
    try { const result = await client.getDeal(address); if (active()) { setRecord({context, deal: result}); setFresh(true); } }
    catch (e) { if (active()) setError(e instanceof Error ? e.message : 'Unable to read the deal. Please try again.'); }
    finally { if (active()) setLoading(false); }
  }, [client, address, context]);
  useEffect(() => { mounted.current = true; setRecord(null); void refresh(); return () => { mounted.current = false; requestId.current++; }; }, [refresh]);
  const matches = record?.context === context;
  const adopt = useCallback((deal: Deal) => {
    if (!mounted.current || currentContext.current !== context || deal.address !== context.address) return;
    requestId.current++; setReadContext(context); setRecord({context, deal}); setError(null); setFresh(true); setLoading(false);
  }, [context]);
  const current=readContext===context;
  return { data: matches ? record.deal : null, error:current?error:null, loading:!current||loading, fresh:current&&matches&&fresh, refresh, adopt };
}
export function useDeploymentReady() {
  const {connection} = useConnection();
  const reader = useMemo(() => createBazaarClient({connection,wallet:null,programId:deployment.programId}), [connection]);
  const [ready,setReady] = useState(false); const [error,setError] = useState(''); const [loading,setLoading] = useState(true);
  const generation = useRef(0);
  const verify = useCallback(async () => { const id=++generation.current; setLoading(true); setReady(false); setError(''); try { if (deployment.status !== 'deployed' || !deployment.demoDeals.completed) throw new Error('Devnet deployment evidence is not available yet.'); await reader.getDeal(deployment.demoDeals.completed); if(id===generation.current)setReady(true); } catch(e) {if(id===generation.current)setError(e instanceof Error?e.message:'Unable to verify Devnet deployment.');} finally{if(id===generation.current)setLoading(false);} },[reader]);
  useEffect(()=>{void verify();return()=>{generation.current++;};},[verify]);
  return {ready,error,loading,verify};
}
