import { cloneElement, isValidElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { explorer } from './config';
import { utf8Bytes, validateHttps } from './lib/validation';
export function Alert({ children, tone = 'info' }: { children: ReactNode; tone?: string }) { return <div className={`alert ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>; }
export function External({ href, children }: { href: string; children: ReactNode }) {
  let valid = false;
  try { validateHttps(href); valid = true; } catch { /* Invalid stored links remain inert. */ }
  return valid ? <a href={href} target="_blank" rel="noopener noreferrer">{children} ↗</a> : <span className="field-error">Link is unavailable or invalid.</span>;
}
export function Address({ value, label = 'Address' }: { value: string; label?: string }) {
  const [copiedValue, setCopiedValue] = useState<string|null>(null); const [error, setError] = useState('');
  const latestValue = useRef(value); latestValue.current = value;
  useEffect(()=>{setError('');setCopiedValue(null);},[value]);
  async function copy() {
    setCopiedValue(null); setError('');
    try { await navigator.clipboard.writeText(value); if (latestValue.current === value) {setCopiedValue(value);setError('');} }
    catch { if (latestValue.current === value) setError('Copy unavailable. Select the address below.'); }
  }
  return <div className="address-row"><span className="monospace break-word" title={value}>{value}</span><button type="button" className="button secondary small" aria-label={`Copy ${label}`} onClick={() => void copy()}>{copiedValue===value ? 'Copied' : 'Copy'}</button><span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{copiedValue===value ? `${label} copied to clipboard.` : ''}</span>{error && <span className="field-error" role="status">{error}</span>}</div>;
}
export function Field({ id, label, children, value, max, error, help }: { id: string; label: string; children: ReactNode; value?: string; max?: number; error?: string; help?: string }) {
  const bytes = value !== undefined ? utf8Bytes(value) : undefined;
  const fieldError=error??(max!==undefined&&(bytes??0)>max?`Use at most ${max} UTF-8 bytes.`:undefined);
  const described=[help?`${id}-help`:null,max!==undefined?`${id}-bytes`:null,fieldError?`${id}-error`:null].filter(Boolean).join(' ');
  const control=isValidElement(children)?cloneElement(children as ReactElement<{'aria-describedby'?:string;'aria-invalid'?:boolean}>,{'aria-describedby':described||undefined,'aria-invalid':!!fieldError}):children;
  return <div className="field"><label htmlFor={id}>{label}</label>{control}{max !== undefined && <span id={`${id}-bytes`} className={`byte-count ${(bytes ?? 0) > max ? 'field-error' : ''}`}>{bytes}/{max} UTF-8 bytes</span>}{help && <span id={`${id}-help`} className="field-help">{help}</span>}{fieldError && <span id={`${id}-error`} className="field-error" role="alert">{fieldError}</span>}</div>;
}
export function Badge({ text }: { text: string }) { const tone = ['completed', 'confirmed', 'paid'].includes(text) ? 'success' : ['disputed', 'unknown', 'active'].includes(text) ? 'warning' : 'muted'; return <span className={`badge ${tone}`}>{text.replaceAll('_', ' ')}</span>; }
export function TxLink({ signature }: { signature: string }) { return <External href={explorer('tx', signature)}>View transaction on Devnet</External>; }
export function Loading() { return <div className="loading-state" role="status"><span className="spinner" />Reading the deal from Solana Devnet…</div>; }
export function Confirmation({ title, children, busy, onConfirm, onClose }: { title: string; children: ReactNode; busy: boolean; onConfirm: () => void; onClose: () => void }) {
  const ref=useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement|null>(null);
  useEffect(()=>{
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused !== document.body && !ref.current?.contains(focused)) opener.current = focused;
    ref.current?.focus();ref.current?.scrollIntoView?.({block:'nearest',behavior:'auto'});
  },[]);
  function close() {
    onClose();
    const target = opener.current;
    if (target?.isConnected && !target.matches(':disabled')) target.focus({preventScroll:true});
  }
  return <div className="card" ref={ref} tabIndex={-1} role="region" aria-label={title}><h3>{title}</h3>{children}<div className="action-row"><button className="button primary" type="button" disabled={busy} onClick={onConfirm}>Confirm in wallet</button><button className="button secondary" type="button" disabled={busy} onClick={close}>Back</button></div></div>;
}
