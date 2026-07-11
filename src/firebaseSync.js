// =========================================================
// مزامنة سحابية عبر Firebase Firestore
// البيانات تُحفظ تحت مسار sync/{code} حيث code رمز مزامنة شخصي
// عشوائي (128-bit) يصعب تخمينه. الأمان من سرّية الرمز + قواعد Firestore.
// إعدادات firebaseConfig عامة بطبيعتها في تطبيقات الويب.
// =========================================================
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDJclCZWYT6buY6KaPZypHrVMrFIpwU7yo",
  authDomain: "istimrar-4d666.firebaseapp.com",
  projectId: "istimrar-4d666",
  storageBucket: "istimrar-4d666.firebasestorage.app",
  messagingSenderId: "688889858345",
  appId: "1:688889858345:web:ac03797c907e31a74d0f38",
  measurementId: "G-G7FH61DPM9",
};

let _db = null;
function db() {
  if (!_db) _db = getFirestore(initializeApp(firebaseConfig));
  return _db;
}

function ref(code) {
  return doc(db(), "sync", code);
}

// الاشتراك في تغييرات المستند. cb(data|null, meta)
export function subscribeSync(code, cb, onError) {
  return onSnapshot(
    ref(code),
    (snap) => cb(snap.exists() ? snap.data() : null, snap.metadata),
    (err) => onError && onError(err)
  );
}

// كتابة الحالة كاملةً (LWW عبر updatedAt)
export function pushSync(code, data) {
  return setDoc(ref(code), data);
}

// توليد رمز مزامنة عشوائي (32 خانة سداسية عشرية)
export function genSyncCode() {
  const a = new Uint8Array(16);
  (crypto || window.crypto).getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
