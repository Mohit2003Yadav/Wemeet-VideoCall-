import { io } from "socket.io-client";

const socket = io("http://10.136.37.16:5000", {
  transports: ["websocket"], // optional but recommended
});

export default socket;
