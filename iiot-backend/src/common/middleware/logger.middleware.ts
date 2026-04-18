import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { ip, method, originalUrl } = req;
    const userAgent = req.get('user-agent') || '';
    const start = Date.now();

    // Jalankan setelah request selesai diproses
    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - start;

      // Ambil user dari request (jika sudah login lewat JWT)
      const user = (req as any).user ? (req as any).user.username : 'Guest';

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} - ${user} - ${duration}ms - ${ip} ${userAgent}`,
      );
    });

    next();
  }
}
