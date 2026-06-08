# Ajopäiväkirja

Yksinkertainen mobiili-first ajopäiväkirja omaan käyttöön.

## Toiminnot

- Aloita ajo lähtömittarilukemalla
- Lisää ajon selitys, reitti ja tyyppi
- Päätä ajo loppumittarilukemalla
- Kilometrit lasketaan automaattisesti
- Historia ja kuluvan kuukauden kilometrit
- Supabase-tietokanta, mutta toimii ilman sitä localStoragessa testikäyttöön
- PWA-valmius kännykän kotinäytölle

## Supabase-taulu

Aja `schema.sql` Supabasen SQL Editorissa.

## Ympäristömuuttujat

Kopioi `.env.example` tiedostoksi `.env.local` ja täytä:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Kehitys

```bash
npm install
npm run dev
```

## Julkaisu

Vie projekti GitHubiin ja julkaise Vercelissä. Lisää samat ympäristömuuttujat Verceliin.
