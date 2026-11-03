# CI/CD Deployment Workflow & VPS Infrastructure Specification

This document details the automated continuous integration and continuous deployment (CI/CD) pipeline for **GYMEZY**, including git branching rules, GitHub Actions workflows, environment secrets, and server deployment scripts.

---

## 1. Pipeline Overview & Topology

```mermaid
flowchart TD
    subgraph GitRepository["GitHub Repository (origin / praveen)"]
        devBranch["dev Branch"]
        prodBranch["prod Branch"]
        manualTrigger["workflow_dispatch (Manual UI Run)"]
    end

    subgraph GitHubActions["GitHub Actions Runner"]
        deployDevJob["deploy-dev Job"]
        deployProdJob["deploy-prod Job"]
    end

    subgraph HostingerVPS["Hostinger VPS (187.127.149.165)"]
        sshDaemon["SSH Service (Port 22)"]
        devScript["/var/www/gymezy/deploy-dev.sh"]
        prodScript["/var/www/gymezy/deploy-prod.sh"]
        devPM2["PM2: gymezy-dev-api"]
        prodPM2["PM2: gymezy-prod-api"]
        nginx["Nginx Reverse Proxy"]
    end

    devBranch -->|"git push"| deployDevJob
    prodBranch -->|"git push"| deployProdJob
    manualTrigger -->|"target_env = dev"| deployDevJob
    manualTrigger -->|"target_env = prod"| deployProdJob

    deployDevJob -->|"appleboy/ssh-action"| sshDaemon
    deployProdJob -->|"appleboy/ssh-action"| sshDaemon

    sshDaemon --> devScript
    sshDaemon --> prodScript

    devScript --> devPM2
    prodScript --> prodPM2
    devScript --> nginx
    prodScript --> nginx
```

---

## 2. Git Branching Model

| Branch | Environment | Trigger Condition | Execution Script on VPS |
|---|---|---|---|
| **`dev`** | **Development / Staging** | Push to `dev` | `/var/www/gymezy/deploy-dev.sh` |
| **`prod`** | **Production** | Push to `prod` | `/var/www/gymezy/deploy-prod.sh` |
| **Manual Dispatch** | **Dev or Prod** | Run workflow in GitHub Actions tab | Target chosen in UI input |

---

## 3. GitHub Actions Workflow Configuration

**File Location**: [`.github/workflows/deploy.yml`](file:///Users/yovelr/Softrate/GYMEZY/.github/workflows/deploy.yml)

```yaml
name: Deploy GYMEZY to VPS

on:
  push:
    branches:
      - dev
      - prod
  workflow_dispatch:
    inputs:
      target_env:
        description: 'Environment to deploy'
        required: true
        default: 'dev'
        type: choice
        options:
          - dev
          - prod

jobs:
  deploy-dev:
    name: Deploy to Dev Environment
    if: github.ref == 'refs/heads/dev' || (github.event_name == 'workflow_dispatch' && inputs.target_env == 'dev')
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Dev Deployment Script via SSH
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USERNAME || 'root' }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT || 22 }}
          script: |
            echo "Starting Dev deployment..."
            /var/www/gymezy/deploy-dev.sh

  deploy-prod:
    name: Deploy to Production Environment
    if: github.ref == 'refs/heads/prod' || (github.event_name == 'workflow_dispatch' && inputs.target_env == 'prod')
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Production Deployment Script via SSH
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USERNAME || 'root' }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT || 22 }}
          script: |
            echo "Starting Production deployment..."
            /var/www/gymezy/deploy-prod.sh
```

---

## 4. Required GitHub Secrets

Configure these in **GitHub Repository → Settings → Secrets and variables → Actions**:

| Secret Name | Description | Example / Default |
|---|---|---|
| `VPS_HOST` | Public IP address of the Hostinger VPS | `187.127.149.165` |
| `VPS_USERNAME` | SSH login username | `root` |
| `VPS_SSH_KEY` | Private SSH key (PEM / OpenSSH format) without passphrase | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `VPS_PORT` | SSH daemon listening port | `22` |

> [!IMPORTANT]
> The public key corresponding to `VPS_SSH_KEY` must be present in `/root/.ssh/authorized_keys` on the VPS.

---

## 5. Deployment Scripts Structure (on Hostinger VPS)

### 5.1 Dev Deployment Script (`/var/www/gymezy/deploy-dev.sh`)
```bash
#!/bin/bash
set -e

echo "=== Deploying GYMEZY Development ==="
cd /var/www/gymezy/dev

# 1. Fetch latest changes from dev
git fetch origin dev
git checkout dev
git pull origin dev

# 2. Update Backend Dependencies
cd middleware
npm ci --omit=dev
cd ..

# 3. Reload Backend Service via PM2
pm2 reload ecosystem.config.js --only gymezy-dev-api || pm2 start ecosystem.config.js --only gymezy-dev-api

# 4. Build Web Applications
cd web-application/gym-owner
npm ci
npm run build
cd ../..

cd web-application/super-admin
npm ci
npm run build
cd ../..

# 5. Reload Nginx
sudo nginx -t && sudo systemctl reload nginx

echo "=== Dev Deployment Succeeded ==="
```

### 5.2 Production Deployment Script (`/var/www/gymezy/deploy-prod.sh`)
```bash
#!/bin/bash
set -e

echo "=== Deploying GYMEZY Production ==="
cd /var/www/gymezy/prod

# 1. Fetch latest changes from prod
git fetch origin prod
git checkout prod
git pull origin prod

# 2. Update Backend Dependencies
cd middleware
npm ci --omit=dev
cd ..

# 3. Zero-downtime PM2 Cluster Reload
pm2 reload ecosystem.config.js --only gymezy-prod-api || pm2 start ecosystem.config.js --only gymezy-prod-api

# 4. Build Production Web Assets
cd web-application/gym-owner
npm ci
npm run build
cd ../..

cd web-application/super-admin
npm ci
npm run build
cd ../..

# 5. Reload Nginx
sudo nginx -t && sudo systemctl reload nginx

echo "=== Production Deployment Succeeded ==="
```

---

## 6. How to Deploy

### 6.1 Deploying via Git (Automated)
- **To Deploy to Dev**:
  ```bash
  git checkout dev
  git push origin dev
  ```
- **To Deploy to Production**:
  ```bash
  git checkout prod
  git merge dev
  git push origin prod
  ```

### 6.2 Deploying via GitHub Actions UI (Manual Dispatch)
1. Go to **Actions** tab in GitHub: `https://github.com/yovel-r-softrate/GYMEZY/actions`
2. Select **Deploy GYMEZY to VPS** workflow from the left sidebar.
3. Click **Run workflow**.
4. Select the target branch and choose `dev` or `prod` from the dropdown.
5. Click **Run workflow** to initiate deployment.

