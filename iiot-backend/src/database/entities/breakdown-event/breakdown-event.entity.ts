import { ErrorMessages } from "jsmodbus/dist/codes";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity('breakdown_events')
export class BreakdownEventEntity {
      @PrimaryGeneratedColumn()
      id: number;

      @Column()
      machineId: string; // Contoh: 'LABELLER-01', 'FILLER-02'

      @Column({ name: 'machineName', default: 'Unknown Machine' })
      machineName: string; // Contoh: 'Mesin Labeller', 'Mesin Filler'

      @Column({ name: 'ErrorMessages', default: 'No error message provided '})
      errorMessage: string; // Contoh: 'Suhu lem turun', 'Botol jatuh'

      @Column({ type: 'int' })
      duration: number; // Dalam menit

      // Catatan kapan data ini masuk ke database secara sistem
      @CreateDateColumn()
      createdAt: Date;
}