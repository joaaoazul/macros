# Ligar o Stripe em produção (conta particular)

O código está completo e **fail-open**: sem `STRIPE_SECRET_KEY` o billing fica
desligado e toda a gente tem acesso. Ligar o Stripe é só configuração — passos
por ordem, ~20 minutos.

## 1. Criar os produtos e preços (dashboard.stripe.com)

1. Products → Add product: **Macros** (um só produto).
2. Adicionar dois preços recorrentes:
   - **Mensal**: 3,99 € / month
   - **Anual**: 29,99 € / year
3. Guardar os dois `price_...` IDs.

Impostos (particular em Portugal): ativa o **Stripe Tax** no dashboard (Settings
→ Tax) e marca os preços como "tax inclusive" para o preço mostrado ser final.

## 2. Registar o webhook

Developers → Webhooks → Add endpoint:

- URL: `https://macros.joaoazul.dev/api/v1/billing/webhook`
- Eventos: `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_failed`
- Guardar o **signing secret** (`whsec_...`).

## 3. Configurar o VPS

No `~/macros/.env` do VPS (as chaves live `sk_live_...`):

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL=price_...
```

Depois: `docker compose up -d --build` (ou só `docker compose restart backend`).

## 4. Contas antigas (IMPORTANTE — fazer ANTES de anunciar)

Contas criadas antes do billing têm `subscription_status='none'` e **cairiam no
paywall imediatamente** ao ligar o Stripe. Escolher por conta: dar comp
(grátis vitalício, amigos) ou um trial novo de 14 dias.

```bash
ssh joa0bananas@157.90.113.98
cd ~/macros
# comped a TODAS as contas existentes até hoje (amigos):
docker compose exec db psql -U macros -d macros -c \
  "UPDATE users SET comped = true WHERE subscription_status = 'none';"
# OU: trial novo de 14 dias em vez de comp:
docker compose exec db psql -U macros -d macros -c \
  "UPDATE users SET subscription_status='trialing', trial_ends_at = now() + interval '14 days' WHERE subscription_status = 'none';"
```

(Confirmar o nome do user/db do Postgres no `docker-compose.yml` se diferirem.)

## 5. Testar

1. Antes do live, testa com chaves `sk_test_...` + cartão `4242 4242 4242 4242`.
2. Regista uma conta nova → banner de trial visível.
3. "Ver planos" → checkout → pagar → volta à app com acesso; no Stripe o
   customer aparece com a subscrição ativa.
4. Perfil → "Gerir subscrição" abre o portal do Stripe.
5. Cancela no portal → no fim do período o acesso fecha (webhook
   `customer.subscription.deleted`).

## Notas

- O webhook é assinado e idempotente; reenvios do Stripe são seguros.
- Convites (SOC → Convites) dão contas comped — não passam pelo Stripe.
- Os Termos/Privacidade já cobrem a subscrição, Stripe e o direito de
  desistência UE (atualizados 2026-07-22).
