import { IsDateString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class BranchFlowQueryDto {
  @IsNotEmpty()
  @IsUUID()
  salePointId!: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  gameId?: string;

  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @IsOptional()
  @IsDateString()
  drawAt?: string;
}
