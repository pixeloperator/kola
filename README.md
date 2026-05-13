# Kola

Kola je jednoduchá statická webová aplikace pro tvorbu fotografických koláží.

## Funkce

- vlastní grid se sloupci a řádky
- připravené šablony koláže
- hromadné nahrávání fotografií do slotů
- podpora JPG, PNG, WebP a HEIC/HEIF
- náhledové zmenšeniny pro plynulejší práci
- export do PNG ve velikostech 1x, 2x a 4x

## Spuštění

Otevřete `index.html` v prohlížeči, nebo spusťte lokální server:

```bash
python3 -m http.server 4173
```

Potom otevřete `http://localhost:4173`.

## Poznámky k soukromí

Fotografie se zpracovávají lokálně v prohlížeči. Aplikace je neodesílá na server.

Stylování i HEIC převod jsou součástí repozitáře v `assets/`. Aplikace při běhu nepotřebuje externí CDN. Licence vendornuté knihovny je v `assets/vendor/heic2any-LICENSE.md`.

HEIC převodník používá interní web worker a dynamické funkce, proto `Content-Security-Policy` povoluje `blob:` workery a `'unsafe-eval'` pro lokální skripty. Bez této výjimky HEIC soubory v prohlížeči nefungují.

Po změně Tailwind tříd znovu vygenerujte CSS:

```bash
npm run build:css
```
