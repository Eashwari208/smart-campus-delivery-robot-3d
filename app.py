"""
Smart Campus Delivery Robot Simulation — 3D Grid Edition
Python Flask Backend & 3D AI Pathfinding Algorithms
Supports A* Search, Greedy Best-First Search, and Dynamic Real-Time Replanning
"""

import time
import math
import heapq
import os
from typing import Dict, List, Tuple, Optional, Any, Set
from flask import Flask, request, jsonify, send_from_directory, render_template

# Initialize Flask application
app = Flask(__name__, static_folder="static", template_folder="templates")

# Enable CORS for development and cross-origin embedding if needed
try:
    from flask_cors import CORS
    CORS(app)
except ImportError:
    pass

# ==============================================================================
# 3D Grid Models & Constants
# ==============================================================================

CELL_FREE = 0
CELL_WALL = 1
CELL_RAMP = 2
CELL_ELEVATOR = 3
CELL_STAIRS = 4
CELL_DYNAMIC_OBSTACLE = 5

DEFAULT_GRID = {
    "width": 16,
    "depth": 16,
    "height": 4  # 4 Floors: z=0, 1, 2, 3
}

# Energy and move costs
COST_HORIZONTAL = 1.0
COST_RAMP = 2.0
COST_STAIRS = 2.5
COST_ELEVATOR_PER_FLOOR = 1.0

# 6-directional base offsets (N, S, E, W, Up, Down)
DIRECTIONS_HORIZONTAL = [
    (1, 0, 0, "East"),
    (-1, 0, 0, "West"),
    (0, 1, 0, "North"),
    (0, -1, 0, "South"),
]


def manhattan_3d(p1: Tuple[int, int, int], p2: Tuple[int, int, int], vertical_weight: float = 1.5) -> float:
    """Calculates 3D Manhattan distance with optional vertical weight."""
    dx = abs(p1[0] - p2[0])
    dy = abs(p1[1] - p2[1])
    dz = abs(p1[2] - p2[2])
    return float(dx + dy + dz * vertical_weight)


def euclidean_3d(p1: Tuple[int, int, int], p2: Tuple[int, int, int], vertical_weight: float = 1.5) -> float:
    """Calculates 3D Euclidean distance."""
    dx = p1[0] - p2[0]
    dy = p1[1] - p2[1]
    dz = (p1[2] - p2[2]) * vertical_weight
    return float(math.sqrt(dx * dx + dy * dy + dz * dz))


def chebyshev_3d(p1: Tuple[int, int, int], p2: Tuple[int, int, int], vertical_weight: float = 1.5) -> float:
    """Calculates 3D Chebyshev distance."""
    dx = abs(p1[0] - p2[0])
    dy = abs(p1[1] - p2[1])
    dz = abs(p1[2] - p2[2]) * vertical_weight
    return float(max(dx, dy, dz))


def get_heuristic_fn(name: str):
    name = (name or "manhattan").lower()
    if "euclid" in name:
        return euclidean_3d
    elif "chebyshev" in name:
        return chebyshev_3d
    return manhattan_3d


# ==============================================================================
# 3D Campus Grid Graph Representation
# ==============================================================================

