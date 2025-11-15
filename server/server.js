// server/server.js

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const roomStore = require("./rooms");
const drawingState = require("./drawing-state");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "..", "client")));

const roomsOperations = {};
const users = {};

function generateUsername() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let username = '';
  for (let i = 0; i < 8; i++) {
    username += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return username;
}

function generateUserColor() {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function broadcastUserList(room) {
  const clients = roomStore.listClients(room);
  const userList = clients.map(client => ({
    id: client.id,
    username: users[client.id]?.username || 'Unknown',
    color: users[client.id]?.color || '#888888'
  }));
  io.to(room).emit("user-list", userList);
  
  // Also broadcast user map for hover functionality
  const userMap = {};
  clients.forEach(client => {
    userMap[client.id] = users[client.id]?.username || 'Unknown';
  });
  io.to(room).emit("user-map", userMap);
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);
  
  users[socket.id] = {
    username: generateUsername(),
    color: generateUserColor()
  };
  
  let currentRoom = null;

  socket.on("join-room", (room) => {
    if (currentRoom) socket.leave(currentRoom);
    currentRoom = room;
    socket.join(room);
    roomStore.addClient(room, { id: socket.id });

    if (!roomsOperations[room]) roomsOperations[room] = [];

    socket.emit("canvas-history", roomsOperations[room]);
    socket.emit("user-info", users[socket.id]);
    
    broadcastUserList(room);
    
    console.log(socket.id, "joined room:", room, "as", users[socket.id].username);
  });

  socket.on("draw", (ev) => {
    if (!currentRoom) return;
    if (
      ev &&
      typeof ev.prevX === "number" &&
      typeof ev.prevY === "number" &&
      typeof ev.x === "number" &&
      typeof ev.y === "number"
    ) {
      const op = {
        userId: socket.id,
        username: users[socket.id]?.username || 'Unknown', // Include username
        prevX: ev.prevX,
        prevY: ev.prevY,
        x: ev.x,
        y: ev.y,
        color: ev.color,
        size: ev.size,
        tool: ev.tool,
        opId: roomsOperations[currentRoom].length,
        active: true,
        clientId: ev.clientId
      };
      roomsOperations[currentRoom].push(op);
      io.to(currentRoom).emit("draw", op);
    }
  });

  socket.on("clear", () => {
    if (!currentRoom) return;
    const ops = roomsOperations[currentRoom];
    const removed = [];
    ops.forEach((op) => {
      if (op.userId === socket.id && op.active) {
        op.active = false;
        removed.push(op.opId);
      }
    });
    io.to(currentRoom).emit("clear-user-strokes", { ops: removed });
  });

  socket.on("undo", () => {
    if (!currentRoom) return;
    const ops = roomsOperations[currentRoom];
    for (let i = ops.length - 1; i >= 0; i--) {
      if (ops[i].userId === socket.id && ops[i].active) {
        ops[i].active = false;
        io.to(currentRoom).emit("undo-op", { opId: ops[i].opId });
        break;
      }
    }
  });

  socket.on("redo", () => {
    if (!currentRoom) return;
    const ops = roomsOperations[currentRoom];
    for (let i = 0; i < ops.length; i++) {
      if (ops[i].userId === socket.id && !ops[i].active) {
        ops[i].active = true;
        io.to(currentRoom).emit("redo-op", { opId: ops[i].opId });
        break;
      }
    }
  });

  socket.on("cursor", (pos) => {
    if (!currentRoom) return;
    io.to(currentRoom).emit("cursor", {
      id: socket.id,
      x: pos.x,
      y: pos.y,
      color: pos.color
    });
  });

  socket.on("saveSnapshot", (data) => {
    if (!currentRoom) return;
    if (data?.snapshot) drawingState.pushSnapshot(currentRoom, data.snapshot);
  });

  socket.on("requestLatest", () => {
    if (!currentRoom) return;
    const s = drawingState.getLatest(currentRoom);
    if (s) socket.emit("snapshot", { snapshot: s });
  });

  socket.on("disconnect", () => {
    if (currentRoom) {
      roomStore.removeClient(currentRoom, socket.id);
      io.to(currentRoom).emit("remove-cursor", socket.id);
      broadcastUserList(currentRoom);
    }
    delete users[socket.id];
    console.log("Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running → http://localhost:${PORT}`));
