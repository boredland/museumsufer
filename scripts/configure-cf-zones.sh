#!/usr/bin/env bash
# Apply per-zone Cloudflare settings across every app domain in the
# monorepo. Wrangler doesn't expose zone settings (it's scoped to
# Workers) so this drives the Cloudflare REST API directly.
#
# Usage:
#   CF_API_TOKEN=... ./scripts/configure-cf-zones.sh
#   CF_API_TOKEN=... ./scripts/configure-cf-zones.sh --dry-run
#
# Required token scopes (create at
#   https://dash.cloudflare.com/profile/api-tokens):
#   - Zone:Zone:Read           (to list zones)
#   - Zone:Zone Settings:Edit  (always_use_https + AI bot toggle)
#
# What it sets per zone:
#   1. SSL/TLS -> Edge Certificates -> Always Use HTTPS = on
#      Maps to `always_use_https` zone setting. Stable, documented.
#   2. Security -> Bots -> AI Audit "Managed robots.txt" block
#      Dashboard-only on Free tier (no public API path). The script
#      prints the per-zone dashboard URL so you can flip it by hand.

set -euo pipefail

if [[ -z "${CF_API_TOKEN:-}" ]]; then
  echo "error: CF_API_TOKEN env var required" >&2
  exit 2
fi

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  echo "[dry-run] no PATCH requests will be sent"
fi

API="https://api.cloudflare.com/client/v4"

# The apex domains that back the six apps. Each is a separate zone
# in the user's Cloudflare account. Keep in sync with each app's
# wrangler.jsonc `routes[].pattern`.
ZONES=(
  "museumsufer.app"
  "ins.museum"
  "frankfurt.ins.theater"
  "frankfurt.konzert.haus"
  "landau.today"
  "frankfurt.lehr.salon"
  "frankfurt.lichtspiel.haus"
)

# A few of the apex domains above are actually subdomain routes on a
# parent zone (e.g. frankfurt.lichtspiel.haus -> zone lichtspiel.haus).
# The script discovers the actual zone for each by stripping leading
# labels until /zones?name= returns a hit.
resolve_zone() {
  local host="$1"
  while [[ "$host" == *.* ]]; do
    local id
    id=$(curl -fsS -H "Authorization: Bearer $CF_API_TOKEN" \
      "$API/zones?name=$host&status=active" \
      | jq -r '.result[0].id // empty')
    if [[ -n "$id" ]]; then
      echo "$id|$host"
      return 0
    fi
    host="${host#*.}"
  done
  return 1
}

# Returns the literal string "on" or "off" (or "error").
get_setting() {
  local zone_id="$1" setting="$2"
  curl -fsS -H "Authorization: Bearer $CF_API_TOKEN" \
    "$API/zones/$zone_id/settings/$setting" 2>/dev/null \
    | jq -r '.result.value // "error"'
}

patch_setting() {
  local zone_id="$1" setting="$2" value="$3"
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "    [dry-run] PATCH /zones/$zone_id/settings/$setting <- $value"
    return 0
  fi
  local resp
  resp=$(curl -fsS -X PATCH \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{\"value\":\"$value\"}" \
    "$API/zones/$zone_id/settings/$setting" 2>&1) || {
    echo "    error: PATCH failed: $resp"
    return 1
  }
  local success
  success=$(echo "$resp" | jq -r '.success // false')
  [[ "$success" == "true" ]]
}

apply_always_use_https() {
  local zone_id="$1" zone_name="$2"
  local current
  current=$(get_setting "$zone_id" "always_use_https")
  if [[ "$current" == "on" ]]; then
    echo "    always_use_https: already on"
    return 0
  fi
  echo "    always_use_https: $current -> on"
  patch_setting "$zone_id" "always_use_https" "on" \
    && echo "    always_use_https: ok" \
    || echo "    always_use_https: FAILED (check token scope: Zone Settings:Edit)"
}

# Cloudflare's AI-Audit "Managed robots.txt" toggle (the thing that
# prepends GPTBot/ClaudeBot/Google-Extended Disallow rules to every
# robots.txt response) is dashboard-only on Free tier zones. Every
# REST surface I tried returns 70001 not_found or 1003 undefined
# setting: /zones/<id>/ai-audit, /zones/<id>/ai-audit/settings,
# /zones/<id>/settings/{ai_bots_block,block_ai_bots,block_ai_scrapers}.
# So just print the dashboard URL for each zone. If Cloudflare publishes
# a stable API later, replace this stub with a real PATCH.
print_ai_audit_hint() {
  local zone_name="$1"
  echo "    ai-audit: no public API on Free tier"
  echo "      -> https://dash.cloudflare.com/?to=/:account/$zone_name/security/bots"
}

# Verify token has the needed scopes by listing zones once.
echo "Verifying token..."
zones_count=$(curl -fsS -H "Authorization: Bearer $CF_API_TOKEN" \
  "$API/zones?per_page=1" | jq -r '.result_info.total_count // 0')
echo "Token sees $zones_count zone(s) in the account."
echo

declare -A SEEN_ZONES
for host in "${ZONES[@]}"; do
  echo "== $host =="
  pair=$(resolve_zone "$host") || { echo "    not found in account"; continue; }
  zone_id="${pair%|*}"
  zone_name="${pair#*|}"
  if [[ -n "${SEEN_ZONES[$zone_id]:-}" ]]; then
    echo "    same zone as $zone_name (already configured)"
    continue
  fi
  SEEN_ZONES[$zone_id]=1
  echo "    zone: $zone_name ($zone_id)"
  apply_always_use_https "$zone_id" "$zone_name"
  print_ai_audit_hint "$zone_name"
done

echo
echo "Done. Re-run with --dry-run to see what would change without applying."
