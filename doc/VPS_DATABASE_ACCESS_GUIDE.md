# Remote VPS Database Access & Connectivity Guide

This guide documents the architecture, connection strings, and troubleshooting procedures for connecting local development environments and GUI clients (such as MongoDB Compass) to the development database hosted on the VPS (`187.127.149.165`).

---

## 1. Connection Strings Quick Reference

### For MongoDB Compass (GUI)
Paste this directly into the Compass connection string field:
```text
mongodb://gymezy_dev_user:GymezyDev%402026Pass%21@187.127.149.165:8443/gymezy_dev?authSource=gymezy_dev&directConnection=true
```

> **Important:** Save this connection to your **Favorites** in Compass so parameters like `authSource` and `directConnection` are preserved across sessions.

### For Local Backend (`middleware/.env`)
```env
MONGODB_URI=mongodb://gymezy_dev_user:GymezyDev%402026Pass%21@187.127.149.165:8443/gymezy_dev?authSource=gymezy_dev&directConnection=true&family=4
```

*(Alternatively, if running MongoDB locally via Docker or native service: `mongodb://localhost:27017/gymezy_dev`).*

---

## 2. Why Port 8443? (ISP Port Blocking Prevention)

In India and many other regions, major cellular carriers (Jio, Airtel, Vi) and public/office Wi-Fi routers **block outbound traffic on standard database ports** (`27017` for MongoDB, `3306` for MySQL, `5432` for PostgreSQL) by default.

### Architectural Solution
To ensure uninterrupted access from any network:
1. MongoDB continues running internally on port `27017`.
2. The VPS firewall routes incoming traffic on **Port 8443** (a standard HTTPS alternate port that is **never blocked** by ISPs) directly to MongoDB's internal port `27017`.
3. The rule is persisted via `netfilter-persistent` so it survives server reboots.

---

## 3. MongoDB Compass Manual Setup

If you prefer filling in the Compass manual form instead of pasting the URI:

- **Host:** `187.127.149.165` (or your configured DNS hostname)
- **Port:** `8443`
- **Authentication:** `Username / Password`
  - **Username:** `gymezy_dev_user`
  - **Password:** `GymezyDev@2026Pass!` *(Do not URL-encode in the manual form)*
  - **Authentication Database:** `gymezy_dev` *(CRITICAL: Compass defaults to `admin`, you must change this to `gymezy_dev`)*
- **Advanced Connection Options:**
  - **Direct Connection:** Checked / `true` *(Prevents Compass from hanging during replica set discovery)*

---

## 4. Alternative: Encrypted SSH Tunnel (Port 22)

If you prefer running traffic strictly through SSH or your network has deep packet inspection:

### Via Terminal
```bash
ssh -N -L 27017:localhost:27017 root@187.127.149.165
```
Once the tunnel is open, connect your local backend or Compass to:
```text
mongodb://gymezy_dev_user:GymezyDev%402026Pass%21@localhost:27017/gymezy_dev?authSource=gymezy_dev
```

### Via Compass Built-in SSH Tunnel
1. Under **Advanced Connection Options**, click **SSH Tunnel**.
2. Select **SSH with Password** or **Identity File**:
   - **SSH Host:** `187.127.149.165`
   - **SSH Port:** `22`
   - **SSH Username:** `root`
3. Set General Host to `localhost:27017`.

---

## 5. Troubleshooting & Diagnostics

### Fast Network Port Check
Run this in your terminal to verify if your network can reach the server:
- **Mac / Linux:**
  ```bash
  nc -zv -G 3 187.127.149.165 8443
  ```
- **Windows (PowerShell):**
  ```powershell
  Test-NetConnection -ComputerName 187.127.149.165 -Port 8443
  ```
If it says `succeeded` or `TcpTestSucceeded : True`, your network connection is healthy.

### Handling Fail2ban IP Jails
If a client makes repeated failed authentication attempts, Fail2ban on the VPS may temporarily jail their IP.
1. Check client public IP via `curl -s icanhazip.com`.
2. On the VPS:
   ```bash
   sudo fail2ban-client status
   sudo fail2ban-client set <jail-name> unbanip <CLIENT_IP>
   ```

### DNS / Subdomain Setup Rule
If pointing a domain (e.g., `db.yourdomain.com`) via Cloudflare:
- The DNS `A` record **must be set to "DNS only" (Grey Cloud ⚪)**.
- Cloudflare free proxy (Orange Cloud 🟠) only proxies HTTP/HTTPS traffic on ports 80/443; it will drop MongoDB TCP traffic.

