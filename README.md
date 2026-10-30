# Bingo App

Prosta multiplayerowa gra w **świąteczne (bożonarodzeniowe)** Bingo — gracze dołączają do pokoju i zaznaczają pola na własnych planszach. Serwer automatycznie wykrywa pierwsze BINGO i kończy rundę wszystkim. Pozostali dostają komunikaty o ruchach, ale ich kafelki nie zaznaczają się automatycznie.

## Funkcje

- Indywidualne plansze z hasłami autora (`src/data/texts.ts`): obecnie **3x3**, a **4x4** i **5x5** po uzupełnieniu puli przez autora.
- Zaznaczanie pól oraz informowanie innych graczy o zaznaczeniach
- Automatyczne wykrywanie zwycięstwa przez serwer, lokalne podświetlenie zwycięskiej linii i wspólne podsumowanie.
- Żyjąca lista graczy w pokoju (dołączanie/wyjście aktualizowane na bieżąco)
- Responsywny interfejs dostosowany do urządzeń mobilnych i desktopów, w świątecznej kolorystyce (czerwień/zieleń) i z emoji na kafelkach
- Na telefonach pola formularza mają czcionkę 16 px (bez automatycznego zoomu formularza na iOS), przyciski co najmniej 44 px wysokości, a układ uwzględnia bezpieczne obszary ekranu.
- Każdy gracz otrzymuje od serwera własny, losowy zestaw i układ haseł, bez powtórzeń na planszy i identycznych plansz w pokoju.
- Używane są wyłącznie hasła wpisane w `src/data/texts.ts`. Przy obecnych 13 hasłach dostępna jest plansza 3x3; 4x4 wymaga co najmniej 16, a 5x5 co najmniej 25 haseł.
- Pierwszy gracz ustala rozmiar pokoju. Po wpisaniu nazwy istniejącego pokoju formularz pokazuje jego rozmiar i blokuje wybór; serwer zawsze dopasowuje planszę do pokoju, również przy równoczesnym dołączaniu. Po wyjściu ostatniego gracza pokój znika i rozmiar można wybrać na nowo.
- Utworzenie lub dołączenie nie wymaga zakończenia podglądu ustawień: brak odpowiedzi podglądu pokazuje ostrzeżenie, ale nie blokuje formularza. Nieistniejący pokój powstaje automatycznie przy pierwszym dołączeniu.
- Nowe dołączenie (także po odświeżeniu lub utracie połączenia) rozpoczyna nową planszę z pustymi zaznaczeniami. Ustawienia pokoju i imię pozostają zapisane.

## Ważne pliki

Treści aplikacji są rozdzielone w `src/data/`:

- `texts.ts` — Twoje hasła na kafelkach (wspólne dla klienta i serwera).
- `summaryMessages.ts` — 10 tekstów podsumowania w liczbie pojedynczej i mnogiej oraz tekst solo.
- `icons.ts` — ikonki interfejsu i kolejność ikon na kafelkach.
- `uiTexts.ts` — etykiety, opisy, powiadomienia i szablony komunikatów interfejsu.
- `playerMessages.ts` — neutralne czasowniki komunikatów graczy.
- `instructions.ts` — kroki instrukcji gry.
- `boardSizes.ts` — dostępne warianty rozmiaru i ich nazwy.
- `notificationFeedback.ts` — treści ustawień, melodie i wzorce wibracji.

Komponenty renderują te dane, a `src/shared/` i `src/utils/` zawierają logikę ich przetwarzania.

- `src/components/BingoBoard.tsx` — logika i UI planszy
- `src/components/` — osobne widoki lobby, gry, podsumowania i ustawień sygnałów
- `src/hooks/` — sesja Socket.IO, podgląd pokoju, preferencje, adres widoku i sterowanie sygnałami
- `src/services/notificationFeedback.ts` — Web Audio i opcjonalne wibracje, bez systemowego push
- `src/index.css` — główne style (Tailwind)
- `server/index.ts` — serwer Socket.IO obsługujący pokoje i zdarzenia

## Rundy i podsumowanie

- Komunikaty są zawsze neutralne: „Ania zaznacza”, „Kuba dołącza do pokoju”, „Alex opuszcza pokój”. Powiadomienia o wejściu i wyjściu są widoczne w grze oraz w podsumowaniu.
- Serwer wykrywa pierwszą pełną linię po zaznaczeniu kafelka i kończy rundę wszystkim. Dalsze zaznaczenia są blokowane.
- Wszyscy przechodzą na `#/podsumowanie`, gdzie zwycięzca jest pierwszy u każdego i widać liczbę zaznaczeń poszczególnych graczy.
- Podsumowanie wybiera jeden z 10 żartobliwych świątecznych tekstów z nazwami pozostałych graczy (dokładnie takimi, jakie wpisano w grze). Tekst jest wspólny i stały dla danej rundy; gra solo ma osobny komunikat.
- „Zagrajmy ponownie” oznacza gotowość. Gdy wszyscy obecni ją potwierdzą, serwer losuje nowe plansze, zeruje zaznaczenia i przenosi wszystkich na `#/gra`.
- Osoba dołączająca po finale widzi podsumowanie i może potwierdzić gotowość. Wyjście lub rozłączenie usuwa ją z oczekujących na rewanż.
- Po wyjściu lub wykrytym rozłączeniu serwer usuwa planszę i zaznaczenia tej osoby; powrót oznacza nową planszę z pustymi zaznaczeniami. Nie zmienia to plansz pozostałych osób. Wyniki już zakończonej rundy pozostają w podsumowaniu jako zapis finału. Po wyjściu ostatniej osoby pokój jest usuwany.

## Jakość kodu

