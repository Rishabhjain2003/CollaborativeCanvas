// client/websocket.js
(function () {
  const socket = io();
  window.socket = socket;

  const cursors = {};
  const cursorsEl = document.getElementById("cursors");
  const canvas = document.getElementById("canvas");
  const app = CanvasApp.init();

  // Request initial snapshot
  socket.on("connect", () => {
    socket.emit("join-room", "default");
    socket.emit("requestLatest");
  });

  // Server sends full history at connect
  socket.on("canvas-history", (ops) => {
    if (Array.isArray(ops)) app.setFromServerHistory(ops);
  });

  // New stroke from server
  socket.on("draw", (op) => {
    app.applyRemote(op);
  });

  // Undo broadcast
  socket.on("undo-op", ({ opId }) => {
    app.handleUndoOp(opId);
  });

  // Redo broadcast
  socket.on("redo-op", ({ opId }) => {
    app.handleRedoOp(opId);
  });

  // Clear only user strokes broadcast
  socket.on("clear-user-strokes", (data) => {
    if (Array.isArray(data.ops)) {
      app.handleClearUserStrokes(data.ops);
    }
  });
  

  // Snapshot loading
  socket.on("snapshot", (data) => {
    if (data?.snapshot) app.setFromServerSnapshot(data.snapshot);
  });

  socket.on("setSnapshot", (data) => {
    if (data?.snapshot) app.setFromServerSnapshot(data.snapshot);
  });

  // Cursor positions
  socket.on("cursor", (p) => {
    let el = cursors[p.id];
    if (!el) {
      el = document.createElement("div");
      el.className = "cursor";
      cursors[p.id] = el;
      cursorsEl.appendChild(el);
    }
    el.style.left = p.x + "px";
    el.style.top = p.y + "px";
    el.style.background = p.color;
  });

  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    socket.emit("cursor", {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      color: app.drawing.currentColor
    });
  });

})();
