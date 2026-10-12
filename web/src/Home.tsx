import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PublicKey } from '@solana/web3.js';
import { deployment } from './config';
import { Alert } from './components';
import MotionScene from './MotionScene';
import CinematicHero from './CinematicHero';

export default function Home() {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  function open(event: FormEvent) {
    event.preventDefault();
    try { navigate(`/deal/${new PublicKey(address.trim()).toBase58()}`); }
    catch { setError('Enter a valid Solana deal address.'); }
  }

  return <MotionScene>
    <CinematicHero/>

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
          <figure className="demo-art"><img src="/previews/glow-concept.svg" alt="Purple storyboard cover illustration for the GLOW concept" loading="lazy"/><figcaption><span>01 / CONCEPT</span></figcaption></figure>
          <figure className="demo-art"><img src="/previews/glow-draft.svg" alt="Static storyboard cover illustration for the GLOW draft" loading="lazy"/><figcaption><span>02 / DRAFT</span></figcaption></figure>
          <figure className="demo-art"><img src="/previews/glow-final.svg" alt="Static storyboard cover illustration for the GLOW final delivery" loading="lazy"/><figcaption><span>03 / FINAL</span></figcaption></figure>
        </div>
        <div className="demo-links"><Link className="button primary" to={`/deal/${deployment.demoDeals.completed}`}>View completed deal <span aria-hidden="true">↗</span></Link><Link className="button secondary" to={`/deal/${deployment.demoDeals.resolved}/dispute`}>Explore a resolved dispute <span aria-hidden="true">↗</span></Link></div>
        <p className="field-help">Synthetic demonstration order using test funds, not paying customer activity. Static previews are shown here; the public deal contains the submitted material links and SHA-256 fingerprints.</p>
      </div>
    </section>

    <section className="card home-access" aria-labelledby="open-heading">
      <div className="section-heading"><div className="section-heading-copy"><span className="section-index">03 / YOUR WORKSPACE</span><h2 id="open-heading">Pick up where<br/>you left off.</h2></div><span className="badge muted">Read without a wallet</span></div>
      <form className="open-deal-form" onSubmit={open}><label className="field" htmlFor="open-address"><span>Deal address</span><input id="open-address" placeholder="Paste a Solana deal address" value={address} onChange={e => { setAddress(e.target.value); setError(''); }} required autoComplete="off" aria-invalid={!!error} aria-describedby={error?'open-address-error':undefined}/></label><button className="button primary" type="submit">Open deal <span aria-hidden="true">↗</span></button></form>
      {error && <div id="open-address-error"><Alert tone="error">{error}</Alert></div>}
      <p className="field-help">Open the link shared by your collaborator, or paste its deal address here.</p>
    </section>
  </MotionScene>;
}
