import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSubdomainDetection } from "@/hooks/useSubdomainDetection";

export const SubdomainRedirect = () => {
  const subdomain = useSubdomainDetection();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Só redireciona se estiver na página raiz
    if (location.pathname !== '/') {
      return;
    }

    // Redireciona baseado no subdomínio
    if (subdomain === 'admin') {
      navigate('/admin', { replace: true });
    } else if (subdomain === 'app') {
      navigate('/dashboard', { replace: true });
    }
    // Se for 'root', não faz nada (mantém na landing page)
  }, [subdomain, navigate, location.pathname]);

  return null;
};