class CampusGrid3D:
    def __init__(self, width: int = 16, depth: int = 16, height: int = 4):
        self.width = width
        self.depth = depth
        self.height = height
        
        # Grid state maps (x, y, z) -> cell_type
        self.cells: Dict[Tuple[int, int, int], int] = {}
        
        # Connectors:
        # Ramps: (x, y, z) -> target (x, y, z_next) or list of connections
        # Elevators: (x, y) -> set of connected floors z
        self.ramps: Set[Tuple[int, int, int]] = set()
        self.elevators: Dict[Tuple[int, int], Set[int]] = {}
        self.stairs: Set[Tuple[int, int, int]] = set()
        self.obstacles: Set[Tuple[int, int, int]] = set()
        self.dynamic_obstacles: Set[Tuple[int, int, int]] = set()

    def in_bounds(self, pos: Tuple[int, int, int]) -> bool:
        x, y, z = pos
        return 0 <= x < self.width and 0 <= y < self.depth and 0 <= z < self.height

    def is_passable(self, pos: Tuple[int, int, int]) -> bool:
        if not self.in_bounds(pos):
            return False
        if pos in self.obstacles or pos in self.dynamic_obstacles:
            return False
        return True

    def get_neighbors(self, current: Tuple[int, int, int], vertical_weight: float = 1.0) -> List[Tuple[Tuple[int, int, int], float, str]]:
        """
        Returns list of (neighbor_pos, move_cost, action_name).
        Horizontal moves are always tested on current floor z.
        Vertical moves are ONLY allowed if current cell is a Ramp, Stairs, or Elevator.
        """
        cx, cy, cz = current
        neighbors: List[Tuple[Tuple[int, int, int], float, str]] = []

        # 1. Horizontal Movements (±X, ±Y on same floor cz)
        for dx, dy, dz, label in DIRECTIONS_HORIZONTAL:
            nx, ny, nz = cx + dx, cy + dy, cz
            npos = (nx, ny, nz)
            if self.is_passable(npos):
                neighbors.append((npos, COST_HORIZONTAL, f"Move {label}"))

        # 2. Ramp / Stairs Movements (Connects to cz+1 and cz-1)
        if current in self.ramps or self.cells.get(current) == CELL_RAMP:
            # Check upward ramp
            if cz + 1 < self.height:
                up_pos = (cx, cy, cz + 1)
                if self.is_passable(up_pos):
                    neighbors.append((up_pos, COST_RAMP * vertical_weight, "Climb Ramp Up"))
            # Check downward ramp
            if cz - 1 >= 0:
                down_pos = (cx, cy, cz - 1)
                if self.is_passable(down_pos):
                    neighbors.append((down_pos, COST_RAMP * vertical_weight, "Descend Ramp Down"))

        if current in self.stairs or self.cells.get(current) == CELL_STAIRS:
            if cz + 1 < self.height:
                up_pos = (cx, cy, cz + 1)
                if self.is_passable(up_pos):
                    neighbors.append((up_pos, COST_STAIRS * vertical_weight, "Climb Stairs Up"))
            if cz - 1 >= 0:
                down_pos = (cx, cy, cz - 1)
                if self.is_passable(down_pos):
                    neighbors.append((down_pos, COST_STAIRS * vertical_weight, "Descend Stairs Down"))

        # 3. Elevator Movements (Connects to all elevator shafts at (cx, cy))
        shaft_floors = self.elevators.get((cx, cy), set())
        if current in self.cells and self.cells[current] == CELL_ELEVATOR:
            # If marked as elevator cell, allow vertical lift to other elevator floors at (cx, cy)
            for target_z in range(self.height):
                if target_z != cz:
                    elev_pos = (cx, cy, target_z)
                    if self.is_passable(elev_pos):
                        floor_diff = abs(target_z - cz)
                        elev_cost = (floor_diff * COST_ELEVATOR_PER_FLOOR) * vertical_weight
                        direction = "Up" if target_z > cz else "Down"
                        neighbors.append((elev_pos, elev_cost, f"Elevator {direction} (Floor {target_z})"))

        return neighbors

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CampusGrid3D":
        grid_size = data.get("grid_size", {})
        width = int(grid_size.get("x", DEFAULT_GRID["width"]))
        depth = int(grid_size.get("y", DEFAULT_GRID["depth"]))
        height = int(grid_size.get("z", DEFAULT_GRID["height"]))

        grid = cls(width=width, depth=depth, height=height)

        # Parse static obstacles
        for obs in data.get("obstacles", []):
            pos = (int(obs["x"]), int(obs["y"]), int(obs["z"]))
            if grid.in_bounds(pos):
                grid.obstacles.add(pos)
                grid.cells[pos] = CELL_WALL

        # Parse dynamic obstacles
        for obs in data.get("dynamic_obstacles", []):
            pos = (int(obs["x"]), int(obs["y"]), int(obs["z"]))
            if grid.in_bounds(pos):
                grid.dynamic_obstacles.add(pos)
                grid.cells[pos] = CELL_DYNAMIC_OBSTACLE

        # Parse connectors (ramps, elevators, stairs)
        for conn in data.get("connectors", []):
            ctype = conn.get("type", "ramp").lower()
            x = int(conn["x"])
            y = int(conn["y"])
            z = int(conn.get("z", 0))
            pos = (x, y, z)

            if not grid.in_bounds(pos):
                continue

            if ctype == "ramp":
                grid.ramps.add(pos)
                grid.cells[pos] = CELL_RAMP
            elif ctype == "stairs":
                grid.stairs.add(pos)
                grid.cells[pos] = CELL_STAIRS
            elif ctype == "elevator":
                # Elevators can span multiple floors
                to_z = int(conn.get("to_z", grid.height - 1))
                shaft = set(range(min(z, to_z), max(z, to_z) + 1))
                if (x, y) not in grid.elevators:
                    grid.elevators[(x, y)] = set()
                grid.elevators[(x, y)].update(shaft)
                for floor_z in shaft:
                    epos = (x, y, floor_z)
                    grid.cells[epos] = CELL_ELEVATOR

        return grid


