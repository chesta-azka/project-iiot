import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserEntity } from 'src/database/entities/user/user.entity';
import { JwtStartegy } from './jwt.strategy';
import { PassportModule } from '@nestjs/passport';

@Module({
      imports: [
            PassportModule.register({ defaultStrategy: 'jwt' }),
            JwtModule.register({
                  secret: 'RAHASIA_KITA_BERSAMA', // Ganti pake string random lah nanti
                  signOptions: { expiresIn: '1d' }, // Token hangus dalam 1 hari
            }),
      ],
      providers: [AuthService, JwtStartegy],
      controllers: [AuthController],
      exports: [AuthService, JwtStartegy, PassportModule]
})
export class AuthModule {}
