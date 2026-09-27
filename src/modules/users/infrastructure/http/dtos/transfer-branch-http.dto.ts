import { IsUUID } from 'class-validator';

export class TransferBranchHttpDto {
  @IsUUID()
  newSalePointId!: string;
}
