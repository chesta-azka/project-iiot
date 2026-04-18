import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Username pengguna',
    example: 'chesta',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'Password pengguna',
    example: 'password123',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
