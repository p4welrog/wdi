// Konfiguracja Firebase: wklej obiekt firebaseConfig z konsoli Firebase
// (Ustawienia projektu → Twoje aplikacje → aplikacja Web). Klucz apiKey jest publiczny
// z założenia; dostęp do danych chronią reguły z pliku firestore.rules.
// Dopóki projectId jest pusty, strony działają tylko w trybie próbnym (?demo=1).
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: "",
};

// Publiczny adres strony dla studentów (wyświetlany pod kodem QR).
export const adresPubliczny = "p4welrog.github.io/wdi/glos";
