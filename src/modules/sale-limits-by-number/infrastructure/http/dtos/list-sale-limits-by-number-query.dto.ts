import { IsUUID } from 'class-validator';

export class ListSaleLimitsByNumberQueryDto {
  @IsUUID()
  salePointId!: string;
}
