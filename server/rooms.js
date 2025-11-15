// minimal rooms management
const rooms = {};
module.exports = {
  addClient(room, client){
    rooms[room] = rooms[room] || { clients: [] };
    rooms[room].clients.push(client);
  },
  removeClient(room, id){
    if (!rooms[room]) return;
    rooms[room].clients = rooms[room].clients.filter(c=>c.id!==id);
  },
  listClients(room){
    return rooms[room] ? rooms[room].clients : [];
  }
};
