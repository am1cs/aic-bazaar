import { Link } from 'react-router-dom';
import { DeliveryPreview } from './DeliveryPreview';
import { Alert } from './components';

export default function DeliveryCheck() {
  const origin = window.location.origin;
  const https = window.location.protocol === 'https:';
  return <>
    <div className="page-heading"><span className="eyebrow">DEMO MATERIALS · NO TRANSACTIONS</span><h1>Check delivery previews</h1><p className="page-subtitle">Open this page on both computers. Check the image, play each video, and confirm that the unavailable file keeps an external delivery link.</p><Link to="/">Back to AIC Bazaar</Link></div>
    <Alert>This page uses existing synthetic demo files. It does not create a deal, submit materials or request a wallet signature.</Alert>
    {!https ? <Alert tone="warning">Open this check through the public HTTPS test site. Delivery previews require HTTPS links.</Alert> : <div className="delivery-check-grid">
      {[['Concept image', 'concept.svg'], ['Draft video', 'draft.mp4'], ['Final video', 'final.mp4'], ['Unavailable file · expected error', 'missing-preview.svg']].map(([label, file]) => <section className="card" key={file}><h2>{label}</h2><DeliveryPreview url={`${origin}/demo/${file}`} label={label}/></section>)}
    </div>}
  </>;
}
