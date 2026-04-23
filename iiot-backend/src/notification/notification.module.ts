import { Global, Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        transport: {
          host: config.get('SMTP_HOST', 'smtp.gmail.com'),
          port: config.get<number>('SMTP_PORT', 587),
          secure: false, // false for TLS (587); true for SSL (465)
          auth: {
            user: config.get('SMTP_USER', 'aqua.iiot.dummy@gmail.com'),
            pass: config.get('SMTP_PASSWORD', 'dummy_password'),
          },
        },
        defaults: {
          from: `"Aqua IIoT Alert System" <${config.get('SMTP_USER', 'noreply@aqua.com')}>`,
        },
      }),
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class NotificationModule { }
