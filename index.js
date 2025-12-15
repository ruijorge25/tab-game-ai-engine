import http from 'http';
import url from 'url';
import fs from 'fs';
import crypto from 'crypto';
import { headers, sseHeaders } from './RIP/utils/headers.js';
import { createTabEngine } from './RIP/game/engine.tab.js';

// Porta definida pelo enunciado (81XX -> XX é o grupo)
const PORT = process.env.PORT || 8134; 

// Timeouts
const GAME_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutos
const LOBBY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos aguardando

//ESTADO EM MEMÓRIA
let users = [];
let games = [];
const gameTimers = new Map(); // Map<gameId, timeoutId>

//PERSISTÊNCIA (Requisito: usar módulo fs)
const USERS_FILE = './RIP/data/users.json';
const GAMES_FILE = './RIP/data/games.json';

// Garante diretoria de dados
if (!fs.existsSync('./RIP/data')) fs.mkdirSync('./RIP/data', { recursive: true });

function loadData() {
    try {
        if (fs.existsSync(USERS_FILE)) users = JSON.parse(fs.readFileSync(USERS_FILE));
        
        // Carrega jogos TERMINADOS para rankings 
        if (fs.existsSync(GAMES_FILE)) {
            const savedGames = JSON.parse(fs.readFileSync(GAMES_FILE));
            // Só carrega jogos que já terminaram 
            games = savedGames.filter(g => g.winner);
            console.log(`[LOAD] Carregados ${games.length} jogos terminados para rankings`);
        } else {
            games = [];
        }
    } catch (e) { 
        console.error("Erro ao carregar dados:", e);
        games = [];
    }
}

function saveData() {
    // Deep copy sem engine e responses
    const gamesToSave = games.map(game => ({
        id: game.id,
        group: game.group,
        size: game.size,
        playersData: game.playersData,
        turn: game.turn,
        winner: game.winner,
        colorMap: game.colorMap,
        createdAt: game.createdAt
    }));
    
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    fs.writeFileSync(GAMES_FILE, JSON.stringify(gamesToSave, null, 2));
}

loadData();

//FUNÇÕES AUXILIARES

// Requisito: Hash e Cifras
function getHash(value) {
    return crypto.createHash('md5').update(value).digest('hex');
}

/**
 * Converte índice linear (0 a 4*cols-1) para coordenadas {row, col}
 * 
 * LAYOUT DO TABULEIRO (exemplo 9 cols):
 * 
 * Row 0 (P2 Start): [35 34 33 32 31 30 29 28 27] ← Direita para Esquerda
 * Row 1:            [18 19 20 21 22 23 24 25 26] → Esquerda para Direita
 * Row 2:            [17 16 15 14 13 12 11 10  9] ← Direita para Esquerda
 * Row 3 (P1 Start): [ 0  1  2  3  4  5  6  7  8] → Esquerda para Direita
 */
function indexToCoords(index, cols) {
    if (index < cols) {
        return { row: 3, col: index }; // P1 Start 
    } else if (index < cols * 2) {
        return { row: 2, col: (cols - 1) - (index - cols) }; 
    } else if (index < cols * 3) {
        return { row: 1, col: index - cols * 2 }; 
    } else {
        return { row: 0, col: (cols - 1) - (index - cols * 3) }; // P2 Start 
    }
}

/**
 * Converte coordenadas {row, col} para índice linear
 * (Inversa de indexToCoords)
 */
function coordsToIndex(r, c, cols) {
    if (r === 3) return c;                              // Row 3 
    if (r === 2) return cols + (cols - 1 - c);         // Row 2 
    if (r === 1) return (2 * cols) + c;                // Row 1 
    if (r === 0) return (3 * cols) + (cols - 1 - c);   // Row 0
    
    console.error(`[coordsToIndex] Linha inválida: ${r}`);
    return 0;
}

/**
 * Converte tabuleiro 4xN do motor para array linear de peças
 */
function flattenBoard(engine, initialNick, playersData) {
    const board = engine.getBoard();
    const cols = engine.getColumns();
    const totalCells = 4 * cols;
    const pieces = new Array(totalCells).fill(null);
    
    // Percorrer cada índice linear e buscar a peça correspondente
    for (let linearIndex = 0; linearIndex < totalCells; linearIndex++) {
        const { row, col } = indexToCoords(linearIndex, cols);
        const piece = board[row][col];
        
        if (piece) {
            // Determinar cor baseada no player ID do motor
            const color = (piece.player === 1) ? 'yellow' : 'blue';
            
            pieces[linearIndex] = {
                color: color,
                inMotion: piece.hasMoved,
                reachedLastRow: piece.hasReachedEnd
            };
        }
    }
    
    return pieces;
}

