import { ApiProperty } from "@nestjs/swagger";
import { UserRole } from "src/database/entities/user/user.entity";
import { IsEnum, IsNotEmpty, IsString, MinLength } from "class-validator";


export class RegisterDto {
      @ApiProperty({
            example: 'chesta',
            description: 'Username baru'
      })
      @IsString()
      @IsNotEmpty()
      username: string;

      @ApiProperty({
            example: 'password123',
            description: ' Password minimal 6 karakter'
      })
      @IsString()
      @MinLength(6)
      password: string;

      @ApiProperty({
            example: 'ADMIN',
            enum: UserRole,
            description: 'Role user (ADMIN/USER)'
      })
      @IsEnum(UserRole, {
            message: 'Role harus berupa OPERATOR, SUPERVISOR, atau ADMIN'
      })
      @IsNotEmpty()
      role: UserRole;
}