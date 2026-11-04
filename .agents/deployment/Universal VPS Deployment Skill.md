# Universal VPS Deployment Skill

Reusable runbook for shipping any project to a single VPS: Docker, one shared Nginx gateway, Let's Encrypt, self-hosted MongoDB, GitHub Actions, and separate prod and dev environments with encrypted env files kept in the project root.

## 1. Placeholders

Replace these everywhere. Nothing else in this guide is project specific.

| Placeholder | Example | Meaning |
| :-- | :-- | :-- |
| `DOMAIN` | `example.com` | Registered domain |
| `PROJECT` | `acme` | Short lowercase slug used in container, DB and folder names |
| `SERVICE` | `web` or `api` | Which repo is being deployed |
| `ENV_NAME` | `prod` or `dev` | Target environment |
| `VPS_IP` | `203.0.113.10` | Public IP of the server |

## 2. Environment Model

|  | Prod | Dev |
| :-- | :-- | :-- |
| Git branch | `main` | `dev` |
| Frontend | `DOMAIN`, `www.DOMAIN` | `dev.DOMAIN` |
| API and WebSockets | `api.DOMAIN` | `dev.api.DOMAIN` |
| Containers | `PROJECT-prod-web`, `PROJECT-prod-api` | `PROJECT-dev-web`, `PROJECT-dev-api` |
| MongoDB database | `PROJECT_prod` | `PROJECT_dev` |
| MongoDB app user | `PROJECT_prod_app` | `PROJECT_dev_app` |
| Encrypted env file (repo root) | `.env.prod.gpg` | `.env.dev.gpg` |
| GitHub Environment | `production` | `development` |
| Server folder | `/opt/apps/PROJECT/prod/SERVICE` | `/opt/apps/PROJECT/dev/SERVICE` |

Design rules:

- One shared gateway (Nginx) owns ports 80 and 443. App containers publish no host ports. The gateway reaches them by container name over a private Docker network called `edge`. Prod and dev can use the same internal port (for example 4001) because they are different containers, so ports never collide across projects.
- MongoDB lives on a second private network called `data` and publishes no port.
- Dev and prod never share secrets, DB users, JWT keys or third-party keys (use test keys such as Razorpay `rzp_test_` in dev).

## 3. Architecture

```
                    Internet (80/443)
                           |
                  [ gateway : nginx ]  <- Let's Encrypt certs
                           |  network: edge
   +-----------+-----------+-----------+-----------+
   |           |           |           |           |
 PROJECT-    PROJECT-    PROJECT-    PROJECT-     (more projects)
 prod-web    prod-api    dev-web     dev-api
 DOMAIN      api.DOMAIN  dev.DOMAIN  dev.api.DOMAIN
               |                       |
               +-----------+-----------+
                           |  network: data
                      [ mongo ]  PROJECT_prod / PROJECT_dev
```

## 4. DNS Records

| Type | Host | Value |
| :-- | :-- | :-- |
| A | `@` | `VPS_IP` |
| CNAME | `www` | `DOMAIN.` |
| A | `api` | `VPS_IP` |
| A | `dev` | `VPS_IP` |
| A | `dev.api` | `VPS_IP` |

Notes: `dev.api` needs its own record because a wildcard `*.DOMAIN` covers only one label. Add matching AAAA records if the server has IPv6. An optional `CAA` record (`0 issue "letsencrypt.org"`) limits who can issue certificates.

## 5. One-Time Server Bootstrap

Run once on a fresh Ubuntu LTS VPS, as root.

```bash
apt-get update && apt-get install -y fail2ban unattended-upgrades gnupg curl gettext-base
curl -fsSL https://get.docker.com | sh

# non-root deploy user (CI logs in as this user, with an SSH key)
adduser --disabled-password --gecos '' deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
# in /etc/ssh/sshd_config set: PasswordAuthentication no, PermitRootLogin no, then: systemctl reload ssh

# firewall
ufw default deny incoming && ufw default allow outgoing
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable

# shared networks and folders
docker network create edge
docker network create data
mkdir -p /opt/infra/{nginx/conf.d,nginx/snippets,nginx/templates,bin} /opt/apps /opt/backups
chown -R deploy:deploy /opt/apps
```

