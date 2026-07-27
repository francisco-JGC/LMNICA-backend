import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class SetAssignedPartnersHttpDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  partnerIds!: string[];
}
