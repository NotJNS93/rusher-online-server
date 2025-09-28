  // ====================================================================================
    // ARQUIVO: server.js
    // RESPONSÁVEL POR: Servidor de jogo "rusher_GameServer".
    // Roda no seu computador para que seus amigos possam se conectar.
    // ====================================================================================

    const express = require('express');
    const http = require('http');
    const socketIo = require('socket.io');
    const path = require('path');
    const cors = require('cors');

    const app = express();
    // O cors é essencial para permitir que o site da Firebase se conecte ao seu PC
    app.use(cors());

    const server = http.createServer(app);
    const io = socketIo(server, {
      cors: {
        origin: "*", // Permite que qualquer site se conecte
        methods: ["GET", "POST"]
      }
    });

    const port = 3000;
    const players = {};

    function broadcastPlayerCount() {
        io.emit('updatePlayerCount', Object.keys(players).length);
    }

    io.on('connection', (socket) => {
        console.log(`[CONEXÃO] Novo jogador conectado: ${socket.id}`);
        broadcastPlayerCount();

        socket.on('joinGame', (playerData) => {
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

    server.listen(port, () => {
      console.log(`🚀 Servidor Rusher Online rodando na sua máquina.`);
      console.log(`Aguardando jogadores se conectarem na porta ${port}...`);
      console.log(`Mantenha este terminal aberto!`);
    });