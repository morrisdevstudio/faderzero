import { useEffect, useState } from 'react';
import { Button } from '@/ui/components/Button';
import { PWA_UPDATE_AVAILABLE_EVENT, type ApplyPwaUpdate } from '@/services/pwa/update';

export function PwaUpdateNotice() {
  const [applyUpdate, setApplyUpdate] = useState<ApplyPwaUpdate | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    function handleUpdateAvailable(event: Event) {
      const updateEvent = event as CustomEvent<ApplyPwaUpdate>;
      setApplyUpdate(() => updateEvent.detail);
    }

    window.addEventListener(PWA_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);
    return () => window.removeEventListener(PWA_UPDATE_AVAILABLE_EVENT, handleUpdateAvailable);
  }, []);

  if (!applyUpdate) return null;

  return (
    <aside
      className="fixed inset-x-4 bottom-[calc(5.8rem+env(safe-area-inset-bottom))] z-[55] mx-auto max-w-sm rounded-2xl border border-sky-300/25 bg-[#111923]/95 p-4 text-sky-50 shadow-2xl backdrop-blur-xl"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-bold">Une mise à jour est prête.</p>
      <p className="mt-1 text-xs text-sky-100/75">Appliquez-la quand vous avez terminé votre action en cours.</p>
      <Button
        className="mt-3"
        size="sm"
        loading={isUpdating}
        onClick={() => {
          setIsUpdating(true);
          void applyUpdate().catch(() => setIsUpdating(false));
        }}
      >
        Mettre à jour
      </Button>
    </aside>
  );
}
