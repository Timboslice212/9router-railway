# 9Router on Railway

This is an independent deployment wrapper for [official 9Router](https://github.com/decolua/9router), pinned at ce4460ef79382bfddb4aa5fc0ff9f3cb0d5f95a8 (0.5.99). It retains the official Dockerfile runtime and removes the optional npm cache mount to support Railway builders. It downloads the pinned upstream archive during build. It is not an official upstream release.

Deploy one service with /app/data persistent volume, port 20128, HOSTNAME=0.0.0.0, DATA_DIR=/app/data, NODE_ENV=production, and healthcheck /api/health. Start node custom-server.js. Generate unique INITIAL_PASSWORD, JWT_SECRET, API_KEY_SECRET and MACHINE_ID_SALT; never use example secrets. AUTH_COOKIE_SECURE=true. BASE_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}. Keep payload logging, cloud sync and tunnels disabled. Back up the entire data volume, which contains sensitive provider credentials.

Sign in with INITIAL_PASSWORD from Railway Variables. Generate a gateway key in Endpoint, configure your authorized provider in Providers, then use https://<your-domain>/v1 in your client. Provider pricing, terms and quotas apply. Local desktop import/MITM/host modifications do not work as remote Railway features. Headroom is optional and not included.

The health endpoint only checks liveness. Verify real inference and streaming before treating a deployment as ready. Source is pinned; review newer upstream commits before upgrades. Upstream npm dependencies are not fully locked. Upstream is MIT licensed; retain its license and notices. This repository claims no upstream endorsement.
