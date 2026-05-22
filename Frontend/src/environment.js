const server =
  import.meta.env.MODE === "development"
    ? "http://localhost:5000"
    : "https://your-backend-name.onrender.com";

export default server;