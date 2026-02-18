#!/bin/bash

PORT=3000
DEV_MODE=false

for i in "$@"; do
  case $i in
    --dev)
      DEV_MODE=true
      shift
      ;;
    -h|--help)
      echo "Usage: start.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --dev               Enable development mode"
      echo "  -h, --help          Show this help message"
      exit 0
      ;;
    *)
      # unknown option
      ;;
  esac
done

# Prioritize VITE_BACKEND_URL, fallback to BACKEND_URL, finally use default
if [ -z "$VITE_BACKEND_URL" ]; then
  if [ -n "$BACKEND_URL" ]; then
    export VITE_BACKEND_URL=$BACKEND_URL
  else
    export VITE_BACKEND_URL="http://gw-data-room-service:8000"
  fi
fi

if $DEV_MODE; then
  echo "DEV MODE"
  echo "Backend URL: $VITE_BACKEND_URL"
  npm run dev -- --host 0.0.0.0 --port $PORT
else
  echo "LIVE MODE"
  echo "Backend URL: $VITE_BACKEND_URL"
  npm install --production=false
  # Note: For production, we build and then start the server
  npm run build
  npm run start
fi
