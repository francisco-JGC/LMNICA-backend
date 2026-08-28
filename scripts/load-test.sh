#!/usr/bin/env bash
# Load test para el backend de lotería.
#
# Uso:
#   BASE_URL=http://localhost:3000 EMAIL=admin@x.com PASSWORD=xxx ./scripts/load-test.sh
#
# O contra Railway:
#   BASE_URL=https://tu-backend.up.railway.app EMAIL=... PASSWORD=... ./scripts/load-test.sh
#
# Requiere: autocannon (npm i -g autocannon), jq, curl.

set -euo pipefail

: "${BASE_URL:?BASE_URL requerido (ej: http://localhost:3000)}"
: "${EMAIL:?EMAIL requerido para hacer login}"
: "${PASSWORD:?PASSWORD requerido para hacer login}"

# Concurrencia y duración. Ajustalos si querés simular más carga.
CONNECTIONS="${CONNECTIONS:-50}"
DURATION="${DURATION:-30}"

echo "==> Login en $BASE_URL"
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | jq -r '.accessToken // .token // empty')

if [ -z "$TOKEN" ]; then
  echo "ERROR: no se pudo obtener el token. Revisá EMAIL/PASSWORD."
  exit 1
fi
echo "Token OK (${#TOKEN} chars)"

# Rango del día de hoy en Managua para los endpoints con filtro.
TODAY=$(date +%Y-%m-%d)
FROM="${TODAY}T00:00:00-06:00"
TO="${TODAY}T23:59:59-06:00"

run_test() {
  local label="$1"
  local url="$2"
  local auth="$3"

  echo ""
  echo "============================================================"
  echo "  $label"
  echo "  URL: $url"
  echo "  Concurrencia: $CONNECTIONS | Duración: ${DURATION}s"
  echo "============================================================"

  if [ "$auth" = "yes" ]; then
    autocannon -c "$CONNECTIONS" -d "$DURATION" \
      -H "Authorization: Bearer $TOKEN" \
      "$url"
  else
    autocannon -c "$CONNECTIONS" -d "$DURATION" "$url"
  fi
}

# 1) Baseline: liveness sin DB. Mide el techo del stack Nest+Node sin I/O.
run_test "1) /api/health (baseline sin DB)" \
  "$BASE_URL/api/health" \
  "no"

# 2) GET liviano: catálogo de juegos. 1 query, resultset chico.
run_test "2) GET /api/games (liviano, 1 query)" \
  "$BASE_URL/api/games" \
  "yes"

# 3) GET mediano: listado de tickets del día. Múltiples queries, evaluator loop.
run_test "3) GET /api/tickets (mediano, evaluator loop)" \
  "$BASE_URL/api/tickets?from=$FROM&to=$TO" \
  "yes"

# 4) GET pesado: dashboard summary. Query SQL grande + wonKpis loop.
run_test "4) GET /api/dashboard/summary (pesado, agregados)" \
  "$BASE_URL/api/dashboard/summary?from=$FROM&to=$TO" \
  "yes"

echo ""
echo "==> Load test terminado."
echo ""
echo "Cómo leer los números:"
echo "  - Req/Sec avg  → throughput sostenido"
echo "  - Latency p99  → peor caso realista (99% de requests debajo de este valor)"
echo "  - 2xx / non-2xx → si hay non-2xx, el server está devolviendo errores bajo carga"
echo "  - Timeouts     → server no responde a tiempo (típico de pool exhausted)"
