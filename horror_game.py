#!/usr/bin/env python3
"""
P2P Horror Game - Simple multiplayer horror experience
Host/Client model for peer-to-peer gameplay
"""

import pygame
import socket
import threading
import random
import sys
import json

# Game Constants
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
FPS = 60

# Colors
BLACK = (0, 0, 0)
RED = (139, 0, 0)
WHITE = (255, 255, 255)
GRAY = (50, 50, 50)

class Player:
    def __init__(self, x, y, color, is_local=False):
        self.x = x
        self.y = y
        self.color = color
        self.speed = 5
        self.is_local = is_local
        self.width = 40
        self.height = 60
        
    def move(self, dx, dy):
        self.x += dx * self.speed
        self.y += dy * self.speed
        # Keep in bounds
        self.x = max(0, min(SCREEN_WIDTH - self.width, self.x))
        self.y = max(0, min(SCREEN_HEIGHT - self.height, self.y))
    
    def draw(self, screen):
        pygame.draw.rect(screen, self.color, (self.x, self.y, self.width, self.height))
        # Eyes
        eye_color = RED if not self.is_local else WHITE
        pygame.draw.circle(screen, eye_color, (int(self.x + 12), int(self.y + 15)), 5)
        pygame.draw.circle(screen, eye_color, (int(self.x + 28), int(self.y + 15)), 5)

class Ghost:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.speed = 2
        self.direction = random.choice([(1,0), (-1,0), (0,1), (0,-1)])
        self.change_timer = 0
        self.radius = 25
        
    def update(self):
        self.change_timer += 1
        if self.change_timer > 60:
            self.direction = random.choice([(1,0), (-1,0), (0,1), (0,-1)])
            self.change_timer = 0
        
        dx, dy = self.direction
        self.x += dx * self.speed
        self.y += dy * self.speed
        
        # Bounce off walls
        if self.x <= 0 or self.x >= SCREEN_WIDTH:
            self.direction = (-self.direction[0], self.direction[1])
        if self.y <= 0 or self.y >= SCREEN_HEIGHT:
            self.direction = (self.direction[0], -self.direction[1])
    
    def draw(self, screen):
        pygame.draw.circle(screen, WHITE, (int(self.x), int(self.y)), self.radius)
        # Scary face
        pygame.draw.circle(screen, BLACK, (int(self.x - 8), int(self.y - 5)), 4)
        pygame.draw.circle(screen, BLACK, (int(self.x + 8), int(self.y - 5)), 4)
        pygame.draw.arc(screen, BLACK, (self.x - 15, self.y - 10, 30, 20), 3.14, 0, 3)

