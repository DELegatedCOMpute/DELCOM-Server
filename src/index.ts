import dotenv from 'dotenv';
import { publicIpv4 } from 'public-ip';
import { Server, Socket, DisconnectReason } from 'socket.io';

dotenv.config();

console.log(await publicIpv4());

const port = parseInt(process.env.PORT || '3000');

const server = new Server(port);

const clients: {
  [key: string]: {
    socket: Socket,
    ready: boolean,
    working: boolean,
  }} = {};

server.on('connection', (socket) => {
  console.log(`Connection from ${socket.id}`);
  clients[socket.id] = {
    socket,
    ready: false,
    working: false
  };
  const client = clients[socket.id];
  socket.on('join', () => {
    client.ready = true;
  });
  socket.on('leave', () => {
    client.ready = false;
  });
  socket.on('new_job', async (job, callback) => {
    const targetClient = Object.values(clients).find((val) => {
      return val.ready && !val.working;
    });
    if (!targetClient) {
      callback({res: undefined, err: 'No available clients!'});
      return;
    }
    targetClient.working = true;
    const {res, err} = await targetClient.socket.emitWithAck('job', job);
    callback({res, err});
    targetClient.working = false;
  });
  socket.on('disconnect', (reason: DisconnectReason) => {
    console.log(`Closed ${socket.id}: ${reason}`);
    delete clients[socket.id];
  });
});
