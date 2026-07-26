# Synchronisation kopilot-core.js — anti-divergence

**But** : le parseur SILAE et les définitions de ratios MS/CA existent en double dans deux dépôts qui
ont divergé :

- `stephane-source/kplt-analytics` → `kopilot-core.js` (**source de vérité**)
- `stephane-source/KPLTPRESENTATION` → `index.html` (copie embarquée, single-file)

Ce document trace ce qui a été porté et comment re-synchroniser.

## Dernière synchro : 2026-07-24

Commits de `kplt-analytics` portés dans `index.html` :

| Commit | Objet | Emplacement dans `index.html` |
|--------|-------|-------------------------------|
| `58a8ddd` | Fix SILAE : conserver les mandataires « sans heures » (brut=0 mais ch.pat/suppléments ≠ 0) ; parser la colonne O « Suppléments coût global » (index 14) ; ne rejeter que les lignes réellement vides (brut=0 ET coût=0 ET suppléments=0) ; contrôle de cohérence `coût = brut + ch.pat + suppléments` en WARNING visible. | `parseSILAERows()` |
| `07cd35f` | Doctrine MS : deux ratios distincts. « MS chargée / CA » (DOCTRINE) = 100% FEC = Σ 64x + 631 (si option taxe sur salaires). « Coût employeur (SILAE) / CA » = paie chargée (brut+ch.pat+suppléments), réservé au détail par tête/catégorie. Suppression de la mention fausse « taxe sur salaires déjà incluse dans le coût employeur SILAE ». Structure asso+SAS → doctrine toujours FEC. | `computeMSCAdoctrine()` + slides MS/conso/exec + prompts IA |

> ⚠️ `kplt-analytics` n'était pas clonable localement lors de cette synchro. Le portage a été fait
> manuellement puis **validé par harness** contre les fichiers client réels (voir plus bas).

## Critères d'acceptation validés (dossier SITBEN, situation 5 mois au 31/05/2026)

| Contrôle | Attendu | Source |
|----------|---------|--------|
| Coût employeur SILAE CMDPC | 1 087 060,84 € (brut 675 308,68 + pat 345 148,61 + suppl 66 603,55) | `_silae_integration.cjs` |
| Coût employeur SILAE CMDMA | 805 039 € | idem |
| Coût employeur SILAE SAS (SAJA) | 51 478 € | idem |
| CA 70x / 64x net / 631 / 602x net / 604 / 706-7061 par entité | voir `_fec_analyze.cjs` | analyse FEC brute |
| Consommables 602x NET CMDPC | 166 443 € (et non 191 866) | FEC net débit−crédit |
| Symétrie interco au 31/05 | 429 253 = 279 253 (PC) + 150 000 (MA) | FEC 706/7061 vs 604 |

## Harness de validation (ne pas committer les données client)

- `_silae_integration.cjs` — extrait le vrai `parseSILAERows` d'`index.html` et le teste contre les 3 SILAE.
- `_silae_harness.cjs` — logique de parsing SILAE isolée (ancien vs nouveau moteur).
- `_fec_analyze.cjs` — analyse FEC brute (DGFiP) indépendante de `parseFEC` (ground-truth ratios).

Les fichiers client sont lus **en place** depuis
`C:\Users\perez\Desktop\Nouveau dossier\CENTRE DE SANTE\Aaron\SITBEN\{CMDMA,CMDPC,SITBEN}` —
**jamais copiés ni committés** (données réelles).

## Procédure de re-synchronisation (prochaine fois)

1. Cloner `kplt-analytics`, ouvrir `kopilot-core.js`.
2. Diff des fonctions `parseSILAEAoA` / `parseSILAERows` et des définitions de ratios MS/CA vs `index.html`.
3. Porter les écarts dans `index.html` (garder les `// ★ SYNC AAAA-MM-JJ (commit)` en regard).
4. `node --check` (via extraction scripts) + `node _anti_regression.cjs` + `node _silae_integration.cjs`.
5. Mettre à jour la date + la table des commits ci-dessus et l'en-tête de `parseSILAERows` dans `index.html`.

## Cible durable (non fait — à arbitrer par Steph)

Extraire `parseSILAERows` + doctrine MS dans un module partagé (npm privé / submodule git, ou
`kopilot-core.js` copié par un script de build avec vérification de hash) pour supprimer la copie.
`index.html` étant single-file (pas de bundler), l'option réaliste est un **script de build** qui
injecte `kopilot-core.js` et vérifie le hash à chaque déploiement.
