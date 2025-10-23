# 🔧 Configuração Completa - Instâncias Evolution API

## 📋 CREDENCIAIS ATUAIS

### Instância Masculina (`clienteoculto-homem`)
```
URL: https://evolution-nova-versao-evolution-api.78s68s.easypanel.host/
API Key: 8B5D5E4F947E-4A34-A95D-FF174D74497F
Instance Name: clienteoculto-homem
```

### Instância Feminina (`clienteoculto-mulher`)
```
URL: [PREENCHER]
API Key: [PREENCHER]
Instance Name: clienteoculto-mulher
```

---

## 🎯 PASSO 1: Configurar Webhooks na Evolution API

### Para AMBAS as instâncias:

1. Acesse: `https://evolution-nova-versao-evolution-api.78s68s.easypanel.host/`

2. Faça login

3. **Para instância `clienteoculto-homem`:**
   - Selecione a instância
   - Vá em **Settings** → **Webhooks** (ou **Configurações** → **Webhooks**)
   - Configure:
     ```
     URL: https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/handle-webhook

     Events:
     ✅ messages.upsert
     ✅ messages.update
     ✅ messages.set

     Webhook by Events: ✅ ON
     Status: ✅ Enabled
     ```
   - Clique **Save** ou **Salvar**

4. **Para instância `clienteoculto-mulher`:**
   - Repita o processo acima
   - **MESMA URL** de webhook
   - **MESMOS eventos** marcados

---

## 🎯 PASSO 2: Atualizar Variáveis de Ambiente no Supabase

### Método 1: Via Supabase Dashboard (Recomendado)

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard)

2. Selecione seu projeto

3. Vá em **Settings** (ícone de engrenagem no menu lateral)

4. Clique em **Edge Functions** → **Manage secrets**

5. **Atualize/Adicione estas variáveis:**

#### Para instância MASCULINA:
```bash
EVOLUTION_API_URL=https://evolution-nova-versao-evolution-api.78s68s.easypanel.host
EVOLUTION_API_KEY=8B5D5E4F947E-4A34-A95D-FF174D74497F
EVOLUTION_INSTANCE_NAME=clienteoculto-homem
```

#### Para instância FEMININA:
```bash
EVOLUTION_API_URL_FEMALE=[URL_DA_INSTANCIA_FEMININA]
EVOLUTION_API_KEY_FEMALE=[API_KEY_DA_INSTANCIA_FEMININA]
EVOLUTION_INSTANCE_NAME_FEMALE=clienteoculto-mulher
```

6. Clique **Save** ou **Add new secret** para cada variável

7. **IMPORTANTE:** Após salvar todas, clique em **Restart** para aplicar mudanças

---

### Método 2: Via CLI (Alternativo)

Se você tem Supabase CLI instalado:

```bash
# Navegar até pasta do projeto
cd /home/user/cliente-oculto-01

# Setar variáveis uma por uma
supabase secrets set EVOLUTION_API_URL=https://evolution-nova-versao-evolution-api.78s68s.easypanel.host
supabase secrets set EVOLUTION_API_KEY=8B5D5E4F947E-4A34-A95D-FF174D74497F
supabase secrets set EVOLUTION_INSTANCE_NAME=clienteoculto-homem

supabase secrets set EVOLUTION_API_URL_FEMALE=[URL_FEMININA]
supabase secrets set EVOLUTION_API_KEY_FEMALE=[KEY_FEMININA]
supabase secrets set EVOLUTION_INSTANCE_NAME_FEMALE=clienteoculto-mulher
```

---

## 🎯 PASSO 3: Redesploy das Edge Functions

**OBRIGATÓRIO** após atualizar variáveis de ambiente!

### Via CLI:

```bash
cd /home/user/cliente-oculto-01

# Redesployer todas as functions de uma vez
supabase functions deploy

# OU redesployer uma por uma
supabase functions deploy handle-webhook
supabase functions deploy process-analysis
supabase functions deploy monitor-conversations
supabase functions deploy diagnose-conversation
```

### Via Supabase Dashboard:

1. Vá em **Edge Functions**
2. Para cada função:
   - Clique nos três pontos (⋮)
   - Clique **Redeploy**
   - Confirme

---

## ✅ PASSO 4: Validar Configuração

### Teste 1: Verificar variáveis

Execute este teste para confirmar que as variáveis foram aplicadas:

```sql
-- No Supabase SQL Editor
SELECT
  'EVOLUTION_INSTANCE_NAME' as var_name,
  current_setting('app.settings.EVOLUTION_INSTANCE_NAME', true) as value
UNION ALL
SELECT
  'EVOLUTION_INSTANCE_NAME_FEMALE',
  current_setting('app.settings.EVOLUTION_INSTANCE_NAME_FEMALE', true);
```

---

### Teste 2: Criar análise de teste

1. **Criar análise com agente MASCULINO**
   - Use qualquer número de teste
   - Selecione gênero: Masculino
   - Aguarde primeira mensagem

2. **Responder do WhatsApp**
   - Responda a mensagem com seu celular
   - Aguarde 10-120 segundos