# ==============================================================================
# Pathfinding Search Solvers (A*, Greedy Best-First, Dijkstra)
# ==============================================================================

class PathfindingResult:
    def __init__(self):
        self.found: bool = False
        self.path: List[Dict[str, Any]] = []
        self.explored_order: List[Dict[str, Any]] = []
        self.nodes_explored: int = 0
        self.frontier_peak: int = 0
        self.path_length: int = 0
        self.total_cost: float = 0.0
        self.floors_traversed: int = 0
        self.vertical_energy: float = 0.0
        self.time_ms: float = 0.0
        self.algorithm_name: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "found": self.found,
            "algorithm": self.algorithm_name,
            "path": self.path,
            "explored": self.explored_order,
            "nodes_explored": self.nodes_explored,
            "frontier_peak": self.frontier_peak,
            "path_length": self.path_length,
            "total_cost": round(self.total_cost, 2),
            "floors_traversed": self.floors_traversed,
            "vertical_energy": round(self.vertical_energy, 2),
            "time_ms": round(self.time_ms, 3)
        }


def reconstruct_path(
    came_from: Dict[Tuple[int, int, int], Tuple[Optional[Tuple[int, int, int]], str, float]],
    start: Tuple[int, int, int],
    goal: Tuple[int, int, int]
) -> Tuple[List[Dict[str, Any]], float, int, float]:
    path: List[Dict[str, Any]] = []
    curr: Optional[Tuple[int, int, int]] = goal
    total_cost = 0.0
    floors_traversed = 0
    vertical_energy = 0.0

    raw_nodes = []
    while curr is not None:
        raw_nodes.append(curr)
        parent_info = came_from.get(curr)
        if parent_info is None:
            break
        parent, action, step_cost = parent_info
        if parent is not None:
            if abs(curr[2] - parent[2]) > 0:
                floors_traversed += abs(curr[2] - parent[2])
                vertical_energy += step_cost
        curr = parent

    raw_nodes.reverse()

    accumulated = 0.0
    for i, node in enumerate(raw_nodes):
        action_name = "Start Position" if i == 0 else "Traverse"
        if i > 0:
            prev_node = raw_nodes[i - 1]
            parent_info = came_from.get(node)
            if parent_info:
                action_name = parent_info[1]
                accumulated += parent_info[2]
        
        path.append({
            "x": node[0],
            "y": node[1],
            "z": node[2],
            "action": action_name,
            "cost_so_far": round(accumulated, 2),
            "step_index": i
        })

    total_cost = accumulated
    return path, total_cost, floors_traversed, vertical_energy


