/**
 * Multiplayer Network Module - Phase 5
 * WebRTC Data Channels für Low-Latency P2P Kommunikation
 * Mit Host-Migration, State Interpolation und Anti-Cheat Basics
 */

import { io } from 'https://cdn.socket.io/4.7.2/socket.io.esm.min.js';
import Peer from 'https://cdn.jsdelivr.net/npm/simple-peer@9.11.4/+esm';

// ===== KONFIGURATION =====
const CONFIG = {
    SIGNALING_SERVER: window.location.hostname + ':3000',
    INTERPOLATION_DELAY_MS: 100,  // Delay für smooth interpolation
    EXTRAPOLATION_LIMIT_MS: 200,  // Max Zeit für Extrapolation
    SNAPSHOT_RATE_MS: 50,         // State Snapshots alle 50ms
    ANTI_CHEAT_MAX_SPEED: 15,     // Max Einheiten pro Sekunde
};

// ===== GLOBALE STATE =====
export const networkState = {
    socket: null,
    roomId: null,
    isHost: false,
    peerId: null,
    peers: new Map(),          // peerId -> { peer, dataChannel, lastState }
    localPlayerId: null,
    remotePlayers: new Map(),  // playerId -> interpolated state
    stateHistory: new Map(),   // playerId -> [{timestamp, state}, ...]
    connected: false
};

// ===== INIT =====
export function initNetwork() {
    console.log('🌐 Initializing Network Module...');
    
    // Socket.IO Verbindung zum Signaling Server
    networkState.socket = io(`http://${CONFIG.SIGNALING_SERVER}`, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5
    });
    
    setupSocketListeners();
    
    return networkState;
}

// ===== SOCKET LISTENERS =====
function setupSocketListeners() {
    networkState.socket.on('connect', () => {
        console.log('📡 Connected to signaling server');
        networkState.connected = true;
    });
    
    networkState.socket.on('disconnect', () => {
        console.log('❌ Disconnected from signaling server');
        networkState.connected = false;
    });
    
    networkState.socket.on('player-joined', (data) => {
        console.log('👤 Player joined:', data);
        
        // Wenn ich Host bin, erstelle Peer für neuen Spieler
        if (networkState.isHost && data.playerId !== networkState.localPlayerId) {
            createPeer(data.playerId, true); // initiator = true
        }
        
        // Remote Players Liste aktualisieren
        updateRemotePlayersList(data.players);
    });
    
    networkState.socket.on('player-left', (data) => {
        console.log('👋 Player left:', data.playerId);
        removePeer(data.playerId);
    });
    
    networkState.socket.on('host-migrated', (data) => {
        console.log('👑 Host migrated to:', data.newHostId);
        networkState.isHost = (data.newHostId === networkState.localPlayerId);
        
        // Wenn ich neuer Host bin, muss ich Peers zu allen anderen aufbauen
        if (networkState.isHost) {
            setTimeout(() => {
                data.players.forEach(p => {
                    if (p.id !== networkState.localPlayerId && !p.isHost) {
                        createPeer(p.id, true);
                    }
                });
            }, 500);
        }
    });
    
    networkState.socket.on('host-left', (data) => {
        console.log('⚠️ Host left room');
        networkState.isHost = false;
    });
    
    // WebRTC Signaling Messages
    networkState.socket.on('offer', async (data) => {
        console.log('📨 Received offer from:', data.fromId);
        
        const peer = createPeer(data.fromId, false);
        peer.signal(data.offer);
    });
    
    networkState.socket.on('answer', (data) => {
        console.log('📨 Received answer from:', data.fromId);
        
        const peerData = networkState.peers.get(data.fromId);
        if (peerData) {
            peerData.peer.signal(data.answer);
        }
    });
    
    networkState.socket.on('ice-candidate', (data) => {
        console.log('🧊 Received ICE candidate from:', data.fromId);
        // Simple-Peer handle ICE automatisch
    });
    
    // Remote Player State empfangen
    networkState.socket.on('player-state', (data) => {
        if (data.playerId && data.state) {
            addStateSnapshot(data.playerId, data.state);
        }
    });
}

