Tâb é um jogo de estratégia milenar do Médio Oriente. O objetivo é capturar todas as peças do adversário movendo-as estrategicamente pelo tabuleiro de acordo com o lançamento de dados de paus tradicionais.

✨ Características
🎮 Modos de Jogo

Local vs IA - 3 níveis de dificuldade (Fácil, Médio, Difícil)
Multiplayer Online - Matchmaking automático com sincronização em tempo real

🎨 Personalização

4 temas visuais (Deserto, Noite no Deserto, Halloween, Natal)
Animações temáticas com Canvas
Sistema completo de áudio (música + SFX)
Tabuleiros configuráveis (7 a 15 colunas)

📊 Estatísticas

Rankings locais e do servidor
Histórico de partidas
Sistema de dicas com justificações


🚀 Instalação
Backend
bashcd RIP
npm install
npm start
Servidor inicia na porta 8134.
Frontend
bashnpm install
npm run dev      # Desenvolvimento
npm run build    # Produção
Configurar .env se necessário:
envVITE_API_URL=http://localhost:8134
```

---

## 🎲 Como Jogar

### Regras Básicas

1. **Dado de Paus** - 4 paus com faces claras/escuras:
   - 0 ou 4 claros → **6 ou 4** (joga novamente)
   - 1 claro → **Tâb** (joga novamente)
   - 2-3 claros → **2-3** casas

2. **Primeira Jogada** - Precisa tirar **Tâb (1)** para sair

3. **Movimento** - Percurso em serpentina pelo tabuleiro 4×N

4. **Captura** - Cair na casa do adversário elimina a peça

5. **Vitória** - Eliminar todas as peças adversárias

### ⌨️ Atalhos
- `Espaço` - Lançar dado
- `H` - Ver dica
- `R` - Regras
- `Esc` - Sair/Fechar

---

## 🛠️ Tecnologias

**Frontend**
- Vanilla JavaScript (ES6+)
- Vite
- Canvas API para animações

**Backend**
- Node.js HTTP nativo
- Server-Sent Events (SSE)
- Persistência com File System

---

## 📁 Estrutura
```
├── src/
│   ├── core/          # Estado, router, network, animações
│   ├── game/          # Motor do jogo + IA
│   ├── ui/            # Componentes visuais
│   └── views/         # Páginas SPA
├── RIP/
│   ├── index.js       # Servidor HTTP
│   ├── game/          # Motor do jogo (compartilhado)
│   └── data/          # Persistência JSON
└── .env               # Configuração

🎯 Sistema de IA

Fácil - Movimentos aleatórios
Médio - Heurística focada em capturas
Difícil - Avaliação estratégica com análise de risco/ameaça probabilística


🌐 API Principal
EndpointMétodoDescrição/registerPOSTAutenticação/joinPOSTEntrar/criar jogo/notifyPOSTEnviar jogada/updateGETStream SSE de atualizações/rankingPOSTTop 10 jogadores

📝 Licença
Projeto académico - Tecnologias Web

<div align="center">
Desenvolvido com ☕ para a cadeira de Tecnologias Web
</div>
