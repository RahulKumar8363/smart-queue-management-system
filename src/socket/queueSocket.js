let io = null;

function initSocket(socketIoInstance) {
  io = socketIoInstance;

  io.on("connection", (socket) => {
    console.log("🔌 Connected:", socket.id);

    socket.on("join:department", (departmentId) => {
      socket.join(`dept-${departmentId}`);
      console.log(`joined dept-${departmentId}`);
    });

    socket.on("disconnect", () => {
      console.log("❌ disconnected:", socket.id);
    });
  });
}

function getIo() {
  return io;
}

module.exports = { initSocket, getIo };