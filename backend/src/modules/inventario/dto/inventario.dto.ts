import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, ValidateIf } from 'class-validator';
import { TenantAwareDto } from '../../../common/dto/tenant-aware.dto';

const optStr = () => (t: object, k: string) => {
  IsOptional()(t, k);
  ValidateIf((_, v) => v !== null)(t, k);
  IsString()(t, k);
};

export class AbrirInventarioDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'filialId é obrigatório.' })
  filialId: string;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  descricao?: string | null;

  @ApiPropertyOptional({ nullable: true }) @optStr()
  categoria?: string | null;
}

export class ContarItemDto extends TenantAwareDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'quantidadeContada deve ser numérica.' })
  @Min(0, { message: 'quantidadeContada não pode ser negativa.' })
  quantidadeContada: number;
}
