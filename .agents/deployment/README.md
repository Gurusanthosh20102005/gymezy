# iSkill Deployment Documentation

This directory contains the production deployment specifications, Nginx gateway configurations, Docker setup, and deployment runbooks for **iSkill**.

---

## 1. Domains & Architecture

### 1.1 Production Domains

| Target | Environment | Domain | Target Container / Upstream |
|---|---|---|---|
| **Frontend (Web)** | Production | `https://iskill.softrateglobal.com` | `iskill-prod-web:80` |
| **API Middleware** | Production | `https://api.iskill.softrateglobal.com` | `iskill-prod-api:4500` |
| **PeopleSoft HRMS Core** | Upstream Provider | `https://peoplesoft.softrateglobal.com/hrms-api/` | Upstream Identity & LMS Provider |

### 1.2 System Topology

```mermaid
flowchart TD
    subgraph Public Internet
        Browser["Learner Browser"]
    end

    subgraph VPS ["Softrate VPS"]
        subgraph Gateway ["Nginx Gateway (Ports 80 & 443)"]
            SSL["Let's Encrypt SSL"]
        end

        subgraph DockerEdge ["Docker Network: edge"]
            WebContainer["iskill-prod-web<br/>(Nginx SPA :80)"]
            ApiContainer["iskill-prod-api<br/>(Express Middleware :4500)"]
        end
    end

    subgraph External ["Upstream Softrate Infrastructure"]
        PeopleSoft["PeopleSoft HRMS Gateway<br/>https://peoplesoft.softrateglobal.com/hrms-api/"]
    end

    Browser -->|"HTTPS: iskill.softrateglobal.com"| Gateway
    Browser -->|"HTTPS: api.iskill.softrateglobal.com"| Gateway
    Gateway -->|"Reverse Proxy"| WebContainer
    Gateway -->|"Reverse Proxy"| ApiContainer
    ApiContainer -->|"Authenticated REST & Media Relay"| PeopleSoft
```

---

## 2. DNS Configuration

Add only these **two** DNS records to Cloudflare / domain registrar for `softrateglobal.com`:

| Type | Name | Content / Value | Proxy Status | Purpose |
|:---:|---|---|:---:|---|
| **A** | `iskill` | `<VPS_PUBLIC_IP>` | DNS Only (or Proxied) | Production Web UI |
| **A** | `api.iskill` | `<VPS_PUBLIC_IP>` | DNS Only (or Proxied) | Production Middleware API |

---

## 3. Environment Variables

### 3.1 Middleware Service (`middleware/.env`)

```env
NODE_ENV=production
PORT=4500
LMS_PORT=4500

# Strict CORS origin lock in production
CORS_ORIGIN=https://iskill.softrateglobal.com

# Upstream PeopleSoft HRMS API endpoint
PEOPLESOFT_API_URL=https://peoplesoft.softrateglobal.com/hrms-api/

# Default company organization identifier
DEFAULT_COMPANY_CODE=SOFTRATE
```

### 3.2 Frontend Application (`frontend/.env` or Docker Build Args)

```env
# Middleware API endpoint
VITE_API_URL=https://api.iskill.softrateglobal.com

# Media / Uploads base endpoint
VITE_BACKEND_URL=https://peoplesoft.softrateglobal.com/hrms-api/
```

---

## 4. Deployment Instructions

### 4.1 Server Setup (One-time)

Ensure the shared Docker gateway and `edge` network exist on the VPS:
```bash
# Ensure the edge network is created
docker network create edge || true

# Verify Nginx gateway is running in /opt/infra
docker ps --filter "name=gateway"
```

### 4.2 Provision SSL Certificates (Let's Encrypt)

Using Certbot with the shared gateway:

```bash
# 1. Place Nginx gateway config
cp .agents/deployment/nginx/iskill-prod.conf /opt/infra/nginx/conf.d/iskill-prod.conf

# 2. Run Certbot to acquire certificate for both domains
docker compose -f /opt/infra/docker-compose.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --cert-name iskill-prod \
  -d iskill.softrateglobal.com \
  -d api.iskill.softrateglobal.com \
  --agree-tos \
  -m ops@softrateglobal.com \
  --non-interactive

# 3. Reload Gateway Nginx
docker exec gateway nginx -t && docker exec gateway nginx -s reload
```

### 4.3 Automated Application Deployment

Clone the repository to `/opt/apps/iskill`:
```bash
mkdir -p /opt/apps/iskill
cd /opt/apps/iskill
git clone https://github.com/stp-yovel/iSkill.git .

# Execute the deployment script
./deploy/deploy.sh
```

The deployment script will:
1. Verify the `edge` network.
2. Build optimized multi-stage Docker containers for frontend and middleware.
3. Launch `iskill-prod-web` and `iskill-prod-api`.
4. Poll the `/api/health` endpoint until the API reports healthy status.
5. Prune dangling build images.

---

## 5. GitHub Actions CI/CD Pipeline

The repository includes an automated deployment workflow at [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml). Every push to `main` (or manual `workflow_dispatch`) will connect to the VPS via SSH and run `./deploy/deploy.sh`.

### Required GitHub Repository Secrets

Configure the following secrets in GitHub (**Settings > Secrets and variables > Actions > Repository secrets**):

| Secret Name | Value Description | Example |
|---|---|---|
| `VPS_HOST` | Public IP or Hostname of the VPS | `203.0.113.10` |
| `VPS_USER` | Deployment user on VPS | `deploy` (or `root`) |
| `VPS_SSH_KEY` | Private SSH Key (ed25519 / RSA) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `VPS_PORT` | SSH Port (optional, defaults to 22) | `22` |

---

## 6. Maintenance & Diagnostics

### View Real-time Container Logs
```bash
# View API gateway logs
docker logs -f iskill-prod-api

# View Frontend web logs
docker logs -f iskill-prod-web
```

### Check Service Health
```bash
# Test local healthcheck directly inside container
docker exec iskill-prod-api wget -qO- http://127.0.0.1:4500/api/health

# Test public domain endpoint
curl -i https://api.iskill.softrateglobal.com/api/health
```

### Upstream PeopleSoft Connectivity Check
```bash
# Verify the middleware can resolve and contact the PeopleSoft HRMS endpoint
docker exec iskill-prod-api node -e "
  fetch('https://peoplesoft.softrateglobal.com/hrms-api/api/auth/me')
    .then(r => console.log('HTTP Status:', r.status))
    .catch(e => console.error('Connection Error:', e.message));
"
```
