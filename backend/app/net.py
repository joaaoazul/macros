"""Determinação fiável do IP do cliente atrás do nginx.

O nginx põe `X-Real-IP` com o `$remote_addr` (o peer real, não-appendável pelo
cliente). Usamos isso; caímos no peer directo se o header não existir (dev local).
`X-Forwarded-For` NÃO é usado: é appendável pelo cliente e portanto spoofável.
"""

from fastapi import Request


def client_ip(request: Request) -> str:
    real = request.headers.get("X-Real-IP", "").strip()
    if real:
        return real[:64]
    return (request.client.host if request.client else "")[:64]
