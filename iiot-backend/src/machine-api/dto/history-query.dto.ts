import { IsOptional, IsInt, Min, Max, IsString } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class HistoryQueryDto {
   @ApiPropertyOptional({ description: 'Jumlah data per halaman', default: 10 })
   @IsOptional()
   @Type(() => Number) // Konversi string dari URL ke Number
   @IsInt()
   @Min(1)
   @Max(100) // Batasi maksimal 100 agar si server nya kaga beratt...
   limit: number = 10;

   @ApiPropertyOptional({ description: 'Halaman ke berapa', default: 1 })
   @IsOptional()
   @Type(() => Number)
   @IsInt()
   @Min(1)
   page: number = 1;

   @ApiPropertyOptional({ description: 'Filter spesifik ID mesin (misal: LABELLER-01)', example: 'LABELLER-01' })
   @IsOptional()
   @IsString()
   machineId?: string; 
}