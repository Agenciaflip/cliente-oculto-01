# 🚀 Guia de Otimização de Performance - Cliente Oculto

Este guia contém as otimizações críticas para melhorar a performance do sistema Cliente Oculto quando usado com Lovable.

## 📊 Impacto Esperado

- **Dashboard:** 50-100x mais rápido
- **Webhook processing:** 10-20x mais rápido
- **Admin queries:** 30-60x mais rápido
- **Custo:** Zero (só otimização)

---

## 🎯 PARTE 1: Índices de Banco de Dados (CRÍTICO)

### Por que fazer?
Sem índices, o PostgreSQL faz "sequential scan" (lê TODAS as linhas). Com índices, vai direto aos dados necessários.

### Como aplicar (2 opções):

#### **Opção A: Via Supabase Dashboard (Recomendado)**

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **SQL Editor** (menu lateral)
4. Clique em **New Query**
5. Copie TODO o conteúdo de `supabase/migrations/20251023000001_performance_indexes.sql`
6. Cole no editor
7. Clique em **RUN** (ou Ctrl+Enter)
8. Aguarde ~10-30 segundos
9. ✅ Se aparecer "Success. No rows returned", está pronto!

#### **Opção B: Via CLI do Supabase**

```bash
# Se você usa Supabase CLI localmente
supabase db push

# Ou aplicar migration específica
supabase migration up --db-url "your-postgres-url"
```

### Validar se funcionou:

1. No **SQL Editor**, rode:
```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

2. Você deve ver ~15 índices novos começando com `idx_`

---

## 📄 PARTE 2: Paginação no Dashboard

### Por que fazer?
Atualmente o Dashboard carrega TODAS as análises de uma vez. Com 100+ análises, fica lento.

### Como fazer no Lovable:

Abra o **Lovable Chat** e envie este prompt:

```
Otimize o Dashboard (src/pages/Dashboard.tsx) para:

1. Carregar apenas os últimos 20 registros inicialmente
2. Adicionar botão "Carregar mais" no final da lista
3. Usar .range() do Supabase para paginação
4. Selecionar apenas os campos necessários: id, target_phone, company_name, status, created_at

Código atual está na linha 54-58 carregando tudo com .select('*')

Exemplo de código otimizado:
```typescript
const { data: analysesData } = await supabase
  .from('analysis_requests')
  .select('id, target_phone, company_name, status, created_at')
  .eq('user_id', user?.id)
  .order('created_at', { ascending: false })
  .range(0, 19);  // Paginação
```
```

### Validar:
- Dashboard deve carregar instantaneamente mesmo com muitas análises
- Botão "Carregar mais" deve aparecer se houver mais de 20 análises

---

## 🔍 PARTE 3: Otimizar Queries Admin (Opcional)

### Se você tem > 50 usuários, otimize o Admin:

Prompt para Lovable:

```
Otimize a página Admin (src/pages/Admin.tsx) para:

1. Adicionar paginação na lista de usuários (20 por vez)
2. Adicionar paginação na lista de análises (30 por vez)
3. Usar .select() apenas com campos necessários (não usar '*')
4. Adicionar filtros por data para reduzir carga inicial

Exemplo:
- Usuários: carregar apenas active users inicialmente
- Análises: carregar apenas últimas 30 dias por padrão
```

---

## 📈 PARTE 4: Monitoramento de Performance

### Verificar uso dos índices:

Após 1 semana em produção, rode no **SQL Editor**:

```sql
-- Ver quais índices estão sendo usados
SELECT
    indexname,
    idx_scan as vezes_usado,
    pg_size_pretty(pg_relation_size(indexrelid)) as tamanho
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
ORDER BY idx_scan DESC;
```

**Interpretação:**
- `idx_scan > 100`: Índice está sendo muito usado ✅
- `idx_scan = 0`: Índice não está sendo usado ⚠️ (pode remover)

### Identificar queries lentas:

```sql
-- Habilitar tracking de queries lentas (rode 1x)
ALTER DATABASE postgres SET log_min_duration_statement = 1000; -- queries > 1s

-- Ver queries lentas (após alguns dias)
SELECT
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

---

## 🎯 CHECKLIST DE IMPLEMENTAÇÃO

### Fazer AGORA (30 minutos):
- [ ] Aplicar migration de índices via Supabase SQL Editor
- [ ] Validar que índices foram criados
- [ ] Pedir ao Lovable para adicionar paginação no Dashboard
- [ ] Testar Dashboard com > 20 análises

### Fazer se tiver problemas (só quando necessário):
- [ ] Adicionar paginação no Admin (se > 50 usuários)
- [ ] Implementar cache de Perplexity (se custo > $50/mês)
- [ ] Adicionar monitoring de queries lentas
- [ ] Otimizar Edge Functions específicas

---

## 🐛 Troubleshooting

### Erro: "permission denied for table pg_stat_statements"
- **Solução:** Rode apenas as queries de índices. Monitoring avançado requer acesso admin.

### Erro: "relation already exists"
- **Solução:** Normal! Significa que o índice já foi criado antes. Pode ignorar.

### Dashboard ainda lento após índices?
- **Verifique:** Você está carregando muitos dados? Use `.select()` com campos específicos
- **Verifique:** A query está usando os índices? Rode `EXPLAIN ANALYZE` na query

### Lovable reescreveu minha otimização?
- **Solução:** Salve o código otimizado e reaplique após edições do Lovable
- **Ou:** Peça ao Lovable explicitamente: "Mantenha a paginação com .range()"

---

## 📞 Próximos Passos

Após implementar as otimizações básicas (índices + paginação), monitore por 1 semana:

1. **Se tudo estiver rápido:** Pronto! Não precisa fazer mais nada
2. **Se Dashboard ainda lento:** Adicione cache com React Query
3. **Se Admin lento:** Adicione filtros de data
4. **Se custos altos de API:** Implemente cache de Perplexity/OpenAI

---

## 💡 Dicas Lovable

- **Sempre peça explicitamente** para manter otimizações
- **Use comentários** tipo `// PERFORMANCE: não remover .range()`
- **Salve versões** de código otimizado antes de grandes mudanças
- **Índices SQL são seguros** - Lovable não toca em migrations manuais

---

**Dúvidas?** Veja o arquivo `validate_indexes.sql` para queries de diagnóstico.
