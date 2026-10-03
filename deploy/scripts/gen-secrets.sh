#!/usr/bin/env bash
# Prints the secrets you generate yourself, one per line, ready to paste into a host's secret
# store. Nothing is saved. The rest (SMTP, Stripe, Google/Apple, F1TV_TOKEN) come from those services.
set -euo pipefail

echo "RELAY_SECRET=$(openssl rand -hex 24)"
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)"
