// src/firebase.js
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDeR0IoojnXn_JoFjSteB8o_1YBg7mCc3Y",
  authDomain: "test-slashcoder-20a45.firebaseapp.com",
  projectId: "test-slashcoder-20a45",
  databaseURL: "https://test-slashcoder-20a45-default-rtdb.firebaseio.com",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();