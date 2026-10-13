import { useEffect, useLayoutEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Header } from './Header';
import Home from './Home';
import Create from './Create';
import DealPage from './DealPage';
import DeliveryCheck from './DeliveryCheck';
import OperationPanel from './OperationPanel';
import { useOperation } from './transactions/useOperation';
import { External } from './components';
export default function App() {
  const { pathname, hash, key } = useLocation();
  useLayoutEffect(() => {
    if (hash) {
      let id = hash.slice(1);
      try { id = decodeURIComponent(id); } catch { /* Malformed hashes still fall back safely. */ }
      const target = document.getElementById(id);
      if (target) {
        if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash, key]);
  const {snapshot} = useOperation();
  useEffect(()=>{ if(!snapshot.busy && snapshot.attempt?.state !== 'unknown') return; const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';}; window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn); },[snapshot.busy,snapshot.attempt?.state]);
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <Header/>
    <main className="page-container" id="main-content" tabIndex={-1}>
      <OperationPanel/>
      <Routes>
        <Route path="/" element={<Home/>}/><Route path="/create" element={<Create/>}/>
        <Route path="/deal/:address" element={<DealPage/>}/><Route path="/deal/:address/dispute" element={<DealPage disputeOnly/>}/>
        <Route path="/demo/materials" element={<DeliveryCheck/>}/>
        <Route path="*" element={<section className="empty-state"><h1>Page not found</h1><Link className="button primary" to="/">Back to AIC Bazaar</Link></section>}/>
      </Routes>
    </main>
    <footer className="footer"><Link className="brand" to="/">AIC Bazaar</Link><p>Great work. Paid in progress.<br/>Devnet prototype · Test funds · Human arbitration</p><External href="https://github.com/am1cs/aic-bazaar">Source & documentation</External></footer>
  </div>;
}
