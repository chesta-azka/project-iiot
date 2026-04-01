import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { InfluxService } from 'src/database/influx/influx.service';

@WebSocketGateway(3005, {
  cors: {
    origin: '*', // DI produksi, ganti dengan domain frontend
  },
  transports: ['websocket', 'polling']
})
export class MachineTelemetryGateway implements OnGatewayConnection, OnGatewayDisconnect {

  @WebSocketServer()
  server: Server;

  constructor(private readonly influxService: InfluxService) { }
  
  afterInit(server: Server) {
    console.log('Websocket Gateway Initialized');
  }

  handleConnection(client: any, ...args: any[]) {
    console.log(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: any) {
    console.log(`Client disconnected: ${client.id}`)
  }
  
  // FUngsi ini akan di panggil oleh Core Engine untuk bradcast data
  sendToFrontend(data: any) {
    this.server.emit('machineDataUpdate', data);
  }
}
