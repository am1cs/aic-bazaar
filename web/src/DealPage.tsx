import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import type { Deal, MilestoneIndex, MutationResult, Resolution } from '../../shared/api';
import { useBazaarClient, useDeal } from './hooks';
import { useOperation } from './transactions/useOperation';
import { capabilities, roleFor } from './lib/permissions';
import { formatSol } from './lib/money';
import { hashFile, MAX_FILE_BYTES } from './lib/hashing';
import { validateHttps, validateText } from './lib/validation';
import { Address, Alert, Badge, Confirmation, External, Field, Loading, TxLink } from './components';
import { demoReceipts, deployment, explorer } from './config';
const stageNames = ['Concept', 'Draft', 'Final'];
const stageCriteria = ['Three key frames with the scene order.', '15-second vertical 9:16 rough cut, following the approved concept.', '1080×1920 MP4, agreed call to action, no watermark.'];
const time = (seconds: number) => new Date(seconds * 1000).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
type Action = {kind: 'accept' | 'cancel'} | {kind:'approve'; index:MilestoneIndex; revision:1|2; hash:string; amount:string; final:boolean} | {kind:'resolve'; outcome:Resolution; reason:string; clientAmount:string; creatorAmount:string};
export default function DealPage({ disputeOnly = false }: {disputeOnly?:boolean}) {
  const { address = '' } = useParams(); const query = useDeal(address); const client = useBazaarClient(); const wallet = useWallet(); const operation = useOperation();
  const [error, setError] = useState(''); const [action, setAction] = useState<Action|null>(null);
  const [url, setUrl] = useState(''); const [fileName, setFileName] = useState(''); const [hash, setHash] = useState(''); const [hashing, setHashing] = useState(false);
  const [reason, setReason] = useState(''); const [outcome, setOutcome] = useState<Resolution>('refund'); const hashRequest = useRef(0);
  const walletAddress = wallet.publicKey?.toBase58(); const deal = query.data?.address === address ? query.data : null;
  const stageIndex=deal?.currentMilestone;
  const stageKey=`${address}:${walletAddress??''}:${stageIndex??'none'}:${stageIndex!==undefined&&stageIndex!==null?deal?.milestones[stageIndex].submission?.revision??0:0}`;
  const latestStage=useRef(stageKey); latestStage.current=stageKey;
  const [hashStage,setHashStage]=useState('');
  const context = useMemo(()=>({address,walletAddress}),[address,walletAddress]);
  const pageContext = useRef(context); pageContext.current = context;
  const pageMounted = useRef(true);
  const handledReceipt = useRef<{signature:string;context:typeof context}|null>(null);
  useEffect(() => { pageMounted.current = true; return () => { pageMounted.current = false; }; }, []);
  const blocked = operation.snapshot.busy || operation.snapshot.attempt?.state === 'unknown' || !query.fresh;
  useEffect(() => { setAction(null); setError(''); setReason(''); setUrl(''); setHash(''); setFileName(''); setHashing(false); hashRequest.current++; return () => { hashRequest.current++; }; }, [address, walletAddress]);
  useEffect(()=>{setUrl('');setHash('');setHashStage('');setFileName('');setHashing(false);hashRequest.current++;},[stageKey]);
  // After a lost receipt is confirmed by the global recovery panel, refresh this deal.
  useEffect(() => { const a = operation.snapshot.attempt; const handled=handledReceipt.current; if (a?.state === 'confirmed' && a.dealAddress === address && !(handled && handled.signature===a.signature && handled.context===context)) void query.refresh(); }, [operation.snapshot.attempt?.state, operation.snapshot.attempt?.signature, address, context, query.refresh]);
  async function selectFile(file?:File) {
    const origin = context;
    const selectedStage=stageKey;
    const id = ++hashRequest.current; setHash(''); setFileName(file?.name ?? ''); setError('');
    if (!file) { setHashing(false); return; } setHashing(true);
    const active=()=>pageMounted.current&&pageContext.current===origin&&id===hashRequest.current&&latestStage.current===selectedStage;
    try { const next = await hashFile(file); if (active()) {setHash(next);setHashStage(selectedStage);} }
    catch (e) { if (active()) setError(e instanceof Error ? e.message : 'Unable to fingerprint this file.'); }
    finally { if (active()) setHashing(false); }
  }
  async function run(actionName:string, mutate:()=>Promise<MutationResult>) {
    if (!walletAddress || !deal || blocked) return;
    const origin = context;
    const stillCurrent = () => pageMounted.current && pageContext.current === origin;
    setError('');
    try {
      const result = await operation.run({action: actionName, wallet: walletAddress, dealAddress: deal.address}, mutate);
      if (!stillCurrent()) return;
      setAction(null);
      if (result) { handledReceipt.current={signature:result.signature,context:origin}; setHash(''); setUrl(''); setFileName(''); if (result.deal) query.adopt(result.deal); else await query.refresh(); }
      else await query.refresh();
    } catch (e) { if (stillCurrent()) { setAction(null); setError(e instanceof Error ? e.message : 'Operation interrupted. Check the receipt before trying again.'); } }
  }
  async function submit(event:FormEvent) {
    event.preventDefault(); if (!deal || deal.currentMilestone === null || blocked) return;
    try { validateHttps(url); if (hashStage!==stageKey || !/^[0-9a-f]{64}$/.test(hash)) throw new Error('Select a file for this milestone and wait for its SHA-256 fingerprint.'); const index = deal.currentMilestone; const expectedRevision = deal.milestones[index].submission?.revision === 1 ? 1 : 0;
      await run('Submit milestone', () => client.submitMilestone({address:deal.address,index,url,sha256:hash,expectedRevision}));
    } catch (e) { setError(e instanceof Error ? e.message : 'Check the material link and file.'); }
  }
  function openDispute(event:FormEvent) { event.preventDefault(); if (!deal) return; try { validateText(reason,'Dispute reason',200); void run('Open dispute', () => client.openDispute(deal.address,reason)); } catch(e) {setError(e instanceof Error ? e.message : 'Enter a reason.');} }
  function prepareResolution(event:FormEvent) { event.preventDefault(); if (!deal) return; try { validateText(reason,'Resolution reason',200); const current = deal.currentMilestone !== null ? deal.milestones[deal.currentMilestone] : null; if (outcome === 'pay_current' && !current?.submission) throw new Error('The current milestone has no submitted result to pay.'); const budget = BigInt(deal.remainingBudgetLamports), bond = BigInt(deal.lockedBondLamports), pay = outcome === 'pay_current' && current ? BigInt(current.amountLamports) : 0n;
    setAction({kind:'resolve',outcome,reason,clientAmount:(outcome === 'creator_breach' ? budget+bond : budget-pay).toString(),creatorAmount:(outcome === 'creator_breach' ? 0n : pay+bond).toString()});
  } catch(e) {setError(e instanceof Error ? e.message : 'Review the resolution.');} }
  function confirmAction() { if (!action || !deal) return; const captured = action;
    if (captured.kind === 'accept') void run('Accept & deposit',()=>client.acceptDeal(deal.address));
    if (captured.kind === 'cancel') void run('Cancel & refund',()=>client.cancelUnaccepted(deal.address));
    if (captured.kind === 'approve') void run('Approve & pay',()=>client.approveMilestone({address:deal.address,index:captured.index,expectedRevision:captured.revision,expectedHash:captured.hash}));
    if (captured.kind === 'resolve') void run('Resolve dispute',()=>client.resolveDispute(deal.address,captured.outcome,captured.reason));
  }
  if (!deal) return <><div className="page-heading"><h1>{disputeOnly ? 'Deal dispute' : 'Your deal'}</h1></div>{query.loading ? <Loading/> : <Alert tone="error">{query.error ?? 'No deal exists at this address.'}<div className="action-row"><button className="button secondary small" onClick={()=>void query.refresh()}>Try reading again</button><Link to="/" className="button secondary small">Open another deal</Link></div></Alert>}</>;
  const caps = capabilities(deal,walletAddress); const role = roleFor(deal,walletAddress); const current = deal.currentMilestone !== null ? deal.milestones[deal.currentMilestone] : null;
  const closed=['completed','resolved','cancelled'].includes(deal.status);
  const receipts = demoReceipts.filter(tx => 'dealAddress' in tx && tx.dealAddress === deal.address);
  return <>
    <div className="page-heading"><span className="eyebrow">{disputeOnly ? 'DISPUTE & RESOLUTION' : 'YOUR SHARED AGREEMENT'}</span><div className="milestone-header"><h1>{deal.title}</h1><Badge text={deal.status}/></div><p className="page-subtitle">{deal.brief}</p><div className="action-row"><button className="button secondary small" disabled={query.loading} onClick={()=> {setAction(null);void query.refresh();}}>{query.loading ? 'Refreshing…' : 'Refresh from network'}</button><External href={explorer('address',deal.address)}>View on Devnet</External>{!disputeOnly && (deal.dispute || deal.resolution) && <Link to={`/deal/${address}/dispute`}>View dispute →</Link>}{disputeOnly && <Link to={`/deal/${address}`}>← All milestones</Link>}</div></div>
    {query.error && <Alert tone="warning">Network refresh failed. These values may be out of date; actions stay paused. {query.error}</Alert>}
    <p className="section-note">Connected role: <strong>{role === 'client' ? 'client' : role}</strong> · Times in {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
    {!walletAddress && <Alert>Viewing is public. Connect the corresponding participant wallet for actions. <WalletMultiButton/></Alert>}
    <div className="money-grid"><div className="metric"><span>Total budget</span><strong>{formatSol(deal.budgetLamports)} <small>SOL</small></strong></div><div className="metric"><span>Remaining budget</span><strong>{formatSol(deal.remainingBudgetLamports)} <small>SOL</small></strong></div><div className="metric"><span>Locked creator deposit</span><strong>{formatSol(deal.lockedBondLamports)} <small>SOL</small></strong><small>Original: {formatSol(deal.bondLamports)} SOL</small></div></div>
    <div className="detail-grid"><div><section className="card"><h2>Deal participants</h2>{(['client','creator','arbiter'] as const).map(name=><div key={name}><span className="field-help">{name === 'client' ? 'Client' : name === 'creator' ? 'Creator' : 'Named human arbiter'}</span><Address value={deal[name]} label={name}/></div>)}<span className="field-help">Deal address</span><Address value={deal.address} label="deal address"/><p className="field-help">Account rent retained for history: {formatSol(deal.rentReserveLamports)} SOL. Network fees and unsolicited transfers are separate from the budget.</p>{deal.referencesUrl && <External href={deal.referencesUrl}>Open agreed references</External>}
      <p className="field-help">The named arbiter can decide disputed funds. Program upgrade authority: <External href={explorer('address',deployment.upgradeAuthority)}>view public authority</External>. This Devnet prototype does not automate legal copyright transfer.</p>
      <div className="action-row">{caps.accept && <button className="button primary" disabled={blocked} onClick={()=>setAction({kind:'accept'})}>Accept & deposit {formatSol(deal.bondLamports)} SOL</button>}{caps.cancel && <button className="button secondary" disabled={blocked} onClick={()=>setAction({kind:'cancel'})}>Cancel & refund</button>}</div></section>
      {deal.dispute && <section className="card"><span className="eyebrow">DISPUTE</span><h2>{deal.resolution ? 'Resolution recorded' : 'Payments are paused'}</h2><p>{deal.dispute.reason}</p><p className="field-help">Opened {time(deal.dispute.openedAt)} by</p><Address value={deal.dispute.openedBy}/>{deal.resolution && <><Badge text={deal.resolution.outcome}/><p>{deal.resolution.reason}</p><p className="field-help">Resolved {time(deal.resolution.resolvedAt)}. Earlier payouts are retained; this deal is closed.</p></>}</section>}
      {caps.dispute && <form className="card" onSubmit={openDispute}><h2>Need a decision?</h2><p className="field-help">Opening a dispute pauses submission and normal payouts. The named arbiter settles remaining funds and closes the deal.</p><Field id="dispute-reason" label="Reason for the dispute" value={reason} max={200}><textarea id="dispute-reason" rows={3} value={reason} onChange={e=>setReason(e.target.value)} required disabled={blocked}/></Field><button className="button secondary" type="submit" disabled={blocked}>Open dispute</button></form>}
      {caps.resolve && <form className="card" onSubmit={prepareResolution}><h2>Resolve as the named arbiter</h2><Field id="outcome" label="Settlement"><select id="outcome" value={outcome} disabled={blocked} onChange={e=> {setOutcome(e.target.value as Resolution);setAction(null);}}><option value="refund">Refund remaining budget · return creator deposit</option><option value="pay_current" disabled={!caps.payCurrent}>Pay submitted current stage · refund future stages</option><option value="creator_breach">Creator breach · return budget and deposit to client</option></select></Field><Field id="resolution-reason" label="Reason for your decision" value={reason} max={200}><textarea id="resolution-reason" rows={3} value={reason} onChange={e=> {setReason(e.target.value);setAction(null);}} required disabled={blocked}/></Field><p className="field-help">Every settlement closes the deal. Paid stages are not reversed.</p><button className="button primary" type="submit" disabled={blocked}>Review settlement</button></form>}
    </div><div className="milestone-list" aria-label="Project milestones">{deal.milestones.map(stage=><article key={stage.index} className={`milestone-card ${stage.paidAt !== null ? 'paid' : deal.currentMilestone === stage.index ? 'current' : ''}`}><div className="milestone-header"><div><span className="milestone-number">0{stage.index+1}</span><h2>{stageNames[stage.index]}</h2></div><strong>{formatSol(stage.amountLamports)} SOL</strong></div><p>{stageCriteria[stage.index]}</p><div className="milestone-meta"><Badge text={stage.paidAt !== null ? 'paid' : closed ? stage.submission ? 'not paid · deal closed' : 'not started · deal closed' : stage.submission ? 'submitted' : deal.currentMilestone === stage.index ? 'current stage' : 'upcoming'}/><span>Due {time(stage.dueAt)}</span></div>
      {stage.dueAt*1000 < Date.now() && stage.paidAt === null && !closed && <p className="field-help">Deadline passed. This does not automatically release funds or deduct the deposit.</p>}
      {stage.submission && <div className="submission-block"><External href={stage.submission.url}>Open submitted material</External><p className="field-help">Revision {stage.submission.revision} · Submitted {time(stage.submission.submittedAt)}</p><span className="field-help">SHA-256 fingerprint</span><Address value={stage.submission.sha256} label="SHA-256"/>{stage.paidAt === null && !closed && <p className="field-help">Review period ends {time(stage.submission.submittedAt+86400)}. Informational only; no automatic payout.</p>}{stage.paidAt !== null && <p className="field-help">Accepted and paid {time(stage.paidAt)}. This material reference is retained.</p>}</div>}
      {caps.approve && current?.index === stage.index && stage.submission && <button className="button primary" disabled={blocked} onClick={()=>setAction({kind:'approve',index:stage.index,revision:stage.submission!.revision,hash:stage.submission!.sha256,amount:stage.amountLamports,final:stage.index===2})}>Review & pay</button>}
    </article>)}</div></div>
    {(caps.submit || caps.replace) && <form className="card" onSubmit={submit}><h2>{caps.replace ? 'Replace' : 'Submit'} {current ? stageNames[current.index] : 'current milestone'}</h2><p className="field-help">One initial submission and one replacement. Your file stays on your device; only the HTTPS link and SHA-256 go on-chain.</p><div className="form-grid"><Field id="submission-url" label="Material link" value={url} max={200}><input id="submission-url" type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…" required disabled={blocked}/></Field><Field id="material-file" label="Select the exact file to fingerprint" help={`Maximum ${MAX_FILE_BYTES/1024/1024} MiB. The link’s contents are not automatically verified.`}><input key={stageKey} id="material-file" type="file" disabled={blocked} onChange={e=>void selectFile(e.target.files?.[0])}/></Field></div>{hashing && <p role="status">Calculating SHA-256…</p>}{hash && hashStage===stageKey && <><p className="field-help">{fileName}</p><Address value={hash} label="selected file hash"/></>}<button className="button primary" type="submit" disabled={blocked||hashing||!hash||hashStage!==stageKey}>{caps.replace ? 'Submit replacement' : 'Submit milestone'}</button></form>}
    {error && <Alert tone="error">{error}</Alert>}
    {action && <Confirmation title={action.kind === 'accept' ? 'Accept the fixed project terms' : action.kind === 'cancel' ? 'Cancel this unaccepted deal' : action.kind === 'approve' ? 'Approve the reviewed material' : 'Confirm the final settlement'} busy={blocked} onConfirm={confirmAction} onClose={()=>setAction(null)}>
      {action.kind === 'accept' && <p>You agree to the brief, named arbiter, three stage criteria and deadlines shown above. Deposit <strong>{formatSol(deal.bondLamports)} test SOL</strong>, plus network fee, to begin. The deposit returns after completion or as directed by the arbiter.</p>}
      {action.kind === 'cancel' && <p>Return <strong>{formatSol(deal.remainingBudgetLamports)} SOL</strong> to the client and close this deal before creator acceptance.</p>}
      {action.kind === 'approve' && <><p>Pay <strong>{formatSol(action.amount)} SOL</strong> for {stageNames[action.index]}, revision {action.revision}.{action.final && ` Also return the ${formatSol(deal.lockedBondLamports)} SOL creator deposit.`}</p><Address value={action.hash} label="reviewed material hash"/><p className="field-help">Only this reviewed revision is approved. If it changes before execution, the transaction is rejected.</p></>}
      {action.kind === 'resolve' && <><p>Client receives <strong>{formatSol(action.clientAmount)} SOL</strong>; creator receives <strong>{formatSol(action.creatorAmount)} SOL</strong>.</p><p>{action.reason}</p><p>This closes the deal and retains earlier payments.</p></>}
    </Confirmation>}
    {receipts.length>0 && <section className="card"><h2>Verified Devnet demonstration receipts</h2><p className="field-help">Public operations supplied with this synthetic example. These are not live customer orders.</p><div className="table-wrap"><table className="summary-table"><thead><tr><th>Operation</th><th>Evidence</th></tr></thead><tbody>{receipts.map(tx=><tr key={tx.signature}><td>{tx.operation.split(':').slice(1).join(' · ')}</td><td><TxLink signature={tx.signature}/></td></tr>)}</tbody></table></div></section>}
  </>;
}
