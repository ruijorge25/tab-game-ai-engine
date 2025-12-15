/*
 * index.js - Servidor Principal
 * Cumpre os requisitos: Estruturação, Persistência, Hash, Pedidos e Respostas.
 */
import http from 'http';
import url from 'url';
import fs from 'fs';
import crypto from 'crypto';
import { headers, sseHeaders } from './utils/headers.js';
import { createTabEngine } from './game/engine.tab.js';

// Porta definida pelo enunciado (81XX -> XX é o grupo)
const PORT = 8134; 

// --- ESTADO EM MEMÓRIA ---
let users = [];
let games = [];

// --- PERSISTÊNCIA (Requisito: usar módulo fs) ---
const USERS_FILE = './data/users.json';
const GAMES_FILE = './data/games.json';

// Garante diretoria de dados
if (!fs.existsSync('./data')) fs.mkdirSync('./data');

function loadData() {
    try {
        if (fs.existsSync(USERS_FILE)) users = JSON.parse(fs.readFileSync(USERS_FILE));
        // Jogos são reiniciados se o servidor for abaixo (simplificação aceite), 
        // mas a persistência de users é mantida.
        games = []; 
    } catch (e) { console.error("Erro ao carregar dados:", e); }
}

function saveData() {
    // Serialização em JSON (Requisito)
    // Removemos engine e responses (não serializáveis) antes de guardar
    const gamesToSave = games.map(({ engine, responses, ...rest }) => rest);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    fs.writeFileSync(GAMES_FILE, JSON.stringify(gamesToSave, null, 2));
}

loadData();

// --- FUNÇÕES AUXILIARES ---

// Requisito: Hash e Cifras (MD5 via crypto)
function getHash(value) {
    return crypto.createHash('md5').update(value).digest('hex');
}

function getBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch (e) { resolve({}); }
        });
    });
}

function validateUser(nick, password) {
    const user = users.find(u => u.nick === nick);
    if (!user) return false;
    // Requisito: Comparar hash da password, nunca em texto limpo
    return user.passHash === getHash(password);
}

// Converte índice linear para {row, col} (Lógica do Tabuleiro)
function indexToCoords(index, cols) {
    if (index < cols) return { row: 3, col: index }; // Linha 3 (P1)
    if (index < cols * 2) return { row: 2, col: (cols - 1) - (index - cols) };
    if (index < cols * 3) return { row: 1, col: index - cols * 2 };
    return { row: 0, col: (cols - 1) - (index - cols * 3) }; // Linha 0 (P2)
}

// Achata o tabuleiro para enviar no SSE (propriedade 'pieces')
// Retorna peças com papel (initial/opponent) baseado em quem é o jogador inicial
function flattenBoard(engine, initialNick, playersData) {
    const board = engine.getBoard();
    const cols = engine.getColumns();
    const pieces = [];
    
    for(let r=0; r<4; r++){
        for(let c=0; c<cols; c++){
            const p = board[r][c];
            if(p) {
                // Player 1 (engine) = initial; Player 2 (engine) = opponent
                const playerRole = (p.player === 1) ? 'initial' : 'opponent';
                const playerNick = (p.player === 1) 
                    ? Object.keys(playersData).find(n => playersData[n] === 'yellow')
                    : Object.keys(playersData).find(n => playersData[n] === 'blue');
                
                pieces.push({
                    player: playerRole,  // 'initial' ou 'opponent'
                    row: r, 
                    col: c,
                    inMotion: p.hasMoved,          // Importante para animações
                    reachedLastRow: p.hasReachedEnd, // Importante para rotação
                    color: p.player === 1 ? 'yellow' : 'blue'  // Extra para UI
                });
            }
        }
    }
    return pieces;
}

// Requisito: Enviar updates via Server-Sent Events (SSE)
function notifyClients(game, lastCell = undefined) {
    if (!game.responses) return;
    
    const engine = game.engine;
    const initialNick = Object.keys(game.playersData)[0];
    
    // Constrói objeto conforme tabela "Respostas"
    const messageData = {
        winner: game.winner || undefined,
        turn: game.turn,
        initial: initialNick,
        board: engine ? engine.getBoard() : [],
        pieces: engine ? flattenBoard(engine, initialNick, game.playersData) : [],
        dice: (engine && engine.getDice()) ? { value: engine.getDice() } : undefined,
        // Define se é para selecionar ('from') ou mover ('to')
        step: (engine && engine.getSelected()) ? 'to' : 'from',
        selected: (engine && engine.getSelected()) ? engine.getSelected() : undefined,
        // Lógica simplificada de mustPass
        mustPass: (engine && engine.canPass && engine.canPass()) ? game.turn : undefined,
        players: game.playersData, 
        game: game.id,
        cell: lastCell // Requisito: "casa movida"
    };

    const message = `data: ${JSON.stringify(messageData)}\n\n`;
    
    // Envia para todas as conexões abertas deste jogo
    game.responses.forEach(client => client.res.write(message));
}


