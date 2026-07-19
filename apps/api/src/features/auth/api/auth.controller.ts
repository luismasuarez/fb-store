import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Req,
} from "@nestjs/common";
import { ZodSchemaPipe } from "../../../core/pipes/zod-schema.pipe";
import { SkipAuth } from "../../../core/guards/api-key.guard";
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
  async login(@Body(ZodSchemaPipe(LoginDto)) dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("refresh")
  @SkipAuth()
  @HttpCode(HttpStatus.OK)
  async refresh(@Body(ZodSchemaPipe(RefreshDto)) dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: FastifyRequest) {
    const user = req.user as { sub: string };
    await this.authService.logout(user.sub);
    return { message: "Session revoked" };
  }

  @Get("me")
  @HttpCode(HttpStatus.OK)
  async getMe(@Req() req: FastifyRequest) {
    const user = req.user as { sub: string };
    return { data: await this.authService.getMe(user.sub) };
  }
}
