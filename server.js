const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(express.static(__dirname));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// Abrir DB SQLite
const db = new sqlite3.Database(path.join(__dirname, 'chat.db'), err => {
  if(err) console.error(err);
  else console.log('Base de datos lista');
});

// Crear tabla mensajes si no existe
db.run(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  text TEXT,
  isImage INTEGER,
  timestamp INTEGER
)`);

let users = new Map();

function broadcast(data){
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if(client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

function loadMessages(ws){
  db.all("SELECT * FROM messages ORDER BY timestamp ASC", [], (err, rows) => {
    if(err) return console.error(err);
    ws.send(JSON.stringify({type:'history', messages:rows.map(r=>({
      type:'message',
      name:r.name,
      text:r.text,
      isImage:!!r.isImage,
      when:r.timestamp
    }))}));
  });
}

wss.on('connection', ws => {
  loadMessages(ws);

  ws.on('message', message => {
    let data;
    try { data = JSON.parse(message); } catch(e){ return; }

    if(data.type === 'join'){
      users.set(ws, data.name);
      broadcast({type:'system', text:`${data.name} se ha unido.`});
      broadcast({type:'users', users: Array.from(users.values())});
    } else if(data.type === 'message'){
      const name = users.get(ws) || 'Desconocido';
      const timestamp = Date.now();
      db.run("INSERT INTO messages(name,text,isImage,timestamp) VALUES (?,?,?,?)",
        [name, data.text, data.isImage?1:0, timestamp], err => {
          if(err) console.error(err);
          const msgObj = {type:'message', name, text:data.text, isImage:data.isImage||false, when:timestamp};
          broadcast(msgObj);
        });
    }
  });

  ws.on('close', () => {
    const name = users.get(ws);
    if(name){
      users.delete(ws);
      broadcast({type:'system', text:`${name} se ha desconectado.`});
      broadcast({type:'users', users: Array.from(users.values())});
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log(`Servidor escuchando en http://localhost:${PORT}`));
