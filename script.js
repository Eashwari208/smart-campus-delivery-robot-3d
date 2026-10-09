/**
 * Smart Campus Delivery Robot Simulation — 3D Grid Edition
 * Interactive AI Pathfinding: A* Search, Greedy Best-First, Dynamic Replanning
 * Full WebGL 3D Visualization with Three.js & Client/Server Dual Engine
 */

// =============================================================================
// Constants & Configuration
// =============================================================================

const GRID_CONFIG = {
  width: 16,
  depth: 16,
  height: 4, // 4 Floors: z = 0, 1, 2, 3
  cellSize: 1.0,
  floorSpacing: 2.2
};

const CELL_TYPES = {
  FREE: 0,
  WALL: 1,
  RAMP: 2,
  ELEVATOR: 3,
  STAIRS: 4,
  DYNAMIC_OBSTACLE: 5
};

const COSTS = {
  HORIZONTAL: 1.0,
  RAMP: 2.0,
  STAIRS: 2.5,
  ELEVATOR_PER_FLOOR: 1.0
};

// =============================================================================
// Web Audio API Sound Generator
// =============================================================================

class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playBeep(freq = 440, type = 'sine', duration = 0.08, vol = 0.1) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio not supported or blocked
    }
  }

  playSuccess() {
    if (this.muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, index) => {
      setTimeout(() => this.playBeep(freq, 'triangle', 0.18, 0.15), index * 90);
    });
  }

  playAlarm() {
    if (this.muted) return;
    const notes = [880, 440, 880, 440];
    notes.forEach((freq, index) => {
      setTimeout(() => this.playBeep(freq, 'sawtooth', 0.12, 0.15), index * 120);
    });
  }

  playStep() {
    this.playBeep(320 + Math.random() * 60, 'sine', 0.04, 0.04);
  }
}

const soundFX = new SoundFX();

// =============================================================================
// Built-in Campus Preset Scenarios
// =============================================================================

const PRESET_SCENARIOS = {
  library_to_dorms: {
    id: "library_to_dorms",
    name: "Library to Dorms (Multi-Floor Express)",
    start: { x: 1, y: 1, z: 0 },
    goal: { x: 14, y: 14, z: 3 },
    obstacles: [
      { x: 4, y: 2, z: 0 }, { x: 4, y: 3, z: 0 }, { x: 4, y: 4, z: 0 }, { x: 4, y: 5, z: 0 },
      { x: 8, y: 8, z: 0 }, { x: 8, y: 9, z: 0 }, { x: 8, y: 10, z: 0 }, { x: 9, y: 8, z: 0 }, { x: 10, y: 8, z: 0 },
      { x: 6, y: 6, z: 1 }, { x: 6, y: 7, z: 1 }, { x: 6, y: 8, z: 1 }, { x: 7, y: 6, z: 1 }, { x: 8, y: 6, z: 1 },
      { x: 5, y: 10, z: 2 }, { x: 6, y: 10, z: 2 }, { x: 7, y: 10, z: 2 }, { x: 10, y: 12, z: 2 }, { x: 11, y: 12, z: 2 },
      { x: 12, y: 10, z: 3 }, { x: 12, y: 11, z: 3 }, { x: 12, y: 12, z: 3 }
    ],
    connectors: [
      { x: 8, y: 7, z: 0, type: "elevator", to_z: 3 },
      { x: 12, y: 4, z: 0, type: "ramp" },
      { x: 3, y: 11, z: 1, type: "ramp" },
      { x: 10, y: 13, z: 2, type: "ramp" }
    ],
    dynamic_obstacles: []
  },
  cafeteria_rush: {
    id: "cafeteria_rush",
    name: "Cafeteria Rush (Crowded Corridors)",
    start: { x: 0, y: 2, z: 0 },
    goal: { x: 15, y: 13, z: 1 },
    obstacles: [
      { x: 3, y: 2, z: 0 }, { x: 3, y: 3, z: 0 }, { x: 3, y: 4, z: 0 },
      { x: 7, y: 0, z: 0 }, { x: 7, y: 1, z: 0 }, { x: 7, y: 2, z: 0 }, { x: 7, y: 3, z: 0 }, { x: 7, y: 4, z: 0 },
      { x: 11, y: 6, z: 0 }, { x: 11, y: 7, z: 0 }, { x: 11, y: 8, z: 0 }, { x: 11, y: 9, z: 0 }
    ],
    connectors: [
      { x: 5, y: 5, z: 0, type: "ramp" },
      { x: 14, y: 8, z: 0, type: "elevator", to_z: 2 }
    ],
    dynamic_obstacles: [
      { x: 4, y: 5, z: 0 },
      { x: 5, y: 6, z: 1 }
    ]
  },
  construction_maze: {
    id: "construction_maze",
    name: "Construction Maze (Vertical Detours)",
    start: { x: 2, y: 2, z: 0 },
    goal: { x: 13, y: 13, z: 0 },
    obstacles: [
      { x: 7, y: 0, z: 0 }, { x: 7, y: 1, z: 0 }, { x: 7, y: 2, z: 0 }, { x: 7, y: 3, z: 0 },
      { x: 7, y: 4, z: 0 }, { x: 7, y: 5, z: 0 }, { x: 7, y: 6, z: 0 }, { x: 7, y: 7, z: 0 },
      { x: 7, y: 8, z: 0 }, { x: 7, y: 9, z: 0 }, { x: 7, y: 10, z: 0 }, { x: 7, y: 11, z: 0 },
      { x: 7, y: 12, z: 0 }, { x: 7, y: 13, z: 0 }, { x: 7, y: 14, z: 0 }, { x: 7, y: 15, z: 0 }
    ],
    connectors: [
      { x: 4, y: 4, z: 0, type: "ramp" },
      { x: 4, y: 12, z: 1, type: "ramp" },
      { x: 11, y: 12, z: 2, type: "ramp" },
      { x: 11, y: 4, z: 1, type: "ramp" }
    ],
    dynamic_obstacles: []
  },
  rooftop_delivery: {
    id: "rooftop_delivery",
    name: "Rooftop Heli-pad (Elevator Only)",
    start: { x: 0, y: 0, z: 0 },
    goal: { x: 15, y: 15, z: 3 },
    obstacles: [
      { x: 5, y: 0, z: 0 }, { x: 5, y: 1, z: 0 }, { x: 5, y: 2, z: 0 },
      { x: 10, y: 10, z: 3 }, { x: 10, y: 11, z: 3 }, { x: 10, y: 12, z: 3 }
    ],
    connectors: [
      { x: 8, y: 8, z: 0, type: "elevator", to_z: 3 },
      { x: 2, y: 14, z: 0, type: "elevator", to_z: 3 }
    ],
    dynamic_obstacles: []
  },
  spiral_tower: {
    id: "spiral_tower",
    name: "Double Spiral Campus Tower",
    start: { x: 1, y: 1, z: 0 },
    goal: { x: 8, y: 8, z: 3 },
    obstacles: [
      { x: 8, y: 4, z: 0 }, { x: 8, y: 5, z: 0 }, { x: 8, y: 6, z: 0 },
      { x: 8, y: 4, z: 1 }, { x: 8, y: 5, z: 1 }, { x: 8, y: 6, z: 1 },
      { x: 8, y: 4, z: 2 }, { x: 8, y: 5, z: 2 }, { x: 8, y: 6, z: 2 }
    ],
    connectors: [
      { x: 14, y: 1, z: 0, type: "ramp" },
      { x: 14, y: 14, z: 1, type: "ramp" },
      { x: 1, y: 14, z: 2, type: "ramp" },
      { x: 8, y: 8, z: 0, type: "elevator", to_z: 3 }
    ],
    dynamic_obstacles: []
  }
};

// =============================================================================
// Client-Side 3D Pathfinding Algorithms (Full Offline Standalone Engine)
// =============================================================================

class PriorityQueue {
  constructor() {
    this.elements = [];
  }

  enqueue(element, priority, secondary = 0) {
    this.elements.push({ element, priority, secondary });
    this.elements.sort((a, b) => {
      if (a.priority === b.priority) {
        return a.secondary - b.secondary;
      }
      return a.priority - b.priority;
    });
  }

  dequeue() {
    return this.elements.shift().element;
  }

  isEmpty() {
    return this.elements.length === 0;
  }

  size() {
    return this.elements.length;
  }
}

class Pathfinding3DEngine {
  static key(x, y, z) {
    return `${x},${y},${z}`;
  }

  static parseKey(k) {
    const parts = k.split(',').map(Number);
    return { x: parts[0], y: parts[1], z: parts[2] };
  }

