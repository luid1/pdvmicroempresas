import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { rotaInicial } from './config/telas';
import PwaPrompt from './components/PwaPrompt';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PosicaoEstoque from './modules/estoque/pages/PosicaoEstoque';
import AnaliseEstoqueFisico from './modules/estoque/pages/AnaliseEstoqueFisico';
import Transferencias from './modules/estoque/pages/Transferencias';
import Clientes from './modules/cadastros/pages/Clientes';
import Custos from './modules/financeiro/pages/Custos';
import ContasReceber from './modules/financeiro/pages/ContasReceber';
import ContasPagar from './modules/financeiro/pages/ContasPagar';
import FluxoCaixa from './modules/financeiro/pages/FluxoCaixa';
import ControladoriaHub from './modules/financeiro/pages/ControladoriaHub';
import UsuariosAcessos from './modules/gerencial/pages/UsuariosAcessos';
import Relatorios from './modules/gerencial/pages/Relatorios';
import LogsAuditoria from './modules/gerencial/pages/LogsAuditoria';
import Configuracoes from './modules/gerencial/pages/Configuracoes';
import MinhaAssinatura from './modules/gerencial/pages/MinhaAssinatura';
import Produtos from './modules/cadastros/pages/Produtos';
import Fornecedores from './modules/cadastros/pages/Fornecedores';
import Filiais from './modules/cadastros/pages/Filiais';
import Pereciveis from './modules/estoque/pages/Pereciveis';
import Entradas from './modules/estoque/pages/Entradas';
import Movimentacoes from './modules/estoque/pages/Movimentacoes';
import Inventario from './modules/estoque/pages/Inventario';
import Compras from './modules/estoque/pages/Compras';
import DevolucoesCompra from './modules/estoque/pages/DevolucoesCompra';
import TabelasPreco from './modules/cadastros/pages/TabelasPreco';
import AppComprador from './modules/compras/pages/AppComprador';
import FinancialHub from './modules/financeiro/pages/FinancialHub';
import PlanoContas from './modules/financeiro/pages/PlanoContas';
import Tesouraria from './modules/financeiro/pages/Tesouraria';
import Recorrencias from './modules/financeiro/pages/Recorrencias';
import Faturamento from './modules/fiscal/pages/Faturamento';
import PainelFaturamento from './modules/fiscal/pages/PainelFaturamento';
import GestaoFiscal from './modules/fiscal/pages/GestaoFiscal';
import ConfiguracaoFiscal from './modules/fiscal/pages/ConfiguracaoFiscal';
import MonitorFiscal from './modules/fiscal/pages/MonitorFiscal';
import Pdv from './modules/pdv/pages/Pdv';
import ConfigCaixa from './modules/pdv/pages/ConfigCaixa';
import Plataforma from './modules/plataforma/pages/Plataforma';
import VisaoGeral from './modules/plataforma/pages/VisaoGeral';
import Assinaturas from './modules/plataforma/pages/Assinaturas';
import ModoOperacao from './modules/config/pages/ModoOperacao';
import Mesas from './modules/restaurante/pages/Mesas';
import Comandas from './modules/restaurante/pages/Comandas';
import Cozinha from './modules/restaurante/pages/Cozinha';
import Delivery from './modules/restaurante/pages/Delivery';
import FichaTecnica from './modules/restaurante/pages/FichaTecnica';
import CardapioDigital from './modules/restaurante/pages/CardapioDigital';
import DivisaoConta from './modules/restaurante/pages/DivisaoConta';
import DashboardRestaurante from './modules/restaurante/pages/DashboardRestaurante';
import MobileLoginPage from './mobile/MobileLoginPage';
import MobileAppPage from './mobile/MobileAppPage';

/**
 * Tela de carregamento da marca. Trocadilho com a logo "Lumin" (luz):
 * o ponto de luz azul sobre o "ı" — a assinatura do wordmark — acende e
 * respira, um halo pulsa atrás e uma varredura de luz cruza as letras.
 */
function LuminBoot({ mobile = false }: { mobile?: boolean }) {
  return (
    <div className={`flex items-center justify-center overflow-hidden ${mobile ? 'min-h-[100dvh] bg-[#071018]' : 'h-screen bg-[#08090A]'}`}>
      <div className="lu-rise flex flex-col items-center gap-5">
        <div className="relative flex items-baseline leading-none">
          <span className="lumin-halo" aria-hidden />
          <span className="font-logo relative z-10 inline-flex select-none items-baseline text-[#F7F8FA]" style={{ fontSize: 44, fontWeight: 700, letterSpacing: '0.005em' }}>
            Lum
            <span className="relative inline-block">
              <span>ı</span>
              <span className="lumin-spark absolute rounded-full bg-[#01B8FA]" style={{ width: 7, height: 7, left: '50%', transform: 'translateX(-50%)', top: '-7px' }} />
            </span>
            n
          </span>
        </div>
        <p className="font-plex-mono text-[10px] uppercase tracking-[0.32em] text-[#3DC8FB]/70">
          Acendendo as luzes<span className="lumin-dot-1">.</span><span className="lumin-dot-2">.</span><span className="lumin-dot-3">.</span>
        </p>
      </div>
    </div>
  );
}

