import React from 'react';
import { TopBar } from '../components/ui.jsx';
import { pageHtml, pageTitle } from './Popups.jsx';

export default function InfoPage({ type, go }) {
  return (
    <div id="pages-section" className="section active">
      <TopBar title={pageTitle(type)} onBack={() => go('home')} />
      <div
        id="pages-content"
        style={{ padding: 15, lineHeight: 1.8, fontSize: 14, color: 'var(--text-muted)' }}
        dangerouslySetInnerHTML={{ __html: pageHtml(type) }}
      />
    </div>
  );
}
