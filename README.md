# 🤖 Smart Campus Delivery Robot Simulation — 3D Grid Edition

[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://www.python.org/)
[![Flask 3.0](https://img.shields.io/badge/Flask-3.0-green.svg)](https://palletsprojects.com/p/flask/)
[![Three.js r128](https://img.shields.io/badge/Three.js-WebGL%203D-black.svg)](https://threejs.org/)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An interactive Artificial Intelligence pathfinding simulation demonstrating **A\* Search**, **Greedy Best-First Search**, and **Dynamic Real-Time Replanning** for an autonomous delivery robot navigating a **three-dimensional multi-floor campus grid** (floors, ramps, stairs, and elevator shafts) rendered in the browser with **Three.js**.

---

## 🌟 Key Features

- **3D Heuristic Pathfinding Algorithms**:
  - **A\* Search ($f(n) = g(n) + h(n)$)**: Guarantees the shortest path using path cost and the 3D Manhattan distance heuristic:
    $$h(n) = |x_1 - x_2| + |y_1 - y_2| + |z_1 - z_2| \times W_{\text{vert}}$$
  - **Greedy Best-First Search ($f(n) = h(n)$)**: Explores rapidly toward the goal using heuristic distance alone (fast, but not guaranteed optimal).
  - **Dijkstra's Algorithm ($f(n) = g(n)$)**: Uniform-cost search baseline for benchmark comparisons.
- **Full 3D Multi-Floor Grid Model**:
  - Every cell is addressed by `(x, y, z)` coordinates, where `z` is the floor/altitude level.
  - **6-directional movement** ($\pm X, \pm Y, \pm Z$), with vertical moves allowed only on **ramps, stairs, or elevator cells**.
  - Configurable vertical climb energy penalties to model battery expenditure.
- **Dynamic Real-Time Replanning**:
  - Inject unexpected obstacles (pedestrians, maintenance blocks, closed elevators) on any floor while the robot is moving.
  - Automatic detection of a blocked route and instant recalculation from the robot's current 3D position.
- **Preset Campus Scenarios**:
  1. **Library to Dorms** (Multi-floor express routing)
  2. **Cafeteria Rush** (Crowded dynamic paths and real-time reroutes)
  3. **Construction Maze** (Vertical detours around blocked floors)
  4. **Rooftop Delivery** (Elevator-only medical sky-deck delivery)
  5. **Double Spiral Tower** (Helical ramp shortcuts)
- **Interactive 3D Visualization**:
  - Orbit, Pan, Zoom, Isometric, Top-Down 2D Blueprint, and Robot Follow / Chase Cam.
  - **Layer Slicer** to isolate a single floor ($z$) or view all floors at once with ghost transparency.
  - Colour-coded volumetric cells for explored nodes, frontier nodes, and the final glowing path.
  - Detailed 3D delivery robot model with spinning LiDAR dome, rolling wheels, and cargo compartment.
- **Dual-Engine Full-Stack Flexibility**:
  - Python Flask backend with RESTful 3D pathfinding endpoints (`/api/navigate`, `/api/replan`, `/api/compare`).
  - Standalone client-side fallback mode in JavaScript running 100% in the browser if offline.
- **Live Metrics & Sound Effects**:
  - Nodes explored, path length, total cost, floors traversed, computation time, battery gauge, and live event log.
  - Built-in Web Audio API synthesizer for robotic sound FX, hazard sirens, and delivery chimes.

---

## 🧠 How the 3D Search Works

| Concept | 2D Classical Grid | 3D Campus Grid |
|---|---|---|
| **Cell coordinate** | `(row, col)` | `(x, y, z)` where $z$ = Floor Level |
| **Neighbours** | 4 (N, S, E, W) | 6 (N, S, E, W, Up, Down) |
| **Heuristic Function** | 2D Manhattan ($|\Delta x| + |\Delta y|$) | 3D Manhattan ($|\Delta x| + |\Delta y| + |\Delta z| \cdot W_v$) |
| **Vertical movement** | N/A | Only on Ramp / Stairs / Elevator cells |
| **Rendering** | 2D HTML Canvas | Three.js WebGL 3D Scene |
| **Search space** | $R \times C$ | $X \times Y \times Z$ |

### Cell Types & Movement Costs

| Type | Description | Passable | Move Cost |
|---|---|---|---|
| **Free Floor** | Normal walkable corridor | ✅ | 1.0 |
| **Wall / Obstacle** | Building walls, structural pillars | ❌ | $\infty$ |
| **Ramp** | Connects floor $z$ to $z \pm 1$ | ✅ (Vertical) | 2.0 (Climb Energy) |
| **Stairs** | Connects floor $z$ to $z \pm 1$ | ✅ (Vertical) | 2.5 (Climb Energy) |
| **Elevator** | Connects multi-floor shaft $(x,y,z) \leftrightarrow (x,y,z')$ | ✅ (Vertical) | 1.0 per floor |
| **Dynamic Hazard** | Spawned at runtime (pedestrian / cart) | ❌ | $\infty$ |
| **Start / Goal** | Robot origin and parcel target | ✅ | 1.0 |

---

## 📁 Project Structure

```text
smart-campus-delivery-robot-3d/
├── app.py                  # Python Flask server & 3D AI algorithm backend
├── index.html              # Main user interface & 3D WebGL viewport
├── script.js               # Three.js rendering, client-side 3D AI engine, UI controller
├── style.css               # Modern glassmorphic cyber dark-mode theme
├── requirements.txt        # Python package dependencies (Flask, CORS, Gunicorn)
├── Dockerfile              # Production multi-worker Docker image
├── docker-compose.yml      # One-click container orchestration
├── render.yaml             # Render.com PaaS configuration
├── vercel.json             # Vercel serverless configuration
├── Procfile                # Heroku / Railway web process entrypoint
├── DEPLOYMENT_GUIDE.md     # Complete multi-platform deployment guide
├── PRD.md                  # Project Requirements Document
└── README.md               # Main project documentation
```

---

## ⚡ Quick Start (Run in 60 Seconds)

### Option 1: Python Flask Server
```powershell
# 1. Navigate to project
cd smart-campus-delivery-robot-3d

# 2. Create virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1   # (On Mac/Linux: source venv/bin/activate)

# 3. Install requirements
pip install -r requirements.txt

# 4. Start application
python app.py
```
Open **`http://localhost:5000`** in your browser.

---

### Option 2: Docker & Docker Compose
```bash
docker-compose up -d --build
```
Open **`http://localhost:5000`** in your browser.

---

### Option 3: Zero-Install Static Browser Run
Simply double-click **`index.html`** or launch with **VS Code Live Server**. The built-in JavaScript 3D AI engine will execute client-side with full functionality!

---

## 🎮 How to Use the Simulation

### Camera Controls
- **Rotate View**: Left-click + drag
- **Pan View**: Right-click + drag
- **Zoom**: Mouse wheel / pinch
- **Reset Camera**: Press <kbd>R</kbd> or click the Camera button in the top navbar.

### Simulation Workflow
1. **Choose Algorithm**: Select **A\*** (Optimal), **Greedy Best-First** (Fast), or **Dijkstra** (UCS) in the left panel.
2. **Select Floor Layer**: Use the **Layer Slicer** buttons (`All`, `F3`, `F2`, `F1`, `F0`) to focus on specific floors.
3. **Customize Grid**: Use brush tools (`Start`, `Goal`, `Wall`, `Ramp`, `Elevator`, `Hazard`, `Eraser`) to draw directly on the 3D floor slabs.
4. **Calculate Route**: Click **"Calculate Route"** to observe node exploration and the optimal 3D path.
5. **Start Delivery**: Click **"Start Delivery"** to watch the robot navigate floors, climb ramps, and take elevators.
6. **Test Dynamic Replanning**: While the robot is moving, click **"Drop Obstacle Ahead of Robot"** or click on any waypoint ahead. Observe real-time path recovery!

---

## 🔌 API Reference

### `POST /api/navigate`
Computes an optimal path on a 3D campus grid.

**Request Payload**
```json
{
  "algorithm": "astar",
  "heuristic": "manhattan",
  "vertical_weight": 1.5,
  "grid_size": { "x": 16, "y": 16, "z": 4 },
  "start": { "x": 1, "y": 1, "z": 0 },
  "goal": { "x": 14, "y": 14, "z": 3 },
  "obstacles": [{ "x": 4, "y": 2, "z": 0 }],
  "dynamic_obstacles": [],
  "connectors": [
    { "x": 8, "y": 7, "z": 0, "type": "elevator", "to_z": 3 },
    { "x": 12, "y": 4, "z": 0, "type": "ramp" }
  ]
}
```

**Response**
```json
{
  "found": true,
  "algorithm": "ASTAR",
  "path": [
    { "x": 1, "y": 1, "z": 0, "action": "Start", "cost_so_far": 0.0, "step_index": 0 },
    { "x": 2, "y": 1, "z": 0, "action": "Move East", "cost_so_far": 1.0, "step_index": 1 }
  ],
  "explored": [...],
  "nodes_explored": 142,
  "path_length": 28,
  "total_cost": 32.5,
  "floors_traversed": 3,
  "vertical_energy": 4.5,
  "time_ms": 2.15
}
```

---

### `POST /api/replan`
Recomputes the remaining route from the robot's current position when new dynamic obstacles appear.

**Request Payload**
```json
{
  "algorithm": "astar",
  "current": { "x": 6, "y": 4, "z": 1 },
  "goal": { "x": 14, "y": 14, "z": 3 },
  "new_obstacles": [{ "x": 7, "y": 4, "z": 1 }]
}
```

---

### `POST /api/compare`
Runs A\*, Greedy Best-First, and Dijkstra simultaneously on the active grid and returns side-by-side benchmark metrics.

---

## 📊 Algorithm Benchmark Comparison

| Metric | A\* Search | Greedy Best-First | Dijkstra (UCS) |
|---|---|---|---|
| **Evaluation Function** | $f(n) = g(n) + h(n)$ | $f(n) = h(n)$ | $f(n) = g(n)$ |
| **Path Optimality** | ✅ **Guaranteed Optimal** | ❌ Suboptimal (Heuristic greedy) | ✅ **Guaranteed Optimal** |
| **Nodes Explored** | Moderate (Guided by cost + heuristic) | Minimal (Direct beeline) | High (Exhaustive wavefront) |
| **Computation Speed** | Fast ($\approx 1\text{--}4\,\text{ms}$) | Ultra-Fast ($\approx 0.5\text{--}1\,\text{ms}$) | Slower ($\approx 4\text{--}15\,\text{ms}$) |
| **Best Used For** | Standard autonomous delivery | Rapid approximate path discovery | Uniform unguided exploration |

---

## 🛠️ Tech Stack

- **Backend**: Python 3.9+, Flask, Flask-CORS, Gunicorn
- **Frontend**: HTML5, Vanilla CSS3 (Glassmorphism, Cyber Dark Theme), JavaScript (ES6+)
- **3D Graphics**: Three.js (WebGL), OrbitControls
- **Sound Engine**: Web Audio API (Zero external audio asset footprint)
- **DevOps**: Docker, Docker Compose, Gunicorn Multi-Worker Server

---

## 📄 License
This project is licensed under the MIT License — free for academic, personal, and commercial demonstration.
