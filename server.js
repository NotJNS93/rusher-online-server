// ====================================================================================
// ARQUIVO: server.js (Versão com Heartbeat e Status do Servidor)
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

const charIdToSocketId = {};
const players = {}; 

// NOVO: Heartbeat do Servidor
setInterval(() => {
    const serverStatus = {
        online: true,
        playerCount: Object.keys(players).length,
        maxPlayers: 100,
        timestamp: Date.now()
    };
    // Emite o status para TODOS os sockets conectados, incluindo os da tela de seleção
    io.emit('serverStatus', serverStatus);
}, 2000); // A cada 2 segundos

io.on('connection', (socket) => {
    console.log(`[CONEXÃO] Socket ${socket.id} estabeleceu conexão.`);

    socket.on('joinGame', (playerData) => {
        if (!playerData || !playerData.id) {
            console.log(`[AVISO] Socket ${socket.id} tentou entrar sem um ID de personagem.`);
            return;
        }

        const charId = playerData.id;
        const oldSocketId = charIdToSocketId[charId];

        if (oldSocketId && oldSocketId !== socket.id) {
            console.log(`[RECONEXÃO] ${playerData.name} (Char ID: ${charId}) reconectou com um novo socket: ${socket.id}.`);
            const oldSocket = io.sockets.sockets.get(oldSocketId);
            if (oldSocket) {
                console.log(`[LIMPEZA] Desconectando socket antigo e inativo: ${oldSocketId}.`);
                oldSocket.disconnect(true);
            }
            delete players[oldSocketId];
        } else {
            console.log(`[JOIN] ${playerData.name} (Char ID: ${charId}) entrou no jogo com o socket ${socket.id}.`);
        }
        
        socket.charId = charId;
        charIdToSocketId[charId] = socket.id;
        players[socket.id] = { socketId: socket.id, ...playerData };

        socket.emit('currentPlayers', players);
        socket.broadcast.emit('newPlayer', players[socket.id]);
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
            console.log(`[DESCONEXÃO] ${player.name} (Char ID: ${player.id}) desconectou.`);
            delete players[socket.id];
            delete charIdToSocketId[player.id];
            io.emit('playerDisconnected', player.id); 
        } else {
            console.log(`[DESCONEXÃO] Socket anônimo ${socket.id} desconectou.`);
        }
    });
});

// Lógica para Desconexão em Massa (Reinício do Servidor)
process.on('SIGINT', () => {
    console.log("Servidor está sendo desligado. Desconectando todos os jogadores...");
    io.emit('serverShutdown', { message: 'O servidor está reiniciando. Você foi desconectado.' });
    setTimeout(() => {
        process.exit(0);
    }, 1000); // Dá 1 segundo para a mensagem ser enviada
});


app.get('/', (req, res) => {
  res.send('Servidor Rusher Online está rodando!');
});

server.listen(port, () => {
  console.log(`🚀 Servidor Rusher Online rodando na porta ${port}`);
});
