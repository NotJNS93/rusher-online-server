// ====================================================================================
// ARQUIVO: server.js (Versão Final para Render)
// RESPONSÁVEL POR: Servidor de jogo "rusher_GameServer" para deploy online.
// ====================================================================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Permite que qualquer site (seu jogo no Firebase/Netlify) se conecte
    methods: ["GET", "POST"]
  }
});

// O Render.com define a porta através de uma variável de ambiente.
// Usamos a porta dele, ou a 3001 se estivermos testando localmente.
const port = process.env.PORT || 3001;

const players = {};

function broadcastPlayerCount() {
    io.emit('updatePlayerCount', Object.keys(players).length);
}

io.on('connection', (socket) => {
    console.log(`[CONEXÃO] Novo jogador conectado: ${socket.id}`);
    broadcastPlayerCount();

    socket.on('joinGame', (playerData) => {
        if (!playerData || !playerData.name) {
            console.log(`[AVISO] Tentativa de join sem dados válidos do jogador ${socket.id}`);
            return;
        }
        console.log(`[JOIN] ${playerData.name} (${socket.id}) entrou no jogo.`);
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
        if (players[socket.id]) {
            console.log(`[DESCONEXÃO] ${players[socket.id].name} desconectou.`);
            delete players[socket.id];
            io.emit('playerDisconnected', socket.id);
            broadcastPlayerCount();
        } else {
            console.log(`[DESCONEXÃO] Conexão anônima ${socket.id} fechada.`);
        }
    });
});

// Rota de verificação de saúde para o Render
app.get('/', (req, res) => {
  res.send('Servidor Rusher Online está rodando!');
});

server.listen(port, () => {
  console.log(`🚀 Servidor Rusher Online rodando na porta ${port}`);
});