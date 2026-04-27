# Tâb Game

**Tâb** is a traditional Middle Eastern strategy board game where players compete to capture all opponent pieces by moving them strategically across the board based on stick-dice rolls.

This project is a modern digital implementation featuring AI opponents, online multiplayer, customization options, and real-time synchronization.

---

## Features

### Game Modes

- Local vs AI with 3 difficulty levels:
  - Easy
  - Medium
  - Hard
- Online Multiplayer with automatic matchmaking
- Real-time synchronization between players

---

### Customization

- 4 visual themes:
  - Desert
  - Desert Night
  - Halloween
  - Christmas
- Canvas-based thematic animations
- Full audio system (music + sound effects)
- Configurable board size (7 to 15 columns)

---

### Statistics System

- Local and server rankings
- Match history tracking
- Hint system with move explanations

---

## Installation

### Backend

```bash
cd RIP
npm install
npm start
```

Server runs on port:

```
8134
```

### Frontend

```bash
npm install
npm run dev     # Development
npm run build   # Production
```

If needed, configure:

```
VITE_API_URL=http://localhost:8134
```

---

## How to Play

### Basic Rules

#### Stick Dice

The game uses 4 traditional sticks:

- 0 or 4 light sides → move 6 or 4 squares (extra turn)
- 1 light side → **Tâb** (extra turn)
- 2–3 light sides → move 2–3 squares

#### First Move

A player must roll **Tâb (1)** to enter the board.

#### Movement

Pieces follow a **serpentine path** across a 4×N board.

#### Capture

Landing on an opponent’s square captures their piece.

#### Victory Condition

Capture all opponent pieces to win the match.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Roll dice |
| H | Show hint |
| R | Show rules |
| Esc | Exit / Close menu |

---

## Technologies

### Frontend

- Vanilla JavaScript (ES6+)
- Vite
- Canvas API for animations

### Backend

- Node.js (native HTTP server)
- Server-Sent Events (SSE)
- File system persistence

---

## AI System

- Easy → Random moves
- Medium → Capture-oriented heuristic strategy
- Hard → Strategic evaluation with probabilistic threat analysis

---

## Main API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /register | POST | Authentication |
| /join | POST | Join/create match |
| /notify | POST | Send move |
| /update | GET | SSE updates stream |
| /ranking | POST | Top 10 players |

---

## License

Academic project developed for the **Web Technologies** course.
