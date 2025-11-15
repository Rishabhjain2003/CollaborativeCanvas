// client/canvas.js
window.remoteCursors = {};
window.localOps = []; // Each op: {prevX, prevY, x, y, color, size, tool, clientId, opId, userId, active}

function throttle(fn, interval) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last > interval) {
      fn(...args);
      last = now;
    }
  };
}

class CanvasDrawing {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) throw new Error("Canvas element not found: " + canvasId);
    this.ctx = this.canvas.getContext("2d");
    this.isDrawing = false;
    this.currentTool = "brush";
    this.currentColor = "#000000";
    this.brushSize = 2;
    this.lastX = 0;
    this.lastY = 0;

    // Mouse events
    this.canvas.addEventListener("mousedown", (e) => this.startDrawing(e));
    this.canvas.addEventListener(
      "mousemove",
      throttle((e) => {
        this.handleDrawing(e);
        this.sendCursor(e);
      }, 16)
    );
    this.canvas.addEventListener("mouseup", () => this.stopDrawing());
    this.canvas.addEventListener("mouseout", () => this.stopDrawing());
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  startDrawing(e) {
    this.isDrawing = true;
    const pos = this.getMousePos(e);
    this.lastX = pos.x;
    this.lastY = pos.y;
  }

  handleDrawing(e) {
    const pos = this.getMousePos(e);
    if (!this.isDrawing) return;

    // draw locally immediately for responsiveness
    this.drawLine(this.lastX, this.lastY, pos.x, pos.y, this.currentColor, this.brushSize, this.currentTool, true);

    // send draw event through the higher-level emitter (populated by CanvasApp)
    if (window.emitDrawEvent) {
      window.emitDrawEvent({
        prevX: this.lastX,
        prevY: this.lastY,
        x: pos.x,
        y: pos.y,
        color: this.currentColor,
        size: this.brushSize,
        tool: this.currentTool
      });
    }

    this.lastX = pos.x;
    this.lastY = pos.y;
  }

  stopDrawing() {
    this.isDrawing = false;
  }

  drawLine(x1, y1, x2, y2, color, size, tool = "brush", active = true) {
    if (!active) return; // don't draw inactive ops
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    if (tool === "eraser") {
      this.ctx.globalCompositeOperation = "destination-out";
      this.ctx.lineWidth = size * 2;
    } else {
      this.ctx.globalCompositeOperation = "source-over";
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = size;
    }
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.stroke();
    this.ctx.globalCompositeOperation = "source-over";
  }

  setColor(color) {
    this.currentColor = color;
  }
  setBrushSize(size) {
    this.brushSize = size;
  }
  setTool(tool) {
    this.currentTool = tool;
  }
  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  sendCursor(e) {
    const pos = this.getMousePos(e);
    if (window.emitCursorMove) {
      window.emitCursorMove({ x: pos.x, y: pos.y, color: this.currentColor });
    }
  }

  redrawFromHistory(ops) {
    // ops is array of op objects (localOps)
    this.clearCanvas();
    // draw remote cursors last (they will be drawn by overlay in main; here we only draw strokes)
    ops.forEach((op) => {
      if (op.active) {
        this.drawLine(op.prevX, op.prevY, op.x, op.y, op.color, op.size, op.tool, op.active);
      }
    });
  }
}

/**
 * CanvasApp: manages localOps array, emits draw events, receives remote draws,
 * handles undo/redo/clear-user-strokes, snapshots.
 */
