# Supabase — FaderZero

Les migrations versionnées de `migrations/` sont l’unique source de vérité pour le schéma, la sécurité RLS, les fonctions SQL et le stockage Supabase.

## Appliquer les migrations

Utiliser Supabase CLI sur un environnement explicitement ciblé. Ne jamais appliquer une migration directement sur la production sans sauvegarde et validation préalable.

```powershell
supabase migration list
supabase db push
```

Pour une base locale, démarrer Supabase puis appliquer les migrations :

```powershell
supabase start
supabase migration up --local
```

## Vérifications

Après une migration, exécuter les contrôles SQL versionnés dans `tests/`, ainsi que :

```powershell
supabase db lint --local --schema public,private --level warning --fail-on error
supabase db advisors --local --type security --level warn --fail-on error
```

Les données de démonstration sont dans `seed.sql`. Aucun script de reset destructif n’est conservé dans ce dépôt.
