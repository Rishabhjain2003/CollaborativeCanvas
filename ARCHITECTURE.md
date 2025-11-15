# FlamAi Collaborative Canvas Architecture

This document describes the technical architecture of the FlamAi Collaborative Canvas, a real-time multi-user drawing application built with HTML5 Canvas, Vanilla JavaScript, Node.js, and Socket.IO.

---

## 1. Overview

FlamAi is a browser-based application that allows multiple users to draw simultaneously on a shared canvas with low latency.
The system uses a client–server model where all real-time synchronization is handled via WebSockets using Socket.IO.
The backend maintains the canonical drawing state, while each client keeps a local copy for instant visual feedback.

---

## 2. High-Level Architecture

```text
+----------------------+          WebSocket / HTTP          +----------------------+
|     Client (Web)     |  <------------------------------>  |   Node.js Backend    |
|----------------------|                                    |----------------------|
|  HTML / CSS / JS     |   Socket.IO client <——> server     |  Express + Socket.IO |
|  Canvas rendering    |                                    |  Drawing state store |
|  Input handling      |                                    |  Room management     |
+----------------------+                                    +----------------------+
```

**Key points:**
- Clients connect to the backend via Socket.IO over WebSocket (with HTTP fallback when needed).
- All drawing actions are emitted as small JSON messages describing strokes or operations.
- The server broadcasts validated operations to all clients in the same room.

---

## 3. Repository Layout

```text
flamai/
│
├── client/
│   ├── index.html        # Canvas UI, toolbar, layout
│   ├── style.css         # Dark theme + Bootstrap-based styling
│   ├── canvas.js         # Canvas drawing logic, undo/redo, rendering
│   ├── websocket.js      # Socket.IO client, event wiring
│   └── main.js           # App bootstrap, UI wiring, tool events
│
└── server/
    ├── server.js         # Express + Socket.IO server entrypoint
    ├── drawing-state.js  # In-memory drawing state and operations
    ├── rooms.js          # Optional room support helpers
    └── package.json
```

---

## 4. Client-Side Architecture

### 4.1 index.html

- Defines the main layout: header, toolbar, canvas area, footer.
- Loads Bootstrap CSS, Bootstrap Icons, and the app scripts (`canvas.js`, `main.js`, `websocket.js`).
- Exposes DOM elements for tools (brush, eraser, colors, size slider, undo/redo, clear, download).

### 4.2 style.css

- Implements a dark theme using CSS custom properties (`--bg`, `--panel`, `--accent`, etc.).
- Styles toolbar, buttons, canvas wrapper, connection status, and remote cursors.
- Enlarges color swatch buttons for better usability on desktop and touch devices.

### 4.3 main.js

- Initializes the UI once the DOM is ready.
- Wires toolbar controls to the canvas and WebSocket layers (e.g., brush/eraser toggle, size slider, clear).
- Manages local UI state such as currently selected color, tool, and brush size.

### 4.4 canvas.js

- Wraps the HTML5 Canvas 2D context and all drawing operations.
- Maintains a per-user operation history for undo/redo.
- Responsible for:
  - Drawing strokes (brush) and erasing (eraser) on the canvas.
  - Replaying operations when the history changes (undo/redo/clear).
  - Exporting the canvas as an image for the download feature.

**Core concepts:**

```js
// Example stroke operation shape (client-side)
{
  id: string,        // unique op id
  userId: string,    // socket or logical user id
  type: 'stroke',    // 'stroke' | 'erase' | 'clear'
  color: string,
  size: number,
  points: [          // polyline of sampled points
    { x: number, y: number },
    ...
  ]
}
```

### 4.5 websocket.js

- Establishes the Socket.IO connection to the backend.
- Listens for connection status events to update the UI (connected / disconnected badge).
- Sends local drawing operations to the server.
- Subscribes to broadcast events to apply remote operations to the local canvas.
- Handles optional room joining when rooms are enabled.

```js
const socket = io(); // or io('https://your-backend-url.com') in production

socket.on('connect', () => { /* update status UI */ });
socket.on('disconnect', () => { /* mark as offline */ });

// Receive new operations from server
socket.on('op:apply', (op) => {
  // push to local history and redraw
});
```

---

## 5. Server-Side Architecture

All backend logic lives under the `server/` directory.

### 5.1 server.js

- Creates an Express application and HTTP server.
- Attaches a Socket.IO server to the HTTP server.
- Serves static assets from the `client/` directory (index.html, JS, CSS).
- Registers Socket.IO event handlers for connection, drawing operations, undo/redo, and clear.

**Responsibilities:**
- Authenticate and track connected clients (lightweight, typically socket-level identity).
- Route incoming operations to the appropriate room or global canvas.
- Broadcast validated operations to all other clients in the same room.

### 5.2 drawing-state.js

- Implements an in-memory store for drawing operations.
- Maintains:
  - Global list of operations per room.
  - Indexes for operations by user.
