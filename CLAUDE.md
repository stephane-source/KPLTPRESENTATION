# CLAUDE.md — Kopilot Finance (Steph)

> **Comment Claude Code doit travailler sur ce projet.**
> Ce fichier est lu automatiquement à chaque session par Claude Code.
> Le tenir à jour quand l'architecture évolue.

---

## 🎯 PROJET

**Kopilot Finance** — `kopilot-finance.fr` / `kplt-presentation.vercel.app`

Plateforme single-file HTML/JS (`index.html` ~1.32 Mo) qui génère des rapports d'audit financier multi-slides (~45-55 slides selon dossier) à partir de :
- **FEC** (Fichier des Écritures Comptables, format DGFiP)
- **SILAE** (exports paie .csv/.xlsx)
- **PDFs leasing/emprunts** (extraction via Claude API)

**Secteurs supportés** : Centre de Santé (CdS), SEL Dentaire, Pharmacie, Audioprothèse, Générique.

---

## ⚠️ ENVIRONNEMENT WINDOWS

- **Python NON disponible** (Exit 49 Microsoft Store hijack)
- Toujours utiliser **`node -e`** pour validation syntaxe / parsing / extraction, **JAMAIS `python -c`**
- Exemples Python plus bas dans ce fichier (section "COMMANDES BASH UTILES POUR TOI") sont **obsolètes sur cette machine** — les transposer en Node si besoin

Snippet validation `index.html` :
```bash
cd "C:/Users/perez/Desktop/KPLT PRESENTATION" && node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf-8');
const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
const scripts = []; let m;
while((m = re.exec(html)) !== null) scripts.push(m[1]);
fs.writeFileSync('_kplt_check.js', scripts.join('\n//---SEP---\n'));
console.log('extracted ' + scripts.length + ' scripts');
" && node --check _kplt_check.js && echo "SYNTAX OK"
```

---

## 📁 STRUCTURE DU PROJET

```
C:\Users\perez\Desktop\KPLT PRESENTATION\
├── index.html                    # Tout le code (HTML + JS + CSS) — 1.32 Mo
├── index_BACKUP_*.html           # Backups manuels avant gros changements
└── (PAS de node_modules, PAS de build, single-file)
```

**Pas de framework, pas de bundler**. Tout est dans `index.html`.
**Pas de Git** (Vercel reject API key push from GitHub) — déploiement direct via `vercel --prod`.

---

## 🚀 WORKFLOW DÉPLOIEMENT

```cmd
:: 1. Backup (toujours avant gros changements)
copy index.html index_BACKUP_DDMMYYYY.html

:: 2. Push Vercel
vercel --prod

:: 3. Vérifier la version live (Ctrl+Shift+R sur le navigateur)
:: Test F12 console : doit retourner true
fetch(location.href).then(r=>r.text()).then(t=>console.log(t.includes("Auxiliaires 411 non ventilés")))
```

**Production URL** : https://kplt-presentation.vercel.app  
**Admin Firestore UID** : `mcsF5DgzPzTjQZ0w1flAggqanEF2`

---

## 🏗️ ARCHITECTURE INTERNE

### Phases d'exécution
1. **Questionnaire** : `mountQuestionnaire()` → recueille options (`answers`)
2. **Upload fichiers** : FEC, SILAE, PDFs leasing → drag & drop
3. **Parsing** : `parseFEC(fileContent)`, `parseSILAE(fileContent)` → objets `parsedMap[entityId]`, `ST.parsedSILAE[entityId]`
4. **Calcul conso** : `calcConso(ents, parsedMap, answers)` → objet `co` avec tous les agrégats
5. **Génération slides** : `buildSXxx(...)` builders → array de slides HTML
6. **Commentaires IA** : `generateAllAIComments(...)` (Claude API call) avec fallback `generateFallbackComments(...)`
7. **Assemblage** : `assembleReport(slides)` → HTML final

### Helpers cross-cutting (à NE PAS dupliquer)
- **`computeMSCoutTotal(ents, parsedSILAE, parsedMap, answers, co)`** : ligne 3845. Source unique pour MS Coût Global. Priorité SILAE total `cout` (validé ratio coût/brut 1.05–2.5), fallback `co.cMSAssimile` FEC. Utilisé en slide 4 (ExecSum), 13 (Conso ligne CONSOLIDÉ), 17 (Ratios), 24 (MS conso SILAE).
- **`computeLeasingTotal(parsedMap, ents)`** : source unique pour leasing/EBITDAR. Logique : 612x root OR mapping leasing OR regex `LEASING|CREDIT-BAIL|LOA|LLD` sur 6x label. Utilisé sur ~10 sites.
- **DPO formula** : `Fourn / (CA/365)`, capé `>1an` si > 365j (cohérent slides BFR + TopFourn).
- **DSO conso** : **pondéré CA** (`Σ créances tiers / (Σ CA / 365)`), **PAS** moyenne arithmétique des entités.

