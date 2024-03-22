import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const server = express();
const hostname = '0.0.0.0';

const port = parseInt(process.env.PORT || '300');

server.use(cors());

server.use(express.json());

server.get('/ping', async (req, res) => {
  res.send('pong');
});

server.post('/ping', (req, res) => {
  res.send('post pong');
});

server.listen(port, hostname, () => {
  console.log(`Server running on ${hostname}:${port}`);
});
