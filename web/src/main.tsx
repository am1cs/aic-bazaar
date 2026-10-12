import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@solana/wallet-adapter-react-ui/styles.css';
import './tailwind.css';
import './styles.css';
import { AppProviders } from './providers';
import App from './App';
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><AppProviders><App /></AppProviders></BrowserRouter></React.StrictMode>);
