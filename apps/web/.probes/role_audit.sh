#!/usr/bin/env bash
# Per-role audit: bilingual fit at 1440 and 390, dialog sweep at 390, on the
# routes each role's sidebar offers (.probes/routes-<role>.txt from
# role_routes.mjs). Writes .probes/role-audit-<role>.txt.
set -u
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1
for role in ${ROLES:-existing_founder mentor angel_investor service_provider incubator_admin}; do
  out=".probes/role-audit-$role.txt"
  {
    echo "### $role"
    ROLE=$role node .probes/bilingual_fit.mjs ".probes/routes-$role.txt" 1440 2>&1 | grep -E '\||TOTAL'
    ROLE=$role node .probes/bilingual_fit.mjs ".probes/routes-$role.txt" 390 2>&1 | grep -E '\||TOTAL'
    ROLE=$role DETAIL=1 node .probes/dialog_sweep.mjs ".probes/routes-$role.txt" 390 2>&1 | grep -E '✗|^    |SUMMARY|no name'
  } > "$out"
  cat "$out"
done
