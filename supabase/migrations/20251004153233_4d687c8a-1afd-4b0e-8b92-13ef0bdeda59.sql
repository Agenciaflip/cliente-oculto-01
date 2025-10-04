-- Remove a role admin incorreta do usuário antigo
DELETE FROM public.user_roles 
WHERE user_id = '06b88276-0b78-4598-9e4c-6f607ff636c8' AND role = 'admin';

-- Adiciona a role admin para o usuário correto
INSERT INTO public.user_roles (user_id, role)
VALUES ('b627cd3a-f368-4e75-a7d3-3a2cb7e5b097', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;