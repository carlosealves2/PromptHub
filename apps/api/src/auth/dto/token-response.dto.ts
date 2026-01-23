export class TokenResponseDto {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserInfoDto;
}

export class UserInfoDto {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  roles: string[];
}
