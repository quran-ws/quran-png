# quran-canva

The Canva app. It is the same picker as png.quran.ws, living inside the Canva
editor, and it inserts the ayah straight into the open design instead of making
you download and re-upload a file.

## How it works

`src/app.tsx` is the whole app. It calls the public API for the surah list,
builds an image URL from the pickers, and on **Add to design**:

1. `upload()` from `@canva/asset` hands Canva the PNG URL, so Canva fetches the
   image server-side into the user's media library;
2. `addElementAtPoint()` from `@canva/design` drops the returned asset ref onto
   the page.

Canva's backend fetches the URL itself, which is why the app points at
`https://png.quran.ws` and never at a local dev server — Canva cannot reach
`localhost`. During development, point `API` at any HTTPS tunnel to your local
API (`cloudflared tunnel`, `ngrok`) rather than at `http://localhost:8787`.

## Building it

Canva apps build inside Canva's starter kit, which supplies the webpack config,
the dev server and the HMR bridge:

```bash
git clone https://github.com/canva-sdks/canva-apps-sdk-starter-kit
cd canva-apps-sdk-starter-kit
npm install
cp -r ../quran-png/apps/quran-canva/src/* src/
npm start
```

Then in the Canva Developer Portal (canva.com/developers): create an app, set
its **Development URL** to `http://localhost:8080`, and open it from the
editor's Apps panel.

## The translations file

The portal asks for a JSON file of the app's English strings. It is generated,
not hand-written: every user-facing string in `app.tsx` goes through
`intl.formatMessage({ defaultMessage, description })`, and `formatjs` extracts
them.

```bash
npm run extract          # writes dist/messages_en.json
```

Upload that file under **Translations**. Re-run it and re-upload whenever you
change a string. Canva requires a non-empty `description` on every message —
that is the note telling a translator where the string appears, so keep them
meaningful rather than restating the string.

## Submitting it

The app needs no permissions and no authentication — it reads a public,
unauthenticated API and uploads a public image URL. For review, the two things
worth stating in the submission are:

- **Content provenance.** The artwork is the King Fahd Glorious Qur'an Printing
  Complex's Madani mushaf, used under the Complex's free digital licence, which
  expressly permits digital publishing, media use, and use in websites and
  software. See `NOTICE.md` at the repository root.
- **`aiDisclosure: "none"`.** Nothing here is generated; every image is cut from
  the printed plates.
