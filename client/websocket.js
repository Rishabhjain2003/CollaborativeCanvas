// client/websocket.js

(function () {
  const socket = io();
  window.socket = socket;

  const cursors = {};
  const cursorsEl = document.getElementById("cursors");
  const canvas = document.getElementById("canvas");
  const app = CanvasApp.init();
  
  let currentUserId = null;

  // Request initial snapshot
  socket.on("connect", () => {
    socket.emit("join-room", "default");
    socket.emit("requestLatest");
    document.getElementById("status").className = "badge bg-success";
    document.getElementById("status").innerHTML = '<i class="bi bi-circle-fill me-1"></i>Connected';
  });
  
  socket.on("disconnect", () => {
    document.getElementById("status").className = "badge bg-danger";
    document.getElementById("status").innerHTML = '<i class="bi bi-circle-fill me-1"></i>Disconnected';
  });

  // Receive user info
  socket.on("user-info", (userInfo) => {
    currentUserId = socket.id;
    console.log("Your username:", userInfo.username);
  });

  // Update user list in sidebar
  socket.on("user-list", (users) => {
    const userListEl = document.getElementById("userList");
    userListEl.innerHTML = "";
    
    users.forEach(user => {
      const userItem = document.createElement("div");
      userItem.className = "user-item" + (user.id === currentUserId ? " current-user" : "");
      
      const initials = user.username.substring(0, 2);
      
      userItem.innerHTML = `
        <div class="user-avatar" style="background: ${user.color};">
          <i class="bi bi-person-fill"></i>
        </div>
        <div class="user-info">
          <div class="user-name">${user.username}</div>
          <div class="user-status"><i class="bi bi-circle-fill" style="font-size: 0.5rem; color: #22c55e;"></i> Online</div>
        </div>
      `;
      
      userListEl.appendChild(userItem);
    });
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
    if (data?.snapshot) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = data.snapshot;
    }
  });

  // Remote cursors
  socket.on("cursor", ({ id, x, y, color }) => {
    if (!cursors[id]) {
      const c = document.createElement("div");
      c.className = "cursor";
      c.style.background = color || "#888";
      cursorsEl.appendChild(c);
      cursors[id] = c;
    }
    cursors[id].style.left = x + "px";
    cursors[id].style.top = y + "px";
  });

  socket.on("remove-cursor", (id) => {
    if (cursors[id]) {
      cursors[id].remove();
      delete cursors[id];
    }
  });
})();
