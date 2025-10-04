import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export const SubdomainRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Só redireciona se estiver na raiz e o hostname tiver "app."
    if (location.pathname !== '/') return;

    const hostname = window.location.hostname;
    
    // Redireciona app.agenciaflip.com.br para /dashboard
    if (hostname.startsWith('app.')) {
      navigate('/dashboard', { replace: true });
    }
    // Para o domínio raiz, não faz nada (mostra landing page)
  }, [navigate, location.pathname]);

  return null;
};
