// Konfiguracja Firebase: wklej obiekt firebaseConfig z konsoli Firebase
// (Ustawienia projektu → Twoje aplikacje → aplikacja Web). Klucz apiKey jest publiczny
// z założenia; dostęp do danych chronią reguły z pliku firestore.rules.
// Dopóki projectId jest pusty, strony działają tylko w trybie próbnym (?demo=1).
export const firebaseConfig = {
  apiKey: "AIzaSyD_xjTPLWZZ37waSz-ydPmsKeg_CAwIX3E",
  authDomain: "wdi-glos.firebaseapp.com",
  projectId: "wdi-glos",
  storageBucket: "wdi-glos.firebasestorage.app",
  messagingSenderId: "177178756626",
  appId: "1:177178756626:web:543d8683217ce9b2977acb"
};

// Publiczny adres strony dla studentów (wyświetlany pod kodem QR).
export const adresPubliczny = "p4welrog.github.io/wdi/glos";