class Game:
    def __init__(self, mode="singleplayer", host=None):
        pygame.init()
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("👻 Horror Game - P2P Multiplayer")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.Font(None, 36)
        
        self.mode = mode
        self.host = host
        self.running = True
        self.connected = False
        self.other_players = []
        
        # Local player
        self.player = Player(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2, (0, 100, 255), is_local=True)
        
        # Ghosts
        self.ghosts = [Ghost(random.randint(50, SCREEN_WIDTH-50), random.randint(50, SCREEN_HEIGHT-50)) 
                       for _ in range(5)]
        
        # Network
        self.sock = None
        self.network_thread = None
        
        if mode == "host":
            self.start_host()
        elif mode == "client":
            self.connect_to_host(host)
    
    def start_host(self):
        """Start as host server"""
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind(("0.0.0.0", 5000))
        self.sock.settimeout(0.1)
        print("🎮 Hosting game on port 5000...")
        self.network_thread = threading.Thread(target=self.host_loop, daemon=True)
        self.network_thread.start()
    
    def connect_to_host(self, host_ip):
        """Connect to host"""
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.settimeout(0.1)
            self.server_address = (host_ip, 5000)
            self.sock.connect(self.server_address)
            self.connected = True
            print(f"✅ Connected to {host_ip}")
            
            # Send join message
            self.send_data({"type": "join", "x": self.player.x, "y": self.player.y})
            
            self.network_thread = threading.Thread(target=self.client_loop, daemon=True)
            self.network_thread.start()
        except Exception as e:
            print(f"❌ Connection failed: {e}")
    
    def host_loop(self):
        """Host receives player positions"""
        while self.running:
            try:
                data, addr = self.sock.recvfrom(1024)
                msg = json.loads(data.decode())
                
                if msg["type"] == "join":
                    # Create remote player
                    remote_player = Player(msg["x"], msg["y"], (255, 100, 100))
                    self.other_players.append(remote_player)
                    print(f"👤 Player joined from {addr}")
                
                elif msg["type"] == "move":
                    if self.other_players:
                        self.other_players[0].x = msg["x"]
                        self.other_players[0].y = msg["y"]
                
                # Broadcast all positions back
                self.broadcast_positions()
            except socket.timeout:
                pass
            except Exception as e:
                print(f"Network error: {e}")
    
    def client_loop(self):
        """Client receives game state"""
        while self.running:
            try:
                data, _ = self.sock.recvfrom(1024)
                msg = json.loads(data.decode())
                
                if msg["type"] == "state":
                    # Update other players
                    self.other_players = []
                    for p in msg.get("players", []):
                        if not p.get("is_local"):
                            remote = Player(p["x"], p["y"], (255, 100, 100))
                            self.other_players.append(remote)
            except socket.timeout:
                pass
            except Exception as e:
                print(f"Network error: {e}")
    
    def broadcast_positions(self):
        """Send all player positions to everyone"""
        if not self.sock:
            return
        
        state = {
            "type": "state",
            "players": [{"x": self.player.x, "y": self.player.y, "is_local": True}]
        }
        
        # Send to all known clients (simplified - would need proper tracking)
        try:
            self.sock.sendto(json.dumps(state).encode(), ("255.255.255.255", 5000))
        except:
            pass
    
    def send_data(self, data):
        """Send data to host"""
        if self.sock and self.connected:
            try:
                self.sock.sendto(json.dumps(data).encode(), self.server_address)
            except:
                pass
    
    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    self.running = False
    
    def update(self):
        keys = pygame.key.get_pressed()
        dx = (keys[pygame.K_RIGHT] or keys[pygame.K_d]) - (keys[pygame.K_LEFT] or keys[pygame.K_a])
        dy = (keys[pygame.K_DOWN] or keys[pygame.K_s]) - (keys[pygame.K_UP] or keys[pygame.K_w])
        
        if dx or dy:
            self.player.move(dx, dy)
            
            # Send position to host if client
            if self.mode == "client" and self.connected:
                self.send_data({"type": "move", "x": self.player.x, "y": self.player.y})
        
        # Update ghosts
        for ghost in self.ghosts:
            ghost.update()
            
            # Check collision with player
            dist = ((self.player.x + 20 - ghost.x)**2 + **(self.player.y + 30 - ghost.y)2)**0.5
            if dist < ghost.radius + 20:
                # Jump scare effect
                self.screen.fill(RED)
                pygame.display.flip()
                pygame.time.wait(100)
    
    def draw(self):
        self.screen.fill(BLACK)
        
        # Draw player
        self.player.draw(self.screen)
        
        # Draw other players
        for player in self.other_players:
            player.draw(self.screen)
        
        # Draw ghosts
        for ghost in self.ghosts:
            ghost.draw(self.screen)
        
        # Draw UI
        mode_text = f"Mode: {self.mode.upper()}"
        if self.mode == "client":
            mode_text += " (Connected)" if self.connected else " (Disconnected)"
        
        text = self.font.render(mode_text, True, WHITE)
        self.screen.blit(text, (10, 10))
        
        instructions = self.font.render("WASD/Arrows to move | ESC to quit", True, GRAY)
        self.screen.blit(instructions, (10, SCREEN_HEIGHT - 40))
        
        pygame.display.flip()
    
    def run(self):
        while self.running:
            self.handle_events()
            self.update()
            self.draw()
            self.clock.tick(FPS)
        
        pygame.quit()

def main():
    print("👻 HORROR GAME - P2P Multiplayer")
    print("=" * 40)
    print("1. Singleplayer")
    print("2. Host Game (P2P)")
    print("3. Join Game (enter host IP)")
    print("=" * 40)
    
    choice = input("Choose mode (1-3): ").strip()
    
    if choice == "1":
        game = Game(mode="singleplayer")
    elif choice == "2":
        game = Game(mode="host")
        print(f"Your IP: Share this with friends to join")
        game.run()
    elif choice == "3":
        host_ip = input("Enter host IP address: ").strip()
        game = Game(mode="client", host=host_ip)
        game.run()
    else:
        print("Invalid choice!")
        sys.exit(1)
    
    game.run()

if __name__ == "__main__":
    main()
