# 📱 Configuração do Webhook da Evolution API

## ✅ O Que Já Está Funcionando

- ✅ **Frontend completo** (Dashboard, criação de análises, visualização em tempo real)
- ✅ **Banco de dados** configurado com RLS e Realtime
- ✅ **3 Edge Functions** criadas e deployadas:
  - `process-analysis` - Processa análises pendentes
  - `handle-webhook` - Recebe respostas dos concorrentes
  - `generate-metrics` - Gera métricas finais com IA
- ✅ **Cron Jobs** rodando automaticamente a cada 30 segundos
- ✅ **Credenciais** configuradas (Evolution API, Perplexity, Lovable AI)

---

## 🎯 Próximo Passo: Configurar Webhook na Evolution API

Para que o sistema funcione completamente, você precisa configurar o webhook na sua Evolution API.

### 📍 URL do Webhook

```
https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/handle-webhook
```

---

## 🛠️ Como Configurar (Passo a Passo)

### Opção 1: Via Painel Web da Evolution

1. **Acesse o painel da Evolution API**
2. **Navegue até a sua instância** (o nome que você configurou como `EVOLUTION_INSTANCE_NAME`)
3. **Procure por "Webhooks" ou "Configurações"**
4. **Configure o webhook:**
   - **URL**: `https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/handle-webhook`
   - **Evento**: `messages.upsert` (ou "Mensagens recebidas")
   - **Ativo**: `Sim`

### Opção 2: Via API da Evolution

Se você preferir configurar via API, use este comando:

```bash
curl -X POST \
  'https://SEU_SERVIDOR_EVOLUTION/webhook/set/SUA_INSTANCIA' \
  -H 'apikey: SUA_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "enabled": true,
    "url": "https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/handle-webhook",
    "events": ["messages.upsert"]
  }'
```

**Substitua:**
- `SEU_SERVIDOR_EVOLUTION` → URL do seu servidor Evolution
- `SUA_INSTANCIA` → Nome da sua instância
- `SUA_API_KEY` → Sua chave de API

---

## 🧪 Como Testar

### 1. Criar uma Análise

1. Acesse o Dashboard: `https://seu-app.lovable.app/dashboard`
2. Clique em **"Nova Análise"**
3. Preencha:
   - Nome da empresa (ou deixe vazio para pesquisar via Perplexity)
   - Telefone do concorrente
   - Persona (ex: "interested")
   - Profundidade (ex: "quick")
4. Clique em **"Criar Análise"**

### 2. O Que Vai Acontecer (Automaticamente)

**⏱️ 0-30 segundos:**
- Cron job detecta análise `pending`
- `process-analysis` é executada:
  - Pesquisa empresa no Perplexity (se necessário)
  - Gera estratégia de perguntas com IA
  - Envia primeira mensagem via Evolution
  - Status muda para `chatting`

**📱 Quando o concorrente responder:**
- Evolution envia webhook → `handle-webhook`
- Mensagem é salva no banco
- IA analisa resposta e decide próxima pergunta
- Envia próxima mensagem automaticamente
- Processo repete até acabar as perguntas

**✅ Quando a conversa terminar:**
- `generate-metrics` é chamada
- IA analisa conversa completa
- Gera métricas estruturadas
- Status muda para `completed`
- Frontend atualiza em tempo real

---

## 📊 Monitoramento e Debug

### Ver Logs das Edge Functions

1. Acesse: [Ver Backend](https://supabase.com/dashboard/project/ltjnbmvfjjphljcavrmp/functions)
2. Clique em cada função para ver logs em tempo real

### Ver Dados no Banco

1. Acesse: [Ver Tabelas](https://supabase.com/dashboard/project/ltjnbmvfjjphljcavrmp/editor)
2. Tabelas importantes:
   - `analysis_requests` - Ver status das análises
   - `conversation_messages` - Ver mensagens trocadas
   - `profiles` - Ver créditos dos usuários

### Verificar Cron Jobs

```sql
-- No SQL Editor do Supabase
SELECT * FROM cron.job;
```

---

## 🐛 Troubleshooting

### Webhook não está recebendo mensagens?

**Verificar:**
1. URL do webhook está correta?
2. Evento `messages.upsert` está habilitado?
3. Webhook está ativo na Evolution?

**Testar manualmente:**
```bash
curl -X POST \
  'https://ltjnbmvfjjphljcavrmp.supabase.co/functions/v1/handle-webhook' \
  -H 'Content-Type: application/json' \
  -d '{
    "instance": "SEU_INSTANCE_NAME",
    "data": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": false
      },
      "message": {
        "conversation": "Teste de mensagem"
      }
    }
  }'
```

### Análise fica "pending" para sempre?

**Verificar:**
1. Cron job está rodando? (ver SQL acima)
2. Credenciais da Evolution estão corretas?
3. Logs da `process-analysis` mostram algum erro?

### Mensagens não estão sendo enviadas?

**Verificar:**
1. `EVOLUTION_API_URL` está correto?
2. `EVOLUTION_API_KEY` está válido?
3. `EVOLUTION_INSTANCE_NAME` corresponde à instância ativa?

---

## 📝 Estrutura de Dados

### Payload que a Evolution deve enviar:

```json
{
  "event": "messages.upsert",
  "instance": "nome-da-sua-instancia",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "message-id-unico"
    },
    "message": {
      "conversation": "Texto da mensagem recebida"
    }
  }
}
```

### O que a Edge Function faz com esse payload:

1. Extrai número do telefone do `remoteJid`
2. Busca análise ativa para esse número
3. Salva mensagem no banco
4. Chama IA para decidir próxima pergunta
5. Envia resposta via Evolution
6. Se acabaram as perguntas → gera métricas

---

## 🎉 Pronto!

Assim que o webhook estiver configurado, o sistema vai funcionar 100% automaticamente! 🚀

**Fluxo completo:**
1. Usuário cria análise → Status `pending`
2. Cron job processa → Envia 1ª mensagem → `chatting`
3. Concorrente responde → Webhook → IA decide → Envia próxima
4. Repete até acabar perguntas → Gera métricas → `completed`
5. Frontend mostra análise completa em tempo real

**Dúvidas?** Verifique os logs das Edge Functions no painel do Supabase!
