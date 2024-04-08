import { Socket } from 'socket.io';

export type CallbackWithErr = (arg0?: { err: string }) => void;

export type WorkerInfo = {
  id: string,
  machineArch: string,
  cpus: {
    model: string,
    speed: number, // MHz
  }[],
  ram: number,
}

export type Identity = {
  id: string,
  isWorker: boolean,
  jobFromID?: string,
  jobToID?: string,
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

export type WorkerList = WorkerInfo[];

export type JoinAckArg = WorkerInfo;