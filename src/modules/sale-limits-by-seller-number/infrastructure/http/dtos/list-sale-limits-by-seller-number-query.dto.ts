import { IsUUID } from 'class-validator';

export class ListSaleLimitsBySellerNumberQueryDto {
  @IsUUID()
  salePointId!: string;
}
