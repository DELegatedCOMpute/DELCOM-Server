import dotenv from 'dotenv';
import { publicIpv4 } from 'public-ip';
import { Server, Socket, DisconnectReason } from 'socket.io';

type clientType = {
    socket: Socket,
    isWorker: boolean, // whether the client is willing to work
    jobFromID: string | undefined, // socket.id of the job requester
    jobToID: string | undefined, // socket.id of the worker assigned for the job
};

const RETRY_CNT = 3; // retries before failure

dotenv.config();

const port = parseInt(process.env.PORT || '3000');
console.log(`Starting server at ${await publicIpv4()}:${port}`);
const server = new Server(port);

const clients: {[key: string]: clientType} = {};

server.on('connection', async (socket) => {
  console.log(`Connection from ${socket.id}`);
  // console.log({socket});
  // const {isWorker, isWorking} = await socket.emitWithAck('status_check'); // TODO mirror state in client to get data to resume function
  clients[socket.id] = { // TODO socket.id is a bad way to do this, make custom
    socket,
    isWorker: false,
    jobFromID: undefined,
    jobToID: undefined,
  };

  socket.on('join', () => {
    clients[socket.id].isWorker = true;
  });

  socket.on('leave', () => {
    clients[socket.id].isWorker = false;
  });

  socket.on('done', () => {
    clients[socket.id].jobFromID = undefined;
    const from = clients[socket.id].jobFromID;
    if (from) {
      clients[from].jobToID = undefined;
      clients[from].socket.emit('finished');
    }
  });

  const outputNames = [
    'build_std_out', 
    'build_std_err', 
    'run_std_out', 
    'run_std_err'
  ];

  for (const outputEvent of outputNames) {
    socket.on(outputEvent, (chunk) => {
      const sendToID = clients[socket.id].jobFromID;
      if (!sendToID) {
        console.error(`No jobFromID on ${outputEvent}`);
        return;
      }
      clients[sendToID].socket.emit(outputEvent, chunk);
    });
  }

  socket.on('send_file_data', (fileData: unknown, callback: (obj: {err: string | undefined}) => void) => {
    const sendToID = clients[socket.id].jobToID;
    if (!sendToID) {
      console.error('No jobToID on send_file_data');
      callback({err: 'No jobToID on send_file_data'});
      return;
    }
    clients[sendToID].socket.emit('receive_file_data', fileData);
  });

  socket.on('files_done_sending', () => {
    const sendToID = clients[socket.id].jobToID;
    if (!sendToID) {
      console.error('No jobToID on files_done_sending');
      return;
    }
    clients[sendToID].socket.emit('start');
  });

  socket.on('get_workers', (callback: (clients: {[key: string]: unknown}[]) => void) => {
    const filteredWorkers = Object.values(clients).filter((client) => {
      return client.isWorker && !client.jobFromID;
    });
    const mappedWorkers = filteredWorkers.map((client) => {
      return {
        id: client.socket.id,
      };
    });
    callback(mappedWorkers);
  });

  socket.on('request_worker', async (workerID: string, callback: (obj?: {err: string}) => void) => {
    if (!workerID) {
      callback({err: 'No worker provided'});
      return;
    }
    if (!clients[workerID]) {
      callback({err: 'Worker not found'});
      return;
    }
    if (clients[workerID].jobFromID) {
      callback({err: 'Worker already working'});
      return;
    }
    clients[workerID].jobFromID = socket.id;
    clients[socket.id].jobToID = workerID;
    const {err} = await clients[workerID].socket.emitWithAck('new_job');
    if (err) {
      console.warn(`Client ${workerID} failed to set up new job. Client error:`);
      console.warn(err);
      clients[workerID].jobFromID = undefined;
      clients[socket.id].jobToID = undefined;
      callback({err: `Client ${workerID} failed to set up new job.`});
      return;
    }
    callback();
  });

  socket.on('disconnect', (reason: DisconnectReason) => {
    // TODO cleanup
    console.log(`Closed ${socket.id}: ${reason}`);
    delete clients[socket.id];
  });
});

setInterval(() => {
  console.log('\nACTIVE CLIENTS:');
  const filteredClients = Object.entries(clients).map((client) => {
    return {
      id: client[0],
      isWorker: client[1].isWorker,
      jobFromID: client[1].jobFromID,
      jobToID: client[1].jobToID,
    };
  });
  console.log(filteredClients);
  console.log('\n');
}, 5000);
