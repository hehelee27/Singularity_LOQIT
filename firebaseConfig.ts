import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCZrFyN7Iq_DbkbZO3k0Z14guX_gcd0Hqo",
  authDomain: "loqit-62447.firebaseapp.com",
  projectId: "loqit-62447",
  storageBucket: "loqit-62447.firebasestorage.app",
  messagingSenderId: "922874321764",
  appId: "1:922874321764:web:4a3f8eb96c205e7589f871",
  measurementId: "G-G3HSKPMN7Y"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);