#!/usr/bin/env bash
# Hook Stop : empêche de terminer avec des tests cassés.
# Lance la suite Vitest en mode silencieux ; en cas d'échec, renvoie un
# `decision: block` avec la sortie des tests pour que l'agent corrige.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# Lire l'input JSON du hook ; éviter la boucle si on est déjà dans un Stop hook.
input="$(cat)"
if printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

# Charger Node via nvm si npm n'est pas déjà dans le PATH (shell non interactif).
if ! command -v npm >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
  [ -f .nvmrc ] && nvm use >/dev/null 2>&1
fi

if ! command -v npm >/dev/null 2>&1; then
  # Pas de runtime : ne pas bloquer le travail de l'agent.
  exit 0
fi

# Tests en mode "dot" (silencieux), timeout pour éviter de bloquer la session.
output="$(npm run test --silent -- --reporter=dot 2>&1)"
status=$?

if [ $status -ne 0 ]; then
  reason="Les tests échouent — corrige avant de terminer.\n\n$output"
  # Échapper pour un JSON valide (newlines + guillemets).
  reason_json="$(printf '%s' "$reason" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null)"
  if [ -z "$reason_json" ]; then
    reason_json="\"Les tests échouent. Relance npm run test pour le détail.\""
  fi
  printf '{"decision":"block","reason":%s}\n' "$reason_json"
  exit 0
fi

exit 0
