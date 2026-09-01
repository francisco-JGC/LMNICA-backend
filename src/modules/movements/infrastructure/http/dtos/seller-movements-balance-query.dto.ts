import { IsDateString, IsOptional, IsString } from 'class-validator';

export class SellerMovementsBalanceQueryDto {
  /** CSV of salePointIds to restrict the query to specific sucursales. */
  @IsOptional()
  @IsString()
  salePointIds?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  get parsedSalePointIds(): string[] | undefined {
    return this.salePointIds
      ? this.salePointIds.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
  }
}
