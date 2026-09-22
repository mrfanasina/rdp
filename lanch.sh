#!/bin/bash

# =====================================
# - Script de lancement pour linux
# =====================================

APP_DIR="/home/fa/development/RO_M1/"
FRONTEND_DIR="$APP_DIR/rdpcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccszzwwxxxxxxxxxxxww"

GREEN="\e[32m"
RED="\e[31m"
YELLOW="\e[33m"
CYAN="\e[36m"
RESET="\e[0m"

echo -e "${CYAN}Lancement du projet...${RESET}"


# =====================================
# === FRONTEND ===
# =====================================

cd "$FRONTEND_DIR" || { 
  echo -e "${RED}Frontend introuvable${RESET}"
  kill $BACK_PID 2>/dev/null
  exit 1
}


if [ "$BUILD_FRONTEND" = true ]; then
  echo -e "${YELLOW}Build frontend (prod)...${RESET}"
  npm run build
  echo -e "${YELLOW}Frontend prod : http://localhost:3000${RESET}"
  npx serve -s build -l 3000 &
else
  echo -e "${YELLOW}Frontend dev (npm run dev)...${RESET}"
  npm run dev &
fi

FRONT_PID=$!

# =====================================
# === FERMETURE PROPRE ===
# =====================================

trap "echo -e '${RED}Arrêt du projet...${RESET}'; kill $BACK_PID $FRONT_PID 2>/dev/null" EXIT
wait
