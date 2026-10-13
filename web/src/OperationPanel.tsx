import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useConnection } from '@solana/wallet-adapter-react';
import { useOperation } from './transactions/useOperation';
import { Address, Alert, Badge, External, TxLink } from './components';
import { explorer } from './config';
export default function OperationPanel() {
  const { snapshot, check, clearResolved } = useOperation();
  const { connection } = useConnection();
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);
  const attempt = snapshot.attempt;
  if (!attempt) return snapshot.error ? <Alert tone="error">{snapshot.error.message}</Alert> : null;
  const unknown = attempt.state === 'unknown';
  const resolved = attempt.state === 'confirmed' || attempt.state === 'failed';
  const expanded = expandedAttemptId === attempt.id;
  return <aside className="transaction-panel" aria-label="Transaction receipt" aria-live="polite"><div className="milestone-header"><strong>{attempt.action}</strong><Badge text={attempt.state} /></div>
    <p>{snapshot.busy ? unknown ? 'Checking the transaction status on Devnet…' : 'Follow the request in your wallet. Waiting for the transaction result.' : attempt.state === 'confirmed' ? 'This transaction is confirmed on Solana Devnet.' : attempt.state === 'failed' ? 'The operation did not complete successfully.' : 'The result remains unknown. Check it before starting another operation.'}</p>
    {snapshot.error && <Alert tone={unknown ? 'warning' : 'error'}>{snapshot.error.message}</Alert>}
    {attempt.refreshError && <Alert tone="warning">The transaction is confirmed; account refresh failed. Refresh the deal instead of repeating the operation.</Alert>}
    <details className="receipt-details" key={attempt.id} open={expanded}>
      <summary onClick={(event) => { event.preventDefault(); setExpandedAttemptId(expanded ? null : attempt.id); }}>Technical details</summary>
      <div className="receipt-details-content" hidden={!expanded}>
        <span className="field-help">Originating wallet</span><Address value={attempt.wallet} label="originating wallet" />
        {attempt.dealAddress && <><span className="field-help">Deal address</span><Address value={attempt.dealAddress} label="deal address" /></>}
        {attempt.signature && <><span className="field-help">Transaction signature</span><Address value={attempt.signature} label="transaction signature" /><TxLink signature={attempt.signature} /></>}
      </div>
    </details>
    {unknown && !attempt.signature && <><p className="field-help">No signature was returned before the operation was interrupted. Check the originating wallet activity manually. Creating again can reserve another budget.</p><External href={explorer('address', attempt.wallet)}>Check wallet activity</External></>}
    <div className="action-row">{attempt.dealAddress && <Link className="button secondary small" to={`/deal/${attempt.dealAddress}`}>Open deal</Link>}
      {unknown && attempt.signature && <button className="button secondary small" disabled={snapshot.busy} onClick={() => void check(connection)}>Check transaction status</button>}
      {!snapshot.busy && resolved && <button type="button" className="button secondary small" onClick={clearResolved}>Dismiss receipt</button>}
    </div>
  </aside>;
}
