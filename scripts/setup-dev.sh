#!/usr/bin/env bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}==> LittleFounders v2 - Local Dev Setup${NC}"

# Every top-level npm package in the repo (pulse/ is a pinned third-party
# stack, not an npm package). agent/tools/repo-consistency.test.mjs pins this
# list against the directories that actually carry a package.json.
SERVICES=(
  "backend"
  "frontend"
  "database"
  "filebase"
  "coursegen"
  "audiogen"
  "picturegen"
  "parent-id-check"
  "email-server"
  "dataintel"
)

# 1. Install dependencies and setup .env files
for svc in "${SERVICES[@]}"; do
  echo -e "\n${YELLOW}--> Setting up $svc...${NC}"
  cd "$svc"
  
  if [ -f "package.json" ]; then
    npm install
  fi
  
  if [ -f ".env.example" ] && [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${GREEN}    Created .env from .env.example${NC}"
  fi
  
  cd ..
done

# 2. Database setup sequence
echo -e "\n${YELLOW}--> Provisioning local database...${NC}"
cd database
echo "  [1/4] Starting stack, applying migrations, and running dev_seed..."
npm run db:reset

echo "  [2/4] Creating test users and linking families..."
npm run db:seed:users

echo "  [3/4] Importing QA smoketest fixture..."
npm run db:import-course -- seeds/first-lemonade-stand-fixture.sql

echo "  [4/4] Publishing QA smoketest fixture..."
npm run db:publish-course -- first-lemonade-stand
cd ..

echo -e "\n${GREEN}==> Setup Complete! Run 'npm run dev' for the lightweight frontend profile.${NC}"
echo -e "    Use DEV_PROFILE=core DEV_DB=1 npm run dev for frontend + API, or DEV_PROFILE=all DEV_DB=1 npm run dev for every service."
