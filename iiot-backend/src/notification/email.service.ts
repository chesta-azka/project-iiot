import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendAlertEmail(
    to: string,
    machineId: string,
    machineName: string,
    message: string,
    alarmCode: number | string,
  ): Promise<void> {
    try {
      this.logger.log(
        `Sending alert email to ${to} for machine ${machineName} (${machineId})...`,
      );

      await this.mailerService.sendMail({
        to: to,
        subject: `🚨 [ALERT] Critical Issue - ${machineName} (${machineId})`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ccc; border-radius: 5px;">
            <h2 style="color: #d9534f;">⚙️ Peringatan Mesin: ${machineName}</h2>
            <p><strong>System ID:</strong> ${machineId}</p>
            <p><strong>Status / Alarm Code:</strong> <span style="background-color: #f2dede; color: #a94442; padding: 5px; border-radius: 3px;">${alarmCode}</span></p>
            <hr />
            <p><strong>Pesan Diagnosa:</strong></p>
            <p style="font-size: 16px;">${message}</p>
            <br/>
            <p style="color: #777; font-size: 12px;">Sistem IIoT Aqua - Mohon segera lakukan penanganan. Pesan ini dikirim secara otomatis.</p>
          </div>
        `,
      });

      this.logger.log(`Email alert sent successfully!`);
    } catch (error) {
      this.logger.error(`Failed to send email alert: ${error.message}`);
    }
  }
}
