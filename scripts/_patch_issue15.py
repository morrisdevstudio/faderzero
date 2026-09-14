from pathlib import Path

account = Path(r"src/features/account/AccountPage.tsx")
text = account.read_text(encoding="utf-8")

old_import = """  createWorkspaceInviteLink,
  canAdministerWorkspace,"""
new_import = """  buildWorkspaceInviteUrl,
  createWorkspaceInviteLink,
  canAdministerWorkspace,"""
if old_import not in text:
    raise SystemExit("import block not found")
text = text.replace(old_import, new_import, 1)

old_fmt = '''function formatInviteRemaining(expiresAt: string): string {
  const remainingMilliseconds = new Date(expiresAt).getTime() - Date.now();
  if (remainingMilliseconds <= 0) return 'Expiré';
  const remainingMinutes = Math.max(1, Math.ceil(remainingMilliseconds / 60000));
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function CopyIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}'''
new_fmt = '''function formatInviteRemaining(expiresAt: string): string {
  const remainingMilliseconds = new Date(expiresAt).getTime() - Date.now();
  if (remainingMilliseconds <= 0) return 'Expiré';
  const remainingMinutes = Math.max(1, Math.ceil(remainingMilliseconds / 60000));
  const days = Math.floor(remainingMinutes / (60 * 24));
  const hours = Math.floor((remainingMinutes % (60 * 24)) / 60);
  const minutes = remainingMinutes % 60;
  if (days > 0) return hours > 0 ? `${days} j ${hours} h` : `${days} j`;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function inviteShareUrl(invite: WorkspaceInviteSummary): string | null {
  if (!invite.token) return null;
  return buildWorkspaceInviteUrl(invite.token);
}'''
if old_fmt not in text:
    raise SystemExit("formatInviteRemaining block not found")
text = text.replace(old_fmt, new_fmt, 1)

old_state = """  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [activeInvites, setActiveInvites] = useState<WorkspaceInviteSummary[]>([]);
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});
  const [inviteToRevoke, setInviteToRevoke] = useState<WorkspaceInviteSummary | null>(null);"""
new_state = """  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [activeInvites, setActiveInvites] = useState<WorkspaceInviteSummary[]>([]);
  const [inviteToRevoke, setInviteToRevoke] = useState<WorkspaceInviteSummary | null>(null);
  const [inviteToReplace, setInviteToReplace] = useState(false);"""
if old_state not in text:
    raise SystemExit("state block not found")
text = text.replace(old_state, new_state, 1)

account.write_text(text, encoding="utf-8")
print("account partial 1 ok")
