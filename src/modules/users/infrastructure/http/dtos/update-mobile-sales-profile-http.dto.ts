import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class UpdateMobileSalesProfileHttpDto {
  @IsBoolean()
  mobileSalesEnabled!: boolean;

  @IsOptional()
  @IsUUID()
  defaultSalePointId?: string | null;
}
