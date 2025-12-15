// --- Constantes de Probabilidade 
const DICE_PROBABILITIES = {
  1: 0.25,    // (0.3125 - 0.0625)
  2: 0.375,   // (0.6875 - 0.3125)
  3: 0.25,    // (0.9375 - 0.6875)
  4: 0.0625,  // (1.0 - 0.9375)
  6: 0.0625,  // (< 0.0625)
};
const ALL_DICE_VALUES = [1, 2, 3, 4, 6];

/**
 * Ponto de entrada principal da IA.
 * Escolhe o melhor movimento com base no nível de dificuldade.
 */
export function findBestMove(level, engine) {
  const allMoves = getAllPossibleMoves(engine);
  if (allMoves.length === 0) {
    return null;
  }

  // --- DEBUG LOG INÍCIO ---
  console.log(`--- AI (Nível: ${level}) a avaliar ${allMoves.length} jogadas (Dado=${engine.getDice()}) ---`);
  if (allMoves.length === 0) console.warn("AI: Lista de jogadas está vazia!");

  let bestMove;
  let bestScore = -Infinity; // Para o log final

  switch (level) {
    case 'easy':
      bestMove = findEasyMove(engine, allMoves);
      break;
    
    case 'medium':
      const mediumResult = findMediumMove(engine, allMoves);
      bestMove = mediumResult.move;
      bestScore = mediumResult.score;
      break;
    
    case 'hard':
      const hardResult = findHardMove(engine, allMoves); // Isto agora retorna { move, score, reason }
      bestMove = hardResult.move;
      bestScore = hardResult.score;
      // Ignoramos a 'reason' aqui, porque isto é a jogada da IA, não a dica
      break;
    
    default:
      bestMove = findEasyMove(engine, allMoves);
  }

  // DEBUG LOG FINAL
  if (bestMove) {
    // Nível 'easy' não terá pontuação, 'medium' e 'hard' terão
    const scoreStr = (bestScore > -Infinity) ? `com score ${bestScore.toFixed(2)}` : '';
    console.log(`--- AI Escolheu: [${bestMove.piece.row},${bestMove.piece.col}] -> [${bestMove.target.row},${bestMove.target.col}] ${scoreStr} ---`);
  } else {
    console.error("AI: Não foi escolhida nenhuma jogada!");
  }

  
  return bestMove;
}

// NÍVEL FÁCIL: Totalmente aleatório
function findEasyMove(engine, allMoves) {
  return allMoves[Math.floor(Math.random() * allMoves.length)];
}


// NÍVEL MÉDIO: Heurística Greedy 
function findMediumMove(engine, allMoves) {
  const player = engine.getCurrentPlayer();
  const initialRow = (player === 1) ? 3 : 0;
  const lastRow = (player === 1) ? 0 : 3;

  const scoredMoves = allMoves.map(move => {
    // A pontuação base é o "Score Presente"
    const { score: presentScore } = getPresentScore(move, engine, player, initialRow, lastRow);
    const finalScore = presentScore + (Math.random() * 2); // Fator Aleatório

    //DEBUG LOG (NÍVEL MÉDIO)
    console.log(
      `Jogada [${move.piece.row},${move.piece.col}]->[${move.target.row},${move.target.col}]: ` +
      `Base(${presentScore.toFixed(0)}) = ${finalScore.toFixed(2)}`
    );

    return { move, score: finalScore };
  });

  // Ordena do score mais alto para o mais baixo
  scoredMoves.sort((a, b) => b.score - a.score);

  return scoredMoves[0]; // Devolve o objeto {move, score}
}


// NÍVEL DIFÍCIL: Heurística Ponderada (Presente + Risco + Ameaça)

