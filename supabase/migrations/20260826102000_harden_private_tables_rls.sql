-- Defense in depth: private tables are only reachable from trusted SQL functions.
-- No anon/authenticated policy is intentionally created.
REVOKE ALL ON TABLE
  private.workspace_role_migration_journal,
  private.workspace_integrity_quarantine,
  private.workspace_integrity_repair_journal,
  private.workspace_invite_migration_journal,
  private.profile_migration_journal,
  private.personal_workspace_migration_run,
  private.personal_workspace_migration_journal,
  private.account_deletion_requests,
  private.account_deletion_archive,
  private.audio_file_migration_quarantine,
  private.audio_upload_reservations,
  private.audio_upload_rate_events,
  private.epk_asset_cleanup_jobs
FROM PUBLIC, anon, authenticated;

ALTER TABLE private.workspace_role_migration_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.workspace_integrity_quarantine ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.workspace_integrity_repair_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.workspace_invite_migration_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.profile_migration_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.personal_workspace_migration_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.personal_workspace_migration_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.account_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.account_deletion_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.audio_file_migration_quarantine ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.audio_upload_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.audio_upload_rate_events ENABLE ROW LEVEL SECURITY;
