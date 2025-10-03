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

// [CORREÇÃO] Simplificando a configuração de CORS para máxima compatibilidade
const io = socketIo(server, {
  cors: {
    origin: "*", // Permite qualquer origem
  }
});

const port = process.env.PORT;

const players = {};

function broadcastPlayerCount() {
    const playerCount = Object.keys(players).length;
    io.emit('updatePlayerCount', playerCount);
}

io.on('connection', (socket) => {
    console.log(`[CONEXÃO] Novo jogador conectado: ${socket.id}`);
    
    socket.on('joinGame', async (playerData) => {
        if (!playerData || !playerData.id || !playerData.name) {
            console.log(`[AVISO] Tentativa de join sem dados válidos do jogador ${socket.id}`);
            return;
        }
        console.log(`[JOIN] ${playerData.name} (${socket.id}) entrou no jogo com o charId: ${playerData.id}`);
        
        players[socket.id] = { socketId: socket.id, charId: playerData.id, ...playerData };
        try {
            await db.collection('players_online').doc(playerData.id).set(playerData);
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
        }
    });
});

app.get('/', (req, res) => {
  res.send('Servidor Rusher Online está rodando!');
});

server.listen(port, () => {
  console.log(`🚀 Servidor Rusher Online rodando na porta ${port}`);
});