const CanvasApp = (function () {
  let instance;
  function create() {
    const app = {};
    app.drawing = new CanvasDrawing("canvas");

    // helper to generate client-local IDs to correlate local ops with server ops
    function makeClientId() {
      return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    }

    // Expose emit functions that websockets.js will attach to socket
    window.emitDrawEvent = function (ev) {
      // generate client-local unique id
      const clientId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    
      // create local op
      const localOp = {
        prevX: ev.prevX,
        prevY: ev.prevY,
        x: ev.x,
        y: ev.y,
        color: ev.color,
        size: ev.size,
        tool: ev.tool,
        clientId,
        opId: null,
        userId: null,
        active: true
      };
    
      // store locally
      window.localOps.push(localOp);
    
      // send to server
      if (window.socket) {
        console.log("Sending draw", { ...ev, clientId });
        window.socket.emit("draw", { ...ev, clientId });
      }
    };
    
    window.emitCursorMove = function (p) {
      if (window.socket) window.socket.emit("cursor", p);
    };

    // apply remote draw emitted by server (including broadcasts that include local user's op)
    app.applyRemote = function (op) {
      // is this our own op?
      if (op.clientId) {
        const idx = window.localOps.findIndex(lo => lo.clientId === op.clientId);
        if (idx !== -1) {
          window.localOps[idx].opId = op.opId;
          window.localOps[idx].userId = op.userId;
          return; // already drawn locally
        }
      }
    
      // otherwise add as a remote stroke
      const newOp = {
        prevX: op.prevX,
        prevY: op.prevY,
        x: op.x,
        y: op.y,
        color: op.color,
        size: op.size,
        tool: op.tool,
        clientId: op.clientId || null,
        opId: op.opId,
        userId: op.userId,
        active: op.active !== false
      };
    
      window.localOps.push(newOp);
      app.drawing.drawLine(
        newOp.prevX,
        newOp.prevY,
        newOp.x,
        newOp.y,
        newOp.color,
        newOp.size,
        newOp.tool,
        newOp.active
      );
    };
    

    // When history arrives (on connect) replace localOps with server history and redraw
    app.setFromServerHistory = function (ops) {
      // copy ops to localOps (so clients can mirror server state)
      window.localOps = ops.map((o) => ({
        prevX: o.prevX,
        prevY: o.prevY,
        x: o.x,
        y: o.y,
        color: o.color,
        size: o.size,
        tool: o.tool,
        clientId: o.clientId || null,
        opId: o.opId,
        userId: o.userId,
        active: o.active !== false
      }));
      app.drawing.redrawFromHistory(window.localOps);
    };

    // When server sends snapshot (dataURL), set canvas to that and clear localOps
    app.setFromServerSnapshot = function (dataURL) {
      const img = new Image();
      img.onload = function () {
        app.drawing.clearCanvas();
        app.drawing.ctx.drawImage(img, 0, 0);
        // reset localOps because snapshot may incorporate strokes
        window.localOps = [];
      };
      img.src = dataURL;
    };

    // Undo/redo/clear client-side helpers: server is authoritative and will broadcast undo-op/redo-op/clear-user-strokes
    app.undo = function () {
      if (window.socket) window.socket.emit("undo");
    };
    app.redo = function () {
      if (window.socket) window.socket.emit("redo");
    };
    app.clearOwn = function () {
      if (window.socket) window.socket.emit("clear");
    };

    // Handle incoming undo-op (server tells clients to mark op inactive)
    app.handleUndoOp = function (opId) {
      const idx = window.localOps.findIndex((o) => o.opId === opId);
      if (idx !== -1) {
        window.localOps[idx].active = false;
        app.drawing.redrawFromHistory(window.localOps);
      }
    };

    // Handle incoming redo-op
    app.handleRedoOp = function (opId) {
      const idx = window.localOps.findIndex((o) => o.opId === opId);
      if (idx !== -1) {
        window.localOps[idx].active = true;
        app.drawing.redrawFromHistory(window.localOps);
      }
    };

    // Handle clear-user-strokes: server provides array of opIds to mark inactive
    app.handleClearUserStrokes = function (opIds) {
      if (!Array.isArray(opIds) || opIds.length === 0) return;
      const set = new Set(opIds);
      let changed = false;
      for (let i = 0; i < window.localOps.length; i++) {
        if (window.localOps[i].opId != null && set.has(window.localOps[i].opId)) {
          window.localOps[i].active = false;
          changed = true;
        }
      }
      if (changed) app.drawing.redrawFromHistory(window.localOps);
    };

    return app;
  }

  return {
    init: function () {
      if (!instance) instance = create();
      return instance;
    }
  };
})();