function findHardMove(engine, allMoves) {
  const player = engine.getCurrentPlayer(); // AI (2)
  const opponent = (player === 1) ? 2 : 1; // Humano (1)
  const initialRow = (player === 1) ? 3 : 0;
  const lastRow = (player === 1) ? 0 : 3;
  const board = engine.getBoard();

  // LÓGICA DE ESTADO 
  const pieceCounts = engine.getPieceCounts();
  const myCount = pieceCounts.player2;
  const oppCount = pieceCounts.player1;

  let aggression = 1.0;
  let defensiveness = 1.0;
  let mode = "Neutro";

  if (myCount < oppCount - 1) {
    defensiveness = 1.5;
    mode = "Defensivo";
  } else if (myCount > oppCount + 1) {
    aggression = 1.5;
    mode = "Agressivo";
  }
  
  console.log(`AI MODO: ${mode} (Eu: ${myCount} vs Adv: ${oppCount})`);


  const RISK_MULTIPLIER = -110; 
  const THREAT_MULTIPLIER = 100;

  // Cache das posições das peças do oponente
  const opponentPieces = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < engine.getColumns(); c++) {
      const p = board[r][c];
      if (p && p.player === opponent) {
        opponentPieces.push(p);
      }
    }
  }

  // Peças únicas que a IA pode mover
  const myPieces = [...new Set(allMoves.map(m => m.piece))];
  
  // Cache do Risco da Posição Atual
  const currentRiskMap = new Map();
  for (const piece of myPieces) {
    let currentRiskProb = 0;
    const diceThatCanHitMe = new Set();
    for (const oppPiece of opponentPieces) {
      for (const dice of ALL_DICE_VALUES) {
        const hypMoves = engine.getHypotheticalMoves(oppPiece.row, oppPiece.col, dice, opponent);
        if (hypMoves.some(h => h.row === piece.row && h.col === piece.col)) {
          diceThatCanHitMe.add(dice);
        }
      }
    }
    currentRiskProb = [...diceThatCanHitMe].reduce((sum, d) => sum + DICE_PROBABILITIES[d], 0);
    currentRiskMap.set(piece, currentRiskProb * RISK_MULTIPLIER); 
  }

  // Cache da Ameaça da Posição Atual
  const currentThreatMap = new Map();
  for (const piece of myPieces) {
    let currentThreatProb = 0;
    const diceThatCanHitThem = new Set();
    for (const dice of ALL_DICE_VALUES) {
      const hypMoves = engine.getHypotheticalMoves(piece.row, piece.col, dice, player);
      if (hypMoves.some(h => {
          const targetCell = board[h.row][h.col];
          return targetCell && targetCell.player === opponent;
      })) {
        diceThatCanHitThem.add(dice);
      }
    }
    currentThreatProb = [...diceThatCanHitThem].reduce((sum, d) => sum + DICE_PROBABILITIES[d], 0);
    currentThreatMap.set(piece, currentThreatProb * THREAT_MULTIPLIER); 
  }
  
  //AVALIAÇÃO FINAL DE CADA JOGADA 
  const scoredMoves = allMoves.map(move => {
    const targetPos = move.target;
    let logExtras = ""; 

    // (A) Score Presente
    const { score: presentScore, reason: baseReason } = getPresentScore(move, engine, player, initialRow, lastRow);
    let finalReason = baseReason; // Começa com a razão base

    // (B) Cálculo de Risco (defensivo)
    const riskOfOrigin = currentRiskMap.get(move.piece) || 0;
    
    let riskOfDestination = 0;
    const diceThatCanHitDest = new Set();
    for (const oppPiece of opponentPieces) {
      for (const dice of ALL_DICE_VALUES) {
        const hypMoves = engine.getHypotheticalMoves(oppPiece.row, oppPiece.col, dice, opponent);
        if (hypMoves.some(h => h.row === targetPos.row && h.col === targetPos.col)) {
          diceThatCanHitDest.add(dice);
        }
      }
    }
    const totalRiskProb = [...diceThatCanHitDest].reduce((sum, d) => sum + DICE_PROBABILITIES[d], 0);
    riskOfDestination = totalRiskProb * RISK_MULTIPLIER; 

    let netRisk = riskOfDestination - riskOfOrigin; 

    if (netRisk > 0 && defensiveness > 1.0) {
      logExtras += ` [Fuga x${defensiveness}]`;
      netRisk *= defensiveness;
      finalReason = "Fugir de uma posição perigosa!"; // Razão de alta prioridade
    } else if (netRisk > 20) { // (Move-se para um local significativamente mais seguro)
      finalReason = "Mover para uma casa mais segura.";
    }

    // (C) Cálculo de Ameaça (Ofensivo)
    const threatOfOrigin = currentThreatMap.get(move.piece) || 0;
    
    let threatOfDestination = 0;
    const diceThatCanHitThem = new Set();
    for (const dice of ALL_DICE_VALUES) {
      const hypMoves = engine.getHypotheticalMoves(targetPos.row, targetPos.col, dice, player);
      if (hypMoves.some(h => {
          const targetCell = board[h.row][h.col];
          return targetCell && targetCell.player === opponent;
      })) {
        diceThatCanHitThem.add(dice);
      }
    }
    const totalThreatProb = [...diceThatCanHitThem].reduce((sum, d) => sum + DICE_PROBABILITIES[d], 0);
    threatOfDestination = (totalThreatProb * THREAT_MULTIPLIER); 

    let netThreat = threatOfDestination - threatOfOrigin; 

    if (netThreat > 0 && aggression > 1.0) {
      logExtras += ` [Atq+ x${aggression}]`;
      netThreat *= aggression;
      finalReason = "Criar uma nova ameaça de captura!"; // Razão de alta prioridade
    } else if (netThreat > 20) {
      finalReason = "Aumentar a pressão sobre o adversário.";
    }
    
    // Se for uma captura, essa é SEMPRE a razão principal
    if (presentScore >= 100) {
        finalReason = "Capturar uma peça adversária!";
    }
    
    // Score final = Presente + Risco + Ameaça + Aleatório
    const finalScore = presentScore + netRisk + netThreat + (Math.random() * 2);

    // DEBUG LOG (NÍVEL DIFÍCIL)
    console.log(
      `Jogada [${move.piece.row},${move.piece.col}]->[${targetPos.row},${targetPos.col}]: ` +
      `Base(${presentScore.toFixed(0)}) ` +
      `Risco(${netRisk.toFixed(0)}) ` +     
      `Ameaça(${netThreat.toFixed(0)})` +  
      `${logExtras}` + 
      ` = ${finalScore.toFixed(2)}`
    );

    return { move, score: finalScore, reason: finalReason };
  });

  // Ordena do score mais alto para o mais baixo
  scoredMoves.sort((a, b) => b.score - a.score);

  return scoredMoves[0]; 
}