Important: Docker-published ports bypass `ufw`, so publish only 80 and 443 (the gateway). Never publish 27017. Membership of the `docker` group is root-equivalent, so protect the deploy key accordingly.

## 6. Infra Stack (`/opt/infra`)

`/opt/infra/.env` (chmod 600):

```env
MONGO_ROOT_USER=root_admin
MONGO_ROOT_PASSWORD=<openssl rand -hex 24>
LE_EMAIL=ops@DOMAIN
```

`/opt/infra/docker-compose.yml`:

```yaml
services:
  gateway:
    image: nginx:stable-alpine
    container_name: gateway
    restart: unless-stopped
    ports: ['80:80', '443:443']
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/snippets:/etc/nginx/snippets:ro
      - certbot-www:/var/www/certbot:ro
      - letsencrypt:/etc/letsencrypt:ro
    networks: [edge]

  certbot:
    image: certbot/certbot
    profiles: ['tools']
    entrypoint: ['certbot']
    volumes:
      - certbot-www:/var/www/certbot
      - letsencrypt:/etc/letsencrypt

  mongo:
    image: mongo:8.0            # pin a supported major, never :latest
    container_name: mongo
    restart: unless-stopped
    command: ['mongod', '--auth', '--bind_ip_all', '--wiredTigerCacheSizeGB', '1']
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
    volumes: ['mongo-data:/data/db']
    healthcheck:
      test: ['CMD', 'mongosh', '--quiet', '--eval', 'db.adminCommand({ping:1})']
      interval: 15s
      timeout: 5s
      retries: 5
    logging: {driver: json-file, options: {max-size: 10m, max-file: '3'}}
    networks: [data]

volumes:
  certbot-www:
  letsencrypt:
  mongo-data:
networks:
  edge: {external: true}
  data: {external: true}
```

Start it with `cd /opt/infra && docker compose up -d gateway mongo`. `--bind_ip_all` is safe here only because the container sits on the private `data` network with no published port. Tune `--wiredTigerCacheSizeGB` to the VPS RAM (roughly 40 percent of what Mongo may use).

## 7. Nginx Gateway

The gateway config is generated per project and environment from templates, so adding a project never means hand-editing a giant file.

### 7.1 Shared files

`nginx/conf.d/00-common.conf`:

```nginx
map $http_upgrade $connection_upgrade { default upgrade; '' close; }
resolver 127.0.0.11 valid=10s ipv6=off;   # Docker DNS, so a stopped container never blocks nginx startup
server_tokens off;

server {                                    # unknown hostnames get nothing
  listen 80 default_server;
  listen 443 ssl default_server;
  ssl_reject_handshake on;
  return 444;
}
```

`nginx/snippets/proxy-common.conf`:

```nginx
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```

`nginx/snippets/ssl-common.conf`:

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;
add_header Strict-Transport-Security 'max-age=31536000' always;
```

### 7.2 Templates (`nginx/templates/`)

`http.tpl` (used first, so the certificate challenge works before any cert exists):

```nginx
server {
  listen 80;
  listen [::]:80;
  server_name ${ALL_NAMES};
  location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; default_type text/plain; }
  location / { default_type text/plain; return 200 'gateway ok'; }
}
```

`full.tpl`:

```nginx
server {
  listen 80;
  listen [::]:80;
  server_name ${ALL_NAMES};
  location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; default_type text/plain; }
  location / { return 301 https://$host$request_uri; }
}

server {                                   # frontend
  listen 443 ssl;
  listen [::]:443 ssl;
  http2 on;
  server_name ${WEB_NAMES};
  ssl_certificate     /etc/letsencrypt/live/${CERT_NAME}/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/${CERT_NAME}/privkey.pem;
  include /etc/nginx/snippets/ssl-common.conf;
  ${WEB_EXTRA}
  location / {
    set $up http://${WEB_UP};
    proxy_pass $up;
    include /etc/nginx/snippets/proxy-common.conf;
  }
}

