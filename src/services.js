import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { db } from "./firebase";

export async function getUserProfile(uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function createCustomerProfile(uid, email, name) {
  const ref = doc(db, "users", uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return existing.data();

  const profile = {
    displayName: name || email.split("@")[0],
    email,
    role: "customer",
    department: "Customer",
    isStaff: false,
    permissions: [],
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(ref, profile);
  return profile;
}

export async function listCollection(name, max = 100) {
  const q = query(collection(db, name), orderBy("createdAt", "desc"), limit(max));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

export async function listUsers(max = 100) {
  const snapshot = await getDocs(query(collection(db, "users"), limit(max)));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

export async function createCustomer(data, actor) {
  return addDoc(collection(db, "customers"), {
    ...data,
    status: "active",
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function createVehicle(data, actor) {
  return addDoc(collection(db, "vehicles"), {
    ...data,
    mileage: Number(data.mileage || 0),
    price: Number(data.price || 0),
    msrp: Number(data.msrp || data.price || 0),
    status: "available",
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function createDeal(data, actor) {
  return addDoc(collection(db, "deals"), {
    ...data,
    stage: "shopping",
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function createQueueEntry(data, actor) {
  return addDoc(collection(db, "queue"), {
    ...data,
    status: "waiting",
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateRecord(collectionName, id, patch) {
  return updateDoc(doc(db, collectionName, id), {
    ...patch,
    updatedAt: serverTimestamp()
  });
}

export async function writeAudit(actor, action, targetType, targetId, detail = {}) {
  if (!actor) return;
  try {
    await addDoc(collection(db, "auditLogs"), {
      actorUid: actor.uid,
      actorName: actor.displayName || actor.email || "Unknown",
      action,
      targetType,
      targetId,
      detail,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("Audit write skipped:", error?.message || error);
  }
}


export async function createTestDrive(data, actor) {
  return addDoc(collection(db, "testDrives"), {
    ...data,
    status: "active",
    startedBy: actor.uid,
    startedByName: actor.displayName || actor.email || "Sterling Staff",
    startedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function completeTestDrive(id, data, actor) {
  return updateDoc(doc(db, "testDrives", id), {
    ...data,
    status: "completed",
    completedBy: actor.uid,
    completedByName: actor.displayName || actor.email || "Sterling Staff",
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function createNotification(data, actor) {
  return addDoc(collection(db, "notifications"), {
    ...data,
    read: false,
    createdBy: actor?.uid || null,
    createdByName: actor?.displayName || actor?.email || "Sterling DRIVE",
    createdAt: serverTimestamp()
  });
}

export async function markNotificationRead(id) {
  return updateDoc(doc(db, "notifications", id), {
    read: true,
    readAt: serverTimestamp()
  });
}

export async function updateUserAccess(uid, patch) {
  return updateDoc(doc(db, "users", uid), {
    ...patch,
    updatedAt: serverTimestamp()
  });
}