### Variables clés exposées dans `co` (return calcConso)
```javascript
{
  cCA, cEBITDA, cRN, cTreso, cMS, cAssimile, cMSAssimile, cRemDir, cPratBrut,
  cFRNG, cBFR, cDAP, cCAF,                  // Ajoutés 27/04 pour fallback IA
  intercoCA, assoEnts, sasEnt, sasp, is2asso, sasConso, consoParAsso,
  intercoFlows, cCA_horsInterco
}
```

**Ne jamais utiliser `gfk(co.cXXX || 0)`** dans un commentaire fallback **sans vérifier que cXXX est exposé**. Sinon → "0k€" affiché → hallucination IA.

---

## 🔥 RÈGLE TRANSVERSALITÉ (NON NÉGOCIABLE)

**Tous les fix bugs et nouvelles analytiques vont dans le tronc commun applicable à tous secteurs (CdS/Audio/Pharma/Dentaire/Générique).**

Le gating sectoriel se fait **uniquement** quand la logique métier l'exige :
- KPIs spécifiques (MS coût/CA pour CdS vs ETP pour Audio)
- Benchmarks chiffrés (DSO 30j CdS vs 45j Pharma)
- Terminologie (praticien vs ETP audio)

→ Toujours via le `SECTOR_CONFIG` (lignes ~775-905 de `index.html`).

Si un fix concerne 1 seul secteur, **le documenter explicitement** en commentaire `// ★ FIX YY/MM CdS uniquement : ...`.

---

## ⚠️ INVARIANTS DATA (NON NÉGOCIABLE)

### 1. Zéro invention, zéro hallucination
**Tout chiffre affiché doit être pré-calculé en JS et transmis en valeur fixe.** L'API Claude est uniquement formatage/commentaire, **jamais recalcul**.

→ Labels explicites `"NE PAS RECALCULER"` partout dans les prompts IA.

### 2. EBITDA / EBITDAR / EBITDA Normatif
- **EBITDA Comptable** = sortie P&L brute (pas touchée)
- **EBITDAR** = EBITDA + 612x (crédit-bail) + comptes mappés "leasing" dans comptesMapping
- **EBITDA Normatif Full Year** = EBITDAR + retraitements dirigeants/exceptionnels — **uniquement si `hasRetraitBeyondLeasing` est true**, sinon affiche EBITDAR seul

→ Labels conditionnels obligatoires (≥ 6 emplacements code).
→ EBITDAR ne contient **PAS** tous les 613x indistinctement, **uniquement** les comptes leasing explicitement classifiés.

### 3. Détection SAS de gestion (CdS 1asso+1SAS)
Ordre des heuristiques dans `calcConso` :
1. `answers.nomSas` match exact
2. Forme juridique Pappers (SAS/SARL/EURL)
3. Entité avec le **plus petit CA**
4. Fallback : dernière entité

→ **Ne jamais supposer la position** dans `ents`.

### 4. Constitution CA (slides ~27-28 selon config)
- **Skip pour SAS de gestion** (pas de patient, refacturation interco uniquement)
- **Si mono-catégorie** (>95% dans une seule cat) → afficher bloc avertissement orange `⚠️ Auxiliaires 411 non ventilés`, **pas** de donut mono-couleur

### 5. SILAE parsing
- Colonnes par défaut **K(10) / P(15)** (brut / coût)
- Validation : ratio coût/brut entre **1.05 et 2.5**
- Header match : `startsWith("cout")` (exclut "Suppléments coût global" col O)
- Skip rows brut=0
- CdS : split Dentistes / MG. Si `splitPraticiens=true` ET groupes médecins/kiné vides → auto-merge "praticiens" génériques en "dentistes"

### 6. MS / CA ratio
**100% issu de la P&L comptes de résultat** : `(FEC 64x − remDir644 − remDir646 + assimilé) / CA`
- CdS inclut **63x** (taxe salaires) ❓ **À CONFIRMER** : actuellement le rollback de fin avril 2026 a retiré l'inclusion 63x. Si Steph veut réintégrer, c'est dans `parseFEC` champ `taxesRH` + injection dans `cMS` dans `calcConso`. **Voir historique conversation Claude.ai du 27-29 avril 2026.**
- Audio/Pharma : exclut 63x
- SILAE utilisé uniquement pour le **détail par spécialité** (jamais pour le ratio global, sauf via `computeMSCoutTotal` qui priorise SILAE total)

---

## 🎨 DESIGN SYSTEM V2 — "Navy Raffiné"