  static heuristic(p1, p2, type = 'manhattan', vertWeight = 1.5) {
    const dx = Math.abs(p1.x - p2.x);
    const dy = Math.abs(p1.y - p2.y);
    const dz = Math.abs(p1.z - p2.z) * vertWeight;

    if (type === 'euclidean') {
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    } else if (type === 'chebyshev') {
      return Math.max(dx, dy, dz);
    }
    return dx + dy + dz;
  }

  static solve(gridState, start, goal, algorithm = 'astar', heuristicType = 'manhattan', vertWeight = 1.5) {
    const t0 = performance.now();
    const startKey = this.key(start.x, start.y, start.z);
    const goalKey = this.key(goal.x, goal.y, goal.z);

    const result = {
      found: false,
      algorithm: algorithm.toUpperCase(),
      path: [],
      explored: [],
      nodes_explored: 0,
      frontier_peak: 0,
      path_length: 0,
      total_cost: 0,
      floors_traversed: 0,
      vertical_energy: 0,
      time_ms: 0
    };

    if (startKey === goalKey) {
      result.found = true;
      result.path = [{ x: start.x, y: start.y, z: start.z, action: "Start", cost_so_far: 0, step_index: 0 }];
      result.path_length = 1;
      result.time_ms = performance.now() - t0;
      return result;
    }

    const frontier = new PriorityQueue();
    const initialH = this.heuristic(start, goal, heuristicType, vertWeight);
    const initialF = algorithm === 'greedy' ? initialH : (algorithm === 'dijkstra' ? 0 : initialH);

    frontier.enqueue(startKey, initialF, initialH);

    const cameFrom = new Map();
    const costSoFar = new Map();
    const closedSet = new Set();

    cameFrom.set(startKey, { parent: null, action: "Start", cost: 0 });
    costSoFar.set(startKey, 0);

    let step = 0;

    while (!frontier.isEmpty()) {
      result.frontier_peak = Math.max(result.frontier_peak, frontier.size());
      const currentKey = frontier.dequeue();
      const curr = this.parseKey(currentKey);

      if (closedSet.has(currentKey)) continue;
      closedSet.add(currentKey);
      step++;

      const currG = costSoFar.get(currentKey) || 0;
      const currH = this.heuristic(curr, goal, heuristicType, vertWeight);
      const currF = algorithm === 'greedy' ? currH : (algorithm === 'dijkstra' ? currG : currG + currH);

      result.explored.push({
        x: curr.x,
        y: curr.y,
        z: curr.z,
        g: Number(currG.toFixed(2)),
        h: Number(currH.toFixed(2)),
        f: Number(currF.toFixed(2)),
        step
      });

      if (currentKey === goalKey) {
        result.found = true;
        break;
      }

      // Get 3D neighbors
      const neighbors = this.getNeighbors(curr, gridState, vertWeight);

      for (const { pos, cost, action } of neighbors) {
        const nKey = this.key(pos.x, pos.y, pos.z);
        if (closedSet.has(nKey)) continue;

        const newCost = currG + cost;
        if (!costSoFar.has(nKey) || newCost < costSoFar.get(nKey)) {
          costSoFar.set(nKey, newCost);
          cameFrom.set(nKey, { parent: currentKey, action, cost });

          const hVal = this.heuristic(pos, goal, heuristicType, vertWeight);
          let fVal = newCost + hVal;
          if (algorithm === 'greedy') fVal = hVal;
          else if (algorithm === 'dijkstra') fVal = newCost;

          frontier.enqueue(nKey, fVal, hVal);
        }
      }
    }

    result.time_ms = performance.now() - t0;
    result.nodes_explored = closedSet.size;

    if (result.found) {
      let curr = goalKey;
      const rawPath = [];
      let totalCost = 0;
      let floors = 0;
      let energy = 0;

      while (curr !== null) {
        const info = cameFrom.get(curr);
        const node = this.parseKey(curr);
        rawPath.push({ node, info });
        if (!info || !info.parent) break;
        const parentNode = this.parseKey(info.parent);
        if (Math.abs(node.z - parentNode.z) > 0) {
          floors += Math.abs(node.z - parentNode.z);
          energy += info.cost;
        }
        curr = info.parent;
      }

      rawPath.reverse();
      let accum = 0;
      result.path = rawPath.map((item, idx) => {
        if (idx > 0 && item.info) accum += item.info.cost;
        return {
          x: item.node.x,
          y: item.node.y,
          z: item.node.z,
          action: idx === 0 ? "Start" : item.info.action,
          cost_so_far: Number(accum.toFixed(2)),
          step_index: idx
        };
      });

      result.path_length = result.path.length;
      result.total_cost = Number(accum.toFixed(2));
      result.floors_traversed = floors;
      result.vertical_energy = Number(energy.toFixed(2));
    }

    return result;
  }

  static getNeighbors(curr, gridState, vertWeight) {
    const { width, depth, height, obstacles, dynamicObstacles, ramps, elevators, stairs } = gridState;
    const neighbors = [];

    const isPassable = (x, y, z) => {
      if (x < 0 || x >= width || y < 0 || y >= depth || z < 0 || z >= height) return false;
      const k = this.key(x, y, z);
      if (obstacles.has(k) || dynamicObstacles.has(k)) return false;
      return true;
    };

    const cKey = this.key(curr.x, curr.y, curr.z);

    // 1. Horizontal movements (±X, ±Y on same floor)
    const dirs = [
      { dx: 1, dy: 0, label: "East" },
      { dx: -1, dy: 0, label: "West" },
      { dx: 0, dy: 1, label: "North" },
      { dx: 0, dy: -1, label: "South" }
    ];

    for (const d of dirs) {
      const nx = curr.x + d.dx;
      const ny = curr.y + d.dy;
      const nz = curr.z;
      if (isPassable(nx, ny, nz)) {
        neighbors.push({ pos: { x: nx, y: ny, z: nz }, cost: COSTS.HORIZONTAL, action: `Move ${d.label}` });
      }
    }

    // 2. Ramps / Stairs (Connects z to z±1)
    if (ramps.has(cKey)) {
      if (curr.z + 1 < height && isPassable(curr.x, curr.y, curr.z + 1)) {
        neighbors.push({ pos: { x: curr.x, y: curr.y, z: curr.z + 1 }, cost: COSTS.RAMP * vertWeight, action: "Climb Ramp Up" });
      }
      if (curr.z - 1 >= 0 && isPassable(curr.x, curr.y, curr.z - 1)) {
        neighbors.push({ pos: { x: curr.x, y: curr.y, z: curr.z - 1 }, cost: COSTS.RAMP * vertWeight, action: "Descend Ramp Down" });
      }
    }

    if (stairs.has(cKey)) {
      if (curr.z + 1 < height && isPassable(curr.x, curr.y, curr.z + 1)) {
        neighbors.push({ pos: { x: curr.x, y: curr.y, z: curr.z + 1 }, cost: COSTS.STAIRS * vertWeight, action: "Climb Stairs Up" });
      }
      if (curr.z - 1 >= 0 && isPassable(curr.x, curr.y, curr.z - 1)) {
        neighbors.push({ pos: { x: curr.x, y: curr.y, z: curr.z - 1 }, cost: COSTS.STAIRS * vertWeight, action: "Descend Stairs Down" });
      }
    }

    // 3. Elevators (Connects to all floors in elevator shaft)
    const shaftKey = `${curr.x},${curr.y}`;
    if (elevators.has(shaftKey)) {
      const shaftFloors = elevators.get(shaftKey);
      if (shaftFloors && shaftFloors.has(curr.z)) {
        for (const tz of shaftFloors) {
          if (tz !== curr.z && isPassable(curr.x, curr.y, tz)) {
            const diff = Math.abs(tz - curr.z);
            const cost = diff * COSTS.ELEVATOR_PER_FLOOR * vertWeight;
            neighbors.push({
              pos: { x: curr.x, y: curr.y, z: tz },
              cost,
              action: `Elevator ${tz > curr.z ? 'Up' : 'Down'} (F${tz})`
            });
          }
        }
      }
    }

    return neighbors;
  }
}

// =============================================================================
// Three.js 3D Campus World & Visualizer
// =============================================================================

