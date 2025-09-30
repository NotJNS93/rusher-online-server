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

const port = process.env.PORT || 3001;

// Objeto para armazenar jogadores, agora usando o ID do personagem como chave principal.
const players = {};

function broadcastPlayerCount() {
    io.emit('serverStatus', {
        online: true,
        playerCount: Object.keys(players).length,
        maxPlayers: 100 // Exemplo
    });
    // Também emitimos um evento separado para o painel admin
    io.emit('updatePlayerCount', Object.keys(players).length);
}

io.on('connection', (socket) => {
    console.log(`[CONEXÃO] Novo socket conectado: ${socket.id}`);
    
    // Envia o status atual assim que alguém conecta
    broadcastPlayerCount();

    // Quando um jogador efetivamente entra no mundo com um personagem
    socket.on('joinGame', (playerData) => {
        if (!playerData || !playerData.id) {
            console.log(`[AVISO] Tentativa de join sem um ID de personagem válido do socket ${socket.id}`);
            return;
        }

        console.log(`[JOIN] ${playerData.name} (Char ID: ${playerData.id}) entrou no jogo com o socket ${socket.id}.`);
        
        // Armazena o ID do personagem no objeto do socket para referência futura
        socket.charId = playerData.id;

        // Adiciona o jogador à lista usando seu ID de personagem
        players[playerData.id] = {
            socketId: socket.id, // Mantém o socketId para referência
            ...playerData
        };

        // Envia a lista de todos os jogadores atuais para o novo jogador
        socket.emit('currentPlayers', players);

        // Notifica os outros jogadores sobre o novo jogador
        socket.broadcast.emit('newPlayer', players[playerData.id]);

        // Atualiza a contagem de jogadores para todos
        broadcastPlayerCount();
    });

    socket.on('playerMovement', (movementData) => {
        const player = players[socket.charId];
        if (player) {
            // Atualiza os dados de movimento do jogador
            Object.assign(player, movementData);
            // Transmite a atualização para os outros jogadores
            socket.broadcast.emit('playerMoved', player);
        }
    });

    socket.on('disconnect', () => {
        // Usa o charId armazenado no socket para identificar quem desconectou
        const charId = socket.charId;
        if (charId && players[charId]) {
            console.log(`[DESCONEXÃO] ${players[charId].name} (Char ID: ${charId}) desconectou.`);
            
            // Remove o jogador da lista
            delete players[charId];
            
            // Notifica os outros jogadores que este personagem saiu
            io.emit('playerDisconnected', charId);
            
            // Atualiza a contagem de jogadores
            broadcastPlayerCount();
        } else {
            console.log(`[DESCONEXÃO] Socket anônimo ${socket.id} fechado.`);
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
