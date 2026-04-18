import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStartegy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'RAHASIA_KITA_BERSAMA',
      ),
    });
  }

  async validate(payload: any) {
    console.log('PAYLOAD JWT TERDETEKSI:', payload);
    // Data ini akan masuk ke request (req.user)
    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
    };
  }
}
