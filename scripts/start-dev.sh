#!/usr/bin/env bash
set -e

# Trap CTRL+C (SIGINT) to kill all background processes cleanly
trap 'echo -e "\nShutting down all services..."; kill $(jobs -p) 2>/dev/null; wait; echo "All services stopped."; exit 0' SIGINT SIGTERM

# Colors for prefixes
C1='\033[0;36m' # Cyan
C2='\033[0;35m' # Purple
C3='\033[0;34m' # Blue
C4='\033[0;32m' # Green
C5='\033[0;33m' # Yellow
C6='\033[1;36m' # Light Cyan
C7='\033[1;35m' # Light Purple
C8='\033[1;34m' # Light Blue
C9='\033[1;32m' # Light Green
C10='\033[0;31m' # Red
NC='\033[0m'    # No Color

echo "==> Starting all LittleFounders services..."
echo "Press Ctrl+C to stop all services."

# Function to run a service in the background and prefix its output
start_service() {
  local service_dir=$1
  local prefix_color=$2
  local prefix_name=$3

  # Use awk to prefix each line of stdout and stderr
  (cd "$service_dir" && npm run dev 2>&1 | awk -v color="$prefix_color" -v name="[$prefix_name]" -v reset="$NC" '{print color name reset " " $0; fflush()}') &
}

# Ensure Supabase containers are running
echo "Checking database status..."
(cd database && npm run db:status >/dev/null 2>&1 || npm run db:up)

# Start all services
start_service "backend" "$C1" "BACKEND"
start_service "frontend" "$C2" "FRONTEND"
start_service "coursegen" "$C3" "COURSEGEN"
start_service "audiogen" "$C4" "AUDIOGEN"
start_service "parent-id-check" "$C6" "GUARDIAN"
start_service "email-server" "$C7" "EMAIL"
start_service "filebase" "$C8" "DEPOT"
start_service "picturegen" "$C9" "PRISM"
start_service "dataintel" "$C10" "DATAINTEL"

# Wait for all background jobs to finish (they won't unless they crash or user presses Ctrl+C)
wait
