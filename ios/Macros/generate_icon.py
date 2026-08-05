#!/usr/bin/env python3
"""Gera o ícone da app (1024x1024, sem alfa) a partir da identidade visual
já usada em Rings.tsx / RingsView.swift: anéis concêntricos hidratos/
proteína/gordura sobre fundo com a cor de destaque (--accent).

Corre-se uma vez (ou sempre que se queira afinar o desenho); escreve
Macros/Assets.xcassets/AppIcon.appiconset/icon-1024.png.
"""
import math
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "Macros", "Assets.xcassets", "AppIcon.appiconset", "icon-1024.png")

SIZE = 1024
SS = 4  # supersampling para bordas suaves
S = SIZE * SS

# Paleta — igual a Views/Components/Theme.swift (variante clara)
ACCENT_TOP = (0, 122, 255)
ACCENT_BOTTOM = (0, 90, 210)
CARBS = (27, 175, 122)
PROTEIN = (42, 120, 214)
FAT = (237, 161, 0)
WHITE = (255, 255, 255)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def main():
    img = Image.new("RGB", (S, S), ACCENT_TOP)
    draw = ImageDraw.Draw(img)

    # fundo: gradiente vertical subtil
    for y in range(S):
        t = y / S
        draw.line([(0, y), (S, y)], fill=lerp(ACCENT_TOP, ACCENT_BOTTOM, t))

    cx = cy = S / 2
    stroke = 78 * SS
    gap = 26 * SS
    radii = [360 * SS, 360 * SS - (stroke + gap), 360 * SS - 2 * (stroke + gap)]
    colors = [CARBS, PROTEIN, FAT]
    fills = [0.78, 0.62, 0.86]  # fração do anel preenchida, como um "dia com boas metas"

    for radius, color, fill in zip(radii, colors, fills):
        bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
        # trilho (fundo do anel), translúcido sobre o fundo azul
        track = lerp(ACCENT_TOP, WHITE, 0.18)
        draw.ellipse(bbox, outline=track, width=stroke)
        # arco preenchido, a começar no topo (12h), sentido horário
        start = -90
        end = -90 + 360 * fill
        draw.arc(bbox, start=start, end=end, fill=color, width=stroke)
        # pontas arredondadas do arco (round line cap)
        for angle in (start, end):
            rad = math.radians(angle)
            x = cx + radius * math.cos(rad)
            y = cy + radius * math.sin(rad)
            r = stroke / 2
            draw.ellipse([x - r, y - r, x + r, y + r], fill=color)

    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    img.save(OUT, "PNG")
    print("Escrito:", OUT, img.size)


if __name__ == "__main__":
    main()
