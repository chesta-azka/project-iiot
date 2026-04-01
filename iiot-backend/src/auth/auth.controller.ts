import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Authentication') // Mengelompokkan di Swagger
@Controller('auth')
export class AuthController {
      constructor(private readonly authService: AuthService) { }

      @Post('login')
      @HttpCode(HttpStatus.OK) // Expert: Menggunakan Enum daripada angka manual 200
      @ApiOperation({ summary: 'Masuk ke sistem dan dapatkan Token JWT' })
      @ApiResponse({ status: 200, description: 'Login Berhasil' })
      @ApiResponse({ status: 401, description: 'Unauthorized' })
      async login(@Body() loginDto: LoginDto) {
            return this.authService.login(loginDto.username, loginDto.password);
      }

      @Post('register-initial')
      @ApiOperation({ summary: 'Membuat akun pengguna baru' })
      async register(@Body() registerDto: RegisterDto) {
            return this.authService.register(
                  registerDto.username,
                  registerDto.password,
                  registerDto.role,
            );
      }
}