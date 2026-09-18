import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { SplashScreen } from '@/components/SplashScreen';
import { Button } from '@/ui/components/Button';
import { FzIcon } from '@/ui/icons';

const BookingPage = lazy(async () => ({ default: (await import('@/features/booking/BookingPage')).BookingPage }));
const AccountPage = lazy(async () => ({ default: (await import('@/features/account/AccountPage')).AccountPage }));
const SongsPage = lazy(async () => ({ default: (await import('@/features/songs/SongsPage')).SongsPage }));
const MetronomePage = lazy(async () => ({ default: (await import('@/features/metronome/MetronomePage')).MetronomePage }));
const PrompterLibraryPage = lazy(async () => ({ default: (await import('@/features/prompter/PrompterLibraryPage')).PrompterLibraryPage }));
const PrompterPage = lazy(async () => ({ default: (await import('@/features/prompter/PrompterPage')).PrompterPage }));
const SetlistDetailPage = lazy(async () => ({ default: (await import('@/features/setlists/SetlistDetailPage')).SetlistDetailPage }));
const SetlistsPage = lazy(async () => ({ default: (await import('@/features/setlists/SetlistsPage')).SetlistsPage }));
const SongDetailPage = lazy(async () => ({ default: (await import('@/features/songs/SongDetailPage')).SongDetailPage }));
const SongWriterPage = lazy(async () => ({ default: (await import('@/features/songs/SongWriterPage')).SongWriterPage }));
const SyncPage = lazy(async () => ({ default: (await import('@/features/sync/SyncPage')).SyncPage }));
const HomePage = lazy(async () => ({ default: (await import('@/features/home/HomePage')).HomePage }));
const CalendarPage = lazy(async () => ({ default: (await import('@/features/events/CalendarPage')).CalendarPage }));
const LandingPage = lazy(async () => ({ default: (await import('@/features/landing/LandingPage')).LandingPage }));
const EpkPage = lazy(async () => ({ default: (await import('@/features/epk/EpkPage')).EpkPage }));
const SongTimelineEditorPage = lazy(async () => ({ default: (await import('@/features/song-timeline/SongTimelineEditorPage')).SongTimelineEditorPage }));

function RouteFallback() {
  return <SplashScreen animated={false} />;
}

export function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/prompter/play" element={<PrompterPage />} />
      <Route path="/songs/:songId/write" element={<SongWriterPage />} />
      <Route path="/account/epk" element={<EpkPage />} />
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/booking" element={<BookingPage />} />
        <Route path="/booking/:bookingId" element={<BookingPage />} />
        <Route path="/songs" element={<SongsPage />} />
        <Route path="/songs/:songId" element={<SongDetailPage />} />
        <Route path="/songs/:songId/structure" element={<SongTimelineEditorPage />} />
        <Route path="/imports" element={<Navigate to="/songs" replace />} />
        <Route path="/musiques" element={<Navigate to="/songs" replace />} />
        <Route path="/setlists" element={<SetlistsPage />} />
        <Route path="/setlists/:setlistId" element={<SetlistDetailPage />} />
        <Route path="/prompter" element={<PrompterLibraryPage />} />
        <Route path="/sync" element={<SyncPage />} />
        <Route path="/metronome" element={<MetronomePage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      </Routes>
    </Suspense>
  );
}

function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-fz-text">Page introuvable</h1>
        <p className="text-sm text-fz-text-muted">Cette page n’existe pas ou a été déplacée.</p>
      </div>
      <Button variant="primary" leadingIcon={<FzIcon name="home" usageId="router.not-found.home" size="sm" />} onClick={() => navigate('/home')}>
        Retour à l’accueil
      </Button>
    </main>
  );
}