// FUNÇÕES-AUXILIAR
/**
 * Lógica de pontuação do "Nível Médio".
 * Calcula o valor *imediato* (presente) de uma jogada.
 */
function getPresentScore(move, engine, player, initialRow, lastRow) {
  let score = 0;
  let reason = "Mover para uma casa segura."; // Razão padrão
  const board = engine.getBoard();
  const targetCell = board[move.target.row][move.target.col];
  
  const isMovingFromStart = (move.piece.row === initialRow && move.target.row !== initialRow);
  const isMovingOnStartRow = (move.piece.row === initialRow && move.target.row === initialRow);
  const isAlreadyInPlay = (move.piece.row !== initialRow);

  // 1. Prioridade Máxima: Capturar
  if (targetCell && targetCell.player !== player) {
    score += 100;
    reason = "Capturar uma peça adversária!";
  }

  // 2. Prioridade de Movimento (Baseado na tua correção de 'hasMoved')
  if (isMovingFromStart) {
    if (isLastPieceOnInitialRow(engine, player)) {
      score += 75; // Sair (Última)
      reason = "Mover a última peça da linha inicial.";
    } else {
      score += 25; // Sair (Normal)
      reason = "Colocar uma nova peça em jogo.";
    }
  } 
  else if (isMovingOnStartRow) {
    if (!move.piece.hasMoved) {
      score += 30; // "Desprender"
      reason = "Desbloquear uma peça na linha inicial.";
    } else {
      score += 10; // Mover peça já solta na linha inicial
      reason = "Reposicionar na linha inicial.";
    }
  }
  else if (isAlreadyInPlay) {
    score += 5; // Mover Peça Solta
    reason = "Avançar uma peça em jogo.";
  }
  
  //LÓGICA DO BÓNUS FINAL
  // (Aplica apenas se o destino for a linha final e não for uma captura)
  if (move.target.row === lastRow && score < 100) { 
    if (engine.hasPiecesOnInitialRow(player)) {
      // MAU: A linha inicial AINDA TEM PEÇAS. A peça vai ficar presa.
      score -= 10; // Penalização por ficar preso
      reason = "Mover para a linha final (mas ficará presa).";
    } else {
      // BOM: A linha inicial está VAZIA. A peça pode mover-se.
      score += 15; // Bónus por entrar na fase final
      reason = "Entrar na linha final (segura).";
    }
  }
  
  return { score, reason }; // <-- Retorna um objeto
}

// Retorna um array com todos os movimentos legais para o jogador atual.

function getAllPossibleMoves(engine) {
  const allMoves = [];
  const pieces = engine.getSelectableCells(); // Peças do jogador atual
  
  for (const p of pieces) {
    // Importante: O motor "getValidMoves" seleciona internamente a peça
    const targets = engine.getValidMoves(p.row, p.col);
    
    for (const t of targets) {
      allMoves.push({ piece: p, target: t });
    }
  }
  return allMoves;
}

//Verifica se resta apenas uma peça do jogador na sua linha inicial.
function isLastPieceOnInitialRow(engine, player) {
  const initialRow = (player === 1) ? 3 : 0;
  const board = engine.getBoard();
  
  let count = 0;
  for (let c = 0; c < engine.getColumns(); c++) {
    const piece = board[initialRow][c];
    if (piece && piece.player === player) {
      count++;
      if (count > 1) return false; // Otimização
    }
  }
  return count === 1;
}

/**
 * Ponto de entrada para DICAS (Nível Difícil).
 * Retorna o objeto de jogada e a justificação.
 */
export function getBestMoveWithHint(engine) {
  const allMoves = getAllPossibleMoves(engine);
  if (allMoves.length === 0) {
    return null;
  }

  console.log(`--- HINT: Avaliando ${allMoves.length} jogadas (Dado=${engine.getDice()}) ---`);

  // Chamamos a lógica 'hard' e retornamos o objeto completo
  const hardResult = findHardMove(engine, allMoves); // Retorna { move, score, reason }
  
  if (!hardResult) return null;
  
  console.log(`--- HINT Escolheu: [${hardResult.move.piece.row},${hardResult.move.piece.col}] (Razão: ${hardResult.reason}) ---`);

  // Retorna a jogada e a razão
  return {
    move: hardResult.move,
    reason: hardResult.reason
  };
}