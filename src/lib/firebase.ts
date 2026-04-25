import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp };
