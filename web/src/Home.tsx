import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PublicKey } from '@solana/web3.js';
import { deployment } from './config';
import { Alert } from './components';

export default function Home() {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  function open(event: FormEvent) {
    event.preventDefault();
    try { navigate(`/deal/${new PublicKey(address.trim()).toBase58()}`); }
    catch { setError('Enter a valid Solana deal address.'); }
  }

  return <>
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-wordmark" aria-hidden="true">AIC BAZAAR<span>✳</span></div>
      <div className="hero-copy">
        <span className="eyebrow home-kicker"><span aria-hidden="true">✳</span> THE CREATOR × CLIENT AGREEMENT</span>
        <h1 className="hero-title" id="hero-title">Great work.<br/><em>Paid in progress.</em></h1>
        <p className="hero-description">A shared brief. Three milestones. Funds reserved from the start. A clearer way for businesses and AI creators to work together.</p>
        <div className="hero-actions">
          <Link className="button primary" to="/create">Start a deal <span aria-hidden="true">↗</span></Link>
          <Link className="button secondary" to={`/deal/${deployment.demoDeals.completed}`}>Explore the live demo <span aria-hidden="true">→</span></Link>
        </div>
        <p className="section-note">Solana Devnet · Test SOL only · Human creators</p>
      </div>
      <div className="hero-visual home-workbench" role="img" aria-label="Illustration of a creative project moving from concept to draft to final, with payments of twenty, thirty and fifty percent. This is a visual illustration, not a live deal.">
        <div className="workbench-top"><span>THE CREATIVE WORKSPACE</span><span className="badge muted">ILLUSTRATION</span></div>
        <div className="brief-preview">
          <div className="preview-heading"><strong>Make something<br/>worth watching.</strong><span>15 SEC<br/>9:16</span></div>
          <div className="preview-grid" aria-hidden="true">
            <div className="preview-shot shot-1"><img src="/frames/frame-01.svg" alt=""/><span>01 / THE IDEA</span></div>
            <div className="preview-shot shot-2"><img src="/frames/frame-02.svg" alt=""/><span>02 / THE CUT</span></div>
            <div className="preview-shot shot-3"><img src="/frames/frame-03.svg" alt=""/><span>03 / THE DELIVERY</span></div>
          </div>
        </div>
        <div className="deliverable-card"><div className="deliverable-title"><span>One brief. A clear path.</span><span aria-hidden="true">↗</span></div><div className="deliverable-stages"><span className="stage-chip"><b>Concept</b><span>20%</span></span><span className="stage-chip"><b>Draft</b><span>30%</span></span><span className="stage-chip"><b>Final</b><span>50%*</span></span></div><p className="field-help">*Final receives the remaining budget.</p></div>
      </div>
    </section>

    <div className="home-protocol" aria-label="Deal essentials">
      <div className="protocol-item"><span>01 / CLIENT</span><strong>Full budget reserved</strong></div>
      <div className="protocol-item"><span>02 / CREATOR</span><strong>10% performance deposit</strong></div>
      <div className="protocol-item"><span>03 / PAYMENT</span><strong>Release on approval</strong></div>
      <div className="protocol-item"><span>04 / DISAGREEMENT</span><strong>Named human arbiter</strong></div>
    </div>

    <section className="home-section" aria-labelledby="how-it-works">
      <div className="section-heading"><div className="section-heading-copy"><span className="section-index">01 / THE PROCESS</span><h2 id="how-it-works">Less guesswork.<br/>More great work.</h2></div><p className="section-note">Three milestones.<br/>One shared agreement.</p></div>
      <div className="grid-three">
        <article className="feature-card"><span className="milestone-number">01</span><h3>Agree. Then commit.</h3><p>The client funds the full budget. The selected creator accepts the terms and places a 10% performance deposit.</p><span className="stage-chip">Clear terms</span></article>
        <article className="feature-card"><span className="milestone-number">02</span><h3>Make. Review. Release.</h3><p>Approve the concept, draft and final delivery. Release 20%, 30% and the remaining budget as work is accepted.</p><span className="stage-chip">Milestone payments</span></article>
        <article className="feature-card"><span className="milestone-number">03</span><h3>A way through disputes.</h3><p>A named human arbiter settles the remaining funds. Already-paid materials stay in the deal history.</p><span className="stage-chip">Defined outcomes</span></article>
      </div>
    </section>

    <section className="home-section" aria-labelledby="demo-heading">
      <div className="section-heading"><div className="section-heading-copy"><span className="section-index">02 / REAL DEVNET EXAMPLES</span><h2 id="demo-heading">See the work.<br/>Follow the money.</h2></div><p className="section-note">Public transactions.<br/>No wallet needed to view.</p></div>
      <div className="demo-card demo-project">
        <div className="demo-meta"><div><span className="section-index">GLOW / 15-SECOND AI AD</span><h3>From the first frame<br/>to final delivery.</h3></div><span className="demo-status success">Completed · on-chain</span></div>
        <div className="demo-gallery">
          <figure className="demo-art"><img src="/demo/concept.svg" alt="GLOW demonstration storyboard with three scenes" loading="lazy"/><figcaption><span>01 / CONCEPT</span><a href="/demo/concept.svg" download>SVG ↓</a></figcaption></figure>
          <figure className="demo-art"><video src="/demo/draft.mp4" controls preload="metadata" playsInline aria-label="GLOW demonstration draft video"/><figcaption><span>02 / DRAFT</span><a href="/demo/draft.mp4" download>MP4 ↓</a></figcaption></figure>
          <figure className="demo-art"><video src="/demo/final.mp4" controls preload="metadata" playsInline aria-label="GLOW demonstration final video"/><figcaption><span>03 / FINAL</span><a href="/demo/final.mp4" download>MP4 ↓</a></figcaption></figure>
        </div>
        <div className="demo-links"><Link className="button primary" to={`/deal/${deployment.demoDeals.completed}`}>View completed deal <span aria-hidden="true">↗</span></Link><Link className="button secondary" to={`/deal/${deployment.demoDeals.resolved}/dispute`}>Explore a resolved dispute <span aria-hidden="true">↗</span></Link></div>
        <p className="field-help">Synthetic demonstration orders using test funds, not paying customer activity. These exact files match the hashes recorded in the completed deal.</p>
      </div>
    </section>

    <section className="card home-access" aria-labelledby="open-heading">
      <div className="section-heading"><div className="section-heading-copy"><span className="section-index">03 / YOUR WORKSPACE</span><h2 id="open-heading">Pick up where<br/>you left off.</h2></div><span className="badge muted">Read without a wallet</span></div>
      <form className="open-deal-form" onSubmit={open}><label className="field" htmlFor="open-address"><span>Deal address</span><input id="open-address" placeholder="Paste a Solana deal address" value={address} onChange={e => { setAddress(e.target.value); setError(''); }} required autoComplete="off" aria-invalid={!!error} aria-describedby={error?'open-address-error':undefined}/></label><button className="button primary" type="submit">Open deal <span aria-hidden="true">↗</span></button></form>
      {error && <div id="open-address-error"><Alert tone="error">{error}</Alert></div>}
      <p className="field-help">Open the link shared by your collaborator, or paste its deal address here.</p>
    </section>
  </>;
}
