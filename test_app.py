"""
Unit & Integration Test Suite for Smart Campus Delivery Robot 3D
Tests 3D A*, Greedy Best-First, Dijkstra, Multi-floor Ramps/Elevators, and REST APIs.
"""

import unittest
import json
from app import app, CampusGrid3D, run_3d_search, CAMPUS_SCENARIOS


class TestCampus3DPathfinding(unittest.TestCase):

    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_health_endpoint(self):
        """Verify /api/health endpoint returns healthy status."""
        response = self.app.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data["status"], "healthy")
        self.assertIn("astar", data["algorithms"])

    def test_scenarios_endpoint(self):
        """Verify /api/scenarios endpoint returns preset scenarios."""
        response = self.app.get('/api/scenarios')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertGreaterEqual(len(data["scenarios"]), 4)

    def test_3d_astar_single_floor(self):
        """Test A* on a single 2D plane inside the 3D grid."""
        grid = CampusGrid3D(width=10, depth=10, height=2)
        # Place a wall at (5, 5, 0)
        grid.obstacles.add((5, 5, 0))
        
        res = run_3d_search(grid, start=(0, 0, 0), goal=(9, 9, 0), algorithm="astar")
        self.assertTrue(res.found)
        self.assertEqual(res.path[0]["x"], 0)
        self.assertEqual(res.path[-1]["x"], 9)
        self.assertEqual(res.path[-1]["y"], 9)
        self.assertEqual(res.path[-1]["z"], 0)
        self.assertEqual(res.floors_traversed, 0)

    def test_3d_astar_multi_floor_ramp(self):
        """Test vertical transition using ramps from Floor 0 to Floor 1."""
        grid = CampusGrid3D(width=8, depth=8, height=3)
        # Ramp at (4, 4, 0)
        grid.ramps.add((4, 4, 0))
        
        res = run_3d_search(grid, start=(0, 0, 0), goal=(7, 7, 1), algorithm="astar")
        self.assertTrue(res.found)
        self.assertEqual(res.floors_traversed, 1)
        self.assertGreater(res.vertical_energy, 0)

    def test_3d_astar_elevator_shaft(self):
        """Test direct vertical elevator traversal across multiple floors."""
        grid = CampusGrid3D(width=10, depth=10, height=4)
        # Elevator shaft at (5, 5) spanning floors 0-3
        grid.elevators[(5, 5)] = {0, 1, 2, 3}
        for z in range(4):
            grid.cells[(5, 5, z)] = 3  # CELL_ELEVATOR
            
        res = run_3d_search(grid, start=(0, 0, 0), goal=(9, 9, 3), algorithm="astar")
        self.assertTrue(res.found)
        self.assertEqual(res.floors_traversed, 3)

    def test_3d_greedy_vs_astar_benchmark(self):
        """Compare Greedy BFS with A* on Library scenario."""
        scenario = CAMPUS_SCENARIOS["library_to_dorms"]
        grid = CampusGrid3D.from_dict(scenario)
        
        start = (scenario["start"]["x"], scenario["start"]["y"], scenario["start"]["z"])
        goal = (scenario["goal"]["x"], scenario["goal"]["y"], scenario["goal"]["z"])

        res_astar = run_3d_search(grid, start, goal, algorithm="astar")
        res_greedy = run_3d_search(grid, start, goal, algorithm="greedy")

        self.assertTrue(res_astar.found)
        self.assertTrue(res_greedy.found)
        # A* cost must be <= Greedy cost (Optimality guarantee)
        self.assertLessEqual(res_astar.total_cost, res_greedy.total_cost + 0.001)

    def test_dynamic_replanning_api(self):
        """Test POST /api/replan when dynamic obstacle is added."""
        payload = {
            "algorithm": "astar",
            "current": {"x": 2, "y": 2, "z": 0},
            "goal": {"x": 6, "y": 6, "z": 0},
            "grid_size": {"x": 8, "y": 8, "z": 2},
            "new_obstacles": [{"x": 3, "y": 2, "z": 0}]
        }
        response = self.app.post('/api/replan', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data["found"])
        self.assertTrue(data["replan_triggered"])


if __name__ == '__main__':
    unittest.main()
