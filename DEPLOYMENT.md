# 9Router on Railway

Independent Railway wrapper for [official 9Router](https://github.com/decolua/9router), pinned at ce4460ef79382bfddb4aa5fc0ff9f3cb0d5f95a8 (0.5.99). Upstream MIT license and notices are retained. This is not an official upstream release.

## Deployment

One service, one persistent /app/data volume, HTTP port 20128, HOSTNAME=0.0.0.0, DATA_DIR=/app/data, NODE_ENV=production, start node custom-server.js, healthcheck /api/health, ALWAYS restart. BASE_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}, AUTH_COOKIE_SECURE=true. Keep cloud sync, tunnels and payload logging disabled.

The template uses INITIAL_PASSWORD=123456. Open the generated URL, sign in with 123456, then choose a new password before entering the dashboard. The new password must have at least 8 characters and at most 72 UTF-8 bytes; it is stored as a bcrypt hash on the persistent volume. Complete first-run setup immediately: the default password is public, so the first person to reach an unconfigured instance can claim it. Add provider credentials only after setup.

JWT_SECRET, API_KEY_SECRET and MACHINE_ID_SALT remain unique generated internal secrets. They are not the user-facing dashboard password. After setup, 123456 stops working; normal password changes remain in upstream Settings.

## Limited compatibility changes

- Remove upstream's optional npm cache mount, which Railway's builder rejects.
- Enable the requested first-run password-change UI remotely. Official 0.5.95/0.5.99 currently reject remote default-password login with 403; setting INITIAL_PASSWORD alone bypasses the change prompt. The wrapper instead issues a separate short-lived setup cookie and sends the existing change-password screen to a narrow setup endpoint. It issues a dashboard session only after the new password is saved. Setup tokens use a separate signing key, cannot access ordinary settings, require same-origin POST, expire after ten minutes, and cannot replace an already-set password. SQLite transaction protects concurrent setup.

The patch asserts the expected pinned source and fails the build if it changes. Upstream auth status and ordinary login UI are otherwise preserved; the earlier bootstrap-password status-display patch was removed.

## Usage and maintenance

Generate a gateway API key in Endpoint & Key, connect an authorized provider in Providers, then configure clients with https://YOUR-DOMAIN/v1. Provider pricing, terms and quotas apply. No free or unlimited access guarantee. No external DB, Redis or GPU needed. Headroom is optional and not included. Local desktop import/MITM/host changes are outside remote Railway scope.

Back up the whole volume securely: it contains provider credentials, keys and settings. Use one replica. Review source upgrades; upstream dependency ranges are not fully locked. The orange icon is the official commit-pinned public/favicon.svg.

## Validation

The earlier generated-password configuration passed source/clean deployment inference, SSE and restart tests. Those results do not certify this new default-password setup. Local security tests cover default login, limited token scope, missing/forged tokens, cross-origin requests, password validation, concurrent setup, replay and post-setup login. The owner will manually deploy the updated template and verify its real first-run workflow. No additional template test project is created by the agent.

