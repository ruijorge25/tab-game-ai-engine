// Adapter que normaliza a API para a UI atual

export function createEngineAdapter(coreEngine) {
  return {
    // leitura
    getColumns:      () => coreEngine.getColumns(),
    getBoard:        () => coreEngine.getBoard(),
    getCurrentPlayer:() => coreEngine.getCurrentPlayer(),
    getPieceCounts: () => coreEngine.getPieceCounts(),
    getDice:         () => coreEngine.getDice(),

    // dado
    canRoll:         () => coreEngine.canRoll(),
    rollDice:        () => coreEngine.rollDice(),

    // seleção/movimento
    getSelectableCells: () => coreEngine.getSelectableCells(),
    getValidMoves:      (r, c) => coreEngine.getValidMoves(r, c),
    getHypotheticalMoves: (r, c, dice, player) => coreEngine.getHypotheticalMoves(r, c, dice, player),
    hasPiecesOnInitialRow: (player) => coreEngine.hasPiecesOnInitialRow(player),
    moveSelectedTo:     (r, c) => coreEngine.moveSelectedTo(r, c),

    passTurn: () => coreEngine.passTurn(),
    giveUp:   () => coreEngine.giveUp(),

    // verificações
    checkWinner: () => coreEngine.checkWinner(),
    canPass:     () => coreEngine.canPass(),

    // no-op para compat
    on() { return () => {}; }
  };
}