// ===== PEER MANAGEMENT =====
export function createPeer(targetId, initiator = false) {
    if (networkState.peers.has(targetId)) {
        console.log('⚠️ Peer already exists for:', targetId);
        return networkState.peers.get(targetId).peer;
    }
    
    console.log(`🔗 Creating peer connection to ${targetId} (initiator: ${initiator})`);
    
    const peer = new Peer({
        initiator: initiator,
        trickle: false,
        stream: null,  // Nur Data Channel, kein Video/Audio
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });
    
    const peerData = {
        peer: peer,
        dataChannel: null,
        targetId: targetId,
        connected: false,
        lastState: null
    };
    
    // Peer Events
    peer.on('signal', (signalData) => {
        console.log('📤 Sending signal data to:', targetId);
        
        if (initiator) {
            networkState.socket.emit('offer', {
                roomId: networkState.roomId,
                offer: signalData,
                targetId: targetId
            });
        } else {
            networkState.socket.emit('answer', {
                roomId: networkState.roomId,
                answer: signalData,
                targetId: targetId
            });
        }
    });
    
    peer.on('connect', () => {
        console.log('✅ Peer connected to:', targetId);
        peerData.connected = true;
        peerData.dataChannel = peer._dc;  // Simple-Peer internal data channel
        
        // Data Channel Events
        peer.on('data', (data) => {
            handleIncomingData(targetId, data);
        });
        
        // Initial State Sync nach Connection
        syncInitialState(targetId);
    });
    
    peer.on('error', (err) => {
        console.error('❌ Peer error with', targetId, ':', err);
        removePeer(targetId);
    });
    
    peer.on('close', () => {
        console.log('🚪 Peer connection closed:', targetId);
        removePeer(targetId);
    });
    
    networkState.peers.set(targetId, peerData);
    return peer;
}

export function removePeer(targetId) {
    const peerData = networkState.peers.get(targetId);
    if (peerData) {
        try {
            peerData.peer.destroy();
        } catch (e) {
            console.warn('Error destroying peer:', e);
        }
        networkState.peers.delete(targetId);
    }
    networkState.remotePlayers.delete(targetId);
    networkState.stateHistory.delete(targetId);
}

// ===== DATA CHANNEL KOMMUNIKATION =====
function handleIncomingData(fromId, data) {
    try {
        const message = JSON.parse(data);
        
        switch (message.type) {
            case 'PLAYER_STATE':
                addStateSnapshot(fromId, message.state);
                break;
            case 'PLAYER_ACTION':
                handlePlayerAction(fromId, message.action);
                break;
            case 'ANTI_CHEAT_ALERT':
                console.warn('⚠️ Anti-Cheat Alert from', fromId, ':', message.reason);
                break;
            default:
                console.warn('Unknown message type:', message.type);
        }
    } catch (e) {
        console.error('Error parsing incoming data:', e);
    }
}

export function sendPlayerState(state) {
    const message = JSON.stringify({
        type: 'PLAYER_STATE',
        state: {
            ...state,
            timestamp: Date.now()
        }
    });
    
    // Über Data Channels an alle Peers senden (Low-Latency)
    networkState.peers.forEach((peerData, peerId) => {
        if (peerData.connected && peerData.dataChannel) {
            try {
                peerData.dataChannel.send(message);
            } catch (e) {
                console.warn('Failed to send state to', peerId, ':', e);
            }
        }
    });
    
    // Auch über Socket.IO für Fallback und neue Spieler
    if (networkState.roomId) {
        networkState.socket.emit('player-state', {
            roomId: networkState.roomId,
            state: state
        });
    }
}

export function sendPlayerAction(action) {
    const message = JSON.stringify({
        type: 'PLAYER_ACTION',
        action: {
            ...action,
            timestamp: Date.now()
        }
    });
    
    networkState.peers.forEach((peerData, peerId) => {
        if (peerData.connected && peerData.dataChannel) {
            try {
                peerData.dataChannel.send(message);
            } catch (e) {
                console.warn('Failed to send action to', peerId);
            }
        }
    });
}

