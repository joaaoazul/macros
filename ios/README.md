# Macros — iOS nativo (SwiftUI)

Porte nativo (Swift/SwiftUI) da app web em `../src`, focado no núcleo de
tracking de macros: conta (login/registo), onboarding, diário alimentar,
metas, água, exercício, progresso semanal e perfil. Fala com o **mesmo
backend FastAPI** (`../backend`) da app web — os dados ficam na conta,
sincronizados como no browser — mas guarda sempre uma cópia local
(`UserDefaults`, como JSON) para a app continuar utilizável offline.

Fora do âmbito desta conversão (ver secção "O que não foi portado" abaixo):
Social, Receitas/Planeador de refeições, Despensa/Lista de compras, Open
Food Facts / código de barras, Billing/Paywall, notificações push, análise
de refeições por IA e a consola de administração.

## Abrir e correr

Requisitos: macOS com Xcode 15+ (iOS 17 SDK) e o backend a correr algures
acessível (produção `https://macros.joaoazul.dev`, ou local — ver
`../backend/README`/`../README.md`).

```bash
open ios/Macros/Macros.xcodeproj
```

Escolhe um simulador de iPhone e corre (⌘R). Não há dependências externas
(SPM, CocoaPods) — só SwiftUI + Swift Charts (framework do sistema).

Por omissão a app aponta para `https://macros.joaoazul.dev`
(`Networking/APIClient.swift`). No ecrã de login, "Servidor avançado…"
deixa apontar para outro backend (ex.: `http://localhost:8000` a correr
no Mac, ao testar no simulador — o simulador partilha a rede do Mac, e
ligações a `localhost` ficam isentas de App Transport Security).

Se adicionares ou remover ficheiros `.swift`/`.xcassets`, corre outra vez o
gerador do projeto (só é preciso quando a *lista* de ficheiros muda, não
quando editas conteúdo):

```bash
python3 ios/Macros/generate_project.py
```

> Porquê um gerador em vez do `.xcodeproj` feito no Xcode? Este ambiente não
> tem Xcode/macOS disponível para gerar o projeto da forma normal. O script
> escreve um `project.pbxproj` válido a partir da árvore de ficheiros; os UUIDs
> são determinísticos (derivados do caminho), por isso correr de novo é
> idempotente e não gera diffs de churn.

## Estrutura

```
ios/Macros/
  Macros.xcodeproj/
  Macros/
    MacrosApp.swift          — ponto de entrada (@main)
    Models/Models.swift      — Profile, Food, Entry, Exercise, Targets… (≈ src/types.ts)
    Lib/
      Calc.swift             — BMR/TDEE, alvos de macros (≈ src/lib/calc.ts)
      Limits.swift           — limites das métricas corporais (≈ src/lib/limits.ts)
      DateUtils.swift        — utilitários de data (≈ parte de src/lib/store.ts)
      FoodDatabase.swift     — base de ~100 alimentos PT + pesquisa (≈ src/lib/foods.ts)
      AppStore.swift         — estado observável + persistência local + sync (≈ usePersistedState/useSyncedData)
    Networking/
      APIClient.swift        — cliente HTTP (cookies HttpOnly, CSRF header) (≈ src/lib/api.ts)
      AuthModels.swift       — pedidos/respostas de auth (≈ backend/app/auth/schemas.py)
      AuthService.swift      — sessão (register/login/logout/me) (≈ src/lib/auth.tsx)
      DataModels.swift       — payloads de sincronização (≈ backend/app/data/schemas.py)
    Views/
      RootView.swift         — sessão → dados da conta/migração → app (≈ topo de App.tsx)
      Auth/AuthFlowView.swift — login/registo (≈ src/pages/Login.tsx, Registo.tsx)
      OnboardingView.swift   — assistente em 4 passos (≈ Onboarding.tsx)
      DiarioView.swift       — diário do dia, água, exercício (≈ Diario.tsx)
      MetasView.swift        — metas de calorias/macros + donut (≈ Metas.tsx)
      ProgressoView.swift    — estatísticas + gráfico (Swift Charts) (≈ Progresso.tsx)
      PerfilView.swift       — corpo, TMB/IMC, objetivo, atividade, conta (≈ Perfil.tsx, simplificado)
      ContentView.swift      — TabView principal
      Components/            — Card, LargeTitleHeader, RingsView, tema de cores…
      Sheets/AddFoodSheet.swift — pesquisa + quantidade + alimento personalizado
    Assets.xcassets/, Preview Content/
  generate_project.py
```

