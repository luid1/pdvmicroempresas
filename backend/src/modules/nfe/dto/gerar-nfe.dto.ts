import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { TenantAwareDto } from '../../../common/dto/tenant-aware.dto';

/** Corpo para gerar uma NF-e rascunho a partir de um pedido. */
export class GerarNfeDto extends TenantAwareDto {
  @ApiProperty()
  @IsString() @IsNotEmpty({ message: 'filialId é obrigatório.' })
  filialId: string;
}
