# Macros 🥗

Tracker de macros e nutrição — rápido, bonito e 100% local (os dados nunca saem do teu dispositivo).

## Funcionalidades

- **Onboarding inteligente** — calcula BMR/TDEE com a equação de Mifflin-St Jeor e define alvos de calorias, proteína, hidratos e gordura conforme o objetivo (perder gordura, manter ou ganhar músculo).
- **Diário alimentar** — regista alimentos por refeição (pequeno-almoço, almoço, lanche, jantar, ceia) com navegação entre dias e totais de macros por refeição.
- **Open Food Facts 🇵🇹** — pesquisa em milhares de produtos à venda nos supermercados portugueses (Continente, Pingo Doce, Auchan, Lidl…), incluindo pesquisa por código de barras; a base local (~60 alimentos básicos) funciona offline.
- **Exercício** — regista calorias queimadas, que entram na fórmula do dia (consumido − exercício = líquido / meta).
- **Água** — meta diária (~35 ml/kg, ajustável) com registo rápido de +250/+500 ml.
- **Metas** — meta de calorias, repartição de macros com gráfico donut e edição da percentagem de cada macro.
- **Progresso semanal** — médias, dias no plano e gráfico das calorias dos últimos 7 dias com linha do alvo, tooltip e vista em tabela.
- **Perfil** — peso, TMB, IMC, meta de água, objetivo e nível de atividade; os alvos são recalculados automaticamente.
- **Design ao estilo iOS** — large titles, cartões "inset grouped", tab bar translúcida com blur e anéis de atividade à Apple Fitness; tema claro e escuro seguem o sistema.
- **PWA instalável** — no iPhone: Safari → Partilhar → "Adicionar ao ecrã principal" e abre em fullscreen como app nativa.
- **Persistência local** — tudo guardado em `localStorage`, sem contas nem servidores.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · Capacitor 8 (Android)

## Desenvolvimento

```bash
npm install
npm run dev       # servidor de desenvolvimento
npm run build     # typecheck + build de produção
npm run preview   # servir a build
```

## App Android

A mesma base de código corre como app nativa Android via [Capacitor](https://capacitorjs.com/):
os assets da web vão dentro do APK (arranca offline, sem esperar pela rede) e o
WebView serve-os em `https://localhost`.

**Isso torna a API cross-origin**, e daí sai quase toda a configuração abaixo:

- `VITE_API_ORIGIN` diz à build nativa onde vive a API. Sem ela usa-se o valor
  por omissão em `src/lib/native.ts`. **Tem de ser HTTPS** — os cookies de sessão
  saem com `SameSite=None`, que os browsers só aceitam com `Secure`.
- O backend reconhece a origem nativa (`NATIVE_ORIGINS`, por omissão
  `https://localhost`), aceita-a em CORS e no handshake do WebSocket, e só a
  essa responde com cookies `SameSite=None`. A web continua same-origin com
  `SameSite=lax` — a app instalada não afrouxa a proteção CSRF do site.
- O `MainActivity` liga os cookies third-party no WebView, senão o handshake do
  WebSocket saía sem cookie e levava 4401.

### Compilar

```bash
npm install
VITE_API_ORIGIN=https://macros.joaoazul.dev npm run build
npx cap sync android          # copia a build e actualiza os plugins
cd android && ./gradlew :app:assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Instalar no telemóvel com `adb install -r <apk>`, ou abrir o projeto no Android
Studio (`npx cap open android`). Repetir `npm run build && npx cap sync android`
sempre que o código web mudar.

O workflow `.github/workflows/android.yml` compila o APK de debug a cada push e
publica-o como artefacto — útil por não precisar do SDK instalado localmente.
Define a variável `VITE_API_ORIGIN` em **Settings → Secrets and variables →
Actions → Variables** para apontar à tua API.

### Release para a Play Store

```bash
keytool -genkey -v -keystore macros.keystore -alias macros -keyalg RSA -validity 10000
cd android && ./gradlew :app:bundleRelease   # → .aab para a Play Store
```

Configura a assinatura em `android/app/build.gradle` (ou em
`capacitor.config.ts`, chave `android.buildOptions`) e **não versiones o
keystore nem as passwords**.

### O que muda no nativo

| | Web | Android |
| --- | --- | --- |
| Assets | servidos pelo nginx | dentro do APK |
| API | same-origin (`/api`) | `VITE_API_ORIGIN`, cookies cross-site |
| Notificações | Web Push (service worker) | notificações locais agendadas no dispositivo |
| Guardar exportação GDPR | download do browser | escreve no cache e abre a folha de partilha |
| Haptics | `navigator.vibrate` | motor de haptics do Android |
| Voltar | histórico do browser | botão voltar → separador Diário → minimiza |
| Arranque | landing de marketing | vai directo para `/app` |

O service worker não é registado no APK: não há Push API dentro do WebView e os
assets já são locais. Por isso os lembretes passam a notificações locais — as
horas continuam a ser as que estão guardadas no servidor (`src/lib/reminders.ts`
espelha-as para o dispositivo), mas tocam sem depender de rede.

### Ícones e splash

`assets/` é gerado a partir do ícone da PWA por
`node scripts/generate-android-assets.mjs`; os recursos Android saem daí com
`npx capacitor-assets generate --android`.

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

android/            # projeto nativo (Capacitor) — gerado, versionado
assets/             # arte-fonte dos ícones e splash do Android
capacitor.config.ts # id da app, webDir e configuração dos plugins nativos
```

No `src/lib/`, o que é específico do nativo:

```
native.ts             # detecção de plataforma e origem da API
nativeShell.ts        # botão voltar, status bar, splash, haptics, links externos
nativeNotifications.ts# lembretes como notificações locais
download.ts           # guardar ficheiros (download na web, partilha no Android)
```
