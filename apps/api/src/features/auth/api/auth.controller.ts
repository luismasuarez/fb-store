import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ZodValidationPipe } from "../../../core/pipes/zod-validation.pipe";
import { SkipAuth } from "../../../core/guards/api-key.guard";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { AuthService } from "../application/auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import type { FastifyRequest } from "fastify";

@Controller("api/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @SkipAuth()
  @HttpCode(HttpStatus.OK)
  async login(@Body(new ZodValidationPipe(LoginDto)) dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("refresh")
  @SkipAuth()
  @HttpCode(HttpStatus.OK)
  async refresh(@Body(new ZodValidationPipe(RefreshDto)) dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: FastifyRequest) {
    const user = req.user as { sub: string };
    await this.authService.logout(user.sub);
    return { message: "Session revoked" };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getMe(@Req() req: FastifyRequest) {
    const user = req.user as { sub: string };
    return { data: await this.authService.getMe(user.sub) };
  }
}
