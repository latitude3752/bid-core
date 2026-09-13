# Bid family — House of Bid

**Architecture:** one house, four rooms.  
**Seller:** Fountain City Capital, LLC (Georgia).  
**Not legal advice.** Trademark filings need IP counsel.

This kit is the shared layer. Each SKU has a one-pager:

- BidHawk — `bidhawk/docs/BRAND.md`
- BidYard — `bidyard/docs/BRAND.md`
- BidPulse — `bidpulse/docs/BRAND.md`
- BidKeep — `bidkeep/docs/BRAND.md`

Papa's Package `docs/BRAND.md` is the pattern (pillars, voice, tokens, lockups). Do **not** copy Papa's night/pink palette.

---

## Positioning

| | |
|---|---|
| **Family one-liner** | Vertical federal (and state) opportunity desks — one trade each, $100/mo. |
| **Promise** | The listings that match how you actually work, on a desk you already know. |
| **Landlord** | Fountain City Capital, LLC — gold/navy stays on **fountaincitycapital.com only**. |
| **Audience** | Capture / estimating / facilities owners at small and mid shops. |

### What is shared (do not fork)

- Name pattern: **Bid** + one syllable
- Price: **$100/mo**, up to **5 seats**
- Seller block, Georgia governing law, Midland address, FCC email/phone
- Logged-in **pipeline** layout, status chips, login, Stripe path
- Voice: short, confident, numbers over adjectives
- Token **names** (`--bg`, `--text`, `--accent`, `--focus-ring`, …)
- Wordmark construction: **Bid** in family ink + product syllable in product accent
- Monogram tiles: **BH / BY / BP / BK**
- Radius: **6px** controls, **8px** marketing buttons — never `rounded-full` gold pills
- Type for the **app**: Geist Sans + Geist Mono (IDs, NAICS, dates)

### What is not shared (must fork)

- Marketing accent
- Marketing hero paper / night
- Display type on `/` `/pricing` `/start`
- Eyebrow line
- Hero metaphor
- Trade mark (drone / crane / pulse / radar) — stamp-size next to the wordmark, **not** a 10% opacity wallpaper

---

## Voice (family)

| Do | Don’t |
|---|---|
| Name the trade and the source | “Federal Opportunity Tracking” on every site |
| Numbers that are true (set-aside on the row, WD when present) | “Before your competitors see it” cloned across SKUs |
| One primary CTA | Three gold pills plus a text link |
| Describe SAM.gov, GPR, eVA by name | Generic “AI bid tool” |
| One wink max (Keep may; Hawk may not) | Feature dumps in the H1 |

**Competitor-safe:** “generic contract search” / “horizontal bid boards.” Do not name SAM.gov resellers or other Bid* lookalikes on the homepage.

---

## Color — family chrome (app + footer)

Gold (`#d29a35` / `#e8b95e`) is **FCC only**. Using it as the Bid CTA is why the four sites look identical.

| Token | Hex | Role |
|---|---|---|
| Paper | `#F4F1EA` | App background, below-fold marketing |
| Ink | `#14161C` | Body text |
| Muted | `#5C6570` | Secondary |
| Navy | `#0A1120` | Footer, legal, FCC landlord moments |
| Border | `#D9D3C7` | Rules, tables |
| Danger | `#B42318` | Errors |
| Success | `#2F6F4E` | Won / paid |

Each SKU **overrides** `--accent`, `--accent-ink`, `--hero-bg`, `--hero-text`, `--link`. See product one-pagers.

---

## Lockups (to ship after palette sign-off)

| Role | Rule |
|---|---|
| **Wordmark** | `Bid` (ink) + `Hawk`/`Yard`/`Pulse`/`Keep` (accent). No slogan in the SVG. |
| **Monogram** | Two-letter tile, accent fill, ink or paper glyph, 32–192px. Favicon + OG + email. |
| **Trade stamp** | Existing drone/crane/pulse/keep paths, 24–40px, accent or ink. Not a hero background. |

Do not change a chosen lockup without updating that product's `docs/BRAND.md`.

---

## Implementation order

1. **Done (2026-09-13):** tokens in each `globals.css`; gold-* aliases to accent; marketing heroes, nav, pricing/start CTAs, OG.
2. Wordmark SVG + monogram favicon (Papa `BrandLogo` pattern).
3. App chrome: accent on primary pipeline buttons/chips only (gold already aliases).
4. No photography in v1.
