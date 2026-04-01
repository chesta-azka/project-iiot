import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable } from "@nestjs/common";

@Injectable()
export class JwtStartegy extends PassportStrategy(Strategy) {
      constructor() {
            super({
                  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
                  ignoreExpiration: false,
                  secretOrKey: 'RAHASIA_KITA_BERSAMA', // Harus sama dengan di AuthModule
            });
      }

      async validate(payload: any) {
            console.log('PAYLOAD JWT TERDETEKSI:', payload);
            // Data ini akan masuk ke request (req.user)
            return { userId: payload.sub, username: payload.username, role: payload.role }; 
            
      }
}