const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(express.static(__dirname));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

let users = new Map();

function broadcast(data){
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if(client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

wss.on('connection', ws => {
  ws.on('message', message => {
    let data;
    try { data = JSON.parse(message); } catch(e){ return; }

    if(data.type === 'join'){
      users.set(ws, data.name);
      broadcast({type:'system', text:`${data.name} se ha unido.`});
      broadcast({type:'users', users: Array.from(users.values())});
    } else if(data.type === 'message'){
      const name = users.get(ws) || 'Desconocido';
      // data.text puede ser texto o imagen (base64)
      broadcast({type:'message', name, text:data.text, when: Date.now(), isImage: data.isImage||false});
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
server.listen(PORT, () => console.log(`Servidor escuchando en http://localhost:${PORT}`));
