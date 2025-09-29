// ====================================================================================
// ARQUIVO: server.js (Versão com logs refinados e contagem de jogadores correta)
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

// Objeto para mapear charId -> socketId
const charIdToSocketId = {};
// Objeto principal que armazena os dados dos jogadores por socket.id
const players = {}; 

// A contagem de jogadores agora é baseada na lista de 'players'
function broadcastPlayerCount() {
    io.emit('updatePlayerCount', Object.keys(players).length);
}

io.on('connection', (socket) => {
    // Log inicial para qualquer conexão que chega
    console.log(`[CONEXÃO] Socket ${socket.id} estabeleceu conexão.`);

    socket.on('joinGame', (playerData) => {
        if (!playerData || !playerData.id) {
            console.log(`[AVISO] Socket ${socket.id} tentou entrar sem um ID de personagem.`);
            return;
        }

        const charId = playerData.id;
        const oldSocketId = charIdToSocketId[charId];

        // --- LÓGICA DE RECONEXÃO E ANTI-FANTASMA ---
        if (oldSocketId && oldSocketId !== socket.id) {
            console.log(`[RECONEXÃO] ${playerData.name} (Char ID: ${charId}) reconectou com um novo socket: ${socket.id}.`);
            // Se o socket antigo ainda existir, o desconectamos.
            const oldSocket = io.sockets.sockets.get(oldSocketId);
            if (oldSocket) {
                console.log(`[LIMPEZA] Desconectando socket antigo e inativo: ${oldSocketId}.`);
                oldSocket.disconnect(true);
            }
            // Remove o jogador antigo da lista, se ainda estiver lá
            delete players[oldSocketId];
        } else {
            console.log(`[JOIN] ${playerData.name} (Char ID: ${charId}) entrou no jogo com o socket ${socket.id}.`);
        }
        
        // Associa o ID do personagem ao novo socket
        socket.charId = charId;
        charIdToSocketId[charId] = socket.id;
        players[socket.id] = { socketId: socket.id, ...playerData };

        // Envia a lista de jogadores ATUALIZADA para o novo jogador
        socket.emit('currentPlayers', players);
        
        // Anuncia o novo jogador para todos os outros (exceto ele mesmo)
        socket.broadcast.emit('newPlayer', players[socket.id]);

        // Atualiza a contagem de jogadores no mundo
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
            console.log(`[DESCONEXÃO] ${player.name} (Char ID: ${player.id}) desconectou.`);
            delete players[socket.id];
            delete charIdToSocketId[player.id];
            
            // Avisa a todos que este PERSONAGEM saiu
            io.emit('playerDisconnected', player.id); 
            broadcastPlayerCount();
        } else {
            console.log(`[DESCONEXÃO] Socket anônimo ${socket.id} que nunca entrou no jogo desconectou.`);
        }
    });
});

app.get('/', (req, res) => {
  res.send('Servidor Rusher Online está rodando!');
});

server.listen(port, () => {
  console.log(`🚀 Servidor Rusher Online rodando na porta ${port}`);
});
