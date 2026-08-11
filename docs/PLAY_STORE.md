# Publicar a Macros na Google Play

O APK já compila (ver secção Android do README). Falta assinar, preencher a
ficha da loja e passar o período de teste fechado que a Google exige a contas
novas de particular.

As regras da Play Console mudam com alguma frequência — o que está aqui
confere com o que a consola pede hoje, mas segue sempre o que ela te disser à
frente se divergir.

---

## Antes de começares: duas decisões que não dão para desfazer

**1. O `applicationId` é permanente.** Está em `android/app/build.gradle` como
`dev.joaoazul.macros`. Depois do primeiro upload nunca mais muda — mudá-lo
significa uma app nova na loja, sem os utilizadores nem as avaliações. Se
quiseres outro nome, é **agora**.

**2. A keystore é a tua identidade.** Se a perderes deixas de conseguir
actualizar a app. Guarda o ficheiro e as passwords num gestor de passwords, com
cópia noutro sítio. (Com o Play App Signing ligado — recomendado, ponto 5 — a
Google consegue ajudar a recuperar; sem ele, perder a keystore é definitivo.)

---

## 1. Conta de programador — 25 USD, uma vez

<https://play.google.com/console> → criar conta **de particular**. Pagamento
único de 25 USD e verificação de identidade com documento. A verificação pode
demorar uns dias, por isso trata disto primeiro.

## 2. Gerar a keystore

```bash
cd android
keytool -genkey -v -keystore macros.keystore \
  -alias macros -keyalg RSA -keysize 2048 -validity 10000
```

Pede-te uma password e alguns dados (nome, organização — podes usar o teu
nome). `-validity 10000` são ~27 anos: a Google exige uma validade que vá além
de 2033.

O `.gitignore` já ignora `*.keystore` e `keystore.properties`. **Confirma com
`git status` que nenhum dos dois aparece antes de fazeres commit.**

## 3. Configurar a assinatura

Cria `android/keystore.properties` (fica fora do git):

```properties
storeFile=macros.keystore
storePassword=<a password da keystore>
keyAlias=macros
keyPassword=<a password da chave>
```

O `build.gradle` lê este ficheiro ou, se não existir, as variáveis de ambiente
`ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e
`ANDROID_KEY_PASSWORD` — é assim que a CI assina sem segredos no repositório.

## 4. Gerar o AAB

A Play Store recebe `.aab` (App Bundle), não `.apk`.

```bash
VITE_API_ORIGIN=https://macros.joaoazul.dev npm run build
npx cap sync android
cd android && ./gradlew :app:bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

Antes de subir, instala uma build de release no teu telemóvel e usa-a a sério
durante um bocado — a de debug não apanha problemas de assinatura nem de
minificação.

**Alternativa sem SDK local:** o workflow `Android` no GitHub tem um job
`release` que faz isto por ti. Põe estes secrets em *Settings → Secrets and
variables → Actions*:

| Secret | Valor |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 android/macros.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | password da keystore |
| `ANDROID_KEY_ALIAS` | `macros` |
| `ANDROID_KEY_PASSWORD` | password da chave |

E a variável `VITE_API_ORIGIN` em *Variables*. Depois corre o workflow à mão
(*Actions → Android → Run workflow*) e descarrega o artefacto `macros-release-aab`.

## 5. Criar a app na consola

*Criar app* → nome, idioma principal **Português (Portugal)**, tipo **App**,
gratuita.

Aceita o **Play App Signing** quando aparecer. A Google passa a guardar a chave
final de assinatura e a tua keystore passa a ser só a de upload — o que
significa que uma keystore perdida deixa de ser fatal.

## 6. Ficha da loja

Precisas de produzir três coisas que ainda não existem no repositório:

| Peça | Formato | Onde arranjar |
| --- | --- | --- |
| Ícone | 512×512 PNG | `assets/icon.png` já é 1024 — redimensiona |
| Gráfico de destaque | 1024×500 PNG | é preciso desenhar |
| Capturas de ecrã | mín. 2, 9:16, ≥1080px de largura | tirar no telemóvel |

