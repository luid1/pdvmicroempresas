import { Logger, Provider } from '@nestjs/common';
import { NFE_PROVIDER, NfeProvider } from './nfe-provider.interface';
import { MockNfeProvider } from './mock.provider';
import { RealNfeProvider } from './real.provider';

/**
 * Factory do provider de NF-e por feature flag.
 *   NFE_PROVIDER = 'mock' (default) → simulação, nunca transmite.
 *   NFE_PROVIDER = 'focus' | 'sefaz' → provider real (hoje stub que exige config).
 */
export const nfeProviderFactory: Provider = {
  provide: NFE_PROVIDER,
  inject: [MockNfeProvider, RealNfeProvider],
  useFactory: (mock: MockNfeProvider, real: RealNfeProvider): NfeProvider => {
    const flag = (process.env.NFE_PROVIDER || 'mock').toLowerCase();
    const logger = new Logger('NfeProviderFactory');
    if (flag === 'mock') {
      logger.log('🧪 NF-e em modo SIMULAÇÃO (NFE_PROVIDER=mock).');
      return mock;
    }
    logger.warn(`⚠️ NF-e provider REAL selecionado (NFE_PROVIDER=${flag}).`);
    return real;
  },
};
