/* ═══════════════════════════════════════════════════════════════
   Brain Side — Firebase Config
   Satu sumber config untuk semua halaman
   ═══════════════════════════════════════════════════════════════ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBnBsf_7wTTWHKPuCqekJUQhg9TMrIraw4",
  authDomain: "dsoc-ai.firebaseapp.com",
  projectId: "dsoc-ai",
  storageBucket: "dsoc-ai.firebasestorage.app",
  messagingSenderId: "867797685440",
  appId: "1:867797685440:web:ae8a51a59300f9f9ca0925"
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);