import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';

const AccountPage = lazy(async () => ({ default: (await import('@/features/account/AccountPage')).AccountPage }));
const ImportsPage = lazy(async () => ({ default: (await import('@/features/imports/ImportsPage')).ImportsPage }));
const MetronomePage = lazy(async () => ({ default: (await import('@/features/metronome/MetronomePage')).MetronomePage }));
const PrompterLibraryPage = lazy(async () => ({ default: (await import('@/features/prompter/PrompterLibraryPage')).PrompterLibraryPage }));
const PrompterPage = lazy(async () => ({ default: (await import('@/features/prompter/PrompterPage')).PrompterPage }));
const SetlistDetailPage = lazy(async () => ({ default: (await import('@/features/setlists/SetlistDetailPage')).SetlistDetailPage }));
const SetlistsPage = lazy(async () => ({ default: (await import('@/features/setlists/SetlistsPage')).SetlistsPage }));
const SongDetailPage = lazy(async () => ({ default: (await import('@/features/songs/SongDetailPage')).SongDetailPage }));
const SongsPage = lazy(async () => ({ default: (await import('@/features/songs/SongsPage')).SongsPage }));
const SyncPage = lazy(async () => ({ default: (await import('@/features/sync/SyncPage')).SyncPage }));
const HomePage = lazy(async () => ({ default: (await import('@/features/home/HomePage')).HomePage }));
const CalendarPage = lazy(async () => ({ default: (await import('@/features/events/CalendarPage')).CalendarPage }));

function RouteFallback() {
  return <div className="py-10 text-center text-xs text-white/45">Chargement…</div>;
}

export function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
      <Route path="/prompter/play" element={<PrompterPage />} />
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/songs" element={<SongsPage />} />
        <Route path="/songs/:songId" element={<SongDetailPage />} />
        <Route path="/imports" element={<Navigate to="/musiques" replace />} />
        <Route path="/musiques" element={<ImportsPage />} />
        <Route path="/setlists" element={<SetlistsPage />} />
        <Route path="/setlists/:setlistId" element={<SetlistDetailPage />} />
        <Route path="/prompter" element={<PrompterLibraryPage />} />
        <Route path="/sync" element={<SyncPage />} />
        <Route path="/metronome" element={<MetronomePage />} />
        <Route path="/account" element={<AccountPage />} />
      </Route>
      </Routes>
    </Suspense>
  );
}
