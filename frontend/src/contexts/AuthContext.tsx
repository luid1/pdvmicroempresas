import React, { createContext, useContext, useState, useEffect } from 'react';
import { podeAcao, AcaoTela } from '../config/telas';

interface Filial { id: string; codigo: string; nome: string }
interface AuthUser { id: string; nome: string; email: string; role: string; tenantId: string; telas?: string[]; telaInicial?: string | null; acoes?: Record<string, string[]> }

interface AuthCtx {
  user: AuthUser | null;
  filiais: Filial[];
  filialAtiva: Filial | null;
  setFilialAtiva: (f: Filial) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  pode: (rota: string, acao: AcaoTela) => boolean;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [filialAtiva, setFilialAtivaState] = useState<Filial | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('wms_user');
    const storedFilial = localStorage.getItem('wms_filial');
    const storedFiliais = localStorage.getItem('wms_filiais');
    if (stored) setUser(JSON.parse(stored));
    if (storedFiliais) setFiliais(JSON.parse(storedFiliais));
    if (storedFilial) setFilialAtivaState(JSON.parse(storedFilial));
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Credenciais inválidas');
    const data = await res.json();

    const authUser: AuthUser = { ...data.usuario, tenantId: data.tenant.id };
    const userFiliais: Filial[] = data.usuario.filiais || [];
    const primeiraFilial = userFiliais[0] || null;

    localStorage.setItem('wms_token', data.token);
    localStorage.setItem('wms_user', JSON.stringify(authUser));
    localStorage.setItem('wms_filiais', JSON.stringify(userFiliais));
    if (primeiraFilial) localStorage.setItem('wms_filial', JSON.stringify(primeiraFilial));

    setUser(authUser);
    setFiliais(userFiliais);
    setFilialAtivaState(primeiraFilial);
  };

  const logout = () => {
    ['wms_token', 'wms_user', 'wms_filial', 'wms_filiais'].forEach((k) => localStorage.removeItem(k));
    setUser(null);
    setFiliais([]);
    setFilialAtivaState(null);
  };

  const setFilialAtiva = (f: Filial) => {
    setFilialAtivaState(f);
    localStorage.setItem('wms_filial', JSON.stringify(f));
  };

  // Pode executar uma ação (CRIAR/EDITAR/EXCLUIR) na rota informada?
  const pode = (rota: string, acao: AcaoTela) => podeAcao(user?.role, user?.acoes, rota, acao);

  return (
    <Ctx.Provider value={{ user, filiais, filialAtiva, setFilialAtiva, login, logout, isLoading, pode }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