def run_3d_search(
    grid: CampusGrid3D,
    start: Tuple[int, int, int],
    goal: Tuple[int, int, int],
    algorithm: str = "astar",
    heuristic_name: str = "manhattan",
    vertical_weight: float = 1.5,
    max_steps: int = 15000
) -> PathfindingResult:
    """
    Executes 3D Pathfinding search on CampusGrid3D.
    Supports:
      - 'astar': f(n) = g(n) + h(n) (Guaranteed optimal)
      - 'greedy': f(n) = h(n) (Rapid heuristic exploration)
      - 'dijkstra': f(n) = g(n) (Uniform Cost Search)
    """
    result = PathfindingResult()
    result.algorithm_name = algorithm.upper()

    t_start = time.perf_counter()

    if not grid.is_passable(start) or not grid.is_passable(goal):
        result.time_ms = (time.perf_counter() - t_start) * 1000.0
        return result

    if start == goal:
        result.found = True
        result.path = [{"x": start[0], "y": start[1], "z": start[2], "action": "Start & Goal", "cost_so_far": 0.0, "step_index": 0}]
        result.path_length = 1
        result.time_ms = (time.perf_counter() - t_start) * 1000.0
        return result

    h_fn = get_heuristic_fn(heuristic_name)

    # Priority Queue: (f_score, tie_breaker_h, counter, current_node)
    open_heap: List[Tuple[float, float, int, Tuple[int, int, int]]] = []
    entry_counter = 0

    # g_score maps node -> lowest cost from start
    g_score: Dict[Tuple[int, int, int], float] = {start: 0.0}
    # came_from maps node -> (parent_node, action, step_cost)
    came_from: Dict[Tuple[int, int, int], Tuple[Optional[Tuple[int, int, int]], str, float]] = {
        start: (None, "Start", 0.0)
    }

    initial_h = h_fn(start, goal, vertical_weight)
    initial_f = initial_h if algorithm == "greedy" else (0.0 if algorithm == "dijkstra" else initial_h)

    heapq.heappush(open_heap, (initial_f, initial_h, entry_counter, start))
    open_set_tracker: Set[Tuple[int, int, int]] = {start}
    closed_set: Set[Tuple[int, int, int]] = set()

    step_counter = 0

    while open_heap and step_counter < max_steps:
        result.frontier_peak = max(result.frontier_peak, len(open_heap))
        current_f, current_h, _, current = heapq.heappop(open_heap)
        
        if current in open_set_tracker:
            open_set_tracker.remove(current)

        if current in closed_set:
            continue

        closed_set.add(current)
        step_counter += 1

        curr_g = g_score.get(current, float('inf'))
        result.explored_order.append({
            "x": current[0],
            "y": current[1],
            "z": current[2],
            "g": round(curr_g, 2),
            "h": round(current_h, 2),
            "f": round(current_f, 2),
            "step": step_counter
        })

        # Goal check
        if current == goal:
            result.found = True
            break

        for neighbor, move_cost, action_name in grid.get_neighbors(current, vertical_weight):
            if neighbor in closed_set:
                continue

            tentative_g = curr_g + move_cost

            if tentative_g < g_score.get(neighbor, float('inf')):
                came_from[neighbor] = (current, action_name, move_cost)
                g_score[neighbor] = tentative_g
                h_val = h_fn(neighbor, goal, vertical_weight)

                if algorithm == "greedy":
                    f_val = h_val
                elif algorithm == "dijkstra":
                    f_val = tentative_g
                else:  # A* Search
                    f_val = tentative_g + h_val

                entry_counter += 1
                heapq.heappush(open_heap, (f_val, h_val, entry_counter, neighbor))
                open_set_tracker.add(neighbor)

    t_end = time.perf_counter()
    result.time_ms = (t_end - t_start) * 1000.0
    result.nodes_explored = len(closed_set)

    if result.found:
        path, cost, floors, energy = reconstruct_path(came_from, start, goal)
        result.path = path
        result.path_length = len(path)
        result.total_cost = cost
        result.floors_traversed = floors
        result.vertical_energy = energy

    return result


# ==============================================================================
# Built-in Preset Campus Scenarios
# ==============================================================================

