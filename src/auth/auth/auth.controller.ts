import { Controller } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Post, Get, UseGuards, Req } from '@nestjs/common';
import { Body } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('register')
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @Post('login')
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @Post('logout')
    @UseGuards(AuthGuard('jwt'))
    async logout() {
        return this.authService.logout();
    }

    @Post('forgot-password')
    async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
        return this.authService.forgetpassword(forgotPasswordDto);
    }

    @Post('reset-password')
    async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
        return this.authService.resetPassword(resetPasswordDto);
    }

    @Get('profile')
    @UseGuards(AuthGuard('jwt'))
    async getProfile(@Req() req) {
        return this.authService.getProfile(req.user);
    }

    /**
     * GET /api/auth/webhook-token
     * Returns the user's personal SMS webhook token and ready-to-use URL.
     * Requires JWT authentication.
     */
    @Get('webhook-token')
    @UseGuards(AuthGuard('jwt'))
    async getWebhookToken(@Req() req) {
        return this.authService.getWebhookToken(req.user);
    }

    /**
     * POST /api/auth/webhook-token/regenerate
     * Regenerates the user's webhook token (invalidates the old one).
     * Requires JWT authentication.
     */
    @Post('webhook-token/regenerate')
    @UseGuards(AuthGuard('jwt'))
    async regenerateWebhookToken(@Req() req) {
        return this.authService.regenerateWebhookToken(req.user);
    }
}

