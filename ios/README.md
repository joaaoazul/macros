# Macros — iOS nativo (SwiftUI)

Porte nativo (Swift/SwiftUI) da app web em `../src`, focado no núcleo de
tracking de macros: onboarding, diário alimentar, metas, água, exercício,
progresso semanal e perfil. **100% local** — sem backend, sem conta, sem
rede: os dados ficam só no dispositivo (`UserDefaults`, como JSON), tal como
a versão original da app antes do backend/social terem sido adicionados.

Fora do âmbito desta conversão (ver secção "O que não foi portado" abaixo):
Social, Receitas/Planeador de refeições, Despensa/Lista de compras, Open
Food Facts / código de barras, Billing/Paywall, notificações push, análise
de refeições por IA e a consola de administração — todas dependem do
backend FastAPI em `../backend` ou de serviços externos.

## Abrir e correr

Requisitos: macOS com Xcode 15+ (iOS 17 SDK).

```bash
open ios/Macros/Macros.xcodeproj
```

Escolhe um simulador de iPhone e corre (⌘R). Não há dependências externas
(SPM, CocoaPods) — só SwiftUI + Swift Charts (framework do sistema).

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
      AppStore.swift         — estado observável + persistência local (≈ usePersistedState)
    Views/
      OnboardingView.swift   — assistente em 4 passos (≈ Onboarding.tsx)
      DiarioView.swift       — diário do dia, água, exercício (≈ Diario.tsx)
      MetasView.swift        — metas de calorias/macros + donut (≈ Metas.tsx)
      ProgressoView.swift    — estatísticas + gráfico (Swift Charts) (≈ Progresso.tsx)
      PerfilView.swift       — corpo, TMB/IMC, objetivo, atividade (≈ Perfil.tsx, simplificado)
      ContentView.swift      — TabView principal
      Components/            — Card, LargeTitleHeader, RingsView, tema de cores…
      Sheets/AddFoodSheet.swift — pesquisa + quantidade + alimento personalizado
    Assets.xcassets/, Preview Content/
  generate_project.py
```

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

## O que não foi portado (fora do âmbito acordado)

Tudo o que depende do backend (`../backend`, FastAPI) ou de serviços
externos ficou de fora desta primeira conversão:

- **Conta/autenticação, sincronização entre dispositivos** — a app web usa
  login + Postgres; esta app iOS é local-only (como o `localStorage`
  original, antes da conta existir).
- **Social** (feed, amigos, chat, badges, leaderboard) e **Receitas /
  Planeador semanal / Despensa / Lista de compras**.
- **Open Food Facts e leitura de código de barras** — só a base de dados
  local está disponível; criar um alimento novo é manual.
- **Billing/Paywall**, **notificações push**, **análise de refeições por
  IA** e a **consola de administração**.
- Funcionalidades avançadas do diário web (seleção múltipla, copiar
  dia/refeição, guardar como receita, check-in do plano) e o histórico
  detalhado de peso/água (`PesoDetail`/`AguaDetail`) ficaram simplificados
  a favor de um diário direto (registar, ver, apagar).

`PerfilView` troca as secções ligadas a conta/backend por duas ações locais:
exportar todos os dados em JSON (partilha nativa) e repor tudo.
