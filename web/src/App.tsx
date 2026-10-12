import { useEffect, useLayoutEffect } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Home from './Home';
import Create from './Create';
import DealPage from './DealPage';
import OperationPanel from './OperationPanel';
import { useOperation } from './transactions/useOperation';
import { External } from './components';
export default function App() {
  const { pathname } = useLocation();
  useLayoutEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [pathname]);
  const {snapshot} = useOperation();
  useEffect(()=>{ if(!snapshot.busy && snapshot.attempt?.state !== 'unknown') return; const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';}; window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn); },[snapshot.busy,snapshot.attempt?.state]);
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="site-header">
      <Link className="brand" to="/"><img className="brand-mark" src="/brand-mark.svg" alt=""/><span className="brand-name">AIC<span> Bazaar</span></span></Link>
      <nav className="nav" aria-label="Main navigation"><NavLink to="/" end>Overview</NavLink><NavLink to="/create">Create deal</NavLink></nav>
      <div className="wallet-area"><span className="network-pill">Devnet · Test SOL</span><WalletMultiButton/></div>
    </header>
    <main className="page-container" id="main-content" tabIndex={-1}>
      <OperationPanel/>
      <Routes>
        <Route path="/" element={<Home/>}/><Route path="/create" element={<Create/>}/>
        <Route path="/deal/:address" element={<DealPage/>}/><Route path="/deal/:address/dispute" element={<DealPage disputeOnly/>}/>
        <Route path="*" element={<section className="empty-state"><h1>Page not found</h1><Link className="button primary" to="/">Back to AIC Bazaar</Link></section>}/>
      </Routes>
    </main>
    <footer className="footer"><Link className="brand" to="/">AIC Bazaar</Link><p>Great work. Paid in progress.<br/>Devnet prototype · Test funds · Human arbitration</p><External href="https://github.com/am1cs/aic-bazaar">Source & documentation</External></footer>
  </div>;
}