3. **Verificar se funcionou:**
   ```sql
   -- Buscar análises recentes
   SELECT
     id,
     target_phone,
     evolution_instance,
     ai_gender,
     status
   FROM analysis_requests
   ORDER BY created_at DESC
   LIMIT 5;

   -- Pegar o ID da última análise e verificar mensagens
   SELECT
     role,
     content,
     created_at
   FROM conversation_messages
   WHERE analysis_id = 'COLE_ID_AQUI'
   ORDER BY created_at;
   ```

   **Esperado:**
   - Deve ter pelo menos 1 mensagem `role = 'ai'` (primeira mensagem)
   - Deve ter pelo menos 1 mensagem `role = 'user'` (sua resposta)
   - IA deve ter respondido automaticamente

---

### Teste 3: Usar função de diagnóstico

```bash
curl -X POST https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/diagnose-conversation \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0am5ibXZmampwaGxqY2F2cm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTAxMTYsImV4cCI6MjA3NDk4NjExNn0.S6BQiIp1yYE6sfT9jyAMBLXdaSsL-KvlgNlWuU3X0hk" \
  -H "Content-Type: application/json" \
  -d '{"analysis_id": "ID_DA_ANALISE_DE_TESTE"}'
```

**Resultado esperado:**
```json
{
  "checks": {
    "analysis_exists": { "status": "✅ ENCONTRADA" },
    "messages": {
      "status": "✅ MENSAGENS ENCONTRADAS",
      "user_messages": 1,
      "ai_messages": 2
    },
    "evolution_instance": {
      "match": "✅ MATCH"
    }
  },
  "recommendations": [],
  "summary": {
    "likely_issue": "✅ Tudo parece estar funcionando"
  }
}
```

---

## 🚨 TROUBLESHOOTING

### Problema: "Evolution API error" nos logs

**Causa:** URL ou API Key incorretos

**Solução:**
1. Verifique se as variáveis estão corretas no Supabase Dashboard
2. Teste manualmente a API:
   ```bash
   curl https://evolution-nova-versao-evolution-api.78s68s.easypanel.host/instance/fetchInstances \
     -H "apikey: 8B5D5E4F947E-4A34-A95D-FF174D74497F"
   ```
3. Se retornar erro, credenciais estão erradas

---

### Problema: "No active analysis" no webhook

**Causa:** Nome da instância não bate

**Solução:**
1. Verificar nome exato da instância no Evolution:
   ```bash
   curl https://evolution-nova-versao-evolution-api.78s68s.easypanel.host/instance/fetchInstances \
     -H "apikey: 8B5D5E4F947E-4A34-A95D-FF174D74497F"
   ```
2. Copiar nome EXATO (case-sensitive!)
3. Atualizar variável `EVOLUTION_INSTANCE_NAME`

---

### Problema: Webhook não está sendo chamado

**Causa:** Webhook não configurado ou desabilitado

**Solução:**
1. Acessar Evolution API Dashboard
2. Verificar em Settings → Webhooks
3. Garantir que:
   - URL está correta
   - Events estão marcados
   - Status = Enabled
4. Teste manual:
   ```bash
   # Enviar webhook de teste
   curl -X POST https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/handle-webhook \
     -H "Content-Type: application/json" \
     -d '{
       "event": "messages.upsert",
       "instance": "clienteoculto-homem",
       "data": {
         "key": {
           "remoteJid": "5511999999999@s.whatsapp.net",
           "fromMe": false
         },
         "message": {
           "conversation": "teste"
         }
       }
     }'
   ```

---

## 📋 CHECKLIST FINAL

Antes de criar análises em produção, confirme:

- [ ] Webhook configurado na instância `clienteoculto-homem`
- [ ] Webhook configurado na instância `clienteoculto-mulher`
- [ ] Variáveis de ambiente atualizadas no Supabase
- [ ] Edge Functions redesployadas
- [ ] Teste com agente masculino funcionou
- [ ] Teste com agente feminino funcionou
- [ ] Função de diagnóstico retorna ✅

---

## 🎉 RESULTADO ESPERADO

Após configuração completa:

✅ **Agente Masculino:**
- Usa instância `clienteoculto-homem`
- Envia mensagens via Evolution API
- Recebe respostas via webhook
- IA continua conversa automaticamente

✅ **Agente Feminino:**
- Usa instância `clienteoculto-mulher`
- Envia mensagens via Evolution API
- Recebe respostas via webhook
- IA continua conversa automaticamente

✅ **Portal:**
- Mostra mensagens em tempo real
- Timer de próxima resposta aparece
- Progresso de objetivos atualiza
- Relatório gerado ao final

---

## 📞 SUPORTE

Se após seguir todos os passos ainda não funcionar:

1. **Rode diagnóstico** e copie resultado completo
2. **Verifique logs** das Edge Functions no Supabase
3. **Teste webhook** manualmente com curl
4. **Me envie:**
   - Resultado do diagnóstico
   - Screenshot do webhook configurado
   - Logs das Edge Functions (se houver erros)
