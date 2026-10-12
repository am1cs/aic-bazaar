import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { deployment, explorer } from './config';
import { useBazaarClient, useDeploymentReady } from './hooks';
import { useOperation } from './transactions/useOperation';
import { Field, Address, Alert, Confirmation, External } from './components';
import { parseSol, splitAmounts, formatSol } from './lib/money';
import { validateCreateForm, validateWalletAddress } from './lib/validation';
import type { CreateDealInput } from '../../shared/api';
const empty = { title: '', brief: '', creator: '', referencesUrl: '', budgetSol: '0.30', deadlines: ['', '', ''] as [string, string, string] };
const DRAFT_KEY = 'aic-bazaar.create-draft.v1';
export default function Create() {
  const [form, setForm] = useState(() => { try { const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null'); if (!draft || !['title','brief','creator','referencesUrl','budgetSol'].every(k=>typeof draft[k]==='string') || !Array.isArray(draft.deadlines) || draft.deadlines.length!==3 || !draft.deadlines.every((x:unknown)=>typeof x==='string')) return empty; return {title:draft.title as string,brief:draft.brief as string,creator:draft.creator as string,referencesUrl:draft.referencesUrl as string,budgetSol:draft.budgetSol as string,deadlines:draft.deadlines as [string,string,string]}; } catch { return empty; } });
  const [error, setError] = useState(''); const [terms, setTerms] = useState<CreateDealInput | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const reviewed = useRef<{ terms: CreateDealInput; wallet: string } | null>(null);
  const wallet = useWallet(); const client = useBazaarClient(); const operation = useOperation(); const navigate = useNavigate();
  const walletAddress = wallet.publicKey?.toBase58();
  const mounted = useRef(true); const latestWallet = useRef(walletAddress); latestWallet.current = walletAddress;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const blocked = operation.snapshot.busy || operation.snapshot.attempt?.state === 'unknown';
  const readiness = useDeploymentReady();
  useEffect(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch { /* Optional draft saving never controls chain state. */ } }, [form]);
  useEffect(() => { reviewed.current = null; setTerms(null); }, [walletAddress]);
  const update = (field: keyof typeof empty, value: string | [string,string,string]) => { reviewed.current = null; setForm(previous => ({ ...previous, [field]: value })); setTerms(null); setError(''); setFieldErrors({}); };
  let amounts: ReturnType<typeof splitAmounts> | null = null;
  try { amounts = splitAmounts(parseSol(form.budgetSol)); } catch { /* Inline validation upon review. */ }
  function validationError(e: unknown) {
    const message = e instanceof Error ? e.message : 'Check the deal details.';
    let fields: string[] = [];
    if (message.startsWith('Title ')) fields = ['title'];
    else if (message.startsWith('Brief ')) fields = ['brief'];
    else if (message.startsWith('URL ') || message.includes('HTTPS URL') || message.startsWith('URLs ')) fields = ['references'];
    else if (message.includes('decimal SOL amount') || message.startsWith('Budget ')) fields = ['budget'];
    else if (message.startsWith('Concept deadline ')) fields = ['deadline-0'];
    else if (message.startsWith('Draft deadline ')) fields = ['deadline-1'];
    else if (message.startsWith('Final deadline ')) fields = ['deadline-2'];
    else if (message.includes('deadlines') || message.startsWith('Deadlines ')) fields = ['deadline-0', 'deadline-1', 'deadline-2'];
    else {
      try { validateWalletAddress(form.creator); } catch { fields = ['creator']; }
      if (message.includes('different wallets') && (form.creator === walletAddress || form.creator === deployment.arbiterAddress)) fields = ['creator'];
    }
    reviewed.current = null; setTerms(null); setError(message);
    setFieldErrors(Object.fromEntries(fields.map(id => [id, message])));
    if (fields[0]) document.getElementById(fields[0])?.focus();
  }
  function review(event: FormEvent) {
    event.preventDefault();
    try {
      const checked = validateCreateForm({ ...form, client: walletAddress ?? '', arbiter: deployment.arbiterAddress });
      reviewed.current = { terms: checked, wallet: walletAddress ?? '' }; setTerms(checked); setError(''); setFieldErrors({});
    } catch (e) { validationError(e); }
  }
  async function create() {
    if (!terms || !reviewed.current || !walletAddress || reviewed.current.wallet !== walletAddress || blocked) return;
    if (!readiness.ready) return;
    const submittedDraft = JSON.stringify(form);
    let checked: CreateDealInput;
    try { checked = validateCreateForm({ ...form, client: walletAddress, arbiter: deployment.arbiterAddress }); }
    catch (e) { validationError(e); return; }
    // Consume the reviewed intent before calling the controller. A later recovered
    // confirmation must never re-enable the old request and fund another deal.
    reviewed.current = null; setTerms(null); setError(''); setFieldErrors({});
    try { const result = await operation.run({ action: 'Create & fund deal', wallet: walletAddress }, () => client.createDeal(checked)); if (result && mounted.current && latestWallet.current === walletAddress) { try { if(localStorage.getItem(DRAFT_KEY)===submittedDraft)localStorage.removeItem(DRAFT_KEY); } catch {} navigate(`/deal/${result.dealAddress}`); } }
    catch (e) { if (mounted.current && latestWallet.current === walletAddress) setError(e instanceof Error ? e.message : 'The operation result is unknown. Check the receipt.'); }
  }
  const receipt = operation.snapshot.attempt;
  const recoveredCreation = receipt?.state === 'confirmed' && receipt.action === 'Create & fund deal' && !receipt.dealAddress;
  return <><div className="page-heading"><span className="eyebrow">START WITH CLEAR TERMS</span><h1>Create a deal</h1><p className="page-subtitle">Reserve the budget for a 15-second AI advertisement. Your selected creator joins by link.</p></div>
  {!walletAddress && <Alert>Connect your Phantom wallet to fund a deal. You can prepare the terms first. <WalletMultiButton /></Alert>}
  {!readiness.ready && <Alert tone={readiness.error?'warning':'info'}>{readiness.loading?'Checking the real Devnet deployment…':readiness.error}<button type="button" className="button secondary small" disabled={readiness.loading} onClick={()=>void readiness.verify()}>Check again</button></Alert>}
  {recoveredCreation && <Alert tone="warning"><p>This creation is confirmed, but its deal address was not returned. Find the deal account in the transaction on Explorer, then paste that address into Open deal. Creating again reserves another budget.</p>{receipt.signature && <External href={explorer('tx', receipt.signature)}>Find the created deal in Explorer</External>}</Alert>}
  <div className="detail-grid"><form className="card" onSubmit={review}><fieldset className="form-grid" disabled={blocked} style={{border:0,padding:0,minWidth:0}}>
    <Field id="title" label="Project title" value={form.title} max={64} error={fieldErrors.title}><input id="title" value={form.title} onChange={e => update('title', e.target.value)} required placeholder="A launch film for our new product" /></Field>
    <Field id="creator" label="Creator wallet" help="The selected creator’s signing wallet. Different from your wallet and the arbiter." error={fieldErrors.creator}><input id="creator" value={form.creator} onChange={e => update('creator', e.target.value)} required placeholder="Solana wallet address" autoComplete="off" /></Field>
    <div className="span-two"><Field id="brief" label="Brief" value={form.brief} max={200} error={fieldErrors.brief}><textarea id="brief" rows={3} value={form.brief} onChange={e => update('brief', e.target.value)} required placeholder="Product, audience, style and call to action." /></Field></div>
    <Field id="budget" label="Total budget · Test SOL" help="0.001–1 SOL. The customer funds the complete budget." error={fieldErrors.budget}><input id="budget" inputMode="decimal" value={form.budgetSol} onChange={e => update('budgetSol', e.target.value)} required /></Field>
    <Field id="references" label="Reference link · optional" value={form.referencesUrl} max={200} error={fieldErrors.references}><input id="references" type="url" value={form.referencesUrl} onChange={e => update('referencesUrl', e.target.value)} placeholder="https://…" /></Field>
    {(['Concept','Draft','Final'] as const).map((name, index) => <Field key={name} id={`deadline-${index}`} label={`${name} deadline`} error={fieldErrors[`deadline-${index}`]}><input id={`deadline-${index}`} type="datetime-local" value={form.deadlines[index]} required onChange={e => { const deadlines = [...form.deadlines] as [string,string,string]; deadlines[index] = e.target.value; update('deadlines', deadlines); }} /></Field>)}
    <p className="field-help span-two">Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}. Deadlines must be future and increasing; they do not automatically release funds or impose penalties.</p>
    <div className="span-two"><label>Named human arbiter</label><Address value={deployment.arbiterAddress} label="arbiter" /><p className="field-help">This arbiter can settle disputed funds under the agreed rules. Participants and terms cannot change after creation.</p></div>
  </fieldset>{error && <Alert tone="error">{error}</Alert>}<div className="action-row"><button className="button primary" type="submit" disabled={!walletAddress || blocked || !readiness.ready}>Review & fund</button></div></form>
  <aside className="card"><span className="eyebrow">YOUR AGREEMENT</span><h2>Pay for accepted progress.</h2><div className="money-grid">{['Concept · 20%','Draft · 30%','Final · remaining 50%'].map((name,index) => <div className="metric" key={name}><span>{name}</span><strong>{amounts ? formatSol(amounts.milestones[index].toString()) : '—'} <small>SOL</small></strong></div>)}</div><div className="divider"/><p><strong>Creator deposit</strong><br/>{amounts ? formatSol(amounts.bond.toString()) : '—'} SOL · 10% of the budget</p><p className="field-help">Account rent and network fees are separate. The final accepted stage also returns the deposit. No platform fee in this version.</p><div className="divider"/><p>Concept: three key frames.<br/>Draft: 15 seconds, vertical.<br/>Final: 1080×1920 MP4, CTA, no watermark.</p></aside></div>
  {terms && <Confirmation title="Confirm the complete agreement" busy={blocked || !readiness.ready} onConfirm={() => void create()} onClose={() => { reviewed.current = null; setTerms(null); }}><p>You are reserving <strong>{formatSol(terms.budgetLamports)} test SOL</strong>, plus account rent and network fees. Your creator must deposit 10% to start.</p><span className="field-help">Customer wallet</span><Address value={walletAddress ?? ''} label="customer" /><span className="field-help">Creator wallet</span><Address value={terms.creator} label="creator" /><span className="field-help">Named human arbiter</span><Address value={terms.arbiter} label="arbiter" /><p>Only this named arbiter can settle a dispute. Review all terms above before signing.</p></Confirmation>}
  </>;
}
