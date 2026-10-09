# 🚀 Deployment Guide — Smart Campus Delivery Robot Simulation 3D

This comprehensive guide covers all deployment targets for the **Smart Campus Delivery Robot 3D** application, ranging from zero-install local static previews to production cloud containers and VPS servers.

---

## 📋 Table of Contents

1. [Local Development Setup (Python & Flask)](#1-local-development-setup-python--flask)
2. [Zero-Install Static Mode (Browser / Live Server)](#2-zero-install-static-mode-browser--live-server)
3. [Docker & Docker Compose Deployment](#3-docker--docker-compose-deployment)
4. [Deploying to Cloud PaaS (Render / Railway / Heroku)](#4-deploying-to-cloud-paas-render--railway--heroku)
5. [Deploying to Serverless / Static Hosts (Vercel, Netlify, GitHub Pages)](#5-deploying-to-serverless--static-hosts)
6. [Production Linux VPS (Ubuntu + Nginx + Gunicorn + SSL)](#6-production-linux-vps-ubuntu--nginx--gunicorn--ssl)
7. [Environment Variables Reference](#7-environment-variables-reference)
8. [Health Check & Verification](#8-health-check--verification)
9. [Troubleshooting & FAQs](#9-troubleshooting--faqs)

---

## 1. Local Development Setup (Python & Flask)

### Prerequisites
- Python 3.9+ (`python --version` or `python3 --version`)
- pip (`pip --version`)
- Modern web browser with WebGL support (Chrome, Firefox, Safari, Edge)

### Step-by-Step

#### Step 1: Clone / Open the Project Folder
Open your terminal (PowerShell, Command Prompt, or Bash) and navigate to the project directory:
```bash
cd smart-campus-delivery-robot-3d
```

#### Step 2: Create a Python Virtual Environment
- **On Windows (PowerShell)**:
  ```powershell
  python -m venv venv
  .\venv\Scripts\Activate.ps1
  ```
  *(Note: If you encounter an execution policy restriction, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first).*

- **On macOS / Linux**:
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

#### Step 3: Install Required Dependencies
```bash
pip install -r requirements.txt
```

#### Step 4: Run the Flask Application
```bash
python app.py
```

You should see terminal output:
```text
============================================================
🤖 Smart Campus Delivery Robot 3D — AI Pathfinding Server
📡 URL: http://127.0.0.1:5000
🧠 Algorithms: 3D A* Search [f=g+h] & 3D Greedy BFS [f=h]
✨ Features: Dynamic 3D Replanning, Multi-floor Ramps & Elevators
============================================================
 * Running on http://127.0.0.1:5000
```

#### Step 5: Open in Your Web Browser
Navigate to:
```text
http://localhost:5000
```

---

## 2. Zero-Install Static Mode (Browser / Live Server)

The application features a **dual-engine architecture**. It automatically detects whether the Python backend is running. If not, it effortlessly switches to the client-side JavaScript 3D AI pathfinding engine.

### Method A: VS Code Live Server
1. Open the project folder in **Visual Studio Code**.
2. Install the **Live Server** extension by *Ritwick Dey*.
3. Right-click on `index.html` in the file explorer and click **"Open with Live Server"**.
4. The simulation opens immediately at `http://127.0.0.1:5500`.

### Method B: Direct Browser Open
Double-click `index.html` or drag-and-drop it into any modern web browser.

---

## 3. Docker & Docker Compose Deployment

Docker containerization packages the Python environment, Gunicorn multi-threaded server, and WebGL assets into an isolated, reproducible container.

### Prerequisites
- [Docker Engine](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/) installed.

### Option 1: Using Docker Compose (Recommended)

1. Build and start the container in detached mode:
   ```bash
   docker-compose up -d --build
   ```

2. Verify that the container is healthy and running:
   ```bash
   docker-compose ps
   ```

3. View live access and application logs:
   ```bash
   docker-compose logs -f
   ```

4. Open the application in your browser:
   ```text
   http://localhost:5000
   ```

5. Stop the container when finished:
   ```bash
   docker-compose down
   ```

### Option 2: Using the Docker CLI Directly

1. Build the Docker image:
   ```bash
   docker build -t smart-campus-robot:latest .
   ```

2. Run the container:
   ```bash
   docker run -d --name robo-campus-3d -p 5000:5000 --restart unless-stopped smart-campus-robot:latest
   ```

3. Stop / Remove container:
   ```bash
   docker stop robo-campus-3d && docker rm robo-campus-3d
   ```

---

## 4. Deploying to Cloud PaaS (Render / Railway / Heroku)

### Deploying to Render (Free Web Service)

1. Push your project code to a **GitHub** or **GitLab** repository.
2. Sign in to [Render.com](https://render.com).
3. Click **New + > Web Service**.
4. Select your repository.
5. Fill in the configuration:
   - **Name**: `smart-campus-delivery-robot-3d`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app --workers 2 --threads 4`
   - **Plan**: `Free`
6. Click **Deploy Web Service**.
7. Your app will be live at `https://<your-app-name>.onrender.com`.

*(Alternatively, connect your repository and Render will automatically detect `render.yaml`).*

---

### Deploying to Railway.app

1. Sign in to [Railway.app](https://railway.app).
2. Click **New Project > Deploy from GitHub repo**.
3. Select your repository.
4. Railway detects the `Dockerfile` or `requirements.txt` + `Procfile` automatically.
5. Go to **Settings > Networking > Generate Domain** to get your public HTTPS URL.

---

### Deploying to Heroku

1. Log in to the Heroku CLI:
   ```bash
   heroku login
   ```
2. Create a new Heroku application:
   ```bash
   heroku create smart-campus-robot-3d
   ```
3. Deploy via Git:
   ```bash
   git push heroku main
   ```
4. Open the live app:
   ```bash
   heroku open
   ```

---

## 5. Deploying to Serverless / Static Hosts

### Vercel
1. Install Vercel CLI: `npm install -g vercel` or link your GitHub repo on [Vercel.com](https://vercel.com).
2. Run `vercel` in the root folder.
3. Vercel utilizes `vercel.json` to route `/api/*` to the Python serverless function and static assets to the CDN edge network.

### GitHub Pages (Static Mode)
1. In your GitHub repository, navigate to **Settings > Pages**.
2. Select **Source: Deploy from a branch** (`main` / root).
3. Click **Save**. The standalone client-side engine will execute directly on GitHub Pages!

---

## 6. Production Linux VPS (Ubuntu + Nginx + Gunicorn + SSL)

Follow this recipe to deploy on a dedicated Linux VPS (AWS EC2, DigitalOcean Droplet, Linode, Hetzner, etc.).

### Step 1: System Updates & Dependencies
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv nginx git certbot python3-certbot-nginx
```

### Step 2: Clone & Setup Environment
```bash
cd /var/www
sudo git clone <YOUR_GIT_REPO_URL> campus-robot
sudo chown -R $USER:$USER /var/www/campus-robot
cd /var/www/campus-robot

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 3: Create a Systemd Service File
Create `/etc/systemd/system/campus-robot.service`:
```ini
[Unit]
Description=Gunicorn instance to serve Smart Campus Robot 3D
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/var/www/campus-robot
Environment="PATH=/var/www/campus-robot/venv/bin"
Environment="PORT=5000"
Environment="FLASK_ENV=production"
ExecStart=/var/www/campus-robot/venv/bin/gunicorn --workers 3 --threads 4 --bind 127.0.0.1:5000 app:app

[Install]
WantedBy=multi-user.target
```

Start and enable the service:
```bash
sudo systemctl daemon-reload
sudo systemctl start campus-robot
sudo systemctl enable campus-robot
sudo systemctl status campus-robot
```

### Step 4: Configure Nginx Reverse Proxy
Create `/etc/nginx/sites-available/campus-robot`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

Enable the configuration and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/campus-robot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 5: Enable Free SSL with Let's Encrypt
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 7. Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | HTTP port the server binds to |
| `FLASK_ENV` | `production` | Set to `development` for hot reload |
| `PYTHONUNBUFFERED` | `1` | Ensures real-time console log streaming |

---

## 8. Health Check & Verification

Test if the deployed server is responding:

```bash
curl -i http://localhost:5000/api/health
```

Expected JSON response:
```json
{
  "status": "healthy",
  "system": "Smart Campus Delivery Robot 3D Pathfinding Engine",
  "algorithms": ["astar", "greedy", "dijkstra"],
  "heuristics": ["manhattan", "euclidean", "chebyshev"],
  "version": "1.0.0"
}
```

---

## 9. Troubleshooting & FAQs

### Q1: The 3D canvas is completely black or WebGL is not rendering.
- Ensure your browser has **Hardware Acceleration** enabled in settings.
- Verify your graphics drivers are up to date.
- Open browser developer tools (`F12` > Console) to inspect any WebGL security restrictions.

### Q2: Flask backend shows "Connection Refused" or offline status.
- The UI will automatically fall back to the built-in JavaScript pathfinding engine with zero user disruption.
- To use the Python server, verify that `python app.py` is actively running in a terminal.

### Q3: How do I change the default grid dimensions or number of floors?
- In `app.py`, update `DEFAULT_GRID = {"width": 16, "depth": 16, "height": 4}`.
- In `script.js`, update `GRID_CONFIG = { width: 16, depth: 16, height: 4 }`.

---

🎉 **Your Smart Campus Delivery Robot 3D simulation is now deployed and ready for AI demonstrations!**
