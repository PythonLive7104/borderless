"""Render the 1200x630 social preview card.

Kept as a script so the card can be regenerated when the positioning line
changes, rather than being a binary nobody can edit.
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
NAVY, NAVY_2 = (11, 18, 32), (16, 27, 51)
BRAND, CYAN = (37, 99, 235), (6, 182, 212)
WHITE, MUTED, DIM = (255, 255, 255), (156, 163, 175), (107, 114, 128)
GREEN, RED = (52, 211, 153), (248, 113, 113)

INTER = "/usr/share/fonts/truetype/inter-zorin-os/Inter-%s.ttf"
MONO = "/usr/share/fonts/truetype/jetbrains-mono-zorin-os/JetBrainsMono-%s.ttf"
f = lambda p, n, s: ImageFont.truetype(p % n, s)

img = Image.new("RGB", (W, H), NAVY)
d = ImageDraw.Draw(img, "RGBA")

# Ground: a soft diagonal lift so the card isn't a flat rectangle.
for y in range(H):
    t = y / H
    d.line([(0, y), (W, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(NAVY, NAVY_2)))

# The "binary grid" the marketing site uses behind its hero.
for x in range(0, W, 40):
    d.line([(x, 0), (x, H)], fill=(255, 255, 255, 6))
for y in range(0, H, 40):
    d.line([(0, y), (W, y)], fill=(255, 255, 255, 6))

# Brand glow, bottom-right, well away from the text.
for r, a in ((360, 10), (260, 12), (170, 14)):
    d.ellipse([W - 150 - r, H - 40 - r, W - 150 + r, H - 40 + r], fill=(37, 99, 235, a))

# --- wordmark -------------------------------------------------------------
d.rounded_rectangle([72, 64, 128, 120], radius=16, fill=BRAND)
d.text((100, 92), "T", font=f(INTER, "Bold", 30), fill=WHITE, anchor="mm")
d.text((146, 92), "TryNoBot", font=f(INTER, "Bold", 30), fill=WHITE, anchor="lm")

# --- headline -------------------------------------------------------------
d.text((72, 210), "See every visitor.", font=f(INTER, "Bold", 74), fill=WHITE, anchor="ls")
d.text((72, 296), "Score every click.", font=f(INTER, "Bold", 74), fill=WHITE, anchor="ls")
d.text((72, 382), "Protect every campaign.", font=f(INTER, "Bold", 74), fill=BRAND, anchor="ls")

d.text((72, 438), "Real-time bot detection and traffic intelligence for people who buy traffic.",
       font=f(INTER, "Regular", 25), fill=MUTED, anchor="ls")

# --- the product's actual mechanic, as three chips -------------------------
chips = [("REAL PEOPLE", "your page", GREEN), ("BOTS", "a decoy", RED), ("VPN / RDP", "blocked", CYAN)]
x = 72
for label, value, colour in chips:
    lf, vf = f(MONO, "Bold", 15), f(INTER, "SemiBold", 17)
    w = max(d.textlength(label, font=lf), d.textlength(value, font=vf)) + 44
    d.rounded_rectangle([x, 500, x + w, 574], radius=14,
                        fill=(255, 255, 255, 10), outline=(*colour, 90), width=1)
    d.ellipse([x + 20, 519, x + 28, 527], fill=colour)
    d.text((x + 38, 523), label, font=lf, fill=colour, anchor="lm")
    d.text((x + 20, 553), value, font=vf, fill=WHITE, anchor="lm")
    x += w + 16

d.text((W - 72, 550), "trynobot.com", font=f(MONO, "Medium", 22), fill=DIM, anchor="rm")

img.save("frontend/public/og-image.png", "PNG", optimize=True)
print("wrote frontend/public/og-image.png")