server {                                   # API + WebSockets
  listen 443 ssl;
  listen [::]:443 ssl;
  http2 on;
  server_name ${API_NAME};
  ssl_certificate     /etc/letsencrypt/live/${CERT_NAME}/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/${CERT_NAME}/privkey.pem;
  include /etc/nginx/snippets/ssl-common.conf;
  client_max_body_size 200M;
  location / {
    set $up http://${API_UP};
    proxy_pass $up;
    include /etc/nginx/snippets/proxy-common.conf;
  }
}
```

### 7.3 `bin/add-site.sh`

Usage: `LE_EMAIL=ops@DOMAIN /opt/infra/bin/add-site.sh PROJECT prod DOMAIN` (then again with `dev`). It writes an HTTP-only config, issues one certificate per environment, then switches to the full HTTPS config. Use `--staging` on the certbot line while testing to avoid Let's Encrypt rate limits.

```bash
#!/usr/bin/env bash
set -euo pipefail
P="$1"; E="$2"; D="$3"; cd /opt/infra
: "${LE_EMAIL:?set LE_EMAIL}"
export CERT_NAME="$P-$E" WEB_UP="$P-$E-web:80" API_UP="$P-$E-api:4001"
if [ "$E" = prod ]; then
  export WEB_NAMES="$D www.$D" API_NAME="api.$D" WEB_EXTRA=''
else
  export WEB_NAMES="dev.$D" API_NAME="dev.api.$D"
  export WEB_EXTRA="add_header X-Robots-Tag 'noindex, nofollow' always;"
fi
export ALL_NAMES="$WEB_NAMES $API_NAME"
VARS='${CERT_NAME} ${WEB_UP} ${API_UP} ${WEB_NAMES} ${API_NAME} ${ALL_NAMES} ${WEB_EXTRA}'
CONF="nginx/conf.d/$P-$E.conf"
render() { envsubst "$VARS" < "nginx/templates/$1.tpl" > "$CONF"; }
reload() { docker exec gateway nginx -t && docker exec gateway nginx -s reload; }

render http; reload
ARGS=(); for n in $ALL_NAMES; do ARGS+=(-d "$n"); done
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \\
  --cert-name "$CERT_NAME" "${ARGS[@]}" --agree-tos -m "$LE_EMAIL" --non-interactive
