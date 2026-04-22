import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, IsDateString } from 'class-validator';

export class CreatePdtDto {
  @ApiProperty({ example: 1, description: 'ID Mesin (Tabel Machine Postgres)' })
  @IsInt()
  @IsNotEmpty()
  machineId: number;

  @ApiProperty({ example: '2026-04-20T10:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  planDate: string;

  @ApiProperty({ example: 120, description: 'Durasi dalam menit' })
  @IsInt()
  @IsNotEmpty()
  duration: number;

  @ApiProperty({ example: 'Preventive Maintenance Bulanan' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
