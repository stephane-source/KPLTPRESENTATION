# Changelog — Feature Email Synthèse

## Livré le 2026-05-04 (soir)
- `api/send-report.js` créé : décompresse `htmlGz`, génère PDF via Browserless, envoie via Resend depuis `stephane@kopilot-finance.fr` avec PDF en pièce jointe
- `api/generate-pdf.js` réutilisé tel quel (pas de duplication de logique Browserless)
- `index.html` : bouton 📨 Email cyan `#00BCD4` à côté de 📄 PDF dans Mes Dossiers + CSS `.kplt-dossier-email` + handler click + modal `kpltOpenEmailModal` (To / CC / Sujet / Message pré-remplis éditables)
- `package.json` : ajout dep `resend` ^4.8.0
- `vercel.json` : déclaration fonction `api/send-report.js` (1024MB / 60s)

## Correctifs 2026-05-05 (matin)
- **Format PDF** : `preferCSSPageSize: false` → `true` dans `api/send-report.js` (l.88) et `api/generate-pdf.js` (l.43) ; suppression du keyword `landscape` dans les deux règles `@page` de `index.html` (l.10882 + l.13679) → format `@page{margin:0;size:1280px 720px}` (margin avant size)
- **Multi-admin** : refactor scalaire `ADMIN_UID` → tableau `ADMIN_UIDS` dans `api/send-report.js` (l.9-12) + check `!ADMIN_UIDS.includes(uid)` (l.50)

## État actuel
- Placeholder `'UID_ASSOCIE_A_REMPLACER'` toujours en place : `api/send-report.js` ligne 11
- Pas encore push prod : modifs validées syntaxe (`node --check`) mais non déployées (`vercel --prod` reste à lancer après remplacement UID)

## TODO 2026-05-06
- Récupérer l'UID réel de l'associé dans Firebase Console → Authentication → Users
- Remplacer `'UID_ASSOCIE_A_REMPLACER'` ligne 11 de `api/send-report.js`
- Tester localement (`vercel dev` + bouton 📨) avec le compte de l'associé
- `vercel --prod`
