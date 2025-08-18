import { WebSocket, WebSocketServer } from "ws";

export class WebSocketService {
  private static wss: WebSocketServer;

  static initialize(server: any) {
    this.wss = new WebSocketServer({ server });
    this.wss.on("connection", (ws: WebSocket) => {
      ws.on("message", (message: string) => {
        const data = JSON.parse(message);
        if (data.type === "subscribe") {
          ws.send(JSON.stringify({ message: `Subscribed to ${data.avitag}` }));
        }
      });
    });
  }

  static sendNotification(avitag: string, notification: any) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ avitag, notification }));
      }
    });
  }
}
