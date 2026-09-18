import { useCallback, useContext } from 'react';
import { UNSAFE_NavigationContext, useNavigate } from 'react-router-dom';
import { goBackInApp, leaveScreen, type HistoryIndexSource } from '@/navigation/inAppBack';

function useHistoryIndexSource(): HistoryIndexSource {
  const { navigator } = useContext(UNSAFE_NavigationContext);
  return navigator as HistoryIndexSource;
}

export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate();
  const navigator = useHistoryIndexSource();
  return useCallback(() => {
    goBackInApp(navigate, fallback, navigator);
  }, [fallback, navigate, navigator]);
}

export function useLeaveScreen(fallback: string): () => Promise<void> {
  const navigate = useNavigate();
  const navigator = useHistoryIndexSource();
  return useCallback(() => leaveScreen(navigate, fallback, navigator), [fallback, navigate, navigator]);
}

export function useLeaveTo(): (fallback: string) => Promise<void> {
  const navigate = useNavigate();
  const navigator = useHistoryIndexSource();
  return useCallback((fallback: string) => leaveScreen(navigate, fallback, navigator), [navigate, navigator]);
}
