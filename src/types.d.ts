import { Socket } from 'socket.io';

export type CallbackWithErr = (arg0?: { err: string }) => void;

export type WorkerInfo = {
  machineArch: string,
  cpus: {
    model: string,
    speed: number, // MHz
  }[],
  ram: number,
}

export type Workers = {
  key: string,
  workerInfo: WorkerInfo,
}[];

export type Identity = {
  id: string,
  workerInfo?: WorkerInfo,
}

export type Client = {
  id: string,
  socket: Socket,
  isWorker: boolean, // whether the client is willing to work
  jobFromID: string | undefined, // id of the job requester
  jobToID: string | undefined, // id of the worker assigned for the job
  workerInfo?: WorkerInfo,
}

export type JoinAckArg = WorkerInfo;