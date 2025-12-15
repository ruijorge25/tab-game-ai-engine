# Tab Game Server (RIP)

## Run Locally

```powershell
cd C:\Users\Utilizador\Desktop\TW\tab-game\RIP
npm run start
# or
node C:\Users\Utilizador\Desktop\TW\tab-game\RIP\index.js
```

- Server listens on port `8034`.
- Ensure `RIP/data` exists; the server creates it if missing.

## API Overview
- POST `/register`: `{ nick, password }`
- POST `/ranking`: `{ group, size }` (currently required by spec; ranking by wins)
- POST `/join`: `{ nick, password, group, size }`
- POST `/leave`: `{ nick, password, game }`
- POST `/notify`: `{ nick, password, game, cell }`
- GET `/update?nick=...&game=...`: Server-Sent Events stream

Status codes:
- 200: success
- 400: bad request (validation)
- 401: unauthorized (nick/password invalid)
- 404: unknown request or game not found

## Deployment (twserver)
Use the jump server for SSH and SCP.

Open shell on twserver-be:
```bash
ssh -J up999999999@ssh.alunos.dcc.fc.up.pt up999999999@twserver-be
```

Copy files to a folder on twserver-be:
```bash
scp -J up999999999@ssh.alunos.dcc.fc.up.pt * up999999999@twserver-be:pasta
```

Start the server on the target machine (adjust path):
```bash
node /path/to/RIP/index.js
```
