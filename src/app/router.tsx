import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { AccountPage } from '@/features/account/AccountPage';
import { ImportsPage } from '@/features/imports/ImportsPage';
import { MetronomePage } from '@/features/metronome/MetronomePage';
import { PrompterPage } from '@/features/prompter/PrompterPage';
import { SetlistDetailPage } from '@/features/setlists/SetlistDetailPage';
import { SetlistsPage } from '@/features/setlists/SetlistsPage';
import { SongDetailPage } from '@/features/songs/SongDetailPage';
import { SongsPage } from '@/features/songs/SongsPage';
import { SyncPage } from '@/features/sync/SyncPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/prompter" element={<PrompterPage />} />
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/songs" replace />} />
        <Route path="/songs" element={<SongsPage />} />
        <Route path="/songs/:songId" element={<SongDetailPage />} />
        <Route path="/imports" element={<Navigate to="/musiques" replace />} />
        <Route path="/musiques" element={<ImportsPage />} />
        <Route path="/setlists" element={<SetlistsPage />} />
        <Route path="/setlists/:setlistId" element={<SetlistDetailPage />} />
        <Route path="/sync" element={<SyncPage />} />
        <Route path="/metronome" element={<MetronomePage />} />
        <Route path="/account" element={<AccountPage />} />
      </Route>
    </Routes>
  );
}