// --- SERVIDOR HTTP ---
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // CORS Preflight (Necessário pois frontend e backend estão em portas diferentes)
    if (req.method === 'OPTIONS') {
        res.writeHead(204, headers);
        res.end();
        return;
    }

    // --- ROTA SSE: /update (GET) ---
    if (pathname === '/update' && req.method === 'GET') {
        const nick = parsedUrl.query.nick;
        const gameId = parsedUrl.query.game;
        const game = games.find(g => g.id === gameId);
        
        if (!game) {
            res.writeHead(400, headers);
            res.end(JSON.stringify({ error: "Jogo inválido" }));
            return;
        }

        // Cabeçalhos SSE
        res.writeHead(200, sseHeaders);
        
        // Regista a conexão
        if (!game.responses) game.responses = [];
        game.responses.push({ nick, res });
        
        // Limpa conexão ao fechar
        req.on('close', () => {
            if(game.responses) game.responses = game.responses.filter(c => c.res !== res);
        });
        
        // Envia estado atual imediatamente
        notifyClients(game);
        return;
    }

    // --- ROTAS DE API (POST) ---
    if (req.method === 'POST') {
        let body = await getBody(req);
        let response = {};

        try {
            // Middleware de Autenticação para rotas protegidas
            if (['/join', '/leave', '/notify', '/roll', '/pass'].includes(pathname)) {
                if (!body.nick || !body.password) throw { status: 400, msg: "Faltam credenciais" };
                // Requisito: 401 se autenticação falhar
                if (!validateUser(body.nick, body.password)) throw { status: 401, msg: "Autenticação falhou" };
            }

            switch (pathname) {
                // === REGISTER ===
                case '/register':
                    if (!body.nick || !body.password) throw { status: 400, msg: "Argumentos inválidos" };
                    const existing = users.find(u => u.nick === body.nick);
                    if (existing) {
                        if (existing.passHash !== getHash(body.password)) throw { status: 401, msg: "Password errada" };
                    } else {
                        users.push({ nick: body.nick, passHash: getHash(body.password), games: 0, wins: 0 });
                        saveData();
                    }
                    break;

                // === RANKING ===
                case '/ranking':
                    // Requisito: Verificar argumentos requeridos (group, size)
                    if (body.group === undefined || body.size === undefined) {
                        throw { status: 400, msg: "Argumentos em falta: group e size" };
                    }
                    
                    const rankGroup = parseInt(body.group);
                    if (isNaN(rankGroup)) throw { status: 400, msg: "Group deve ser numérico" };
                    
                    // Calcula stats por grupo filtrando games
                    const groupGames = games.filter(g => g.group === rankGroup);
                    const groupStats = {};
                    
                    groupGames.forEach(g => {
                        Object.keys(g.playersData).forEach(nick => {
                            if (!groupStats[nick]) groupStats[nick] = { games: 0, wins: 0 };
                            groupStats[nick].games++;
                            if (g.winner === nick) groupStats[nick].wins++;
                        });
                    });
                    
                    // Retorna top 10 vitórias no grupo
                    response = {
                        ranking: Object.keys(groupStats)
                            .map(nick => ({ nick, ...groupStats[nick] }))
                            .sort((a, b) => b.wins - a.wins)
                            .slice(0, 10)
                    };
                    break;

                // === JOIN ===
                case '/join':
                    if (!body.group || !body.size) throw { status: 400, msg: "Argumentos em falta" };
                    
                    // Requisito: Verificar tipos e intervalos
                    const size = parseInt(body.size);
                    const group = parseInt(body.group);
                    
                    if (isNaN(size) || isNaN(group)) throw { status: 400, msg: "Size e Group devem ser números" };
                    if (size < 3 || size > 15) throw { status: 400, msg: "Tamanho de tabuleiro inválido (3-15, ímpar)" };
                    if (size % 2 === 0) throw { status: 400, msg: "Tamanho de tabuleiro deve ser ímpar" };

                    // Procura jogo existente
                    let game = games.find(g => g.group == group && g.size == size && !g.winner && Object.keys(g.playersData).length < 2);

                    if (game) {
                        // Juntar ao jogo (Player 2 - Blue)
                        if (!game.playersData[body.nick]) {
                           game.playersData[body.nick] = "blue"; 
                           // Inicia o motor apenas com 2 jogadores
                           game.engine = createTabEngine({ columns: size });
                           notifyClients(game); 
                           saveData();
                        }
                    } else {
                        // Criar novo jogo (Player 1 - Yellow)
                        // Requisito: ID hash baseado em caraterísticas + tempo
                        const id = getHash(body.nick + Date.now() + group);
                        game = {
                            id, group, size,
                            playersData: { [body.nick]: "yellow" }, 
                            turn: body.nick, 
                            winner: null, engine: null
                        };
                        games.push(game);
                        saveData();
                    }
                    response = { game: game.id };
                    break;

                // === LEAVE ===
                case '/leave':
                    if (!body.game) throw { status: 400, msg: "Game ID em falta" };
                    const gLeave = games.find(g => g.id === body.game);
                    if (!gLeave) throw { status: 404, msg: "Jogo não encontrado" }; // Requisito: 404
                    
                    // Lógica de desistência
                    const winner = Object.keys(gLeave.playersData).find(p => p !== body.nick);
                    gLeave.winner = winner || "Empate"; 
                    
                    // Atualiza estatísticas
                    if(winner) {
                        const wUser = users.find(u => u.nick === winner);
                        if (wUser) { wUser.wins++; wUser.games++; }
                    }
                    const lUser = users.find(u => u.nick === body.nick);
                    if (lUser) lUser.games++;

                    notifyClients(gLeave);
                    saveData();
                    break;

                // === NOTIFY (JOGADA) ===
                case '/notify':
                    if (body.cell === undefined) throw { status: 400, msg: "Cell em falta" };
                    const gNotify = games.find(g => g.id === body.game);
                    
                    if (!gNotify || !gNotify.engine) throw { status: 400, msg: "Jogo não ativo" };
                    if (gNotify.turn !== body.nick) throw { status: 400, msg: "Não é a tua vez" };

                    const cellIndex = parseInt(body.cell);
                    // Requisito: Verificar intervalo do cell
                    if (isNaN(cellIndex) || cellIndex < 0) throw { status: 400, msg: "Célula inválida" };

                    // Converte índice linear para coordenadas do motor
                    const coords = indexToCoords(cellIndex, parseInt(gNotify.size));
                    
                    try {
                        const engine = gNotify.engine;
                        
                        // Lógica: Selecionar vs Mover
                        if (!engine.getSelected()) {
                            // Tenta selecionar
                            const moves = engine.getValidMoves(coords.row, coords.col);
                            if (moves.length === 0) throw new Error("Seleção inválida");
                        } else {
                            // Tenta mover
                            const result = engine.moveSelectedTo(coords.row, coords.col);
                            
                            // Gestão de turno
                            if (!result.extraTurn) {
                                const p1 = Object.keys(gNotify.playersData)[0];
                                const p2 = Object.keys(gNotify.playersData)[1];
                                gNotify.turn = (gNotify.turn === p1) ? p2 : p1;
                            }
                            
                            // Verificação de Vitória
                            const winnerCode = engine.checkWinner();
                            if (winnerCode) {
                                const p1 = Object.keys(gNotify.playersData)[0];
                                const p2 = Object.keys(gNotify.playersData)[1];
                                gNotify.winner = (winnerCode === 1) ? p1 : p2;
                                
                                // Atualiza Stats
                                const wU = users.find(u => u.nick === gNotify.winner); if(wU){ wU.wins++; wU.games++; }
                                const lNick = (gNotify.winner === p1) ? p2 : p1;
                                const lU = users.find(u => u.nick === lNick); if(lU){ lU.games++; }
                                saveData();
                            }
                        }
                        
                        // Envia update com a célula afetada
                        notifyClients(gNotify, cellIndex); 
                    } catch (err) {
                        throw { status: 400, msg: err.message };
                    }
                    break;
                
                // === ROLL (DADO) ===
                case '/roll':
                    const gRoll = games.find(g => g.id === body.game);
                    if (!gRoll || !gRoll.engine) throw { status: 400, msg: "Jogo não ativo" };
                    if (gRoll.turn !== body.nick) throw { status: 400, msg: "Não é a tua vez" };
                    
                    if (gRoll.engine.getDice() !== null) throw { status: 400, msg: "Já lançaste o dado" };

                    gRoll.engine.rollDice();
                    notifyClients(gRoll);
                    break;

                // === PASS (PASSAR VEZ) ===
                case '/pass':
                    const gPass = games.find(g => g.id === body.game);
                    if (!gPass || !gPass.engine) throw { status: 400, msg: "Jogo não ativo" };
                    if (gPass.turn !== body.nick) throw { status: 400, msg: "Não é a tua vez" };

                    try {
                        gPass.engine.passTurn(); 
                        
                        const p1Pass = Object.keys(gPass.playersData)[0];
                        const p2Pass = Object.keys(gPass.playersData)[1];
                        gPass.turn = (gPass.turn === p1Pass) ? p2Pass : p1Pass;
                        
                        notifyClients(gPass);
                    } catch(err) {
                        throw { status: 400, msg: err.message };
                    }
                    break;

                default:
                    // Requisito: 404 para pedido desconhecido
                    throw { status: 404, msg: "Pedido desconhecido" };
            }
        } catch (err) {
            // Tratamento centralizado de erros
            let status = err.status || 500;
            response = { error: err.msg || err.message || "Erro interno" };
            res.writeHead(status, headers);
            res.end(JSON.stringify(response));
            return;
        }

        // Resposta de sucesso (200)
        res.writeHead(200, headers);
        res.end(JSON.stringify(response));
    } else {
        // Método HTTP não suportado (ex: PUT, DELETE)
        res.writeHead(404, headers);
        res.end(JSON.stringify({ error: "Endpoint não encontrado" }));
    }
});

server.listen(PORT, () => console.log(`Servidor a correr na porta ${PORT}`));