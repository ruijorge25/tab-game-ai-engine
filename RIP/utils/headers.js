export const headers = {
    'Access-Control-Allow-Origin': '*', // Permite acesso de qualquer origem
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization', //Adicionar Authorization
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
};

export const sseHeaders = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
};