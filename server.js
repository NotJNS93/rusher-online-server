// ====================================================================================
// ARQUIVO: server.js (Versão Final para Render)
// RESPONSÁVEL POR: Servidor de jogo "rusher_GameServer" para deploy online.
// ====================================================================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');

// --- [NOVO] INICIALIZAÇÃO DO FIREBASE ADMIN ---
// Isso permite que o servidor interaja com o Firestore de forma segura.

// Carrega as credenciais da variável de ambiente.
// No Render.com, você criará uma variável de ambiente chamada FIREBASE_CREDENTIALS
// e colará o conteúdo do seu arquivo JSON de credenciais nela.
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    console.log("[FIREBASE] Credenciais do Firebase Admin carregadas com sucesso.");
} catch (error) {
    console.error("[ERRO CRÍTICO] Falha ao carregar as credenciais do Firebase. Verifique a variável de ambiente FIREBASE_CREDENTIALS.", error.message);
    // Encerra o processo se as credenciais não puderem ser carregadas, pois o servidor não funcionará corretamente.
    process.exit(1); 
}


const db = admin.firestore();
// --- FIM DA INICIALIZAÇÃO ---

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
    console.log(`[INFO] Contagem de jogadores atualizada: ${playerCount}`);
}

io.on('connection', (socket) => {
    console.log(`[CONEXÃO] Novo jogador conectado: ${socket.id}`);
    
    socket.on('joinGame', async (playerData) => {
        if (!playerData || !playerData.id || !playerData.name) {
            console.log(`[AVISO] Tentativa de join sem dados válidos do jogador ${socket.id}`);
            return;
        }
        console.log(`[JOIN] ${playerData.name} (${socket.id}) entrou no jogo com o charId: ${playerData.id}`);
        
        // Adiciona o jogador à lista local e ao Firestore
        players[socket.id] = { socketId: socket.id, charId: playerData.id, ...playerData };
        try {
            await db.collection('players_online').doc(playerData.id).set(playerData);
            console.log(`[FIRESTORE] ${playerData.name} adicionado a players_online.`);
        } catch(error) {
            console.error("[ERRO] Falha ao adicionar jogador em players_online:", error);
        }
        
        // Envia a lista de jogadores atuais para o novo jogador
        socket.emit('currentPlayers', players);
        // Anuncia o novo jogador para todos os outros
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

            // --- LÓGICA DE LIMPEZA CENTRALIZADA NO SERVIDOR ---
            try {
                // Remove o jogador da coleção 'players_online' no Firestore usando o ID do personagem
                await db.collection('players_online').doc(player.charId).delete();
                console.log(`[FIRESTORE] ${player.name} (charId: ${player.charId}) removido de players_online.`);
            } catch (error) {
                console.error("[ERRO] Falha ao remover jogador de players_online:", error);
            }
            // --- FIM DA CORREÇÃO ---

            // Remove o jogador da lista local
            delete players[socket.id];
            
            // Anuncia a desconexão para os outros jogadores usando o ID do personagem
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