CAMPUS_SCENARIOS = {
    "library_to_dorms": {
        "id": "library_to_dorms",
        "name": "Library to Student Dorms (Multi-Floor Express)",
        "description": "Multi-floor navigation from Ground Floor Library to 3rd Floor Dorm Sky-Lounge via stairs & elevator shaft.",
        "grid_size": {"x": 16, "y": 16, "z": 4},
        "start": {"x": 1, "y": 1, "z": 0},
        "goal": {"x": 14, "y": 14, "z": 3},
        "obstacles": [
            # Floor 0: Library bookshelves & study cubicles
            {"x": 4, "y": 2, "z": 0}, {"x": 4, "y": 3, "z": 0}, {"x": 4, "y": 4, "z": 0},
            {"x": 4, "y": 5, "z": 0}, {"x": 8, "y": 8, "z": 0}, {"x": 8, "y": 9, "z": 0},
            {"x": 8, "y": 10, "z": 0}, {"x": 9, "y": 8, "z": 0}, {"x": 10, "y": 8, "z": 0},
            # Floor 1: Engineering lab partitions
            {"x": 6, "y": 6, "z": 1}, {"x": 6, "y": 7, "z": 1}, {"x": 6, "y": 8, "z": 1},
            {"x": 7, "y": 6, "z": 1}, {"x": 8, "y": 6, "z": 1}, {"x": 11, "y": 3, "z": 1},
            # Floor 2: Smart classroom walls
            {"x": 5, "y": 10, "z": 2}, {"x": 6, "y": 10, "z": 2}, {"x": 7, "y": 10, "z": 2},
            {"x": 10, "y": 12, "z": 2}, {"x": 11, "y": 12, "z": 2},
            # Floor 3: Dorm hallway boundaries
            {"x": 12, "y": 10, "z": 3}, {"x": 12, "y": 11, "z": 3}, {"x": 12, "y": 12, "z": 3}
        ],
        "connectors": [
            # Central Elevator (All floors 0-3)
            {"x": 8, "y": 7, "z": 0, "type": "elevator", "to_z": 3},
            # East Ramp (Floor 0 -> 1)
            {"x": 12, "y": 4, "z": 0, "type": "ramp"},
            # West Ramp (Floor 1 -> 2)
            {"x": 3, "y": 11, "z": 1, "type": "ramp"},
            # North Ramp (Floor 2 -> 3)
            {"x": 10, "y": 13, "z": 2, "type": "ramp"}
        ],
        "dynamic_obstacles": []
    },
    "cafeteria_rush": {
        "id": "cafeteria_rush",
        "name": "Cafeteria Rush Hour (Crowded Dynamic Corridors)",
        "description": "High-density crowd and delivery carts randomly appearing on dining floor 0 and 1, triggering dynamic replans.",
        "grid_size": {"x": 16, "y": 16, "z": 4},
        "start": {"x": 0, "y": 2, "z": 0},
        "goal": {"x": 15, "y": 13, "z": 1},
        "obstacles": [
            {"x": 3, "y": 2, "z": 0}, {"x": 3, "y": 3, "z": 0}, {"x": 3, "y": 4, "z": 0},
            {"x": 7, "y": 0, "z": 0}, {"x": 7, "y": 1, "z": 0}, {"x": 7, "y": 2, "z": 0},
            {"x": 7, "y": 3, "z": 0}, {"x": 7, "y": 4, "z": 0}, {"x": 11, "y": 6, "z": 0},
            {"x": 11, "y": 7, "z": 0}, {"x": 11, "y": 8, "z": 0}, {"x": 11, "y": 9, "z": 0}
        ],
        "connectors": [
            {"x": 5, "y": 5, "z": 0, "type": "ramp"},
            {"x": 14, "y": 8, "z": 0, "type": "elevator", "to_z": 2}
        ],
        "dynamic_obstacles": [
            {"x": 4, "y": 5, "z": 0},
            {"x": 5, "y": 6, "z": 1}
        ]
    },
    "construction_maze": {
        "id": "construction_maze",
        "name": "Engineering Construction Maze (Vertical Detours)",
        "description": "Major hallway renovation on Floor 1 forces the robot to climb to Floor 2, traverse the sky-bridge, and descend back.",
        "grid_size": {"x": 16, "y": 16, "z": 4},
        "start": {"x": 2, "y": 2, "z": 0},
        "goal": {"x": 13, "y": 13, "z": 0},
        "obstacles": [
            # Heavy blockages across ground floor center
            {"x": 7, "y": 0, "z": 0}, {"x": 7, "y": 1, "z": 0}, {"x": 7, "y": 2, "z": 0},
            {"x": 7, "y": 3, "z": 0}, {"x": 7, "y": 4, "z": 0}, {"x": 7, "y": 5, "z": 0},
            {"x": 7, "y": 6, "z": 0}, {"x": 7, "y": 7, "z": 0}, {"x": 7, "y": 8, "z": 0},
            {"x": 7, "y": 9, "z": 0}, {"x": 7, "y": 10, "z": 0}, {"x": 7, "y": 11, "z": 0},
            {"x": 7, "y": 12, "z": 0}, {"x": 7, "y": 13, "z": 0}, {"x": 7, "y": 14, "z": 0},
            {"x": 7, "y": 15, "z": 0}
        ],
        "connectors": [
            # Ramp up on West side
            {"x": 4, "y": 4, "z": 0, "type": "ramp"},
            # Elevator up to Skybridge
            {"x": 4, "y": 12, "z": 1, "type": "ramp"},
            # Skybridge crosses over at Floor 2, Ramp down on East side
            {"x": 11, "y": 12, "z": 2, "type": "ramp"},
            {"x": 11, "y": 4, "z": 1, "type": "ramp"}
        ],
        "dynamic_obstacles": []
    },
    "rooftop_delivery": {
        "id": "rooftop_delivery",
        "name": "Rooftop Sky-Deck Delivery (Elevator-Only Access)",
        "description": "Urgent medicine delivery to rooftop medical helipad (Floor 3), strictly accessible only through high-speed elevator shafts.",
        "grid_size": {"x": 16, "y": 16, "z": 4},
        "start": {"x": 0, "y": 0, "z": 0},
        "goal": {"x": 15, "y": 15, "z": 3},
        "obstacles": [
            # Security checkpoints & perimeter walls
            {"x": 5, "y": 0, "z": 0}, {"x": 5, "y": 1, "z": 0}, {"x": 5, "y": 2, "z": 0},
            {"x": 10, "y": 10, "z": 3}, {"x": 10, "y": 11, "z": 3}, {"x": 10, "y": 12, "z": 3}
        ],
        "connectors": [
            # Main Glass Tower Elevator (0 -> 3)
            {"x": 8, "y": 8, "z": 0, "type": "elevator", "to_z": 3},
            # Secondary Freight Lift (0 -> 3)
            {"x": 2, "y": 14, "z": 0, "type": "elevator", "to_z": 3}
        ],
        "dynamic_obstacles": []
    }
}


