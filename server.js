// ====================================================================================
// ARQUIVO: server.js (Versão com gerenciamento de jogador robusto)
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

io.on('connection', (socket) => {
    console.log(`[CONEXÃO] Socket ${socket.id} conectado.`);

    socket.on('joinGame', (playerData) => {
        if (!playerData || !playerData.id) {
            console.log(`[AVISO] Tentativa de join de ${socket.id} sem ID de personagem.`);
            return;
        }

        const charId = playerData.id;
        console.log(`[JOIN] ${playerData.name} (Char ID: ${charId}) tentando entrar com socket ${socket.id}.`);

        // --- LÓGICA ANTI-FANTASMA ---
        // Se este personagem já está logado com outro socket, desconecta o socket antigo.
        const oldSocketId = charIdToSocketId[charId];
        if (oldSocketId && io.sockets.sockets.get(oldSocketId)) {
            console.log(`[LIMPEZA] Desconectando socket antigo ${oldSocketId} para o personagem ${playerData.name}.`);
            io.sockets.sockets.get(oldSocketId).disconnect(true);
        }
        
        // Armazena a nova associação
        socket.charId = charId; // Guarda o ID do personagem no socket para fácil acesso
        charIdToSocketId[charId] = socket.id;
        players[socket.id] = { socketId: socket.id, ...playerData };

        // Envia a lista de jogadores existentes para o novo jogador
        socket.emit('currentPlayers', players);
        
        // Anuncia o novo jogador para todos os outros
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
            // Remove as referências
            delete players[socket.id];
            delete charIdToSocketId[player.id];
            // Avisa a todos os clientes que este PERSONAGEM (charId) saiu
            io.emit('playerDisconnected', player.id); 
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
