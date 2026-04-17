# Bingo App

Prosty multiplayerowy Bingo — gracze dołączają do pokoju, zaznaczają pola na swojej planszy i ogłaszają BINGO. Aplikacja synchronizuje zaznaczenia i powiadomienia między uczestnikami w czasie rzeczywistym.

## Funkcje

- Generowana plansza Bingo w rozmiarach **3x3**, **4x4** i **5x5**
- Zaznaczanie pól oraz informowanie innych graczy o zaznaczeniach
- Ogłaszanie zwycięstwa (BINGO) i powiadamianie uczestników
- Responsywny interfejs dostosowany do urządzeń mobilnych i desktopów

## Ważne pliki

- `src/components/BingoBoard.tsx` — logika i UI planszy
- `src/index.css` — główne style (Tailwind)
- `server/index.ts` — serwer Socket.IO obsługujący pokoje i zdarzenia

## Zmienne środowiskowe (.env)

Repo jest publiczne — nie commituj prawdziwych sekretów. W repo trzymamy tylko pliki przykładowe:

- `.env.example` — zmienne dla frontendu (Vite)
- `server/.env.example` — zmienne dla backendu

### Frontend (Vite)

- `VITE_SERVER_URL` — URL do backendu Socket.IO (np. `http://localhost:3001` lokalnie albo `https://<twoj-backend>.onrender.com` po deployu).

Uwaga: wszystko co zaczyna się od `VITE_` trafia do bundla i jest publiczne — nie umieszczaj tam sekretów.

### Backend

- `PORT` — port nasłuchiwania serwera (na Render ustawiany automatycznie; lokalnie fallback `3001`).

## Deploy (Netlify + Render)

Ten projekt najprościej hostować w modelu:

- Frontend (Vite/React) na **Netlify**
- Backend (Socket.IO) osobno na **Render**

### 1) Backend na Render (Free)

1. Utwórz nowy Web Service na Render i podepnij repo.
2. Ustaw katalog serwera jako `server/`.
3. Ustaw komendy:

```powershell
npm install
npx ts-node index.ts
```

4. Backend nasłuchuje na porcie z `process.env.PORT` (Render ustawia to automatycznie). Lokalnie, jeśli `PORT` nie jest ustawiony, użyje `3001`.

Uwaga: Render Free może usypiać usługę (cold start).

### 2) Frontend na Netlify

1. Utwórz nową stronę na Netlify i podepnij repo.
2. Build command:

```powershell
npm run build
```

3. Publish directory:

```powershell
dist
```

4. Ustaw zmienną środowiskową w Netlify:

- `VITE_SERVER_URL` = `https://<twoj-backend>.onrender.com`

Po deployu frontend będzie łączył się do backendu Socket.IO po tej wartości.

## Uruchomienie lokalne

Frontend:

```powershell
npm install
npm run dev
```

Backend (w osobnym terminalu):

```powershell
cd server
npm install
npx ts-node index.ts
```
