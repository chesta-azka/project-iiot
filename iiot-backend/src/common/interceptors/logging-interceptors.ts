import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class LoggingInterceptors implements NestInterceptor {
      private readonly logger = new Logger('HTTP_TRAFFIC');

      intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
            const req = context.switchToHttp().getRequest(); 
            const method = req.method;
            const url = req.url;
            const now = Date.now();

            return next
                  .handle()
                  .pipe(
                        tap(() => this.logger.log(`[${method}] ${url} - Berhasil diproses dalam ${Date.now() - now}ms`)),
                  );
            

      }
      
}