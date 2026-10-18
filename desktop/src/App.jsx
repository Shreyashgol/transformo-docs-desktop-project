import { useState } from 'react';
import { BackendFailure } from './components/BackendFailure.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { Spinner } from './components/ui.jsx';
import { useBackendStatus } from './hooks/useBackendStatus.js';
import { AIWorkspacePage } from './pages/AIWorkspacePage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { DocumentsPage } from './pages/DocumentsPage.jsx';
import { OverviewPage } from './pages/OverviewPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';

function PageContent({
  page,
  status,
  onRestart,
}) {
  switch (page) {
    case 'dashboard':
      return <DashboardPage />;
    case 'documents':
      return <DocumentsPage />;
    case 'ai-workspace':
      return <AIWorkspacePage />;
    case 'settings':
      return <SettingsPage />;
    case 'overview':
    default:
      return <OverviewPage status={status} onRestart={onRestart} />;
  }
}

export default function App() {
  const { status, restart } = useBackendStatus();
  const [page, setPage] = useState('dashboard');

  let content;
  if (!status || status.state === 'starting' || status.state === 'stopped') {
    content = (
      <div className="flex h-full items-center justify-center gap-3 text-sm text-muted">
        <Spinner label="Starting document engine" />
        Starting the document engine…
      </div>
    );
  } else if (status.state === 'failed') {
    content = <BackendFailure status={status} onRetry={restart} />;
  } else {
    content = <PageContent page={page} status={status} onRestart={restart} />;
  }

  return (
    <div className="flex h-full">
      <Sidebar page={page} onNavigate={setPage} backendState={status?.state} />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="titlebar-drag h-12 shrink-0" />
        <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-10">{content}</div>
      </main>
    </div>
  );
}
