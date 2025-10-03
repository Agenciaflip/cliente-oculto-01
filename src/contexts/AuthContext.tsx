import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

// ⚠️ AVISO DE SEGURANÇA:
// Este sistema usa credenciais hardcoded no código-fonte.
// NÃO É SEGURO para produção real com dados sensíveis.
// Use apenas para demonstração ou ambientes controlados.
// Para produção, use Lovable Cloud/Supabase ou backend próprio com hash de senhas.

const ADMIN_CREDENTIALS = {
  email: 'contato@agenciacafeonline.com.br',
  password: '@@agenciaflip2025**'
};

interface User {
  email: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Verifica sessionStorage ao carregar
  useEffect(() => {
    const storedUser = sessionStorage.getItem('auth_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Erro ao recuperar usuário:', error);
        sessionStorage.removeItem('auth_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Simula delay de rede para melhor UX
    await new Promise(resolve => setTimeout(resolve, 500));

    // Valida credenciais
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      const authenticatedUser: User = {
        email: ADMIN_CREDENTIALS.email,
        role: 'admin'
      };
      
      setUser(authenticatedUser);
      sessionStorage.setItem('auth_user', JSON.stringify(authenticatedUser));
      return true;
    }

    return false;
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('auth_user');
  };

  const value = {
    isAuthenticated: !!user,
    user,
    loading,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
