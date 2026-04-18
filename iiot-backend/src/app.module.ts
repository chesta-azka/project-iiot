import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { SimulatorModule } from './simulator/simulator.module';
import { CoreEngineModule } from './core-engine/core-engine.module';
import { MachineApiModule } from './machine-api/machine-api.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import {
  Module,
  NestModule,
  MiddlewareConsumer,
  Logger,
  RequestMethod,
} from '@nestjs/common';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

@Module({
  imports: [
    // Ini di tambahkan agar si variable .env tersedia secara global
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    DatabaseModule,
    MachineApiModule,
    CoreEngineModule,
    SimulatorModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '(.*)', method: RequestMethod.ALL }); // Terapkan ke semua endpoint
  }
}
