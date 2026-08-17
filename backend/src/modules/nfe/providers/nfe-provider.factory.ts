import { Provider } from '@nestjs/common';
import { NFE_PROVIDER, NfeProvider } from './nfe-provider.interface';
import { RoteadorNfeProvider } from './roteador.provider';

/**
 * Factory do provider de NF-e por feature flag.
 *   NFE_PROVIDER = 'mock' (default) → simulação, nunca transmite.
 *   NFE_PROVIDER = 'focus' | 'sefaz' → provider real (hoje stub que exige config).
 */
export const nfeProviderFactory: Provider = {
  provide: NFE_PROVIDER,
  inject: [RoteadorNfeProvider],
  useFactory: (roteador: RoteadorNfeProvider): NfeProvider => roteador,
};