render full; reload
```

The restricted `VARS` list matters: it stops `envsubst` from eating Nginx's own `$host`, `$up` and similar variables. For a password-protected dev site, add `auth_basic` lines through `WEB_EXTRA`.

Certificate renewal (host cron, `crontab -e` as root):

```cron
17 3 * * * cd /opt/infra && docker compose run --rm certbot renew --webroot -w /var/www/certbot -q && docker exec gateway nginx -s reload
```

Because `conf.d` is a mounted volume, there is no `docker cp` step. After any config change: `docker exec gateway nginx -t && docker exec gateway nginx -s reload`.

## 8. MongoDB on the VPS

Standard practice applied here: authentication on, no public port, one database and one least-privilege user per project and environment, strong generated passwords, automated backups with off-site copy, and tested restores.

### 8.1 Create the prod and dev databases

`/opt/infra/bin/mongo-create-db.sh`:

```bash
#!/usr/bin/env bash
# usage: mongo-create-db.sh <project> <prod|dev>  -> prints the MONGO_URI for that environment
set -euo pipefail
source /opt/infra/.env
DB="$1_$2"; APP_USER="${DB}_app"
PASS="$(openssl rand -base64 36 | tr -d '/+=' | cut -c1-40)"   # URL-safe, no encoding needed
docker exec -i mongo mongosh --quiet -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin <<EOF
use ${DB}
db.createUser({ user: '${APP_USER}', pwd: '${PASS}', roles: [{ role: 'readWrite', db: '${DB}' }] })
EOF
echo "MONGO_URI=mongodb://${APP_USER}:${PASS}@mongo:27017/${DB}?authSource=${DB}"
```

Run it once for `prod` and once for `dev`, and paste each printed URI into the matching env file (section 9). The dev user cannot read the prod database. If you need transactions or change streams, convert the single node to a replica set (`--replSet rs0` plus a keyfile, then `rs.initiate()`); otherwise standalone with auth is fine for a single VPS.

### 8.2 Backups

`/opt/infra/bin/mongo-backup.sh`, scheduled with cron at `30 2 * * *`:

```bash
#!/usr/bin/env bash
set -euo pipefail
source /opt/infra/.env
DEST=/opt/backups/mongo; mkdir -p "$DEST"
docker exec mongo mongodump -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip > "$DEST/all_$(date +%F_%H%M).archive.gz"
find "$DEST" -name 'all_*.archive.gz' -mtime +14 -delete
# off-site copy (S3, Backblaze, etc.): rclone copy "$DEST" remote:bucket/mongo --max-age 24h
```

A backup that lives only on the same VPS is not a backup, so configure the off-site line. Test a restore monthly:

```bash
docker exec -i mongo mongorestore -u root_admin -p '<root password>' --authenticationDatabase admin --archive --gzip < all_YYYY-MM-DD_HHMM.archive.gz
# refresh dev from prod (sanitize personal data first): add --nsFrom 'PROJECT_prod.*' --nsTo 'PROJECT_dev.*'
```

### 8.3 Admin access

Use `docker exec -it mongo mongosh -u root_admin --authenticationDatabase admin`. For a GUI such as Compass, temporarily publish `127.0.0.1:27017:27017` only and connect over an SSH tunnel. Never open 27017 to the internet.

## 9. Env Files: Prod and Dev, in the Project Root, Password Protected

Each repo keeps two encrypted files in its root: `.env.prod.gpg` and `.env.dev.gpg`. They are AES-256 encrypted with a passphrase (GnuPG symmetric mode, which also verifies integrity). Plaintext `.env.*` files are git-ignored. The passphrase lives only in GitHub (one value per GitHub Environment, all named `ENV_PASSPHRASE`) and in your password manager.

`.gitignore`:

```gitignore
.env
.env.*
!.env.example
!.env.*.gpg
```

`scripts/env.sh`, to encrypt or decrypt locally:

```bash
#!/usr/bin/env bash
# usage: scripts/env.sh encrypt|decrypt <dev|prod>
set -euo pipefail
CMD="${1:?encrypt|decrypt}"; E="${2:?dev|prod}"
PLAIN=".env.$E"; ENC=".env.$E.gpg"
if [ -z "${ENV_PASSPHRASE:-}" ]; then read -rsp "Passphrase ($E): " ENV_PASSPHRASE; echo; fi
GPG=(gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0)
case "$CMD" in
  encrypt) printf '%s' "$ENV_PASSPHRASE" | "${GPG[@]}" --symmetric --cipher-algo AES256 --s2k-mode 3 --s2k-digest-algo SHA512 --s2k-count 65011712 -o "$ENC" "$PLAIN" ;;
  decrypt) printf '%s' "$ENV_PASSPHRASE" | "${GPG[@]}" --decrypt -o "$PLAIN" "$ENC"; chmod 600 "$PLAIN" ;;
