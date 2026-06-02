// src/config/firebase.js
// ─────────────────────────────────────────────────────────────
// INSTRUCCIONES:
// 1. Ve a https://console.firebase.google.com
// 2. Crea un proyecto llamado "yaguares-rc"
// 3. Activa: Authentication (Email/Password), Firestore, Storage
// 4. En "Configuración del proyecto" > "Tus apps" > Web, copia los datos
// 5. Reemplaza los valores de abajo con los tuyos
// ─────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROJECT.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROJECT.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
