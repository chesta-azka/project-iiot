import {
      WebSocketGateway,
      WebSocketServer
} from '@nestjs/websockets';

import {
      OnModuleInit,
      OnModuleDestroy,
      Logger
} from '@nestjs/common'; // Pindahkan ke sini
import { Server } from 'socket.io';
import { ModbusClientService } from './modbus-client.service';
import { Subscription } from 'rxjs';

// Decorator ini buat ngebuka pintu WebSocket
// CORS origin * biar si FE gak kena blokir pas nembak dari browser
@WebSocketGateway({
      cors: {
            origin: '*',
      },
})
export class MachineGateway implements OnModuleInit, OnModuleDestroy {
      @WebSocketServer()
      server: Server;

      private readonly logger = new Logger(MachineGateway.name);
      private dataSubscription: Subscription;

      constructor(private readonly modbusService: ModbusClientService) { }

      onModuleInit() {
            this.logger.log('🌐 Machine WebSocket Gateway Initialized');

            // Lu dengerin "keran" data dari Modbus service yang udah lu buat
            this.dataSubscription = this.modbusService.machineData$.subscribe({
                  next: (data) => {
                        // SETIAP ADA DATA BARU (tiap 2 detik), LANGSUNG TERIAK KE FE
                        // Nama event-nya: 'machineUpdates'
                        this.server.emit('machineUpdates', data);

                        // Buat debug doang, hapus kalau udah rame log-nya
                        // this.logger.debug('Data emitted to WebSocket clients');
                  },
                  error: (err) => {
                        this.logger.error(`❌ WebSocket Subscription Error: ${err.message}`);
                  },
            });
      }

      onModuleDestroy() {
            // Matiin subscription biar gak memory leak pas server restart
            if (this.dataSubscription) {
                  this.dataSubscription.unsubscribe();
            }
      }
}