- Provides APIs for:
  - Adding a new operation (stroke / erase / clear).
  - Computing the current visible set of operations.
  - Applying undo/redo on a per-user basis by marking operations as active/inactive.

```js
// Pseudocode
addOperation(roomId, op) { ... }
getVisibleOperations(roomId) { ... }
undoLastOperation(roomId, userId) { ... }
redoLastOperation(roomId, userId) { ... }
clearUserOperations(roomId, userId) { ... }
```

### 5.3 rooms.js

- Optional helper for room-based collaboration.
- Maps room IDs to:
  - Connected socket IDs
  - Associated drawing-state instances or segments
- Provides APIs such as `joinRoom`, `leaveRoom`, and `broadcastToRoom`.

---

## 6. Data Flow

### 6.1 Connection Flow

1. User opens the app in the browser.
2. Browser downloads `index.html`, `style.css`, and JS bundles from the Node.js server.
3. `websocket.js` initializes a Socket.IO connection to the backend.
4. The server assigns a unique socket ID and optionally a logical `userId`.
5. Client may join a default room or a specific room based on URL or UI selection.

### 6.2 Drawing Flow

1. User presses the mouse button (or touch) on the canvas.
2. `canvas.js` starts a new stroke and collects sampled points as the user moves.
3. On stroke end, the client builds an operation object describing the stroke.
4. Client immediately applies the stroke locally for instant feedback.
5. Client emits the operation to the server over Socket.IO (e.g., `socket.emit('op:new', op)`).
6. Server validates and stores the operation via `drawing-state.js`.
7. Server broadcasts the operation to all other clients in the same room.
8. Remote clients receive the operation, append it to their local history, and redraw.

### 6.3 Undo/Redo Flow (Per User)

1. User triggers undo via the toolbar.
2. Client sends an `undo` request to the server (e.g., `socket.emit('op:undo')`).
3. Server uses `drawing-state.js` to mark the last active operation for that user as inactive.
4. Server broadcasts an `op:undoApplied` event with enough information for clients to recompute the visible canvas.
5. Clients recompute or incrementally update their canvas.

Redo follows a similar flow but reactivates the next operation in the user’s history.

### 6.4 Clear-Own-Strokes Flow

1. User clicks the **Clear** button.
2. Client sends a `clear:mine` event to the server.
3. Server marks all operations belonging to that user as inactive for the given room.
4. Server broadcasts a `clear:mineApplied` or generic `state:update` event.
5. Clients rebuild the canvas from the updated visible operation list.

---

## 7. Communication Protocol

All real-time communication is handled via Socket.IO events.

### 7.1 Example Events (Client → Server)

- `op:new` — New stroke or operation created.
- `op:undo` — Request to undo last operation by current user.
- `op:redo` — Request to redo last undone operation by current user.
- `clear:mine` — Clear only current user’s strokes.
- `cursor:move` — Update remote cursor position for this user.
- `room:join` — Join a specific room.

### 7.2 Example Events (Server → Client)

- `op:apply` — Apply a new operation to all clients.
- `state:full` — Send full operation history for initial sync or resync.
- `cursor:update` — Broadcast remote cursor positions.
- `users:update` — Update list or count of active users.
- `room:joined` — Confirmation that the client has joined a room.

Payloads are typically small JSON objects containing user IDs, operation IDs, timestamps, and operation metadata.

---

## 8. State Management Strategy

- **Source of truth:** The backend `drawing-state` module is the single source of truth for each room’s drawing history.
- **Client cache:** Each client maintains a local cache of operations to render the canvas without requesting the server on every change.
- **Idempotency:** Operations are identified by unique IDs, making replays safe if needed.
- **Recovery:** On reconnect, the client can request a full state sync (`state:full`) to rebuild the canvas.

---

## 9. Scalability Considerations

Although the current implementation uses an in-memory store, the architecture is designed to support scaling:

- **Horizontal scaling:**
  - Use a shared pub/sub layer (e.g., Redis) for Socket.IO so that multiple Node.js instances can broadcast operations.
  - Move `drawing-state` persistence to an external store (Redis, PostgreSQL, etc.).

- **Persistence:**
  - Store operations in a database to provide persistent rooms and history.
  - Enable loading historical drawings when users rejoin.

- **Optimization:**
  - Compress long strokes (point reduction algorithms).
  - Batch operations when broadcasting under heavy load.

---

## 10. Future Improvements

- Add authentication and named user profiles.
- Support saving and loading canvases as documents.
- Implement role-based permissions for moderators or room owners.
- Add tests for drawing-state logic and WebSocket flows.
- Introduce metrics and logging for monitoring (e.g., active users, ops/sec).

---

This architecture is intentionally simple to keep the codebase approachable while still demonstrating real-time collaboration, per-user history management, and room-based multi-tenancy.