# ==============================================================================
# Flask RESTful API Endpoints
# ==============================================================================

@app.route("/")
def index():
    """Serves the main single-page application interface."""
    return send_from_directory(".", "index.html")


@app.route("/<path:filename>")
def serve_static_root(filename):
    """Fallback static asset server for root files."""
    if os.path.exists(filename):
        return send_from_directory(".", filename)
    return "File not found", 404


@app.route("/api/health", methods=["GET"])
def health_check():
    """Returns backend system status and available algorithms."""
    return jsonify({
        "status": "healthy",
        "system": "Smart Campus Delivery Robot 3D Pathfinding Engine",
        "algorithms": ["astar", "greedy", "dijkstra"],
        "heuristics": ["manhattan", "euclidean", "chebyshev"],
        "version": "1.0.0",
        "timestamp": time.time()
    })


@app.route("/api/scenarios", methods=["GET"])
def get_scenarios():
    """Returns the list of preset campus scenarios."""
    return jsonify({
        "scenarios": list(CAMPUS_SCENARIOS.values())
    })


@app.route("/api/navigate", methods=["POST"])
def navigate():
    """
    Computes a 3D path from start to goal.
    Payload:
      {
        "algorithm": "astar" | "greedy" | "dijkstra",
        "heuristic": "manhattan" | "euclidean" | "chebyshev",
        "vertical_weight": 1.5,
        "grid_size": {"x": 16, "y": 16, "z": 4},
        "start": {"x": 0, "y": 0, "z": 0},
        "goal": {"x": 14, "y": 14, "z": 3},
        "obstacles": [{"x": 3, "y": 4, "z": 0}, ...],
        "dynamic_obstacles": [{"x": 5, "y": 5, "z": 1}, ...],
        "connectors": [{"x": 7, "y": 7, "z": 0, "type": "elevator", "to_z": 3}, ...]
      }
    """
    data = request.get_json(force=True, silent=True) or {}
    
    grid = CampusGrid3D.from_dict(data)
    
    start_raw = data.get("start", {"x": 0, "y": 0, "z": 0})
    goal_raw = data.get("goal", {"x": grid.width - 1, "y": grid.depth - 1, "z": grid.height - 1})

    start = (int(start_raw["x"]), int(start_raw["y"]), int(start_raw["z"]))
    goal = (int(goal_raw["x"]), int(goal_raw["y"]), int(goal_raw["z"]))

    algorithm = data.get("algorithm", "astar").lower()
    heuristic_name = data.get("heuristic", "manhattan").lower()
    vertical_weight = float(data.get("vertical_weight", 1.5))

    result = run_3d_search(
        grid=grid,
        start=start,
        goal=goal,
        algorithm=algorithm,
        heuristic_name=heuristic_name,
        vertical_weight=vertical_weight
    )

    return jsonify(result.to_dict())


