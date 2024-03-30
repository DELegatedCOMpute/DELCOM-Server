import dotenv from 'dotenv';
import { publicIpv4 } from 'public-ip';
import { Server, Socket, DisconnectReason } from 'socket.io';

dotenv.config();

const port = parseInt(process.env.PORT || '3000');

console.log(`Starting server at ${await publicIpv4()}:${port}`);

const server = new Server(port);

const clients: {
  [key: string]: {
    socket: Socket,
    isWorker: boolean,
    isWorking: boolean,
  }} = {};

server.on('connection', async (socket) => {
  console.log(`Connection from ${socket.id}`);
  const {isWorker, isWorking} = await socket.emitWithAck('status_check');
  clients[socket.id] = {
    socket,
    isWorker,
    isWorking,
  };
  const client = clients[socket.id];
  socket.on('join', () => {
    client.isWorker = true;
  });
  socket.on('leave', () => {
    client.isWorker = false;
  });
  socket.on('working', () => {
    client.isWorking = true;
  });
  socket.on('done', () => {
    client.isWorking = false;
  });
  socket.on('new_job', async (job, callback) => {
    const targetClient = Object.values(clients).find((val) => {
      return val.isWorker && !val.isWorking;
    });
    if (!targetClient) {
      callback({res: undefined, err: 'No available clients!'});
      return;
    }
    targetClient.isWorking = true;
    const {res, err} = await targetClient.socket.emitWithAck('job', job);
    callback({res, err});
    targetClient.isWorking = false;
  });
  socket.on('disconnect', (reason: DisconnectReason) => {
    console.log(`Closed ${socket.id}: ${reason}`);
    delete clients[socket.id];
  });
});

// setInterval(() => {
//   console.log('\nACTIVE CLIENTS:');
//   Object.entries(clients).forEach((client) => {
//     console.log(`Client ${client[0]}\n\tready: ${client[1].isWorker}\n\tworking: ${client[1].isWorking}`);
//   });
//   console.log('\n');
// }, 5000);