/**
 * Reseta o timer de inatividade do jogo
 */
function resetGameTimer(game) {
    // Limpa timer antigo se existir
    if (gameTimers.has(game.id)) {
        clearTimeout(gameTimers.get(game.id));
    }
    
    // Cria novo timer
    const timerId = setTimeout(() => {
        console.log(`[TIMEOUT] Jogo ${game.id} expirou`);
        
        // Conceder vitória ao adversário
        const playerNicks = Object.keys(game.playersData);
        const opponent = playerNicks.find(nick => nick !== game.turn);
        
        if (opponent) {
            game.winner = opponent;
            
            // Atualizar stats
            const wUser = users.find(u => u.nick === opponent);
            if (wUser) { wUser.wins++; wUser.games++; }
            
            const lUser = users.find(u => u.nick === game.turn);
            if (lUser) { lUser.games++; }
            
            notifyClients(game);
            saveData();
        }
        
        gameTimers.delete(game.id);
    }, GAME_TIMEOUT_MS);
    
    gameTimers.set(game.id, timerId);
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
    //Comparar hash da password
    return user.passHash === getHash(password);
}

// Enviar updates via Server-Sent Events (SSE)
function notifyClients(game, lastCell = undefined) {
    if (!game.responses || !game.engine) return;
    
    const engine = game.engine;
    const playerNicks = Object.keys(game.playersData);
    const initialNick = playerNicks[0]; // Primeiro jogador
    
    // Construir array de peças compatível com cliente
    const pieces = flattenBoard(engine, initialNick, game.playersData);
    
    // Determinar step baseado em seleção
    const selected = engine.getSelected?.();
    let step = 'from'; // Padrão: escolher peça
    let selectedCells = [];
    
    if (selected) {
        step = 'to'; // Peça selecionada, escolher destino
        
        // Converter selected para índice linear
        const selectedIdx = coordsToIndex(selected.row, selected.col, engine.getColumns());
        selectedCells.push(selectedIdx);
        
        //Usa cache em vez de recalcular 
        const validMoves = game.validMovesCache || [];
        validMoves.forEach(move => {
            const idx = coordsToIndex(move.row, move.col, engine.getColumns());
            selectedCells.push(idx);
        });
    }
    
    // Construir objeto de resposta
    const messageData = {
        game: game.id,
        winner: game.winner || undefined,
        turn: game.turn,
        initial: initialNick,
        players: game.playersData,
        pieces: pieces,
        dice: engine.getDice() ? { 
            value: engine.getDice(),
            keepPlaying: [1, 4, 6].includes(engine.getDice())
        } : undefined,
        step: step,
        selected: selectedCells.length > 0 ? selectedCells : undefined,
        mustPass: (engine.canPass && engine.canPass()) ? game.turn : undefined,
        cell: lastCell
    };

    const message = `data: ${JSON.stringify(messageData)}\n\n`;
    
    // Filtrar clientes mortos
    game.responses = game.responses.filter(client => {
        try {
            client.res.write(message);
            return true; // Cliente ainda conectado
        } catch (err) {
            console.error('[SSE] Cliente desconectado:', client.nick);
            return false; // Remover da lista
        }
    });
}


