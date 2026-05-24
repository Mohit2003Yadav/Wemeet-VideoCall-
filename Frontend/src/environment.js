const server =
  import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : "https://wemeet-videocall-backend.onrender.com";

export default server;