# ManagerOrder Deployment on a DigitalOcean VPS

This repository can be deployed safely on a single Linux VPS together with other projects, but it should not be the public edge by itself. Use a shared reverse proxy on the host, give each project its own internal port, and keep only `80/443` open to the Internet.

## Recommended topology

- One Ubuntu VPS on DigitalOcean
- One shared host-level reverse proxy: `nginx`
- One Docker Compose stack per project
- One internal localhost port per project
- One domain or subdomain per project
- TLS terminated at `nginx`
- Optional worker containers for polling bots

For this repo specifically:

- `managerorder-web` serves the Next.js app on internal port `3100 -> 8080`
- Telegram polling can run inside the web container when `TELEGRAM_RUNTIME_MODE=polling`
- Zalo polling is not started by the main container and should run as a separate worker when required

## Host hardening baseline

Run these once on the VPS before deploying any project:

1. Create a non-root sudo user and disable password SSH login.
2. Enforce SSH keys only.
3. Change SSH settings in `/etc/ssh/sshd_config`:
   - `PermitRootLogin no`
   - `PasswordAuthentication no`
   - `PubkeyAuthentication yes`
   - `PermitEmptyPasswords no`
4. Enable firewall:
   - allow `22/tcp`
   - allow `80/tcp`
   - allow `443/tcp`
   - deny everything else inbound
5. Install and enable:
   - `fail2ban`
   - `unattended-upgrades`
   - `curl`, `git`, `ca-certificates`
   - `docker`, `docker compose plugin`
   - `nginx`
6. Enable time sync and log rotation.
7. Configure automatic backups or snapshots in DigitalOcean.
8. Store secrets outside git, preferably in `/opt/<project>/env/*.env` with `chmod 600`.

## Directory convention for multiple projects

Use a stable layout so additional projects do not collide:

```text
/opt/
  managerorder/
    app/
    env/
    compose/
  another-project/
    app/
    env/
    compose/
```

Example port allocation:

- `managerorder` -> `127.0.0.1:3100`
- `project-b` -> `127.0.0.1:3200`
- `project-c` -> `127.0.0.1:3300`

Do not publish app containers on `0.0.0.0`. Bind them to `127.0.0.1` and let `nginx` proxy requests.

## Deploy this repository

1. Clone the repo into `/opt/managerorder/app`.
2. Copy [apps/admin-web/.env.local.example](/D:/GITHUB/managerorder/apps/admin-web/.env.local.example) to a production env file on the server, for example:
   - `/opt/managerorder/env/managerorder.env`
3. Fill real values for:
   - `JWT_SECRET`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PREMIUM_PASSWORD_ENCRYPTION_KEY`
   - `CRON_SECRET`
   - `ADMIN_SECRET_KEY`
   - bot tokens if used
4. Set production URLs:
   - `NEXT_PUBLIC_API_URL=https://manager.example.com`
   - `NEXT_PUBLIC_SITE_URL=https://manager.example.com`
5. Deploy with the compose file template in [deploy/docker-compose.managerorder.yml](/D:/GITHUB/managerorder/deploy/docker-compose.managerorder.yml).
6. Install the nginx vhost template in [deploy/nginx/managerorder.conf.example](/D:/GITHUB/managerorder/deploy/nginx/managerorder.conf.example).
7. Issue certificates with Certbot or your preferred ACME client.
8. Verify:
   - `https://manager.example.com/api/health`
   - login flow
   - database connectivity
   - cron authentication routes
   - Telegram or Zalo runtime mode

## Zalo worker

If Zalo polling is required in production, start the optional `managerorder-zalo` service profile from the compose template:

```bash
docker compose --env-file /opt/managerorder/env/managerorder.env -f /opt/managerorder/app/deploy/docker-compose.managerorder.yml --profile zalo up -d --build
```

If Zalo is not needed, do not enable the profile.

## Security checks after go-live

- `docker ps` shows only expected containers
- `ss -tulpn` shows only `22`, `80`, `443` exposed publicly
- `/api/health` returns `200`
- application logs contain no secrets
- `nginx -t` passes
- `ufw status` exposes only the intended ports
- `fail2ban-client status` shows the SSH jail enabled
- `apt update && unattended-upgrade --dry-run` is clean
- DigitalOcean backup/snapshot schedule is active

## Rollback approach

- Keep the previous image tag available locally
- Deploy by immutable image tag, not `latest`
- If the new release fails, switch the compose file back to the previous tag and restart only that project
- Roll back database migrations separately and only when necessary
