#!/usr/bin/env bash
# ==============================================================================
# iSkill Production Deployment Script
# Usage: ./deploy.sh
# ==============================================================================
set -euo pipefail

PROJECT="iskill"
WEB_DOMAIN="iskill.softrateglobal.com"
API_DOMAIN="api.iskill.softrateglobal.com"

echo "=================================================================="
echo "🚀 Starting production deployment for project: ${PROJECT}"
echo "   Frontend: https://${WEB_DOMAIN}"
echo "   API:      https://${API_DOMAIN}"
echo "=================================================================="

# Check if edge network exists
if ! docker network ls | grep -q ' edge '; then
  echo "⚠️ 'edge' docker network not found. Creating edge network..."
  docker network create edge
fi

# Pull latest base images and build containers
echo "📦 Building & starting containers..."
docker compose build --pull

# Deploy containers
docker compose up -d --remove-orphans

# Health verification
echo "🔍 Verifying API health check..."
MAX_RETRIES=12
COUNT=0
HEALTH_URL="http://127.0.0.1:4500/api/health"

until [ "$COUNT" -ge "$MAX_RETRIES" ]; do
  if docker exec "iskill-prod-api" wget -qO- "$HEALTH_URL" | grep -q '"status":"healthy"'; then
    echo "✅ API is healthy!"
    break
  fi
  COUNT=$((COUNT + 1))
  echo "⏳ Waiting for API to become healthy... ($COUNT/$MAX_RETRIES)"
  sleep 3
done

if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
  echo "❌ API failed health check. Inspecting logs:"
  docker logs "iskill-prod-api" --tail 50
  exit 1
fi

echo "🧹 Cleaning unused dangling docker images..."
docker image prune -f >/dev/null 2>&1 || true

echo "=================================================================="
echo "🎉 Production deployment completed successfully for ${PROJECT}!"
echo "   Frontend: https://${WEB_DOMAIN}"
echo "   API:      https://${API_DOMAIN}"
echo "=================================================================="
