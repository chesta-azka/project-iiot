import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { LoggingInterceptors } from './common/interceptors/logging-interceptors';
import { ValidationPipe } from '@nestjs/common';
import { warn } from 'console';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  // Function ini si agar DTO bekerja otomatis
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,  // Ini yang bikin @Type(() => Number) jalan
  }));

  // --- TAMBAHKAN BARIS INI ---
  app.enableCors({
    origin: '*',
    methods: 'GET, HEAD, PUT, PATCH, POST, DELETE',
    credentials: true,
  });
  app.useGlobalInterceptors(new LoggingInterceptors());
  app.setGlobalPrefix('api');
  // ---------------------------

  // ---- KONFIGURASI SWAGGER ----
  const config = new DocumentBuilder()
    .setTitle('Chesta IIOT Backend API Cuyy..')
    .setDescription('Dokumentasi API untuk sistem pemantauan mesin secara real-time')
    .setVersion('1.0')
    .addBearerAuth() // Agar kita bisa input token JWT di swagger
    .build()
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document); // Akses di https://localhost:3000/docs
  // ------------------------------

  
  // Start Application
  const port = 3006;
  await app.listen(port);

  console.log(`🚀 Backend IIOT AQUA is running on: http://localhost:${port}/api`);
  console.log(`📑 Documentation available at: http://localhost:${port}/docs`);
}
bootstrap();
