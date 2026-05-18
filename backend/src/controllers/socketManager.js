import { Server } from "socket.io";

let connection = {};
let messages = {};
let timeOnline = {};

const connectToSocket = (server) => {

  const io = new Server(server, {
    cors: {
      origin: true,
      methods: ["GET", "POST"],
      allowedHeaders:["*"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("connection established");
    console.log(`User connected: ${socket.id}`);

    /* ---------------- JOIN CALL ---------------- */
socket.on("join-call", (path) => {

  if (!connection[path]) {
    connection[path] = [];
  }

  // ⭐ send existing users ONLY to NEW USER
  io.to(socket.id).emit("existing-users", connection[path]);

  // ⭐ add new user
  connection[path].push(socket.id);
  timeOnline[socket.id] = Date.now();

  // ⭐ notify others about NEW USER
  connection[path].forEach((id) => {
    if (id !== socket.id) {
      io.to(id).emit("user-connected", socket.id);
    }
  });
});

    /* ---------------- WEBRTC SIGNAL ---------------- */
    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    /* ---------------- CHAT MESSAGE ---------------- */
    socket.on("chat-message", (data, sender) => {

      const [matchingRoom, found] = Object.entries(connection).reduce(
        ([room, isFound], [roomKey, roomValue]) => {

          if (!isFound && roomValue.includes(socket.id)) {
            return [roomKey, true];
          }

          return [room, isFound];
        },
        ["", false]
      );

      if (found === true) {

        if (messages[matchingRoom] === undefined) {
          messages[matchingRoom] = [];
        }

        messages[matchingRoom].push({
          sender: sender,
          data: data,
          "socket-id-sender": socket.id,
        });

        console.log("message", matchingRoom, ":", sender, data);

        connection[matchingRoom].forEach((elem) => {
          io.to(elem).emit("chat-message", data, sender, socket.id);
        });
      }
    });

    /* ---------------- DISCONNECT ---------------- */
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);

      // remove user from all rooms they were part of and notify others
      Object.entries(connection).forEach(([path, clients]) => {
        const index = clients.indexOf(socket.id);
        if (index !== -1) {
          clients.splice(index, 1);
          // notify remaining participants that someone left
          clients.forEach((clientId) => {
            io.to(clientId).emit("user-left", socket.id);
          });
          // if room becomes empty, we can delete it
          if (clients.length === 0) {
            delete connection[path];
            delete messages[path];
          }
        }
      });

      delete timeOnline[socket.id];
    });
  });

  return io;
};

export default connectToSocket;
