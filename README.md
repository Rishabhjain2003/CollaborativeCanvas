# Collaborative Canvas — Real-Time Drawing App

A real-time, multi-user collaborative drawing application built with **HTML5 Canvas**, **Vanilla JavaScript**, **Node.js**, and **Socket.IO**.
Features include live drawing sync, undo/redo, user-specific clearing, color selection, brush tools, remote cursors, and room support.

This repository contains:

```
client/   → Frontend (HTML, CSS, JavaScript)
server/   → Backend (Node.js + Socket.IO)
```

Fully deployable on **Render**, **Railway**, **DigitalOcean**, **Heroku**, etc.

---

## 🚀 Features

* ✏️ **Real-time drawing** between any number of connected clients
* 🖱️ **Remote cursor sharing**
* 🎨 **Brush & eraser tools**
* 🌈 **Color picker & brush size control**
* ↩️ **Undo & redo** (per-user stroke history)
* 🧹 **Clear only your own strokes** (does NOT delete others' drawings)
* 💾 **Snapshot/restore support**
* 🏠 **Multiple rooms** (optional)
* ⚡ Ultra-low latency using WebSockets
* 🎯 **User stroke tracking:** Each brush stroke is associated with a unique user ID, enabling per-user undo, redo, and selective clearing without affecting other users' drawings.

---

# 🛠️ Tech Stack

### **Frontend**

* HTML5 Canvas API
* Vanilla JavaScript
* Socket.IO client
* Bootstrap 5 CSS
* Bootstrap Icons

### **Backend**

* Node.js
* Express.js
* Socket.IO server
* In-memory operation history with user tracking

---

# 📂 Project Structure

```
flamai/
│
├── client/
│   ├── index.html
│   ├── style.css
│   ├── canvas.js
│   ├── websocket.js
│   └── main.js
│
├── server/
│   ├── server.js
│   ├── drawing-state.js
│   ├── rooms.js
│   └── package.json
│
├── ARCHITECTURE.md
├── README.md
└── package.json
```

---

# ⚙️ Local Development Setup

### **1. Clone the Repository**

```bash
git clone https://github.com/yourusername/flamai.git
cd flamai
```

---

## **Backend Setup**

Located in the `server/` folder.

### **2. Install backend dependencies**

```bash
cd server
npm install
```

### **3. Start the backend**

```bash
npm start
```

Backend runs on:

```
http://localhost:3000
```

The backend automatically serves the frontend from the `client/` directory, so you can access the full application at `http://localhost:3000`.

---

## **Frontend Development**

The frontend is static and served from the `client/` directory by the backend server.

### **Option 1: Served by Backend (Recommended)**

Simply start the backend server (step 3 above) and navigate to:

```
http://localhost:3000
```

### **Option 2: Standalone Development**

For frontend-only development, you can serve it using any static file server:

**Using VSCode Live Server:**
* Right-click **client/index.html**
* Click **"Open with Live Server"**

**Using Python:**
```bash
cd client
python -m http.server 8000
```

**Using Node.js http-server:**
```bash
npm install -g http-server
cd client
http-server
```

---

# 🌐 Deployment Guide

## **Backend Deployment**

The backend can be deployed to any Node.js hosting platform. Make sure to:

1. Set the environment port (most platforms provide this automatically)
2. Install dependencies with `npm install`
3. Start the server with `npm start`

**Popular Hosting Options:**
* Render
* Railway
* DigitalOcean App Platform
* Heroku
* Fly.io
* AWS Elastic Beanstalk

---

## **Frontend Deployment**

### **Option 1: Served by Backend (Recommended)**

Deploy only the backend, which automatically serves the frontend. This approach:
* Simplifies deployment
* Avoids CORS issues
* Keeps everything in one place

### **Option 2: Separate Frontend Deployment**

If deploying frontend separately (e.g., Netlify, Vercel, GitHub Pages):

1. Deploy frontend as a static site from the `client/` directory
2. Update `client/websocket.js` to point to your backend URL:

```js
const socket = io("https://your-backend-url.com");
```

---

# 🧠 Architecture Overview

### **Client Responsibilities**

* Draw lines immediately for responsiveness
* Emit drawing operations to server
* Store local operations (brush strokes) with user IDs
* Redraw canvas based on operation history
* Handle undo/redo for current user only
* Render remote user cursors

### **Server Responsibilities**

* Maintain global list of all drawing operations
* Tag each stroke with userId + opId
* Broadcast new strokes to all clients
* Handle per-user undo/redo requests
* Handle per-user clear (deactivate only user's strokes)
* Serve static frontend files
* Provide latest snapshots

### **User Stroke Tracking Implementation**

Each drawing operation includes:
* **userId**: Unique identifier for the user who created the stroke
* **opId**: Unique operation ID for the stroke
* **active**: Boolean flag to mark if stroke is visible

This enables:
* Users to undo/redo only their own strokes
* Users to clear only their own drawings
* Preservation of other users' work during individual actions

---

# 🧪 Testing Locally

1. Start the backend server:
   ```bash
   cd server
   npm start
   ```

2. Open 2–3 browser tabs at `http://localhost:3000`

3. Draw in any tab — it should instantly sync across all others

4. Test user-specific features:
   * Draw strokes in different tabs (different users)
   * Use undo/redo in one tab — should only affect that user's strokes
   * Use clear in one tab — should only remove that user's strokes

---

# 🐛 Troubleshooting

### **❌ No drawing appears on other clients**

* Check browser console for WebSocket errors
* Confirm backend server is running on port 3000
* Ensure Socket.IO is properly connected (check connection status badge)

### **❌ 404 for socket.io.js**

* Backend must be running and accessible
* Frontend must connect to the correct backend URL
* Check that Express is serving static files from the client directory

### **❌ Clear button clears entire canvas**

* Backend must emit unique opIds per user
* Frontend must only deactivate operations matching the current userId
* Verify userId is properly assigned and transmitted

### **❌ Undo affects other users' strokes**

* Ensure each operation includes the correct userId
* Verify undo logic filters operations by userId
* Check that userId is consistent across the session

### **❌ Port already in use**

```bash
# Kill the process using port 3000 (macOS/Linux)
lsof -ti:3000 | xargs kill -9

# Or change the port in server.js
const PORT = process.env.PORT || 4000;
```

---

# 🎨 UI Features

* **Modern Bootstrap 5 design** with dark theme
* **Responsive layout** that works on desktop, tablet, and mobile
* **Bootstrap Icons** for intuitive visual elements
* **Smooth animations** and hover effects
* **Real-time connection status** indicator
* **Active user counter** showing connected clients

---

# 🤝 Contributing

Pull requests are welcome! Please open an issue to discuss major changes before submitting a PR.

### Development Guidelines:
* Follow existing code style
* Test thoroughly with multiple clients
* Update documentation as needed
* Keep client and server logic separated
* Ensure user tracking features work correctly

---

# 📝 License

MIT License - feel free to use this project for learning or commercial purposes.

---

# 🔗 Resources

* [Socket.IO Documentation](https://socket.io/docs/)
* [HTML5 Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
* [Bootstrap 5 Documentation](https://getbootstrap.com/docs/5.3/)

---

**Built with ❤️ using Vanilla JavaScript and Socket.IO**
