# quran-canva

The Canva app. It is the same picker as png.quran.ws, living inside the Canva
editor, and it inserts the ayah straight into the open design instead of making
you download and re-upload a file.

## How it works

`src/intents/design_editor/app.tsx` is the whole app. It calls the public API
for the surah list, builds an image URL from the pickers, and on
**Add to design**:

1. `upload()` from `@canva/asset` hands Canva the PNG URL, so Canva fetches the
   image server-side into the user's media library;
2. `addElementAtPoint()` from `@canva/design` drops the returned asset ref onto
   the page.

Canva's backend fetches the URL itself, which is why the app points at
`https://png.quran.ws` and never at a local dev server — Canva cannot reach
`localhost`. During development, point `API` at any HTTPS tunnel to your local
API (`cloudflared tunnel`, `ngrok`) rather than at `http://localhost:8787`.

## Building it

Canva apps build inside Canva's starter kit, which supplies the bundler, the dev
server and the intent wiring. It needs Node 22 or 24 — Node 20 will not install
it.

```bash
git clone https://github.com/canva-sdks/canva-apps-sdk-starter-kit
cd canva-apps-sdk-starter-kit
npm install
cp -r ../quran-png/apps/quran-canva/src/* src/
rm -rf src/intents/design_editor/__tests__   # tests for the kit's demo app
npm start                # dev server on localhost:8080
npm run build            # dist/app.js + dist/messages_en.json
```

Delete that test directory or `npm run lint:types` fails: it asserts on a
`DOCS_URL` export belonging to the demo app you just replaced. The bundler
ignores tests, so the build passes either way.

`src/intents/design_editor/index.tsx` in the kit already mounts `App` from
`./app`, so the copy is the whole integration — there is nothing to register.

The build warns that `BACKEND_HOST` is set to localhost. Ignore it: this app
holds its host in `API_HOST` and never reads that variable. Confirm by grepping
the bundle for `png.quran.ws`.

For development, create an app in the Canva Developer Portal
(canva.com/developers), set its **Development URL** to `http://localhost:8080`,
and open it from the editor's Apps panel.

## The translations file

The portal asks for a JSON file of the app's English strings. It is generated,
not hand-written: every user-facing string in `app.tsx` goes through
`intl.formatMessage({ defaultMessage, description })`, and `formatjs` extracts
them.

`npm run build` in the starter kit extracts them to `dist/messages_en.json`;
the copy committed here is that output.

Upload that file under **Translations**. Rebuild and re-upload whenever you
change a string. Canva requires a non-empty `description` on every message —
that is the note telling a translator where the string appears, so keep them
meaningful rather than restating the string.

## Submitting it

The app needs no authentication, and one scope: `canva:asset:private:write`.
`upload()` writes into the user's media library, so without it every insert
fails with `missing_scopes`. It asks for nothing else — it cannot read designs.
For review, the two things worth stating in the submission are:

- **Content provenance.** The artwork is the King Fahd Glorious Qur'an Printing
  Complex's Madani mushaf, used under the Complex's free digital licence, which
  expressly permits digital publishing, media use, and use in websites and
  software. See `NOTICE.md` at the repository root.
- **`aiDisclosure: "none"`.** Nothing here is generated; every image is cut from
  the printed plates.
