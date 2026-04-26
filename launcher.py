#!/usr/bin/env python3
"""
Horror Game - Professional Launcher with React UI
Integrates React-based main menu with Pygame gameplay
"""

import subprocess
import sys
import os
import threading
import time
import socket
import json
from http.server import HTTPServer, SimpleHTTPRequestHandler

# Start React UI server in background
def start_ui_server():
    """Start Vite dev server for UI"""
    ui_dir = os.path.join(os.path.dirname(__file__), 'ui')
    print("🖥️  Starting UI server...")
    
    # For production, serve the built files
    # For dev, you could use: subprocess.run(['npm', 'run', 'dev'], cwd=ui_dir)
    
    # Simple HTTP server for built files
    dist_dir = os.path.join(ui_dir, 'dist')
    os.chdir(dist_dir)
    
    server = HTTPServer(('localhost', 8080), SimpleHTTPRequestHandler)
    print("✅ UI available at http://localhost:8080")
    server.serve_forever()

# Start UI server in background thread
ui_thread = threading.Thread(target=start_ui_server, daemon=True)
ui_thread.start()

# Wait for server to start
time.sleep(2)

# Open browser with UI
print("🌐 Opening game UI in browser...")
try:
    if sys.platform == 'darwin':  # macOS
        subprocess.run(['open', 'http://localhost:8080'])
    elif sys.platform == 'win32':  # Windows
        subprocess.run(['start', 'http://localhost:8080'], shell=True)
    else:  # Linux
        subprocess.run(['xdg-open', 'http://localhost:8080'])
except Exception as e:
    print(f"⚠️  Could not open browser: {e}")
    print("👉 Manually open: http://localhost:8080")

print("\n🎮 Game UI running!")
print("Press CTRL+C to exit")

# Keep the launcher running
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\n👋 Shutting down...")
    sys.exit(0)
