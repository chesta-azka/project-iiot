import { from } from 'rxjs';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum UserRole {
<<<<<<< HEAD
  OPERATOR = 'OPERATOR',
  SUPERVISOR = 'SUPERVISOR',
  MANAGER = 'MANAGER',
=======
      OPERATOR = 'OPERATOR',
      SUPERVISOR = 'SUPERVISOR',
      MANAGER = 'MANAGER',
      PPIC = 'PPIC'
>>>>>>> afgan
}

@Entity('USERS')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column({ select: false }) // Password tidak akan ikut saat kita cari user
  password: string; // Nanti di simpan nya versi ter-enkripsi

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.OPERATOR,
  })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;
}