class CampusVisualizer3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Scene Groups
    this.floorGroups = [];
    this.cellMeshMap = new Map(); // key -> mesh
    this.connectorMeshes = new Map();
    this.exploredMeshes = [];
    this.pathLineMesh = null;
    this.pathNodeMeshes = [];
    this.robotMesh = null;
    this.beaconMeshes = { start: null, goal: null };
    this.hoverCursorMesh = null;

    this.activeFloorView = 'all'; // 'all' or 0, 1, 2, 3
    this.ghostInactive = true;
    this.showGrid = true;
    this.cameraMode = 'orbit';

    this.init();
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070a12);
    this.scene.fog = new THREE.FogExp2(0x070a12, 0.025);

    // 2. Camera setup
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.setCameraPerspective('orbit');

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.05; // Prevent viewing from underneath ground

    // 5. Lighting
    this.setupLighting();

    // 6. Build Campus Slabs & Grids
    this.buildFloorSlabs();

    // 7. Hover Cursor
    this.buildHoverCursor();

    // 8. Build Delivery Robot Mesh
    this.buildRobot();

    // 9. Resize Listener
    window.addEventListener('resize', () => this.onWindowResize());

    // 10. Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x06b6d4, 0.8);
    dirLight.position.set(20, 35, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    this.scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x8b5cf6, 1.2, 50);
    pointLight.position.set(-15, 20, -15);
    this.scene.add(pointLight);
  }

  gridToWorld(x, y, z) {
    const ox = (x - GRID_CONFIG.width / 2 + 0.5) * GRID_CONFIG.cellSize;
    const oz = (y - GRID_CONFIG.depth / 2 + 0.5) * GRID_CONFIG.cellSize;
    const oy = z * GRID_CONFIG.floorSpacing + 0.1;
    return new THREE.Vector3(ox, oy, oz);
  }

  worldToGrid(pos) {
    const gx = Math.round(pos.x / GRID_CONFIG.cellSize + GRID_CONFIG.width / 2 - 0.5);
    const gy = Math.round(pos.z / GRID_CONFIG.cellSize + GRID_CONFIG.depth / 2 - 0.5);
    const gz = Math.max(0, Math.min(GRID_CONFIG.height - 1, Math.round(pos.y / GRID_CONFIG.floorSpacing)));
    return { x: gx, y: gy, z: gz };
  }

  buildFloorSlabs() {
    this.floorGroups = [];
    const slabGeo = new THREE.BoxGeometry(
      GRID_CONFIG.width * GRID_CONFIG.cellSize,
      0.15,
      GRID_CONFIG.depth * GRID_CONFIG.cellSize
    );

    const floorNames = ["Ground Lobby (F0)", "Engineering Labs (F1)", "Smart Library (F2)", "Sky-Deck Helipad (F3)"];

    for (let z = 0; z < GRID_CONFIG.height; z++) {
      const group = new THREE.Group();
      group.name = `Floor_${z}`;

      // Glass floor slab
      const slabMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.2,
        metalness: 0.8,
        transparent: true,
        opacity: 0.85
      });
      const slabMesh = new THREE.Mesh(slabGeo, slabMat);
      slabMesh.position.y = z * GRID_CONFIG.floorSpacing - 0.08;
      slabMesh.receiveShadow = true;
      group.add(slabMesh);

      // Floor grid lines
      const gridHelper = new THREE.GridHelper(
        GRID_CONFIG.width * GRID_CONFIG.cellSize,
        GRID_CONFIG.width,
        0x06b6d4,
        0x1e293b
      );
      gridHelper.position.y = z * GRID_CONFIG.floorSpacing + 0.01;
      group.add(gridHelper);

      // Floor outer border glow frame
      const frameGeo = new THREE.BoxGeometry(
        GRID_CONFIG.width * GRID_CONFIG.cellSize + 0.2,
        0.05,
        GRID_CONFIG.depth * GRID_CONFIG.cellSize + 0.2
      );
      const frameMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, wireframe: true, transparent: true, opacity: 0.3 });
      const frameMesh = new THREE.Mesh(frameGeo, frameMat);
      frameMesh.position.y = z * GRID_CONFIG.floorSpacing;
      group.add(frameMesh);

      this.scene.add(group);
      this.floorGroups.push({ group, slabMat, gridHelper, frameMesh, z });
    }
  }

  buildHoverCursor() {
    const geo = new THREE.BoxGeometry(GRID_CONFIG.cellSize * 0.95, 0.2, GRID_CONFIG.cellSize * 0.95);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      wireframe: true,
      transparent: true,
      opacity: 0.8
    });
    this.hoverCursorMesh = new THREE.Mesh(geo, mat);
    this.hoverCursorMesh.visible = false;
    this.scene.add(this.hoverCursorMesh);
  }

  buildRobot() {
    const robotGroup = new THREE.Group();

    // 1. Main Chassis
    const chassisGeo = new THREE.BoxGeometry(0.65, 0.3, 0.5);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.8,
      roughness: 0.2
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 0.22;
    robotGroup.add(chassis);

    // 2. Cargo Compartment Lid (Yellow Accent)
    const cargoGeo = new THREE.BoxGeometry(0.4, 0.15, 0.38);
    const cargoMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
    const cargo = new THREE.Mesh(cargoGeo, cargoMat);
    cargo.position.set(-0.08, 0.38, 0);
    robotGroup.add(cargo);

    // 3. Spinning LiDAR Dome
    const lidarGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.12, 16);
    const lidarMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 0.5 });
    this.lidarMesh = new THREE.Mesh(lidarGeo, lidarMat);
    this.lidarMesh.position.set(0.15, 0.45, 0);
    robotGroup.add(this.lidarMesh);

    // 4. LED Expressive Eyes
    const eyeGeo = new THREE.BoxGeometry(0.04, 0.08, 0.12);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(0.33, 0.26, 0.12);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.33, 0.26, -0.12);
    robotGroup.add(leftEye);
    robotGroup.add(rightEye);

    // 5. Four Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    wheelGeo.rotateX(Math.PI / 2);

    const wheelPositions = [
      [0.2, 0.12, 0.28], [0.2, 0.12, -0.28],
      [-0.2, 0.12, 0.28], [-0.2, 0.12, -0.28]
    ];
    this.wheels = [];
    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(...pos);
      robotGroup.add(wheel);
      this.wheels.push(wheel);
    });

    // 6. Ground Shadow Light / Glow Ring
    const ringGeo = new THREE.RingGeometry(0.3, 0.5, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.6 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.02;
    robotGroup.add(ring);

    this.robotMesh = robotGroup;
    this.scene.add(this.robotMesh);
  }

  setCameraPerspective(mode) {
    this.cameraMode = mode;
    const center = new THREE.Vector3(0, (GRID_CONFIG.height * GRID_CONFIG.floorSpacing) / 3, 0);

    if (mode === 'orbit') {
      this.camera.position.set(18, 22, 24);
      if (this.controls) this.controls.target.copy(center);
    } else if (mode === 'iso') {
      this.camera.position.set(24, 28, 24);
      if (this.controls) this.controls.target.copy(center);
    } else if (mode === 'top') {
      const activeZ = this.activeFloorView === 'all' ? 0 : this.activeFloorView;
      this.camera.position.set(0, activeZ * GRID_CONFIG.floorSpacing + 22, 0.001);
      if (this.controls) this.controls.target.set(0, activeZ * GRID_CONFIG.floorSpacing, 0);
    }
  }

  setFloorLayerFilter(floorZ, ghostInactive = true) {
    this.activeFloorView = floorZ;
    this.ghostInactive = ghostInactive;

    this.floorGroups.forEach(({ group, slabMat, gridHelper, frameMesh, z }) => {
      if (floorZ === 'all') {
        group.visible = true;
        slabMat.opacity = 0.85;
        gridHelper.visible = this.showGrid;
      } else {
        if (z === floorZ) {
          group.visible = true;
          slabMat.opacity = 0.95;
          gridHelper.visible = this.showGrid;
        } else {
          if (ghostInactive) {
            group.visible = true;
            slabMat.opacity = 0.08;
            gridHelper.visible = false;
          } else {
            group.visible = false;
          }
        }
      }
    });

    // Update visibility of cell objects
    this.cellMeshMap.forEach((mesh, key) => {
      const k = Pathfinding3DEngine.parseKey(key);
      if (floorZ === 'all' || k.z === floorZ) {
        mesh.visible = true;
      } else {
        mesh.visible = ghostInactive;
      }
    });
  }

  renderGridState(gridState, start, goal) {
    // 1. Clear existing cell meshes
    this.cellMeshMap.forEach(mesh => this.scene.remove(mesh));
    this.cellMeshMap.clear();

    // 2. Clear connector meshes
    this.connectorMeshes.forEach(mesh => this.scene.remove(mesh));
    this.connectorMeshes.clear();

    // Materials
    const wallGeo = new THREE.BoxGeometry(GRID_CONFIG.cellSize * 0.92, 1.2, GRID_CONFIG.cellSize * 0.92);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.6,
      roughness: 0.3
    });

    const dynGeo = new THREE.ConeGeometry(0.35, 0.8, 16);
    const dynMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.6
    });

    // Render Static Obstacles (Walls)
    gridState.obstacles.forEach(k => {
      const pos = Pathfinding3DEngine.parseKey(k);
      const wPos = this.gridToWorld(pos.x, pos.y, pos.z);
      const mesh = new THREE.Mesh(wallGeo, wallMat);
      mesh.position.set(wPos.x, wPos.y + 0.6, wPos.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.cellMeshMap.set(k, mesh);
    });

    // Render Dynamic Obstacles (Hazards)
    gridState.dynamicObstacles.forEach(k => {
      const pos = Pathfinding3DEngine.parseKey(k);
      const wPos = this.gridToWorld(pos.x, pos.y, pos.z);
      const mesh = new THREE.Mesh(dynGeo, dynMat);
      mesh.position.set(wPos.x, wPos.y + 0.4, wPos.z);
      this.scene.add(mesh);
      this.cellMeshMap.set(k, mesh);
    });

    // Render Ramps (Angled ramps connecting floors)
    gridState.ramps.forEach(k => {
      const pos = Pathfinding3DEngine.parseKey(k);
      const wPos = this.gridToWorld(pos.x, pos.y, pos.z);
      const rampGeo = new THREE.BoxGeometry(GRID_CONFIG.cellSize * 0.9, 0.2, GRID_CONFIG.cellSize * 0.9);
      const rampMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.4
      });
      const rampMesh = new THREE.Mesh(rampGeo, rampMat);
      rampMesh.position.set(wPos.x, wPos.y + 0.1, wPos.z);
      this.scene.add(rampMesh);
      this.cellMeshMap.set(k, rampMesh);

      // Angled connector link to next floor
      if (pos.z + 1 < GRID_CONFIG.height) {
        const linkGeo = new THREE.CylinderGeometry(0.08, 0.08, GRID_CONFIG.floorSpacing, 12);
        const linkMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.7 });
        const link = new THREE.Mesh(linkGeo, linkMat);
        link.position.set(wPos.x, wPos.y + GRID_CONFIG.floorSpacing / 2, wPos.z);
        this.scene.add(link);
        this.connectorMeshes.set(`ramp_link_${k}`, link);
      }
    });

    // Render Elevator Shafts (Glowing vertical glass pillars)
    gridState.elevators.forEach((shaftFloors, shaftKey) => {
      const [sx, sy] = shaftKey.split(',').map(Number);
      const minZ = Math.min(...shaftFloors);
      const maxZ = Math.max(...shaftFloors);
      const botPos = this.gridToWorld(sx, sy, minZ);
      const topPos = this.gridToWorld(sx, sy, maxZ);

      const shaftHeight = (maxZ - minZ) * GRID_CONFIG.floorSpacing + 1.2;
      const elevShaftGeo = new THREE.BoxGeometry(GRID_CONFIG.cellSize * 0.9, shaftHeight, GRID_CONFIG.cellSize * 0.9);
      const elevShaftMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.25,
        wireframe: true
      });
      const shaftMesh = new THREE.Mesh(elevShaftGeo, elevShaftMat);
      shaftMesh.position.set(botPos.x, (botPos.y + topPos.y + 1.2) / 2, botPos.z);
      this.scene.add(shaftMesh);
      this.connectorMeshes.set(`elevator_shaft_${shaftKey}`, shaftMesh);

      // Pad markers on each floor
      shaftFloors.forEach(fz => {
        const k = Pathfinding3DEngine.key(sx, sy, fz);
        const fPos = this.gridToWorld(sx, sy, fz);
        const padGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16);
        const padMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 0.6 });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.set(fPos.x, fPos.y + 0.05, fPos.z);
        this.scene.add(pad);
        this.cellMeshMap.set(k, pad);
      });
    });

    // Render Beacons: Start (Green) & Goal (Red)
    this.renderBeacons(start, goal);

    // Position robot at start initially
    if (this.robotMesh && start) {
      const sPos = this.gridToWorld(start.x, start.y, start.z);
      this.robotMesh.position.copy(sPos);
      this.robotMesh.position.y += 0.02;
    }
  }

  renderBeacons(start, goal) {
    if (this.beaconMeshes.start) this.scene.remove(this.beaconMeshes.start);
    if (this.beaconMeshes.goal) this.scene.remove(this.beaconMeshes.goal);

    // Start Beacon (Emerald Hologram Pillar)
    const sPos = this.gridToWorld(start.x, start.y, start.z);
    const startGroup = new THREE.Group();
    const sRingGeo = new THREE.TorusGeometry(0.42, 0.06, 12, 24);
    sRingGeo.rotateX(Math.PI / 2);
    const sRingMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const sRing = new THREE.Mesh(sRingGeo, sRingMat);
    startGroup.add(sRing);
    startGroup.position.set(sPos.x, sPos.y + 0.1, sPos.z);
    this.scene.add(startGroup);
    this.beaconMeshes.start = startGroup;

    // Goal Beacon (Crimson Floating Parcel Beacon)
    const gPos = this.gridToWorld(goal.x, goal.y, goal.z);
    const goalGroup = new THREE.Group();
    const gBoxGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    const gBoxMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xf43f5e, emissiveIntensity: 0.5 });
    const gBox = new THREE.Mesh(gBoxGeo, gBoxMat);
    gBox.position.y = 0.5;
    goalGroup.add(gBox);

    const gRingGeo = new THREE.TorusGeometry(0.45, 0.05, 12, 24);
    gRingGeo.rotateX(Math.PI / 2);
    const gRingMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    const gRing = new THREE.Mesh(gRingGeo, gRingMat);
    goalGroup.add(gRing);

    goalGroup.position.set(gPos.x, gPos.y + 0.1, gPos.z);
    this.scene.add(goalGroup);
    this.beaconMeshes.goal = goalGroup;
  }

  clearSearchVisualization() {
    this.exploredMeshes.forEach(mesh => this.scene.remove(mesh));
    this.exploredMeshes = [];

    if (this.pathLineMesh) {
      this.scene.remove(this.pathLineMesh);
      this.pathLineMesh = null;
    }

    this.pathNodeMeshes.forEach(m => this.scene.remove(m));
    this.pathNodeMeshes = [];
  }

  renderExploredNode(node, maxStep = 100) {
    const wPos = this.gridToWorld(node.x, node.y, node.z);
    const cubeGeo = new THREE.BoxGeometry(GRID_CONFIG.cellSize * 0.8, 0.1, GRID_CONFIG.cellSize * 0.8);
    
    // Dynamic color gradient from cyan to violet based on search step
    const color = new THREE.Color(0x06b6d4).lerp(new THREE.Color(0x8b5cf6), Math.min(1.0, node.step / maxStep));
    const cubeMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.45
    });
    const mesh = new THREE.Mesh(cubeGeo, cubeMat);
    mesh.position.set(wPos.x, wPos.y + 0.05, wPos.z);
    this.scene.add(mesh);
    this.exploredMeshes.push(mesh);
  }

  renderPath(path) {
    if (!path || path.length === 0) return;

    const points = [];
    const sphereGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });

    path.forEach(pt => {
      const wPos = this.gridToWorld(pt.x, pt.y, pt.z);
      const ptVec = new THREE.Vector3(wPos.x, wPos.y + 0.3, wPos.z);
      points.push(ptVec);

      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.copy(ptVec);
      this.scene.add(sphere);
      this.pathNodeMeshes.push(sphere);
    });

    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x10b981,
      linewidth: 4
    });
    this.pathLineMesh = new THREE.Line(lineGeo, lineMat);
    this.scene.add(this.pathLineMesh);
  }

  updateRobotPosition(gridPos, targetPos = null, progress = 0) {
    if (!this.robotMesh) return;

    const p1 = this.gridToWorld(gridPos.x, gridPos.y, gridPos.z);
    if (targetPos) {
      const p2 = this.gridToWorld(targetPos.x, targetPos.y, targetPos.z);
      this.robotMesh.position.lerpVectors(p1, p2, progress);

      // Rotate robot towards heading
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
        const targetAngle = Math.atan2(dx, dz) - Math.PI / 2;
        this.robotMesh.rotation.y = targetAngle;
      }
    } else {
      this.robotMesh.position.copy(p1);
    }

    // Spin wheels
    this.wheels.forEach(w => w.rotateZ(0.2));

    // Follow camera mode
    if (this.cameraMode === 'follow' && this.controls) {
      const offset = new THREE.Vector3(-6, 8, -6);
      this.camera.position.copy(this.robotMesh.position).add(offset);
      this.controls.target.copy(this.robotMesh.position);
    }
  }

  animate() {
    requestAnimationFrame(this.animate);

    // Spin LiDAR sensor dome
    if (this.lidarMesh) {
      this.lidarMesh.rotation.y += 0.08;
    }

    // Spin Goal Beacon parcel
    if (this.beaconMeshes.goal) {
      this.beaconMeshes.goal.rotation.y += 0.03;
    }

    if (this.controls) {
      this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}

// =============================================================================
// Simulation App Controller & State Manager
// =============================================================================

class SmartCampusSimulationApp {
  constructor() {
    this.gridState = {
      width: GRID_CONFIG.width,
      depth: GRID_CONFIG.depth,
      height: GRID_CONFIG.height,
      obstacles: new Set(),
      dynamicObstacles: new Set(),
      ramps: new Set(),
      elevators: new Map(),
      stairs: new Set()
    };

    this.startPos = { x: 1, y: 1, z: 0 };
    this.goalPos = { x: 14, y: 14, z: 3 };

    this.currentAlgorithm = 'astar';
    this.currentHeuristic = 'manhattan';
    this.verticalCostWeight = 1.5;
    this.currentBrush = 'wall';
    this.activeFloor = 'all';

    this.backendOnline = false;
    this.lastSearchResult = null;

    // Playback state
    this.isDelivering = false;
    this.isPaused = false;
    this.currentStepIdx = 0;
    this.simSpeed = 5;
    this.deliveryInterval = null;
    this.totalReplansCount = 0;
    this.batteryLevel = 100;

    this.visualizer = new CampusVisualizer3D('three-canvas-target');

    this.init();
  }

  async init() {
    this.bindDOMEvents();
    await this.checkBackendStatus();
    this.loadScenario('library_to_dorms');
    this.log("Campus grid 3D initialized. Ready for path planning.", "log-system");
  }

  async checkBackendStatus() {
    const pill = document.getElementById('backend-status-pill');
    const label = document.getElementById('backend-status-text');
    const engineMetric = document.getElementById('metric-engine');

    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        this.backendOnline = true;
        pill.classList.remove('offline');
        label.textContent = "Flask Backend (Python 3D AI)";
        engineMetric.textContent = "Python Flask REST";
        this.log("Connected to Python Flask 3D Pathfinding Server.", "log-info");
        return;
      }
    } catch (e) {
      // Backend not running; fallback to client JS engine
    }

    this.backendOnline = false;
    pill.classList.add('offline');
    label.textContent = "Client Fallback (JS Engine ⚡)";
    engineMetric.textContent = "Browser Client (JS)";
    this.log("Running in Standalone Client Mode with JavaScript 3D AI Engine.", "log-warning");
  }

  bindDOMEvents() {
    // 1. Algorithm Selection
    document.querySelectorAll('input[name="algorithm"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.currentAlgorithm = e.target.value;
        this.log(`Algorithm changed to: ${this.currentAlgorithm.toUpperCase()}`, "log-info");
        soundFX.playBeep(520, 'sine', 0.05);
      });
    });

    // 2. Heuristic Selector
    const heurSel = document.getElementById('heuristic-select');
    if (heurSel) {
      heurSel.addEventListener('change', (e) => {
        this.currentHeuristic = e.target.value;
      });
    }

    // 3. Vertical Cost Slider
    const vertSlider = document.getElementById('slider-vert-cost');
    const vertVal = document.getElementById('val-vert-cost');
    if (vertSlider) {
      vertSlider.addEventListener('input', (e) => {
        this.verticalCostWeight = parseFloat(e.target.value);
        vertVal.textContent = `${this.verticalCostWeight.toFixed(1)}x`;
      });
    }

    // 4. Layer Slicer Buttons
    document.querySelectorAll('.btn-floor').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-floor').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const floor = btn.getAttribute('data-floor');
        this.activeFloor = floor === 'all' ? 'all' : parseInt(floor, 10);
        
        const ghost = document.getElementById('check-ghost-layers').checked;
        this.visualizer.setFloorLayerFilter(this.activeFloor, ghost);

        const layerTag = document.getElementById('hud-layer-tag');
        layerTag.innerHTML = `<i class="fa-solid fa-building"></i> Viewing: ${this.activeFloor === 'all' ? 'All Floors (3D)' : `Floor ${this.activeFloor}`}`;
      });
    });

    // Ghost layers toggle
    const ghostCheck = document.getElementById('check-ghost-layers');
    if (ghostCheck) {
      ghostCheck.addEventListener('change', () => {
        this.visualizer.setFloorLayerFilter(this.activeFloor, ghostCheck.checked);
      });
    }

    // 5. Camera Mode Tabs
    document.querySelectorAll('.cam-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.cam-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const mode = tab.getAttribute('data-cam');
        this.visualizer.setCameraPerspective(mode);
      });
    });

    // 6. Brush Palette
    document.querySelectorAll('.brush-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.brush-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentBrush = btn.getAttribute('data-brush');
        soundFX.playBeep(400, 'sine', 0.04);
      });
    });

    // 7. Scenario Selector
    const scenSelect = document.getElementById('scenario-select');
    if (scenSelect) {
      scenSelect.addEventListener('change', (e) => {
        this.loadScenario(e.target.value);
      });
    }

    // 8. Action Buttons
    document.getElementById('btn-find-path').addEventListener('click', () => this.calculateRoute());
    document.getElementById('btn-start-delivery').addEventListener('click', () => this.startDelivery());
    document.getElementById('btn-pause-play').addEventListener('click', () => this.togglePauseDelivery());
    document.getElementById('btn-step-forward').addEventListener('click', () => this.stepDelivery());
    document.getElementById('btn-reset-sim').addEventListener('click', () => this.resetSimulation());
    document.getElementById('btn-clear-grid').addEventListener('click', () => this.clearGrid());
    document.getElementById('btn-generate-maze').addEventListener('click', () => this.generateRandomMaze());

    // 9. Dynamic Replanning Stress Buttons
    document.getElementById('btn-block-path').addEventListener('click', () => this.injectObstacleAhead());
    document.getElementById('btn-random-hazards').addEventListener('click', () => this.spawnRandomHazards(3));

    // 10. Simulation Speed Slider
    const speedSlider = document.getElementById('slider-sim-speed');
    const speedVal = document.getElementById('val-sim-speed');
    if (speedSlider) {
      speedSlider.addEventListener('input', (e) => {
        this.simSpeed = parseInt(e.target.value, 10);
        speedVal.textContent = `${this.simSpeed}x`;
      });
    }

    // 11. Header Icons (Audio, Camera reset, Fullscreen)
    document.getElementById('btn-audio-toggle').addEventListener('click', (e) => {
      soundFX.muted = !soundFX.muted;
      const icon = document.querySelector('#btn-audio-toggle i');
      icon.className = soundFX.muted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
    });

    document.getElementById('btn-reset-cam').addEventListener('click', () => {
      this.visualizer.setCameraPerspective('orbit');
    });

    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });

    document.getElementById('btn-clear-log').addEventListener('click', () => {
      document.getElementById('event-log-box').innerHTML = '';
    });

    // 12. Comparison Modal
    document.getElementById('btn-compare-modal').addEventListener('click', () => this.openComparisonModal());
    document.getElementById('btn-close-modal').addEventListener('click', () => this.closeComparisonModal());
    document.getElementById('btn-modal-cancel').addEventListener('click', () => this.closeComparisonModal());
    document.getElementById('btn-run-benchmark').addEventListener('click', () => this.runBenchmark());

    // 13. 3D Canvas Click & Raycasting for Brush Editing & Inspector
    const canvasDom = this.visualizer.renderer.domElement;
    canvasDom.addEventListener('click', (e) => this.onCanvasClick(e));
    canvasDom.addEventListener('mousemove', (e) => this.onCanvasMouseMove(e));
  }

  loadScenario(scenarioId) {
    this.resetSimulation();
    const scenario = PRESET_SCENARIOS[scenarioId];
    if (!scenario) return;

    this.gridState.obstacles.clear();
    this.gridState.dynamicObstacles.clear();
    this.gridState.ramps.clear();
    this.gridState.elevators.clear();
    this.gridState.stairs.clear();

    this.startPos = { ...scenario.start };
    this.goalPos = { ...scenario.goal };

    scenario.obstacles.forEach(o => {
      this.gridState.obstacles.add(Pathfinding3DEngine.key(o.x, o.y, o.z));
    });

    (scenario.dynamic_obstacles || []).forEach(o => {
      this.gridState.dynamicObstacles.add(Pathfinding3DEngine.key(o.x, o.y, o.z));
    });

    (scenario.connectors || []).forEach(c => {
      const k = Pathfinding3DEngine.key(c.x, c.y, c.z || 0);
      if (c.type === 'ramp') {
        this.gridState.ramps.add(k);
      } else if (c.type === 'stairs') {
        this.gridState.stairs.add(k);
      } else if (c.type === 'elevator') {
        const shaftKey = `${c.x},${c.y}`;
        const toZ = c.to_z !== undefined ? c.to_z : GRID_CONFIG.height - 1;
        const shaftFloors = new Set();
        for (let z = (c.z || 0); z <= toZ; z++) shaftFloors.add(z);
        this.gridState.elevators.set(shaftKey, shaftFloors);
      }
    });

    this.visualizer.renderGridState(this.gridState, this.startPos, this.goalPos);
    this.log(`Loaded scenario: "${scenario.name}"`, "log-info");
    this.updateHUDPos(this.startPos);
  }

  async calculateRoute() {
    this.resetSimulationStateOnly();
    this.log(`Initiating 3D ${this.currentAlgorithm.toUpperCase()} Pathfinding...`, "log-info");
    document.getElementById('hud-sim-status').textContent = "Computing 3D Route...";

    let result = null;

    if (this.backendOnline) {
      try {
        const payload = {
          algorithm: this.currentAlgorithm,
          heuristic: this.currentHeuristic,
          vertical_weight: this.verticalCostWeight,
          grid_size: { x: GRID_CONFIG.width, y: GRID_CONFIG.depth, z: GRID_CONFIG.height },
          start: this.startPos,
          goal: this.goalPos,
          obstacles: Array.from(this.gridState.obstacles).map(k => Pathfinding3DEngine.parseKey(k)),
          dynamic_obstacles: Array.from(this.gridState.dynamicObstacles).map(k => Pathfinding3DEngine.parseKey(k)),
          connectors: this.exportConnectorsForAPI()
        };

        const response = await fetch('/api/navigate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          result = await response.json();
        }
      } catch (e) {
        this.log("Backend request failed, falling back to client engine.", "log-warning");
      }
    }

    if (!result) {
      result = Pathfinding3DEngine.solve(
        this.gridState,
        this.startPos,
        this.goalPos,
        this.currentAlgorithm,
        this.currentHeuristic,
        this.verticalCostWeight
      );
    }

    this.lastSearchResult = result;
    this.displaySearchResults(result);
  }

  displaySearchResults(result) {
    this.visualizer.clearSearchVisualization();

    // 1. Render Explored Nodes
    result.explored.forEach(node => {
      this.visualizer.renderExploredNode(node, result.explored.length);
    });

    // 2. Render Path
    if (result.found) {
      this.visualizer.renderPath(result.path);
      soundFX.playSuccess();
      this.log(`Route discovered! Path length: ${result.path_length} steps | Total Cost: ${result.total_cost}`, "log-path");
      document.getElementById('hud-sim-status').textContent = "Route Ready. Ready to Deliver!";
      document.getElementById('btn-start-delivery').disabled = false;
    } else {
      soundFX.playAlarm();
      this.log("Pathfinding Failed: Destination unreachable with current obstacles.", "log-replan");
      document.getElementById('hud-sim-status').textContent = "Target Unreachable!";
      document.getElementById('btn-start-delivery').disabled = true;
    }

    // 3. Update KPI Metrics
    document.getElementById('metric-explored').textContent = result.nodes_explored;
    document.getElementById('metric-steps').textContent = result.path_length;
    document.getElementById('metric-cost').textContent = result.total_cost;
    document.getElementById('metric-time').textContent = `${result.time_ms.toFixed(2)} ms`;
    document.getElementById('metric-floors').textContent = `${result.floors_traversed} floors`;
    document.getElementById('metric-energy').textContent = `${result.vertical_energy} units`;
  }

  startDelivery() {
    if (!this.lastSearchResult || !this.lastSearchResult.found || this.lastSearchResult.path.length === 0) return;

    this.isDelivering = true;
    this.isPaused = false;
    this.currentStepIdx = 0;
    this.batteryLevel = 100;

    document.getElementById('btn-start-delivery').disabled = true;
    document.getElementById('btn-find-path').disabled = true;
    document.getElementById('btn-pause-play').disabled = false;
    document.getElementById('btn-step-forward').disabled = false;
    document.getElementById('hud-sim-status').textContent = "Autonomous Delivery in Progress...";

    this.log("Delivery mission launched. Robot in transit.", "log-info");
    this.runDeliveryLoop();
  }

  runDeliveryLoop() {
    clearInterval(this.deliveryInterval);

    const stepDuration = Math.max(50, 600 - this.simSpeed * 50);

    this.deliveryInterval = setInterval(() => {
      if (this.isPaused || !this.isDelivering) return;

      const path = this.lastSearchResult.path;

      if (this.currentStepIdx >= path.length - 1) {
        this.finishDelivery();
        return;
      }

      const nextNode = path[this.currentStepIdx + 1];
      const nextKey = Pathfinding3DEngine.key(nextNode.x, nextNode.y, nextNode.z);

      // Check if next cell or remaining path was blocked dynamically
      if (this.gridState.obstacles.has(nextKey) || this.gridState.dynamicObstacles.has(nextKey)) {
        this.triggerDynamicReplan(path[this.currentStepIdx]);
        return;
      }

      this.currentStepIdx++;
      const currentPos = path[this.currentStepIdx];
      const targetPos = this.currentStepIdx + 1 < path.length ? path[this.currentStepIdx + 1] : null;

      this.visualizer.updateRobotPosition(currentPos, targetPos, 0.5);
      this.updateHUDPos(currentPos);
      soundFX.playStep();

      // Drain battery slightly
      this.batteryLevel = Math.max(5, this.batteryLevel - 0.8);
      document.getElementById('hud-robot-battery').textContent = `${Math.round(this.batteryLevel)}%`;

      if (currentPos.action && currentPos.action !== 'Start') {
        this.log(`Robot at (${currentPos.x}, ${currentPos.y}, F${currentPos.z}) — ${currentPos.action}`, "log-system");
      }

    }, stepDuration);
  }

  async triggerDynamicReplan(currentRobotPos) {
    clearInterval(this.deliveryInterval);
    this.totalReplansCount++;
    document.getElementById('metric-replans').textContent = this.totalReplansCount;

    soundFX.playAlarm();
    this.log(`⚠️ Obstacle detected ahead at next waypoint! Triggering Real-time 3D Replanner...`, "log-replan");

    // Show visual banner
    const banner = document.getElementById('replan-alert-banner');
    banner.classList.add('show');
    document.getElementById('hud-sim-status').textContent = "⚠️ Obstacle Blocked Path! Replanning...";

    let result = null;

    if (this.backendOnline) {
      try {
        const payload = {
          algorithm: this.currentAlgorithm,
          heuristic: this.currentHeuristic,
          vertical_weight: this.verticalCostWeight,
          grid_size: { x: GRID_CONFIG.width, y: GRID_CONFIG.depth, z: GRID_CONFIG.height },
          current: currentRobotPos,
          goal: this.goalPos,
          obstacles: Array.from(this.gridState.obstacles).map(k => Pathfinding3DEngine.parseKey(k)),
          dynamic_obstacles: Array.from(this.gridState.dynamicObstacles).map(k => Pathfinding3DEngine.parseKey(k)),
          connectors: this.exportConnectorsForAPI()
        };

        const res = await fetch('/api/replan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          result = await res.json();
        }
      } catch (e) {}
    }

    if (!result) {
      result = Pathfinding3DEngine.solve(
        this.gridState,
        currentRobotPos,
        this.goalPos,
        this.currentAlgorithm,
        this.currentHeuristic,
        this.verticalCostWeight
      );
    }

    setTimeout(() => {
      banner.classList.remove('show');
    }, 2200);

    if (result && result.found) {
      this.lastSearchResult = result;
      this.displaySearchResults(result);
      this.currentStepIdx = 0;
      this.log(`✅ Detour calculated instantly (${result.path_length} steps). Resuming delivery mission.`, "log-path");
      document.getElementById('hud-sim-status').textContent = "Detour Found. Resuming...";
      this.runDeliveryLoop();
    } else {
      this.log(`❌ Replanning Failed: Robot is trapped. No alternate 3D route to goal.`, "log-replan");
      document.getElementById('hud-sim-status').textContent = "Delivery Aborted: Trapped!";
      this.isDelivering = false;
      document.getElementById('btn-find-path').disabled = false;
    }
  }

  finishDelivery() {
    clearInterval(this.deliveryInterval);
    this.isDelivering = false;
    soundFX.playSuccess();
    this.log("🎉 Parcel delivered successfully to destination!", "log-path");
    document.getElementById('hud-sim-status').textContent = "Mission Complete! Parcel Delivered 🎉";
    document.getElementById('btn-start-delivery').disabled = true;
    document.getElementById('btn-find-path').disabled = false;
    document.getElementById('btn-pause-play').disabled = true;
    document.getElementById('btn-step-forward').disabled = true;
  }

  togglePauseDelivery() {
    this.isPaused = !this.isPaused;
    const btn = document.getElementById('btn-pause-play');
    btn.innerHTML = this.isPaused ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>';
    document.getElementById('hud-sim-status').textContent = this.isPaused ? "Delivery Paused" : "Delivering...";
  }

  stepDelivery() {
    if (!this.isDelivering || !this.lastSearchResult) return;
    this.isPaused = true;
    const path = this.lastSearchResult.path;
    if (this.currentStepIdx < path.length - 1) {
      this.currentStepIdx++;
      const pos = path[this.currentStepIdx];
      this.visualizer.updateRobotPosition(pos);
      this.updateHUDPos(pos);
      soundFX.playStep();
    }
  }

  injectObstacleAhead() {
    if (!this.lastSearchResult || !this.lastSearchResult.path) {
      this.log("Calculate a route first to inject obstacles along it.", "log-warning");
      return;
    }

    const path = this.lastSearchResult.path;
    // Pick 2 or 3 steps ahead of current robot position
    const targetIdx = Math.min(path.length - 1, this.currentStepIdx + 2);
    const cell = path[targetIdx];
    const k = Pathfinding3DEngine.key(cell.x, cell.y, cell.z);

    this.gridState.dynamicObstacles.add(k);
    this.visualizer.renderGridState(this.gridState, this.startPos, this.goalPos);
    this.log(`Injected dynamic blockage ahead at (${cell.x}, ${cell.y}, F${cell.z})`, "log-warning");

    if (this.isDelivering) {
      this.triggerDynamicReplan(path[this.currentStepIdx]);
    }
  }

  spawnRandomHazards(count = 3) {
    let added = 0;
    for (let i = 0; i < 50 && added < count; i++) {
      const rx = Math.floor(Math.random() * GRID_CONFIG.width);
      const ry = Math.floor(Math.random() * GRID_CONFIG.depth);
      const rz = Math.floor(Math.random() * GRID_CONFIG.height);
      const k = Pathfinding3DEngine.key(rx, ry, rz);

      if (
        (rx === this.startPos.x && ry === this.startPos.y && rz === this.startPos.z) ||
        (rx === this.goalPos.x && ry === this.goalPos.y && rz === this.goalPos.z) ||
        this.gridState.obstacles.has(k)
      ) continue;

      this.gridState.dynamicObstacles.add(k);
      added++;
    }

    this.visualizer.renderGridState(this.gridState, this.startPos, this.goalPos);
    this.log(`Spawned ${added} dynamic hazard cones across campus floors.`, "log-warning");

    if (this.isDelivering && this.lastSearchResult) {
      this.triggerDynamicReplan(this.lastSearchResult.path[this.currentStepIdx]);
    }
  }

  clearGrid() {
    this.resetSimulation();
    this.gridState.obstacles.clear();
    this.gridState.dynamicObstacles.clear();
    this.gridState.ramps.clear();
    this.gridState.elevators.clear();
    this.gridState.stairs.clear();
    this.visualizer.renderGridState(this.gridState, this.startPos, this.goalPos);
    this.log("Campus grid cleared.", "log-system");
  }

  generateRandomMaze() {
    this.clearGrid();
    for (let z = 0; z < GRID_CONFIG.height; z++) {
      for (let x = 0; x < GRID_CONFIG.width; x++) {
        for (let y = 0; y < GRID_CONFIG.depth; y++) {
          if (
            (x === this.startPos.x && y === this.startPos.y && z === this.startPos.z) ||
            (x === this.goalPos.x && y === this.goalPos.y && z === this.goalPos.z)
          ) continue;

          if (Math.random() < 0.18) {
            this.gridState.obstacles.add(Pathfinding3DEngine.key(x, y, z));
          }
        }
      }
      // Add a ramp per floor
      if (z < GRID_CONFIG.height - 1) {
        const rx = 3 + z * 3;
        const ry = 3 + z * 3;
        const k = Pathfinding3DEngine.key(rx, ry, z);
        this.gridState.obstacles.delete(k);
        this.gridState.ramps.add(k);
      }
    }

    // Add 1 central elevator
    const eShaft = new Set([0, 1, 2, 3]);
    this.gridState.elevators.set("8,8", eShaft);
    this.gridState.obstacles.delete("8,8,0");
    this.gridState.obstacles.delete("8,8,1");
    this.gridState.obstacles.delete("8,8,2");
    this.gridState.obstacles.delete("8,8,3");

    this.visualizer.renderGridState(this.gridState, this.startPos, this.goalPos);
    this.log("Generated randomized 3D campus maze layout.", "log-info");
  }

  resetSimulationStateOnly() {
    clearInterval(this.deliveryInterval);
    this.isDelivering = false;
    this.isPaused = false;
    this.currentStepIdx = 0;
    this.visualizer.clearSearchVisualization();
    this.visualizer.updateRobotPosition(this.startPos);
    this.updateHUDPos(this.startPos);
    document.getElementById('btn-start-delivery').disabled = true;
    document.getElementById('btn-find-path').disabled = false;
    document.getElementById('btn-pause-play').disabled = true;
    document.getElementById('btn-step-forward').disabled = true;
  }

  resetSimulation() {
    this.resetSimulationStateOnly();
    this.totalReplansCount = 0;
    this.batteryLevel = 100;
    document.getElementById('metric-replans').textContent = "0";
    document.getElementById('hud-robot-battery').textContent = "100%";
    document.getElementById('hud-sim-status').textContent = "Ready for Path Planning";
  }

  updateHUDPos(pos) {
    document.getElementById('hud-robot-pos').textContent = `(${pos.x}, ${pos.y}, ${pos.z})`;
    const floorNames = ["Ground Floor (F0)", "Engineering Labs (F1)", "Smart Library (F2)", "Sky-Deck Helipad (F3)"];
    document.getElementById('hud-robot-floor').textContent = floorNames[pos.z] || `Floor ${pos.z}`;
  }

  log(msg, typeClass = "log-system") {
    const box = document.getElementById('event-log-box');
    if (!box) return;
    const now = new Date();
    const timeStr = `[${now.toTimeString().split(' ')[0]}]`;

    const entry = document.createElement('div');
    entry.className = `log-entry ${typeClass}`;
    entry.innerHTML = `<span class="log-time">${timeStr}</span> <span class="log-text">${msg}</span>`;
    box.appendChild(entry);
    box.scrollTop = box.scrollHeight;
  }

  exportConnectorsForAPI() {
    const connectors = [];
    this.gridState.ramps.forEach(k => {
      const p = Pathfinding3DEngine.parseKey(k);
      connectors.push({ x: p.x, y: p.y, z: p.z, type: "ramp" });
    });
    this.gridState.stairs.forEach(k => {
      const p = Pathfinding3DEngine.parseKey(k);
      connectors.push({ x: p.x, y: p.y, z: p.z, type: "stairs" });
    });
    this.gridState.elevators.forEach((shaftFloors, shaftKey) => {
      const [x, y] = shaftKey.split(',').map(Number);
      const minZ = Math.min(...shaftFloors);
      const maxZ = Math.max(...shaftFloors);
      connectors.push({ x, y, z: minZ, type: "elevator", to_z: maxZ });
    });
    return connectors;
  }

  // ---------------------------------------------------------------------------
  // 3D Canvas Raycasting & Brush Painter
  // ---------------------------------------------------------------------------

  onCanvasMouseMove(event) {
    const rect = this.visualizer.renderer.domElement.getBoundingClientRect();
    this.visualizer.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.visualizer.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.visualizer.raycaster.setFromCamera(this.visualizer.mouse, this.visualizer.camera);
    const intersects = this.visualizer.raycaster.intersectObjects(this.visualizer.scene.children, true);

    const floorHit = intersects.find(i => i.object.geometry && i.object.geometry.type === 'BoxGeometry');

    if (floorHit) {
      const gridCoord = this.visualizer.worldToGrid(floorHit.point);
      if (this.activeFloor !== 'all') {
        gridCoord.z = this.activeFloor;
      }
      const wPos = this.visualizer.gridToWorld(gridCoord.x, gridCoord.y, gridCoord.z);
      this.visualizer.hoverCursorMesh.position.set(wPos.x, wPos.y + 0.1, wPos.z);
      this.visualizer.hoverCursorMesh.visible = true;

      this.updateInspector(gridCoord);
    } else {
      this.visualizer.hoverCursorMesh.visible = false;
    }
  }

  onCanvasClick(event) {
    const rect = this.visualizer.renderer.domElement.getBoundingClientRect();
    this.visualizer.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.visualizer.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.visualizer.raycaster.setFromCamera(this.visualizer.mouse, this.visualizer.camera);
    const intersects = this.visualizer.raycaster.intersectObjects(this.visualizer.scene.children, true);

    const floorHit = intersects.find(i => i.object.geometry && i.object.geometry.type === 'BoxGeometry');
    if (!floorHit) return;

    const gridCoord = this.visualizer.worldToGrid(floorHit.point);
    if (this.activeFloor !== 'all') {
      gridCoord.z = this.activeFloor;
    }

    this.applyBrush(gridCoord);
  }

  applyBrush(pos) {
    if (pos.x < 0 || pos.x >= GRID_CONFIG.width || pos.y < 0 || pos.y >= GRID_CONFIG.depth || pos.z < 0 || pos.z >= GRID_CONFIG.height) return;

    const k = Pathfinding3DEngine.key(pos.x, pos.y, pos.z);
    const shaftKey = `${pos.x},${pos.y}`;

    if (this.currentBrush === 'start') {
      this.startPos = { ...pos };
      this.gridState.obstacles.delete(k);
      this.gridState.dynamicObstacles.delete(k);
      this.log(`Start node set to (${pos.x}, ${pos.y}, F${pos.z})`, "log-info");
    } else if (this.currentBrush === 'goal') {
      this.goalPos = { ...pos };
      this.gridState.obstacles.delete(k);
      this.gridState.dynamicObstacles.delete(k);
      this.log(`Goal destination set to (${pos.x}, ${pos.y}, F${pos.z})`, "log-info");
    } else if (this.currentBrush === 'wall') {
      if (this.gridState.obstacles.has(k)) {
        this.gridState.obstacles.delete(k);
      } else {
        this.gridState.obstacles.add(k);
      }
    } else if (this.currentBrush === 'dynamic') {
      if (this.gridState.dynamicObstacles.has(k)) {
        this.gridState.dynamicObstacles.delete(k);
      } else {
        this.gridState.dynamicObstacles.add(k);
      }
    } else if (this.currentBrush === 'ramp') {
      if (this.gridState.ramps.has(k)) {
        this.gridState.ramps.delete(k);
      } else {
        this.gridState.ramps.add(k);
        this.gridState.obstacles.delete(k);
      }
    } else if (this.currentBrush === 'elevator') {
      if (this.gridState.elevators.has(shaftKey)) {
        this.gridState.elevators.delete(shaftKey);
      } else {
        const shaft = new Set([0, 1, 2, 3]);
        this.gridState.elevators.set(shaftKey, shaft);
        for (let z = 0; z < GRID_CONFIG.height; z++) {
          this.gridState.obstacles.delete(Pathfinding3DEngine.key(pos.x, pos.y, z));
        }
      }
    } else if (this.currentBrush === 'erase') {
      this.gridState.obstacles.delete(k);
      this.gridState.dynamicObstacles.delete(k);
      this.gridState.ramps.delete(k);
      this.gridState.stairs.delete(k);
      this.gridState.elevators.delete(shaftKey);
    }

    this.visualizer.renderGridState(this.gridState, this.startPos, this.goalPos);
    soundFX.playBeep(480, 'triangle', 0.05);
  }

  updateInspector(pos) {
    const inspector = document.getElementById('inspector-content');
    if (!inspector) return;

    const k = Pathfinding3DEngine.key(pos.x, pos.y, pos.z);
    let cellType = "Free Floor Space";
    let cost = "1.0";

    if (pos.x === this.startPos.x && pos.y === this.startPos.y && pos.z === this.startPos.z) {
      cellType = "Robot Start Beacon";
    } else if (pos.x === this.goalPos.x && pos.y === this.goalPos.y && pos.z === this.goalPos.z) {
      cellType = "Delivery Destination Goal";
    } else if (this.gridState.obstacles.has(k)) {
      cellType = "Solid Obstacle / Wall";
      cost = "∞ (Impassable)";
    } else if (this.gridState.dynamicObstacles.has(k)) {
      cellType = "Dynamic Hazard / Pedestrian";
      cost = "∞ (Blocked)";
    } else if (this.gridState.ramps.has(k)) {
      cellType = "Vertical Ramp (Connects Floor ±1)";
      cost = "2.0 (Climb Energy)";
    } else if (this.gridState.elevators.has(`${pos.x},${pos.y}`)) {
      cellType = "Express Elevator Shaft";
      cost = "1.0 / floor";
    }

    const h = Pathfinding3DEngine.heuristic(pos, this.goalPos, this.currentHeuristic, this.verticalCostWeight).toFixed(2);

    inspector.innerHTML = `
      <div class="inspector-grid-data">
        <div class="insp-row"><span class="k">Coordinates:</span><span class="v">(${pos.x}, ${pos.y}, Floor ${pos.z})</span></div>
        <div class="insp-row"><span class="k">Cell Type:</span><span class="v text-accent">${cellType}</span></div>
        <div class="insp-row"><span class="k">Base Move Cost:</span><span class="v">${cost}</span></div>
        <div class="insp-row"><span class="k">Heuristic h(n):</span><span class="v text-purple">${h}</span></div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Comparison Modal Benchmark
  // ---------------------------------------------------------------------------

  openComparisonModal() {
    document.getElementById('modal-compare').classList.add('show');
    this.runBenchmark();
  }

  closeComparisonModal() {
    document.getElementById('modal-compare').classList.remove('show');
  }

  async runBenchmark() {
    const tbody = document.getElementById('benchmark-table-body');
    tbody.innerHTML = `<tr><td colspan="7" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Running 3D benchmark on current campus map...</td></tr>`;

    let compareData = null;

    if (this.backendOnline) {
      try {
        const payload = {
          heuristic: this.currentHeuristic,
          vertical_weight: this.verticalCostWeight,
          grid_size: { x: GRID_CONFIG.width, y: GRID_CONFIG.depth, z: GRID_CONFIG.height },
          start: this.startPos,
          goal: this.goalPos,
          obstacles: Array.from(this.gridState.obstacles).map(k => Pathfinding3DEngine.parseKey(k)),
          dynamic_obstacles: Array.from(this.gridState.dynamicObstacles).map(k => Pathfinding3DEngine.parseKey(k)),
          connectors: this.exportConnectorsForAPI()
        };

        const res = await fetch('/api/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) compareData = await res.json();
      } catch (e) {}
    }

    if (!compareData) {
      const astarRes = Pathfinding3DEngine.solve(this.gridState, this.startPos, this.goalPos, 'astar', this.currentHeuristic, this.verticalCostWeight);
      const greedyRes = Pathfinding3DEngine.solve(this.gridState, this.startPos, this.goalPos, 'greedy', this.currentHeuristic, this.verticalCostWeight);
      const dijkstraRes = Pathfinding3DEngine.solve(this.gridState, this.startPos, this.goalPos, 'dijkstra', this.currentHeuristic, this.verticalCostWeight);
      compareData = { astar: astarRes, greedy: greedyRes, dijkstra: dijkstraRes };
    }

    const rows = [
      { name: "3D A* Search", func: "f(n) = g(n) + h(n)", res: compareData.astar, optimal: "✅ Optimal", color: "highlight-green" },
      { name: "3D Greedy Best-First", func: "f(n) = h(n)", res: compareData.greedy, optimal: "⚠️ Suboptimal", color: "highlight-amber" },
      { name: "3D Dijkstra (UCS)", func: "f(n) = g(n)", res: compareData.dijkstra, optimal: "✅ Optimal", color: "highlight-purple" }
    ];

    let html = "";
    rows.forEach(r => {
      html += `
        <tr>
          <td><strong>${r.name}</strong></td>
          <td><code>${r.func}</code></td>
          <td>${r.res.path_length || 'N/A'}</td>
          <td class="${r.color}"><strong>${r.res.total_cost || 'N/A'}</strong></td>
          <td>${r.res.nodes_explored}</td>
          <td>${r.res.time_ms.toFixed(2)} ms</td>
          <td>${r.optimal}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }
}

// =============================================================================
// Bootstrap on Window Load
// =============================================================================

window.addEventListener('DOMContentLoaded', () => {
  window.app = new SmartCampusSimulationApp();
});
