import express from 'express';
import { networkInterfaces } from 'os';

const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello from Igloo Express server!');
});

export const startServer = () => {
  return new Promise<string>((resolve) => {
    const server = app.listen(port, () => {
      const address = server.address();
      if (typeof address === 'string') {
        resolve(`${address}:${port}`);
      } else if (address) {
        const ip = getLocalIpAddress();
        resolve(`${ip}:${address.port}`);
      }
    });
  });
};

function getLocalIpAddress(): string {
  const interfaces = networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    if (iface) {
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          return alias.address;
        }
      }
    }
  }
  return 'localhost';
}
