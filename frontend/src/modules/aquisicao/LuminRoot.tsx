// Fontes auto-hospedadas (bundle do Vite — sem <link> do Google Fonts).
// Cada import traz os .woff2 variáveis do @fontsource para dentro do build.
import '@fontsource-variable/bricolage-grotesque'; // Display — títulos (600/800)
import '@fontsource-variable/inter-tight';         // Corpo — texto (400/500/600)
import '@fontsource-variable/jetbrains-mono';      // Utilitária — preços/eyebrows (500/700)

import './lumin-theme.css';

type LuminRootProps = {
  children: React.ReactNode;
  /** Classe extra opcional no wrapper. */
  className?: string;
};

/**
 * Casca de tema das telas de aquisição do Lumin PDV.
 *
 * Envolve o conteúdo em `.lumin-root`, onde vivem todos os tokens
 * (cores, tipografia, brilho âmbar). Como o tema é escopado por essa
 * classe, ele NÃO colide com os overrides globais do ERP (index.css).
 *
 * Use nas rotas públicas: /planos, /cadastro, /boas-vindas, demo.
 */
export default function LuminRoot({ children, className }: LuminRootProps) {
  return (
    <div className={`lumin-root${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}
