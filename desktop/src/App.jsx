import { useEffect, useState } from 'react';
import { AboutDialog } from './components/AboutDialog.jsx';
import { BackendFailure } from './components/BackendFailure.jsx';
import { OnboardingModal } from './components/OnboardingModal.jsx';
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
  onNavigate,
  onOpenOnboarding,
}) {
  switch (page) {
    case 'dashboard':
      return <DashboardPage onNavigate={onNavigate} onOpenOnboarding={onOpenOnboarding} />;
    case 'documents':
      return <DocumentsPage />;
    case 'ai-workspace':
      return <AIWorkspacePage />;
    case 'settings':
      return <SettingsPage onOpenAbout={() => onNavigate('about')} />;
    case 'overview':
    default:
      return <OverviewPage status={status} onRestart={onRestart} />;
  }
}

export default function App() {
  const { status, restart } = useBackendStatus();
  const [page, setPage] = useState('dashboard');
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [appInfo, setAppInfo] = useState(null);

  useEffect(() => {
    let ignore = false;
    window.transformo?.app?.getInfo().then((res) => {
      if (!ignore && res) setAppInfo(res);
    }).catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, []);

  // Show onboarding popup on landing if:
  // 1. Groq API key is not configured, OR
  // 2. The user has never seen the initial onboarding tour
  useEffect(() => {
    if (status?.state !== 'ready') return;
    let ignore = false;
    window.transformo?.ai?.getSettings().then((res) => {
      if (ignore) return;
      const isConfigured = Boolean(res?.ok && res.data?.configured);
      const tourShown = localStorage.getItem('transformo_onboarding_shown');
      if (!isConfigured || !tourShown) {
        setIsOnboardingOpen(true);
      }
    }).catch(() => {
      if (!ignore) setIsOnboardingOpen(true);
    });
    return () => {
      ignore = true;
    };
  }, [status?.state]);

  // Global macOS/Desktop Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+K or Ctrl+K: Quick navigate to Document Search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPage('documents');
      }
      // Cmd+, or Ctrl+,: Quick navigate to Settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setPage('settings');
      }
      // Cmd+/ or Ctrl+/: About Dialog
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setIsAboutOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigate = (targetPage) => {
    if (targetPage === 'about') {
      setIsAboutOpen(true);
    } else {
      setPage(targetPage);
    }
  };

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
    content = (
      <PageContent
        page={page}
        status={status}
        onRestart={restart}
        onNavigate={handleNavigate}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
      />
    );
  }

  return (
    <div className="flex h-full">
      <Sidebar
        page={page}
        onNavigate={handleNavigate}
        onOpenAbout={() => setIsAboutOpen(true)}
        backendState={status?.state}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="titlebar-drag h-12 shrink-0 flex items-center justify-between px-6 text-xs text-muted/60 select-none">
          <div />
          <div className="flex items-center gap-4 text-[11px]">
            <span className="hidden sm:inline">
              <kbd className="font-mono rounded border border-border/80 bg-sunken px-1.5 py-0.5 text-[10px] text-muted">⌘K</kbd> Search
            </span>
            <span className="hidden sm:inline">
              <kbd className="font-mono rounded border border-border/80 bg-sunken px-1.5 py-0.5 text-[10px] text-muted">⌘,</kbd> Settings
            </span>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-10">{content}</div>
      </main>

      {/* About Transformo Docs Dialog */}
      <AboutDialog
        open={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        info={appInfo}
      />

      {/* First-launch Groq API Setup Modal */}
      <OnboardingModal
        open={isOnboardingOpen}
        onClose={() => {
          setIsOnboardingOpen(false);
          try {
            localStorage.setItem('transformo_onboarding_shown', '1');
          } catch {}
        }}
        onNavigateSettings={() => handleNavigate('settings')}
      />
    </div>
  );
}
