# Deployment

Install ShellMan on your own machine, run it in Docker, or host a public demo. See also: [Features](features.md) · [Security](security.md) · [Cloudflare](cloudflare.md).

## Quick Start

### Option A: 1-Command Docker Deployment (Recommended)

Run ShellMan with a single Docker command. All encryption keys, server credentials, and SQLite state are persisted in the `shellman_data` volume:

```bash
docker run -d \
  -p 9874:9874 \
  -v shellman_data:/app/instance \
  --name shellman \
  --restart unless-stopped \
  dipanshu0919/shellman
```

Navigate to `http://localhost:9874` to access your environment.

### Option B: Docker Compose

Clone the repository and run via Docker Compose:

```bash
git clone https://github.com/Dipanshu0919/ShellMan.git
cd ShellMan

docker compose up -d
```

To view live container logs:
```bash
docker compose logs -f
```

### Option C: Native Python Environment

#### 1. Requirements
- **Python 3.9+**
- Standard Linux, macOS, or Windows (WSL recommended) environment
- `openssh-client` and `rsync`

#### 2. Setup & Installation

```bash
# 1. Clone the repository
git clone https://github.com/Dipanshu0919/ShellMan.git
cd ShellMan

# 2. Create virtual environment
python3 -m venv venv
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Launch ShellMan
python3 app.py
```

Open your browser and navigate to:
```text
http://127.0.0.1:9874
```

### First-Time Setup Wizard (No Default Credentials)
> [!IMPORTANT]
> **ShellMan does not ship with insecure default passwords.**
> On your very first visit, you will automatically be directed to the **First-Time Setup Wizard** (`/setup`) where you create your master administrator username and secure password. Once created, the wizard locks permanently and launches you directly into your desktop environment.

---

## Deploying a Public Live Demo Instance

To deploy a live read-only or sandbox demonstration of ShellMan for colleagues or the community (e.g. on Render, Railway, Fly.io, or an entry-tier VPS):

1. **Deploy Container**: Point your host's Docker or Git deployment pipeline to this repository.
2. **Environment Variables**:
   ```ini
   HOST=0.0.0.0
   PORT=9874
   # Optional: a random key is generated and stored in /app/instance if this is unset.
   # SHELLMAN_SECRET_KEY=<at least 16 random characters>
   SHELLMAN_COOKIE_SECURE=1
   SHELLMAN_TRUST_PROXY=1
   ```
3. **Persistent Volume**: Attach a persistent disk mount to `/app/instance` to retain the initialized demo account and sample sandbox nodes across restarts.
4. **Security for Public Demos**:
   - Provide pre-configured guest/demo credentials in the login page or README.
   - For public sandboxes, connect the demo to a dedicated isolated test VPS or local mock container rather than production infrastructure.
