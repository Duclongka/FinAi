
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = { 
  apiKey: "AIzaSyB3eqW51aCW4DAfFw8q_sP_bqawkxwq-zE", 
  authDomain: "finai-e1632.firebaseapp.com", 
  projectId: "finai-e1632", 
  storageBucket: "finai-e1632.firebasestorage.app", 
  messagingSenderId: "460521772121", 
  appId: "1:460521772121:web:42694add2503be73c90d48" 
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
