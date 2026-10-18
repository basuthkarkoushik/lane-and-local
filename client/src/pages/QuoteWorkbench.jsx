import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FilePlus2, SlidersHorizontal } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import QuoteForm from './QuoteForm';
import WhatIfSimulator from './WhatIfSimulator';

export default function QuoteWorkbench() {
  const location = useLocation();
  const [mode, setMode] = useState(location.pathname === '/simulator' ? 'simulator' : 'quote');

  return (
    <div className="quote-workbench">
      <PageHeader
        title="Quote & Simulator"
        subtitle="Create a delivery quote, check its live contribution, then test cost or timing changes before deciding."
      />
      <div className="quote-workbench-tabs" role="tablist" aria-label="Quote workspace">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'quote'}
          className={`quote-workbench-tab${mode === 'quote' ? ' active' : ''}`}
          onClick={() => setMode('quote')}
        >
          <FilePlus2 size={16} /> New delivery quote
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'simulator'}
          className={`quote-workbench-tab${mode === 'simulator' ? ' active' : ''}`}
          onClick={() => setMode('simulator')}
        >
          <SlidersHorizontal size={16} /> What-if simulator
        </button>
      </div>
      <div className="quote-workbench-content" role="tabpanel">
        {mode === 'quote' ? <QuoteForm embedded /> : <WhatIfSimulator embedded />}
      </div>
    </div>
  );
}
