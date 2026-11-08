import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase 项目：FLstocksystem（这些资料是公开用的，安全靠 firestore.rules）
export const firebaseConfig = {
  apiKey: "AIzaSyDws-MhbtE1BK4ELZJ0m8U15gKjCQWKj80",
  authDomain: "flstocksystem.firebaseapp.com",
  projectId: "flstocksystem",
  storageBucket: "flstocksystem.firebasestorage.app",
  messagingSenderId: "380292570774",
  appId: "1:380292570774:web:b5850c57b4b913e2fe6cb7",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
