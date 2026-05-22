import express from "express";
import http from "http";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import connectToSocket from "./src/controllers/socketManager.js";
import userRoutes from "./src/routes/userRoutes.js";
dotenv.config(); // Load .env variables

const app = express();
const server = createServer(app);

// ---------- Initialize Socket.IO ----------
connectToSocket(server);

/* ---------- Socket.IO ---------- */
//  const io = connectToSocket(server, {
//    cors: {
//      origin: "http://localhost:5173/",
//      methods: ["GET", "POST"],
//      Credentials: true,
//    },
//  });

// io.on('connection', (socket) => {
//   console.log('a user connected');
//   console.log(socket.id);
//   socket.emit('welcome', "this is socket intro " + socket.id);

//    socket.on('receive-message', (msg) => {
//     console.log('message: ' + msg);
//   });

// io.on("connection", (socket) => {
//   socket.emit("welcome", "Welcome to chat 🚀");

//   socket.on("send-message", (data) => {
//     io.emit("receive-message", data);
//   });
// });

//  socket.on('disconnect', () => {
//   console.log('user disconnected referesh to to connect agaiun');
// });
// });

/* ---------- Middlewares ---------- */
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://your-frontend-name.onrender.com",
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

/* ---------- Test Route ---------- */
app.get("/home", (req, res) => {
  return res.send("🚀 Server is running");
});

/* ---------- PORT ---------- */
const PORT = process.env.PORT || 5000;

/* ---------- MongoDB Connection ---------- */
const MONGO_URI = process.env.MONGO_URI;

/* ---------- API Routes ---------- */

app.use("/api/v1/users", userRoutes);

/* ---------- Start Server ---------- */
const start = async () => {
  try {
    const connectionDb = await mongoose.connect(MONGO_URI);
    console.log(`✅ MongoDB connected: ${connectionDb.connection.host}`);

    // server.listen(PORT,"0.0.0.0",{
    //   console.log(`✅ Server running on port ${PORT}`);
    // });
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

start();
