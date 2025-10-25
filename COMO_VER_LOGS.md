# 🔍 Como Ver Logs Detalhados do Sistema

## Opção 1: Via Supabase CLI (RECOMENDADO - Logs em Tempo Real)

```bash
# 1. Instalar Supabase CLI (se ainda não tiver)
brew install supabase/tap/supabase

# 2. Fazer login
supabase login

# 3. Ver logs em tempo real (MELHOR OPÇÃO)
supabase functions logs monitor-conversations --project-ref ltjnbmvfjjphljcavrmp

# Ou ver logs de todas as functions
supabase functions logs --project-ref ltjnbmvfjjphljcavrmp
```

## Opção 2: Via Dashboard do Supabase

1. Acesse: https://supabase.com/dashboard/project/ltjnbmvfjjphljcavrmp/logs/edge-functions
2. Clique em um request individual (ex: `monitor-conversations`)
3. Na tela que abre, procure por:
   - **"Logs"** tab
   - **"Output"** section
4. Lá você verá todos os console.logs:
   - ========== MONITOR INVOCADO ==========
   - 🛑🛑🛑 JANELA ATIVA DETECTADA!
   - ✂️ QUEBRANDO RESPOSTA EM X CHUNK(S)
   - etc.

## O Que Procurar nos Logs:

### 🚨 Problema de Agrupamento:
Procure por:
```
🛑🛑🛑 JANELA ATIVA DETECTADA!
   RETORNANDO SEM PROCESSAR
```

Se isso NÃO aparecer quando você envia a 2ª mensagem, o problema está na verificação de janela.

### ✅ Agrupamento Funcionando:
Você deve ver:
```
✅✅✅ PROCESSANDO 2 MENSAGENS AGRUPADAS
   1. [id] "Sim" (criada em: ...)
   2. [id] "Oque precisa" (criada em: ...)
```

### ✂️ Quebra de Mensagens:
```
✂️ QUEBRANDO RESPOSTA EM 2 CHUNK(S):
   Chunk 1: "primeira parte..."
   Chunk 2: "segunda parte..."
```

## 🎯 Teste Rápido:

1. Execute: `supabase functions logs monitor-conversations --project-ref ltjnbmvfjjphljcavrmp`
2. Deixe rodando
3. Envie 2 mensagens seguidas no WhatsApp
4. Veja os logs aparecerem em tempo real!
