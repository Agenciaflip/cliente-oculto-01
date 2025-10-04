import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  signup: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Verifica role do usuário
  const checkUserRole = async (supabaseUser: SupabaseUser): Promise<'admin' | 'user'> => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', supabaseUser.id)
      .eq('role', 'admin')
      .maybeSingle();
    
    return data ? 'admin' : 'user';
  };

  // Inicializa sessão
  useEffect(() => {
    let initialCheckDone = false;

    // Helper: atualiza usuário rapidamente a partir da sessão (sem checar role ainda)
    const setUserFromSession = (session: any) => {
      const sUser = session?.user;
      if (!sUser) {
        setUser(null);
        return;
      }
      setUser((prev) => {
        if (prev?.id === sUser.id && prev?.email === sUser.email) return prev;
        return { id: sUser.id, email: sUser.email!, role: prev?.role ?? 'user' };
      });
    };

    // Listener de auth (somente updates síncronos aqui!)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event);

      // Ignorar o INITIAL_SESSION (tratado no getSession abaixo)
      if (event === 'INITIAL_SESSION') {
        if (!initialCheckDone) setLoading(false);
        return;
      }

      // Processar apenas eventos relevantes
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          // Atualiza usuário imediatamente
          setUserFromSession(session);
          // Buscar role de forma assíncrona e DEFERIDA para evitar deadlocks
          setTimeout(async () => {
            try {
              const role = await checkUserRole(session.user);
              setUser((u) => (u && u.id === session.user!.id ? { ...u, role } : u));
            } catch (e) {
              console.error('Erro ao verificar role (listener):', e);
            }
          }, 0);
        } else {
          setUser(null);
        }
      }
    });

    // Sessão inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUserFromSession(session);
        // Checa role de forma deferida
        setTimeout(async () => {
          try {
            const role = await checkUserRole(session.user);
            setUser((u) => (u && u.id === session.user!.id ? { ...u, role } : u));
          } catch (e) {
            console.error('Erro ao verificar role (sessão inicial):', e);
          }
        }, 0);
      } else {
        setUser(null);
      }
      setLoading(false);
      initialCheckDone = true;
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data.user) {
      const role = await checkUserRole(data.user);
      const authenticatedUser: User = {
        id: data.user.id,
        email: data.user.email!,
        role
      };
      setUser(authenticatedUser);
      return { success: true, user: authenticatedUser };
    }

    return { success: false, error: 'Usuário não encontrado' };
  };

  const signup = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const value = {
    isAuthenticated: !!user,
    user,
    loading,
    login,
    signup,
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
