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
  updateDoc,
  writeBatch
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


export async function getBootstrapStatus() {
  const ref = doc(db, "system", "bootstrap");
  const snapshot = await getDoc(ref);
  return snapshot.exists() ? { initialized: true, ...snapshot.data() } : { initialized: false };
}

export async function claimBootstrap(user, displayName) {
  const userRef = doc(db, "users", user.uid);
  const bootstrapRef = doc(db, "system", "bootstrap");
  const batch = writeBatch(db);

  batch.set(userRef, {
    displayName: displayName || user.displayName || user.email || "Dealer Principal",
    email: user.email || "",
    role: "dealer_principal",
    department: "Executive",
    isStaff: true,
    status: "active",
    employeeId: "SMG-0001",
    permissions: ["*"],
    updatedAt: serverTimestamp()
  }, { merge: true });

  batch.set(bootstrapRef, {
    initialized: true,
    ownerUid: user.uid,
    ownerName: displayName || user.displayName || user.email || "Dealer Principal",
    initializedAt: serverTimestamp()
  });

  await batch.commit();
}

export async function createTradeIn(data, actor) {
  return addDoc(collection(db, "tradeIns"), {
    ...data,
    mileage: Number(data.mileage || 0),
    acv: Number(data.acv || 0),
    allowance: Number(data.allowance || 0),
    status: data.status || "appraised",
    createdBy: actor.uid,
    createdByName: actor.displayName || actor.email || "Sterling Staff",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function createFinanceApplication(data, actor) {
  return addDoc(collection(db, "financeApplications"), {
    ...data,
    downPayment: Number(data.downPayment || 0),
    tradeAllowance: Number(data.tradeAllowance || 0),
    productTotal: Number(data.productTotal || 0),
    amountFinanced: Number(data.amountFinanced || 0),
    apr: Number(data.apr || 0),
    termMonths: Number(data.termMonths || 0),
    monthlyPayment: Number(data.monthlyPayment || 0),
    status: data.status || "draft",
    createdBy: actor.uid,
    createdByName: actor.displayName || actor.email || "Sterling Staff",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function createDelivery(data, actor) {
  return addDoc(collection(db, "deliveries"), {
    ...data,
    status: data.status || "preparing",
    createdBy: actor.uid,
    createdByName: actor.displayName || actor.email || "Sterling Staff",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}
