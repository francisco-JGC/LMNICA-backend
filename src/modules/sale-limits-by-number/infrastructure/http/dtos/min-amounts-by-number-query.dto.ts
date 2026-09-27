import { IsUUID } from 'class-validator';

export class MinAmountsByNumberQueryDto {
  @IsUUID()
  gameId!: string;

  @IsUUID()
  salePointId!: string;
}