esac
```

Workflow: `scripts/env.sh decrypt prod`, edit `.env.prod`, `scripts/env.sh encrypt prod`, delete the plaintext, commit the `.gpg` file.

Example backend contents (prod shown; dev uses its own values):

```env
APP_ENV=prod                                  # dev in .env.dev
NODE_ENV=production
PORT=4001
MONGO_URI=mongodb://PROJECT_prod_app:<pw>@mongo:27017/PROJECT_prod?authSource=PROJECT_prod
JWT_SECRET=<unique per env: openssl rand -hex 32>
FRONTEND_URL=https://DOMAIN,https://www.DOMAIN   # dev: https://dev.DOMAIN
ORIGIN=https://DOMAIN,https://www.DOMAIN         # dev: https://dev.DOMAIN
ENABLE_TEST_AUTH=false                           # true only in dev
# third-party keys: live keys in prod, test/sandbox keys in dev
```

Example frontend contents:

```env
REACT_APP_API_URL=https://api.DOMAIN           # dev: https://dev.api.DOMAIN
REACT_APP_FRONTEND_URL=https://DOMAIN          # dev: https://dev.DOMAIN
```

Rules:

- Use a random passphrase of 24 or more characters, different for prod and dev. The encrypted files sit in the repo, so anyone with repo access can try offline guessing; keep repos private and make the passphrase strong.
- `REACT_APP_*` values are baked into the public JavaScript bundle. Never put secrets in the frontend env file.
- To rotate: decrypt, re-encrypt with the new passphrase, update the GitHub Environment secret, redeploy.
- Upgrade path if the team grows: SOPS with age keys gives per-person access instead of one shared passphrase.

## 10. Per-Repo Deploy Kit

Every repo gets the same three files, only `project.conf` changes.

`deploy/project.conf`:

```bash
PROJECT=acme
SERVICE=api      # api or web
```

`deploy/deploy.sh`:

```bash
#!/usr/bin/env bash
# usage: ENV_PASSPHRASE=... deploy/deploy.sh <dev|prod>
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_NAME="${1:?dev|prod}"
: "${ENV_PASSPHRASE:?ENV_PASSPHRASE not set}"
source deploy/project.conf
export PROJECT SERVICE ENV_NAME ENV_FILE=".env.${ENV_NAME}"

printf '%s' "$ENV_PASSPHRASE" | gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 0 --decrypt -o "$ENV_FILE" ".env.${ENV_NAME}.gpg"
chmod 600 "$ENV_FILE"
trap 'rm -f "$ENV_FILE"' EXIT          # plaintext exists only while compose runs

IMG="${PROJECT}-${ENV_NAME}-${SERVICE}"
docker tag "$IMG:latest" "$IMG:previous" 2>/dev/null || true
if ! docker compose --env-file "$ENV_FILE" up -d --build --wait --wait-timeout 120; then
  echo 'Deploy failed, rolling back' >&2
  docker compose logs --tail 80 || true
  if docker image inspect "$IMG:previous" >/dev/null 2>&1; then
    docker tag "$IMG:previous" "$IMG:latest"
    docker compose --env-file "$ENV_FILE" up -d --no-build
  fi
  exit 1
fi
docker image prune -f >/dev/null
echo "Deployed $IMG"
```

`docker-compose.yml` for an API repo:

```yaml
name: ${PROJECT}-${ENV_NAME}
services:
  api:
    build: .
    image: ${PROJECT}-${ENV_NAME}-api:latest
    container_name: ${PROJECT}-${ENV_NAME}-api
    restart: unless-stopped
    env_file: ${ENV_FILE}
    networks: [edge, data]
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://127.0.0.1:4001/health']
      interval: 10s
      timeout: 3s
      retries: 6
      start_period: 20s
    logging: {driver: json-file, options: {max-size: 10m, max-file: '3'}}
networks:
  edge: {external: true}
  data: {external: true}
```

For a frontend repo, use the same file with `web` in place of `api`, `networks: [edge]` only, no `env_file`, and the build args below:

```yaml
    build:
      context: .
      args:
        REACT_APP_API_URL: ${REACT_APP_API_URL}
        REACT_APP_FRONTEND_URL: ${REACT_APP_FRONTEND_URL}
```

Backend `Dockerfile` (use the current Node LTS):

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER node
EXPOSE 4001
CMD ["node", "server.js"]
```

Frontend `Dockerfile` (one build per environment, because API URLs are baked in):

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG REACT_APP_API_URL
ARG REACT_APP_FRONTEND_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL REACT_APP_FRONTEND_URL=$REACT_APP_FRONTEND_URL
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
```

Frontend `nginx.conf` (single page app fallback):

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  location / { try_files $uri /index.html; }
  location /static/ { expires 1y; add_header Cache-Control 'public, immutable'; }
}
```

