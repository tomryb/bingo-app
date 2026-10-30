# Bingo App

Prosta multiplayerowa gra w **świąteczne (bożonarodzeniowe)** Bingo — gracze dołączają do pokoju i zaznaczają pola na własnych planszach. Serwer automatycznie wykrywa pierwsze BINGO i kończy rundę wszystkim. Pozostali dostają komunikaty o ruchach, ale ich kafelki nie zaznaczają się automatycznie.

## Zagraj

Otwórz [Świąteczne Bingo](https://holiday-bingo-app.netlify.app/), wpisz nazwę gracza (imię lub pseudonim) i nazwę pokoju. Pozostali gracze otwierają tę samą aplikację i wpisują dokładnie tę samą nazwę pokoju oraz własne, różne nazwy graczy. Przycisk „Kopiuj nazwę pokoju” ułatwia przekazanie nazwy rodzinie.

Pokoje nie mają haseł ani kontroli dostępu — nazwa pokoju nie jest zabezpieczeniem. Odświeżenie strony lub utrata połączenia oznacza ponowne dołączenie i nową planszę. Restart backendu usuwa wszystkie pokoje.

## Funkcje

- Indywidualne plansze z hasłami autora (`src/data/texts.ts`): obecnie **3x3**, a **4x4** i **5x5** po uzupełnieniu puli przez autora.
- Zaznaczanie pól oraz informowanie innych graczy o zaznaczeniach
- Automatyczne wykrywanie zwycięstwa przez serwer, lokalne podświetlenie zwycięskiej linii i wspólne podsumowanie.
- Żyjąca lista graczy w pokoju (dołączanie/wyjście aktualizowane na bieżąco)
- Kopiowanie samej nazwy pokoju w grze i podsumowaniu, aby wysłać ją pozostałym graczom.
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
- `src/index.css` — importy zwykłego CSS z `src/styles/`: baza, wspólne elementy, layout, lobby, gra, podsumowanie i powiadomienia; bez Tailwinda
- `src/shared/limits.ts` — wspólne limity długości imienia i pokoju dla formularza i backendu
- `server/index.ts` — uruchomienie serwera; logika gry i walidacja żądań są w osobnych modułach backendu

## Rundy i podsumowanie

- Komunikaty są zawsze neutralne: „Ania zaznacza”, „Kuba dołącza do pokoju”, „Alex opuszcza pokój”. Powiadomienia o wejściu i wyjściu są widoczne w grze oraz w podsumowaniu.
- Serwer wykrywa pierwszą pełną linię po zaznaczeniu kafelka i kończy rundę wszystkim. Dalsze zaznaczenia są blokowane.
- W grze adres zawiera nazwę pokoju (`/wigilia`), a w podsumowaniu `/wigilia/podsumowanie`, bez `#`. Znaki specjalne są kodowane w URL. Adres opisuje widok, nie przywraca sesji po odświeżeniu. Reguła SPA w `netlify.toml` kieruje ścieżki bez istniejącego pliku do `index.html`, aby bezpośrednie otwarcie lub odświeżenie nie kończyło się błędem 404.
- W podsumowaniu zwycięzca jest pierwszy u każdego i widać liczbę zaznaczeń poszczególnych graczy.
- Podsumowanie wybiera jeden z 10 żartobliwych świątecznych tekstów z nazwami pozostałych graczy (dokładnie takimi, jakie wpisano w grze). Tekst jest wspólny i stały dla danej rundy; gra solo ma osobny komunikat.
- „Zagrajmy ponownie” oznacza gotowość. Gdy wszyscy obecni ją potwierdzą, serwer losuje nowe plansze, zeruje zaznaczenia i przenosi wszystkich do widoku pokoju.
- Osoba dołączająca po finale widzi podsumowanie i może potwierdzić gotowość. Wyjście lub rozłączenie usuwa ją z oczekujących na rewanż.
- Po wyjściu lub wykrytym rozłączeniu serwer usuwa planszę i zaznaczenia tej osoby; powrót oznacza nową planszę z pustymi zaznaczeniami. Nie zmienia to plansz pozostałych osób. Wyniki już zakończonej rundy pozostają w podsumowaniu jako zapis finału. Po wyjściu ostatniej osoby pokój jest usuwany.
- Lista graczy rozpoznaje osoby po ID połączenia. Imię musi być unikalne wśród obecnych graczy w danym pokoju (bez rozróżniania wielkości liter i skrajnych spacji). Zajęte imię powoduje odmowę dołączenia z sugestią dopisania liczby. Wyjście lub wykryte rozłączenie zwalnia imię; w innym pokoju można używać tego samego imienia.
- Dołączanie ma limit 8 sekund. Brak potwierdzenia odblokowuje formularz; spóźnione odpowiedzi poprzedniej próby nie zastępują nowej sesji.
- Imię, pokój i rozmiar są zapisywane w `sessionStorage` danej karty, nie w `localStorage`. Odświeżenie zachowuje preferencje; zwykła nowa karta zaczyna z pustym imieniem i pokojem. Przywracanie sesji lub duplikowanie karty przez przeglądarkę może zachować dane. Stare wpisy w `localStorage` nie są odczytywane.
- Niedostępny `sessionStorage` nie blokuje gry: preferencje pozostają w pamięci React, a interfejs informuje o braku zapisu.
- Zmiana widoku przenosi fokus na jego nagłówek.

## Jakość kodu

- `npm run lint` — tylko lintowanie przez Biome, w tym reguły hooków React; bez zapisu.
- `npm run lint:fix` — bezpieczne poprawki lintowania.
- `npm run check` — lint, formatowanie i importy przez Biome, bez zapisu i bez typecheck.
- `npm run format` / `npm run check:fix` — lint, formatowanie i importy z bezpiecznymi poprawkami oraz zapisem.
- `npm run format:check` — tylko kontrola formatowania, bez zapisu i lintowania.
- `npm run verify` — Biome bez zapisu, następnie typecheck frontendu i backendu.
- `npm run verify:fix` — Biome z bezpiecznymi poprawkami, następnie typecheck frontendu i backendu. Niepowodzenie pierwszego kroku zatrzymuje drugi.
- Wszystkie komendy Biome oraz pre-commit używają `--error-on-warnings`; pozostałe błędy i ostrzeżenia kończą kontrolę niepowodzeniem.
- `npm run typecheck` — TypeScript: frontend, backend oraz testy `.mts` przez `tsconfig.tests.json`.
- `npm test` — 27 testów jednostkowych/integracyjnych, kolejno frontend/narzędzia i backend; wymagają zależności obu pakietów. Bez uruchamiania przeglądarki.
- `npm run test:frontend` — 11 testów jednostkowych w `tests/unit/`: sygnały, walidacja przydziału planszy i kontrola commita wdrażanego na Netlify. Nie są to testy interfejsu w przeglądarce.
- `npm run test:backend` lub `npm test --prefix server` — 16 testów w `server/tests/`: losowanie, wspólne reguły/dane gry i integracja Socket.IO, w tym zajęte imiona, nieprawidłowe komunikaty, błędne/spóźnione ruchy, równoczesne BINGO i rozłączenia.
- `npm run test:e2e:install` — pobranie Chromium, Firefox i WebKit do Playwright (ponów po aktualizacji Playwright); na Linux CI może być potrzebne `npx playwright install --with-deps chromium firefox webkit`.
- `npm run test:e2e` — 11 scenariuszy w 5 projektach (55 wykonań): Chromium, Firefox, WebKit oraz emulowane Pixel 7 i iPhone 13. Gra/rewanż, adresy bez `#`, fokus, sessionStorage (odświeżenie, nowa karta i błędy zapisu/odczytu), blokowanie zajętych imion, kopiowanie nazwy pokoju i błąd schowka, odrzucenie/timeout dołączania, utrata połączenia i RWD z powiększonym tekstem.
- `npm run test:all` — testy jednostkowe/integracyjne oraz E2E.
- Pre-commit hook (Husky + lint-staged) uruchamia `biome check --write` dla plików JS/TS/JSX/TSX (także MTS/CTS), JSON/JSONC, CSS, Markdown i YAML dodanych do staging area, następnie pełny typecheck aplikacji i testów. Ostrzeżenia Biome lub błędy którejkolwiek kontroli blokują commit.
- Biome ma konfigurację w `biome.json` i pomija pliki ignorowane przez Git oraz lockfile. Markdown nie jest objęty skonfigurowanym formatowaniem.

Playwright sam uruchamia i zatrzymuje backend oraz Vite na testowych portach **3199** i **5189**.
Porty muszą być wolne; test nie wykorzystuje istniejących serwerów ani pokoi.
Konfiguracja znajduje się w `playwright.config.mts`; testy i konfiguracja E2E są objęte `typecheck`.
Po niepowodzeniu ślad diagnostyczny trafia do ignorowanego `test-results/`.
Testy jednostkowe są w `tests/unit/*.test.mts`, a przeglądarkowe w `tests/e2e/*.spec.mts`.
WebKit sprawdza silnik Safari, a Chromium silnik używany m.in. przez Chrome i Edge — nie są to testy zainstalowanych, markowych przeglądarek ani prawdziwego iPhone'a.
Wybrany silnik można uruchomić osobno, np. `npm run test:e2e -- --project=firefox`.
Projekty mobilne: `--project=mobile-chromium` i `--project=mobile-webkit`; emulacja nie zastępuje testów na fizycznych telefonach.
Testy RWD sprawdzają lobby, grę i podsumowanie przy szerokościach 320/390/768/1280 px oraz bazowym tekście 16/32 px.
Style używają `rem` dla typografii i wymiarów zależnych od tekstu, `em` w breakpointach oraz `%`/`fr` dla płynnych układów. Cienkie obramowania i dekoracyjne efekty pozostają w px.
Reset przeglądarkowy i tokeny kolorów są w `src/styles/base.css`; nie wymagają Tailwinda ani dodatkowej konfiguracji PostCSS.
Workflow `.github/workflows/verify.yml` uruchamia kontrole, wszystkie testy i build dla PR-ów do `master` oraz pushów na `master`. Push na gałąź roboczą bez PR nie uruchamia Verify; kolejne zmiany w otwartym PR uruchamiają kontrolę PR, bez dodatkowego przebiegu push.

## Praca z repozytorium

`master` jest gałęzią domyślną i produkcyjną. Nie używamy stałej gałęzi `develop`. Każdą zmianę przygotowuj na krótkiej gałęzi utworzonej z aktualnego `master`:

```powershell
git switch master
git pull --ff-only origin master
git switch -c fix/nazwa-poprawki
```

Komendy zakładają czysty katalog roboczy. Jeśli zmiany są już niezacommitowane na lokalnym `master`, samo `git switch -c fix/nazwa-poprawki` zachowa je na nowej gałęzi.

1. Wprowadź zmiany i uruchom odpowiednie kontrole lokalne.
2. Zacommituj je i wypchnij gałąź: `git push -u origin fix/nazwa-poprawki`.
3. Utwórz PR do `master`, poczekaj na zielony wymagany status `verify` i scal przez **Squash and merge**.
4. Po scaleniu Verify sprawdzi faktyczny commit na `master`, a jego sukces uruchomi Deploy.
5. Usuń gałąź roboczą po merge. Kolejną utwórz ponownie z aktualnego `master`.

Ochrona `master` wymaga PR, statusu `verify` i aktualności gałęzi; blokuje force push oraz usuwanie. Jeśli w czasie pracy zmieni się `master`, zaktualizuj gałąź PR przez **Update branch** lub merge `origin/master`. Nie omijaj ochrony bezpośrednim pushem ani force pushem.

### Czyszczenie plików generowanych

`npm run clean` usuwa `dist/`, `dist-ssr/`, `coverage/`, `server/coverage/`,
`test-results/`, `playwright-report/`, `blob-report/`, cache Vite (`node_modules/.vite/`,
`node_modules/.vite-temp/`) oraz trzy pliki `tsconfig.*.tsbuildinfo` używane przez projekt w `node_modules/.tmp/`.
Uruchamiaj po zatrzymaniu dev servera i testów; kolejne uruchomienia odtworzą potrzebne pliki.
Komenda nie usuwa zależności, pobranych przeglądarek Playwright, plików `.env` ani lokalnych docs.

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
Po aktualizacji sprawdź różnice oraz uruchom `npm run verify`, `npm test` i `npm run build`.

Aktualny zestaw korzysta z React 19.3, Vite 8, Biome 2.6 i TypeScript 7.0.
Biome zastępuje ESLint i Prettier; kontrolę typów nadal wykonuje TypeScript.
Typy `@types/node` są obecnie w linii 26. Same typy nie aktualizują środowiska uruchomieniowego — dopasuj je do wersji Node lokalnie i na hostingu.

## Zmienne środowiskowe (.env)

Repo jest publiczne — nie commituj prawdziwych sekretów. W repo trzymamy tylko pliki przykładowe:

- `.env.example` — zmienne dla frontendu (Vite)
- `server/.env.example` — zmienne dla backendu

### Frontend (Vite)

- `VITE_SERVER_URL` — URL do backendu Socket.IO (np. `http://localhost:3001` lokalnie albo `https://<twoj-backend>.onrender.com` po deployu).

Skopiuj `.env.example` do `.env.dev` dla pracy lokalnej i do `.env.prod` dla produkcji, ustawiając odpowiedni niepusty adres.
Przykład zawiera puste wartości — przed uruchomieniem uzupełnij `VITE_SERVER_URL`; lokalnie użyj `http://localhost:3001`.
`npm run dev` wczytuje `.env.dev` (tryb `dev`), a `npm run build` wczytuje `.env.prod` (tryb `prod`, nadal build produkcyjny).
Oba pliki są ignorowane przez Git. Na hostingu ustaw zmienne w panelu przed buildem — pliki lokalne nie trafiają do repozytorium.
`NODE_VERSION`, `HUSKY` i `NPM_FLAGS` ustaw w panelu Netlify; wpisanie ich do pliku Vite nie konfiguruje instalacji zależności ani wersji Node.
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

Zmienne Netlify z dostępem podczas **Builds / Production** (wartości ustaw w panelu, nie zapisuj konfiguracji konkretnego wdrożenia w README):

| Zmienna           | Wartość                                                             |
| ----------------- | ------------------------------------------------------------------- |
| `VITE_SERVER_URL` | Publiczny adres HTTPS własnego backendu Socket.IO                   |
| `NODE_VERSION`    | Wersja Node zgodna z projektem                                      |
| `HUSKY`           | Ustawienie wyłączające hooki podczas instalacji na hostingu         |
| `NPM_FLAGS`       | Flagi zapewniające instalację devDependencies potrzebnych do builda |

Wartości wpisuj bez cudzysłowów. Na Renderze `PORT` jest ustawiany automatycznie; żadna z powyższych zmiennych frontendu nie jest wymagana przez backend. Wersję Node na Renderze można przypiąć osobno przez `NODE_VERSION`.

### Automatyczne wdrożenia po testach

Workflow `.github/workflows/deploy.yml` uruchamia buildy obu hostingów wyłącznie po udanym **Verify** dla pushu na `master` w tym repo. PR i pushe na gałęzie robocze nie publikują produkcji. Przestarzały przebieg Verify jest pomijany.

Konfiguracja jednorazowa:

1. W Renderze skopiuj **Settings → Deploy Hook** i wyłącz **Auto-Deploy**. Nie zmieniaj komend build/start.
2. W Netlify utwórz **Build hook** dla gałęzi `master` w **Project configuration → Developer settings → Continuous deployment → Build hooks**.
3. W GitHub utwórz **Settings → Environments → production** i dodaj environment secrets:
   - `RENDER_DEPLOY_HOOK_URL` — pełny URL hooka Render.
   - `NETLIFY_BUILD_HOOK_URL` — pełny URL hooka Netlify dla `master`.
4. Pozostaw produkcyjną gałąź Netlify jako `master` i dotychczasowe cztery zmienne środowiskowe. Nie ustawiaj ręcznie `INCOMING_HOOK_BODY` ani `COMMIT_REF`.
5. Plik workflow musi znajdować się na domyślnej gałęzi `master` (wymóg `workflow_run`). Zmiany workflow wprowadzaj przez PR do `master`.

`netlify.toml` pomija natywne produkcyjne buildy po pushu przez `ignore`; build hook omija tę regułę. W panelu oczekiwany jest wpis **Canceled** po pushu, a później osobny build uruchomiony hookiem po Verify — anulowany wpis nie oznacza drugiego pełnego builda ani błędu publikacji. **Nie używaj „Stop builds”** — zablokowałoby też hooki. Produkcyjny build wymaga commita przekazanego przez workflow i sprawdza jego zgodność z `COMMIT_REF`; zwykły ręczny deploy bez payloadu nie zostanie opublikowany. Jeśli w trakcie kolejki pojawi się nowszy commit, niezgodny build zakończy się błędem zamiast opublikować niesprawdzony kod.

Render dostaje dokładny SHA przez `ref`. Zielony **Deploy** oznacza przyjęcie żądań buildów, nie zakończenie publikacji — końcowy status i commit sprawdź w Renderze i Netlify. Hooki nie zapewniają atomowego wdrożenia obu usług; jeśli jedna zawiedzie, sprawdź logi przed ponowieniem. URL-e hooków są sekretami: nie dodawaj ich do `.env.example`, repo ani wiadomości.

Netlify może niezależnie budować **Deploy Preview** dla PR, jeszcze przed zakończeniem Verify. Preview nie zastępuje produkcji, ale jeśli korzysta z produkcyjnego `VITE_SERVER_URL`, łączy się z tym samym backendem i nie jest odizolowanym środowiskiem gry.

Po wdrożeniu sprawdź **Live** na Renderze i **Published** dla produkcji na Netlify oraz zgodność commitów. Przed udostępnieniem gry przetestuj dwie osoby na osobnych telefonach, w tym jedną przez internet komórkowy. Podczas rozgrywki nie wdrażaj zmian ani nie restartuj backendu; płatna instancja bez usypiania nie zapewnia trwałości pokojów.

### Publiczne adresy

Frontend: `https://holiday-bingo-app.netlify.app/`. Zmiana nazwy projektu Netlify zmienia subdomenę bez potrzeby zmiany kodu. Adres bez `netlify.app` lub `onrender.com` wymaga własnej domeny i konfiguracji DNS, np. frontend `bingo.twoja-domena.pl` oraz backend `api.twoja-domena.pl`. Po zmianie adresu backendu zaktualizuj `VITE_SERVER_URL` i przebuduj frontend.

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
Po instalacji zależności obu pakietów możesz uruchomić frontend i backend jedną komendą:

```powershell
npm run dev:all
```

Komenda używa `.env.dev` frontendu i domyślnego portu backendu 3001. `Ctrl+C` zatrzymuje oba procesy; zakończenie jednego również zatrzymuje drugi. `npm run dev` nadal uruchamia wyłącznie frontend.
Backend korzysta z `tsx`, aby importować współdzielone pliki TypeScript z pakietu ESM frontendu.
