---
name: harness
description: Use when working on the headless balancing harness — scripted agent policies, headless run piloting, telemetry, or balance reports in the dinocrisis project
auto_invoke: true
---

# Balancing harness

Joue des runs **headless** (sans Pixi ni DOM) pour l'équilibrage, en réutilisant
les systèmes tels quels via `stepRun`. **Consommateur en lecture** du gameplay :
aucune logique de jeu ne vit ici, le gameplay reste strictement intact.

## Déterminisme

Mêmes seeds + mêmes politiques → mêmes records, à l'octet près. Les agents et la
télémétrie ne tirent **aucun aléa** : chaque décision/mesure est une fonction
déterministe de l'état observé.

## CLI

`npm run sim` (= `vite-node harness/sim.ts --`), pour les alias `@/` et TS.

```
npm run sim                                  # 100 seeds × les deux politiques
npm run sim -- --seeds 500 --policy aggressive
npm run sim -- --start 1000 --seeds 50 --out reports
```

Sortie : résumé console + JSON (résumés/records) + CSV (une ligne par run),
horodatés dans le dossier de rapports.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `harness/sim.ts` | Point d'entrée CLI (parse args, écrit les rapports) |
| `harness/pilot.ts` | `runHeadless` : joue une run complète via `stepRun` (`FIXED_DT_MS`) |
| `harness/policies.ts` | `createPolicyAgent` : agents scriptés, pendant headless de `input/capture`. Lit `RunState` → émet `PlayerIntent`, ne mute jamais l'état |
| `harness/pathfind.ts` | Navigation locale à la salle (grille gonflée du rayon joueur, BFS, lissage) |
| `harness/telemetry.ts` | `observeRun` : observateur lecture seule, dérive les compteurs par diff d'inventaire entre ticks |
| `harness/campaign.ts` | N seeds × M politiques, une mesure (`RunRecord`) par run |
| `harness/report.ts` | Agrégation par politique + export CSV/console (pur, pas d'E/S) |

## Checklist — étendre le harnais

1. **Nouvelle politique d'agent** : ajouter un `PolicyProfile` dans
   `harness/policies.ts`, en restant déterministe (fonction de l'état observé) et
   en n'émettant que des `PlayerIntent`. Ne jamais muter `RunState`.
2. **Nouvelle mesure** : étendre `RunRecord` + `observeRun` (`harness/telemetry.ts`)
   en lecture seule, puis l'agrégation dans `harness/report.ts`.
3. Garder le harnais isolé du gameplay : si une mesure exige d'instrumenter un
   système, c'est une mauvaise piste — dérive-la par observation d'état.
4. Tests : `harness/*.test.ts` (déterminisme du pilote, des politiques, de la
   campagne, de la télémétrie et des rapports).