The API must expose a cheap `GET /health` endpoint (used by the health check and by monitoring).

## 11. GitHub Actions

One workflow file, identical in every repo apart from `PROJECT` and `SERVICE`. Branch `main` deploys prod, branch `dev` deploys dev.

```yaml
name: Deploy
on:
  push:
    branches: [main, dev]
  workflow_dispatch:

concurrency:
  group: deploy-${{ github.ref_name }}
  cancel-in-progress: false

env:
  PROJECT: acme
  SERVICE: api          # api or web

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ github.ref_name == 'main' && 'production' || 'development' }}
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4

      - name: Resolve target
        run: |
          if [ "$GITHUB_REF_NAME" = main ]; then echo 'ENV_NAME=prod' >> "$GITHUB_ENV"; else echo 'ENV_NAME=dev' >> "$GITHUB_ENV"; fi

      - name: Guard, no plaintext env files tracked
        run: |
          if git ls-files | grep -E '^\.env(\.|$)' | grep -vE '\.(gpg|example)$'; then echo 'Plaintext env file is tracked'; exit 1; fi

      - name: Deploy over SSH
        uses: appleboy/ssh-action@v1.2.0      # pin to a release tag or commit SHA
        env:
          ENV_PASSPHRASE: ${{ secrets.ENV_PASSPHRASE }}
          PROJECT: ${{ env.PROJECT }}
          SERVICE: ${{ env.SERVICE }}
          ENV_NAME: ${{ env.ENV_NAME }}
          BRANCH: ${{ github.ref_name }}
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          envs: ENV_PASSPHRASE,PROJECT,SERVICE,ENV_NAME,BRANCH
          script_stop: true
          script: |
            cd "/opt/apps/$PROJECT/$ENV_NAME/$SERVICE"
            git fetch --prune origin
            git checkout -f "$BRANCH"
            git reset --hard "origin/$BRANCH"
            ./deploy/deploy.sh "$ENV_NAME"
```

Secrets (GitHub, Settings, Environments):

| Secret | Scope | Value |
| :-- | :-- | :-- |
| `VPS_HOST` | repo | VPS IP or hostname |
| `VPS_USER` | repo | `deploy` |
| `VPS_SSH_KEY` | repo | private key whose public half is in `/home/deploy/.ssh/authorized_keys` |
| `ENV_PASSPHRASE` | Environment `production` | passphrase for `.env.prod.gpg` |
| `ENV_PASSPHRASE` | Environment `development` | passphrase for `.env.dev.gpg` |

Turn on required reviewers for the `production` Environment so prod deploys need an approval.

One-time repo checkout on the VPS (read-only deploy key, instead of putting a token in the remote URL):

```bash
sudo -u deploy ssh-keygen -t ed25519 -f /home/deploy/.ssh/PROJECT_SERVICE -N ''
# add the .pub file as a read-only Deploy key in the GitHub repo; add a Host alias to /home/deploy/.ssh/config
sudo -u deploy git clone -b main git@github.com:ORG/REPO.git /opt/apps/PROJECT/prod/SERVICE
sudo -u deploy git clone -b dev  git@github.com:ORG/REPO.git /opt/apps/PROJECT/dev/SERVICE
```

Upgrade path: build the image in CI, push to GHCR, and have the VPS only pull and restart. That shortens deploys and keeps build tooling off the server.

## 12. New Project Checklist

1. Pick `PROJECT` and `DOMAIN`. Create the five DNS records (section 4).
2. On the VPS: `mongo-create-db.sh PROJECT prod` and `mongo-create-db.sh PROJECT dev`. Keep the printed URIs.
3. In each repo: write `.env.prod` and `.env.dev`, encrypt both, commit the `.gpg` files plus `.gitignore`, `deploy/`, `docker-compose.yml`, `Dockerfile`, workflow.
4. On the VPS: `add-site.sh PROJECT prod DOMAIN`, then `add-site.sh PROJECT dev DOMAIN`.
5. Clone each repo into `/opt/apps/PROJECT/{prod,dev}/SERVICE` (section 11).
6. In GitHub: create the `production` and `development` Environments and add the secrets.
7. Push to `dev`, verify `https://dev.DOMAIN` and `https://dev.api.DOMAIN/health`. Merge to `main` for prod.

