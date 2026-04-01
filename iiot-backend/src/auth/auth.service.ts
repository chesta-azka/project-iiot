import {
      Injectable,
      UnauthorizedException,
      ConflictException,
      InternalServerErrorException,
      Logger
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, UserRole } from '../database/entities/user/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
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
       * Registrasi dengan Proteksi Duplicate secara Elegan
       */
      async register(username: string, pass: string, role: UserRole) {
            try {
                  const hashedPassword = await bcrypt.hash(pass, this.SALT_ROUNDS);
                  const newUser = this.userRepository.create({
                        username,
                        password: hashedPassword,
                        role,
                  });

                  const { password, ...savedUser } = await this.userRepository.save(newUser);
                  return savedUser;
            } catch (error) {
                  if (error.code === '23505') {
                        throw new ConflictException('Username sudah digunakan');
                  }
                  this.logger.error(`Register Error: ${error.message}`);
                  throw new InternalServerErrorException('Gagal memproses pendaftaran user');
            }
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
    }