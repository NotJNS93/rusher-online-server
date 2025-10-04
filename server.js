// ====================================================================================
// ARQUIVO: server.js (Versão Final para Render)
// RESPONSÁVEL POR: Servidor de jogo "rusher_GameServer" para deploy online.
// ====================================================================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');

try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("[FIREBASE] Credenciais do Firebase Admin carregadas com sucesso.");
} catch (error) {
    console.error("[ERRO CRÍTICO] Falha ao carregar as credenciais do Firebase.", error.message);
    process.exit(1); 
}

const db = admin.firestore();

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 3001;

const players = {};

function broadcastPlayerCount() {
    const playerCount = Object.keys(players).length;
    io.emit('updatePlayerCount', playerCount);
}

io.on('connection', (socket) => {
    console.log(`[CONEXÃO] Novo jogador conectado: ${socket.id}`);
    
    broadcastPlayerCount();

    socket.on('joinGame', async (playerData) => {
        if (!playerData || !playerData.id || !playerData.name || !playerData.uid) {
            console.log(`[AVISO] Tentativa de join sem dados válidos do jogador ${socket.id}`);
            return;
        }
        console.log(`[JOIN] ${playerData.name} (UID: ${playerData.uid}) entrou no jogo.`);
        
        players[socket.id] = { 
            socketId: socket.id, 
            charId: playerData.id, 
            uid: playerData.uid, // Armazena o UID do usuário
            ...playerData 
        };

        try {
            await db.collection('players_online').doc(playerData.id).set({
                name: playerData.name,
                level: playerData.level,
                class: playerData.class,
                uid: playerData.uid
            });
            console.log(`[FIRESTORE] ${playerData.name} adicionado a players_online.`);
        } catch(error) {
            console.error("[ERRO] Falha ao adicionar jogador em players_online:", error);
        }
        
        socket.emit('currentPlayers', players);
        socket.broadcast.emit('newPlayer', players[socket.id]);
        broadcastPlayerCount();
    });

    socket.on('playerMovement', (movementData) => {
        const player = players[socket.id];
        if (player) {
            Object.assign(player, movementData);
            socket.broadcast.emit('playerMoved', player);
        }
    });

    // [NOVO] Listener para o evento de desconexão vindo do admin
    socket.on('admin:disconnectUser', (data) => {
        const { uidToDisconnect, reason } = data;
        console.log(`[ADMIN] Recebida ordem para desconectar UID: ${uidToDisconnect}`);
        
        // Encontra todos os sockets associados àquele UID
        for (const socketId in players) {
            if (players[socketId].uid === uidToDisconnect) {
                const targetSocket = io.sockets.sockets.get(socketId);
                if (targetSocket) {
                    // Envia o evento de desconexão forçada para o cliente específico
                    targetSocket.emit('admin:forceDisconnect', { reason: reason || "Você foi desconectado por um administrador." });
                    // Força a desconexão do socket no lado do servidor
                    targetSocket.disconnect(true);
                    console.log(`[ADMIN] Socket ${socketId} (UID: ${uidToDisconnect}) desconectado.`);
                }
            }
        }
    });

    socket.on('disconnect', async () => {
        const player = players[socket.id];
        if (player) {
            console.log(`[DESCONEXÃO] ${player.name} (${socket.id}) desconectou.`);

            try {
                await db.collection('players_online').doc(player.charId).delete();
                console.log(`[FIRESTORE] ${player.name} (charId: ${player.charId}) removido de players_online.`);
            } catch (error) {
                console.error("[ERRO] Falha ao remover jogador de players_online:", error);
            }
            
            delete players[socket.id];
            io.emit('playerDisconnected', player.charId);
            broadcastPlayerCount();
        } else {
            console.log(`[DESCONEXÃO] Conexão anônima ${socket.id} fechada.`);
            broadcastPlayerCount();
        }
    });
});

app.get('/', (req, res) => {
  res.send('Servidor Rusher Online está rodando!');
});

server.listen(port, () => {
  console.log(`🚀 Servidor Rusher Online rodando na porta ${port}`);
});
