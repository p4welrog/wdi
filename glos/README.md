# Głosowanie na wykładzie — zamiennik Mentimetera

Adres dla studentów: **https://p4welrog.github.io/wdi/glos/**
Widok prowadzącego: **https://p4welrog.github.io/wdi/glos/prowadzacy.html**
Tryb próbny bez backendu (dwie karty tej samej przeglądarki): dopisz `?demo=1` do obu adresów.

## Architektura

```
telefon studenta ── index.html ──┐                        ┌── prowadzacy.html ── rzutnik
                                 │   Firestore (Firebase) │
                                 └── sale/{sala}  ◄───────┤  (stan: bieżące pytanie, otwarte/zamknięte,
                                     sale/{sala}/glosy/*  │   opublikowane wyniki)
                                         ▲                │
                                         └── 1 dokument ──┘  na głos (id = runda_uid)
```

- Strony są statyczne (GitHub Pages). Backend: Cloud Firestore na darmowym planie Spark, logowanie
  anonimowe dla studentów i e-mail/hasło dla prowadzącego.
- Student słucha tylko jednego dokumentu `sale/{sala}`. Głosów innych osób nie czyta. Wyniki
  widzi dopiero wtedy, gdy prowadzący je odsłoni: prowadzący zapisuje wtedy podsumowanie w dokumencie sali.
- Prowadzący słucha głosów bieżącej rundy (`where runda == …`).
- Jeden głos na urządzenie i rundę wynika z identyfikatora dokumentu `runda_uid`. Odpowiedź
  można zmieniać, dopóki głosowanie jest otwarte. To zabezpieczenie wystarcza na wykład, nie na egzamin:
  w trybie prywatnym przeglądarki można zagłosować drugi raz.
- Dane osobowe: brak. Odpowiedzi tekstowe są anonimowe, ograniczone do 60 znaków.

## Typy pytań (`pytania/WNN.json`)

| typ | pola | wyniki |
|-----|------|--------|
| `wybor` | `opcje: [..]`, opcjonalnie `poprawna: indeks` | słupki, liczba i odsetek |
| `liczba` | opcjonalnie `poprawna`, `tolerancja`, `min`, `max`, `jednostka` | histogram, mediana, odsetek poprawnych |
| `tekst` | opcjonalnie `ile` (1–3 pola), `maks` (≤ 60 znaków na pole) | chmura słów, ukrywanie wpisów przez prowadzącego |
| `skala` | `min`, `max`, `etykiety: [lewa, prawa]` | słupki, średnia |

Pola wspólne: `id` (unikalne w pliku), `tresc`, opcjonalnie `slajd` (podpowiedź dla prowadzącego).
W pytaniach `wybor` pole `numeracja: "1"` oznacza opcje cyframi 1, 2, 3… zamiast liter (jak na slajdzie).
W widoku prowadzącego jest też **szybkie pytanie** (A–D, tak/nie, liczba, słowa) na pytania
wyświetlone na slajdzie, dla których nie ma pliku JSON.

Rozbudowa: nowy typ = funkcja `formularz` w `index.html` + `podsumuj`/`rysuj` w `wspolne.js`
oraz walidacja w `firestore.rules`.

## Zużycie limitów (dla 100 uczestników)

Limity Spark (stan 11.2026): 50 tys. odczytów i 20 tys. zapisów dziennie, 1 GiB danych.
Limitu jednoczesnych połączeń Firestore na tym planie nie ma (limit 100 połączeń dotyczy
Realtime Database, którego tu nie używamy).

Na jedno pytanie przypada ok. 100 zapisów (głosy), ok. 100 odczytów reguły (sprawdzenie, czy runda
jest otwarta), ok. 100 odczytów prowadzącego i 3 × 100 odczytów stanu przez studentów (otwarcie,
zamknięcie, odsłona). Razem ok. 600 odczytów i 100 zapisów. 15 pytań na wykład daje ok. 9 tys. odczytów
i 1,5 tys. zapisów, więc w limicie dziennym mieszczą się co najmniej dwa wykłady.
Wybrano Firestore, a nie Supabase, bo darmowy projekt Supabase jest usypiany po tygodniu
bezczynności, a zjazdy NST odbywają się co dwa tygodnie.

## Uruchomienie (jednorazowo, ok. 10 min)

1. https://console.firebase.google.com → *Dodaj projekt* (np. `wdi-glos`), bez Google Analytics.
2. *Build → Authentication → Get started*:
   - włącz **Anonymous**,
   - włącz **Email/Password** i w zakładce *Users* dodaj swoje konto,
   - skopiuj jego **User UID**.
3. *Build → Firestore Database → Create database* (lokalizacja `eur3` lub `europe-central2`,
   tryb produkcyjny).
4. *Firestore → Rules*: wklej `firestore.rules`, w linii `ADMIN_UID` wpisz swój UID → *Publish*.
5. *Ustawienia projektu → Twoje aplikacje → Web (</>)* → skopiuj obiekt `firebaseConfig`
   do `konfiguracja.js`. Klucz `apiKey` jest publiczny z założenia; dostęp chronią reguły.
6. *Authentication → Settings → Authorized domains*: dodaj `p4welrog.github.io`.
7. Wypchnij zmiany do repozytorium. Gotowe.

## Na wykładzie

1. Otwórz `prowadzacy.html`, zaloguj się i wybierz wykład.
2. Slajd z pytaniem ma kod QR. W widoku prowadzącego kliknij pytanie → **Otwórz**.
3. **Zamknij** zatrzymuje przyjmowanie głosów. **Odsłoń** pokazuje poprawną odpowiedź i wyniki
   na telefonach.
4. Klawisze: `O` otwórz/zamknij, `S` odsłoń, `→`/`←` następne/poprzednie, `P` pełny ekran wykresu.
5. Kilka grup naraz: parametr `?sala=nazwa` w obu adresach (domyślnie `wyklad`).

SDK Firebase jest ładowane z `www.gstatic.com/firebasejs/13.4.0/`. Jeśli ta wersja przestanie być
dostępna, zmień numer w `wspolne.js`.
