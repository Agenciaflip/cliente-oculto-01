# 🔍 Guia de Diagnóstico - Webhook e Processamento de Mensagens

## 🎯 Problema Relatado

**Sintomas:**
- ✅ IA envia primeira mensagem
- ❌ Empresa responde mas mensagem NÃO aparece no portal
- ❌ IA não recebe resposta e não continua conversa
- ❌ Testado com números diferentes e ambos os agentes (male/female)

---

## 🔎 PASSO 1: Função de Diagnóstico

Criei uma Edge Function especializada para diagnosticar o problema.

### Como usar:

#### Opção A: Via cURL

```bash
curl -X POST https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/diagnose-conversation \
  -H "Authorization: Bearer SEU_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"analysis_id": "ID_DA_ANALISE"}'
```

#### Opção B: Via Supabase Dashboard

1. Vá em **Edge Functions** > **diagnose-conversation**
2. Clique em **Invoke**
3. Cole no body:
```json
{
  "analysis_id": "ID_DA_ANALISE_QUE_NAO_FUNCIONA"
}
```

#### Opção C: Buscar por telefone

```json
{
  "phone_number": "556283071325"
}
```

---

## 📊 PASSO 2: Interpretar Resultados

### Resultado Exemplo (funcionando):

```json
{
  "checks": {
    "analysis_exists": {
      "status": "✅ ENCONTRADA"
    },
    "messages": {
      "status": "✅ MENSAGENS ENCONTRADAS",
      "user_messages": 3,
      "ai_messages": 4,
      "unprocessed_user_messages": 0
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

### Resultado Exemplo (problema típico):

```json
{
  "checks": {
    "messages": {
      "user_messages": 0,
      "ai_messages": 1
    },
    "unprocessed_details": {
      "status": "❌ CRÍTICO: Mensagens do usuário recebidas mas IA nunca respondeu"
    }
  },
  "recommendations": [
    "❌ IA enviou mensagem inicial mas usuário nunca respondeu - webhook pode não estar configurado"
  ]
}
```

---

## 🐛 CENÁRIOS COMUNS E SOLUÇÕES

### CENÁRIO 1: "IA enviou mas usuário nunca respondeu"
**Problema:** Webhook da Evolution API não está configurado ou apontando para URL errada

**Solução:**
1. Acesse Evolution API Dashboard
2. Vá em **Settings** > **Webhooks**
3. Verifique se a URL está correta:
   ```
   https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/handle-webhook
   ```
4. Eventos que DEVEM estar ativos:
   - ✅ `messages.upsert` (ESSENCIAL)
   - ✅ `messages.set`
   - ✅ `messages.update`

5. Testar webhook manualmente:
   ```bash
   curl -X POST https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/handle-webhook \
     -H "Content-Type: application/json" \
     -d '{
       "event": "messages.upsert",
       "instance": "felipedisparo",
       "data": {
         "key": {
           "remoteJid": "556283071325@s.whatsapp.net",
           "fromMe": false
         },
         "message": {
           "conversation": "teste de webhook"
         }
       }
     }'
   ```

---

### CENÁRIO 2: "Mensagens não processadas detectadas"
**Problema:** Monitor-conversations não está sendo chamado ou está falhando

**Verificar:**
1. Se existe trigger no banco:
   ```sql
   SELECT * FROM information_schema.triggers
   WHERE trigger_name LIKE '%monitor%';
   ```

2. Logs da Edge Function:
   - Vá em **Edge Functions** > **monitor-conversations** > **Logs**
   - Procure por erros relacionados ao `analysis_id`

**Solução:**
- Chamar monitor-conversations manualmente:
  ```bash
  curl -X POST https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/monitor-conversations \
    -H "Authorization: Bearer SEU_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"analysis_id": "ID_DA_ANALISE"}'
  ```

---

### CENÁRIO 3: "Mismatch de instância Evolution"
**Problema:** Análise esperando instância X mas webhook vem da instância Y

**Exemplo:**
```json
{
  "evolution_instance": {
    "analysis_instance": "felipedisparo",
    "expected_instance": "clienteoculto-mulher",
    "match": "❌ MISMATCH"
  }
}
```

**Solução:**
1. Verificar qual instância está sendo usada:
   ```sql
   SELECT id, target_phone, evolution_instance, ai_gender
   FROM analysis_requests
   WHERE id = 'ID_DA_ANALISE';
   ```

2. Atualizar manualmente se necessário:
   ```sql
   UPDATE analysis_requests
   SET evolution_instance = 'clienteoculto-mulher'
   WHERE id = 'ID_DA_ANALISE' AND ai_gender = 'female';
   ```

---

### CENÁRIO 4: "Múltiplas análises ativas para mesmo número"
**Problema:** Duas análises para o mesmo telefone causam conflito

**Solução:**
- Encerrar análises duplicadas:
  ```sql
  UPDATE analysis_requests
  SET status = 'failed',
      metadata = jsonb_set(metadata, '{error}', '"Duplicated analysis"')
  WHERE target_phone LIKE '%83071325%'
    AND status = 'chatting'
    AND id != 'ID_DA_ANALISE_CORRETA';
  ```

---

## 🔧 PASSO 3: Verificações Manuais

### 1. Verificar se handle-webhook está recebendo chamadas

Adicionar log temporário no Evolution API ou verificar logs do Supabase:

```sql
-- Verificar últimas chamadas à handle-webhook (se houver tabela de logs)
SELECT * FROM edge_function_logs
WHERE function_name = 'handle-webhook'
ORDER BY created_at DESC
LIMIT 10;
```

### 2. Verificar se mensagens estão sendo salvas

```sql
SELECT
  cm.id,
  cm.analysis_id,
  cm.role,
  cm.content,
  cm.created_at,
  cm.metadata->>'processed' as processed,
  cm.metadata->>'next_ai_response_at' as next_response