### Palette
- **Header navy** : `#0A1E6E` (60px de haut, plat, pas de gradient)
- **Cyan accent** : `#00C2CB`
- **Background slide** : `#F8F9FC`
- **Alt rows tableaux** : `#F3F5FA`
- **Footer** : 32px navy minimal

### Polices
- **KPI labels** : `font-size:10px; text-transform:uppercase; letterSpacing:0.3px`
- **KPI values** : `font-size:36px; font-weight:800`
- **Body text** : `12px / 13px` selon contexte
- **Header titles** : auto-scale `18px` si > 35 chars, sinon `20px`

### Règles strictes
- Slides remplissent **tout l'espace 16:9** — pas de zones blanches > 25%
- Séparateurs de section : emoji 48px + titre 28px + barre cyan 3px
- KPI cards : label-top + bordure gauche cyan 3px

---

## 📐 STRUCTURE STANDARD D'UN RAPPORT (CdS 1asso+1SAS)

~43-46 slides selon options activées :

```
1. Cover
2. Sommaire
3. Vue d'Ensemble (séparateur)
4. Contexte Groupe
5. Chiffres Clés Consolidés (ExecSum)
6. Activité Mensuelle Consolidée
7-8. Activité par entité (skip Asso si CdS 1asso+1SAS — identique au conso)
9. Structure Groupe
10. Performance Économique (séparateur)
11-12. P&L par entité
13. Subventions
14. Ratios Consommables
15. Consolidation Groupe
16. Cascade EBITDA → Normatif Full Year (si retraitements)
17-19. Charges + Top Charges par entité
20. Ratios vs Benchmarks
21. Classification analytique (si activé)
22. Ressources & Revenus (séparateur)
23-25. MS par entité + Conso SILAE
26-27. Productivité (skip SAS)
28-29. Constitution CA (skip SAS, skip mono-catégorie)
30. Bilan & Structure (séparateur)
31-32. Bilans par entité
33-34. Fiscal/Social par entité
35. Équilibre Financier
36. Flux Trésorerie
37. BFR & Cycle
38. DPO Retraité Hors IC
39. Fournisseurs (séparateur)
40-42. Top Fourn par entité
43. Synthèse Interco Groupe
44-45. Balance âgée Fourn / Clients
46. Endettement & Financement
47. Conclusion
48. Glossaire
49. Disclaimer
```

---

## 🛠️ COMMANDES BASH UTILES POUR TOI

### Localiser une fonction
```bash
grep -n "function buildSXxx\|computeYyy" index.html | head -5
```

### Voir un range de lignes
```bash
sed -n '6500,6550p' index.html
```

### Vérifier syntaxe JS (extraire scripts puis node --check)
```bash
python3 -c "
import re
html = open('index.html').read()
scripts = re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>', html, re.DOTALL)
open('/tmp/check.js','w').write('\n'.join(scripts))
" && node --check /tmp/check.js
```

### Tester un fix sur un rapport généré
```bash
# Vérifier qu'un marqueur du fix est présent dans un rapport
grep -c "Auxiliaires 411 non ventilés" rapport_genere.html
```

### Audit des slides d'un rapport
```python
import re
html = open('rapport.html').read()
slides = re.split(r'<div[^>]*class="slide"[^>]*>', html)
print(f"Total: {len(slides)-1} slides")
for i in range(1, len(slides)):
    pag = re.search(r'(\d+)/\d+', slides[i])
    title = re.search(r'font-size:20px[^"]*"[^>]*>([^<]{3,80})', slides[i])
    print(f"#{i:>2} ({pag.group(0) if pag else '?'}): {title.group(1).strip()[:65] if title else '?'}")
```

---

## 🐛 BUGS RÉCENTS RÉSOLUS (avril 2026)

Tous présents dans `index.html` v6 (MD5 `3f9d4fd5...`, 1 318 536 octets) :

| # | Bug | Fix |
|---|-----|-----|
| 1 | Cascade phrase tronquée "positif **mais.**" | Reformulée "positif et reflète la profitabilité" |
| 2 | Constitution CA mono-catégorie donut orange | Détection >95% mono-cat → bloc avertissement |
| 3 | Constitution CA pour SAS gestion absurde | Skip via `co.sasEnt.id === e.id` |
| 4 | DSO 22j marqué Hors cible | Seuil 20j → 30j (3 secteurs CdS) |
| 5/6 | "FRNG/BFR/CAF 0k€" hallucinés | `cFRNG`, `cBFR`, `cCAF` exposés dans `co` |
| 7 | DPO IC 16 350j affiché | Cap `>1an` si > 365j |
| 7b | DSO conso 134j moyenne arithmétique | Pondéré CA `Σ créances / (Σ CA/365)` |
| 9 | DN Fin = -tréso (faux) | DN Fin = `Σ emprunts - tréso` |
| Cascade | "EBITDA Normatif" affiché = EBITDAR | Label adaptatif `hasRetraitBeyondLeasing` |
| C1 | Comparatif cover "1/9" pour 32 slides | Utilise `99999/99998` markers |
| C2 | Comparatif "Confidentiel undefined" | `R.slide("", body, footer, true)` 4 args |

