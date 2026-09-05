// LUDO ROYAL CLUB — Firebase (Auth + Firestore)
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCiuhqX-mjBB6eRjljirzIyuJv0wKVRj58',
  authDomain: 'ludojoy-ca35c.firebaseapp.com',
  databaseURL: 'https://ludojoy-ca35c-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'ludojoy-ca35c',
  storageBucket: 'ludojoy-ca35c.firebasestorage.app',
  messagingSenderId: '591882703572',
  appId: '1:591882703572:web:862fa9a649e4723c3b6141'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
