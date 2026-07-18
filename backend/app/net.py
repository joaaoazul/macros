"""Determinação fiável do IP do cliente atrás do nginx.

O nginx põe `X-Real-IP` com o `$remote_addr` (o peer real, não-appendável pelo
cliente). Usamos isso; caímos no peer directo se o header não existir (dev local).
`X-Forwarded-For` NÃO é usado: é appendável pelo cliente e portanto spoofável.
"""

import ipaddress
import socket
from urllib.parse import urlparse

from fastapi import Request


def client_ip(request: Request) -> str:
    real = request.headers.get("X-Real-IP", "").strip()
    if real:
        return real[:64]
    return (request.client.host if request.client else "")[:64]


def ip_is_public(raw_ip: str) -> bool:
    """True se o IP não for privado/loopback/link-local/reservado/multicast."""
    try:
        ip = ipaddress.ip_address(raw_ip)
    except ValueError:
        return False
    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    ):
        return False
    # IPv6 que mapeia IPv4 (::ffff:127.0.0.1) esconderia endereços internos
    mapped = getattr(ip, "ipv4_mapped", None)
    if mapped is not None:
        return ip_is_public(str(mapped))
    return True


def safe_outbound_url(url: str, allowed_schemes: tuple[str, ...] = ("https",)) -> str | None:
    """Anti-SSRF: aceita o URL só se o esquema for permitido e o host resolver para
    um IP público. Devolve o URL se for seguro, senão None.

    Usado para pedidos de saída cujo destino é controlado pelo utilizador (push
    endpoints, scraper de alimentos). Bloqueia apontar a serviços internos.

    ATENÇÃO: isto é só a 1ª barreira. Entre esta resolução e a ligação real o DNS
    pode mudar (DNS rebinding), por isso quem liga deve validar TAMBÉM o IP do
    peer já ligado — ver `ip_is_public` usada no scraper.
    """
    try:
        u = urlparse(url)
    except ValueError:
        return None
    if u.scheme not in allowed_schemes or not u.hostname:
        return None
    default_port = 443 if u.scheme == "https" else 80
    try:
        infos = socket.getaddrinfo(u.hostname, u.port or default_port, proto=socket.IPPROTO_TCP)
    except OSError:
        return None
    for *_, sockaddr in infos:
        if not ip_is_public(sockaddr[0]):
            return None
    return url
