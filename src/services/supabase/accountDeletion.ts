import { assertSupabaseConfig, supabase } from './client';

export interface AccountDeletionBlocker {
  workspaceId: string;
  workspaceName: string;
}

function normalizeDeletionError(error: unknown): Error {
  const message = error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : String(error ?? '');

  if (message.includes('LAST_ADMIN_BLOCKS_ACCOUNT_DELETION')) {
    return new Error('Vous devez promouvoir un autre administrateur dans chaque groupe bloquant.');
  }
  if (message.includes('EMAIL_CONFIRMATION_REQUIRED')) {
    return new Error('Rouvrez le lien reçu par e-mail avant de confirmer la suppression.');
  }
  if (message.includes('ACCOUNT_DELETION_LINK_UNAVAILABLE')) {
    return new Error('Ce lien de suppression est expiré, déjà utilisé ou indisponible.');
  }

  return error instanceof Error ? error : new Error('Impossible de traiter la suppression du compte.');
}

export async function getAccountDeletionBlockers(): Promise<AccountDeletionBlocker[]> {
  assertSupabaseConfig();
  const { data, error } = await supabase.rpc('get_account_deletion_blockers');
  if (error) throw normalizeDeletionError(error);

  return ((data ?? []) as Array<{ workspace_id: string; workspace_name: string }>).map((row) => ({
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
  }));
}

export async function requestAccountDeletion(): Promise<void> {
  assertSupabaseConfig();
  const blockers = await getAccountDeletionBlockers();
  if (blockers.length > 0) {
    throw new Error(`Suppression bloquée : ${blockers.map((blocker) => blocker.workspaceName).join(', ')}.`);
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw normalizeDeletionError(sessionError);
  const email = sessionData.session?.user.email;
  if (!email) throw new Error('Session utilisateur invalide.');

  const { data: requestData, error: requestError } = await supabase
    .rpc('create_account_deletion_request')
    .single();
  if (requestError) throw normalizeDeletionError(requestError);
  const token = (requestData as { token?: unknown } | null)?.token;
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) {
    throw new Error('Impossible de créer le lien de suppression.');
  }

  const confirmationUrl = new URL('/account', window.location.origin);
  confirmationUrl.searchParams.set('delete-account', token);
  const { error: emailError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: confirmationUrl.toString(),
    },
  });
  if (emailError) throw normalizeDeletionError(emailError);
}

export async function deleteCurrentAccount(token: string): Promise<void> {
  assertSupabaseConfig();
  if (!/^[0-9a-f]{64}$/.test(token)) {
    throw new Error('Lien de suppression invalide.');
  }

  const { error } = await supabase.rpc('delete_current_account', { p_token: token });
  if (error) throw normalizeDeletionError(error);
}

export function getAccountDeletionToken(search = window.location.search): string | null {
  const token = new URLSearchParams(search).get('delete-account');
  return token && /^[0-9a-f]{64}$/.test(token) ? token : null;
}
