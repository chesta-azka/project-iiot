import {
      Injectable,
      UnauthorizedException,
      Logger,
      OnApplicationBootstrap
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, UserRole } from '../database/entities/user/user.entity'; // Pastikan path ini sesuai
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService implements OnApplicationBootstrap {
      private readonly logger = new Logger(AuthService.name);
      private readonly SALT_ROUNDS = 10;

      constructor(
            @InjectRepository(UserEntity)
            private readonly userRepository: Repository<UserEntity>,
            private readonly jwtService: JwtService,
      ) { }

      /**
       * Menggunakan pendekatan Atomic: Validasi & Return dalam satu langkah
       */
      async login(username: string, pass: string) {
            const user = await this.userRepository.findOne({
                  where: { username },
                  select: ['id', 'username', 'password', 'role'], // Wajib select password untuk bcrypt
            });

            // Gunakan generic error message untuk keamanan (security best practice)
            if (!user || !(await bcrypt.compare(pass, user.password))) {
                  throw new UnauthorizedException('Kredensial yang Anda masukkan salah');
            }

            return this.generateToken(user);
      }

      /**
       * Helper Private untuk menjaga kode tetap DRY (Don't Repeat Yourself)
       */
      private generateToken(user: UserEntity) {
            const payload = { sub: user.id, username: user.username, role: user.role };
            return {
                  access_token: this.jwtService.sign(payload),
                  user: {
                        username: user.username,
                        role: user.role,
                  },
            };
      }

      /**
       * Fungsi ini otomatis jalan pas NestJS start
       */
      async onApplicationBootstrap() {
            await this.seedUsers();
      }

      /**
       * Fungsi untuk membuat user default (Admin, Engineer, Operator)
       */
      async seedUsers() {
            // Asumsi UserRole adalah tipe Enum/String di Entity lu.
            const defaultUsers = [
                  { username: 'manager', role: UserRole.MANAGER },
                  { username: 'supervisor', role: UserRole.SUPERVISOR },
                  { username: 'operator', role: UserRole.OPERATOR },
            ];

            for (const u of defaultUsers) {
                  const userExist = await this.userRepository.findOne({ where: { username: u.username } });

                  if (!userExist) {
                        const hashedPassword = await bcrypt.hash('AQUA123', this.SALT_ROUNDS);
                        const newUser = this.userRepository.create({
                              username: u.username,
                              password: hashedPassword,
                              role: u.role,
                        });

                        await this.userRepository.save(newUser);
                        this.logger.log(`✅ Seeded default user: ${u.username} (Role: ${u.role})`);
                  }
            }
      }
}