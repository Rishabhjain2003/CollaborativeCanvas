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

// Each room stores its own operations
// roomsOperations = { roomName: [ op, op, ... ] }
const roomsOperations = {};

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  let currentRoom = null;

  // Join a room
  socket.on("join-room", (room) => {
    if (currentRoom) socket.leave(currentRoom);

    currentRoom = room;
    socket.join(room);

    roomStore.addClient(room, { id: socket.id });

    // Make sure room storage exists
    if (!roomsOperations[room]) roomsOperations[room] = [];

    // Send existing drawing operations to newly joined client
    socket.emit("canvas-history", roomsOperations[room]);

    console.log(socket.id, "joined room:", room);
  });

  // Draw event
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

  // Clear only user's strokes
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

  // Undo
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

  // Redo
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

  // Cursor moves
  socket.on("cursor", (pos) => {
    if (!currentRoom) return;

    io.to(currentRoom).emit("cursor", {
      id: socket.id,
      x: pos.x,
      y: pos.y,
      color: pos.color
    });
  });

  // Snapshots
  socket.on("saveSnapshot", (data) => {
    if (!currentRoom) return;
    if (data?.snapshot) drawingState.pushSnapshot(currentRoom, data.snapshot);
  });

  socket.on("requestLatest", () => {
    if (!currentRoom) return;
    const s = drawingState.getLatest(currentRoom);
    if (s) socket.emit("snapshot", { snapshot: s });
  });

  // Disconnect
  socket.on("disconnect", () => {
    if (currentRoom) {
      roomStore.removeClient(currentRoom, socket.id);
      io.to(currentRoom).emit("remove-cursor", socket.id);
    }
    console.log("Disconnected:", socket.id);
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running → http://localhost:${PORT}`));