//SERVIDOR HTTP
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // CORS Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, headers);
        res.end();
        return;
    }

    //ROTA SSE: /update (GET) 
    if (pathname === '/update' && req.method === 'GET') {
        const nick = parsedUrl.query.nick;
        const gameId = parsedUrl.query.game;
        const game = games.find(g => g.id === gameId);
        
        if (!game) {
            res.writeHead(400, headers);
            res.end(JSON.stringify({ error: "Jogo inválido" }));
            return;
        }

        // Nick pertence ao jogo
        if (!game.playersData[nick]) {
            res.writeHead(403, headers);
            res.end(JSON.stringify({ error: "Não pertences a este jogo" }));
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

    // ROTAS DE API (POST)
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
                //REGISTER
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

                // RANKING
                case '/ranking':
                    // group indefinido
                    if (body.group === undefined) {
                        throw { status: 400, msg: "Undefined group" };
                    }
                    
                    // size indefinido ou inválido
                    if (body.size === undefined) {
                        throw { status: 400, msg: "Invalid size 'undefined'" };
                    }
                    
                    const rankGroup = parseInt(body.group);
                    const rankSize = parseInt(body.size);
                    
                    // group não numérico
                    if (isNaN(rankGroup)) {
                        throw { status: 400, msg: `Invalid group '${body.group}'` };
                    }
                    
                    // size não inteiro ou inválido
                    if (isNaN(rankSize) || rankSize < 3 || rankSize > 15 || rankSize % 2 === 0) {
                        throw { status: 400, msg: `Invalid size '${body.size}'` };
                    }
                    
                    // Calcula stats por grupo E tamanho filtrando jogos
                    const groupGames = games.filter(g => g.group == rankGroup && g.size == rankSize && g.winner);
                    const groupStats = {};
                    
                    groupGames.forEach(g => {
                        Object.keys(g.playersData).forEach(nick => {
                            if (!groupStats[nick]) groupStats[nick] = { games: 0, victories: 0 };
                            groupStats[nick].games++;
                            if (g.winner === nick) groupStats[nick].victories++;
                        });
                    });
                    
                    // Retorna top 10 vitórias no grupo
                    response = {
                        ranking: Object.keys(groupStats)
                            .map(nick => ({ nick, victories: groupStats[nick].victories, games: groupStats[nick].games }))
                            .sort((a, b) => b.victories - a.victories)
                            .slice(0, 10)
                    };
                    break;

                //JOIN
                case '/join':
                    if (!body.group || !body.size) throw { status: 400, msg: "Argumentos em falta" };
                    
                    // Verificar tipos e intervalos
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
                           
                           // cria motor
                           game.engine = createTabEngine({ columns: size });
                           
                           // Definir mapeamento de cores
                           const p1Nick = Object.keys(game.playersData)[0];
                           const p2Nick = body.nick;
                           game.colorMap = {
                               [p1Nick]: 1, // Yellow = Player 1 no motor
                               [p2Nick]: 2  // Blue = Player 2 no motor
                           };
                           
                           notifyClients(game); 
                           saveData();
                        }
                    } else {
                        // Criar novo jogo (Player 1 aguarda)
                        // Requisito: ID hash baseado em caraterísticas + tempo
                        const id = getHash(body.nick + Date.now() + group);
                        game = {
                            id, group, size,
                            playersData: { [body.nick]: "yellow" }, 
                            turn: body.nick, 
                            winner: null, 
                            engine: null, // Motor só é criado quando 2 players juntam-se
                            colorMap: null,
                            createdAt: Date.now() // ✅ Timestamp para cleanup
                        };
                        games.push(game);
                        saveData();
                    }
                    response = { game: game.id };
                    break;


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

                    // Limpar gameTimers
                    if (gameTimers.has(gLeave.id)) {
                        clearTimeout(gameTimers.get(gLeave.id));
                        gameTimers.delete(gLeave.id);
                    }

                    notifyClients(gLeave);
                    saveData();
                    break;


                case '/notify':
                    if (body.cell === undefined) throw { status: 400, msg: "Cell em falta" };
                    const gNotify = games.find(g => g.id === body.game);
                    
                    if (!gNotify || !gNotify.engine) throw { status: 400, msg: "Jogo não ativo" };
                    if (gNotify.turn !== body.nick) throw { status: 400, msg: "Não é a tua vez" };

                    const cellIndex = parseInt(body.cell);
                    if (isNaN(cellIndex) || cellIndex < 0) throw { status: 400, msg: "Célula inválida" };

                    // Converter índice para coordenadas
                    const coords = indexToCoords(cellIndex, parseInt(gNotify.size));
                    const { row, col } = coords;
                    
                    try {
                        const engine = gNotify.engine;
                        const selected = engine.getSelected?.(); // Verifica se há peça selecionada
                        
                        if (!selected) {

                            const moves = engine.selectPiece(row, col);
                            
                            if (moves.length === 0) {
                                throw new Error("Peça sem movimentos válidos");
                            }
                            
                            // GUARDA destinos no cache
                            gNotify.validMovesCache = moves;
                            
                            // Peça selecionada com sucesso
                            notifyClients(gNotify, cellIndex);
                            
                        } else {

                            if (selected.row === row && selected.col === col) {
                                // Toggle: clicar na mesma peça cancela seleção
                                engine.deselect();
                                delete gNotify.validMovesCache;
                                notifyClients(gNotify, cellIndex);
                            } else {
                                const result = engine.moveSelectedTo(row, col);
                                
                                //  LIMPA cache
                                delete gNotify.validMovesCache;
                                
                                //  Gerir turno
                                if (!result.extraTurn) {
                                    const playerNicks = Object.keys(gNotify.playersData);
                                    const p1 = playerNicks[0];
                                    const p2 = playerNicks[1];
                                    gNotify.turn = (gNotify.turn === p1) ? p2 : p1;
                                }
                                
                                //  Reset timer de inatividade
                                resetGameTimer(gNotify);
                                
                                //  Verificar vitória
                                const winnerCode = engine.checkWinner();
                                if (winnerCode) {
                                    const p1 = Object.keys(gNotify.playersData)[0];
                                    const p2 = Object.keys(gNotify.playersData)[1];
                                    gNotify.winner = (winnerCode === 1) ? p1 : p2;
                                    
                                    // Atualizar stats
                                    const wU = users.find(u => u.nick === gNotify.winner);
                                    if(wU){ wU.wins++; wU.games++; }
                                    const lNick = (gNotify.winner === p1) ? p2 : p1;
                                    const lU = users.find(u => u.nick === lNick);
                                    if(lU){ lU.games++; }
                                    saveData();
                                    
                                    // Limpar timer
                                    if (gameTimers.has(gNotify.id)) {
                                        clearTimeout(gameTimers.get(gNotify.id));
                                        gameTimers.delete(gNotify.id);
                                    }
                                }
                                
                                //  Notificar clientes
                                notifyClients(gNotify, cellIndex);
                            }
                        }
                        
                    } catch (err) {
                        throw { status: 400, msg: err.message };
                    }
                    break;
                

                case '/roll':
                    const gRoll = games.find(g => g.id === body.game);
                    if (!gRoll || !gRoll.engine) throw { status: 400, msg: "Jogo não ativo" };
                    if (gRoll.turn !== body.nick) throw { status: 400, msg: "Não é a tua vez" };
                    
                    // Validar se já tem dado
                    if (gRoll.engine.getDice() !== null) {
                        throw { status: 400, msg: "Já lançaste o dado" };
                    }

                    // Lançar dado no motor
                    gRoll.engine.rollDice();
                    
                    // Reset timer de inatividade
                    resetGameTimer(gRoll);
                    
                    notifyClients(gRoll);
                    break;


                case '/pass':
                    const gPass = games.find(g => g.id === body.game);
                    if (!gPass || !gPass.engine) throw { status: 400, msg: "Jogo não ativo" };
                    if (gPass.turn !== body.nick) throw { status: 400, msg: "Não é a tua vez" };

                    try {
                        // Validar se pode passar
                        if (gPass.engine.getDice() === null) {
                            throw new Error("Tem de lançar o dado antes de passar");
                        }
                        
                        if (!gPass.engine.canPass()) {
                            throw new Error("Ainda há jogadas possíveis");
                        }
                        
                        // Passar turno no motor
                        gPass.engine.passTurn();
                        
                        // Trocar turno (passTurn() já trata jogadas extra internamente)
                        const playerNicks = Object.keys(gPass.playersData);
                        const p1 = playerNicks[0];
                        const p2 = playerNicks[1];
                        gPass.turn = gPass.engine.getCurrentPlayer() === 1 ? p1 : p2;
                        
                        // Reset timer
                        resetGameTimer(gPass);
                        
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


setInterval(() => {
    const now = Date.now();
    const before = games.length;
    
    games = games.filter(game => {
        if (!game.engine && game.createdAt && (now - game.createdAt > LOBBY_TIMEOUT_MS)) {
            console.log(`[CLEANUP] Removendo jogo zombie: ${game.id}`);
            return false;
        }
        return true;
    });
    
    // Persiste alterações se jogos foram removidos
    if (games.length < before) {
        saveData();
    }
}, 60 * 1000); // Verifica a cada 1 minuto

server.listen(PORT, () => console.log(`Servidor a correr na porta ${PORT}`));