function Guard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LuminBoot />;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function MobileGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LuminBoot mobile />;
  return user ? <>{children}</> : <Navigate to="/app/login" replace />;
}

/** Tela inicial ao abrir "/": respeita a telaInicial do usuário; se não houver
 *  uma fixada e o modo da empresa for Restaurante, cai no painel do restaurante. */
function HomeRedirect() {
  const { user, segmento } = useAuth();
  let destino = rotaInicial(user?.telas, user?.role, user?.telaInicial);
  // Só sobrescreve o destino GENÉRICO (/dashboard); uma telaInicial fixada sempre vence.
  if (destino === '/dashboard' && segmento === 'RESTAURANTE') {
    destino = '/restaurante/mesas';
  }
  return <Navigate to={destino} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* Aplicativo móvel de acompanhamento — separado do ERP e somente leitura. */}
          <Route path="/app/login" element={<MobileLoginPage />} />
          <Route path="/app" element={<MobileGuard><MobileAppPage /></MobileGuard>} />
          {/* PDV — tela cheia (sem AppShell), mas exige login (operador de caixa) */}
          <Route path="/pdv" element={<Guard><Pdv /></Guard>} />
          <Route path="/" element={<Guard><AppShell /></Guard>}>
            <Route index element={<HomeRedirect />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="pdv/config" element={<ConfigCaixa />} />

            {/* Cadastros */}
            <Route path="cadastros/clientes" element={<Clientes />} />
            <Route path="cadastros/fornecedores" element={<Fornecedores />} />
            <Route path="cadastros/produtos" element={<Produtos />} />
            <Route path="cadastros/filiais" element={<Filiais />} />
            <Route path="cadastros/tabelas-preco" element={<TabelasPreco />} />

            {/* WMS */}
            <Route path="wms/posicao" element={<PosicaoEstoque />} />
            <Route path="wms/pereciveis" element={<Pereciveis />} />
            <Route path="wms/entradas" element={<Entradas />} />
            <Route path="wms/movimentacoes" element={<Movimentacoes />} />
            <Route path="wms/inventario" element={<Inventario />} />
            <Route path="wms/compras" element={<Compras />} />
            <Route path="wms/devolucoes-compra" element={<DevolucoesCompra />} />
            <Route path="compras/app" element={<AppComprador />} />
            <Route path="wms/analise-estoque" element={<AnaliseEstoqueFisico />} />
            <Route path="wms/transferencias" element={<Transferencias />} />

            {/* Fiscal */}
            <Route path="fiscal/nfe" element={<GestaoFiscal />} />
            <Route path="fiscal/emitir" element={<Faturamento />} />
            <Route path="fiscal/painel" element={<PainelFaturamento />} />
            <Route path="fiscal/matriz" element={<ConfiguracaoFiscal />} />
            <Route path="fiscal/gestao" element={<GestaoFiscal />} />
            <Route path="fiscal/monitor" element={<MonitorFiscal />} />
            <Route path="fiscal/configuracao" element={<ConfiguracaoFiscal />} />

            {/* Financeiro */}
            <Route path="financeiro/fluxo-caixa" element={<FluxoCaixa />} />
            <Route path="financeiro/receber" element={<ContasReceber />} />
            <Route path="financeiro/pagar" element={<ContasPagar />} />
            <Route path="financeiro/controladoria" element={<ControladoriaHub />} />
            <Route path="financeiro/dre" element={<FinancialHub />} />
            <Route path="financeiro/plano-contas" element={<PlanoContas />} />
            <Route path="financeiro/tesouraria" element={<Tesouraria />} />
            <Route path="financeiro/recorrencias" element={<Recorrencias />} />
            <Route path="financeiro/custos" element={<Custos />} />

            {/* Restaurante (modo Restaurante/Híbrido) */}
            <Route path="restaurante/mesas" element={<Mesas />} />
            <Route path="restaurante/comandas" element={<Comandas />} />
            <Route path="restaurante/cozinha" element={<Cozinha />} />
            <Route path="restaurante/delivery" element={<Delivery />} />
            <Route path="restaurante/ficha-tecnica" element={<FichaTecnica />} />
            <Route path="restaurante/cardapio" element={<CardapioDigital />} />
            <Route path="restaurante/divisao-conta" element={<DivisaoConta />} />
            <Route path="restaurante/dashboard" element={<DashboardRestaurante />} />

            {/* Gerencial */}
            <Route path="gerencial/relatorios" element={<Relatorios />} />
            <Route path="gerencial/modo-operacao" element={<ModoOperacao />} />
            <Route path="gerencial/auditoria" element={<LogsAuditoria />} />
            <Route path="gerencial/usuarios" element={<UsuariosAcessos />} />
            <Route path="gerencial/configuracoes" element={<Configuracoes />} />
            <Route path="gerencial/assinatura" element={<MinhaAssinatura />} />

            {/* Plataforma (dono do SaaS) — só o super-admin acessa (TelaGuard + soDono) */}
            <Route path="plataforma/visao" element={<VisaoGeral />} />
            <Route path="plataforma" element={<Plataforma />} />
            <Route path="plataforma/assinaturas" element={<Assinaturas />} />
          </Route>
        </Routes>
        <PwaPrompt />
      </BrowserRouter>
    </AuthProvider>
  );
}
