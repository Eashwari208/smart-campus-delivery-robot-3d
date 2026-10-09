# 📋 Project Requirements Document (PRD)

## Project Title
**Smart Campus Delivery Robot Simulation — 3D Multi-Floor Grid Edition**

---

## 1. Executive Summary
This project implements an intelligent autonomous delivery robot simulation operating in a 3D campus environment composed of multiple floors, staircases, ramps, and elevator shafts. The system demonstrates classical Artificial Intelligence search algorithms (**A\* Search**, **Greedy Best-First Search**, and **Dijkstra's Algorithm**) alongside **Dynamic Real-Time Replanning** when unanticipated obstacles block the delivery path mid-transit.

---

## 2. Functional Requirements

### 2.1 3D Multi-Floor Graph Environment
- **Grid Addressing**: 3-axis coordinates $(x, y, z)$ where $x \in [0, W-1]$, $y \in [0, D-1]$, $z \in [0, H-1]$ ($z$ = floor level).
- **6-Directional Graph Connectivity**: Moves in $\pm X$, $\pm Y$, and $\pm Z$.
- **Vertical Constraints**:
  - Horizontal moves are unrestricted on open floor cells.
  - Vertical transitions are permitted exclusively on designated **Ramp**, **Stairs**, or **Elevator** cells.
- **Cost Weights**:
  - Horizontal traversal: 1.0 unit
  - Ramp traversal: 2.0 units
  - Stairs traversal: 2.5 units
  - Elevator travel: 1.0 unit per floor

### 2.2 Pathfinding & Search Algorithms
- **A\* Search**:
  - Evaluation: $f(n) = g(n) + h(n)$
  - Admissible 3D Manhattan Heuristic: $h(n) = |x_n - x_g| + |y_n - y_g| + |z_n - z_g| \times W_{\text{vert}}$
  - Min-heap priority queue implementation for optimal $O((V+E)\log V)$ time complexity.
- **Greedy Best-First Search**:
  - Evaluation: $f(n) = h(n)$
  - Aggressive goal-oriented exploration.
- **Dijkstra's Algorithm (Uniform Cost Search)**:
  - Evaluation: $f(n) = g(n)$
  - Optimal baseline demonstrating heuristic efficiency gains.

### 2.3 Dynamic Real-Time Replanning
- Detect path obstructions while the robot is in transit.
- Halt robot, trigger audio-visual collision alerts, capture current 3D position $(x_c, y_c, z_c)$, recompute optimal detour to $(x_g, y_g, z_g)$, and resume navigation seamlessly.

### 2.4 Interactive 3D WebGL Visualization
- Orbit, Isometric, Top 2D, and Follow camera modes.
- Multi-floor Layer Slicer with ghost transparency for non-selected floors.
- Animated 3D robot model with spinning LiDAR sensor and rolling wheels.
- Real-time display of explored nodes, open frontier, and optimal path.

### 2.5 Metrics & Benchmarking
- Live KPI dashboard tracking nodes explored, path length, total energy cost, calculation latency (ms), and floor changes.
- Side-by-side benchmark comparison modal.

---

## 3. Non-Functional Requirements
- **Performance**: Path computation latency $< 10\,\text{ms}$ on standard $16 \times 16 \times 4$ campus grids.
- **Portability**: Containerized with Docker and deployable across Linux, macOS, and Windows.
- **Zero-Dependency Fallback**: Standalone client-side execution in any browser if Python backend is offline.
- **Aesthetics**: Glassmorphism, cyber dark theme, responsive layout, and Web Audio API synthesized sound FX.
