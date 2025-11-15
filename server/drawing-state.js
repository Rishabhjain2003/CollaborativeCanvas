// Maintain snapshots (dataURLs) for rooms. Simple in-memory storage.
const blankCanvas = (w=1000,h=600)=>{
  // 1x1 transparent PNG data URL as a blank fallback
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQImWNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
};

const store = {};

module.exports = {
  pushSnapshot(room, snapshot){
    store[room] = store[room] || { list: [] };
    store[room].list.push(snapshot);
  },
  getLatest(room){
    if (!store[room] || store[room].list.length===0) return null;
    return store[room].list[store[room].list.length-1];
  },
  getByIndex(room, idx){
    if (!store[room]) return null;
    return store[room].list[idx] || null;
  },
  clear(room){
    store[room] = { list: [] };
  },
  getBlank(){
    return blankCanvas();
  }
};
