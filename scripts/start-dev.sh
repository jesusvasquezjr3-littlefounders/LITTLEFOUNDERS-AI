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

DEV_PROFILE=${DEV_PROFILE:-frontend}
DEV_DB=${DEV_DB:-0}

case "$DEV_PROFILE" in
  frontend)
    SERVICES=("frontend")
    ;;
  core)
    SERVICES=("backend" "frontend")
    ;;
  all)
    SERVICES=("backend" "frontend" "coursegen" "audiogen" "parent-id-check" "email-server" "filebase" "picturegen" "dataintel" "oracle")
    ;;
  *)
    echo "Unknown DEV_PROFILE '$DEV_PROFILE'. Use frontend, core, or all." >&2
    exit 1
    ;;
esac

echo "==> Starting LittleFounders development profile: $DEV_PROFILE"
echo "    Services: ${SERVICES[*]}"
if [ "$DEV_DB" = "1" ]; then
  echo "    Database: enabled"
else
  echo "    Database: skipped (set DEV_DB=1 to enable it)"
fi
echo "Press Ctrl+C to stop the running services."

# Function to run a service in the background and prefix its output
start_service() {
  local service_dir=$1
  local prefix_color=$2
  local prefix_name=$3

  # Use awk to prefix each line of stdout and stderr
  (cd "$service_dir" && npm run dev 2>&1 | awk -v color="$prefix_color" -v name="[$prefix_name]" -v reset="$NC" '{print color name reset " " $0; fflush()}') &
}

# The full Supabase stack and nine watch processes are intentionally opt-in.
# They can consume several gigabytes on a laptop before the browser even opens.
if [ "$DEV_DB" = "1" ]; then
  echo "Checking database status..."
  (cd database && npm run db:status >/dev/null 2>&1 || npm run db:up)
else
  echo "Skipping database startup."
fi

# Start only the selected profile.
for service in "${SERVICES[@]}"; do
  case "$service" in
    backend) start_service "$service" "$C1" "BACKEND" ;;
    frontend) start_service "$service" "$C2" "FRONTEND" ;;
    coursegen) start_service "$service" "$C3" "COURSEGEN" ;;
    audiogen) start_service "$service" "$C4" "AUDIOGEN" ;;
    parent-id-check) start_service "$service" "$C6" "GUARDIAN" ;;
    email-server) start_service "$service" "$C7" "EMAIL" ;;
    filebase) start_service "$service" "$C8" "DEPOT" ;;
    picturegen) start_service "$service" "$C9" "PRISM" ;;
    dataintel) start_service "$service" "$C10" "DATAINTEL" ;;
    oracle) start_service "$service" "$C5" "ORACLE" ;;
  esac
done

# Wait for all background jobs to finish (they won't unless they crash or user presses Ctrl+C)
wait
