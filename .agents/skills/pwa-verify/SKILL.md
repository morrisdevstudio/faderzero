---
name: pwa-verify
description: Vérifie une modification de la PWA FaderZero après un changement de code ou avant de déclarer une tâche terminée.
---

1. Exécuter `powershell -File scripts/ai/verify-pwa.ps1`.
2. Ne pas analyser les dépendances ou le dépôt entier.
3. En cas de réussite, rapporter uniquement les contrôles validés.
4. En cas d'échec, analyser uniquement les dernières lignes retournées.
5. Corriger la première cause réelle, puis relancer une seule fois la commande pertinente.
6. Ne pas relancer plusieurs fois une commande inchangée.
7. Utiliser `-Full` uniquement avant un commit, une release, une livraison ou à la demande explicite.