function handlePlayerAction(fromId, action) {
    console.log(`🎮 Action from ${fromId}:`, action.type);
    // Hier Actions verarbeiten (z.B. Interaktionen, Attacks)
}

function syncInitialState(targetId) {
    // Send initial state to newly connected peer
    const initMessage = JSON.stringify({
        type: 'INIT_STATE',
        state: {
            position: { x: 0, y: 1.7, z: 5 },
            rotation: { x: 0, y: 0 },
            health: 100,
            sanity: 100
        }
    });
    
    const peerData = networkState.peers.get(targetId);
    if (peerData && peerData.dataChannel) {
        peerData.dataChannel.send(initMessage);
    }
}

// ===== STATE INTERPOLATION / EXTRAPOLATION =====
export function addStateSnapshot(playerId, state) {
    if (!networkState.stateHistory.has(playerId)) {
        networkState.stateHistory.set(playerId, []);
    }
    
    const history = networkState.stateHistory.get(playerId);
    const snapshot = {
        timestamp: state.timestamp || Date.now(),
        state: { ...state }
    };
    
    history.push(snapshot);
    
    // History begrenzen (letzte 2 Sekunden)
    const maxAge = 2000;
    const now = Date.now();
    while (history.length > 0 && now - history[0].timestamp > maxAge) {
        history.shift();
    }
    
    // Interpolierten State berechnen
    interpolateState(playerId);
}

export function interpolateState(playerId) {
    const history = networkState.stateHistory.get(playerId);
    if (!history || history.length < 2) {
        // Nicht genug Daten für Interpolation
        if (history && history.length === 1) {
            networkState.remotePlayers.set(playerId, history[0].state);
        }
        return;
    }
    
    const now = Date.now();
    const targetTime = now - CONFIG.INTERPOLATION_DELAY_MS;
    
    // Finde Snapshots vor und nach targetTime
    let before = null;
    let after = null;
    
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].timestamp <= targetTime) {
            before = history[i];
            after = history[i + 1] || history[i];
            break;
        }
    }
    
    if (!before) {
        before = history[history.length - 1];
        after = before;
    }
    
    // Interpolation Factor
    const duration = after.timestamp - before.timestamp;
    const t = duration > 0 ? (targetTime - before.timestamp) / duration : 0;
    const clampedT = Math.max(0, Math.min(1, t));
    
    // Position interpolieren
    const interpolated = {
        x: lerp(before.state.x || 0, after.state.x || 0, clampedT),
        y: lerp(before.state.y || 0, after.state.y || 0, clampedT),
        z: lerp(before.state.z || 0, after.state.z || 0, clampedT),
        rotation: {
            x: lerp(before.state.rotation?.x || 0, after.state.rotation?.x || 0, clampedT),
            y: lerp(before.state.rotation?.y || 0, after.state.rotation?.y || 0, clampedT)
        },
        health: after.state.health || 100,
        sanity: after.state.sanity || 100
    };
    
    networkState.remotePlayers.set(playerId, interpolated);
}

