import { useState } from 'react';
import { validateHttps } from './lib/validation';

type PreviewKind = 'image' | 'video' | 'link';
type PreviewStatus = 'loading' | 'ready' | 'failed';

function previewKind(url: string): PreviewKind {
  // This only chooses a browser preview for a saved delivery URL. File validation
  // belongs to the shared milestone validator before fingerprinting or signing.
  const pathname = new URL(url).pathname.toLowerCase();
  if (/\.(?:png|jpe?g|gif|webp|svg|avif|apng|bmp|ico)$/.test(pathname)) return 'image';
  if (/\.mp4$/.test(pathname)) return 'video';
  return 'link';
}

function SavedDelivery({ url, label }: { url: string; label: string }) {
  const kind = previewKind(url);
  const [status, setStatus] = useState<PreviewStatus>('loading');

  return <div className="delivery-preview" aria-label={label}>
    {kind !== 'link' && status !== 'failed' && <div className="delivery-preview-frame">
      {kind === 'image'
        ? <img src={url} alt={`${label} preview`} loading="lazy" referrerPolicy="no-referrer"
          onLoad={() => setStatus('ready')} onError={() => setStatus('failed')} />
        : <video src={url} aria-label={`${label} video`} controls playsInline preload="metadata"
          onLoadedMetadata={() => setStatus('ready')} onError={() => setStatus('failed')} />}
    </div>}
    {kind !== 'link' && status === 'loading' && <p className="field-help" role="status">Loading delivery preview…</p>}
    {status === 'failed' && <p className="field-help" role="status">
      Preview unavailable. The delivery link may be inaccessible or the file format may not be supported. Open the delivery link to view the material.
    </p>}
    {kind === 'link' && <p className="field-help">Open the delivery link to view the material.</p>}
    <a className="button secondary small" href={url} target="_blank" rel="noopener noreferrer">Open delivery link ↗</a>
  </div>;
}

export function DeliveryPreview({ url, label = 'Delivery', revision }: {
  url: string;
  label?: string;
  revision?: number | string;
}) {
  try { validateHttps(url); }
  catch {
    return <div className="delivery-preview" aria-label={label}>
      <p className="field-error" role="status">Delivery link is unavailable or invalid. Ask the creator for a valid HTTPS delivery link.</p>
    </div>;
  }
  // A replacement URL/revision gets its own loading/error state. Late events
  // from an older detached preview cannot replace the current preview's state.
  return <SavedDelivery key={`${url}\u0000${revision ?? ''}`} url={url} label={label} />;
}
