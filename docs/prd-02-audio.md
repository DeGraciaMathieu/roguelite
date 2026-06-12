# PRD 02 — Audio

**Priorité : 2 — Impact ★★★ — Effort moyen**

## Objectif

L'ambiance sonore est le levier d'horreur le moins cher du genre : entendre
un raptor **hors écran** avant de le voir, c'est exactement la tension Dino
Crisis que vise le projet. Le dossier `audio/` est vide depuis l'étape 1.

## Existant technique

- Stack imposée : **Web Audio API**, wrapper dans `audio/` (architecture
  CLAUDE.md). Aucun asset : sons en **synthèse** (oscillateurs + bruit +
  enveloppes), cohérent avec la règle « placeholders propres ».
- Règle non négociable : aucune logique métier dans l'audio — il *réagit*
  à l'état/aux événements, il ne décide de rien. La simulation doit
  continuer de tourner sans audio (tests).

## Comportement

**Palette v1 (8 sons, synthèse) :**

| Son | Déclencheur |
|-----|-------------|
| Tir handgun | projectile spawné (handgun) |
| Tir shotgun | projectile spawné (pellets > 1) |
| Recharge | début de recharge |
| Clic à vide | tir refusé chargeur + réserve vides |
| Morsure | dégât subi par le joueur |
| Mort d'ennemi | ennemi retiré de l'état |
| Ramassage | loot crédité (medkit ou munitions) |
| Porte | transition de salle |

**Spatialisation minimale** : volume/panoramique des sons ennemis selon la
distance et la position relative au joueur — c'est ce qui crée le « ils
arrivent par la gauche ». Grognement périodique des ennemis en `chase`.

**Architecture événementielle** : les systèmes n'appellent jamais l'audio.
La composition root (`main.ts`) compare l'état avant/après tick ou consomme
une file d'événements de simulation (à trancher au plan : la file
d'événements est plus propre et servira aussi au game feel, PRD 04).

## Hors-scope

- Musique / nappes d'ambiance (v2).
- Assets audio externes (on reste en synthèse).
- Réglages de volume dans un menu (v2 ; constante globale suffira).

## Impacts par couche

- `audio/engine.ts` : wrapper Web Audio (AudioContext, déverrouillage au
  premier input — contrainte navigateur), synthés par type de son.
- `audio/` ne dépend que du domaine (lecture) ; jamais l'inverse.
- `main.ts` : câblage événements → sons.
- Éventuel `core/events.ts` si la file d'événements est retenue (elle
  profite au PRD 04) — à valider au moment du plan.

## Critères d'acceptation

- Le jeu reste 100 % fonctionnel audio coupé/indisponible (tests inchangés).
- Aucun son ne se déclenche au hub / game over (hors clic UI éventuel).
- Un raptor en chasse hors champ est audible et latéralisé correctement.
- Pas de saturation : tirs en rafale ≠ clipping (limiteur ou polyphonie max).

## Tests

- La simulation n'importe rien d'`audio/` (test d'architecture simple ou
  revue : `domain/`, `systems/`, `core/loop` sans dépendance audio).
- Si file d'événements : tests purs sur sa production (tir → événement,
  mort → événement, purgée chaque tick).

## Risques / questions ouvertes

- Autoplay policy : l'AudioContext doit être créé/repris sur le premier
  geste utilisateur (le clic « DESCENDRE » du hub est idéal).
- La synthèse « qui sonne bien » demande de l'itération oreille — prévoir
  des constantes de réglage groupées dans `data/` ou `audio/presets.ts`.
