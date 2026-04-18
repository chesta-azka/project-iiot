import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from 'src/database/entities/user/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable() // Diperbaiki dari @Injecttable
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Ambil metadata roles yang dipasang di decorator @Roles()
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 2. Jika tidak ada decorator @Roles, berarti endpoint bersifat publik/bebas role
    if (!requiredRoles) {
      return true;
    }

    // 3. Ambil object user dari request (pastikan JwtAuthGuard sudah dijalankan sebelum ini)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 4. Validasi apakah user ada (mencegah error jika lupa login)
    if (!user) {
      throw new UnauthorizedException('User session not found');
    }

    // 5. Cek apakah role user termasuk dalam role yang diizinkan
    const hasRole = requiredRoles.some((role) => user.role?.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `Akses ditolak: Role ${user.role} tidak memiliki izin untuk akses ini`,
      );
    }

    return true;
  }
}
