/**
 * Signaling Server for Horror Game P2P
 * Uses Socket.IO for WebRTC connection setup
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;

// Game Rooms with Host Migration Support
const rooms = new Map();

// Anti-Cheat: Rate limiting
const rateLimits = new Map();

function checkRateLimit(socketId) {
    const now = Date.now();
    const limit = rateLimits.get(socketId) || { count: 0, resetAt: now + 1000 };
    
    if (now > limit.resetAt) {
        limit.count = 0;
        limit.resetAt = now + 1000;
    }
    
    limit.count++;
    rateLimits.set(socketId, limit);
    
    // Max 30 messages per second
    return limit.count <= 30;
}

io.on('connection', (socket) => {
    console.log(`🔌 Player connected: ${socket.id}`);
    
    socket.on('create-room', (callback) => {
        const roomId = crypto.randomBytes(4).toString('hex');
        rooms.set(roomId, {
            hostId: socket.id,
            players: [{ id: socket.id, isHost: true }],
            hostMigrationQueue: []
        });
        socket.join(roomId);
        console.log(`🏠 Room created: ${roomId} by ${socket.id}`);
        callback({ roomId, success: true });
    });
    
    socket.on('join-room', (roomId, callback) => {
        const room = rooms.get(roomId);
        if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
        }
        
        socket.join(roomId);
        room.players.push({ id: socket.id, isHost: false });
        
        // Notify all players in room
        io.to(roomId).emit('player-joined', {
            playerId: socket.id,
            players: room.players,
            isHost: room.hostId === socket.id
        });
        
        // Send host info to joining player
        callback({ 
            success: true, 
            hostId: room.hostId,
            players: room.players
        });
    });
    
    // WebRTC Signaling
    socket.on('offer', ({ roomId, offer, targetId }) => {
        if (!checkRateLimit(socket.id)) {
            socket.emit('error', { message: 'Rate limit exceeded' });
            return;
        }
        io.to(targetId).emit('offer', { offer, fromId: socket.id });
    });
    
    socket.on('answer', ({ roomId, answer, targetId }) => {
        if (!checkRateLimit(socket.id)) return;
        io.to(targetId).emit('answer', { answer, fromId: socket.id });
    });
    
    socket.on('ice-candidate', ({ roomId, candidate, targetId }) => {
        if (!checkRateLimit(socket.id)) return;
        io.to(targetId).emit('ice-candidate', { candidate, fromId: socket.id });
    });
    
    // Host Migration: New host election
    socket.on('host-disconnect', (roomId) => {
        const room = rooms.get(roomId);
        if (!room || room.hostId !== socket.id) return;
        
        // Elect new host from migration queue
        if (room.hostMigrationQueue.length > 0) {
            const newHostId = room.hostMigrationQueue.shift();
            room.hostId = newHostId;
            
            // Update player states
            room.players.forEach(p => {
                p.isHost = (p.id === newHostId);
            });
            
            io.to(roomId).emit('host-migrated', { 
                newHostId,
                players: room.players 
            });
            console.log(`👑 Host migrated to ${newHostId}`);
        } else {
            // No players left, cleanup room
            rooms.delete(roomId);
            console.log(`🗑️ Room ${roomId} deleted`);
        }
    });
    
    // Player state updates (relayed through signaling for initial sync)
    socket.on('player-state', ({ roomId, state }) => {
        if (!checkRateLimit(socket.id)) return;
        
        // Validate state (Anti-Cheat)
        if (!validatePlayerState(state)) {
            socket.emit('warning', { message: 'Invalid state detected' });
            return;
        }
        
        socket.to(roomId).emit('player-state', {
            playerId: socket.id,
            state
        });
    });
    
    socket.on('disconnect', () => {
        console.log(`❌ Player disconnected: ${socket.id}`);
        
        // Handle host disconnect
        rooms.forEach((room, roomId) => {
            if (room.hostId === socket.id) {
                io.to(roomId).emit('host-left', { roomId });
                
                // Queue migration
                const otherPlayers = room.players.filter(p => p.id !== socket.id);
                if (otherPlayers.length > 0) {
                    room.hostMigrationQueue = otherPlayers.map(p => p.id);
                }
            }
            
            room.players = room.players.filter(p => p.id !== socket.id);
            if (room.players.length === 0) {
                rooms.delete(roomId);
            } else {
                io.to(roomId).emit('player-left', { playerId: socket.id });
            }
        });
        
        rateLimits.delete(socket.id);
    });
});

// Anti-Cheat: Basic position validation
function validatePlayerState(state) {
    if (!state.x || !state.y) return false;
    
    // Check bounds (SCREEN_WIDTH=800, SCREEN_HEIGHT=600)
    if (state.x < -100 || state.x > 900) return false;
    if (state.y < -100 || state.y > 700) return false;
    
    // Check speed hack (max 10 pixels per update)
    if (state.lastX && state.lastY) {
        const dx = Math.abs(state.x - state.lastX);
        const dy = Math.abs(state.y - state.lastY);
        if (dx > 10 || dy > 10) return false;
    }
    
    return true;
}

server.listen(PORT, () => {
    console.log(`🎮 Signaling Server running on port ${PORT}`);
    console.log(`   Share your IP for others to join`);
});