- `npm run format` / `npm run format:check` — Prettier
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript (frontend + `server/`)
- `npm test --prefix server` — 19 testów plansz, BINGO, danych, opcjonalnych sygnałów i przepływu gry przez Socket.IO; wymagają zależności obu pakietów.
- Pre-commit hook (Husky + lint-staged) automatycznie odpala ESLint i Prettier na zmienionych plikach przy każdym `git commit`.

## Sprawdzanie aktualizacji zależności

Po `npm install` w katalogu głównym repo:

- `npm run deps:check` — sprawdza frontend i backend.
- `npm run deps:check:frontend` — sprawdza tylko frontend.
- `npm run deps:check:backend` — sprawdza tylko backend.

Komendy korzystają z `npm-check-updates` (`ncu`) i tylko wyświetlają dostępne aktualizacje — nie zmieniają manifestów ani lockfile.
Mogą pokazywać również aktualizacje major, które wymagają sprawdzenia kompatybilności.
Narzędzie wymaga Node.js `^22.22.2 || ^24.15.0 || >=26.0.0` i npm `>=10`.

### Aktualizacja zależności

Z katalogu głównego repo:

- `npm run deps:update` — aktualizuje frontend i backend.
- `npm run deps:update:frontend` — aktualizuje tylko frontend.
- `npm run deps:update:backend` — aktualizuje tylko backend.

Te komendy uruchamiają `ncu -u`, a następnie `npm install` dla wybranego pakietu:
zmieniają wersje w manifestach, aktualizują lockfile i instalują zależności.
Obejmują również wersje major, które mogą wprowadzać niekompatybilne zmiany.
Po aktualizacji sprawdź różnice oraz uruchom `npm run typecheck`, `npm run lint`, `npm test --prefix server` i `npm run build`.

## Zmienne środowiskowe (.env)

Repo jest publiczne — nie commituj prawdziwych sekretów. W repo trzymamy tylko pliki przykładowe:

- `.env.example` — zmienne dla frontendu (Vite)
- `server/.env.example` — zmienne dla backendu

### Frontend (Vite)

- `VITE_SERVER_URL` — URL do backendu Socket.IO (np. `http://localhost:3001` lokalnie albo `https://<twoj-backend>.onrender.com` po deployu).

W lokalnym `.env` wpisz niepusty adres; na hostingu ustaw go w panelu przed buildem.
Brak zmiennej oznacza fallback `http://localhost:3001`, ale pusty string może skierować klienta na origin frontendu.
Po zmianie zmiennej uruchom ponownie Vite albo przebuduj frontend na hostingu.

Uwaga: wszystko co zaczyna się od `VITE_` trafia do bundla i jest publiczne — nie umieszczaj tam sekretów.

### Backend

- `PORT` — port nasłuchiwania serwera (na Render ustawiany automatycznie; lokalnie fallback `3001`).

Backend nie wczytuje automatycznie `server/.env`. Ustaw `PORT` w środowisku procesu, np. `$env:PORT="3001"` w PowerShell, lub w panelu hostingu.

## Deploy (Netlify + Render)

- Frontend: Netlify, build `npm run build`, publikowany katalog `dist`.
- Backend: Render Web Service, **Root Directory puste**, build `npm ci --prefix server --include=dev`, start `npm start --prefix server`, jedna instancja.
- Root Directory backendu nie może być `server`: serwer potrzebuje także wspólnych plików z `src/`.
- W buildzie Netlify ustaw `VITE_SERVER_URL` na pełny publiczny adres HTTPS backendu; po zmianie zmiennej wykonaj nowy build.
- Na właściwą rozgrywkę zalecana jest instancja backendu bez usypiania z bezczynności; Free nadaje się do testów, ale ma cold start i ograniczenia.
- Pokoje są w RAM i znikają przy restarcie/redeployu, niezależnie od planu.

### Powiadomienia na telefonie

Komunikaty to wizualne toasty w otwartej stronie (`react-hot-toast`).
Dodatkowo można osobno włączyć dźwięk i wibracje w sekcji „Dźwięk i wibracje”.
Obie opcje są domyślnie wyłączone przy każdym otwarciu/odświeżeniu strony.
Włączenie dźwięku odblokowuje Web Audio kliknięciem i odtwarza krótki sygnał próbny.
Ruchy innych graczy mają krótki sygnał, a BINGO osobną melodię; własne zaznaczenia nie uruchamiają sygnału.
Przycisk „Przetestuj sygnał” pozwala sprawdzić włączone opcje.
Wibracje wymagają obsługi `navigator.vibrate` — Safari na iPhonie ich nie obsługuje.
Nie są to powiadomienia systemowe/push: sygnały działają wyłącznie w widocznej stronie.
Po zawieszeniu dźwięku przez system może być potrzebne jego ponowne włączenie przyciskiem; aplikacja pokaże błąd.
Po przejściu do tła lub zablokowaniu telefonu przeglądarka może zawiesić połączenie.
Po jego utracie trzeba dołączyć ponownie — obecna wersja nie przywraca poprzedniej planszy.

## Uruchomienie lokalne

Zalecany Node.js 24 w aktualnym wydaniu poprawkowym. Oba terminale zaczynają w katalogu głównym repo.
Jeśli PowerShell blokuje `npm.ps1`, użyj `npm.cmd` zamiast `npm`.

Backend (pierwszy terminal):

```powershell
npm ci --prefix server
npm start --prefix server
```

Frontend (drugi terminal):

```powershell
npm ci
$env:VITE_SERVER_URL="http://localhost:3001"
npm run dev
```

Tryb developerski backendu z automatycznym restartem: `npm run dev --prefix server` z katalogu głównego.
Backend korzysta z `tsx`, aby importować współdzielone pliki TypeScript z pakietu ESM frontendu.