## 13. Operations and Troubleshooting

```bash
docker ps                                  # what is running
docker logs --tail 100 -f PROJECT-prod-api  # app logs
docker logs --tail 100 -f gateway           # gateway logs
docker restart PROJECT-dev-api
docker exec gateway nginx -t && docker exec gateway nginx -s reload

# test through the gateway without relying on DNS
curl -ik --resolve dev.api.DOMAIN:443:127.0.0.1 https://dev.api.DOMAIN/health

# what is listening on the host (should be only 22, 80, 443)
ss -tulnp
```

| Symptom | Usual cause |
| :-- | :-- |
| 502 or 503 from gateway | Container not running, not on the `edge` network, or name differs from `PROJECT-ENV-SERVICE` (check `docker network inspect edge`) |
| Certificate step fails | DNS not pointing at the VPS yet, or port 80 blocked; retry with `--staging` first |
| App cannot reach Mongo | API container missing the `data` network, or wrong `authSource` in `MONGO_URI` |
| CORS errors | `ORIGIN` or `FRONTEND_URL` in that environment's env file does not list the exact frontend origin |
| WebSocket drops | Upgrade headers missing; confirm `proxy-common.conf` is included in the API block |
| Deploy rolled back | Read `docker compose logs`; the previous image is still serving |

## 14. Hardening Checklist and Changes From the Original Guide

- SSH key login only, root login off, `fail2ban` on, `ufw` allows only 22, 80, 443.
- Mongo never published; auth on; separate DB and user per environment; off-site backups with tested restores.
- Secrets never in git in plaintext; passphrase only in GitHub Environments and a password manager.
- Dev is hidden from search engines (`X-Robots-Tag`) and can be put behind basic auth.
- Pin image tags and action versions; update them on a schedule.

What changed from the project-specific version:

- Gateway proxies to container names on a private network, not to the public VPS IP and host ports.
- One generated Nginx file per project and environment instead of one hand-edited file; certificates per environment; registered renewal email; renewal by cron plus reload.
- The `/api/` and `/ws/` paths on the frontend host are gone. The frontend calls `api.DOMAIN` directly, and WebSockets use the same API host.
- CI logs in as a `deploy` user with an SSH key, not `root` with a password, and uses a read-only deploy key instead of embedding `GITHUB_TOKEN` in the remote URL.
- MongoDB Atlas is replaced by self-hosted MongoDB with separate prod and dev databases.
- `PROD_ENV` GitHub secrets are replaced by encrypted env files in the repo root, decrypted only during deploy.
- Branch-to-environment mapping, deploy concurrency lock, health-gated rollout and automatic rollback.

## 15. Git Workflow and CI Checks

This section adds the branching rules, pull request checks and release tags that sit in front of the deploy workflow in section 11. The deploy workflow itself does not change: nothing can reach `dev` or `main` without passing checks, so every push that triggers a deploy has already been verified.

### 15.1 Branch model

| Branch | Purpose | Deploys to |
| :-- | :-- | :-- |
| `main` | Production code | prod (after Environment approval) |
| `dev` | Integration branch | dev |
| `feature/*`, `fix/*` | Short-lived work, branched from `dev` | nothing |
| `hotfix/*` | Urgent prod fix, branched from `main` | nothing |

Flow:

1. Branch from `dev`: `git switch dev && git pull && git switch -c feature/short-name`.
2. Open a pull request into `dev`. CI runs. Squash merge. The merge triggers the dev deploy.
3. Verify on `https://dev.DOMAIN` and `https://dev.api.DOMAIN/health`.
4. Open a pull request from `dev` into `main`. CI runs and a reviewer approves. Use a merge commit (not squash) so `dev` and `main` do not drift apart. The merge triggers the prod deploy, which waits for approval on the `production` Environment.
5. A release tag is created automatically (section 15.4).

