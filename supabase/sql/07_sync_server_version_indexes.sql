-- Indexes aligned with incremental pull queries:
-- where workspace_id = ? and server_version > ? order by server_version asc

CREATE INDEX IF NOT EXISTS idx_songs_workspace_server_version
  ON public.songs(workspace_id, server_version);

CREATE INDEX IF NOT EXISTS idx_setlists_workspace_server_version
  ON public.setlists(workspace_id, server_version);

CREATE INDEX IF NOT EXISTS idx_setlist_songs_workspace_server_version
  ON public.setlist_songs(workspace_id, server_version);

CREATE INDEX IF NOT EXISTS idx_song_assets_workspace_server_version
  ON public.song_assets(workspace_id, server_version);
