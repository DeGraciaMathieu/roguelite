/**
 * Intentions du joueur : ce qu'il *veut* faire, pas ce qui se produit.
 * Les systèmes décident des effets ; la couche input ne touche jamais au domaine.
 */

import type { Vec2 } from '@/domain';

export interface PlayerIntent {
  /** Direction de déplacement souhaitée, normalisée (longueur ≤ 1). */
  move: Vec2;
  /** Point visé en coordonnées monde (la conversion écran→monde est injectée au câblage). */
  aimWorld: Vec2;
  /** Tir demandé (bouton gauche maintenu). */
  fire: boolean;
  /** Recharge demandée (touche R). */
  reload: boolean;
  /** Utiliser un consommable (touche H, front montant : un appui = un usage). */
  useConsumable: boolean;
  /** Dash (Espace, front montant : un appui = une poussée). */
  dash: boolean;
}
