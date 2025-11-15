// client/canvas.js

window.remoteCursors = {};
window.localOps = []; // Each op: {prevX, prevY, x, y, color, size, tool, clientId, opId, userId, active, username}
window.userMap = {}; // Store userId -> username mapping

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

    // Tooltip elements
    this.tooltip = this.createTooltip();
    this.hoveredStroke = null;

    // Mouse events
    this.canvas.addEventListener("mousedown", (e) => this.startDrawing(e));
    this.canvas.addEventListener(
      "mousemove",
      throttle((e) => {
        this.handleDrawing(e);
        this.sendCursor(e);
        this.checkHover(e);
      }, 16)
    );
    this.canvas.addEventListener("mouseup", () => this.stopDrawing());
    this.canvas.addEventListener("mouseout", () => {
      this.stopDrawing();
      this.hideTooltip();
    });

    // Touch events
    this.canvas.addEventListener("touchstart", (e) => this.handleTouchStart(e));
    this.canvas.addEventListener("touchmove", (e) => this.handleTouchMove(e));
    this.canvas.addEventListener("touchend", () => this.stopDrawing());
  }

  createTooltip() {
    const tooltip = document.createElement("div");
    tooltip.id = "stroke-tooltip";
    tooltip.style.cssText = `
      position: absolute;
      background: rgba(17, 24, 39, 0.95);
      color: #e5e7eb;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      pointer-events: none;
      z-index: 1000;
      display: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      font-family: 'Courier New', monospace;
    `;
    document.body.appendChild(tooltip);
    return tooltip;
  }

  showTooltip(x, y, username) {
    this.tooltip.textContent = `👤 ${username}`;
    this.tooltip.style.display = "block";
    this.tooltip.style.left = x + 15 + "px";
    this.tooltip.style.top = y - 10 + "px";
  }

  hideTooltip() {
    this.tooltip.style.display = "none";
    this.hoveredStroke = null;
  }

  checkHover(e) {
    if (this.isDrawing) {
      this.hideTooltip();
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Check strokes in reverse order (most recent first)
    for (let i = window.localOps.length - 1; i >= 0; i--) {
      const op = window.localOps[i];
      if (!op.active) continue;

      // Calculate distance from mouse to line segment
      const dist = this.distanceToLineSegment(
        mouseX, mouseY,
        op.prevX, op.prevY,
        op.x, op.y
      );

      // If mouse is within stroke radius + tolerance
      const tolerance = 5;
      if (dist <= (op.size / 2) + tolerance) {
        if (this.hoveredStroke !== i) {
          this.hoveredStroke = i;
          const username = window.userMap[op.userId] || op.username || "Unknown";
          this.showTooltip(e.clientX, e.clientY, username);
        }
        return;
      }
    }

    // No stroke hovered
    if (this.hoveredStroke !== null) {
      this.hideTooltip();
    }
  }

  distanceToLineSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      // Line segment is a point
      return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    }

    // Calculate projection parameter
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    // Calculate closest point on line segment
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    // Return distance to closest point
    return Math.sqrt((px - closestX) * (px - closestX) + (py - closestY) * (py - closestY));
  }

  getCoords(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  getTouchCoords(touch) {
    const r = this.canvas.getBoundingClientRect();
    return { x: touch.clientX - r.left, y: touch.clientY - r.top };
  }

  setColor(c) {
    this.currentColor = c;
    this.currentTool = "brush";
  }

  setEraser() {
    this.currentTool = "eraser";
  }

  setBrushSize(s) {
    this.brushSize = s;
  }

  startDrawing(e) {
    this.isDrawing = true;
    const { x, y } = this.getCoords(e);
    this.lastX = x;
    this.lastY = y;
    this.hideTooltip();
  }

  handleDrawing(e) {
    if (!this.isDrawing) return;
    const { x, y } = this.getCoords(e);
    const color = this.currentTool === "eraser" ? "#FFFFFF" : this.currentColor;
    const size = this.currentTool === "eraser" ? 20 : this.brushSize;

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = size;
    this.ctx.lineCap = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();

    const ev = {
      prevX: this.lastX,
      prevY: this.lastY,
      x,
      y,
      color,
      size,
      tool: this.currentTool,
      clientId: Date.now() + Math.random()
    };

    if (window.socket) window.socket.emit("draw", ev);

    this.lastX = x;
    this.lastY = y;
  }

  stopDrawing() {
    this.isDrawing = false;
  }

  handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const { x, y } = this.getTouchCoords(touch);
    this.isDrawing = true;
    this.lastX = x;
    this.lastY = y;
  }

  handleTouchMove(e) {
    e.preventDefault();
    if (!this.isDrawing) return;
    const touch = e.touches[0];
    const { x, y } = this.getTouchCoords(touch);
    const color = this.currentTool === "eraser" ? "#FFFFFF" : this.currentColor;
    const size = this.currentTool === "eraser" ? 20 : this.brushSize;

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = size;
    this.ctx.lineCap = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();

    const ev = {
      prevX: this.lastX,
      prevY: this.lastY,
      x,
      y,
      color,
      size,
      tool: this.currentTool,
      clientId: Date.now() + Math.random()
    };

    if (window.socket) window.socket.emit("draw", ev);

    this.lastX = x;
    this.lastY = y;
  }

  sendCursor(e) {
    if (!window.socket) return;
    const { x, y } = this.getCoords(e);
    window.socket.emit("cursor", { x, y, color: this.currentColor });
  }

  drawLine(x1, y1, x2, y2, color, size) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = size;
    this.ctx.lineCap = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  redraw() {
    this.clear();
    window.localOps.forEach((op) => {
      if (op.active) {
        this.drawLine(op.prevX, op.prevY, op.x, op.y, op.color, op.size);
      }
    });
  }

  downloadCanvas() {
    const link = document.createElement("a");
    link.download = "canvas.png";
    link.href = this.canvas.toDataURL();
    link.click();
  }
}

class CanvasApp {
  constructor() {
    this.drawing = new CanvasDrawing("canvas");
  }

  static init() {
    if (!window.CanvasAppInstance) {
      window.CanvasAppInstance = new CanvasApp();
    }
    return window.CanvasAppInstance;
  }

  applyRemote(op) {
    if (!op || typeof op.x === "undefined") return;
    window.localOps.push(op);
    if (op.active !== false) {
      this.drawing.drawLine(op.prevX, op.prevY, op.x, op.y, op.color, op.size);
    }
  }

  setFromServerHistory(ops) {
    window.localOps = ops;
    this.drawing.redraw();
  }

  handleUndoOp(opId) {
    const op = window.localOps.find((o) => o.opId === opId);
    if (op) {
      op.active = false;
      this.drawing.redraw();
    }
  }

  handleRedoOp(opId) {
    const op = window.localOps.find((o) => o.opId === opId);
    if (op) {
      op.active = true;
      this.drawing.redraw();
    }
  }

  handleClearUserStrokes(opIds) {
    opIds.forEach((opId) => {
      const op = window.localOps.find((o) => o.opId === opId);
      if (op) op.active = false;
    });
    this.drawing.redraw();
  }

  undo() {
    if (window.socket) window.socket.emit("undo");
  }

  redo() {
    if (window.socket) window.socket.emit("redo");
  }

  clear() {
    if (window.socket) window.socket.emit("clear");
  }

  download() {
    this.drawing.downloadCanvas();
  }
}