---

## 📝 CONVENTIONS DE COMMIT (par toi-même Claude)

Quand tu modifies `index.html`, **toujours** :
1. Lire la zone touchée d'abord (`view` ou `sed -n`)
2. Utiliser `str_replace` avec contexte multi-lignes pour éviter ambiguïté
3. Ajouter un commentaire `// ★ FIX DD/MM transverse : ...` ou `// ★ FIX DD/MM CdS uniquement : ...`
4. Valider syntaxe `node --check` après chaque batch
5. Si modif structurelle (>3 fix d'un coup) : créer backup `index_BACKUP_DDMMYYYY.html`

---

## 🔭 ROADMAP POST-LIVRAISONS

Par ordre de priorité (selon Steph) :
1. **Module Break-even cash** (PRIORITÉ) :
   - Recettes = CA dentaire + MG + subv
   - Charges variables = conso 602x + labo 601/607x (% CA)
   - Charges fixes = MS fixes (SILAE), loyer 613x, leasing 612x, capital repayment (débit 164x), intérêts 661x, logiciels 616x, honoraires 622x, assurances, énergie
   - Output : break-even mensuel + safety margin + sensitivity -10%/-20% CA
2. Auth Google
3. Persistance (Firestore déjà câblé)
4. Export PPTX
5. Banque connaissances sectorielles (Interfimo/UNSAF/FSPF drag&drop)

**Sécurité différée** :
- **TODO (reporté, sur demande explicite de Steph uniquement — PAS maintenant)** : la clé API Anthropic est hardcodée dans index.html public (ligne ~1261). Elle a été **allowlistée dans GitHub Push Protection le 26/07** pour débloquer le flux Git → elle est désormais **en clair dans le repo GitHub** (en plus de l'app déployée). **Traitement prévu** : révoquer la clé exposée → nouvelle clé en **variable d'env Vercel** consommée par le proxy `api/` (sort d'index.html). **Ne pas lancer sans signal explicite de Steph.**
- **Risque assumé** : clé Pappers hardcodée ligne ~984 — fix prévu post-deadline via proxy Vercel Edge Function.

---

## 🚨 GARDE-FOUS — CE QU'IL NE FAUT PAS FAIRE

- **Ne pas** ré-exposer la slide Constitution CA pour les SAS de gestion (régression cliente)
- **Ne pas** revenir à `DSO conso = moyenne arithmétique` (incohérent en présence de SAS interco)
- **Ne pas** utiliser `gfk(co.cXXX||0)` sans vérifier que `cXXX` est dans le `return` de `calcConso`
- **Ne pas** appeler `R.slide(body, footer)` (2 args) — c'est `R.slide(header, body, footer, isCover?)` (4 args)
- **Flux de déploiement (règle actée 26/07)** : `commit → push origin master → déploiement Git auto`. **Plus jamais de `vercel --prod` sur worktree modifié** (source:cli + gitDirty = travail non versionné). Le blocage push (API key) est levé (secret allowlisté). Chaque lot = commit propre + build-id stampé.
- **Ne pas** modifier l'ordre des heuristiques de détection SAS dans `calcConso` (cassé d'autres dossiers)
- **Ne pas** assumer que `dpoIC <= 365` (cap toujours nécessaire pour les flux interco massifs)

---

## 💬 STYLE DE COMMUNICATION AVEC STEPH

- **Français informel**, technique, brief direct
- Steph audite les rapports et signale les bugs **par numéro de slide** → fournir réponse ciblée
- Préfère **un seul pass de corrections** plutôt que ping-pong
- Audits suivent grille : **Finance & Analytique / Design & Lisibilité / Storytelling** avec scores feu tricolore
- Jamais de blabla excessif, toujours code → validation → livraison
- Si problème "gros bug Vercel" → demander screenshot console F12 immédiatement, ne pas tâtonner

---

## 📞 ESCALADE / SOURCES

- **Documentation Anthropic** : https://docs.claude.com
- **Pappers API** (enrichissement SIREN) — clé dans index.html
- **Interfimo / UNSAF / FSPF** : sources benchmarks sectoriels (drag&drop dans questionnaire prévu)
- **Firestore** : `window.fbAuth/fbDb/fbStorage` exposés après init

---

*Dernière mise à jour : 29/04/2026 — fin de session debug ALAVIA + audits 3 rapports finaux*
