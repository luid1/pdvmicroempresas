import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, Min, ValidateNested, ValidateIf } from 'class-validator';
import { TenantAwareDto } from '../../../common/dto/tenant-aware.dto';

const optStr = () => (t: object, k: string) => {
  IsOptional()(t, k);
  ValidateIf((_, v) => v !== null)(t, k);
  IsString()(t, k);
};

export class ItemCotacaoDto {
  @ApiPropertyOptional({ nullable: true }) @optStr() produtoId?: string | null;
  @ApiPropertyOptional({ nullable: true }) @optStr() codigo?: string | null;
  @ApiPropertyOptional({ nullable: true }) @optStr() descricao?: string | null;
  @ApiPropertyOptional({ nullable: true }) @optStr() unidade?: string | null;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'precoVenda deve ser numérico.' })
  @Min(0, { message: 'precoVenda não pode ser negativo.' })
  precoVenda: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'custoComposto deve ser numérico.' })
  @Min(0, { message: 'custoComposto não pode ser negativo.' })
  custoComposto?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  cobrir?: boolean;

  @ApiPropertyOptional({ nullable: true }) @optStr() motivo?: string | null;
}

export class SalvarCotacaoDto extends TenantAwareDto {
  @ApiProperty({ type: [ItemCotacaoDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => ItemCotacaoDto)
  itens: ItemCotacaoDto[];
}
