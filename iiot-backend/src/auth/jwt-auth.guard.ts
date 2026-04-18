import { Head, Injectable, UseGuards, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
} from '@nestjs/websockets';
import { client } from 'jsmodbus';
import { authorize } from 'passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    // Kalo di HTTP, ambil req biasa
    // Kalo di WebSocket, ambil dari client handshake
    const contextType = context.getType();

    if (contextType === 'ws') {
      const client = context.switchToWs().getClient();
      // Passport butuh object yg punya header 'authorization'
      return {
        headers: {
          authorization: `Bearer ${
            client.handshake.auth?.token ||
            client.handshake.headers?.authorization ||
            ''
          }`,
        },
      };
    }
    return context.switchToHttp().getRequest();
  }
}
