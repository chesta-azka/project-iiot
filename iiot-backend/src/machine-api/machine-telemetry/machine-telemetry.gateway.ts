import { Logger, UseGuards, Inject, forwardRef } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RealTimeEngineService } from 'src/core-engine/engine/engine.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { InfluxService } from 'src/database/influx/influx.service';
import { client } from 'jsmodbus';

@WebSocketGateway({
  cors: {
    origin: '*', // DI produksi, ganti dengan domain frontend
  },
  transports: ['websocket', 'polling'],
})
export class MachineTelemetryGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MachineTelemetryGateway.name);

  constructor(
    @Inject(forwardRef(() => RealTimeEngineService))
    private readonly realTimeEngine: RealTimeEngineService,
    private readonly influxService: InfluxService,
  ) {}

  afterInit(server: Server) {
    console.log('Websocket Gateway Initialized');
  }

  handleConnection(client: any, ...args: any[]) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: any) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(JwtAuthGuard)
  @SubscribeMessage('send_telemetry')
  async handleIncomingData(
    @ConnectedSocket() client: any,
    @MessageBody() payload: any,
  ) {
    // Ambil nama operator dari JWT yg udah divalidasi Guard
    const operatorName = client.user?.username || 'System';

    // Operator ke Engine buat dihitung PR dan DownTime-nya
    const result = await this.realTimeEngine.processNewData(
      payload.machineId,
      payload.machineName,
      payload.rawData,
      operatorName,
    );

    await this.influxService.writePoint(
      payload.machineId,
      payload.rawData.IS_RUNNING ? 1 : 0, // status
      payload.rawData.BOTTLE_COUNTER || 0, // counter
      payload.rawData.ALARM_CODE || 0, // alarm
      'Shift 1', // Ini nanti bisa lu ambil dinamis dari service shift
    );

    this.logger.verbose(`Telemetry saved to Influx for ${payload.machineId}`);
  }

  // FUngsi ini akan di panggil oleh Core Engine untuk bradcast data
  sendToFrontend(data: any) {
    this.server.emit('machineDataUpdate', data);
  }
}
