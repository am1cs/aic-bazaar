import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { External } from './components';
import { deployment } from './config';
import './header.css';

type Dropdown = 'create' | 'explore';

function Chevron() {
  return <svg className="aic-header-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function NetworkBadge({ mobile = false }: { mobile?: boolean }) {
  return <span className={`aic-header-network${mobile ? ' aic-header-network-mobile' : ' aic-header-network-desktop'}`} aria-label="Solana Devnet, test SOL only" title="Solana Devnet · Test SOL only">Devnet</span>;
}

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<Dropdown | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const dropdowns = useRef<Record<Dropdown, HTMLLIElement | null>>({ create: null, explore: null });
  const triggers = useRef<Record<Dropdown, HTMLButtonElement | null>>({ create: null, explore: null });
  const id = useId();
  const location = useLocation();

  function close() {
    setMobileOpen(false);
    setOpenDropdown(null);
  }

  useEffect(() => {
    setMobileOpen(false);
    setOpenDropdown(null);
  }, [location.key, location.pathname, location.hash]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const compact = window.matchMedia('(max-width: 1150px)');
    function reset() {
      setMobileOpen(false);
      setOpenDropdown(null);
    }
    compact.addEventListener('change', reset);
    return () => compact.removeEventListener('change', reset);
  }, []);

  useEffect(() => {
    if (!mobileOpen && !openDropdown) return;
    function outside(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!headerRef.current?.contains(target)) {
        setMobileOpen(false);
        setOpenDropdown(null);
        return;
      }
      if (openDropdown && !dropdowns.current[openDropdown]?.contains(target)) setOpenDropdown(null);
      if (mobileOpen && !navRef.current?.contains(target) && !menuRef.current?.contains(target)) setMobileOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      setOpenDropdown(null);
      if (mobileOpen) {
        setMobileOpen(false);
        menuRef.current?.focus();
      } else if (openDropdown) triggers.current[openDropdown]?.focus();
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [mobileOpen, openDropdown]);

  return <header className="aic-header" ref={headerRef}>
    <div className="aic-header-inner">
      <div className="aic-header-brand-area">
        <Link className="aic-header-brand" to="/" aria-label="AIC Bazaar home" onClick={close}>AIC BAZAAR</Link>
        <NetworkBadge mobile />
      </div>
      <button className="aic-header-menu" type="button" ref={menuRef} aria-expanded={mobileOpen} aria-controls={`${id}-navigation`} aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} onClick={() => {
        setMobileOpen(current => !current);
        setOpenDropdown(null);
      }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">{mobileOpen ? <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /> : <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}</svg>
      </button>
      <nav className={`aic-header-nav${mobileOpen ? ' is-open' : ''}`} id={`${id}-navigation`} ref={navRef} aria-label="Main navigation" onClick={event => {
        if (event.target instanceof Element && event.target.closest('a')) close();
      }}>
        <ul className="aic-header-links">
          <li className="aic-header-disclosure" ref={element => { dropdowns.current.create = element; }} onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) setOpenDropdown(current => current === 'create' ? null : current);
          }}>
            <button className="aic-header-link" type="button" ref={element => { triggers.current.create = element; }} aria-expanded={openDropdown === 'create'} aria-controls={`${id}-create`} onClick={() => setOpenDropdown(current => current === 'create' ? null : 'create')}>Create <Chevron /></button>
            <ul className="aic-header-dropdown" id={`${id}-create`} hidden={openDropdown !== 'create'}>
              <li><Link to="/create" aria-current={location.pathname === '/create' ? 'page' : undefined}>Create a deal<span>Review terms and reserve a Devnet budget</span></Link></li>
              <li><Link to="/#open-heading">Open a deal<span>Continue with a deal address</span></Link></li>
            </ul>
          </li>
          <li className="aic-header-disclosure" ref={element => { dropdowns.current.explore = element; }} onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) setOpenDropdown(current => current === 'explore' ? null : current);
          }}>
            <button className="aic-header-link" type="button" ref={element => { triggers.current.explore = element; }} aria-expanded={openDropdown === 'explore'} aria-controls={`${id}-explore`} onClick={() => setOpenDropdown(current => current === 'explore' ? null : 'explore')}>Explore <Chevron /></button>
            <ul className="aic-header-dropdown" id={`${id}-explore`} hidden={openDropdown !== 'explore'}>
              <li><Link to={`/deal/${deployment.demoDeals.completed}`}>Completed deal<span>View three delivered milestones</span></Link></li>
              <li><Link to={`/deal/${deployment.demoDeals.resolved}/dispute`}>Resolved dispute<span>View the arbiter's recorded decision</span></Link></li>
            </ul>
          </li>
          <li><Link className="aic-header-link" to="/#how-it-works">How it works</Link></li>
          <li><Link className="aic-header-link" to="/#demo-heading">Demo</Link></li>
          <li className="aic-header-docs"><External href="https://github.com/am1cs/aic-bazaar">Docs</External></li>
          <li className="aic-header-mobile-tutorial"><Link className="aic-header-link" to="/#how-it-works">Tutorial</Link></li>
        </ul>
      </nav>
      <div className="aic-header-actions">
        <NetworkBadge />
        <Link className="aic-header-tutorial" to="/#how-it-works" onClick={close}>Tutorial</Link>
        <WalletMultiButton />
      </div>
    </div>
  </header>;
}
