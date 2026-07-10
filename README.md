# Macros 🥗

Tracker de macros e nutrição — rápido, bonito e 100% local (os dados nunca saem do teu dispositivo).

## Funcionalidades

- **Onboarding inteligente** — calcula BMR/TDEE com a equação de Mifflin-St Jeor e define alvos de calorias, proteína, hidratos e gordura conforme o objetivo (perder gordura, manter ou ganhar músculo).
- **Diário alimentar** — regista alimentos por refeição (pequeno-almoço, almoço, lanche, jantar, ceia) com navegação entre dias e totais de macros por refeição.
- **Open Food Facts 🇵🇹** — pesquisa em milhares de produtos à venda nos supermercados portugueses (Continente, Pingo Doce, Auchan, Lidl…); a base local (~60 alimentos básicos) funciona offline.
- **Leitor de códigos de barras** — lê o código com a câmara (ZXing, carregado sob demanda) e vai buscar o produto ao Open Food Facts; também aceita códigos escritos à mão.
- **Favoritos e recentes** — marca alimentos com ⭐ e reutiliza os últimos registados sem pesquisar.
- **Análise de prato por IA 📸** — tira uma foto e a API da Claude (Anthropic) estima alimentos, porções e macros; revês e ajustas antes de registar. Requer chave API própria (guardada só no dispositivo, configurável no Perfil).
- **Peso ao longo do tempo** — cada atualização de peso fica registada; gráfico de tendência no Progresso.
- **Copiar dia anterior** — repete as refeições de ontem com um toque em dias vazios.
- **Exportar dados** — diário em CSV (para folha de cálculo) ou tudo em JSON (backup), a partir do Perfil.
- **Lembretes de água** — notificações a cada 2 h (9h–21h) com a app aberta, se estiveres abaixo da meta.
- **Guia de nutrição e Sobre** — mini-artigos (macros, proteína, défice/superavit, rótulos, hidratação) e informação da app no Perfil.
- **Exercício** — regista calorias queimadas, que entram na fórmula do dia (consumido − exercício = líquido / meta).
- **Água** — meta diária (~35 ml/kg, ajustável) com registo rápido de +250/+500 ml.
- **Metas** — meta de calorias, repartição de macros com gráfico donut e edição da percentagem de cada macro.
- **Progresso semanal** — médias, dias no plano e gráfico das calorias dos últimos 7 dias com linha do alvo, tooltip e vista em tabela.
- **Perfil** — peso, TMB, IMC, meta de água, objetivo e nível de atividade; os alvos são recalculados automaticamente.
- **Design ao estilo iOS** — large titles, cartões "inset grouped", tab bar translúcida com blur e anéis de atividade à Apple Fitness; tema claro e escuro seguem o sistema.
- **PWA instalável** — no iPhone: Safari → Partilhar → "Adicionar ao ecrã principal" e abre em fullscreen como app nativa.
- **Persistência local** — tudo guardado em `localStorage`, sem contas nem servidores.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4

## Desenvolvimento

```bash
npm install
npm run dev       # servidor de desenvolvimento
npm run build     # typecheck + build de produção
npm run preview   # servir a build
```

## Contas e sincronização (opcional)

O backend em `server/` (Node 22+, SQLite embutido, sem dependências nativas) dá
contas por email/password e sincronização entre dispositivos. A app continua
offline-first — sem conta funciona igual; com conta, o diário sincroniza
dia-a-dia com last-write-wins.

No VPS:

```bash
cd /opt/macros/server && npm ci
sudo cp ../deploy/macros-api.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now macros-api
```

E no Caddyfile, dentro do bloco do site, antes do `file_server`:

```
handle /api/* {
    reverse_proxy 127.0.0.1:8787
}
```

(nginx: `location /api/ { proxy_pass http://127.0.0.1:8787; }`)

## Deploy

### VPS (nginx, um comando)

No VPS (Debian/Ubuntu), primeira instalação e atualizações:

```bash
git clone https://github.com/joaaoazul/macros.git && cd macros   # primeira vez
sudo bash deploy/setup-vps.sh
```

Instala nginx + node se faltarem, faz build e publica em `/var/www/macros`.
Com domínio: edita `server_name` em `/etc/nginx/sites-available/macros` e corre
`sudo certbot --nginx -d oteu.dominio.pt` para HTTPS.

### VPS com deploy automático (GitHub Actions)

O workflow `.github/workflows/deploy-vps.yml` envia a build para o VPS a cada
push ao `main`. Configura os secrets `VPS_HOST`, `VPS_USER` e `VPS_SSH_KEY`
(opcional: `VPS_PORT`, `VPS_PATH`) em **Settings → Secrets and variables →
Actions**. Sem secrets, o workflow não faz nada.

### Docker

```bash
docker compose up -d --build   # fica em http://<ip>:8080
```

### GitHub Pages

O workflow `.github/workflows/deploy.yml` publica no Pages a cada push ao
`main`. Ativa uma vez em **Settings → Pages → Source: GitHub Actions**;
a app fica em `https://<utilizador>.github.io/macros/`.

## Estrutura

```
src/
  lib/
    calc.ts      # BMR/TDEE, alvos de macros, somas do diário
    foods.ts     # base de dados local de alimentos + pesquisa
    off.ts       # cliente Open Food Facts (pt.openfoodfacts.org)
    store.ts     # persistência em localStorage e utilitários de datas
  components/
    Onboarding.tsx    # fluxo inicial em 4 passos
    Diario.tsx        # diário do dia, resumo, água e exercício
    AddFoodSheet.tsx  # pesquisa local + OFF, quantidades, alimentos personalizados
    Metas.tsx         # metas de calorias e repartição de macros (donut)
    Rings.tsx         # anéis de atividade concêntricos em SVG
    ui.tsx            # peças iOS partilhadas (large title, cartões, ícones)
    Progresso.tsx     # estatísticas e gráfico semanal
    Perfil.tsx        # peso, TMB, IMC, água, objetivo e atividade

```
