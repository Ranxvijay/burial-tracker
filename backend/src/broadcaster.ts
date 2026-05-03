import { Response } from 'express';

const clients = new Set<Response>();

export function addClient(res: Response): void {
  clients.add(res);
}

export function removeClient(res: Response): void {
  clients.delete(res);
}

export function broadcast(data: object): void {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    try {
      client.write(msg);
    } catch {
      clients.delete(client);
    }
  });
}

export function clientCount(): number {
  return clients.size;
}
