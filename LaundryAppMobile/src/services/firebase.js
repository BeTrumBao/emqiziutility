import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
    apiKey: "AIzaSyDzE74eLLu6VVmG2FlBnH8oac843dHe7r4",
    authDomain: "emqiziutility-web.firebaseapp.com",
    databaseURL: "https://emqiziutility-web-default-rtdb.firebaseio.com",
    projectId: "emqiziutility-web",
    storageBucket: "emqiziutility-web.firebasestorage.app",
    messagingSenderId: "645675862911",
    appId: "1:645675862911:web:3298820136a699ef99a84a"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const firestore = getFirestore(app);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