Sugestão para as capturas: Diário, Metas com o donut, Progresso com o gráfico
semanal, e o Social. São o que distingue a app.

A descrição pode sair da lista de funcionalidades do README.

## 7. Declarações obrigatórias

Esta parte é a que costuma travar as submissões. A app tem contas e dados de
saúde, por isso nada aqui é opcional.

- **Política de privacidade** — a consola pede um URL público.
  Já tens: `https://macros.joaoazul.dev/privacidade`.
- **Eliminação de conta** — para apps com contas, a Google exige um caminho
  para apagar a conta *e* um URL onde isso se pede de fora da app. A
  eliminação já existe no Perfil; falta apontar-lhes o URL.
- **Segurança dos dados** (*Data safety*) — declara o que recolhes e porquê.
  No teu caso: email e nome (conta), peso/altura/data de nascimento e registos
  alimentares (**dados de saúde e forma física** — categoria sensível), e o que
  o Stripe recolhe para pagamentos. Diz que os dados vão cifrados em trânsito e
  que podem ser apagados.
- **Classificação de conteúdo** — questionário; uma app de nutrição fica em
  *Todos*.
- **Público-alvo** — escolhe faixas de adultos. Se marcares que se destina a
  crianças entram regras muito mais apertadas.
- **App de saúde** — pode aparecer um formulário extra por registares dados de
  saúde. Responde que não dás aconselhamento médico.

## 8. Teste fechado — o passo que demora

Contas de programador **de particular** criadas depois de Novembro de 2023 têm
de correr um teste fechado com **pelo menos 12 testers** que fiquem inscritos
**14 dias seguidos** antes de poderem pedir acesso à produção.

Não há atalho, e é a razão pela qual isto leva semanas em vez de dias. Começa
já:

1. *Testes → Teste fechado* → criar versão, subir o AAB.
2. Criar uma lista de emails com os 12+ testers (contas Google reais).
3. Partilhar o link de adesão e confirmar que **entram mesmo** — quem não
   aceitar o convite não conta.
4. Passados os 14 dias aparece o botão para pedir acesso à produção. A revisão
   demora tipicamente alguns dias.

Enquanto isso corre, usa o teste interno (até 100 testers, sem espera) para as
tuas próprias iterações.

## 9. Produção

Aprovado o acesso, promove a versão para produção. A partir daí cada
actualização é: subir o `versionCode` (a CI usa o número da execução), gerar
AAB, subir, esperar revisão.

---

## Antes de submeteres: o que falta na app

Duas coisas que valem mais do que qualquer polimento da ficha da loja.

**Push do servidor (FCM).** As mensagens e notificações sociais chegam por
WebSocket, que só existe com a app aberta — com a app em segundo plano não
chega nada. Os lembretes já tocam localmente, mas o resto não. Falta
`@capacitor/push-notifications` com um projecto Firebase e o
`google-services.json` (o `build.gradle` já o aplica sozinho se o ficheiro
existir). É cerca de um dia de trabalho e é a maior lacuna funcional da versão
Android.

**Testar num telemóvel a sério.** Nada nesta conversão foi corrido em
hardware — o SDK do Android está bloqueado no ambiente onde foi feita. Vale a
pena verificar, por ordem de risco:

1. Login e sessão — é o que depende dos cookies cross-site e é o que mais
   provavelmente falha. Confirma também que a sessão sobrevive a fechar e
   reabrir a app.
2. Chat em tempo real — valida o handshake do WebSocket com os cookies
   third-party.
3. Leitor de códigos de barras — pedido de permissão da câmara.
4. Botão voltar, teclado no chat, e a splash a não piscar branco.
5. Scroll do diário e do chat num telemóvel de gama média (o WebView é o que
   mais se nota aqui).

---

## Depois: iOS

O trabalho pesado — API cross-origin, cookies, notificações, botão voltar — já
está feito e não é específico do Android. Para iOS é `npx cap add ios`, mais a
conta de programador da Apple (99 USD/ano) e o `https://capacitor.localhost`
acrescentado ao `NATIVE_ORIGINS` no backend.