export function extrapolateState(playerId) {
    const history = networkState.stateHistory.get(playerId);
    if (!history || history.length < 2) {
        return networkState.remotePlayers.get(playerId);
    }
    
    const last = history[history.length - 1];
    const secondLast = history[history.length - 2];
    
    // Velocity berechnen
    const dt = (last.timestamp - secondLast.timestamp) / 1000; // in Sekunden
    const velocity = {
        x: (last.state.x - secondLast.state.x) / dt,
        y: (last.state.y - secondLast.state.y) / dt,
        z: (last.state.z - secondLast.state.z) / dt
    };
    
    // Extrapolate basierend auf Zeit seit letztem Snapshot
    const timeSinceLast = (Date.now() - last.timestamp) / 1000;
    
    // Anti-Cheat: Extrapolation limitieren
    const clampedTime = Math.min(timeSinceLast, CONFIG.EXTRAPOLATION_LIMIT_MS / 1000);
    
    return {
        x: last.state.x + velocity.x * clampedTime,
        y: last.state.y + velocity.y * clampedTime,
        z: last.state.z + velocity.z * clampedTime,
        rotation: last.state.rotation,
        health: last.state.health,
        sanity: last.state.sanity
    };
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

// ===== ANTI-CHEAT =====
export function validateLocalState(currentState, previousState) {
    if (!previousState) return true;
    
    const dt = (currentState.timestamp - previousState.timestamp) / 1000;
    if (dt <= 0) return true;
    
    const dx = Math.abs(currentState.x - previousState.x);
    const dy = Math.abs(currentState.y - previousState.y);
    const dz = Math.abs(currentState.z - previousState.z);
    
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const speed = distance / dt;
    
    if (speed > CONFIG.ANTI_CHEAT_MAX_SPEED) {
        console.warn('⚠️ Speed hack detected! Speed:', speed.toFixed(2), 'units/s');
        return false;
    }
    
    // Bounds Check (abhängig von der aktuellen Scene)
    const MAX_BOUNDS = 100;
    if (Math.abs(currentState.x) > MAX_BOUNDS || 
        Math.abs(currentState.y) > MAX_BOUNDS || 
        Math.abs(currentState.z) > MAX_BOUNDS) {
        console.warn('⚠️ Out of bounds detected!');
        return false;
    }
    
    return true;
}

export function reportCheater(playerId, reason) {
    if (networkState.isHost) {
        networkState.socket.emit('cheat-report', {
            roomId: networkState.roomId,
            cheaterId: playerId,
            reason: reason
        });
        
        // Alle Peers benachrichtigen
        const alertMessage = JSON.stringify({
            type: 'ANTI_CHEAT_ALERT',
            reason: reason
        });
        
        networkState.peers.forEach((peerData) => {
            if (peerData.connected && peerData.dataChannel) {
                try {
                    peerData.dataChannel.send(alertMessage);
                } catch (e) {}
            }
        });
    }
}

// ===== ROOM MANAGEMENT =====
export function createRoom(callback) {
    networkState.socket.emit('create-room', (response) => {
        if (response.success) {
            networkState.roomId = response.roomId;
            networkState.isHost = true;
            networkState.localPlayerId = networkState.socket.id;
            console.log('🏠 Room created:', response.roomId);
        }
        callback(response);
    });
}

export function joinRoom(roomId, callback) {
    networkState.socket.emit('join-room', roomId, (response) => {
        if (response.success) {
            networkState.roomId = roomId;
            networkState.localPlayerId = networkState.socket.id;
            
            // Peer zu Host erstellen
            if (response.hostId) {
                createPeer(response.hostId, true);
            }
            
            console.log('🚪 Joined room:', roomId);
        }
        callback(response);
    });
}

export function leaveRoom() {
    if (networkState.isHost) {
        networkState.socket.emit('host-disconnect', networkState.roomId);
    }
    
    networkState.peers.forEach((peerData, peerId) => {
        removePeer(peerId);
    });
    
    networkState.roomId = null;
    networkState.isHost = false;
    networkState.remotePlayers.clear();
    networkState.stateHistory.clear();
}

// ===== UTILS =====
function updateRemotePlayersList(players) {
    console.log('👥 Players in room:', players);
    // UI Update oder andere Logik hier
}

export function getInterpolatedPlayerState(playerId) {
    // Versuche Interpolation, fallback zu Extrapolation
    interpolateState(playerId);
    let state = networkState.remotePlayers.get(playerId);
    
    if (!state) {
        state = extrapolateState(playerId);
    }
    
    return state;
}

export function getAllRemotePlayerStates() {
    const states = {};
    networkState.remotePlayers.forEach((state, playerId) => {
        states[playerId] = getInterpolatedPlayerState(playerId);
    });
    return states;
}

console.log('✅ Network Module loaded');
