---
name: vps-db
description: 'Remote VPS database connectivity and networking standards: bypassing mobile carrier/ISP port blocks (Jio/Airtel/Vi blocking port 27017) via HTTPS port redirection (8443 -> 27017), encrypted SSH tunneling (Compass & CLI), Fail2ban jail recovery and IP whitelisting, DNS setup with Cloudflare Grey-Cloud (DNS only), and Mongoose/driver connection tuning (&family=4, directConnection=true, authSource). Use whenever connecting local dev or GUI tools to a remote VPS database, debugging connection timeouts, ECONNREFUSED, or server selection errors, or configuring VPS database firewall and port forwarding rules.'
---

# Remote VPS Database Connectivity & Networking Standard (`vps-db`)

Standard operating procedures for configuring, securing, connecting to, and troubleshooting remote databases (MongoDB, PostgreSQL, MySQL) hosted on Linux VPS environments across all projects.

---

## 1. The Core Problem: ISP & Cellular Port Blocking

In many regions (especially India and shared office networks), major mobile carriers (**Jio, Airtel, Vi**) and commercial Wi-Fi hotspots **block outbound traffic on well-known database ports** (`27017` for MongoDB, `3306` for MySQL, `5432` for PostgreSQL) by default.

### Symptoms
- `nc -zv -G 3 <IP> 27017` reports `Operation timed out` on mobile hotspot or office Wi-Fi, but connects on home broadband or VPN.
- Mongoose / MongoDB Compass throws `MongooseServerSelectionError: Server selection timed out after 30000 ms`.
- Developers report that connection "works intermittently" (e.g. works after reconnecting Wi-Fi or VPN, then breaks on hotspot).

---

## 2. Standard Fix: Alternative Port Redirection (Port 8443)

### Why Port 8443?
Port `8443` is an officially designated alternate HTTPS/SSL port. **No ISP, mobile network, or hotel firewall blocks port 8443**, because essential web, payment gateway, and enterprise services rely on it.

### VPS Server-Side Setup (Kernel-Level Forwarding)
Keep the database running natively or in Docker on its standard port (e.g. `27017`), and redirect incoming port `8443` traffic at the kernel level:

```bash
# 1. Allow port 8443 in the firewall (UFW)
sudo ufw allow 8443/tcp

# 2. Redirect incoming 8443 traffic to 27017
sudo iptables -t nat -I PREROUTING 1 -p tcp --dport 8443 -j REDIRECT --to-port 27017

# 3. Persist rules across VPS reboots
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent netfilter-persistent
sudo netfilter-persistent save
```

### Client Connection Strings (Node.js & Compass)
Replace port `27017` with `8443` in the client URI:

```text
# MongoDB Compass
mongodb://<USER>:<PASS>@<VPS_IP_OR_DOMAIN>:8443/<DB_NAME>?authSource=<DB_NAME>&directConnection=true

# Node.js / Mongoose .env
MONGODB_URI=mongodb://<USER>:<PASS>@<VPS_IP_OR_DOMAIN>:8443/<DB_NAME>?authSource=<DB_NAME>&directConnection=true&family=4
```

> **Note on `&family=4`:** In Node.js 18+, the "Happy Eyeballs" DNS algorithm prioritizes IPv6. If the VPS has dual-stack routing but lacks public IPv6 database listeners, connections can hang for 30s. Adding `&family=4` forces immediate IPv4 routing.

---

## 3. Alternative Standard: Encrypted SSH Tunneling

If exposing any public port is prohibited by security policy, route traffic through SSH (Port 22, which is never blocked).

### Terminal Command (Local Port Forwarding)
```bash
ssh -N -L 27017:localhost:27017 <USER>@<VPS_IP>
```
The terminal will hold open silently (`-N`). The client then connects to:
```text
mongodb://<USER>:<PASS>@localhost:27017/<DB_NAME>?authSource=<DB_NAME>
```

### MongoDB Compass Built-In SSH Tunnel
1. Go to **Advanced Connection Options** -> **SSH Tunnel**.
2. Select **SSH with Password** (or Identity File):
   - **SSH Host:** `<VPS_IP>`
   - **SSH Port:** `22`
   - **SSH Username:** `root` (or deploy user)
3. Under **General**, set Host to `localhost:27017`.

---

## 4. Fail2ban Management (Unjailing Developers)

Repeated failed authentications or rapid reconnection bursts can cause Linux **Fail2ban** to automatically blacklist a developer's public IP.

### Diagnostic & Unban Workflow
```bash
# 1. Have developer identify their public IP
curl -s icanhazip.com

# 2. Check if the IP is currently banned on the VPS
sudo fail2ban-client status
# Inspect iptables drops directly
sudo iptables -L -n -v | grep DROP

# 3. Unban the developer's IP
sudo fail2ban-client set <jail-name> unbanip <DEVELOPER_IP>

# 4. Whitelist developer/office IP so they are never banned again
sudo fail2ban-client set <jail-name> addignoreip <DEVELOPER_IP>
```

---

## 5. Domain & DNS Configuration Rules

When assigning a domain or subdomain (e.g. `db.example.com`) to the VPS:

1. **DNS `A` Record:**
   - Name: `db`
   - Value: `<VPS_PUBLIC_IP>`
   - TTL: Auto / 300s
2. **Cloudflare Proxy Trap:**
   - **CRITICAL:** Set the proxy status to **"DNS Only" (Grey Cloud ⚪)**.
   - Do **NOT** set to "Proxied" (Orange Cloud 🟠). Cloudflare's free proxy only handles HTTP/HTTPS protocols on ports 80/443; raw TCP database streams on other ports will be terminated or rejected.

---

## 6. Verification & Health Check Checklist

When a developer reports connection issues, run this 60-second diagnostic:

1. **TCP Reachability Test (from developer's terminal):**
   ```bash
   # Mac / Linux
   nc -zv -G 3 <HOST> 8443
   # Windows PowerShell
   Test-NetConnection -ComputerName <HOST> -Port 8443
   ```
2. **MongoDB Wire Protocol Test:**
   ```bash
   node -e "
   const mongoose = require('mongoose');
   mongoose.connect('mongodb://<USER>:<PASS>@<HOST>:8443/<DB>?authSource=<DB>&directConnection=true', { serverSelectionTimeoutMS: 5000 })
     .then(() => { console.log('Connected successfully!'); process.exit(0); })
     .catch(err => { console.error('Connection failed:', err.message); process.exit(1); });
   "
   ```
3. **Compass Settings Verification:**
   - Ensure `Authentication Database` is explicitly set to the application DB (not `admin`).
   - Ensure `Direct Connection` is toggled **ON** (`directConnection=true`).
   - Ensure special characters in passwords (e.g. `@`, `!`) are URL-encoded in connection URIs (`%40`, `%21`), but typed in plain text in manual GUI forms.