## Conta e sincronização

- **Sessão por cookies HttpOnly**, tal como o browser — `APIClient` usa o
  `HTTPCookieStorage` do `URLSession`, sem tokens manuais. Os pedidos que
  mudam estado levam o header `X-Requested-With: fetch` (o mesmo CSRF
  belt-and-braces do backend).
- **Ao autenticar**, a app traz os dados da conta (`GET /data/all`). Se a
  conta ainda estiver vazia mas já houver dados guardados neste dispositivo
  (uso antes de teres conta), oferece importá-los — equivalente nativo do
  `migrationAvailable`/`importLocalData` do `App.tsx`.
- **Cada alteração** (perfil, entradas do diário, água, exercício,
  alimentos pessoais) grava sempre localmente primeiro e depois tenta
  sincronizar com o backend em segundo plano (melhor esforço — falha em
  silêncio sem ligação; a cópia local é sempre a fonte de verdade no
  dispositivo). Não há fila de reenvio nem resolução de conflitos: é o
  mesmo modelo "o servidor ganha, localStorage cai para trás" da app web,
  sem código extra para casos de conflito entre dispositivos.
- **Billing**: o backend tranca `/data/*` atrás de `require_access`
  (trial/subscrição). Sem `STRIPE_SECRET_KEY` configurado no backend,
  `has_access` deixa sempre passar (fail-open) — não há paywall nativo
  nesta app; um 402 do servidor aparece só como erro genérico.

## Paridade com a app web

Portado tal e qual (mesmas fórmulas e mesmos dados):

- Cálculo de BMR/TDEE (Mifflin-St Jeor e Katch-McArdle), alvos de
  calorias/macros e meta de água.
- Base de dados local de ~100 alimentos comuns em Portugal, com pesquisa
  sem acentos e ordenação por uso.
- Diário por refeição (madrugada/pequeno-almoço/almoço/lanche/jantar/ceia),
  navegação entre dias, registo de água e exercício.
- Anéis de atividade (hidratos/proteína/gordura) e donut de repartição de
  macros.
- Progresso: aderência ao plano, streak, atingimento médio por macro,
  calendário e gráfico de barras dos últimos 7/14/30 dias.
- Alimentos personalizados e medidas caseiras (porções) por alimento.
- Conta (registo/login/logout) e sincronização com o backend, incluindo a
  migração de dados locais para a conta.

## O que não foi portado (fora do âmbito acordado)

- **Social** (feed, amigos, chat, badges, leaderboard) e **Receitas /
  Planeador semanal / Despensa / Lista de compras**.
- **Open Food Facts e leitura de código de barras** — só a base de dados
  local está disponível; criar um alimento novo é manual.
- **Billing/Paywall** (ver nota acima), **notificações push**, **análise de
  refeições por IA** e a **consola de administração**.
- Verificação de email, "esqueci-me da password" e eliminação de conta
  (GDPR) — o backend já os expõe, mas não têm ecrã nesta app.
- Funcionalidades avançadas do diário web (seleção múltipla, copiar
  dia/refeição, guardar como receita, check-in do plano) e o histórico
  detalhado de peso/água (`PesoDetail`/`AguaDetail`) ficaram simplificados
  a favor de um diário direto (registar, ver, apagar).

`PerfilView` mostra o email da conta e "Terminar sessão" (limpa só a cópia
local; os dados continuam na conta), mais "Exportar os meus dados (JSON)"
como cópia de segurança local.