FROM conversation_messages cm
WHERE cm.analysis_id = 'ID_DA_ANALISE'
ORDER BY cm.created_at DESC;
```

### 3. Verificar estado da análise

```sql
SELECT
  id,
  status,
  target_phone,
  evolution_instance,
  ai_gender,
  started_at,
  last_message_at,
  metadata->>'next_ai_response_at' as next_response,
  metadata->>'conversation_stage' as stage
FROM analysis_requests
WHERE id = 'ID_DA_ANALISE';
```

### 4. Forçar processamento manual

Se encontrar mensagens não processadas:

```sql
-- 1. Marcar mensagens como não claimed
UPDATE conversation_messages
SET metadata = jsonb_set(
  jsonb_set(metadata, '{claimed_by}', 'null'),
  '{claimed_at}',
  'null'
)
WHERE analysis_id = 'ID_DA_ANALISE'
  AND role = 'user'
  AND (metadata->>'processed')::boolean = false;

-- 2. Chamar monitor-conversations via cURL
curl -X POST https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/monitor-conversations \
  -H "Authorization: Bearer SEU_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"analysis_id": "ID_DA_ANALISE"}'
```

---

## 🚨 CHECKLIST DE TROUBLESHOOTING

- [ ] **Webhook Evolution API configurado?**
  - URL: `https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/handle-webhook`
  - Evento: `messages.upsert` ativo

- [ ] **Trigger do banco ativo?**
  ```sql
  SELECT * FROM information_schema.triggers
  WHERE trigger_name LIKE '%monitor%';
  ```

- [ ] **Edge Functions online?**
  - `handle-webhook` respondendo
  - `monitor-conversations` respondendo

- [ ] **Instância correta?**
  - Male → `felipedisparo`
  - Female → `clienteoculto-mulher`

- [ ] **Sem análises duplicadas?**
  ```sql
  SELECT COUNT(*) FROM analysis_requests
  WHERE target_phone LIKE '%TELEFONE%' AND status = 'chatting';
  ```
  (Deve retornar 1)

- [ ] **Mensagens sendo salvas?**
  ```sql
  SELECT COUNT(*) FROM conversation_messages
  WHERE analysis_id = 'ID' AND role = 'user';
  ```
  (Deve ter > 0 se empresa respondeu)

---

## 📞 PRÓXIMOS PASSOS

1. **Rode a função de diagnóstico** com um `analysis_id` que não funciona
2. **Copie o resultado completo** e analise as recomendações
3. **Siga as soluções** do cenário identificado
4. **Teste novamente** criando nova análise

---

## 🆘 Se nada funcionar

Execute este script completo de diagnóstico e me envie o resultado:

```sql
-- DIAGNÓSTICO COMPLETO
WITH analysis_info AS (
  SELECT * FROM analysis_requests WHERE id = 'ID_DA_ANALISE'
),
messages_info AS (
  SELECT * FROM conversation_messages WHERE analysis_id = 'ID_DA_ANALISE'
)
SELECT
  'ANÁLISE' as tipo,
  json_build_object(
    'id', a.id,
    'status', a.status,
    'phone', a.target_phone,
    'instance', a.evolution_instance,
    'gender', a.ai_gender,
    'last_message', a.last_message_at
  ) as dados
FROM analysis_info a
UNION ALL
SELECT
  'MENSAGENS' as tipo,
  json_agg(json_build_object(
    'id', m.id,
    'role', m.role,
    'content', substring(m.content, 1, 50),
    'processed', m.metadata->>'processed',
    'created_at', m.created_at
  )) as dados
FROM messages_info m;
```

Envie o JSON completo retornado pela função `diagnose-conversation`.
