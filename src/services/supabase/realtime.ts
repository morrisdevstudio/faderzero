import { supabase } from './client';
import { getSession } from './auth';

export function subscribeToWorkspaceChanges(
  workspaceId: string,
  onChange: (tableName: string) => void
) {
  const channel = supabase
    .channel(`workspace:${workspaceId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        filter: `workspace_id=eq.${workspaceId}`,
      },
      async (payload) => {
        try {
          const session = await getSession();
          const currentUserId = session?.user?.id;

          const lastModifiedBy = payload.new ? (payload.new as any).last_modified_by : null;

          if (currentUserId && lastModifiedBy === currentUserId) {
            return;
          }

          onChange(payload.table);
        } catch (err) {
          console.error('[Realtime Event Handler Error]', err);
          onChange(payload.table);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        return;
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn('[Realtime Status]', status);
        onChange('__realtime__');
      }
    });

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}
