import { IsBoolean } from 'class-validator';

export class SetFeatureFlagHttpDto {
  @IsBoolean()
  enabled!: boolean;
}
