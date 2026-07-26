# BREAK-EVEN CASH — PHASE 1 STATUS

**Statut : Phase 1 codée, NON testée.**
Pose terminée le 2026-05-05 ~17:55. Test reporté au matin suivant.

---

## Localisation engine — `index.html` lignes 3978-4628

| Élément | Ligne | Rôle |
|---|---|---|
| `KPLT_TAGS_NATURE_BE` | 3978 | Table de classification v3 (variable / fixe / mixte par tag) |
| `getTagNatureBE(tag, sectorKey, libelleCompte, dossierOverrides)` | 4199 | Lookup nature d'un tag avec overrides sectoriels et dossier |
| `classifyChargesForBreakEven(comptesList, sectorKey, silaeData, dossierOverrides, userTagsOverrides, entId)` | 4220 | Décompose les charges d'une entité en variable/fixe |
| `computeBreakEvenCash(parsedMap, ents, options)` | 4431 | Engine principal — retourne `{ parEntite, consolide, sectorKey, includeDAP }` |
| Fin engine (`// FIN Engine Break-Even Cash Phase 1`) | 4677 | — |

## Décisions validées

- **`caShifts = [-0.20, -0.10, 0]`** (ligne 4566) — gradient de stress décroissant gauche→droite : `CA -20%` / `CA -10%` / `CA réel`.
- **`varShifts = [0, 0.05, 0.10]`** (ligne 4567) — augmentation coûts variables : +0% / +5% / +10%.
- **Matrice sensibilité 3×3** : lignes = varShifts, colonnes = caShifts. Stockée dans `parEntite[entId].sensibilite3x3.{comptable,normatif}`.
- **Single source of truth leasing** : `computeLeasingTotal(parsedMap, ents)` injecté dans `cls.fixe.leasing` — pas de duplication 612x.
- **Capital repayment** : priorité PDF (`ST.extractedDebts`), fallback FEC débit 164x, sinon `aucun`.
- **Consolidé** : neutralisation interco fixe (loyers/refact groupe) + CA hors interco via `calcConso.cCA_horsInterco`.

## État UI

**Aucune UI ajoutée.** Engine pur, isolé.
- Pas de slide `buildSXxx`
- Pas de bouton, pas de modal, pas de hook dans le questionnaire
- `computeBreakEvenCash` doit être appelé manuellement (console F12, ou wiring Phase 2)

## Production

**Intacte. Rien n'a été pushé.**
- Aucun `vercel --prod` lancé sur la session du 2026-05-05
- `kplt-presentation.vercel.app` reste sur la version d'avant Phase 1
- Pas de commit Git non plus (statut local : `M index.html`)

---

## Reste à faire

### A. Test Phase 1 (PRIORITÉ — demain matin)

Test en console F12 sur dossier réel — **Le Perreux** (option retenue par Steph), CRD33 en backup.

Procédure :
1. Relancer `vercel dev` dans `C:/Users/perez/Desktop/KPLT PRESENTATION` (port 3000 ou 3001 si 3000 occupé)
2. Ouvrir `http://localhost:<port>`, login Google admin
3. Upload FEC + SILAE + PDFs emprunts Le Perreux, générer rapport
4. F12 → Console → coller les **3 snippets de test** (côté assistant, à redemander)
   - Snippet 1 : pré-flight env
   - Snippet 2 : exécution `computeBreakEvenCash` + résumé par entité + consolidé
   - Snippet 3 : matrice sensibilité 3×3 + sanity ordre `caShifts` / `varShifts`
5. Coller le résultat console brut à l'assistant pour validation des ordres de grandeur.

Sanity attendus principaux :
- `tauxMarge` entre 0 et 1, `BE_comptable ≤ BE_normatif`
- Cellule bas-gauche matrice (var +10% / CA -20%) = pire scénario
- Cellule haut-droite (var +0% / CA réel) ≈ EBITDA cash réel mensuel

### B. Phase 2 — UI (uniquement après validation Phase 1)

- Option questionnaire : « Activer Break-Even Cash » (Oui/Non)
- Slides dédiés : séparateur + analyse par entité + consolidé + matrice 3×3
- Mini-panneau « Avancé » : override tags, toggle `includeDAP`, neutralisation interco manuelle
- Wiring `computeBreakEvenCash` dans pipeline `assembleReport`

---

## Reprise rapide demain matin

```cmd
cd "C:/Users/perez/Desktop/KPLT PRESENTATION"
vercel dev
```

Puis Chrome → login Google admin → dossier Le Perreux → F12 → demander les 3 snippets à l'assistant et les coller.

*Dernière mise à jour : fin de session 2026-05-05.*
