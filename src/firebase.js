import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBNEKMbXLAHoGRC2sg2mbiBlkIAqbJyT-U",
  authDomain: "sterling-motors.firebaseapp.com",
  projectId: "sterling-motors",
  storageBucket: "sterling-motors.firebasestorage.app",
  messagingSenderId: "919793587834",
  appId: "1:919793587834:web:3f79f498e9f3523a960dc3"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
