# Cloudflare: Pages for the client, R2 for the saved sessions

Step by step in [docs/deploy.md](../../docs/deploy.md#static-hosting-cloudflare-pages-and-r2).

- `r2-cors.json`: the bucket's CORS rule. Replace `https://app.example.com` with the app's origin.
- `../static/_headers` and `../static/_redirects`: copied into `client/dist` before the upload.
- `../scripts/upload-data.sh`: uploads `DATA_DIR/out` to the bucket with the right headers.
