import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreatePdtDto } from './create-pdt.dto';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdatePdtDto extends PartialType(CreatePdtDto) {
  @ApiProperty({ example: 'AQUA123', description: 'Password akun Anda untuk verifikasi edit list yang terkunci' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
