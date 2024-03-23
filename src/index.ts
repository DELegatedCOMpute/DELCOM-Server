import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import net from 'node:net';

const SOCKET_TIMEOUT_SECONDS = 60;

dotenv.config();

const server = express();
const hostname = '0.0.0.0';

const port = parseInt(process.env.PORT || '300');

server.use(cors());

server.use(express.json());

const users: {[key: string]: {sysInfo: object}} = {};

server.get('/ping', async (req, res) => {
  res.send('pong');
});

server.post('/postTest', (req, res) => {
  const body = req.body;
  // console.log(req);
  console.log(body);
  res.send('post pong');
});

server.post('/join', (req, res) => {
  const ip: string | undefined = req.body.ip;
  const sysInfo: object | undefined = req.body.sysInfo;
  if (!ip || !net.isIP(ip) || !sysInfo) {
    res.status(400);
    res.send('bad join request');
    return;
  }
  users[ip] = {sysInfo};
  res.send('Joined!');
});

server.listen(port, hostname, () => {
  console.log(`Server running on ${hostname}:${port}`);
});
