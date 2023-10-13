const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
const { Server } = require('socket.io');
const ACTIONS = require('./actions');
const compiler = require('compilex');
const options = { stats: true };
compiler.init(options);

const server = require('http').createServer(app);
const io = new Server(server);

const userSocketMap = {};

function getAllConnectedClients(roomId) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: userSocketMap[socketId],
      };
    }
  );
}

io.on('connection', (socket) => {
  socket.on(ACTIONS.JOIN, ({ username, roomId }) => {
    userSocketMap[socket.id] = username;

    socket.join(roomId);
    const clients = getAllConnectedClients(roomId);

    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });
    });
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on('disconnecting', () => {
    const rooms = Array.from(socket.rooms); //get all rooms where this socketId is present
    console.log(socket.rooms);
    console.log(typeof socket.rooms);
    rooms.forEach((roomId) => {
      console.log(roomId);
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });

    delete userSocketMap[socket.id];
    socket.leave(); //leaving the room
  });
});

app.post('/compile', function (req, res) {
  console.log(req.body);
  var code = req.body.code;
  var input = req.body.input;
  console.log(code);
  console.log(input);
  if (code) {
    var envData = { OS: 'windows' };
    compiler.compilePythonWithInput(envData, code, input, function (data) {
      if (data.output) {
        res.json(data);
      } else {
        res.json({ output: 'error' });
      }
    });
  } else {
    res.json({ output: 'error' });
  }
});

const PORT = process.env.PORT || 5002;
server.listen(PORT, () => console.log('listening on port ' + PORT));
