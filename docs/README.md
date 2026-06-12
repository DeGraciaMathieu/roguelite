# PRD — Roadmap d'amélioration

Index des PRD du dossier. Chaque document suit le même gabarit : objectif,
existant technique, comportement, hors-scope, impacts par couche, critères
d'acceptation, tests, risques.

Conventions du projet (rappel, voir `CLAUDE.md`) : avant d'implémenter une
feature, présenter structure de fichiers + nouveaux types, faire valider,
puis coder. `npm run typecheck` et `npm run test` doivent passer.

## Priorisation

| # | PRD | Impact | Effort | Dépendances |
|---|-----|--------|--------|-------------|
| 01 | [Scaling de difficulté + théropode](prd-01-difficulty-scaling.md) | ★★★ | Moyen | — |
| 02 | [Audio](prd-02-audio.md) | ★★★ | Moyen | — |
| 03 | [Reliques](prd-03-reliques.md) | ★★★ | Moyen+ | — |
| 04 | [Game feel (feedback de combat)](prd-04-game-feel.md) | ★★ | Faible | — |
| 05 | [Vision limitée](prd-05-vision-limitee.md) | ★★ | Moyen | — |
| 06 | [Portes verrouillées + clés](prd-06-portes-verrouillees.md) | ★★ | Moyen | — |
| 07 | [Saignement (bleed/cure)](prd-07-saignement.md) | ★ | Faible | 03 souhaitable (loot d'antidotes) |
| 08 | [Fusil (rifle)](prd-08-rifle.md) | ★ | Faible | — |
| 09 | [Silhouettes orientées](prd-09-silhouettes.md) | ★ | Faible | — |

Trio recommandé pour commencer : **01 → 02 → 03**.

## État du jeu au moment de la rédaction

Boucle complète : hub → descente procédurale infinie ou extraction (étage 2+,
bonus ×1,5) → mort/extraction → récompenses méta persistées (`localStorage`
versionné) → hub (boutique : shotgun à 150 crédits, loadout).

En jeu : raptors (meute : alerte partagée + encerclement) et compys, IA
idle/patrol/chase/attack avec ligne de vue, salles à patterns (piliers,
caisses, cloisons en L, étagères), fosses (bloquent les corps, pas les tirs),
loot (munitions sélectives, medkits ×4 max, touche H), dash (Espace, 150 ms,
cooldown 800 ms), minimap brouillard de guerre, HUD vie/dash/munitions.

142 tests, TypeScript strict, déterminisme seedé de bout en bout
(`?seed=` rejouable).
