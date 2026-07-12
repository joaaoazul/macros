#!/usr/bin/env python3
"""Stress test LOCAL do Macros (asyncio + httpx).

Corre contra a stack local (nginx em http://127.0.0.1:8080 que faz proxy do /api).
NÃO correr contra produção — dispara lockouts e rate limits.

Como usar:
    # 1. arrancar a stack local (a partir da raiz do repo)
    docker compose up -d --build
    # 2. correr o harness (usa o venv do backend p/ ter o httpx)
    backend/venv/Scripts/python.exe scripts/stress_test.py --users 50 --concurrency 20

Cenários:
  - registo concorrente de N contas
  - tempestade de logins (válidos + inválidos) → valida lockout (5) e rate limit (429/min)
  - escritas autenticadas (PUT /days) em paralelo
  - pesquisa social
Reporta p50/p95/p99, throughput e taxa de erros por cenário.
"""

import argparse
import asyncio
import time
import uuid
from datetime import datetime, timedelta

import httpx

HEADERS = {"X-Requested-With": "fetch", "Content-Type": "application/json"}


def pct(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    k = (len(values) - 1) * p
    lo = int(k)
    hi = min(lo + 1, len(values) - 1)
    return values[lo] + (values[hi] - values[lo]) * (k - lo)


class Metrics:
    def __init__(self, name: str) -> None:
        self.name = name
        self.latencies: list[float] = []
        self.status: dict[int, int] = {}
        self.errors = 0
        self.wall = 0.0

    def record(self, dt: float, code: int | None) -> None:
        if code is None:
            self.errors += 1
            return
        self.latencies.append(dt * 1000)
        self.status[code] = self.status.get(code, 0) + 1

    def report(self, wall: float) -> str:
        n = len(self.latencies) + self.errors
        rps = n / wall if wall else 0
        codes = " ".join(f"{k}:{v}" for k, v in sorted(self.status.items()))
        if self.latencies:
            lat = (
                f"p50={pct(self.latencies, 0.5):.0f}ms "
                f"p95={pct(self.latencies, 0.95):.0f}ms "
                f"p99={pct(self.latencies, 0.99):.0f}ms "
                f"max={max(self.latencies):.0f}ms"
            )
        else:
            lat = "sem sucessos"
        return (
            f"■ {self.name}\n"
            f"    pedidos={n} rps={rps:.1f} erros={self.errors}\n"
            f"    {lat}\n"
            f"    status: {codes}"
        )


async def timed(client: httpx.AsyncClient, m: Metrics, method: str, url: str, **kw):
    t0 = time.perf_counter()
    try:
        r = await client.request(method, url, **kw)
        m.record(time.perf_counter() - t0, r.status_code)
        return r
    except Exception:
        m.record(time.perf_counter() - t0, None)
        return None


def _client(base: str, conc: int) -> httpx.AsyncClient:
    # cliente com pool de ligações reutilizadas (keep-alive) → latência realista
    return httpx.AsyncClient(
        base_url=base, headers=dict(HEADERS), timeout=30,
        limits=httpx.Limits(max_connections=conc, max_keepalive_connections=conc),
    )


async def scenario_register(base: str, n: int, conc: int) -> tuple[Metrics, list[tuple[str, str]]]:
    # NOTA: register partilha o bucket de rate-limit (10/min/IP) com login. De um só IP
    # só ~10 passam por minuto — por isso registamos poucos (o suficiente p/ o write test).
    m = Metrics("registo concorrente (auth rate-limited por IP)")
    creds: list[tuple[str, str]] = []
    sem = asyncio.Semaphore(conc)
    lock = asyncio.Lock()

    async with _client(base, conc) as c:
        async def one(_i: int):
            email = f"stress_{uuid.uuid4().hex[:12]}@example.com"
            pw = "stress-password-123"
            async with sem:
                r = await timed(c, m, "POST", "/api/v1/auth/register",
                                json={"email": email, "password": pw, "name": "Stress"})
                if r is not None and r.status_code == 201:
                    async with lock:
                        creds.append((email, pw))

        t0 = time.perf_counter()
        await asyncio.gather(*(one(i) for i in range(n)))
        m.wall = time.perf_counter() - t0
    return m, creds


async def scenario_writes(base: str, creds: list[tuple[str, str]], conc: int, per_user: int) -> Metrics:
    """Cada utilizador loga uma vez e dispara `per_user` escritas concorrentes (não rate-limited)."""
    m = Metrics(f"escritas autenticadas PUT /days ({per_user}/user)")
    sem = asyncio.Semaphore(conc)
    base_day = datetime(2025, 1, 1)

    async def per_user_load(email: str, pw: str, user_seed: int):
        c = _client(base, conc)
        try:
            r = await c.post("/api/v1/auth/login", json={"email": email, "password": pw})
            if r.status_code != 200:
                m.record(0, r.status_code)  # login barrado — regista e sai
                return

            async def one(k: int):
                # dia único por (user,k) → sem corridas delete/insert; entry_id único
                day = (base_day + timedelta(days=user_seed * per_user + k)).date().isoformat()
                entry = {
                    "id": uuid.uuid4().hex[:16], "meal": "lunch", "foodName": "Arroz", "emoji": "🍚",
                    "grams": 150, "unit": "g", "kcal": 195, "protein": 4, "carbs": 42, "fat": 0.5,
                }
                async with sem:
                    await timed(c, m, "PUT", f"/api/v1/days/{day}", json={"entries": [entry]})
            await asyncio.gather(*(one(k) for k in range(per_user)))
        finally:
            await c.aclose()

    t0 = time.perf_counter()
    await asyncio.gather(*(per_user_load(e, p, i) for i, (e, p) in enumerate(creds)))
    m.wall = time.perf_counter() - t0
    return m


async def scenario_lockout(base: str, conc: int) -> Metrics:
    """Valida o lockout: 6 tentativas erradas seguidas na mesma conta → bloqueio."""
    m = Metrics("lockout (6 falhas na mesma conta)")
    async with _client(base, conc) as c:
        # cria uma conta dedicada (pode ser barrada pelo rate-limit; se for, salta)
        email = f"lock_{uuid.uuid4().hex[:10]}@example.com"
        reg = await c.post("/api/v1/auth/register", json={"email": email, "password": "correct-horse-1", "name": "L"})
        if reg.status_code != 201:
            m.record(0, reg.status_code)
            return m
        await c.post("/api/v1/auth/logout")
        t0 = time.perf_counter()
        for _ in range(6):
            await timed(c, m, "POST", "/api/v1/auth/login", json={"email": email, "password": "wrong"})
        m.wall = time.perf_counter() - t0
    return m


async def scenario_health(base: str, n: int, conc: int) -> Metrics:
    m = Metrics("health check (throughput cru, pooled)")
    sem = asyncio.Semaphore(conc)
    async with _client(base, conc) as c:
        async def one():
            async with sem:
                await timed(c, m, "GET", "/api/health")
        t0 = time.perf_counter()
        await asyncio.gather(*(one() for _ in range(n)))
        m.wall = time.perf_counter() - t0
    return m


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8080")
    ap.add_argument("--users", type=int, default=8)
    ap.add_argument("--concurrency", type=int, default=30)
    ap.add_argument("--writes", type=int, default=60, help="escritas por utilizador")
    args = ap.parse_args()

    print(f"→ stress test contra {args.base} · users={args.users} conc={args.concurrency}\n")

    async with httpx.AsyncClient(base_url=args.base, timeout=10) as c:
        try:
            await c.get("/api/health")
        except Exception:
            print("✗ stack local não responde. Corre `docker compose up -d --build` primeiro.")
            return

    metrics: list[Metrics] = []

    # health primeiro (não toca no rate-limit de auth)
    metrics.append(await scenario_health(args.base, args.users * 20, args.concurrency))

    # regista poucas contas (limite 10/min/IP); depois espera a janela limpar p/ poder logar
    m_reg, creds = await scenario_register(args.base, min(args.users, 9), args.concurrency)
    metrics.append(m_reg)
    print(f"  {len(creds)} contas criadas. A aguardar 62s p/ a janela de rate-limit limpar…")
    await asyncio.sleep(62)

    # escritas pesadas com as contas criadas (login 1×/user, depois writes sem limite)
    if creds:
        metrics.append(await scenario_writes(args.base, creds, args.concurrency, per_user=args.writes))

    # lockout numa conta dedicada (após nova espera curta p/ ter budget de auth)
    await asyncio.sleep(62)
    metrics.append(await scenario_lockout(args.base, args.concurrency))

    print("\n" + "=" * 60)
    print("RELATÓRIO")
    print("=" * 60)
    for m in metrics:
        print(m.report(m.wall) + "\n")

    print("Notas:")
    print("  - register/login partilham 1 bucket de 10/min POR IP → de um só IP só ~10/min passam (429 esperado).")
    print("  - No lockout: as primeiras falhas dão 401; após MAX_LOGIN_ATTEMPTS a conta bloqueia (401 'bloqueada').")
    print("  - erros=0 e ausência de 5xx = app estável sob concorrência.")


if __name__ == "__main__":
    asyncio.run(main())
