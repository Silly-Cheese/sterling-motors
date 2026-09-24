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
  writeBatch,
  where
} from "firebase/firestore";
import { db } from "./firebase.js";

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
    status: data.status || "available",
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


export async function createServiceAppointment(data, actor) {
  return addDoc(collection(db, "serviceAppointments"), {
    ...data,
    status: data.status || "scheduled",
    createdBy: actor.uid,
    createdByName: actor.displayName || actor.email || "Sterling Staff",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function createRepairOrder(data, actor) {
  return addDoc(collection(db, "repairOrders"), {
    ...data,
    mileage: Number(data.mileage || 0),
    laborTotal: Number(data.laborTotal || 0),
    partsTotal: Number(data.partsTotal || 0),
    estimateTotal: Number(data.estimateTotal || 0),
    status: data.status || "checked_in",
    createdBy: actor.uid,
    createdByName: actor.displayName || actor.email || "Sterling Staff",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function createPart(data, actor) {
  return addDoc(collection(db, "parts"), {
    ...data,
    quantity: Number(data.quantity || 0),
    reorderPoint: Number(data.reorderPoint || 0),
    cost: Number(data.cost || 0),
    retailPrice: Number(data.retailPrice || 0),
    status: data.status || "active",
    createdBy: actor.uid,
    createdByName: actor.displayName || actor.email || "Sterling Staff",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function createPartRequest(data, actor) {
  return addDoc(collection(db, "partRequests"), {
    ...data,
    quantity: Number(data.quantity || 1),
    status: data.status || "requested",
    requestedBy: actor.uid,
    requestedByName: actor.displayName || actor.email || "Sterling Staff",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function createVehicleAcquisition(data, actor) {
  return addDoc(collection(db, "vehicleAcquisitions"), {
    ...data,
    mileage: Number(data.mileage || 0),
    requestedPrice: Number(data.requestedPrice || 0),
    offerAmount: Number(data.offerAmount || 0),
    status: data.status || "submitted",
    createdBy: actor.uid,
    createdByName: actor.displayName || actor.email || "Sterling Staff",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}


export async function listVehicleAcquisitionsForUser(uid, max = 50) {
  const q = query(
    collection(db, "vehicleAcquisitions"),
    where("sellerUid", "==", uid),
    limit(max)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}


export async function checkoutQueueEntry(id, data, actor) {
  return updateDoc(doc(db, "queue", id), {
    ...data,
    status: "complete",
    checkedOutBy: actor.uid,
    checkedOutByName: actor.displayName || actor.email || "Sterling Staff",
    checkedOutAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}


export async function saveTradeInForDeal(data, actor, existingId = "") {
  const id = existingId || data.dealId;
  if (!id) throw new Error("A Deal Jacket is required for a trade-in.");
  const ref = doc(db, "tradeIns", id);
  const snapshot = await getDoc(ref);
  const payload = {
    ...data,
    mileage: Number(data.mileage || 0),
    acv: Number(data.acv || 0),
    allowance: Number(data.allowance || 0),
    createdBy: snapshot.exists() ? (snapshot.data().createdBy || actor.uid) : actor.uid,
    createdByName: snapshot.exists() ? (snapshot.data().createdByName || actor.displayName || actor.email || "Sterling Staff") : (actor.displayName || actor.email || "Sterling Staff"),
    updatedAt: serverTimestamp()
  };
  if (!snapshot.exists()) payload.createdAt = serverTimestamp();
  await setDoc(ref, payload, { merge: true });
  return { id };
}

export async function receiveTradeInVehicle(trade, deal, actor) {
  if (!trade?.id) throw new Error("Trade-in record is missing.");
  const vehicleId = trade.inventoryVehicleId || `trade-${trade.id}`;
  const vehicleRef = doc(db, "vehicles", vehicleId);
  const tradeRef = doc(db, "tradeIns", trade.id);
  const batch = writeBatch(db);

  batch.set(vehicleRef, {
    year: trade.year,
    make: trade.make,
    model: trade.model,
    vin: trade.vin,
    mileage: Number(trade.mileage || 0),
    stockNumber: `TRD-${String(deal?.dealNumber || deal?.id || trade.id).replace(/[^A-Za-z0-9]/g, "").slice(-8)}`,
    trim: "Trade-In",
    color: "Pending Service Review",
    msrp: Number(trade.managerApprovedAcv ?? trade.acv ?? 0),
    price: Number(trade.managerApprovedAcv ?? trade.acv ?? 0),
    status: "service_review",
    location: "Trade-In Inspection",
    sourceTradeId: trade.id,
    acquisitionCost: Number(trade.managerApprovedAcv ?? trade.acv ?? 0),
    createdBy: actor.uid,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  }, { merge: true });

  batch.set(tradeRef, {
    status: "service_review_required",
    inventoryVehicleId: vehicleId,
    receivedBy: actor.uid,
    receivedByName: actor.displayName || actor.email || "Sterling Staff",
    updatedAt: serverTimestamp()
  }, { merge: true });

  await batch.commit();
  return { id: vehicleId };
}


export async function startAcquisitionReview(id, actor) {
  return updateDoc(doc(db, "vehicleAcquisitions", id), {
    status: "under_review",
    reviewStartedBy: actor.uid,
    reviewStartedByName: actor.displayName || actor.email || "Sterling Staff",
    reviewStartedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function sendAcquisitionOffer(id, data, actor) {
  return updateDoc(doc(db, "vehicleAcquisitions", id), {
    offerAmount: Number(data.offerAmount || 0),
    appraisedCondition: data.appraisedCondition || "",
    appraisalNotes: data.appraisalNotes || "",
    offerNote: data.offerNote || "",
    offerRevision: Number(data.offerRevision || 1),
    status: "offer_made",
    customerResponse: "",
    customerResponseNote: "",
    offeredBy: actor.uid,
    offeredByName: actor.displayName || actor.email || "Sterling Staff",
    offeredAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function respondToAcquisitionOffer(id, response, note = "") {
  const statusMap = {
    accept: "accepted",
    decline: "declined",
    review: "review_requested"
  };
  const status = statusMap[response];
  if (!status) throw new Error("Invalid acquisition response.");
  return updateDoc(doc(db, "vehicleAcquisitions", id), {
    status,
    customerResponse: response,
    customerResponseNote: note || "",
    respondedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function receiveAcquisitionVehicle(acquisition, data, actor) {
  if (!acquisition?.id) throw new Error("Acquisition record is missing.");
  const vehicleId = acquisition.inventoryVehicleId || `acquisition-${acquisition.id}`;
  const vehicleRef = doc(db, "vehicles", vehicleId);
  const acquisitionRef = doc(db, "vehicleAcquisitions", acquisition.id);
  const batch = writeBatch(db);

  batch.set(vehicleRef, {
    year: acquisition.year,
    make: acquisition.make,
    model: acquisition.model,
    trim: acquisition.trim || "",
    vin: acquisition.vin,
    mileage: Number(acquisition.mileage || 0),
    color: acquisition.color || "",
    stockNumber: data.stockNumber,
    price: Number(data.price || 0),
    msrp: Number(data.msrp || data.price || 0),
    status: data.status || "reconditioning",
    location: data.location || "Used Vehicle Intake",
    sourceAcquisitionId: acquisition.id,
    acquisitionCost: Number(acquisition.offerAmount || 0),
    createdBy: actor.uid,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  }, { merge: true });

  batch.set(acquisitionRef, {
    status: "received",
    inventoryVehicleId: vehicleId,
    receivedBy: actor.uid,
    receivedByName: actor.displayName || actor.email || "Sterling Staff",
    receivedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  await batch.commit();
  return { id: vehicleId };
}


export async function staffAcceptAcquisitionOffer(id, actor, note = "") {
  return updateDoc(doc(db, "vehicleAcquisitions", id), {
    status: "accepted",
    customerResponse: "accept",
    customerResponseNote: note || "",
    acceptanceMethod: "staff_assisted",
    acceptedByStaff: actor.uid,
    acceptedByStaffName: actor.displayName || actor.email || "Sterling Staff",
    respondedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}


export async function createFinanceAppointment(data, actor) {
  return addDoc(collection(db, "financeAppointments"), {
    ...data,
    requesterUid: data.requesterUid ?? actor.uid,
    requesterName: data.requesterName || actor.displayName || actor.email || "Sterling Customer",
    requesterEmail: data.requesterEmail || actor.email || "",
    status: data.status || "requested",
    createdBy: actor.uid,
    createdByName: actor.displayName || actor.email || "Sterling User",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function listFinanceAppointmentsForUser(uid, max = 50) {
  const q = query(
    collection(db, "financeAppointments"),
    where("requesterUid", "==", uid),
    limit(max)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}


export async function saveFinanceCustomerProfile(profileId, data, actor) {
  if (!profileId) throw new Error("Finance customer profile ID is required.");
  const ref = doc(db, "financeCustomerProfiles", profileId);
  const snapshot = await getDoc(ref);
  const payload = {
    ...data,
    updatedBy: actor.uid,
    updatedByName: actor.displayName || actor.email || "Sterling Finance",
    updatedAt: serverTimestamp()
  };
  if (!snapshot.exists()) {
    payload.createdBy = actor.uid;
    payload.createdByName = actor.displayName || actor.email || "Sterling Finance";
    payload.createdAt = serverTimestamp();
  }
  await setDoc(ref, payload, { merge: true });
  return { id: profileId };
}


function addMonthsToDateString(value, months = 1) {
  const base = value ? new Date(value + "T12:00:00") : new Date();
  if (Number.isNaN(base.getTime())) return "";
  base.setMonth(base.getMonth() + months);
  return base.toISOString().slice(0, 10);
}

export async function ensurePaymentAccount(data, actor) {
  const id = data.financeApplicationId || data.dealId;
  if (!id) throw new Error("A Finance package or Deal Jacket is required.");
  const ref = doc(db, "paymentAccounts", id);
  const snapshot = await getDoc(ref);
  const existing = snapshot.exists() ? snapshot.data() : null;
  const originalBalance = Number(data.originalBalance ?? data.amountFinanced ?? existing?.originalBalance ?? 0);
  const currentBalance = existing ? Number(existing.currentBalance ?? originalBalance) : originalBalance;
  const payload = {
    ...data,
    originalBalance,
    currentBalance,
    monthlyPayment: Number(data.monthlyPayment ?? existing?.monthlyPayment ?? 0),
    termMonths: Number(data.termMonths ?? existing?.termMonths ?? 0),
    paymentsMade: Number(existing?.paymentsMade || 0),
    totalPaid: Number(existing?.totalPaid || 0),
    status: existing?.status || data.status || "active",
    updatedBy: actor.uid,
    updatedByName: actor.displayName || actor.email || "Sterling Finance",
    updatedAt: serverTimestamp()
  };
  if (!existing) {
    payload.createdBy = actor.uid;
    payload.createdByName = actor.displayName || actor.email || "Sterling Finance";
    payload.createdAt = serverTimestamp();
  }
  await setDoc(ref, payload, { merge: true });
  return { id };
}

export async function recordVehiclePayment(accountId, data, actor) {
  const accountRef = doc(db, "paymentAccounts", accountId);
  const snapshot = await getDoc(accountRef);
  if (!snapshot.exists()) throw new Error("Payment account not found.");
  const account = snapshot.data();
  if (["repossessed", "closed"].includes(account.status || "")) throw new Error("Payments cannot be posted to this closed account.");

  const amount = Math.max(0, Number(data.amount || 0));
  if (!amount) throw new Error("Enter a payment amount.");
  const balanceBefore = Number(account.currentBalance ?? account.originalBalance ?? 0);
  const balanceAfter = Math.max(0, balanceBefore - amount);
  const paymentRef = doc(collection(db, "paymentTransactions"));
  const paidDate = data.paidDate || new Date().toISOString().slice(0, 10);
  const nextDueDate = balanceAfter <= 0 ? "" : addMonthsToDateString(account.nextDueDate || paidDate, 1);
  const nextStatus = balanceAfter <= 0 ? "paid_off" : (account.status === "defaulted" ? "defaulted" : "active");
  const batch = writeBatch(db);

  batch.set(paymentRef, {
    paymentAccountId: accountId,
    dealId: account.dealId || "",
    financeApplicationId: account.financeApplicationId || "",
    customerId: account.customerId || "",
    customerName: account.customerName || "",
    vehicleId: account.vehicleId || "",
    vehicleName: account.vehicleName || "",
    amount,
    paymentMethod: data.paymentMethod || "RP Payment",
    reference: data.reference || "",
    note: data.note || "",
    balanceBefore,
    balanceAfter,
    paidDate,
    recordedBy: actor.uid,
    recordedByName: actor.displayName || actor.email || "Sterling Finance",
    createdAt: serverTimestamp()
  });

  batch.update(accountRef, {
    currentBalance: balanceAfter,
    totalPaid: Number(account.totalPaid || 0) + amount,
    paymentsMade: Number(account.paymentsMade || 0) + 1,
    lastPaymentAmount: amount,
    lastPaymentDate: paidDate,
    nextDueDate,
    status: nextStatus,
    updatedBy: actor.uid,
    updatedByName: actor.displayName || actor.email || "Sterling Finance",
    updatedAt: serverTimestamp()
  });

  await batch.commit();
  return { id: paymentRef.id, balanceAfter };
}

export async function markVehiclePaymentDefault(accountId, reason, actor) {
  if (!String(reason || "").trim()) throw new Error("A default reason is required.");
  return updateDoc(doc(db, "paymentAccounts", accountId), {
    status: "defaulted",
    defaultReason: String(reason).trim(),
    defaultedAt: serverTimestamp(),
    defaultedBy: actor.uid,
    defaultedByName: actor.displayName || actor.email || "Sterling Finance",
    updatedAt: serverTimestamp()
  });
}

export async function repossessVehicleFromAccount(account, reason, actor) {
  if (!account?.id) throw new Error("Payment account is missing.");
  if (!account.vehicleId) throw new Error("No vehicle is linked to this payment account.");
  if (!String(reason || "").trim()) throw new Error("A repossession / take-back reason is required.");

  const recoveryId = account.id;
  const recoveryRef = doc(db, "vehicleRecoveryCases", recoveryId);
  const recoverySnapshot = await getDoc(recoveryRef);
  const vehicleRef = doc(db, "vehicles", account.vehicleId);
  const accountRef = doc(db, "paymentAccounts", account.id);
  const batch = writeBatch(db);

  batch.set(recoveryRef, {
    paymentAccountId: account.id,
    financeApplicationId: account.financeApplicationId || "",
    dealId: account.dealId || "",
    customerId: account.customerId || "",
    customerName: account.customerName || "",
    vehicleId: account.vehicleId,
    vehicleName: account.vehicleName || "",
    reason: String(reason).trim(),
    outstandingBalance: Number(account.currentBalance || 0),
    status: "service_review_required",
    serviceReviewStatus: "pending",
    managerApprovalStatus: "pending_service",
    recoveredBy: actor.uid,
    recoveredByName: actor.displayName || actor.email || "Sterling Finance",
    recoveredAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...(recoverySnapshot.exists() ? {} : { createdAt: serverTimestamp() })
  }, { merge: true });

  batch.update(accountRef, {
    status: "repossessed",
    recoveryCaseId: recoveryId,
    repossessionReason: String(reason).trim(),
    repossessedAt: serverTimestamp(),
    repossessedBy: actor.uid,
    repossessedByName: actor.displayName || actor.email || "Sterling Finance",
    updatedAt: serverTimestamp()
  });

  batch.update(vehicleRef, {
    status: "repossessed_service_review",
    location: "Service Intake / Recovery Inspection",
    sourceRecoveryCaseId: recoveryId,
    recoveryHold: true,
    repossessionReason: String(reason).trim(),
    formerOwnerCustomerId: account.customerId || "",
    formerOwnerCustomerName: account.customerName || "",
    ownerCustomerId: "",
    ownerCustomerName: "",
    updatedAt: serverTimestamp()
  });

  await batch.commit();
  return { id: recoveryId };
}