@app.route("/api/replan", methods=["POST"])
def replan():
    """
    Real-time Dynamic Replanner.
    Called when unexpected obstacles spawn while robot is mid-transit.
    Recomputes path from robot's current position to goal.
    """
    data = request.get_json(force=True, silent=True) or {}
    
    grid = CampusGrid3D.from_dict(data)

    current_raw = data.get("current", data.get("start", {"x": 0, "y": 0, "z": 0}))
    goal_raw = data.get("goal", {"x": grid.width - 1, "y": grid.depth - 1, "z": grid.height - 1})

    current_pos = (int(current_raw["x"]), int(current_raw["y"]), int(current_raw["z"]))
    goal_pos = (int(goal_raw["x"]), int(goal_raw["y"]), int(goal_raw["z"]))

    # If new dynamic obstacles are passed in separately
    for obs in data.get("new_obstacles", []):
        pos = (int(obs["x"]), int(obs["y"]), int(obs["z"]))
        if grid.in_bounds(pos):
            grid.dynamic_obstacles.add(pos)
            grid.cells[pos] = CELL_DYNAMIC_OBSTACLE

    algorithm = data.get("algorithm", "astar").lower()
    heuristic_name = data.get("heuristic", "manhattan").lower()
    vertical_weight = float(data.get("vertical_weight", 1.5))

    result = run_3d_search(
        grid=grid,
        start=current_pos,
        goal=goal_pos,
        algorithm=algorithm,
        heuristic_name=heuristic_name,
        vertical_weight=vertical_weight
    )

    response_data = result.to_dict()
    response_data["replan_triggered"] = True
    response_data["current_position"] = {"x": current_pos[0], "y": current_pos[1], "z": current_pos[2]}

    return jsonify(response_data)


@app.route("/api/compare", methods=["POST"])
def compare_algorithms():
    """
    Benchmark comparison endpoint: Runs A*, Greedy BFS, and Dijkstra on the same grid configuration.
    """
    data = request.get_json(force=True, silent=True) or {}
    grid = CampusGrid3D.from_dict(data)

    start_raw = data.get("start", {"x": 0, "y": 0, "z": 0})
    goal_raw = data.get("goal", {"x": grid.width - 1, "y": grid.depth - 1, "z": grid.height - 1})
    start = (int(start_raw["x"]), int(start_raw["y"]), int(start_raw["z"]))
    goal = (int(goal_raw["x"]), int(goal_raw["y"]), int(goal_raw["z"]))
    heuristic_name = data.get("heuristic", "manhattan").lower()
    vertical_weight = float(data.get("vertical_weight", 1.5))

    res_astar = run_3d_search(grid, start, goal, "astar", heuristic_name, vertical_weight)
    res_greedy = run_3d_search(grid, start, goal, "greedy", heuristic_name, vertical_weight)
    res_dijkstra = run_3d_search(grid, start, goal, "dijkstra", heuristic_name, vertical_weight)

    return jsonify({
        "astar": res_astar.to_dict(),
        "greedy": res_greedy.to_dict(),
        "dijkstra": res_dijkstra.to_dict()
    })


# ==============================================================================
# Server Main Entrypoint
# ==============================================================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV") == "development"
    print("=" * 60)
    print("[SERVER] Smart Campus Delivery Robot 3D - Python Flask Server")
    print(f"[URL] Running on: http://127.0.0.1:{port}")
    print("[ALGO] 3D A* Search [f=g+h] & 3D Greedy Best-First [f=h]")
    print("[FEAT] Dynamic 3D Replanning, Multi-floor Ramps & Elevators")
    print("=" * 60)
    app.run(host="0.0.0.0", port=port, debug=debug)
