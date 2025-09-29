// ====================================================================================
// ARQUIVO: server.js (Versão com CORS explícito para produção)
// ====================================================================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const corsOptions = { origin: "*" };
app.use(cors(corsOptions));

const server = http.createServer(app);
const io = socketIo(server, { cors: corsOptions });

const port = process.env.PORT || 3001;
const players = {}; // Armazena por socket.id

io.on('connection', (socket) => {
    console.log(`[CONEXÃO] Socket ${socket.id} conectado.`);

    socket.on('joinGame', (playerData) => {
        if (!playerData || !playerData.name) {
            console.log(`[AVISO] Tentativa de join de ${socket.id} sem dados válidos.`);
            return;
        }
        console.log(`[JOIN] ${playerData.name} (Socket: ${socket.id}) entrou no jogo.`);
        
        players[socket.id] = { 
            id: socket.id, // Adiciona o socket.id aos dados do jogador
            ...playerData 
        };

        // Envia a lista de jogadores existentes para o novo jogador
        socket.emit('currentPlayers', players);
        
        // Anuncia o novo jogador para todos os outros
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    socket.on('playerMovement', (movementData) => {
        const player = players[socket.id];
        if (player) {
            Object.assign(player, movementData);
            // Retransmite os dados de movimento para os outros clientes
            socket.broadcast.emit('playerMoved', player);
        }
    });

    socket.on('disconnect', () => {
        const player = players[socket.id];
        if (player) {
            console.log(`[DESCONEXÃO] ${player.name} (Socket: ${socket.id}) desconectou.`);
            delete players[socket.id];
            // Avisa a todos os clientes que este socket.id saiu
            io.emit('playerDisconnected', socket.id); 
        } else {
            console.log(`[DESCONEXÃO] Socket anônimo ${socket.id} desconectou.`);
        }
    });
});

app.get('/', (req, res) => {
  res.send('Servidor Rusher Online está rodando!');
});

server.listen(port, () => {
  console.log(`🚀 Servidor Rusher Online rodando na porta ${port}`);
});
