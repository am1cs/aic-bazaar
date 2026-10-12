import { Link } from 'react-router-dom';
import { deployment } from './config';

export default function CinematicHero() {
  return <section className="hero-experience" aria-labelledby="hero-title">
    <div className="hero-room" aria-hidden="true">
      <div className="room-scroll"><div className="room-camera">
        <div className="room-plane room-ceiling"><span>AIC BAZAAR</span></div>
        <div className="room-plane room-left"><span>THE</span><span>BRIEF</span></div>
        <div className="room-plane room-right"><span>YOUR</span><span>WORK</span></div>
        <div className="room-plane room-floor"><span>PAY FOR</span><span>PROGRESS</span></div>
        <div className="room-back"><span>✳</span></div>
      </div></div>
    </div>
    <div className="hero-copy cinematic-copy">
      <span className="eyebrow home-kicker">THE CREATOR × CLIENT AGREEMENT</span>
      <h1 className="hero-title" id="hero-title">Great work.<br/><em>Paid in progress.</em></h1>
      <p className="hero-description">A shared brief. Three milestones. Funds reserved from the start. A clearer way for businesses and AI creators to work together.</p>
      <div className="hero-actions">
        <Link className="button primary" to="/create">Start a deal <span aria-hidden="true">↗</span></Link>
        <Link className="button secondary" to={`/deal/${deployment.demoDeals.completed}`}>Explore the live demo <span aria-hidden="true">→</span></Link>
      </div>
      <p className="section-note">Solana Devnet · Test SOL only · Human creators</p>
    </div>
    <span className="room-corner-label" aria-hidden="true">CREATIVE WORK / SHARED COMMITMENTS</span>
  </section>;
}
