#!/usr/bin/env bash
# Uploads the import's output ($DATA_DIR/out) to an S3-compatible bucket (Cloudflare R2, AWS S3,
# Backblaze B2, MinIO) with the headers a browser needs: a .gz file is sent as gzip, and the
# catalog is never cached. Safe to repeat: only changed files go up. Needs the AWS CLI.
#
#   BUCKET=pitwall-data S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com \
#   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... deploy/scripts/upload-data.sh [--dryrun]
#
# DATA_DIR defaults to ./data. S3_ENDPOINT is left out for AWS S3. Extra arguments go to `aws s3 sync`.
set -euo pipefail

: "${BUCKET:?set BUCKET to the bucket name}"

out="${DATA_DIR:-./data}/out"
[[ -d "$out" ]] || { echo "No $out: run an import first (docs/deploy.md)." >&2; exit 1; }

export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"
endpoint=()
[[ -n "${S3_ENDPOINT:-}" ]] && endpoint=(--endpoint-url "$S3_ENDPOINT")

# The same values server/src/http/static-data.ts sends in development.
revalidate='public, max-age=300, must-revalidate'

sync() { # sync <include pattern> <more aws options...>
	local pattern="$1"
	shift
	aws s3 sync "$out" "s3://$BUCKET/" "${endpoint[@]}" --exclude '*' --include "$pattern" \
		--cache-control "$revalidate" "$@" "${EXTRA[@]}"
}

EXTRA=("$@")

sync '*.json.gz' --content-encoding gzip --content-type 'application/json; charset=utf-8'
sync '*.jsonl.gz' --content-encoding gzip --content-type 'application/x-ndjson; charset=utf-8'
sync '*.ndjson.gz' --content-encoding gzip --content-type 'application/x-ndjson; charset=utf-8'
# Folder indexes such as telemetry/<key>/index.json.
sync '*/index.json' --content-type 'application/json; charset=utf-8'

# Last, so the catalog never lists a session whose files are not there yet.
aws s3 cp "$out/catalog.json" "s3://$BUCKET/catalog.json" "${endpoint[@]}" \
	--cache-control 'no-cache' --content-type 'application/json; charset=utf-8' "${EXTRA[@]}"
