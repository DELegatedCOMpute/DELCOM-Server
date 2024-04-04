import dotenv from 'dotenv';
import { publicIpv4 } from 'public-ip';
import { Server, Socket, DisconnectReason } from 'socket.io';
import crypto from 'crypto';

const TIMEOUT = 10 * 1000; // socket timeout in MS before error

type clientType = {
    id: string,
    socket: Socket,
    isWorker: boolean, // whether the client is willing to work
    jobFromID: string | undefined, // id of the job requester
    jobToID: string | undefined, // id of the worker assigned for the job
};

type workerListElement = {
  id: string,
}

const outputNames = [
  'build_std_out', 
  'build_std_err', 
  'run_std_out', 
  'run_std_err',
];

dotenv.config();

const port = parseInt(process.env.PORT || '3000');
console.log(`Starting server at ${await publicIpv4()}:${port}`);
const server = new Server(port);

const clients: {[key: string]: clientType} = {};

server.on('connection', async (socket) => {
  console.log(`New connection from socket id ${socket.id}`);

  let id: string;

  socket.on('identify', (
    arg0: {
      id: string | undefined,
      isWorker: boolean,
      jobFromID: string | undefined,
      jobToID: string | undefined,
    },
    callback,
  ) => {
    const {isWorker, jobFromID, jobToID} = arg0;
    if (!arg0.id || !clients[arg0.id]) {
      do {
        id = crypto.randomBytes(2).toString('hex');
      } while (clients[id]);
      console.log(`socket.id ${socket.id} assigned as ${id}`);
    } else {
      // TODO transfer socket data?
      id = arg0.id;
      console.log(`socket.id ${socket.id} identified as ${id}`);
    }
    clients[id] = {
      id,
      socket,
      isWorker,
      jobFromID,
      jobToID,
    };
    callback(id);
  });

  socket.on('join_ack', (callback) => {
    clients[id].isWorker = true;
    callback();
  });

  socket.on('leave_ack', (callback) => {
    clients[id].isWorker = false;
    callback();
  });

  socket.on('done', () => {
    const from = clients[id].jobFromID;
    clients[id].jobFromID = undefined;
    if (from) {
      clients[from].jobToID = undefined;
      clients[from].socket.emitWithAck('finished');
    }
  });

  for (const outputEvent of outputNames) {
    socket.on(outputEvent, (chunk) => {
      const sendToID = clients[id].jobFromID;
      if (!sendToID) {
        console.error(`No jobFromID on ${outputEvent}`);
        return;
      }
      clients[sendToID].socket.emitWithAck(`${outputEvent}`, chunk);
    });
  }

  socket.on('send_file_data_ack', (fileData: unknown, callback: (obj: {err: string | undefined}) => void) => {
    const sendToID = clients[id].jobToID;
    if (!sendToID) {
      console.error('No jobToID on send_file_data');
      callback({err: 'No jobToID on send_file_data'});
      return;
    }
    try {
      clients[sendToID].socket.emitWithAck('receive_file_data_ack', fileData);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('files_done_sending', () => {
    const sendToID = clients[id].jobToID;
    if (!sendToID) {
      console.error('No jobToID on files_done_sending');
      return;
    }
    clients[sendToID].socket.emitWithAck('run_job_ack');
  });

  socket.on('get_workers_ack', (callback: (clients: {[key: string]: unknown}[]) => void) => {
    const filteredWorkers = Object.values(clients).filter((client) => {
      return client.isWorker && !client.jobFromID;
    });
    const mappedWorkers: workerListElement[] = filteredWorkers.map((client) => {
      return {
        id: client.id,
      };
    });
    callback(mappedWorkers);
  });

  socket.on('new_job_ack', async (workerID: string, fileNames: string, callback: (arg0?: {err: string}) => void) => {
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
    clients[workerID].jobFromID = id;
    clients[id].jobToID = workerID;
    const ack : {err: unknown} | undefined = await clients[workerID].socket.emitWithAck('new_job_ack', fileNames);
    if (ack?.err) {
      console.warn(`Client ${workerID} failed to set up new job. Client error:`);
      console.warn(ack.err);
      clients[workerID].jobFromID = undefined;
      clients[id].jobToID = undefined;
      callback({err: `Client ${workerID} failed to set up new job.`});
      return;
    }
    callback();
  });

  socket.on('disconnect', (reason: DisconnectReason) => {
    // TODO cleanup
    console.log(`Closed ${id}: ${reason}`);
    delete clients[id];
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