Hotfix: branch `hotfix/name` from `main`, open a pull request into `main`, and merge `main` back into `dev` straight after.

### 15.2 CI workflow

`.github/workflows/ci.yml`, the same in every repo. It runs on pull requests only, and the two job names (`checks`, `branch-rule`) are what branch protection requires.

```yaml
name: CI
on:
  pull_request:
    branches: [dev, main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - name: Guard, no plaintext env files tracked
        run: |
          if git ls-files | grep -E '^\.env(\.|$)' | grep -vE '\.(gpg|example)$'; then echo 'Plaintext env file is tracked'; exit 1; fi
      - run: npm ci
      - run: npm run lint --if-present
      - run: npm test --if-present
      - run: npm run build --if-present
      - name: Docker image builds
        run: docker build -t ci-check .

  branch-rule:
    if: github.base_ref == 'main'
    runs-on: ubuntu-latest
    steps:
      - run: |
          case "$GITHUB_HEAD_REF" in
            dev|hotfix/*) ;;
            *) echo 'Pull requests into main must come from dev or hotfix/*'; exit 1 ;;
          esac
```

The `branch-rule` job is skipped on pull requests into `dev`, and GitHub treats a skipped required check as passing. A Create React App build treats lint warnings as errors when `CI=true`; fix the warnings rather than turning that off.

### 15.3 Branch protection

Set these under Settings, Rules, Rulesets (or classic Branch protection) in each repo.

| Setting | `main` | `dev` |
| :-- | :-- | :-- |
| Require a pull request before merging | yes | yes |
| Required approvals | 1 | 0 or 1 |
| Dismiss stale approvals on new commits | yes | no |
| Required status checks | `checks`, `branch-rule` | `checks` |
| Branch must be up to date before merging | yes | yes |
| Block force pushes and deletion | yes | yes |
| Allow bypass (admins) | no | no |
| Allowed merge method | merge commit | squash |

Also enable "Automatically delete head branches" and disable rebase merging at the repo level. A required check only appears in the picker after it has run once, so open a throwaway pull request first. Branch protection on private repos needs a paid GitHub plan (Pro, Team or Enterprise).

### 15.4 Release tags and rollback

Every merge into `main` gets a dated tag and a GitHub Release with generated notes. `.github/workflows/release.yml`:

```yaml
name: Release
on:
  push:
    branches: [main]

permissions:
  contents: write

jobs:
  tag:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Create release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          TAG="v$(date -u +%Y.%m.%d-%H%M)"
          gh release create "$TAG" --target "$GITHUB_SHA" --generate-notes --title "$TAG"
```

Rollback options, in order of preference:

1. Revert the bad merge commit on `main` through a pull request. CI and the normal deploy run, and git history stays honest.
2. Emergency, on the VPS: check out the last good tag and redeploy by hand. The next normal deploy returns the checkout to the branch.

```bash
cd /opt/apps/PROJECT/prod/SERVICE
git fetch --tags && git checkout -f vYYYY.MM.DD-HHMM
read -rs ENV_PASSPHRASE && export ENV_PASSPHRASE
./deploy/deploy.sh prod
```

### 15.5 Dependency updates

`.github/dependabot.yml` keeps npm packages, GitHub Actions versions and Docker base images current through ordinary pull requests, which then pass through the same CI checks:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: {interval: weekly}
    target-branch: dev
  - package-ecosystem: github-actions
    directory: /
    schedule: {interval: weekly}
    target-branch: dev
  - package-ecosystem: docker
    directory: /
    schedule: {interval: weekly}
    target-branch: dev
```

### 15.6 Per-repo setup checklist

1. Create the `dev` branch from `main` and push it.
2. Add `ci.yml`, `release.yml`, `dependabot.yml` and the deploy workflow from section 11.
3. Open a throwaway pull request into `dev` so the `checks` job runs once, then add the branch protection from section 15.3.
4. Add required reviewers to the `production` Environment (section 11).
5. Merge a small change through the full path (feature, `dev`, `main`) to confirm CI, both deploys and the release tag all work.
