// ====================================================================================
// ARQUIVO: server.js (Versão com CORS explícito para produção)
// ====================================================================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const corsOptions = { origin: "*" }; // Permite todas as origens por simplicidade
app.use(cors(corsOptions));

const server = http.createServer(app);
const io = socketIo(server, { cors: corsOptions });

const port = process.env.PORT || 3001;
const players = {};

function broadcastPlayerCount() {
    io.emit('updatePlayerCount', Object.keys(players).length);
}

io.on('connection', (socket) => {
    console.log(`[CONEXÃO] Novo socket conectado: ${socket.id}`);
    broadcastPlayerCount();

    socket.on('joinGame', (playerData) => {
        if (!playerData || !playerData.name) {
            console.log(`[AVISO] Tentativa de join sem dados válidos do jogador ${socket.id}`);
            return;
        }
        console.log(`[JOIN] ${playerData.name} (${socket.id}) entrou no jogo.`);
        socket.characterId = playerData.id; // Armazena o ID do personagem no socket
        players[socket.id] = { id: socket.id, ...playerData };

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

    socket.on('disconnect', () => {
        const player = players[socket.id];
        if (player) {
            console.log(`[DESCONEXÃO] ${player.name} desconectou.`);
            delete players[socket.id];
            // Emite o ID do socket para que o cliente saiba qual elemento remover
            io.emit('playerDisconnected', socket.id);
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
