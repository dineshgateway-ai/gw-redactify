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

if $DEV_MODE; then
  echo "DEV MODE"
  npm run dev -- --host 0.0.0.0 --port $PORT
else
  echo "LIVE MODE"
  # Note: For production, we build and then start the server
  npm run build
  npm run start
fi
