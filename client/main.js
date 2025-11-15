// client/main.js
(function () {
  const COLORS = ["#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", "#FFA500"];
  const app = CanvasApp.init();
  const brushSize = document.getElementById("size");
  const colorsEl = document.getElementById("colors");
  const brushBtn = document.getElementById("brushBtn");
  const eraserBtn = document.getElementById("eraserBtn");
  const undoBtn = document.getElementById("undo");
  const redoBtn = document.getElementById("redo");
  const clearBtn = document.getElementById("clear");
  const downloadBtn = document.getElementById("download");

  // populate colors
  COLORS.forEach((c) => {
    const b = document.createElement("button");
    b.style.background = c;
    b.title = c;
    b.addEventListener("click", () => {
      app.drawing.setColor(c);
      brushBtn.classList.add("active");
      eraserBtn.classList.remove("active");
    });
    colorsEl.appendChild(b);
  });

  brushBtn.addEventListener("click", () => {
    brushBtn.classList.add("active");
    eraserBtn.classList.remove("active");
    app.drawing.setTool("brush");
  });
  eraserBtn.addEventListener("click", () => {
    eraserBtn.classList.add("active");
    brushBtn.classList.remove("active");
    app.drawing.setTool("eraser");
  });

  brushSize.addEventListener("input", (e) => {
    app.drawing.setBrushSize(Number(e.target.value));
  });

  undoBtn.addEventListener("click", () => app.undo());
  redoBtn.addEventListener("click", () => app.redo());
  clearBtn.addEventListener("click", () => {
    app.clearOwn(); // Tell server to clear only MY strokes
  });
  

  downloadBtn.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "drawing.png";
    link.href = document.getElementById("canvas").toDataURL();
    link.click();
  });

  // If snapshot events arrive, CanvasApp will handle them (see websocket.js)
})();
