import { createIcons, icons } from "lucide";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "firebase/auth";
import { auth } from "./firebase.js";
import {
  createCustomerProfile,
  getUserProfile,
  listCollection,
  listUsers,
  createCustomer,
  createVehicle,
  createDeal,
  createQueueEntry,
  updateRecord,
  writeAudit,
  createTestDrive,
  completeTestDrive,
  createNotification,
  markNotificationRead,
  updateUserAccess,
  getBootstrapStatus,
  claimBootstrap,
  createTradeIn,
  createFinanceApplication,
  createDelivery,
  createServiceAppointment,
  createRepairOrder,
  createPart,
  createPartRequest,
  createVehicleAcquisition,
  listVehicleAcquisitionsForUser,
  checkoutQueueEntry,
  saveTradeInForDeal,
  receiveTradeInVehicle,
  startAcquisitionReview,
  sendAcquisitionOffer,
  respondToAcquisitionOffer,
  receiveAcquisitionVehicle,
  staffAcceptAcquisitionOffer,
  createFinanceAppointment,
  listFinanceAppointmentsForUser,
  saveFinanceCustomerProfile,
  ensurePaymentAccount,
  recordVehiclePayment,
  markVehiclePaymentDefault,
  repossessVehicleFromAccount
} from "./services.js";

const app = document.querySelector("#app");

const state = {
  user: null,
  profile: null,
  page: "dashboard",
  data: { vehicles: [], deals: [], customers: [], queue: [], users: [], testDrives: [], notifications: [], tradeIns: [], financeApplications: [], deliveries: [], serviceAppointments: [], repairOrders: [], parts: [], partRequests: [], vehicleAcquisitions: [], financeAppointments: [], financeCustomerProfiles: [], paymentAccounts: [], paymentTransactions: [], vehicleRecoveryCases: [] },
  bootstrap: null,
  loading: true,
  flash: null
};

const navGroups = [
  {
    label:"Overview",
    items:[
      ["dashboard","layout-dashboard","Command Center"]
    ]
  },
  {
    label:"Front Office",
    items:[
      ["sales","badge-dollar-sign","Sales"],
      ["customers","users","Customers"],
      ["queue","concierge-bell","Reception"],
      ["inventory","car-front","Inventory"],
      ["acquisitions","badge-dollar-sign","Sell / Acquire"],
      ["financeAppointments","calendar-clock","Finance Appointment"],
      ["finance","landmark","Finance"],
      ["payments","receipt-text","Payments & Recovery"]
    ]
  },
  {
    label:"Fixed Operations",
    items:[
      ["service","wrench","Service"],
      ["parts","package-search","Parts"]
    ]
  },
  {
    label:"Administration",
    items:[
      ["staff","id-card","Staff"],
      ["audit","shield-check","Audit"]
    ]
  }
];

const nav = navGroups.flatMap(group => group.items);

const money = (n = 0) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0
}).format(Number(n) || 0);

const fmtDate = (value) => {
  if (!value) return "—";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const initials = (name = "Sterling User") => name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase();

function icon(name, cls = "") {
  return `<i data-lucide="${name}" class="${cls}"></i>`;
}

function can(permission) {
  const p = state.profile;
  if (!p?.isStaff) return false;
  const permissions = p.permissions || [];
  return permissions.includes("*") || permissions.includes("admin.full") || permissions.includes(permission);
}

function isManager() {
  return can("deals.approve") || can("admin.full");
}

function setFlash(message, type = "success") {
  state.flash = { message, type };
  render();
  window.setTimeout(() => {
    state.flash = null;
    render();
  }, 3200);
}

function safe(text = "") {
  return String(text).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

function statusPill(status = "unknown") {
  const s = String(status).toLowerCase().replaceAll("_", " ");
  return `<span class="status status-${safe(s.replaceAll(" ", "-"))}"><span></span>${safe(s)}</span>`;
}

function shell(content) {
  const profileName = state.profile?.displayName || state.user?.displayName || state.user?.email || "Sterling User";
  const role = state.profile?.role || "customer";
  const staff = !!state.profile?.isStaff;

  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">S</div>
          <div><strong>STERLING</strong><span>DRIVE</span></div>
        </div>
        <div class="brand-sub">MOTOR GROUP <span>•</span> OPERATIONS</div>

        <nav class="nav">
          ${navGroups.map(group => `<div class="nav-group">
            <div class="nav-group-label">${group.label}</div>
            ${group.items.map(([id, ico, label]) => {
              const blocked = !staff && !["dashboard", "inventory", "acquisitions", "financeAppointments"].includes(id);
              return `<button class="nav-item ${state.page === id ? "active" : ""} ${blocked ? "locked" : ""}" data-page="${id}" ${blocked ? "disabled" : ""}>
                <span class="nav-icon">${icon(ico)}</span><span class="nav-label">${label}</span>${blocked ? icon("lock-keyhole", "nav-lock") : state.page === id ? '<span class="active-rail"></span>' : ""}
              </button>`;
            }).join("")}
          </div>`).join("")}
        </nav>

        <div class="sidebar-footer">
          <div class="system-status"><span class="online-dot"></span><div><strong>DRIVE Online</strong><small>All core systems operational</small></div><span class="system-live">LIVE</span></div>
          <button class="profile-chip" id="profile-menu">
            <span class="avatar">${initials(profileName)}</span>
            <span><strong>${safe(profileName)}</strong><small>${safe(state.profile?.employeeId || role.replaceAll("_", " "))}</small></span>
            <span class="profile-role">${safe(state.profile?.department || (staff ? "Sterling Staff" : "Customer"))}</span>
            ${icon("chevron-up")}
          </button>
          <button class="signout" id="signout">${icon("log-out")} Sign out</button>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <button id="mobile-menu" class="icon-btn mobile-only">${icon("menu")}</button>
          <div class="top-context"><div class="breadcrumb"><span>Sterling Motors</span><b>/</b><strong>${safe(pageTitle())}</strong></div><small>${safe(pageSubtitle())}</small></div>
          <div class="top-actions">
            <button class="global-search" id="command-search" type="button">${icon("search")}<span>Search DRIVE</span><kbd>Ctrl K</kbd></button>
            <button class="icon-btn notification-btn" id="notifications-btn">${icon("bell")}${state.data.notifications.some(n => !n.read) ? `<span class="notification-dot"></span>` : ""}</button>
          </div>
        </header>

        <section class="content">
          ${state.flash ? `<div class="flash ${state.flash.type}">${icon(state.flash.type === "error" ? "circle-alert" : "circle-check")} ${safe(state.flash.message)}</div>` : ""}
          ${content}
        </section>
      </main>
    </div>
  `;
}

function pageTitle() {
  return nav.find(x => x[0] === state.page)?.[2] || "Command Center";
}

function pageSubtitle() {
  const copy = {
    dashboard:"Live dealership overview",
    sales:"Deals, desk approvals, and test drives",
    customers:"Customer relationship management",
    queue:"Front-of-house guest flow",
    inventory:"Vehicle stock and availability",
    acquisitions:"Customer vehicle purchases and appraisals",
    financeAppointments:"Finance consultation scheduling",
    finance:"F&I, payments, and delivery",
    payments:"Vehicle payment accounts, defaults, and recovery",
    service:"Repair and maintenance operations",
    parts:"Parts inventory and fulfillment",
    staff:"Employees, roles, and access",
    audit:"Security and operational history"
  };
  return copy[state.page] || "Sterling DRIVE";
}

function emptyState(iconName, title, body, action = "") {
  return `<div class="empty-state">
    <div class="empty-icon">${icon(iconName)}</div>
    <h3>${title}</h3><p>${body}</p>${action}
  </div>`;
}

function dashboard() {
  const vehicles = state.data.vehicles;
  const deals = state.data.deals;
  const queue = state.data.queue;
  const available = vehicles.filter(v => (v.status || "").toLowerCase() === "available").length;
  const activeDeals = deals.filter(d => !["complete", "lost", "cancelled"].includes((d.stage || "").toLowerCase())).length;
  const revenue = deals.filter(d => (d.stage || "").toLowerCase() === "complete")
    .reduce((sum, d) => sum + Number(d.finalPrice || d.price || 0), 0);
  const waiting = queue.filter(q => (q.status || "").toLowerCase() === "waiting").length;

  const recentDeals = deals.slice(0, 5);
  const recentQueue = queue.slice(0, 5);
  const approvals = deals.filter(d => (d.stage || "").replaceAll("_"," ").toLowerCase() === "manager review").length;
  const activeTestDrives = state.data.testDrives.filter(d => d.status === "active").length;
  const financeWaiting = deals.filter(d => (d.stage || "").toLowerCase() === "finance").length;
  const deliveryWaiting = deals.filter(d => (d.stage || "").toLowerCase() === "delivery").length;
  const serviceOpen = state.data.repairOrders.filter(r => !["closed","cancelled"].includes((r.status || "").toLowerCase())).length;
  const partsWaiting = state.data.partRequests.filter(r => ["requested","backordered"].includes((r.status || "requested").toLowerCase())).length;

  return `
    <div class="hero-row command-hero">
      <div>
        <div class="hero-status"><span class="live-pulse"></span> LIVE DEALERSHIP OPERATIONS</div>
        <h1>Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, <em>${safe((state.profile?.displayName || "team").split(" ")[0])}</em>.</h1>
        <p>See the floor, clear bottlenecks, and keep every deal moving.</p>
      </div>
      <div class="hero-actions">
        ${can("sales.manage") ? `<button class="btn secondary" data-action="new-customer">${icon("user-plus")} New Customer</button>` : ""}
        ${can("inventory.manage") ? `<button class="btn primary" data-action="new-vehicle">${icon("plus")} Add Vehicle</button>` : ""}
      </div>
    </div>

    ${state.bootstrap && !state.bootstrap.initialized ? bootstrapBanner() : ""}
    <div class="metric-grid">
      ${metric("Vehicles Available", available, "car-front", "Inventory ready for sale")}
      ${metric("Active Deals", activeDeals, "handshake", "Across the sales floor")}
      ${metric("Waiting Customers", waiting, "clock-3", waiting ? "Needs attention" : "No current wait")}
      ${metric("Closed Revenue", money(revenue), "circle-dollar-sign", "Completed deals")}
    </div>

    <div class="attention-strip">
      <button class="attention-item ${approvals ? "needs-attention" : ""}" data-page="sales"><span class="attention-icon">${icon("badge-check")}</span><div><small>Desk Approvals</small><strong>${approvals}</strong></div><span class="attention-copy">${approvals ? "Needs manager review" : "Desk is clear"}</span>${icon("chevron-right")}</button>
      <button class="attention-item ${activeTestDrives ? "active-attention" : ""}" data-page="sales"><span class="attention-icon">${icon("navigation")}</span><div><small>Test Drives Out</small><strong>${activeTestDrives}</strong></div><span class="attention-copy">${activeTestDrives ? "Vehicles currently out" : "No vehicles out"}</span>${icon("chevron-right")}</button>
      <button class="attention-item ${financeWaiting ? "active-attention" : ""}" data-page="finance"><span class="attention-icon">${icon("landmark")}</span><div><small>Finance Queue</small><strong>${financeWaiting}</strong></div><span class="attention-copy">${financeWaiting ? "Awaiting F&I" : "Queue is clear"}</span>${icon("chevron-right")}</button>
      <button class="attention-item ${deliveryWaiting ? "active-attention" : ""}" data-page="finance"><span class="attention-icon">${icon("key-round")}</span><div><small>Deliveries</small><strong>${deliveryWaiting}</strong></div><span class="attention-copy">${deliveryWaiting ? "Ready for handoff" : "No pending deliveries"}</span>${icon("chevron-right")}</button>
      <button class="attention-item ${serviceOpen ? "active-attention" : ""}" data-page="service"><span class="attention-icon">${icon("wrench")}</span><div><small>Open ROs</small><strong>${serviceOpen}</strong></div><span class="attention-copy">${serviceOpen ? "Service work in progress" : "Shop is clear"}</span>${icon("chevron-right")}</button>
      <button class="attention-item ${partsWaiting ? "needs-attention" : ""}" data-page="parts"><span class="attention-icon">${icon("package-search")}</span><div><small>Parts Requests</small><strong>${partsWaiting}</strong></div><span class="attention-copy">${partsWaiting ? "Counter action needed" : "No open requests"}</span>${icon("chevron-right")}</button>
    </div>

    <div class="dashboard-grid">
      <div class="panel wide">
        <div class="panel-head"><div><span class="eyebrow">SALES FLOOR</span><h2>Active Deal Jackets</h2></div><button class="text-btn" data-page="sales">View all ${icon("arrow-up-right")}</button></div>
        ${recentDeals.length ? `
          <div class="table-wrap"><table>
            <thead><tr><th>Deal</th><th>Customer</th><th>Vehicle</th><th>Stage</th><th>Value</th></tr></thead>
            <tbody>${recentDeals.map(d => `<tr>
              <td><strong>${safe(d.dealNumber || d.id.slice(0, 8).toUpperCase())}</strong></td>
              <td>${safe(d.customerName || "Unassigned")}</td>
              <td>${safe(d.vehicleName || "Vehicle pending")}</td>
              <td>${statusPill(d.stage || "shopping")}</td>
              <td>${money(d.finalPrice || d.price || 0)}</td>
            </tr>`).join("")}</tbody>
          </table></div>`
          : emptyState("handshake", "No deal jackets yet", "Create your first customer deal and it will appear here.", can("sales.manage") ? `<button class="btn primary small" data-action="new-deal">Start a Deal</button>` : "")}
      </div>

      <div class="panel">
        <div class="panel-head"><div><span class="eyebrow">RECEPTION</span><h2>Live Queue</h2></div><span class="live-badge"><span></span>LIVE</span></div>
        ${recentQueue.length ? `<div class="queue-list">${recentQueue.map((q, i) => `
          <div class="queue-row">
            <span class="queue-ticket">${safe(q.ticket || "A" + String(i + 1).padStart(3, "0"))}</span>
            <div><strong>${safe(q.customerName || "Guest")}</strong><small>${safe(q.reason || "Dealership visit")}</small></div>
            ${statusPill(q.status || "waiting")}
          </div>`).join("")}</div>`
          : emptyState("users-round", "Lobby is clear", "Waiting customers will appear here in real time.")}
      </div>

      <div class="panel">
        <div class="panel-head"><div><span class="eyebrow">OPERATIONS</span><h2>Quick Actions</h2></div></div>
        <div class="quick-grid">
          ${quick("Scan Vehicle", "scan-line", "inventory")}
          ${quick("Reception Queue", "concierge-bell", "queue")}
          ${quick("Find Customer", "search", "customers")}
          ${quick("Staff Directory", "id-card", "staff")}
          ${quick("Service Drive", "wrench", "service")}
          ${quick("Parts Counter", "package-search", "parts")}
        </div>
      </div>
    </div>
  `;
}

function metric(label, value, ico, note) {
  return `<div class="metric-card">
    <div class="metric-icon">${icon(ico)}</div>
    <div><span>${label}</span><strong>${value}</strong><small>${note}</small></div>
  </div>`;
}

function quick(label, ico, page) {
  return `<button class="quick-action" data-page="${page}"><span>${icon(ico)}</span><strong>${label}</strong>${icon("arrow-right")}</button>`;
}

function inventory() {
  const rows = state.data.vehicles;
  return `
    ${pageHeader("INVENTORY CONTROL", "Vehicle Inventory", "Manage stock, VIN records, pricing, status, and dealership availability.",
      can("inventory.manage") ? `<button class="btn primary" data-action="new-vehicle">${icon("plus")} Add Vehicle</button>` : "")}
    <div class="toolbar">
      <div class="search-box">${icon("search")}<input data-filter="inventory" placeholder="Search stock, VIN, make, model..." /></div>
      <button class="filter-btn">${icon("sliders-horizontal")} Filters</button>
      <div class="toolbar-count">${rows.length} vehicle${rows.length === 1 ? "" : "s"}</div>
    </div>
    <div class="panel no-pad">
      ${rows.length ? `<div class="table-wrap"><table class="data-table">
        <thead><tr><th>Vehicle</th><th>Stock / VIN</th><th>Status</th><th>Mileage</th><th>Price</th><th></th></tr></thead>
        <tbody id="inventory-rows">${rows.map(v => vehicleRow(v)).join("")}</tbody>
      </table></div>` : emptyState("car-front", "Inventory is empty", "Add the first Sterling Motors vehicle to begin building the lot.", can("inventory.manage") ? `<button class="btn primary" data-action="new-vehicle">Add First Vehicle</button>` : "")}
    </div>
  `;
}

function vehicleRow(v) {
  const name = `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim() || v.name || "Unnamed Vehicle";
  return `<tr data-search="${safe([name, v.stockNumber, v.vin, v.trim, v.color].join(" ").toLowerCase())}">
    <td><div class="vehicle-cell"><span class="vehicle-thumb">${icon("car-front")}</span><div><strong>${safe(name)}</strong><small>${safe(v.trim || v.color || "Sterling inventory")}</small></div></div></td>
    <td><strong>${safe(v.stockNumber || "—")}</strong><small class="block">${safe(v.vin || "VIN pending")}</small></td>
    <td>${statusPill(v.status || "available")}</td>
    <td>${Number(v.mileage || 0).toLocaleString()} mi</td>
    <td><strong>${money(v.price)}</strong><small class="block">MSRP ${money(v.msrp || v.price)}</small></td>
    <td><div class="row-actions">
      ${v.status==="retail_ready" && (can("inventory.manage")||can("sales.manage")||can("admin.full")||can("acquisitions.manage")) ? `<button class="btn primary small" data-push-floor="${v.id}">${icon("store")} Push to Floor</button>` : ""}
      <button class="icon-btn" data-vehicle="${v.id}" title="Open vehicle record">${icon("arrow-up-right")}</button>
    </div></td>
  </tr>`;
}

function sales() {
  const deals = state.data.deals;
  return `
    ${pageHeader("SALES OPERATIONS", "Deal Jackets", "Track every vehicle transaction from first contact through final delivery.",
      can("sales.manage") ? `<button class="btn primary" data-action="new-deal">${icon("plus")} Start Deal</button>` : "")}
    <div class="stage-strip">
      ${["shopping","test drive","negotiation","manager review","finance","documents","delivery","complete"].map(stage => {
        const count = deals.filter(d => (d.stage || "shopping").replaceAll("_"," ").toLowerCase() === stage).length;
        return `<div class="stage"><span>${stage}</span><strong>${count}</strong></div>`;
      }).join("")}
    </div>
    <div class="panel no-pad">
      ${deals.length ? `<div class="table-wrap"><table class="data-table">
        <thead><tr><th>Deal</th><th>Customer</th><th>Vehicle</th><th>Salesperson</th><th>Stage</th><th>Value</th><th>Opened</th></tr></thead>
        <tbody>${deals.map(d => `<tr class="clickable-row" data-deal="${d.id}">
          <td><strong>${safe(d.dealNumber || d.id.slice(0,8).toUpperCase())}</strong></td>
          <td>${safe(d.customerName || "Unassigned")}</td>
          <td>${safe(d.vehicleName || "Pending")}</td>
          <td>${safe(d.salespersonName || state.profile?.displayName || "—")}</td>
          <td>${statusPill(d.stage || "shopping")}</td>
          <td><strong>${money(d.finalPrice || d.price || 0)}</strong></td>
          <td>${fmtDate(d.createdAt)}</td>
        </tr>`).join("")}</tbody>
      </table></div>` : emptyState("handshake", "No active deals", "Start a Deal Jacket when a customer begins shopping.", can("sales.manage") ? `<button class="btn primary" data-action="new-deal">Start First Deal</button>` : "")}
    </div>
  `;
}

function customers() {
  const customers = state.data.customers;
  return `
    ${pageHeader("CUSTOMER RELATIONSHIP MANAGEMENT", "Customers", "Customer profiles connect sales, ownership, service, and dealership history.",
      can("customers.manage") || can("sales.manage") ? `<button class="btn primary" data-action="new-customer">${icon("user-plus")} New Customer</button>` : "")}
    <div class="toolbar">
      <div class="search-box">${icon("search")}<input data-filter="customers" placeholder="Search customers..." /></div>
      <div class="toolbar-count">${customers.length} profile${customers.length === 1 ? "" : "s"}</div>
    </div>
    <div class="customer-grid" id="customer-grid">
      ${customers.length ? customers.map(c => `<article class="customer-card" data-search="${safe([c.name,c.email,c.phone,c.customerNumber].join(" ").toLowerCase())}">
        <div class="customer-top"><span class="avatar lg">${initials(c.name)}</span><div><h3>${safe(c.name || "Customer")}</h3><span>${safe(c.customerNumber || c.id.slice(0,8).toUpperCase())}</span></div>${statusPill(c.status || "active")}</div>
        <div class="customer-meta"><span>${icon("mail")} ${safe(c.email || "No email")}</span><span>${icon("phone")} ${safe(c.phone || "No phone")}</span></div>
        <div class="customer-footer"><small>Customer since ${fmtDate(c.createdAt)}</small><button class="text-btn" data-customer="${c.id}">Open profile ${icon("arrow-up-right")}</button></div>
      </article>`).join("") : emptyState("users", "No customer profiles yet", "Create a customer profile to begin their Sterling history.", can("sales.manage") ? `<button class="btn primary" data-action="new-customer">Create Customer</button>` : "")}
    </div>
  `;
}

function queuePage() {
  const queue = state.data.queue;
  const canWorkQueue = can("queue.manage") || can("sales.manage") || can("service.manage");
  const labels = { waiting:"Waiting", claimed:"Claimed", "with staff":"With Staff", complete:"Checked Out" };
  const findCustomer = q => state.data.customers.find(c =>
    (q.customerId && c.id === q.customerId) ||
    (!q.customerId && c.name && q.customerName && c.name.trim().toLowerCase() === q.customerName.trim().toLowerCase())
  );

  return `
    ${pageHeader("FRONT OF HOUSE", "Reception Queue", "Check customers in, open their customer record, and check them out when their visit is finished.",
      canWorkQueue ? `<button class="btn primary" data-action="new-queue">${icon("plus")} Check In Customer</button>` : "")}
    <div class="queue-board">
      ${["waiting","claimed","with staff","complete"].map(status => {
        const items = queue.filter(q => (q.status || "waiting").replaceAll("_"," ").toLowerCase() === status);
        return `<section class="queue-column"><div class="queue-column-head"><span>${labels[status]}</span><b>${items.length}</b></div>
          <div class="queue-stack">${items.length ? items.map(q => {
            const customer = findCustomer(q);
            return `<article class="queue-ticket-card ${status==="complete"?"checked-out-card":""}">
              <div><span class="queue-ticket">${safe(q.ticket || "GUEST")}</span>${statusPill(q.status || "waiting")}</div>
              <h3>${safe(q.customerName || "Guest")}</h3>
              <p>${safe(q.reason || "Dealership visit")}</p>
              <small>${status==="complete" ? `Checked out ${fmtDate(q.checkedOutAt || q.updatedAt)}${q.checkedOutByName ? " • "+safe(q.checkedOutByName) : ""}` : `Checked in ${fmtDate(q.createdAt)}`}</small>
              ${q.checkoutOutcome ? `<div class="queue-outcome">${icon("circle-check")} ${safe(q.checkoutOutcome)}</div>` : ""}
              <div class="queue-card-actions">
                ${customer ? `<button class="btn secondary small" data-customer="${customer.id}">${icon("user-round-search")} Customer Info</button>` : ""}
                ${status === "waiting" && canWorkQueue ? `<button class="btn secondary small" data-claim="${q.id}">${icon("hand")} Claim</button>` : ""}
                ${status !== "complete" && can("sales.manage") ? (q.activeDealId ? `<button class="btn primary small" data-queue-deal="${q.activeDealId}">${icon("handshake")} Open Deal</button>` : `<button class="btn primary small" data-start-queue-deal="${q.id}">${icon("handshake")} Start Deal</button>`) : ""}
                ${status !== "complete" && canWorkQueue ? `<button class="btn checkout-btn small" data-checkout="${q.id}">${icon("log-out")} Check Out</button>` : ""}
              </div>
            </article>`;
          }).join("") : `<div class="column-empty">No customers</div>`}</div>
        </section>`;
      }).join("")}
    </div>
  `;
}

function staffPage() {
  const users = state.data.users.filter(u => u.isStaff);
  return `
    ${pageHeader("STERLING MOTOR GROUP", "Staff Directory", "Employee identity, department, status, and access across Sterling DRIVE.",
      can("admin.full") ? `<button class="btn primary" data-action="manage-staff">${icon("user-cog")} Manage Access</button>` : "")}
    <div class="staff-grid">
      ${users.length ? users.map(u => `<article class="staff-card">
        <div class="staff-band"></div>
        <span class="avatar xl">${initials(u.displayName)}</span>
        <h3>${safe(u.displayName || u.email)}</h3>
        <p>${safe(u.role || "Employee")}</p>
        <div class="staff-details"><span>${icon("building-2")} ${safe(u.department || "Sterling Motors")}</span><span>${icon("badge-check")} ${safe(u.employeeId || "ID pending")}</span></div>
        ${statusPill(u.status || "active")}
        ${can("admin.full") ? `<button class="btn secondary small staff-manage-btn" data-staff="${u.id}">${icon("settings-2")} Manage</button>` : ""}
      </article>`).join("") : emptyState("id-card", "No staff profiles found", "Staff accounts will appear here after an administrator provisions them.")}
    </div>
  `;
}


function bootstrapBanner() {
  return `<div class="bootstrap-banner">
    <div class="bootstrap-icon">${icon("crown")}</div>
    <div><span class="eyebrow">FIRST-RUN SETUP</span><h3>Sterling DRIVE has not been claimed yet.</h3><p>The first signed-in account can securely become Dealer Principal and receive employee ID SMG-0001. This option disappears after initialization.</p></div>
    <button class="btn primary" data-action="claim-bootstrap">${icon("shield-check")} Claim Dealer Principal</button>
  </div>`;
}

function bootstrapModal() {
  modal("Initialize Sterling Motor Group", `
    <div class="bootstrap-confirm">
      <div class="bootstrap-seal">${icon("crown")}</div>
      <h3>Claim the first Sterling executive account</h3>
      <p>This will promote <strong>${safe(state.profile?.displayName || state.user?.email || "this account")}</strong> to Dealer Principal, assign employee ID <strong>SMG-0001</strong>, and grant full Sterling DRIVE access.</p>
      <div class="manager-note"><span>ONE-TIME ACTION</span><p>After the bootstrap record is created, this public initialization path is permanently closed by Firestore security rules.</p></div>
    </div>
  `, `<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="confirm-bootstrap">${icon("crown")} Claim SMG-0001</button>`);
  document.querySelector("#confirm-bootstrap")?.addEventListener("click", async () => {
    try {
      await claimBootstrap(state.user, state.profile?.displayName || state.user?.displayName || "");
      state.profile = await getUserProfile(state.user.uid);
      state.bootstrap = await getBootstrapStatus();
      closeModal();
      await refreshData();
      setFlash("Sterling DRIVE initialized. You are now Dealer Principal • SMG-0001.");
    } catch (e) {
      setFlash(e.message || "Bootstrap could not be completed. Deploy the latest Firestore rules and try again.", "error");
    }
  });
}

function financePurposeLabel(value) {
  const labels = {
    payment_plan:"Payment Plan / Monthly Budget",
    down_payment:"Down Payment Options",
    terms:"Term Length / APR Scenarios",
    existing_deal:"Existing Deal Financing",
    products:"F&I Products / Coverage",
    delivery:"Contract / Delivery Questions",
    general:"General Finance Consultation"
  };
  return labels[value] || String(value || "Finance Consultation").replaceAll("_"," ");
}

function financeAppointmentsPage() {
  const appointments=state.data.financeAppointments || [];
  const staff=!!state.profile?.isStaff;
  const canManage=can("finance.manage") || can("admin.full");
  const requested=appointments.filter(a=>(a.status||"requested")==="requested").length;
  const confirmed=appointments.filter(a=>(a.status||"")==="confirmed").length;
  const checkedIn=appointments.filter(a=>(a.status||"")==="checked_in").length;
  const completed=appointments.filter(a=>(a.status||"")==="completed").length;

  return `
    ${pageHeader(staff?"F&I CONSULTATIONS":"FINANCE APPOINTMENTS","Finance Appointments",
      staff
        ? "Schedule and manage customer consultations about payment plans, monthly-payment goals, down payments, terms, and F&I questions."
        : "Meet with Sterling Finance to discuss a fictional payment plan, monthly-payment goal, down payment, term options, or questions about financing.",
      `<button class="btn primary" data-action="new-finance-appointment">${icon("calendar-plus")} ${staff?"Schedule Appointment":"Request Appointment"}</button>`)}

    ${staff ? `<div class="metric-grid">
      ${metric("New Requests",requested,"calendar-plus","Waiting for Finance confirmation")}
      ${metric("Confirmed",confirmed,"calendar-check","Upcoming consultations")}
      ${metric("Checked In",checkedIn,"user-check","Customers with Finance now")}
      ${metric("Completed",completed,"circle-check-big","Consultations completed")}
    </div>` : `
      <div class="finance-consult-hero">
        <span class="finance-consult-icon">${icon("landmark")}</span>
        <div><span class="eyebrow">TALK WITH STERLING FINANCE</span><h2>Plan the payment before you sign.</h2><p>Request a consultation to talk through fictional payment scenarios and deal options with Finance. No real SSN, credit report, income documentation, or banking information is needed.</p></div>
        <button class="btn primary" data-action="new-finance-appointment">${icon("calendar-plus")} Request Consultation</button>
      </div>
    `}

    ${appointments.length ? (staff ? `
      <div class="panel no-pad">
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Customer</th><th>Purpose</th><th>Requested</th><th>Scheduled</th><th>Finance Rep</th><th>Status</th><th></th></tr></thead>
          <tbody>${appointments.map(a=>`<tr>
            <td><strong>${safe(a.requesterName||"Customer")}</strong><small class="block">${safe(a.requesterEmail||"")}</small></td>
            <td><strong>${safe(financePurposeLabel(a.purpose))}</strong><small class="block">${a.monthlyGoal?money(a.monthlyGoal)+"/mo goal":"No payment target entered"}</small></td>
            <td>${safe(a.preferredDate||"—")}<small class="block">${safe(a.preferredTime||"Flexible")}</small></td>
            <td>${a.confirmedDate?safe(a.confirmedDate):"Not confirmed"}<small class="block">${safe(a.confirmedTime||"")}</small></td>
            <td>${safe(a.financeRepresentativeName||"Unassigned")}</td>
            <td>${statusPill(a.status||"requested")}</td>
            <td><button class="btn ${a.status==="requested"?"primary":"secondary"} small" data-finance-appointment="${a.id}">${icon("calendar-clock")} Manage</button></td>
          </tr>`).join("")}</tbody>
        </table></div>
      </div>
    ` : `
      <div class="finance-appointment-grid">
        ${appointments.map(a=>`<article class="finance-appointment-card ${a.status==="confirmed"?"confirmed":""}">
          <div class="finance-appointment-head"><span class="record-list-icon">${icon("calendar-clock")}</span><div><span class="eyebrow">${a.status==="confirmed"?"APPOINTMENT CONFIRMED":"FINANCE CONSULTATION"}</span><h3>${safe(financePurposeLabel(a.purpose))}</h3><p>Requested ${fmtDate(a.createdAt)}</p></div>${statusPill(a.status||"requested")}</div>
          <div class="finance-appointment-details">
            <div><span>Preferred</span><strong>${safe(a.preferredDate||"—")} ${safe(a.preferredTime||"")}</strong></div>
            <div><span>Scheduled</span><strong>${a.confirmedDate ? safe(a.confirmedDate+" "+(a.confirmedTime||"")) : "Waiting for confirmation"}</strong></div>
            <div><span>Finance Representative</span><strong>${safe(a.financeRepresentativeName||"To be assigned")}</strong></div>
            <div><span>Payment Goal</span><strong>${a.monthlyGoal?money(a.monthlyGoal)+"/mo":"Not specified"}</strong></div>
          </div>
          ${a.customerMessage?`<div class="finance-customer-message">${icon("message-circle")}<div><span>FROM STERLING FINANCE</span><p>${safe(a.customerMessage)}</p></div></div>`:""}
          ${["requested","confirmed"].includes(a.status||"requested") ? `<button class="btn secondary" data-cancel-finance-appointment="${a.id}">${icon("calendar-x")} Cancel Appointment</button>` : ""}
        </article>`).join("")}
      </div>
    `) : emptyState("calendar-clock",staff?"No Finance appointments":"No Finance appointments yet",staff?"Customer consultation requests will appear here.":"Request a consultation when you'd like to discuss payment options with Sterling Finance.",`<button class="btn primary" data-action="new-finance-appointment">${icon("calendar-plus")} Request Appointment</button>`)}

    <div class="rp-disclaimer">${icon("shield-check")} Finance appointments are for Sterling Motors roleplay. Do not enter real SSNs, bank account information, credit reports, or other sensitive financial information.</div>
  `;
}

function financeAppointmentModal(preselectedClient = null) {
  const staff=!!state.profile?.isStaff;
  const customers=state.data.customers || [];
  const preselectedContact = staff && preselectedClient && !preselectedClient.customerId ? `<option value="__finance_contact__" data-name="${safe(preselectedClient.name||"Finance Customer")}" data-email="${safe(preselectedClient.email||"")}" data-uid="${safe(preselectedClient.linkedUid||"")}" selected>${safe(preselectedClient.name||"Finance Contact")} • Finance contact</option>` : "";
  modal(staff ? "Schedule Finance Appointment" : "Request Finance Appointment",`
    <form id="finance-appointment-form" class="form-grid">
      ${staff ? `<div class="field full"><label>Customer</label><select class="plain-input" id="faCustomer" required><option value="">Select customer</option>${preselectedContact}${customers.map(x=>`<option value="${x.id}" data-name="${safe(x.name||"Customer")}" data-email="${safe(x.email||"")}" data-uid="${safe(x.linkedUid||"")}">${safe(x.name||x.email||x.id)}</option>`).join("")}</select></div>` : ""}
      <div class="field full"><label>What would you like to discuss?</label><select class="plain-input" id="faPurpose">
        <option value="payment_plan">Payment Plan / Monthly Budget</option>
        <option value="down_payment">Down Payment Options</option>
        <option value="terms">Term Length / APR Scenarios</option>
        <option value="existing_deal">Existing Deal Financing</option>
        <option value="products">F&I Products / Coverage</option>
        <option value="delivery">Contract / Delivery Questions</option>
        <option value="general">General Finance Consultation</option>
      </select></div>
      ${formField("Preferred Date","faDate","","date","required")}
      ${formField("Preferred Time","faTime","","time","required")}
      ${formField("Monthly Payment Goal (RP only)","faMonthlyGoal","0","number","min='0'")}
      <div class="field"><label>Time Flexibility</label><select class="plain-input" id="faFlexibility"><option>Exact time preferred</option><option>Within 1 hour</option><option>Morning</option><option>Afternoon</option><option>Any time that day</option></select></div>
      <div class="field full"><label>What should Finance know? <span class="optional-label">Optional</span></label><textarea class="plain-input textarea" id="faNotes" placeholder="Example: I want to compare a lower monthly payment with a shorter term. Do not enter real financial account or credit information."></textarea></div>
    </form>
    <div class="rp-disclaimer compact">${icon("info")} This is a consultation request, not a real credit application.</div>
  `,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-finance-appointment">${icon("calendar-plus")} ${staff?"Schedule":"Request Appointment"}</button>`);

  if(staff && preselectedClient?.customerId){
    const select=document.querySelector("#faCustomer");
    if(select) select.value=preselectedClient.customerId;
  }
  if(preselectedClient?.profile?.monthlyPaymentGoal){
    const goal=document.querySelector("#faMonthlyGoal");
    if(goal) goal.value=preselectedClient.profile.monthlyPaymentGoal;
  }

  document.querySelector("#save-finance-appointment")?.addEventListener("click",async()=>{
    const form=document.querySelector("#finance-appointment-form");if(!form.reportValidity())return;
    const btn=document.querySelector("#save-finance-appointment");btn.disabled=true;
    let requesterUid=state.user.uid, requesterName=state.profile?.displayName||state.user.email, requesterEmail=state.user.email||"", customerId="";
    if(staff){
      const cs=document.querySelector("#faCustomer");
      const opt=cs.selectedOptions[0];
      customerId=cs.value==="__finance_contact__" ? "" : cs.value;
      requesterUid=opt.dataset.uid||"";
      requesterName=opt.dataset.name||"Customer";
      requesterEmail=opt.dataset.email||"";
    }
    const data={
      requesterUid,requesterName,requesterEmail,customerId,
      purpose:document.querySelector("#faPurpose").value,
      preferredDate:document.querySelector("#faDate").value,
      preferredTime:document.querySelector("#faTime").value,
      flexibility:document.querySelector("#faFlexibility").value,
      monthlyGoal:Number(document.querySelector("#faMonthlyGoal").value||0),
      notes:document.querySelector("#faNotes").value.trim(),
      status:staff?"confirmed":"requested",
      confirmedDate:staff?document.querySelector("#faDate").value:"",
      confirmedTime:staff?document.querySelector("#faTime").value:"",
      financeRepresentativeUid:staff?state.user.uid:"",
      financeRepresentativeName:staff?(state.profile?.displayName||state.user.email):""
    };
    try{
      const result=await createFinanceAppointment(data,state.user);
      if(staff) await writeAudit(state.user,"finance.appointment_created","financeAppointment",result.id,{customerId,purpose:data.purpose});
      closeModal();await refreshData();setFlash(staff?"Finance appointment scheduled.":"Finance appointment requested. Sterling Finance can now confirm the time.");
    }catch(e){btn.disabled=false;setFlash(e.message||"Unable to create Finance appointment.","error");}
  });
}

function manageFinanceAppointmentModal(a) {
  if(!a)return;
  const status=a.status||"requested";
  const client=financeClientDirectory().find(c=>
    (a.customerId && c.customerId===a.customerId) ||
    (a.requesterUid && c.linkedUid===a.requesterUid) ||
    (a.requesterEmail && String(c.email||"").toLowerCase()===String(a.requesterEmail||"").toLowerCase())
  );
  modal("Finance Appointment",`
    <div class="finance-appointment-manage-head">
      <span class="record-icon">${icon("calendar-clock")}</span>
      <div><span class="eyebrow">FINANCE CONSULTATION</span><h3>${safe(a.requesterName||"Customer")}</h3><p>${safe(financePurposeLabel(a.purpose))}</p></div>
      ${statusPill(status)}
    </div>
    <div class="record-grid">
      <div><span>Preferred Date</span><strong>${safe(a.preferredDate||"—")}</strong></div>
      <div><span>Preferred Time</span><strong>${safe(a.preferredTime||"—")}</strong></div>
      <div><span>Flexibility</span><strong>${safe(a.flexibility||"—")}</strong></div>
      <div><span>Payment Goal</span><strong>${a.monthlyGoal?money(a.monthlyGoal)+"/mo":"Not specified"}</strong></div>
      <div><span>Confirmed</span><strong>${a.confirmedDate?safe(a.confirmedDate+" "+(a.confirmedTime||"")):"Not confirmed"}</strong></div>
      <div><span>Finance Rep</span><strong>${safe(a.financeRepresentativeName||"Unassigned")}</strong></div>
    </div>
    ${a.notes?`<div class="manager-note"><span>CUSTOMER NOTES</span><p>${safe(a.notes)}</p></div>`:""}
    ${a.customerMessage?`<div class="finance-customer-message">${icon("message-circle")}<div><span>CUSTOMER-FACING MESSAGE</span><p>${safe(a.customerMessage)}</p></div></div>`:""}
    <div class="workflow-actions">
      ${client?`<button class="btn secondary" id="appointment-finance-profile">${icon("folder-open")} Finance Profile</button>`:""}
      ${["requested","confirmed"].includes(status)?`<button class="btn primary" id="confirm-finance-appointment">${icon("calendar-check")} ${status==="requested"?"Confirm Appointment":"Reschedule"}</button>`:""}
      ${status==="confirmed"?`<button class="btn secondary" id="checkin-finance-appointment">${icon("user-check")} Check In</button>`:""}
      ${status==="checked_in"?`<button class="btn primary" id="complete-finance-appointment">${icon("circle-check-big")} Complete Consultation</button>`:""}
      ${!["completed","cancelled"].includes(status)?`<button class="btn danger-btn" id="cancel-finance-appointment-staff">${icon("calendar-x")} Cancel</button>`:""}
    </div>
  `);

  document.querySelector("#appointment-finance-profile")?.addEventListener("click",()=>financeCustomerDetailModal(client));
  document.querySelector("#confirm-finance-appointment")?.addEventListener("click",()=>confirmFinanceAppointmentModal(a));
  document.querySelector("#checkin-finance-appointment")?.addEventListener("click",async()=>{
    try{
      await updateRecord("financeAppointments",a.id,{status:"checked_in",checkedInAt:new Date().toISOString(),checkedInBy:state.user.uid,checkedInByName:state.profile?.displayName||state.user.email});
      await writeAudit(state.user,"finance.appointment_checked_in","financeAppointment",a.id,{});
      closeModal();await refreshData();setFlash("Customer checked in with Finance.");
    }catch(e){setFlash(e.message||"Unable to check in appointment.","error");}
  });
  document.querySelector("#complete-finance-appointment")?.addEventListener("click",()=>completeFinanceAppointmentModal(a));
  document.querySelector("#cancel-finance-appointment-staff")?.addEventListener("click",()=>cancelFinanceAppointmentModal(a,true));
}

function confirmFinanceAppointmentModal(a) {
  modal(a.status==="requested"?"Confirm Finance Appointment":"Reschedule Finance Appointment",`
    <form id="confirm-fa-form" class="form-grid">
      ${formField("Appointment Date","faConfirmDate",a.confirmedDate||a.preferredDate||"","date","required")}
      ${formField("Appointment Time","faConfirmTime",a.confirmedTime||a.preferredTime||"","time","required")}
      ${formField("Finance Representative","faRep",a.financeRepresentativeName||state.profile?.displayName||state.user.email,"text","required")}
      <div class="field"><label>Duration</label><select class="plain-input" id="faDuration"><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></div>
      <div class="field full"><label>Message to Customer <span class="optional-label">Optional</span></label><textarea class="plain-input textarea" id="faCustomerMessage" placeholder="Example: Bring your Deal Jacket number if you already started a vehicle purchase.">${safe(a.customerMessage||"")}</textarea></div>
    </form>
  `,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-fa-confirmation">${icon("calendar-check")} Confirm Time</button>`);
  for(const [id,val] of [["faConfirmDate",a.confirmedDate||a.preferredDate||""],["faConfirmTime",a.confirmedTime||a.preferredTime||""],["faRep",a.financeRepresentativeName||state.profile?.displayName||state.user.email]]){const el=document.querySelector("#"+id);if(el)el.value=val;}
  document.querySelector("#save-fa-confirmation")?.addEventListener("click",async()=>{
    const form=document.querySelector("#confirm-fa-form");if(!form.reportValidity())return;
    try{
      await updateRecord("financeAppointments",a.id,{
        status:"confirmed",
        confirmedDate:document.querySelector("#faConfirmDate").value,
        confirmedTime:document.querySelector("#faConfirmTime").value,
        durationMinutes:Number(document.querySelector("#faDuration").value||30),
        financeRepresentativeUid:state.user.uid,
        financeRepresentativeName:document.querySelector("#faRep").value.trim(),
        customerMessage:document.querySelector("#faCustomerMessage").value.trim(),
        confirmedAt:new Date().toISOString()
      });
      await writeAudit(state.user,"finance.appointment_confirmed","financeAppointment",a.id,{});
      closeModal();await refreshData();setFlash("Finance appointment confirmed.");
    }catch(e){setFlash(e.message||"Unable to confirm appointment.","error");}
  });
}

function completeFinanceAppointmentModal(a) {
  modal("Complete Finance Consultation",`
    <div class="finance-appointment-manage-head"><span class="record-icon">${icon("circle-check-big")}</span><div><span class="eyebrow">CONSULTATION COMPLETE</span><h3>${safe(a.requesterName||"Customer")}</h3><p>${safe(financePurposeLabel(a.purpose))}</p></div></div>
    <div class="field full"><label>Internal Consultation Notes <span class="optional-label">Optional</span></label><textarea class="plain-input textarea" id="faCompletionNotes" placeholder="Internal RP notes about what was discussed. Do not record real sensitive financial information."></textarea></div>
    <div class="field full"><label>Follow-Up</label><select class="plain-input" id="faFollowUp"><option>No follow-up required</option><option>Customer considering options</option><option>Sales follow-up requested</option><option>Another Finance appointment needed</option><option>Ready to continue Deal Jacket</option></select></div>
  `,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-fa-complete">${icon("circle-check-big")} Complete Appointment</button>`);
  document.querySelector("#save-fa-complete")?.addEventListener("click",async()=>{
    try{
      await updateRecord("financeAppointments",a.id,{status:"completed",completionNotes:document.querySelector("#faCompletionNotes").value.trim(),followUp:document.querySelector("#faFollowUp").value,completedAt:new Date().toISOString(),completedBy:state.user.uid,completedByName:state.profile?.displayName||state.user.email});
      await writeAudit(state.user,"finance.appointment_completed","financeAppointment",a.id,{followUp:document.querySelector("#faFollowUp").value});
      closeModal();await refreshData();setFlash("Finance consultation completed.");
    }catch(e){setFlash(e.message||"Unable to complete appointment.","error");}
  });
}

function cancelFinanceAppointmentModal(a,staffAction=false) {
  modal("Cancel Finance Appointment",`
    <div class="field full"><label>Cancellation Note <span class="optional-label">Optional</span></label><textarea class="plain-input textarea" id="faCancelNote" placeholder="Reason for cancellation..."></textarea></div>
  `,`<button class="btn secondary" data-close-modal>Keep Appointment</button><button class="btn danger-btn" id="confirm-fa-cancel">${icon("calendar-x")} Cancel Appointment</button>`);
  document.querySelector("#confirm-fa-cancel")?.addEventListener("click",async()=>{
    try{
      await updateRecord("financeAppointments",a.id,{status:"cancelled",cancellationNote:document.querySelector("#faCancelNote").value.trim(),cancelledAt:new Date().toISOString()});
      if(staffAction) await writeAudit(state.user,"finance.appointment_cancelled","financeAppointment",a.id,{});
      closeModal();await refreshData();setFlash("Finance appointment cancelled.");
    }catch(e){setFlash(e.message||"Unable to cancel appointment.","error");}
  });
}

function financeClientDirectory() {
  const map=new Map();
  const normalize=value=>String(value||"").trim().toLowerCase();

  const ensure=(key,seed={})=>{
    if(!map.has(key)) map.set(key,{key,customerId:"",linkedUid:"",name:"Finance Customer",email:"",phone:"",customer:null,appointments:[],applications:[],deals:[],deliveries:[],profile:null,...seed});
    return map.get(key);
  };

  for(const customer of state.data.customers){
    const key=`customer:${customer.id}`;
    ensure(key,{
      customerId:customer.id,
      linkedUid:customer.linkedUid||"",
      name:customer.name||customer.email||"Customer",
      email:customer.email||"",
      phone:customer.phone||"",
      customer
    });
  }

  const findKey=({customerId="",uid="",email="",name=""})=>{
    if(customerId && map.has(`customer:${customerId}`)) return `customer:${customerId}`;
    if(uid){
      const match=[...map.values()].find(x=>x.linkedUid===uid);
      if(match) return match.key;
    }
    if(email){
      const match=[...map.values()].find(x=>normalize(x.email)===normalize(email));
      if(match) return match.key;
    }
    if(name){
      const match=[...map.values()].find(x=>normalize(x.name)===normalize(name));
      if(match) return match.key;
    }
    if(uid) return `uid:${uid}`;
    if(email) return `email:${normalize(email)}`;
    return `name:${normalize(name)||"unknown"}`;
  };

  for(const appointment of state.data.financeAppointments||[]){
    const key=findKey({customerId:appointment.customerId,uid:appointment.requesterUid,email:appointment.requesterEmail,name:appointment.requesterName});
    const client=ensure(key,{
      customerId:appointment.customerId||"",
      linkedUid:appointment.requesterUid||"",
      name:appointment.requesterName||"Finance Customer",
      email:appointment.requesterEmail||""
    });
    client.appointments.push(appointment);
  }

  for(const application of state.data.financeApplications||[]){
    const key=findKey({customerId:application.customerId,name:application.customerName});
    const client=ensure(key,{
      customerId:application.customerId||"",
      name:application.customerName||"Finance Customer"
    });
    client.applications.push(application);
  }

  for(const deal of state.data.deals||[]){
    const key=findKey({customerId:deal.customerId,name:deal.customerName});
    const client=ensure(key,{
      customerId:deal.customerId||"",
      name:deal.customerName||"Finance Customer"
    });
    client.deals.push(deal);
  }

  for(const delivery of state.data.deliveries||[]){
    const key=findKey({customerId:delivery.customerId,name:delivery.customerName});
    const client=ensure(key,{
      customerId:delivery.customerId||"",
      name:delivery.customerName||"Finance Customer"
    });
    client.deliveries.push(delivery);
  }

  for(const profile of state.data.financeCustomerProfiles||[]){
    const match=[...map.values()].find(x=>
      (profile.customerId && x.customerId===profile.customerId) ||
      (profile.linkedUid && x.linkedUid===profile.linkedUid) ||
      (profile.email && normalize(x.email)===normalize(profile.email))
    );
    const client=match || ensure(`profile:${profile.id}`,{
      customerId:profile.customerId||"",
      linkedUid:profile.linkedUid||"",
      name:profile.customerName||"Finance Customer",
      email:profile.email||""
    });
    client.profile=profile;
  }

  return [...map.values()].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
}

function financeProfileId(client) {
  if(client.customerId) return client.customerId;
  if(client.linkedUid) return `uid_${client.linkedUid}`;
  return `contact_${String(client.email||client.name||client.key||"finance").replace(/[^A-Za-z0-9_-]/g,"_").slice(0,90)}`;
}

function financePage() {
  const financeDeals = state.data.deals.filter(d => ["finance","documents","delivery"].includes((d.stage || "").toLowerCase()));
  const approved = state.data.financeApplications.filter(x => ["approved","finalized","revised"].includes((x.status || "").toLowerCase())).length;
  const deliveries = state.data.deliveries.filter(x => (x.status || "").toLowerCase() !== "complete").length;
  const financed = state.data.financeApplications.reduce((sum,x) => sum + Number(x.amountFinanced || 0), 0);
  const clients=financeClientDirectory();
  const consultations=(state.data.financeAppointments||[]).filter(a=>["requested","confirmed","checked_in"].includes(a.status||"requested")).length;
  const today=new Date().toISOString().slice(0,10);
  const appointmentRequests=(state.data.financeAppointments||[]).filter(a=>(a.status||"requested")==="requested").length;
  const packageHolds=(state.data.financeApplications||[]).filter(a=>["draft","on_hold"].includes(a.status||"")).length;
  const followUpClients=clients.filter(client=>client.profile?.nextFollowUpDate && (client.profile?.followUpStatus||"open")!=="complete")
    .sort((a,b)=>String(a.profile.nextFollowUpDate).localeCompare(String(b.profile.nextFollowUpDate)));
  const dueFollowUps=followUpClients.filter(client=>String(client.profile.nextFollowUpDate)<=today).length;
  const fundingQueue=(state.data.financeApplications||[]).filter(a=>["approved","finalized"].includes(a.status||"") && !["funded","closed"].includes(a.fundingStatus||"pending_contracts")).length;

  return `
    ${pageHeader("F&I OPERATIONS", "DRIVE Finance", "Customer finance records, payment strategy, F&I packages, consultations, follow-up, contracts, and final vehicle delivery.",
      `<button class="btn secondary" id="open-payment-lab">${icon("sliders-horizontal")} Payment Lab</button><button class="btn secondary" data-page="financeAppointments">${icon("calendar-clock")} Appointments</button>`)}

    <div class="metric-grid">
      ${metric("Finance Queue", financeDeals.length, "landmark", "Deals requiring F&I")}
      ${metric("Finance Customers", clients.length, "users-round", "Searchable Finance records")}
      ${metric("Active Consultations", consultations, "calendar-clock", "Requested / confirmed / checked in")}
      ${metric("Amount Financed", money(financed), "circle-dollar-sign", "Fictional RP financing")}
    </div>

    <div class="finance-attention-strip">
      <button class="finance-attention-item ${appointmentRequests?"needs-attention":""}" data-page="financeAppointments"><span class="attention-icon">${icon("calendar-plus")}</span><div><small>Appointment Requests</small><strong>${appointmentRequests}</strong><span>${appointmentRequests?"Needs Finance confirmation":"Nothing waiting"}</span></div>${icon("chevron-right")}</button>
      <div class="finance-attention-item ${packageHolds?"needs-attention":""}"><span class="attention-icon">${icon("circle-pause")}</span><div><small>Packages Needing Work</small><strong>${packageHolds}</strong><span>${packageHolds?"Draft or on hold":"No package holds"}</span></div></div>
      <div class="finance-attention-item ${deliveries?"active-attention":""}"><span class="attention-icon">${icon("key-round")}</span><div><small>Pending Deliveries</small><strong>${deliveries}</strong><span>${deliveries?"Finance handoffs open":"Delivery queue clear"}</span></div></div>
      <div class="finance-attention-item ${dueFollowUps?"needs-attention":""}"><span class="attention-icon">${icon("phone-call")}</span><div><small>Follow-Ups Due</small><strong>${dueFollowUps}</strong><span>${dueFollowUps?"Customer contact due":"Nothing overdue"}</span></div></div>
      <div class="finance-attention-item ${fundingQueue?"needs-attention":""}"><span class="attention-icon">${icon("banknote-arrow-up")}</span><div><small>Funding Queue</small><strong>${fundingQueue}</strong><span>${fundingQueue?"Contracts still open":"Funding clear"}</span></div></div>
    </div>

    ${followUpClients.length ? `<div class="panel finance-followup-panel">
      <div class="panel-head"><div><span class="eyebrow">NEXT ACTION</span><h2>Finance Follow-Up Queue</h2></div><span class="toolbar-count">${followUpClients.length} open</span></div>
      <div class="finance-followup-list">
        ${followUpClients.slice(0,8).map(client=>`<button class="finance-followup-row" data-finance-customer="${safe(client.key)}">
          <span class="followup-date ${String(client.profile.nextFollowUpDate)<=today?"due":""}"><strong>${safe(client.profile.nextFollowUpDate)}</strong><small>${String(client.profile.nextFollowUpDate)<=today?"DUE":"UPCOMING"}</small></span>
          <span class="followup-main"><strong>${safe(client.name)}</strong><small>${safe(client.profile.nextAction||"Finance follow-up")}</small></span>
          <span class="followup-meta">${safe(client.profile.assignedFinanceRep||"Unassigned")}</span>
          ${icon("chevron-right")}
        </button>`).join("")}
      </div>
    </div>` : ""}

    <div class="panel finance-directory-panel">
      <div class="panel-head">
        <div><span class="eyebrow">CUSTOMER FINANCE 360</span><h2>Finance Customer Directory</h2></div>
        <div class="finance-directory-tools"><div class="search-box compact-search">${icon("search")}<input id="finance-customer-search" placeholder="Search name, email, customer ID, deal..."></div></div>
      </div>
      ${clients.length ? `<div class="table-wrap"><table class="data-table finance-customer-table">
        <thead><tr><th>Customer</th><th>Finance Packages</th><th>Current Payment</th><th>Appointments</th><th>Finance Status</th><th></th></tr></thead>
        <tbody id="finance-customer-rows">${clients.map(client=>{
          const latest=[...client.applications].sort((a,b)=>(b.updatedAt?.seconds||b.createdAt?.seconds||0)-(a.updatedAt?.seconds||a.createdAt?.seconds||0))[0];
          const openAppointments=client.appointments.filter(a=>["requested","confirmed","checked_in"].includes(a.status||"requested"));
          const search=[client.name,client.email,client.customer?.customerNumber,...client.deals.map(d=>d.dealNumber)].filter(Boolean).join(" ").toLowerCase();
          return `<tr data-search="${safe(search)}">
            <td><div class="finance-customer-cell"><span class="avatar small-avatar">${initials(client.name)}</span><span><strong>${safe(client.name)}</strong><small>${safe(client.email||client.customer?.customerNumber||"Finance contact")}</small></span></div></td>
            <td><strong>${client.applications.length}</strong><small class="block">${client.deals.length} linked deal${client.deals.length===1?"":"s"}</small></td>
            <td><strong>${latest?.monthlyPayment?money(latest.monthlyPayment)+"/mo":"—"}</strong><small class="block">${latest?Number(latest.termMonths||0)+" mo • "+Number(latest.apr||0).toFixed(2)+"% APR":"No package"}</small></td>
            <td><strong>${openAppointments.length}</strong><small class="block">${openAppointments[0]?safe((openAppointments[0].status||"requested").replaceAll("_"," ")):"No active appointment"}</small></td>
            <td>${statusPill(client.profile?.financeStatus||latest?.status||"no_package")}</td>
            <td><button class="btn secondary small" data-finance-customer="${safe(client.key)}">${icon("folder-open")} Open Finance</button></td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>` : emptyState("users-round","No Finance customers yet","Finance customers appear when they have a CRM record, Finance appointment, Deal Jacket, or finance package.")}
    </div>

    <div class="panel no-pad finance-queue-panel">
      <div class="panel-head padded-head"><div><span class="eyebrow">F&I PIPELINE</span><h2>Deal Finance Queue</h2></div><span class="toolbar-count">${financeDeals.length} active</span></div>
      ${financeDeals.length ? `<div class="table-wrap"><table class="data-table">
        <thead><tr><th>Deal</th><th>Customer</th><th>Vehicle</th><th>Stage</th><th>Trade</th><th>Finance</th><th>Payment</th><th></th></tr></thead>
        <tbody>${financeDeals.map(d => {
          const trade=state.data.tradeIns.find(t=>t.dealId===d.id);
          const fin=state.data.financeApplications.find(x=>x.dealId===d.id);
          return `<tr>
            <td><strong>${safe(d.dealNumber || d.id.slice(0,8).toUpperCase())}</strong></td>
            <td><button class="text-btn" data-finance-customer-from-deal="${d.id}">${safe(d.customerName || "—")} ${icon("arrow-up-right")}</button></td>
            <td>${safe(d.vehicleName || "—")}</td>
            <td>${statusPill(d.stage || "finance")}</td>
            <td>${trade ? money(trade.managerApprovedAllowance ?? trade.allowance) : "None"}</td>
            <td>${fin ? statusPill(fin.status || "draft") : '<span class="muted-inline">Not started</span>'}</td>
            <td><strong>${fin ? money(fin.monthlyPayment) + "/mo" : "—"}</strong></td>
            <td>${d.stage==="delivery"
              ? ((can("finance.manage") || can("sales.manage")) ? `<button class="btn secondary small" data-finance-deal="${d.id}">${icon("key-round")} Delivery</button>` : '<span class="muted-inline">View only</span>')
              : (can("finance.manage") ? `<button class="btn secondary small" data-finance-deal="${d.id}">${icon("calculator")} Open F&I</button>` : '<span class="muted-inline">View only</span>')}</td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>` : emptyState("landmark", "Finance queue is clear", "Approved sales deals will arrive here automatically.")}
    </div>

    <div class="rp-disclaimer">${icon("info")} Sterling Finance stores fictional roleplay financing information only. Do not enter real SSNs, bank credentials, credit reports, income documents, or other sensitive financial information.</div>
  `;
}

function financeCustomerDetailModal(client) {
  if(!client)return;
  const profile=client.profile||{};
  const applications=[...client.applications].sort((a,b)=>(b.updatedAt?.seconds||b.createdAt?.seconds||0)-(a.updatedAt?.seconds||a.createdAt?.seconds||0));
  const appointments=[...client.appointments].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  const latest=applications[0];
  const activeAppointment=appointments.find(a=>["requested","confirmed","checked_in"].includes(a.status||"requested"));
  const totalFinanced=applications.filter(a=>!["voided","cancelled"].includes(a.status||"")).reduce((s,a)=>s+Number(a.amountFinanced||0),0);
  const productCount=applications.reduce((s,a)=>s+(a.products?.length||0),0);

  modal(`Finance • ${safe(client.name)}`,`
    <div class="finance-customer-hero">
      <span class="avatar finance-customer-avatar">${initials(client.name)}</span>
      <div><span class="eyebrow">FINANCE CUSTOMER 360</span><h3>${safe(client.name)}</h3><p>${safe(client.email||client.customer?.customerNumber||"Sterling Finance contact")}</p></div>
      ${statusPill(profile.financeStatus||latest?.status||"no_package")}
    </div>

    <div class="finance-customer-kpis">
      <div><span>Finance Packages</span><strong>${applications.length}</strong><small>${latest?money(latest.monthlyPayment)+"/mo latest":"No package yet"}</small></div>
      <div><span>Total Amount Financed</span><strong>${money(totalFinanced)}</strong><small>Across recorded RP packages</small></div>
      <div><span>F&I Products</span><strong>${productCount}</strong><small>Across finance packages</small></div>
      <div><span>Payment Goal</span><strong>${profile.monthlyPaymentGoal?money(profile.monthlyPaymentGoal)+"/mo":activeAppointment?.monthlyGoal?money(activeAppointment.monthlyGoal)+"/mo":"—"}</strong><small>Customer preference</small></div>
    </div>

    <div class="finance-preferences-card">
      <div class="record-section-head"><div><span class="eyebrow">FINANCE PROFILE</span><h4>Payment Preferences & Internal Notes</h4></div><button class="btn secondary small" id="edit-finance-customer-profile">${icon("pencil")} Edit</button></div>
      <div class="finance-preferences-grid">
        <div><span>Preferred Down Payment</span><strong>${profile.preferredDownPayment!=null?money(profile.preferredDownPayment):"Not set"}</strong></div>
        <div><span>Preferred Term</span><strong>${profile.preferredTermMonths?profile.preferredTermMonths+" months":"Not set"}</strong></div>
        <div><span>Monthly Goal</span><strong>${profile.monthlyPaymentGoal?money(profile.monthlyPaymentGoal)+"/mo":"Not set"}</strong></div>
        <div><span>Finance Status</span><strong>${safe((profile.financeStatus||"not_started").replaceAll("_"," "))}</strong></div>
      </div>
      <div class="finance-internal-notes"><span>FINANCE-ONLY INTERNAL NOTES</span><p>${safe(profile.internalNotes||"No internal Finance notes recorded.")}</p></div>
      <div class="finance-next-action-card ${profile.nextFollowUpDate && String(profile.nextFollowUpDate)<=new Date().toISOString().slice(0,10) ? "due" : ""}">
        <span class="finance-next-action-icon">${icon("phone-call")}</span>
        <div><span class="eyebrow">NEXT ACTION</span><strong>${safe(profile.nextAction||"No follow-up action assigned")}</strong><small>${profile.nextFollowUpDate ? `Follow up ${safe(profile.nextFollowUpDate)}` : "No follow-up date"} • ${safe(profile.assignedFinanceRep||"Unassigned Finance rep")} • ${safe(profile.preferredContactMethod||"Any contact method")}</small></div>
        ${profile.priority ? `<span class="priority-chip priority-${safe(profile.priority)}">${safe(profile.priority)}</span>` : ""}
      </div>
    </div>

    <div class="finance-customer-sections">
      <section class="finance-customer-section">
        <div class="record-section-head"><div><span class="eyebrow">F&I</span><h4>Finance Packages</h4></div><b>${applications.length}</b></div>
        <div class="customer-record-list">
          ${applications.length ? applications.map(a=>`<button class="customer-record-item" data-edit-finance-application="${a.id}">
            <span class="record-list-icon">${icon("calculator")}</span>
            <span><strong>${safe(a.dealNumber||"Finance Package")}</strong><small>${money(a.amountFinanced)} • ${Number(a.apr||0).toFixed(2)}% • ${Number(a.termMonths||0)} mo • ${money(a.monthlyPayment)}/mo</small></span>
            ${statusPill(a.status||"draft")}
          </button>`).join("") : '<div class="record-list-empty">No Finance packages recorded.</div>'}
        </div>
      </section>

      <section class="finance-customer-section">
        <div class="record-section-head"><div><span class="eyebrow">CONSULTATIONS</span><h4>Finance Appointments</h4></div><b>${appointments.length}</b></div>
        <div class="customer-record-list">
          ${appointments.length ? appointments.slice(0,8).map(a=>`<button class="customer-record-item" data-finance-profile-appointment="${a.id}">
            <span class="record-list-icon">${icon("calendar-clock")}</span>
            <span><strong>${safe(financePurposeLabel(a.purpose))}</strong><small>${safe(a.confirmedDate||a.preferredDate||"Date pending")} ${safe(a.confirmedTime||a.preferredTime||"")} • ${safe(a.financeRepresentativeName||"Unassigned")}</small></span>
            ${statusPill(a.status||"requested")}
          </button>`).join("") : '<div class="record-list-empty">No Finance appointments recorded.</div>'}
        </div>
      </section>

      <section class="finance-customer-section">
        <div class="record-section-head"><div><span class="eyebrow">DEALS</span><h4>Linked Deal Jackets</h4></div><b>${client.deals.length}</b></div>
        <div class="customer-record-list">
          ${client.deals.length ? client.deals.map(d=>`<button class="customer-record-item" data-finance-profile-deal="${d.id}">
            <span class="record-list-icon">${icon("handshake")}</span>
            <span><strong>${safe(d.dealNumber||"Deal Jacket")}</strong><small>${safe(d.vehicleName||"Vehicle")} • ${safe((d.stage||"shopping").replaceAll("_"," "))}</small></span>
            ${statusPill(d.stage||"shopping")}
          </button>`).join("") : '<div class="record-list-empty">No Deal Jackets linked.</div>'}
        </div>
      </section>

      <section class="finance-customer-section">
        <div class="record-section-head"><div><span class="eyebrow">DELIVERY</span><h4>Finance / Delivery History</h4></div><b>${client.deliveries.length}</b></div>
        <div class="customer-record-list">
          ${client.deliveries.length ? client.deliveries.map(d=>`<div class="customer-record-item static-record-item">
            <span class="record-list-icon">${icon("key-round")}</span>
            <span><strong>${safe(d.dealNumber||"Vehicle Delivery")}</strong><small>${safe(d.vehicleName||"Vehicle")} • ${safe((d.status||"preparing").replaceAll("_"," "))}</small></span>
            ${statusPill(d.status||"preparing")}
          </div>`).join("") : '<div class="record-list-empty">No Finance delivery history.</div>'}
        </div>
      </section>
    </div>

    <div class="rp-disclaimer compact">${icon("shield-check")} Keep this record fictional. Do not store real credit reports, SSNs, banking credentials, income documents, or other sensitive financial information.</div>
  `,`
    <button class="btn secondary" id="finance-customer-appointment">${icon("calendar-plus")} Appointment</button>
    <span class="modal-footer-spacer"></span>
    ${client.customer && (can("customers.manage")||can("sales.manage"))?`<button class="btn secondary" id="open-crm-customer">${icon("user-round")} CRM Profile</button>`:""}
    ${client.deals.some(d=>(d.stage||"")==="finance")?`<button class="btn primary" id="continue-customer-finance">${icon("calculator")} Continue F&I</button>`:""}
  `);

  document.querySelector("#edit-finance-customer-profile")?.addEventListener("click",()=>editFinanceCustomerProfileModal(client));
  document.querySelector("#finance-customer-appointment")?.addEventListener("click",()=>financeAppointmentModal(client));
  document.querySelector("#open-crm-customer")?.addEventListener("click",()=>customerDetailModal(client.customer));
  document.querySelector("#continue-customer-finance")?.addEventListener("click",()=>{
    const d=client.deals.find(x=>(x.stage||"")==="finance");
    if(d) financeWorksheetModal(d);
  });
  document.querySelectorAll("[data-edit-finance-application]").forEach(btn=>btn.addEventListener("click",()=>editFinanceApplicationModal(state.data.financeApplications.find(a=>a.id===btn.dataset.editFinanceApplication))));
  document.querySelectorAll("[data-finance-profile-appointment]").forEach(btn=>btn.addEventListener("click",()=>manageFinanceAppointmentModal(state.data.financeAppointments.find(a=>a.id===btn.dataset.financeProfileAppointment))));
  document.querySelectorAll("[data-finance-profile-deal]").forEach(btn=>btn.addEventListener("click",()=>dealDetailModal(state.data.deals.find(d=>d.id===btn.dataset.financeProfileDeal))));
}

function editFinanceCustomerProfileModal(client) {
  const profile=client.profile||{};
  modal("Edit Finance Customer Profile",`
    <form id="finance-customer-profile-form" class="form-grid">
      <div class="field full"><label>Customer</label><input class="plain-input" value="${safe(client.name)}" disabled></div>
      ${formField("Monthly Payment Goal","fcpMonthlyGoal",String(profile.monthlyPaymentGoal||0),"number","min='0'")}
      ${formField("Preferred Down Payment","fcpDownPayment",String(profile.preferredDownPayment||0),"number","min='0'")}
      <div class="field"><label>Preferred Term</label><select class="plain-input" id="fcpTerm">
        <option value="">Not set</option>${[24,36,48,60,72,84].map(n=>`<option value="${n}" ${Number(profile.preferredTermMonths||0)===n?"selected":""}>${n} months</option>`).join("")}
      </select></div>
      <div class="field"><label>Finance Relationship Status</label><select class="plain-input" id="fcpStatus">
        ${["not_started","consulting","package_in_progress","approved","delivered","on_hold"].map(x=>`<option value="${x}" ${(profile.financeStatus||"not_started")===x?"selected":""}>${x.replaceAll("_"," ")}</option>`).join("")}
      </select></div>
      <div class="field"><label>Assigned Finance Representative</label><input class="plain-input" id="fcpRep" value="${safe(profile.assignedFinanceRep||state.profile?.displayName||state.user.email||"")}"></div>
      <div class="field"><label>Preferred Contact Method</label><select class="plain-input" id="fcpContact">
        ${["Any","Phone","Email","In Person"].map(x=>`<option ${(profile.preferredContactMethod||"Any")===x?"selected":""}>${x}</option>`).join("")}
      </select></div>
      <div class="field"><label>Priority</label><select class="plain-input" id="fcpPriority">
        ${["normal","high","urgent"].map(x=>`<option value="${x}" ${(profile.priority||"normal")===x?"selected":""}>${x}</option>`).join("")}
      </select></div>
      ${formField("Next Follow-Up","fcpFollowUp",profile.nextFollowUpDate||"","date")}
      <div class="field full"><label>Next Action</label><input class="plain-input" id="fcpNextAction" value="${safe(profile.nextAction||"")}" placeholder="Example: Call customer with 60-month option"></div>
      <div class="field full"><label>Finance-Only Internal Notes</label><textarea class="plain-input textarea tall-textarea" id="fcpNotes" placeholder="RP-only notes about payment preferences, follow-up, or Finance conversations.">${safe(profile.internalNotes||"")}</textarea></div>
    </form>
    <div class="rp-disclaimer compact">${icon("shield-check")} Do not record real credit, banking, SSN, income, or other sensitive personal financial information.</div>
  `,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-finance-customer-profile">${icon("save")} Save Finance Profile</button>`);

  document.querySelector("#save-finance-customer-profile")?.addEventListener("click",async()=>{
    const btn=document.querySelector("#save-finance-customer-profile");btn.disabled=true;
    const data={
      customerId:client.customerId||"",
      linkedUid:client.linkedUid||"",
      customerName:client.name||"",
      email:client.email||"",
      monthlyPaymentGoal:Number(document.querySelector("#fcpMonthlyGoal").value||0),
      preferredDownPayment:Number(document.querySelector("#fcpDownPayment").value||0),
      preferredTermMonths:Number(document.querySelector("#fcpTerm").value||0),
      financeStatus:document.querySelector("#fcpStatus").value,
      assignedFinanceRep:document.querySelector("#fcpRep").value.trim(),
      preferredContactMethod:document.querySelector("#fcpContact").value,
      priority:document.querySelector("#fcpPriority").value,
      nextFollowUpDate:document.querySelector("#fcpFollowUp").value,
      nextAction:document.querySelector("#fcpNextAction").value.trim(),
      followUpStatus:document.querySelector("#fcpFollowUp").value ? "open" : "complete",
      internalNotes:document.querySelector("#fcpNotes").value.trim()
    };
    try{
      const id=financeProfileId(client);
      await saveFinanceCustomerProfile(id,data,state.user);
      await writeAudit(state.user,"finance.customer_profile_updated","financeCustomerProfile",id,{customerId:client.customerId||"",financeStatus:data.financeStatus});
      closeModal();await refreshData();setFlash("Finance customer profile updated.");
    }catch(e){btn.disabled=false;setFlash(e.message||"Unable to update Finance customer profile.","error");}
  });
}

function editFinanceApplicationModal(application) {
  if(!application)return;
  const deal=state.data.deals.find(d=>d.id===application.dealId);
  const sale=Number(application.salePrice || deal?.finalPrice || deal?.counterPrice || deal?.price || 0);
  const products=[
    ["extended_warranty","Extended Warranty",2495],
    ["gap","GAP Coverage",995],
    ["maintenance","Maintenance Plan",1495],
    ["tire_wheel","Tire & Wheel Protection",895]
  ];
  const selected=new Set(application.products||[]);
  const revisionHistory=Array.isArray(application.revisionHistory)?application.revisionHistory:[];

  modal("Edit Finance Package",`
    <div class="finance-hero"><div><span class="eyebrow">FINANCE PACKAGE • ${safe(application.dealNumber||"")}</span><h3>${safe(application.customerName||"Customer")}</h3><p>${safe(application.vehicleName||"Vehicle")} • Revision ${Number(application.revision||1)}</p></div><div><span>Sale Price</span><strong>${money(sale)}</strong></div></div>
    <form id="edit-finance-package-form" class="form-grid">
      <div class="field"><label>RP Credit Tier</label><select class="plain-input" id="editCreditTier">${["Tier 1","Tier 2","Tier 3","Tier 4"].map(x=>`<option ${application.creditTier===x?"selected":""}>${x}</option>`).join("")}</select></div>
      ${formField("Down Payment","editDownPayment",String(application.downPayment||0),"number","required min='0'")}
      <div class="field"><label>Manager-Approved Trade Allowance</label><input class="plain-input" id="editTradeAllowance" type="number" min="0" value="${Number(application.tradeAllowance||0)}" readonly><small class="field-help">Trade allowance remains controlled by the approved Deal Jacket.</small></div>
      ${formField("APR","editApr",String(application.apr||0),"number","required min='0' step='0.01'")}
      <div class="field"><label>Term</label><select class="plain-input" id="editTermMonths">${[24,36,48,60,72,84].map(n=>`<option value="${n}" ${Number(application.termMonths||0)===n?"selected":""}>${n} months</option>`).join("")}</select></div>
      <div class="field"><label>Package Status</label><select class="plain-input" id="editFinanceStatus">${["draft","approved","revised","on_hold","finalized","voided"].map(x=>`<option value="${x}" ${(application.status||"approved")===x?"selected":""}>${x.replaceAll("_"," ")}</option>`).join("")}</select></div>
      <div class="field"><label>Fictional Financing Source</label><select class="plain-input" id="editFinanceSource">
        ${["Sterling Financial","Horizon Auto Credit","Community Motor Bank","Cash / No Lender"].map(x=>`<option ${x===(application.financeSource||"Sterling Financial")?"selected":""}>${x}</option>`).join("")}
      </select></div>
      <div class="field"><label>Program Decision</label><select class="plain-input" id="editFinanceDecision">
        ${["pending","approved","conditional","declined"].map(x=>`<option value="${x}" ${x===(application.financeDecision||"pending")?"selected":""}>${x}</option>`).join("")}
      </select></div>
      <div class="field"><label>Approval Expiration</label><input class="plain-input" id="editApprovalExpires" type="date" value="${safe(application.approvalExpires||"")}"></div>
      <div class="field"><label>Funding Status</label><select class="plain-input" id="editFundingStatus">
        ${["pending_contracts","submitted","funded","exception","closed"].map(x=>`<option value="${x}" ${x===(application.fundingStatus||"pending_contracts")?"selected":""}>${x.replaceAll("_"," ")}</option>`).join("")}
      </select></div>
      <div class="field full"><label>F&I Products</label><div class="product-options">${products.map(([id,label,price])=>`<label><input type="checkbox" data-edit-finance-product="${id}" data-price="${price}" ${selected.has(id)?"checked":""}><span><strong>${label}</strong><small>${money(price)}</small></span></label>`).join("")}</div></div>
      <div class="field full"><label>Finance Internal Notes <span class="optional-label">Optional</span></label><textarea class="plain-input textarea" id="editFinanceNotes" placeholder="RP-only notes about this finance package.">${safe(application.internalNotes||"")}</textarea></div>
    </form>
    ${application.acceptance ? `<div class="finance-acceptance-record">${icon(application.acceptance.method==="staff_assisted"?"user-check":"handshake")}<div><span>PAYMENT PLAN ACCEPTANCE</span><strong>${application.acceptance.method==="staff_assisted"?"Staff-assisted acceptance":"Customer acceptance"} recorded</strong><small>${safe(application.acceptance.acceptedByName||"Sterling Finance")} • ${safe(application.acceptance.acceptedAt||"")}${application.acceptance.note?` • ${safe(application.acceptance.note)}`:""}</small></div></div>` : ""}
    ${revisionHistory.length ? `<div class="finance-revision-history">
      <div class="record-section-head"><div><span class="eyebrow">PACKAGE HISTORY</span><h4>Finance Revisions</h4></div><b>${revisionHistory.length}</b></div>
      <div class="revision-list">${revisionHistory.slice(-5).reverse().map(r=>`<div class="revision-row">
        <span class="revision-number">R${Number(r.revision||1)}</span>
        <span><strong>${money(r.monthlyPayment||0)}/mo</strong><small>${Number(r.termMonths||0)} mo • ${Number(r.apr||0).toFixed(2)}% • ${safe(r.status||"saved")}</small></span>
        <span><strong>${money(r.amountFinanced||0)}</strong><small>${safe(r.editedByName||"Sterling Finance")} • ${safe(r.editedAt||"")}</small></span>
      </div>`).join("")}</div>
    </div>` : ""}
    <div class="finance-summary">
      <div><span>Products</span><strong id="editSumProducts">$0</strong></div>
      <div><span>Amount Financed</span><strong id="editSumPrincipal">$0</strong></div>
      <div class="payment-total"><span>Estimated Payment</span><strong id="editSumPayment">$0/mo</strong></div>
    </div>
    <div class="rp-disclaimer compact">${icon("shield-check")} Editing this record updates the existing RP Finance package only; it does not recreate delivery or re-run the Deal Jacket workflow.</div>
  `,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-finance-package-edit">${icon("save")} Save Changes</button>`);

  const calculate=()=>{
    const productTotal=[...document.querySelectorAll("[data-edit-finance-product]:checked")].reduce((s,x)=>s+Number(x.dataset.price||0),0);
    const down=Number(document.querySelector("#editDownPayment").value||0);
    const trade=Number(document.querySelector("#editTradeAllowance").value||0);
    const principal=Math.max(0,sale-down-trade+productTotal);
    const apr=Number(document.querySelector("#editApr").value||0);
    const term=Number(document.querySelector("#editTermMonths").value||72);
    const payment=monthlyPayment(principal,apr,term);
    document.querySelector("#editSumProducts").textContent=money(productTotal);
    document.querySelector("#editSumPrincipal").textContent=money(principal);
    document.querySelector("#editSumPayment").textContent=money(payment)+"/mo";
    return {productTotal,down,trade,principal,apr,term,payment};
  };
  document.querySelectorAll("#edit-finance-package-form input,#edit-finance-package-form select").forEach(el=>el.addEventListener("input",calculate));
  calculate();

  document.querySelector("#save-finance-package-edit")?.addEventListener("click",async()=>{
    const form=document.querySelector("#edit-finance-package-form");if(!form.reportValidity())return;
    const btn=document.querySelector("#save-finance-package-edit");btn.disabled=true;
    const calc=calculate();
    const selectedProducts=[...document.querySelectorAll("[data-edit-finance-product]:checked")].map(el=>el.dataset.editFinanceProduct);
    const patch={
      creditTier:document.querySelector("#editCreditTier").value,
      downPayment:calc.down,
      tradeAllowance:calc.trade,
      apr:calc.apr,
      termMonths:calc.term,
      products:selectedProducts,
      productTotal:calc.productTotal,
      amountFinanced:calc.principal,
      monthlyPayment:Number(calc.payment.toFixed(2)),
      status:document.querySelector("#editFinanceStatus").value,
      financeSource:document.querySelector("#editFinanceSource").value,
      financeDecision:document.querySelector("#editFinanceDecision").value,
      approvalExpires:document.querySelector("#editApprovalExpires").value,
      fundingStatus:document.querySelector("#editFundingStatus").value,
      internalNotes:document.querySelector("#editFinanceNotes").value.trim(),
      revision:Number(application.revision||0)+1,
      lastRevisionAt:new Date().toISOString(),
      revisionHistory:[...revisionHistory,{
        revision:Number(application.revision||0)+1,
        status:document.querySelector("#editFinanceStatus").value,
        apr:calc.apr,termMonths:calc.term,downPayment:calc.down,
        amountFinanced:calc.principal,monthlyPayment:Number(calc.payment.toFixed(2)),
        products:selectedProducts,editedAt:new Date().toISOString(),
        editedByName:state.profile?.displayName||state.user.email
      }],
      lastEditedBy:state.user.uid,
      lastEditedByName:state.profile?.displayName||state.user.email
    };
    try{
      await updateRecord("financeApplications",application.id,patch);
      await writeAudit(state.user,"finance.package_edited","financeApplication",application.id,{dealId:application.dealId||"",amountFinanced:patch.amountFinanced,apr:patch.apr,termMonths:patch.termMonths,status:patch.status});
      closeModal();await refreshData();setFlash("Finance package updated.");
    }catch(e){btn.disabled=false;setFlash(e.message||"Unable to update Finance package.","error");}
  });
}

function tradeInModal(d) {
  const existing=state.data.tradeIns.find(t=>t.dealId===d.id);
  modal(existing ? "Edit Trade-In Appraisal" : "Trade-In Appraisal", `<form id="trade-form" class="form-grid">
    ${formField("Year","tradeYear",existing?.year || "2022","number","required")}
    ${formField("Make","tradeMake",existing?.make || "Toyota","text","required")}
    ${formField("Model","tradeModel",existing?.model || "Camry","text","required")}
    ${formField("VIN","tradeVin",existing?.vin || "VIN","text","required maxlength='17'")}
    ${formField("Mileage","tradeMileage",String(existing?.mileage || 50000),"number","required")}
    <div class="field"><label>Exterior Condition</label><select class="plain-input" id="tradeExterior">${["Excellent","Good","Fair","Poor"].map(x=>`<option ${existing?.exterior===x?"selected":""}>${x}</option>`).join("")}</select></div>
    <div class="field"><label>Interior Condition</label><select class="plain-input" id="tradeInterior">${["Excellent","Good","Fair","Poor"].map(x=>`<option ${existing?.interior===x?"selected":""}>${x}</option>`).join("")}</select></div>
    <div class="field"><label>Mechanical Condition</label><select class="plain-input" id="tradeMechanical">${["Excellent","Good","Fair","Needs Repair"].map(x=>`<option ${existing?.mechanical===x?"selected":""}>${x}</option>`).join("")}</select></div>
    ${formField("Actual Cash Value (ACV)","tradeAcv",String(existing?.acv || 15000),"number","required")}
    ${formField("Customer Allowance","tradeAllowance",String(existing?.allowance || 15500),"number","required")}
    <div class="field full"><label>Appraisal Notes</label><textarea class="plain-input textarea" id="tradeNotes" placeholder="Condition, warning lights, damage, modifications...">${safe(existing?.notes || "")}</textarea></div>
  </form>`, `<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-trade">${icon("car")} Save Appraisal</button>`);
  document.querySelector("#save-trade")?.addEventListener("click", async () => {
    const form=document.querySelector("#trade-form"); if(!form.reportValidity()) return;
    const saveButton=document.querySelector("#save-trade");
    saveButton.disabled=true;
    const data={
      dealId:d.id,dealNumber:d.dealNumber || "",customerId:d.customerId || "",customerName:d.customerName || "",
      year:Number(document.querySelector("#tradeYear").value),make:document.querySelector("#tradeMake").value.trim(),model:document.querySelector("#tradeModel").value.trim(),
      vin:document.querySelector("#tradeVin").value.trim(),mileage:Number(document.querySelector("#tradeMileage").value),
      exterior:document.querySelector("#tradeExterior").value,interior:document.querySelector("#tradeInterior").value,mechanical:document.querySelector("#tradeMechanical").value,
      acv:Number(document.querySelector("#tradeAcv").value),allowance:Number(document.querySelector("#tradeAllowance").value),
      notes:document.querySelector("#tradeNotes").value.trim(),
      status:existing?.status && !["appraised","accepted"].includes(existing.status) ? existing.status : "appraised",
      managerApprovalStatus:"not_submitted"
    };
    try {
      const saved=await saveTradeInForDeal(data,state.user,existing?.id || "");
      const id=saved.id;
      await updateRecord("deals",d.id,{tradeInId:id,tradeAllowance:data.allowance,tradeAcv:data.acv,tradeApprovalStatus:"not_submitted"});
      await writeAudit(state.user,"trade.appraised","tradeIn",id,{dealId:d.id,acv:data.acv,allowance:data.allowance});
      closeModal(); await refreshData(); setFlash("Trade-in appraisal saved. Manager approval will be required with the deal.");
    } catch(e){saveButton.disabled=false;setFlash(e.message || "Unable to save appraisal.","error");}
  });
}

function monthlyPayment(principal, apr, months) {
  const p=Math.max(0,Number(principal)||0), n=Math.max(1,Number(months)||1), annual=Number(apr)||0;
  if(annual<=0) return p/n;
  const r=annual/100/12;
  return p*r/(1-Math.pow(1+r,-n));
}

function principalForPayment(payment, apr, months) {
  const pay=Math.max(0,Number(payment)||0), n=Math.max(1,Number(months)||1), annual=Number(apr)||0;
  if(annual<=0) return pay*n;
  const r=annual/100/12;
  return pay*(1-Math.pow(1+r,-n))/r;
}

function financePaymentLabPickerModal() {
  const deals=state.data.deals.filter(d=>["finance","documents"].includes((d.stage||"").toLowerCase()));
  modal("Finance Payment Lab",`
    <div class="payment-lab-picker-head">
      <span class="record-icon">${icon("sliders-horizontal")}</span>
      <div><span class="eyebrow">PAYMENT STRATEGY</span><h3>Select a Finance deal</h3><p>Compare multiple RP payment structures before finalizing a package.</p></div>
    </div>
    ${deals.length ? `<div class="payment-lab-picker-list">
      ${deals.map(d=>`<button class="payment-lab-deal" data-payment-lab-deal="${d.id}">
        <span class="record-list-icon">${icon("car-front")}</span>
        <span><strong>${safe(d.customerName||"Customer")}</strong><small>${safe(d.dealNumber||"Deal")} • ${safe(d.vehicleName||"Vehicle")}</small></span>
        <strong>${money(Number(d.counterPrice||d.finalPrice||d.price||0))}</strong>
        ${icon("chevron-right")}
      </button>`).join("")}
    </div>` : `<div class="record-list-empty">No deals are currently waiting in Finance.</div>`}
  `);
  document.querySelectorAll("[data-payment-lab-deal]").forEach(btn=>btn.addEventListener("click",()=>{
    const deal=state.data.deals.find(d=>d.id===btn.dataset.paymentLabDeal);
    if(deal) financePaymentLabModal(deal);
  }));
}

function financePaymentLabModal(d) {
  if(!d)return;
  const trade=state.data.tradeIns.find(t=>t.dealId===d.id);
  const client=financeClientDirectory().find(c=>c.customerId===d.customerId || (!d.customerId && String(c.name||"").toLowerCase()===String(d.customerName||"").toLowerCase()));
  const profile=client?.profile||{};
  const sale=Number(d.counterPrice||d.finalPrice||d.price||0);
  const tradeAllowance=Number(trade?.managerApprovedAllowance ?? trade?.allowance ?? d.tradeAllowance ?? 0);
  const existing=state.data.financeApplications.find(x=>x.dealId===d.id);
  const startingDown=Number(profile.preferredDownPayment ?? existing?.downPayment ?? 0);
  const startingApr=Number(existing?.apr ?? 6.49);
  const startingCreditTier=existing?.creditTier || "Tier 1";
  const goal=Number(profile.monthlyPaymentGoal||client?.appointments?.find(a=>a.monthlyGoal)?.monthlyGoal||0);

  modal("Finance Payment Lab",`
    <div class="payment-lab-hero">
      <div><span class="eyebrow">PAYMENT STRATEGY LAB</span><h3>${safe(d.customerName||"Customer")}</h3><p>${safe(d.vehicleName||"Vehicle")} • ${safe(d.dealNumber||"Deal")}</p></div>
      <div><span>Customer Goal</span><strong>${goal?money(goal)+"/mo":"Not set"}</strong></div>
    </div>

    <div class="payment-lab-controls">
      <div class="field"><label>RP Credit Tier</label><select class="plain-input" id="labCreditTier">
        ${["Tier 1","Tier 2","Tier 3","Tier 4"].map(x=>`<option ${x===startingCreditTier?"selected":""}>${x}</option>`).join("")}
      </select></div>
      <div class="field"><label>Base APR</label><input class="plain-input" id="labApr" type="number" min="0" step="0.01" value="${startingApr}"></div>
      <div class="field"><label>Preferred Down Payment</label><input class="plain-input" id="labDown" type="number" min="0" value="${startingDown}"></div>
      <div class="field"><label>F&I Menu</label><select class="plain-input" id="labMenu">
        <option value="base">Base — No products</option>
        <option value="protect">Protect — GAP + Warranty</option>
        <option value="complete">Complete — Full protection</option>
      </select></div>
      <div class="field"><label>Trade Allowance</label><input class="plain-input" value="${tradeAllowance}" readonly></div>
    </div>

    <div class="target-payment-solver">
      <div class="target-solver-copy"><span class="eyebrow">TARGET PAYMENT SOLVER</span><strong>Work backward from the customer's budget.</strong><small>DRIVE will estimate the down payment needed for a selected term.</small></div>
      <div class="field"><label>Target Payment</label><input class="plain-input" id="labTargetPayment" type="number" min="0" value="${goal||0}"></div>
      <div class="field"><label>Target Term</label><select class="plain-input" id="labTargetTerm">${[48,60,72,84].map(n=>`<option value="${n}" ${Number(profile.preferredTermMonths||72)===n?"selected":""}>${n} months</option>`).join("")}</select></div>
      <button class="btn secondary" id="solve-target-payment">${icon("wand-sparkles")} Solve Down Payment</button>
    </div>
    <div class="target-payment-result hidden" id="target-payment-result"></div>

    <div class="payment-lab-facts">
      <span><small>Sale Price</small><strong>${money(sale)}</strong></span>
      <span><small>Trade</small><strong>${money(tradeAllowance)}</strong></span>
      <span><small>Customer Down Preference</small><strong id="labDownFact">${money(startingDown)}</strong></span>
      <span><small>Payment Goal</small><strong>${goal?money(goal)+"/mo":"—"}</strong></span>
    </div>

    <div class="payment-scenario-grid" id="payment-scenario-grid"></div>

    <div class="payment-lab-note">${icon("info")} Scenarios are fictional RP estimates. Choose a plan to load those values into the Finance Worksheet, where Finance can still edit them before finalizing.</div>
  `);

  const renderScenarios=()=>{
    const creditTier=document.querySelector("#labCreditTier").value;
    const apr=Number(document.querySelector("#labApr").value||0);
    const preferredDown=Number(document.querySelector("#labDown").value||0);
    const menu=document.querySelector("#labMenu").value;
    const menuProducts={
      base:[],
      protect:["gap","extended_warranty"],
      complete:["gap","extended_warranty","maintenance","tire_wheel"]
    }[menu]||[];
    const productPrices={gap:995,extended_warranty:2495,maintenance:1495,tire_wheel:895};
    const productTotal=menuProducts.reduce((s,id)=>s+productPrices[id],0);
    const scenarios=[
      {id:"short",label:"Short Term",term:48,down:Math.max(preferredDown,Math.round(sale*.15)),desc:"Higher payment, faster payoff"},
      {id:"balanced",label:"Balanced",term:60,down:Math.max(preferredDown,Math.round(sale*.10)),desc:"Middle-ground payment structure"},
      {id:"lower",label:"Lower Payment",term:72,down:preferredDown,desc:"Lower monthly payment"},
      {id:"cashlight",label:"Low Cash Due",term:84,down:Math.min(preferredDown,Math.round(sale*.05)),desc:"Lowest cash due at signing"}
    ];
    document.querySelector("#labDownFact").textContent=money(preferredDown);
    const grid=document.querySelector("#payment-scenario-grid");
    grid.innerHTML=scenarios.map(s=>{
      const principal=Math.max(0,sale-s.down-tradeAllowance+productTotal);
      const payment=monthlyPayment(principal,apr,s.term);
      const delta=goal?payment-goal:0;
      return `<article class="payment-scenario-card ${goal && payment<=goal?"meets-goal":""}">
        <div class="payment-scenario-top"><span>${s.label}</span><strong>${money(payment)}<small>/mo</small></strong></div>
        <p>${s.desc}</p>
        <div class="payment-scenario-values">
          <span><small>Down</small><strong>${money(s.down)}</strong></span>
          <span><small>Term</small><strong>${s.term} mo</strong></span>
          <span><small>APR</small><strong>${apr.toFixed(2)}%</strong></span>
          <span><small>Financed</small><strong>${money(principal)}</strong></span>
        </div>
        ${goal?`<div class="goal-delta ${delta<=0?"good":"high"}">${delta<=0?icon("circle-check-big"):icon("triangle-alert")} ${delta<=0?`${money(Math.abs(delta))}/mo under goal`:`${money(delta)}/mo over goal`}</div>`:""}
        <button class="btn ${goal && payment<=goal?"primary":"secondary"}" data-use-payment-plan="${s.id}" data-label="${safe(s.label)}" data-down="${s.down}" data-term="${s.term}" data-apr="${apr}" data-credit-tier="${safe(creditTier)}" data-menu="${menu}" data-products="${menuProducts.join(",")}" data-payment="${payment.toFixed(2)}" data-principal="${principal.toFixed(2)}">${icon("arrow-right")} Use This Plan</button>
      </article>`;
    }).join("");
    hydrateIcons();
    grid.querySelectorAll("[data-use-payment-plan]").forEach(btn=>btn.addEventListener("click",()=>{
      const menuLabel={
        base:"Base",
        protect:"Protect",
        complete:"Complete"
      }[btn.dataset.menu] || "Custom";
      const preset={
        scenarioId:btn.dataset.usePaymentPlan,
        scenarioLabel:btn.dataset.label||"Payment Lab Plan",
        creditTier:btn.dataset.creditTier||"Tier 1",
        downPayment:Number(btn.dataset.down||0),
        tradeAllowance,
        termMonths:Number(btn.dataset.term||72),
        apr:Number(btn.dataset.apr||0),
        products:(btn.dataset.products||"").split(",").filter(Boolean),
        fAndIMenu:menuLabel,
        amountFinanced:Number(btn.dataset.principal||0),
        monthlyPayment:Number(btn.dataset.payment||0),
        internalNotes:`Payment Lab: ${btn.dataset.label||"Selected plan"} • ${menuLabel} F&I menu • ${btn.dataset.term||72} months • ${Number(btn.dataset.apr||0).toFixed(2)}% APR • ${money(Number(btn.dataset.down||0))} down • estimated ${money(Number(btn.dataset.payment||0))}/mo.`,
        readiness:{planSelected:true}
      };
      financeWorksheetModal(d,preset);
    }));
  };

  document.querySelector("#solve-target-payment")?.addEventListener("click",()=>{
    const payment=Number(document.querySelector("#labTargetPayment").value||0);
    const term=Number(document.querySelector("#labTargetTerm").value||72);
    const apr=Number(document.querySelector("#labApr").value||0);
    const menu=document.querySelector("#labMenu").value;
    const menuProducts={base:[],protect:["gap","extended_warranty"],complete:["gap","extended_warranty","maintenance","tire_wheel"]}[menu]||[];
    const prices={gap:995,extended_warranty:2495,maintenance:1495,tire_wheel:895};
    const productTotal=menuProducts.reduce((sum,id)=>sum+prices[id],0);
    const affordablePrincipal=principalForPayment(payment,apr,term);
    const requiredDown=Math.max(0,sale-tradeAllowance+productTotal-affordablePrincipal);
    const result=document.querySelector("#target-payment-result");
    result.classList.remove("hidden");
    if(!payment){
      result.innerHTML=`${icon("triangle-alert")}<div><strong>Enter a target monthly payment.</strong><span>DRIVE needs a monthly goal before it can solve the structure.</span></div>`;
      hydrateIcons();
      return;
    }
    document.querySelector("#labDown").value=Math.ceil(requiredDown/100)*100;
    result.innerHTML=`${icon("calculator")}<div><strong>Estimated down payment: ${money(Math.ceil(requiredDown/100)*100)}</strong><span>At ${term} months and ${apr.toFixed(2)}% APR with the selected F&I menu. Payment Lab scenarios were updated automatically.</span></div>`;
    renderScenarios();
    hydrateIcons();
  });
  document.querySelectorAll("#labCreditTier,#labApr,#labDown,#labMenu").forEach(el=>el.addEventListener("input",renderScenarios));
  renderScenarios();
}

function financeAcceptanceModal(d, snapshot, forcedMethod = "") {
  if(!d || !snapshot)return;
  const existingMethod=snapshot.acceptance?.method || forcedMethod || "customer_present";
  modal("Record Finance Acceptance",`
    <div class="finance-acceptance-hero">
      <span class="record-icon">${icon("handshake")}</span>
      <div><span class="eyebrow">PAYMENT PLAN DECISION</span><h3>${safe(d.customerName||"Customer")}</h3><p>${money(snapshot.monthlyPayment||0)}/mo • ${Number(snapshot.termMonths||0)} months • ${Number(snapshot.apr||0).toFixed(2)}% APR</p></div>
    </div>
    <div class="field full"><label>Acceptance Method</label><select class="plain-input" id="financeAcceptanceMethod">
      <option value="customer_present" ${existingMethod==="customer_present"?"selected":""}>Customer Present / Customer Accepted</option>
      <option value="staff_assisted" ${existingMethod==="staff_assisted"?"selected":""}>Staff-Assisted / Solo RP</option>
    </select></div>
    <div class="field full"><label>Acceptance Note <span class="optional-label">Optional</span></label><textarea class="plain-input textarea" id="financeAcceptanceNote" placeholder="Example: Customer selected the Balanced plan after reviewing payment and coverage options.">${safe(snapshot.acceptance?.note||"")}</textarea></div>
    <div class="finance-acceptance-warning">${icon("shield-check")}<div><strong>Acceptance applies to this Finance package structure.</strong><span>If the payment, APR, term, down payment, or products change materially, Finance should record acceptance again.</span></div></div>
  `,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="confirm-finance-acceptance">${icon("handshake")} Record Acceptance</button>`);

  document.querySelector("#confirm-finance-acceptance")?.addEventListener("click",()=>{
    const method=document.querySelector("#financeAcceptanceMethod").value;
    const note=document.querySelector("#financeAcceptanceNote").value.trim();
    const acceptance={
      method,
      note,
      acceptedAt:new Date().toISOString(),
      acceptedByUid:state.user.uid,
      acceptedByName:state.profile?.displayName||state.user.email||"Sterling Finance",
      monthlyPayment:Number(snapshot.monthlyPayment||0),
      termMonths:Number(snapshot.termMonths||0),
      apr:Number(snapshot.apr||0),
      amountFinanced:Number(snapshot.amountFinanced||0),
      products:[...(snapshot.products||[])]
    };
    financeWorksheetModal(d,{
      ...snapshot,
      acceptance,
      readiness:{...(snapshot.readiness||{}),paymentReviewed:true,planSelected:true}
    });
  });
}

function financePackagePreviewModal(d, snapshot) {
  if(!d || !snapshot)return;
  const productLabels={
    extended_warranty:"Extended Warranty",
    gap:"GAP Coverage",
    maintenance:"Maintenance Plan",
    tire_wheel:"Tire & Wheel Protection"
  };
  const products=(snapshot.products||[]).map(id=>productLabels[id]||id);
  const sale=Number(d.counterPrice||d.finalPrice||d.price||0);

  modal("Customer Finance Preview",`
    <div class="customer-finance-preview-hero">
      <div>
        <span class="eyebrow">STERLING FINANCE • PAYMENT PRESENTATION</span>
        <h3>${safe(d.customerName||"Customer")}</h3>
        <p>${safe(d.vehicleName||"Vehicle")} • ${safe(d.dealNumber||"Deal")}</p>
      </div>
      <div class="preview-payment">
        <span>Estimated Monthly Payment</span>
        <strong>${money(snapshot.monthlyPayment||0)}<small>/mo</small></strong>
      </div>
    </div>

    <div class="customer-finance-preview-grid">
      <div><span>Vehicle Price</span><strong>${money(sale)}</strong></div>
      <div><span>Down Payment</span><strong>${money(snapshot.downPayment||0)}</strong></div>
      <div><span>Trade Allowance</span><strong>${money(snapshot.tradeAllowance||0)}</strong></div>
      <div><span>Amount Financed</span><strong>${money(snapshot.amountFinanced||0)}</strong></div>
      <div><span>Term</span><strong>${Number(snapshot.termMonths||0)} months</strong></div>
      <div><span>APR</span><strong>${Number(snapshot.apr||0).toFixed(2)}%</strong></div>
    </div>

    <div class="customer-finance-products">
      <div class="record-section-head"><div><span class="eyebrow">F&I SELECTIONS</span><h4>Protection & Coverage</h4></div><strong>${money(snapshot.productTotal||0)}</strong></div>
      ${products.length ? `<div class="preview-product-list">${products.map(name=>`<span>${icon("check")} ${safe(name)}</span>`).join("")}</div>` : `<div class="preview-no-products">${icon("minus")} No optional F&I products selected.</div>`}
    </div>

    <div class="customer-finance-preview-summary">
      <div><span>RP Credit Tier</span><strong>${safe(snapshot.creditTier||"Tier 1")}</strong></div>
      <div><span>Payment Structure</span><strong>${Number(snapshot.termMonths||0)} mo @ ${Number(snapshot.apr||0).toFixed(2)}%</strong></div>
      <div><span>Cash Due</span><strong>${money(snapshot.downPayment||0)}</strong></div>
    </div>

    <div class="customer-preview-disclaimer">${icon("info")} This is a fictional Sterling Motors roleplay payment presentation, not a real credit offer or lending disclosure.</div>
  `,`
    <button class="btn secondary" id="back-to-finance-package">${icon("arrow-left")} Back to Package</button>
    <span class="modal-footer-spacer"></span>
    <button class="btn secondary" id="preview-staff-accept">${icon("user-check")} Staff-Assisted Accept</button>
    <button class="btn primary" id="preview-customer-accept">${icon("handshake")} Customer Accepts Plan</button>
  `);

  document.querySelector("#back-to-finance-package")?.addEventListener("click",()=>financeWorksheetModal(d,snapshot));
  document.querySelector("#preview-customer-accept")?.addEventListener("click",()=>financeAcceptanceModal(d,snapshot,"customer_present"));
  document.querySelector("#preview-staff-accept")?.addEventListener("click",()=>financeAcceptanceModal(d,snapshot,"staff_assisted"));
}

function financeWorksheetModal(d, preset = null) {
  const trade=state.data.tradeIns.find(t=>t.dealId===d.id);
  const existing=state.data.financeApplications.find(x=>x.dealId===d.id);
  const sale=Number(d.counterPrice || d.finalPrice || d.price || 0);
  const products=[
    ["extended_warranty","Extended Warranty",2495],
    ["gap","GAP Coverage",995],
    ["maintenance","Maintenance Plan",1495],
    ["tire_wheel","Tire & Wheel Protection",895]
  ];
  const selected=new Set(preset?.products || existing?.products || []);
  modal("Finance Worksheet", `
    <div class="finance-hero"><div><span class="eyebrow">DEAL ${safe(d.dealNumber || "")}</span><h3>${safe(d.customerName || "Customer")}</h3><p>${safe(d.vehicleName || "Vehicle")}</p></div><div><span>Sale Price</span><strong>${money(sale)}</strong></div></div>
    <div class="finance-workspace-actions">
      <div class="finance-primary-tools">
        <button class="btn secondary small" id="finance-payment-lab">${icon("sliders-horizontal")} Payment Lab</button>
        <button class="btn secondary small" id="preview-finance-package">${icon("presentation")} Customer Preview</button>
      </div>
      <div class="finance-menu-presets">
        <span>F&I Menu:</span>
        <button class="chip-btn" type="button" data-fi-menu="base">Base</button>
        <button class="chip-btn" type="button" data-fi-menu="protect">Protect</button>
        <button class="chip-btn" type="button" data-fi-menu="complete">Complete</button>
      </div>
    </div>
    <form id="finance-form" class="form-grid">
      <div class="field"><label>RP Credit Tier</label><select class="plain-input" id="creditTier">${["Tier 1","Tier 2","Tier 3","Tier 4"].map(x=>`<option ${x===(preset?.creditTier || existing?.creditTier || "Tier 1")?"selected":""}>${x}</option>`).join("")}</select></div>
      ${formField("Down Payment","downPayment",String(preset?.downPayment ?? existing?.downPayment ?? 0),"number","required min='0'")}
      <div class="field"><label>Manager-Approved Trade Allowance</label><input class="plain-input" id="financeTrade" type="number" value="${Number(existing?.tradeAllowance ?? trade?.managerApprovedAllowance ?? d.tradeAllowance ?? 0)}" readonly></div>
      ${formField("APR","apr",String(preset?.apr ?? existing?.apr ?? 6.49),"number","required min='0' step='0.01'")}
      <div class="field"><label>Term</label><select class="plain-input" id="termMonths">${[36,48,60,72,84].map(n=>`<option value="${n}" ${Number(preset?.termMonths ?? existing?.termMonths ?? 72)===n?"selected":""}>${n} months</option>`).join("")}</select></div>
      <div class="field"><label>Fictional Financing Source</label><select class="plain-input" id="financeSource">
        ${["Sterling Financial","Horizon Auto Credit","Community Motor Bank","Cash / No Lender"].map(x=>`<option ${x===(preset?.financeSource || existing?.financeSource || "Sterling Financial")?"selected":""}>${x}</option>`).join("")}
      </select></div>
      <div class="field"><label>Program Decision</label><select class="plain-input" id="financeDecision">
        ${["pending","approved","conditional","declined"].map(x=>`<option value="${x}" ${x===(preset?.financeDecision || existing?.financeDecision || "pending")?"selected":""}>${x}</option>`).join("")}
      </select></div>
      <div class="field"><label>Approval Expiration <span class="optional-label">RP only</span></label><input class="plain-input" id="financeApprovalExpires" type="date" value="${safe(preset?.approvalExpires || existing?.approvalExpires || "")}"></div>
      <div class="field"><label>Funding Status</label><select class="plain-input" id="financeFundingStatus">
        ${["pending_contracts","submitted","funded","exception","closed"].map(x=>`<option value="${x}" ${x===(preset?.fundingStatus || existing?.fundingStatus || "pending_contracts")?"selected":""}>${x.replaceAll("_"," ")}</option>`).join("")}
      </select></div>
      <div class="field full"><label>F&I Products</label><div class="product-options">${products.map(([id,label,price])=>`<label><input type="checkbox" data-finance-product="${id}" data-price="${price}" ${selected.has(id)?"checked":""}><span><strong>${label}</strong><small>${money(price)}</small></span></label>`).join("")}</div></div>
      <div class="field full"><label>Finance Internal Notes <span class="optional-label">Optional</span></label><textarea class="plain-input textarea" id="financeInternalNotes" placeholder="RP-only notes about the payment package, customer preferences, or follow-up.">${safe(preset?.internalNotes || existing?.internalNotes || "")}</textarea></div>
    </form>
    ${preset ? `<div class="payment-lab-loaded">${icon("circle-check-big")}<div><strong>${safe(preset.scenarioLabel||"Payment Lab plan")} loaded into package</strong><span>${safe(preset.creditTier||"Tier 1")} • ${safe(preset.fAndIMenu||"Custom")} menu • ${money(preset.monthlyPayment||0)}/mo scenario</span></div></div>` : ""}

    <div class="deal-structure-waterfall">
      <div class="waterfall-head"><span class="eyebrow">DEAL STRUCTURE</span><strong>How the amount financed is built</strong></div>
      <div class="waterfall-line"><span>Vehicle sale price</span><strong>${money(sale)}</strong></div>
      <div class="waterfall-line add"><span>F&I products</span><strong id="waterfallProducts">+$0</strong></div>
      <div class="waterfall-line subtract"><span>Approved trade allowance</span><strong id="waterfallTrade">-$0</strong></div>
      <div class="waterfall-line subtract"><span>Down payment</span><strong id="waterfallDown">-$0</strong></div>
      <div class="waterfall-total"><span>Amount financed</span><strong id="waterfallPrincipal">$0</strong></div>
    </div>

    <div class="finance-acceptance-card ${(preset?.acceptance || existing?.acceptance) ? "accepted" : ""}">
      <div>
        <span class="eyebrow">CUSTOMER DECISION</span>
        <strong>${(preset?.acceptance || existing?.acceptance) ? "Payment plan accepted" : "Acceptance not recorded"}</strong>
        <small>${(preset?.acceptance || existing?.acceptance)?.method==="staff_assisted" ? `Staff-assisted by ${safe((preset?.acceptance || existing?.acceptance)?.acceptedByName || "Sterling Finance")}` : (preset?.acceptance || existing?.acceptance) ? "Customer-present acceptance recorded" : "Present the package before final Delivery handoff."}</small>
      </div>
      <button class="btn secondary small" id="record-finance-acceptance">${icon("handshake")} ${(preset?.acceptance || existing?.acceptance) ? "Update Acceptance" : "Record Acceptance"}</button>
    </div>

    <div class="finance-readiness">
      <div class="readiness-head"><div><span class="eyebrow">DELIVERY READINESS</span><strong>Finance review checklist</strong></div><span id="finance-readiness-count">0 / 4</span></div>
      ${[
        ["paymentReviewed","Payment options reviewed with customer"],
        ["productsPresented","F&I products presented"],
        ["planSelected","Customer selected a payment plan"],
        ["figuresReviewed","Final figures reviewed before delivery"]
      ].map(([id,label])=>`<label><input type="checkbox" data-finance-readiness="${id}" ${(preset?.readiness?.[id] || existing?.readiness?.[id])?"checked":""}><span>${label}</span></label>`).join("")}
    </div>

    <div class="finance-summary">
      <div><span>Products</span><strong id="sumProducts">$0</strong></div>
      <div><span>Amount Financed</span><strong id="sumPrincipal">$0</strong></div>
      <div class="payment-total"><span>Estimated Payment</span><strong id="sumPayment">$0/mo</strong></div>
    </div>
    <div class="rp-disclaimer compact">${icon("shield-check")} RP-only finance calculator. Never enter real credit or banking information.</div>
  `, `<button class="btn secondary" data-close-modal>Cancel</button><button class="btn secondary" id="save-finance-draft">${icon("save")} Save Draft</button><button class="btn primary" id="save-finance">${icon("file-check-2")} Finalize & Send to Delivery</button>`);

  const calculate=()=>{
    const productTotal=[...document.querySelectorAll("[data-finance-product]:checked")].reduce((s,x)=>s+Number(x.dataset.price||0),0);
    const down=Number(document.querySelector("#downPayment").value||0), allowance=Number(document.querySelector("#financeTrade").value||0);
    const principal=Math.max(0,sale-down-allowance+productTotal);
    const apr=Number(document.querySelector("#apr").value||0), term=Number(document.querySelector("#termMonths").value||72);
    const payment=monthlyPayment(principal,apr,term);
    document.querySelector("#sumProducts").textContent=money(productTotal);
    document.querySelector("#sumPrincipal").textContent=money(principal);
    document.querySelector("#sumPayment").textContent=money(payment)+"/mo";
    document.querySelector("#waterfallProducts").textContent="+"+money(productTotal);
    document.querySelector("#waterfallTrade").textContent="-"+money(allowance);
    document.querySelector("#waterfallDown").textContent="-"+money(down);
    document.querySelector("#waterfallPrincipal").textContent=money(principal);
    return {productTotal,down,allowance,principal,apr,term,payment};
  };
  document.querySelectorAll("#finance-form input,#finance-form select").forEach(x=>x.addEventListener("input",calculate));
  let currentAcceptance=preset?.acceptance || existing?.acceptance || null;
  const readinessInputs=()=>[...document.querySelectorAll("[data-finance-readiness]")];
  const financeReadiness=()=>Object.fromEntries(readinessInputs().map(x=>[x.dataset.financeReadiness,x.checked]));
  const syncReadiness=()=>{
    const checked=readinessInputs().filter(x=>x.checked).length;
    const total=readinessInputs().length;
    const count=document.querySelector("#finance-readiness-count");
    if(count) count.textContent=`${checked} / ${total}`;
    const finalize=document.querySelector("#save-finance");
    const decision=document.querySelector("#financeDecision")?.value || "pending";
    const lenderReady=["approved","conditional"].includes(decision) || document.querySelector("#financeSource")?.value==="Cash / No Lender";
    if(finalize){
      finalize.disabled=checked!==total || !currentAcceptance || !lenderReady;
      finalize.title=checked!==total ? "Complete the Finance review checklist before Delivery" : !currentAcceptance ? "Record customer acceptance before Delivery" : !lenderReady ? "Record an approved/conditional program decision before Delivery" : "Ready for Delivery";
    }
  };
  readinessInputs().forEach(x=>x.addEventListener("change",syncReadiness));
  document.querySelector("#financeDecision")?.addEventListener("change",syncReadiness);
  document.querySelector("#financeSource")?.addEventListener("change",syncReadiness);
  document.querySelector("#record-finance-acceptance")?.addEventListener("click",()=>{
    const x=calculate();
    const productIds=[...document.querySelectorAll("[data-finance-product]:checked")].map(el=>el.dataset.financeProduct);
    financeAcceptanceModal(d,{
      creditTier:document.querySelector("#creditTier").value,
      downPayment:x.down,tradeAllowance:x.allowance,apr:x.apr,termMonths:x.term,
      products:productIds,productTotal:x.productTotal,amountFinanced:x.principal,
      monthlyPayment:Number(x.payment.toFixed(2)),
      financeSource:document.querySelector("#financeSource").value,
      financeDecision:document.querySelector("#financeDecision").value,
      approvalExpires:document.querySelector("#financeApprovalExpires").value,
      fundingStatus:document.querySelector("#financeFundingStatus").value,
      internalNotes:document.querySelector("#financeInternalNotes")?.value.trim()||"",
      readiness:financeReadiness(),
      acceptance:currentAcceptance
    });
  });
  syncReadiness();

  document.querySelector("#finance-payment-lab")?.addEventListener("click",()=>financePaymentLabModal(d));
  document.querySelector("#preview-finance-package")?.addEventListener("click",()=>{
    const x=calculate();
    const productIds=[...document.querySelectorAll("[data-finance-product]:checked")].map(el=>el.dataset.financeProduct);
    financePackagePreviewModal(d,{
      creditTier:document.querySelector("#creditTier").value,
      downPayment:x.down,tradeAllowance:x.allowance,apr:x.apr,termMonths:x.term,
      products:productIds,productTotal:x.productTotal,amountFinanced:x.principal,
      monthlyPayment:Number(x.payment.toFixed(2)),
      financeSource:document.querySelector("#financeSource").value,
      financeDecision:document.querySelector("#financeDecision").value,
      approvalExpires:document.querySelector("#financeApprovalExpires").value,
      fundingStatus:document.querySelector("#financeFundingStatus").value,
      internalNotes:document.querySelector("#financeInternalNotes")?.value.trim()||"",
      readiness:financeReadiness(),
      acceptance:currentAcceptance
    });
  });
  document.querySelectorAll("[data-fi-menu]").forEach(btn=>btn.addEventListener("click",()=>{
    const menu={
      base:[],
      protect:["gap","extended_warranty"],
      complete:["gap","extended_warranty","maintenance","tire_wheel"]
    }[btn.dataset.fiMenu] || [];
    document.querySelectorAll("[data-finance-product]").forEach(box=>box.checked=menu.includes(box.dataset.financeProduct));
    calculate();
  }));
  calculate();

  document.querySelector("#save-finance-draft")?.addEventListener("click",async()=>{
    const form=document.querySelector("#finance-form"); if(!form.reportValidity()) return;
    const button=document.querySelector("#save-finance-draft");button.disabled=true;
    const x=calculate();
    const productsSelected=[...document.querySelectorAll("[data-finance-product]:checked")].map(el=>el.dataset.financeProduct);
    const data={
      dealId:d.id,dealNumber:d.dealNumber || "",customerId:d.customerId || "",customerName:d.customerName || "",vehicleId:d.vehicleId,vehicleName:d.vehicleName || "",
      salePrice:sale,creditTier:document.querySelector("#creditTier").value,downPayment:x.down,tradeAllowance:x.allowance,products:productsSelected,productTotal:x.productTotal,
      amountFinanced:x.principal,apr:x.apr,termMonths:x.term,monthlyPayment:Number(x.payment.toFixed(2)),status:"draft",
      financeSource:document.querySelector("#financeSource").value,
      financeDecision:document.querySelector("#financeDecision").value,
      approvalExpires:document.querySelector("#financeApprovalExpires").value,
      fundingStatus:document.querySelector("#financeFundingStatus").value,
      acceptance:currentAcceptance,
      internalNotes:document.querySelector("#financeInternalNotes")?.value.trim()||"",
      readiness:financeReadiness(),
      revision:Number(existing?.revision||0)+1,
      lastRevisionAt:new Date().toISOString(),
      revisionHistory:[...(Array.isArray(existing?.revisionHistory)?existing.revisionHistory:[]),{
        revision:Number(existing?.revision||0)+1,status:"draft",apr:x.apr,termMonths:x.term,downPayment:x.down,
        amountFinanced:x.principal,monthlyPayment:Number(x.payment.toFixed(2)),products:productsSelected,
        editedAt:new Date().toISOString(),editedByName:state.profile?.displayName||state.user.email
      }],
      lastEditedBy:state.user.uid,lastEditedByName:state.profile?.displayName||state.user.email
    };
    try{
      let financeId=existing?.id;
      if(existing) await updateRecord("financeApplications",existing.id,data);
      else {const res=await createFinanceApplication(data,state.user);financeId=res.id;}
      await updateRecord("deals",d.id,{financeApplicationId:financeId,financeStatus:"draft"});
      await writeAudit(state.user,"finance.draft_saved","financeApplication",financeId,{dealId:d.id,amountFinanced:x.principal,termMonths:x.term,apr:x.apr});
      closeModal();await refreshData();setFlash("Finance package saved as a draft.");
    }catch(e){button.disabled=false;setFlash(e.message || "Unable to save Finance draft.","error");}
  });

  document.querySelector("#save-finance")?.addEventListener("click",async()=>{
    const form=document.querySelector("#finance-form"); if(!form.reportValidity()) return;
    const x=calculate();
    const productsSelected=[...document.querySelectorAll("[data-finance-product]:checked")].map(el=>el.dataset.financeProduct);
    const data={
      dealId:d.id,dealNumber:d.dealNumber || "",customerId:d.customerId || "",customerName:d.customerName || "",vehicleId:d.vehicleId,vehicleName:d.vehicleName || "",
      salePrice:sale,creditTier:document.querySelector("#creditTier").value,downPayment:x.down,tradeAllowance:x.allowance,products:productsSelected,productTotal:x.productTotal,
      amountFinanced:x.principal,apr:x.apr,termMonths:x.term,monthlyPayment:Number(x.payment.toFixed(2)),status:"approved",
      financeSource:document.querySelector("#financeSource").value,
      financeDecision:document.querySelector("#financeDecision").value,
      approvalExpires:document.querySelector("#financeApprovalExpires").value,
      fundingStatus:document.querySelector("#financeFundingStatus").value,
      acceptance:currentAcceptance,
      internalNotes:document.querySelector("#financeInternalNotes")?.value.trim()||"",
      readiness:financeReadiness(),
      revision:Number(existing?.revision||0)+1,
      lastRevisionAt:new Date().toISOString(),
      revisionHistory:[...(Array.isArray(existing?.revisionHistory)?existing.revisionHistory:[]),{
        revision:Number(existing?.revision||0)+1,status:"approved",apr:x.apr,termMonths:x.term,downPayment:x.down,
        amountFinanced:x.principal,monthlyPayment:Number(x.payment.toFixed(2)),products:productsSelected,
        editedAt:new Date().toISOString(),editedByName:state.profile?.displayName||state.user.email
      }],
      lastEditedBy:state.user.uid,lastEditedByName:state.profile?.displayName||state.user.email
    };
    try{
      let financeId=existing?.id;
      if(existing) await updateRecord("financeApplications",existing.id,data);
      else {const res=await createFinanceApplication(data,state.user);financeId=res.id;}
      const existingDelivery=state.data.deliveries.find(y=>y.dealId===d.id);
      let deliveryId=existingDelivery?.id;
      if(!existingDelivery){
        const del=await createDelivery({dealId:d.id,dealNumber:d.dealNumber || "",customerId:d.customerId || "",customerName:d.customerName || "",vehicleId:d.vehicleId,vehicleName:d.vehicleName || "",status:"preparing"},state.user);
        deliveryId=del.id;
      }
      await updateRecord("deals",d.id,{stage:"delivery",financeApplicationId:financeId,deliveryId,finalPrice:sale,financeStatus:"approved"});
      await createNotification({type:"finance",title:"Finance package complete",message:`${d.dealNumber || "Deal"} is ready for vehicle delivery.`,dealId:d.id},state.user);
      await writeAudit(state.user,"finance.approved","financeApplication",financeId,{dealId:d.id,amountFinanced:x.principal,termMonths:x.term,apr:x.apr});
      closeModal();await refreshData();setFlash("Finance package finalized. Vehicle moved to Delivery.");
    }catch(e){setFlash(e.message || "Unable to finalize financing.","error");}
  });
}

function deliveryModal(d) {
  const delivery=state.data.deliveries.find(x=>x.dealId===d.id);
  const trade=state.data.tradeIns.find(x=>x.dealId===d.id);
  if(!delivery){setFlash("No delivery record exists for this deal yet.","error");return;}
  modal("Vehicle Delivery", `
    <div class="delivery-head"><div class="record-icon">${icon("key-round")}</div><div><span class="eyebrow">FINAL HANDOFF</span><h3>${safe(d.vehicleName || "Vehicle")}</h3><p>${safe(d.customerName || "Customer")} • ${safe(d.dealNumber || "")}</p></div></div>
    <div class="delivery-checklist">
      ${["Vehicle cleaned and detailed","Fuel level checked","Documents signed","RP insurance verified","Keys provided","Warranty / coverage explained","Customer walkthrough completed","Final vehicle inspection complete"].map((x,i)=>`<label><input type="checkbox" class="delivery-check" data-index="${i}"><span>${x}</span></label>`).join("")}
    </div>
    ${trade ? `<div class="manager-note"><span>TRADE-IN DUE</span><p>${safe(trade.year)} ${safe(trade.make)} ${safe(trade.model)} • allowance ${money(trade.allowance)}. Completing delivery will receive this trade into Sterling inventory.</p></div>` : ""}
  `, `<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="complete-delivery" disabled>${icon("key-round")} Complete Delivery</button>`);
  const checks=[...document.querySelectorAll(".delivery-check")],button=document.querySelector("#complete-delivery");
  const sync=()=>button.disabled=!checks.every(x=>x.checked);
  checks.forEach(x=>x.addEventListener("change",sync));
  button?.addEventListener("click",async()=>{
    button.disabled=true;
    try{
      await updateRecord("deliveries",delivery.id,{status:"complete",completedBy:state.user.uid,completedByName:state.profile?.displayName || state.user.email,checklistComplete:true});
      await updateRecord("deals",d.id,{stage:"complete",deliveryStatus:"complete"});
      await updateRecord("vehicles",d.vehicleId,{status:"sold",ownerCustomerId:d.customerId || "",ownerCustomerName:d.customerName || ""});
      if(trade && !["service_review_required","service_review","reconditioning","service_approved","sales_floor","wholesale"].includes(trade.status||"")){
        const receivedVehicle=await receiveTradeInVehicle(trade,d,state.user);
        await createNotification({type:"service",title:"Trade-in needs Service review",message:`${trade.year} ${trade.make} ${trade.model} has been received and is waiting for retail inspection.`,tradeInId:trade.id,vehicleId:receivedVehicle.id},state.user);
      }
      await createNotification({type:"delivery",title:"Vehicle delivered",message:`${d.vehicleName || "Vehicle"} was delivered to ${d.customerName || "the customer"}.`,dealId:d.id},state.user);
      await writeAudit(state.user,"delivery.completed","delivery",delivery.id,{dealId:d.id,vehicleId:d.vehicleId});
      closeModal();await refreshData();setFlash("Delivery complete. Vehicle ownership and inventory updated.");
    }catch(e){button.disabled=false;setFlash(e.message || "Unable to complete delivery.","error");}
  });
}


function servicePage() {
  const appointments=state.data.serviceAppointments;
  const ros=state.data.repairOrders;
  const open=ros.filter(r=>!["closed","cancelled"].includes((r.status||"").toLowerCase()));
  const awaiting=ros.filter(r=>(r.status||"").toLowerCase()==="awaiting_customer_authorization").length;
  const ready=ros.filter(r=>(r.status||"").toLowerCase()==="ready_for_pickup").length;
  const tradeReviews=state.data.tradeIns.filter(t=>["received","service_review_required","service_review","reconditioning"].includes(t.status||""));
  const tradeReady=state.data.tradeIns.filter(t=>(t.status||"")==="service_approved").length;
  const acquisitionReviews=state.data.vehicles.filter(v=>v.sourceAcquisitionId && ["service_review","reconditioning"].includes(v.status||""));
  const acquisitionReady=state.data.vehicles.filter(v=>v.sourceAcquisitionId && (v.status||"")==="retail_ready").length;
  const today=new Date().toISOString().slice(0,10);
  const todayAppointments=appointments.filter(a=>a.date===today && !["complete","cancelled"].includes((a.status||"").toLowerCase())).length;

  return `
    ${pageHeader("FIXED OPERATIONS", "DRIVE Service", "Appointments, Repair Orders, technicians, authorization, parts, and permanent service history.",
      can("service.manage") ? `<button class="btn secondary" data-action="new-service-appointment">${icon("calendar-plus")} Appointment</button><button class="btn primary" data-action="new-repair-order">${icon("clipboard-plus")} New Repair Order</button>` : "")}
    <div class="metric-grid">
      ${metric("Today's Appointments",todayAppointments,"calendar-days","Scheduled for today")}
      ${metric("Open Repair Orders",open.length,"clipboard-list","Across the service drive")}
      ${metric("Awaiting Authorization",awaiting,"circle-pause","Customer decision required")}
      ${metric("Ready for Pickup",ready,"circle-check-big","Completed service work")}
    </div>

    <div class="trade-review-panel panel">
      <div class="panel-head">
        <div><span class="eyebrow">USED VEHICLE RECONDITIONING</span><h2>Trade-In Retail Review</h2></div>
        <div class="trade-review-summary"><span>${tradeReviews.length} awaiting Service</span><span>${tradeReady} retail-approved</span></div>
      </div>
      ${tradeReviews.length ? `<div class="trade-review-grid">
        ${tradeReviews.map(t=>{
          const vehicle=state.data.vehicles.find(v=>v.id===t.inventoryVehicleId || v.sourceTradeId===t.id);
          return `<article class="trade-review-card">
            <div class="trade-review-card-top"><span class="record-list-icon">${icon("car-front")}</span>${statusPill(t.status||"service_review_required")}</div>
            <h3>${safe(t.year||"")} ${safe(t.make||"")} ${safe(t.model||"")}</h3>
            <p>${Number(t.mileage||0).toLocaleString()} mi • ACV ${money(t.acv)}</p>
            <small>${safe(vehicle?.stockNumber||"Stock pending")} • ${safe(vehicle?.location||"Trade-In Inspection")}</small>
            ${can("service.manage") ? `<button class="btn primary small" data-trade-service-review="${t.id}">${icon("clipboard-check")} Review Trade-In</button>` : ""}
          </article>`;
        }).join("")}
      </div>` : `<div class="trade-review-empty">${icon("circle-check-big")}<div><strong>No trade-ins waiting on Service</strong><span>Received trade-ins will appear here before they can reach the sales floor.</span></div></div>`}
    </div>

    <div class="trade-review-panel panel">
      <div class="panel-head">
        <div><span class="eyebrow">ACQUIRED VEHICLE RECONDITIONING</span><h2>Purchased Vehicle Retail Review</h2></div>
        <div class="trade-review-summary"><span>${acquisitionReviews.length} awaiting Service</span><span>${acquisitionReady} retail-ready</span></div>
      </div>
      ${acquisitionReviews.length ? `<div class="trade-review-grid">
        ${acquisitionReviews.map(v=>{
          const acquisition=state.data.vehicleAcquisitions.find(a=>a.id===v.sourceAcquisitionId);
          return `<article class="trade-review-card acquisition-review-card">
            <div class="trade-review-card-top"><span class="record-list-icon">${icon("badge-dollar-sign")}</span>${statusPill(v.status||"service_review")}</div>
            <h3>${safe(v.year||"")} ${safe(v.make||"")} ${safe(v.model||"")}</h3>
            <p>${Number(v.mileage||0).toLocaleString()} mi • Purchased ${money(v.acquisitionCost||acquisition?.offerAmount||0)}</p>
            <small>${safe(v.stockNumber||"Stock pending")} • ${safe(v.location||"Service Intake")}</small>
            ${can("service.manage") ? `<button class="btn primary small" data-acquisition-service-review="${v.id}">${icon("clipboard-check")} Review Acquired Vehicle</button>` : ""}
          </article>`;
        }).join("")}
      </div>` : `<div class="trade-review-empty">${icon("circle-check-big")}<div><strong>No acquired vehicles waiting on Service</strong><span>Vehicles purchased through Sell Your Car will appear here whenever intake is marked Service Review.</span></div></div>`}
    </div>

    <div class="service-layout">
      <div class="panel service-main">
        <div class="panel-head"><div><span class="eyebrow">SHOP CONTROL</span><h2>Repair Orders</h2></div><span class="toolbar-count">${open.length} open</span></div>
        ${ros.length ? `<div class="ro-board">
          ${["checked_in","diagnosis","awaiting_customer_authorization","parts_required","repair_in_progress","quality_inspection","ready_for_pickup"].map(status=>{
            const items=ros.filter(r=>(r.status||"checked_in").toLowerCase()===status);
            return `<section class="ro-lane">
              <div class="ro-lane-head"><span>${status.replaceAll("_"," ")}</span><b>${items.length}</b></div>
              <div class="ro-lane-stack">${items.length ? items.map(r=>`<button class="ro-card" data-ro="${r.id}">
                <div><strong>${safe(r.roNumber || r.id.slice(0,8).toUpperCase())}</strong>${statusPill(r.status||"checked_in")}</div>
                <h3>${safe(r.vehicleName||"Vehicle")}</h3>
                <p>${safe(r.customerName||"Customer")}</p>
                <small>${safe(r.technicianName||"Unassigned technician")}</small>
              </button>`).join("") : '<div class="ro-lane-empty">No work</div>'}</div>
            </section>`;
          }).join("")}
        </div>` : emptyState("wrench","No Repair Orders","Check in a service customer to create the first RO.",can("service.manage")?`<button class="btn primary" data-action="new-repair-order">Create Repair Order</button>`:"")}
      </div>

      <div class="panel service-side">
        <div class="panel-head"><div><span class="eyebrow">APPOINTMENTS</span><h2>Service Schedule</h2></div></div>
        <div class="appointment-list">
          ${appointments.length ? appointments.slice(0,8).map(a=>`<div class="appointment-row">
            <div class="appointment-date"><strong>${safe(a.date||"—")}</strong><span>${safe(a.time||"")}</span></div>
            <div><strong>${safe(a.customerName||"Customer")}</strong><small>${safe(a.vehicleName||"Vehicle")} • ${safe(a.serviceType||"Service")}</small></div>
            ${statusPill(a.status||"scheduled")}
            ${can("service.manage") && (a.status||"scheduled")==="scheduled" ? `<button class="icon-btn" data-checkin-appointment="${a.id}" title="Check in">${icon("log-in")}</button>` : ""}
          </div>`).join("") : `<div class="column-empty">No appointments scheduled</div>`}
        </div>
      </div>
    </div>
  `;
}


function tradeInServiceReviewModal(trade) {
  if(!trade)return;
  const vehicle=state.data.vehicles.find(v=>v.id===trade.inventoryVehicleId || v.sourceTradeId===trade.id);
  modal("Trade-In Service Review",`
    <div class="ro-detail-hero">
      <div class="record-icon">${icon("car-front")}</div>
      <div><span class="eyebrow">RETAIL INSPECTION</span><h3>${safe(trade.year||"")} ${safe(trade.make||"")} ${safe(trade.model||"")}</h3><p>${Number(trade.mileage||0).toLocaleString()} mi • ${safe(vehicle?.stockNumber||"Trade-In")}</p></div>
      ${statusPill(trade.status||"service_review_required")}
    </div>
    <form id="trade-service-form" class="form-grid">
      <div class="field"><label>Mechanical</label><select class="plain-input" id="tsiMechanical"><option>Pass</option><option>Repair Required</option><option>Fail - Wholesale</option></select></div>
      <div class="field"><label>Brakes</label><select class="plain-input" id="tsiBrakes"><option>Pass</option><option>Service Recommended</option><option>Repair Required</option></select></div>
      <div class="field"><label>Tires</label><select class="plain-input" id="tsiTires"><option>Pass</option><option>Replace Soon</option><option>Replacement Required</option></select></div>
      <div class="field"><label>Safety Systems</label><select class="plain-input" id="tsiSafety"><option>Pass</option><option>Repair Required</option><option>Fail</option></select></div>
      <div class="field"><label>Warning Lights</label><select class="plain-input" id="tsiLights"><option>None</option><option>Present - Diagnosed</option><option>Present - Needs Diagnosis</option></select></div>
      <div class="field"><label>Road Test</label><select class="plain-input" id="tsiRoad"><option>Pass</option><option>Concern Found</option><option>Not Roadworthy</option></select></div>
      ${formField("Estimated Recon Cost","tsiReconCost",String(trade.reconditioningEstimate||0),"number","required min='0'")}
      <div class="field"><label>Retail Decision</label><select class="plain-input" id="tsiDecision">
        <option value="approve">Approve for Retail</option>
        <option value="reconditioning">Needs Reconditioning</option>
        <option value="wholesale">Do Not Retail / Wholesale</option>
      </select></div>
      <div class="field full"><label>Service Inspection Notes</label><textarea class="plain-input textarea" id="tsiNotes" required placeholder="Inspection findings, required repairs, safety concerns...">${safe(trade.serviceReviewNotes||"")}</textarea></div>
    </form>
    <div class="rp-disclaimer">${icon("shield-check")} Service approval controls whether this trade-in can be offered for retail sale in Sterling Motors.</div>
  `,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-trade-service-review">${icon("clipboard-check")} Complete Review</button>`);

  document.querySelector("#save-trade-service-review")?.addEventListener("click",async()=>{
    const form=document.querySelector("#trade-service-form");if(!form.reportValidity())return;
    const decision=document.querySelector("#tsiDecision").value;
    const recon=Number(document.querySelector("#tsiReconCost").value||0);
    const notes=document.querySelector("#tsiNotes").value.trim();
    const status=decision==="approve"?"service_approved":decision==="reconditioning"?"reconditioning":"wholesale";
    const vehicleStatus=decision==="approve"?"retail_ready":decision==="reconditioning"?"reconditioning":"wholesale";
    try{
      await updateRecord("tradeIns",trade.id,{
        status,
        serviceReviewStatus:decision,
        serviceReviewNotes:notes,
        reconditioningEstimate:recon,
        serviceInspection:{
          mechanical:document.querySelector("#tsiMechanical").value,
          brakes:document.querySelector("#tsiBrakes").value,
          tires:document.querySelector("#tsiTires").value,
          safety:document.querySelector("#tsiSafety").value,
          warningLights:document.querySelector("#tsiLights").value,
          roadTest:document.querySelector("#tsiRoad").value
        },
        serviceReviewedBy:state.user.uid,
        serviceReviewedByName:state.profile?.displayName||state.user.email
      });
      if(vehicle) await updateRecord("vehicles",vehicle.id,{
        status:vehicleStatus,
        serviceReviewStatus:decision,
        reconditioningEstimate:recon,
        location:decision==="approve"?"Retail Ready Holding":decision==="reconditioning"?"Service / Reconditioning":"Wholesale Hold"
      });
      await writeAudit(state.user,"trade.service_review_completed","tradeIn",trade.id,{decision,reconditioningEstimate:recon,vehicleId:vehicle?.id||""});
      if(decision==="approve") await createNotification({type:"inventory",title:"Trade-in approved for retail",message:`${trade.year} ${trade.make} ${trade.model} passed Service review and can be pushed to the sales floor.`,tradeInId:trade.id,vehicleId:vehicle?.id||""},state.user);
      closeModal();await refreshData();setFlash(decision==="approve"?"Trade-in approved for retail. It can now be pushed to the sales floor.":decision==="reconditioning"?"Trade-in sent to reconditioning.":"Trade-in marked wholesale / not retail eligible.");
    }catch(e){setFlash(e.message||"Unable to complete trade-in Service review.","error");}
  });
}

function acquisitionVehicleServiceReviewModal(vehicle) {
  if(!vehicle || !vehicle.sourceAcquisitionId)return;
  const acquisition=state.data.vehicleAcquisitions.find(a=>a.id===vehicle.sourceAcquisitionId);
  modal("Acquired Vehicle Service Review",`
    <div class="ro-detail-hero">
      <div class="record-icon">${icon("badge-dollar-sign")}</div>
      <div><span class="eyebrow">STERLING-PURCHASED VEHICLE • RETAIL INSPECTION</span><h3>${safe(vehicle.year||"")} ${safe(vehicle.make||"")} ${safe(vehicle.model||"")}</h3><p>${Number(vehicle.mileage||0).toLocaleString()} mi • ${safe(vehicle.stockNumber||"Acquisition")}</p></div>
      ${statusPill(vehicle.status||"service_review")}
    </div>
    <div class="record-grid">
      <div><span>Purchase Cost</span><strong>${money(vehicle.acquisitionCost||acquisition?.offerAmount||0)}</strong></div>
      <div><span>Seller</span><strong>${safe(acquisition?.sellerName||"Customer")}</strong></div>
      <div><span>Submitted Condition</span><strong>${safe(acquisition?.condition||"—")}</strong></div>
      <div><span>Appraised Condition</span><strong>${safe(acquisition?.appraisedCondition||"—")}</strong></div>
    </div>
    <form id="acq-service-form" class="form-grid">
      <div class="field"><label>Mechanical</label><select class="plain-input" id="asiMechanical"><option>Pass</option><option>Repair Required</option><option>Fail - Wholesale</option></select></div>
      <div class="field"><label>Brakes</label><select class="plain-input" id="asiBrakes"><option>Pass</option><option>Service Recommended</option><option>Repair Required</option></select></div>
      <div class="field"><label>Tires</label><select class="plain-input" id="asiTires"><option>Pass</option><option>Replace Soon</option><option>Replacement Required</option></select></div>
      <div class="field"><label>Safety Systems</label><select class="plain-input" id="asiSafety"><option>Pass</option><option>Repair Required</option><option>Fail</option></select></div>
      <div class="field"><label>Warning Lights</label><select class="plain-input" id="asiLights"><option>None</option><option>Present - Diagnosed</option><option>Present - Needs Diagnosis</option></select></div>
      <div class="field"><label>Road Test</label><select class="plain-input" id="asiRoad"><option>Pass</option><option>Concern Found</option><option>Not Roadworthy</option></select></div>
      ${formField("Estimated Recon Cost","asiReconCost",String(vehicle.reconditioningEstimate||0),"number","required min='0'")}
      <div class="field"><label>Retail Decision</label><select class="plain-input" id="asiDecision">
        <option value="approve">Approve for Retail</option>
        <option value="reconditioning">Needs Reconditioning</option>
        <option value="wholesale">Do Not Retail / Wholesale</option>
      </select></div>
      <div class="field full"><label>Service Inspection Notes</label><textarea class="plain-input textarea" id="asiNotes" required placeholder="Inspection findings, required repairs, safety concerns...">${safe(vehicle.serviceReviewNotes||"")}</textarea></div>
    </form>
    <div class="rp-disclaimer">${icon("shield-check")} This inspection controls whether the purchased vehicle can be released to the Sterling sales floor.</div>
  `,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-acq-service-review">${icon("clipboard-check")} Complete Review</button>`);

  document.querySelector("#save-acq-service-review")?.addEventListener("click",async()=>{
    const form=document.querySelector("#acq-service-form");if(!form.reportValidity())return;
    const btn=document.querySelector("#save-acq-service-review");btn.disabled=true;
    const decision=document.querySelector("#asiDecision").value;
    const recon=Number(document.querySelector("#asiReconCost").value||0);
    const notes=document.querySelector("#asiNotes").value.trim();
    const vehicleStatus=decision==="approve"?"retail_ready":decision==="reconditioning"?"reconditioning":"wholesale";
    try{
      await updateRecord("vehicles",vehicle.id,{
        status:vehicleStatus,
        serviceReviewStatus:decision,
        serviceReviewNotes:notes,
        reconditioningEstimate:recon,
        serviceInspection:{
          mechanical:document.querySelector("#asiMechanical").value,
          brakes:document.querySelector("#asiBrakes").value,
          tires:document.querySelector("#asiTires").value,
          safety:document.querySelector("#asiSafety").value,
          warningLights:document.querySelector("#asiLights").value,
          roadTest:document.querySelector("#asiRoad").value
        },
        serviceReviewedBy:state.user.uid,
        serviceReviewedByName:state.profile?.displayName||state.user.email,
        location:decision==="approve"?"Retail Ready Holding":decision==="reconditioning"?"Service / Reconditioning":"Wholesale Hold"
      });
      await writeAudit(state.user,"acquisition.service_review_completed","vehicle",vehicle.id,{
        acquisitionId:vehicle.sourceAcquisitionId,
        decision,
        reconditioningEstimate:recon
      });
      if(decision==="approve"){
        await createNotification({
          type:"inventory",
          title:"Purchased vehicle approved for retail",
          message:`${vehicle.year} ${vehicle.make} ${vehicle.model} passed Service review and can be pushed to the sales floor.`,
          acquisitionId:vehicle.sourceAcquisitionId,
          vehicleId:vehicle.id
        },state.user);
      }
      closeModal();await refreshData();
      setFlash(decision==="approve"?"Purchased vehicle approved for retail. It can now be pushed to the sales floor.":decision==="reconditioning"?"Purchased vehicle sent to reconditioning.":"Purchased vehicle marked wholesale / not retail eligible.");
    }catch(e){
      btn.disabled=false;
      setFlash(e.message||"Unable to complete purchased-vehicle Service review.","error");
    }
  });
}

function pushTradeToSalesFloorModal(vehicle) {
  if(!vehicle || vehicle.status!=="retail_ready")return;
  const trade=vehicle.sourceTradeId ? state.data.tradeIns.find(t=>t.id===vehicle.sourceTradeId) : null;
  const acquisition=vehicle.sourceAcquisitionId ? state.data.vehicleAcquisitions.find(a=>a.id===vehicle.sourceAcquisitionId) : null;
  const sourceLabel=trade ? "Trade-In" : acquisition ? "Sterling-Purchased Vehicle" : "Used Vehicle";
  const sourceCost=Number(trade?.managerApprovedAcv ?? trade?.acv ?? acquisition?.offerAmount ?? vehicle.acquisitionCost ?? 0);
  const serviceNotes=vehicle.serviceReviewNotes || trade?.serviceReviewNotes || "Service approved this vehicle for retail sale.";

  modal("Push Vehicle to Sales Floor",`
    <div class="record-hero">
      <div class="record-icon">${icon("store")}</div>
      <div><span class="eyebrow">RETAIL RELEASE</span><h3>${safe(`${vehicle.year||""} ${vehicle.make||""} ${vehicle.model||""}`.trim())}</h3><p>Service-approved ${sourceLabel.toLowerCase()} • ${safe(vehicle.stockNumber||"Stock")}</p></div>
      ${statusPill("service_approved")}
    </div>
    <div class="record-grid">
      <div><span>Source</span><strong>${sourceLabel}</strong></div>
      <div><span>Acquisition Cost</span><strong>${money(sourceCost)}</strong></div>
      <div><span>Recon Estimate</span><strong>${money(vehicle.reconditioningEstimate||trade?.reconditioningEstimate||0)}</strong></div>
      <div><span>Current Location</span><strong>${safe(vehicle.location||"Retail Ready Holding")}</strong></div>
    </div>
    <form id="sales-floor-form" class="form-grid">
      ${formField("Retail Price","floorPrice",String(vehicle.price||sourceCost||0),"number","required min='0'")}
      ${formField("MSRP / List Price","floorMsrp",String(vehicle.msrp||vehicle.price||sourceCost||0),"number","required min='0'")}
      <div class="field"><label>Sales Floor Location</label><select class="plain-input" id="floorLocation"><option>Used Vehicle Showroom</option><option>Used Vehicle Lot</option><option>Featured Display</option><option>Front Line</option></select></div>
      <div class="field"><label>Retail Condition</label><select class="plain-input" id="floorCondition"><option>Retail Ready</option><option>Certified Used</option><option>As-Is Used</option></select></div>
    </form>
    <div class="manager-note"><span>SERVICE CLEARANCE</span><p>${safe(serviceNotes)}</p></div>
  `,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="confirm-sales-floor">${icon("store")} Put on Sales Floor</button>`);

  document.querySelector("#confirm-sales-floor")?.addEventListener("click",async()=>{
    const form=document.querySelector("#sales-floor-form");if(!form.reportValidity())return;
    const btn=document.querySelector("#confirm-sales-floor");btn.disabled=true;
    const price=Number(document.querySelector("#floorPrice").value||0);
    const msrp=Number(document.querySelector("#floorMsrp").value||0);
    try{
      await updateRecord("vehicles",vehicle.id,{
        status:"available",
        price,msrp,
        location:document.querySelector("#floorLocation").value,
        retailCondition:document.querySelector("#floorCondition").value,
        salesFloorAt:new Date().toISOString(),
        releasedBy:state.user.uid,
        releasedByName:state.profile?.displayName||state.user.email
      });
      if(trade) await updateRecord("tradeIns",trade.id,{status:"sales_floor",retailPrice:price,salesFloorVehicleId:vehicle.id});
      if(acquisition) await updateRecord("vehicleAcquisitions",acquisition.id,{retailStatus:"sales_floor",retailPrice:price,salesFloorVehicleId:vehicle.id});
      await writeAudit(state.user,"vehicle.pushed_to_sales_floor","vehicle",vehicle.id,{
        tradeInId:trade?.id||"",
        acquisitionId:acquisition?.id||"",
        source:trade?"trade_in":acquisition?"acquisition":"used_vehicle",
        price
      });
      closeModal();await refreshData();setFlash("Vehicle is now available on the Sterling sales floor.");
    }catch(e){
      btn.disabled=false;
      setFlash(e.message||"Unable to push vehicle to the sales floor.","error");
    }
  });
}


function partsPage() {
  const parts=state.data.parts;
  const requests=state.data.partRequests;
  const low=parts.filter(p=>Number(p.quantity||0)<=Number(p.reorderPoint||0)).length;
  const openReq=requests.filter(r=>["requested","backordered"].includes((r.status||"requested").toLowerCase()));
  const stockValue=parts.reduce((s,p)=>s+(Number(p.cost||0)*Number(p.quantity||0)),0);

  return `
    ${pageHeader("FIXED OPERATIONS", "DRIVE Parts", "Stock control, bin locations, technician requests, fulfillment, and backorders.",
      can("parts.manage") ? `<button class="btn primary" data-action="new-part">${icon("package-plus")} Add Part</button>` : "")}
    <div class="metric-grid">
      ${metric("Part Numbers",parts.length,"package-search","Active inventory records")}
      ${metric("Low Stock",low,"triangle-alert",low?"Reorder attention needed":"Stock levels healthy")}
      ${metric("Open Requests",openReq.length,"clipboard-clock","From Service technicians")}
      ${metric("Inventory Cost",money(stockValue),"boxes","Current on-hand cost")}
    </div>
    <div class="parts-layout">
      <div class="panel no-pad parts-inventory-panel">
        <div class="panel-head padded-head"><div><span class="eyebrow">INVENTORY</span><h2>Parts Catalog</h2></div></div>
        ${parts.length ? `<div class="table-wrap"><table class="data-table">
          <thead><tr><th>Part</th><th>Number</th><th>Bin</th><th>On Hand</th><th>Reorder</th><th>Retail</th><th></th></tr></thead>
          <tbody>${parts.map(p=>`<tr class="${Number(p.quantity||0)<=Number(p.reorderPoint||0)?"low-stock-row":""}">
            <td><strong>${safe(p.name||"Unnamed Part")}</strong><small class="block">${safe(p.manufacturer||"Sterling Parts")}</small></td>
            <td>${safe(p.partNumber||"—")}</td><td>${safe(p.bin||"—")}</td>
            <td><strong>${Number(p.quantity||0)}</strong></td><td>${Number(p.reorderPoint||0)}</td><td>${money(p.retailPrice)}</td>
            <td>${can("parts.manage")?`<button class="icon-btn" data-part="${p.id}">${icon("settings-2")}</button>`:""}</td>
          </tr>`).join("")}</tbody>
        </table></div>` : emptyState("package-open","No parts in inventory","Add part numbers, quantities, pricing, and bin locations.",can("parts.manage")?`<button class="btn primary" data-action="new-part">Add First Part</button>`:"")}
      </div>

      <div class="panel parts-requests-panel">
        <div class="panel-head"><div><span class="eyebrow">SERVICE REQUESTS</span><h2>Parts Counter</h2></div><span class="live-badge"><span></span>LIVE</span></div>
        <div class="parts-request-list">
          ${requests.length ? requests.slice(0,12).map(r=>`<article class="part-request-card">
            <div class="part-request-top"><span class="queue-ticket">${safe(r.roNumber||"RO")}</span>${statusPill(r.status||"requested")}</div>
            <h3>${safe(r.partName||"Part Request")}</h3>
            <p>Qty ${Number(r.quantity||1)} • ${safe(r.vehicleName||"Vehicle")}</p>
            <small>Requested by ${safe(r.requestedByName||"Service")}</small>
            ${can("parts.manage") && ["requested","backordered"].includes((r.status||"requested").toLowerCase()) ? `<button class="btn secondary small" data-fulfill-part-request="${r.id}">${icon("package-check")} Fulfill</button>` : ""}
          </article>`).join("") : '<div class="column-empty">No technician requests</div>'}
        </div>
      </div>
    </div>
  `;
}


function canManageAcquisitions() {
  return can("acquisitions.manage") || can("sales.manage") || can("inventory.manage") || can("admin.full");
}

function acquisitionsPage() {
  const items=state.data.vehicleAcquisitions;
  const staff=!!state.profile?.isStaff;
  const canManage=canManageAcquisitions();
  const submitted=items.filter(x=>(x.status||"submitted")==="submitted").length;
  const reviewing=items.filter(x=>(x.status||"")==="under_review" || (x.status||"")==="review_requested").length;
  const offers=items.filter(x=>(x.status||"")==="offer_made").length;
  const accepted=items.filter(x=>(x.status||"")==="accepted").length;

  return `
    ${pageHeader(staff?"VEHICLE ACQUISITIONS":"SELL YOUR CAR","Sell Your Car to Sterling",
      staff ? "Review seller submissions, appraise vehicles, issue purchase offers, and receive accepted vehicles." : "Submit your vehicle, follow Sterling's review, and respond to your purchase offer from one place.",
      `<button class="btn primary" data-action="new-acquisition">${icon("car-front")} ${staff?"New Submission":"Sell My Car"}</button>`)}
    ${staff ? `<div class="metric-grid">
      ${metric("New Submissions",submitted,"inbox","Waiting for staff review")}
      ${metric("In Review",reviewing,"clipboard-search","Appraisal work in progress")}
      ${metric("Offers Out",offers,"badge-dollar-sign","Waiting on seller response")}
      ${metric("Accepted",accepted,"handshake","Ready to receive")}
    </div>` : `<div class="sell-hero">
      <div class="sell-hero-icon">${icon("car-front")}</div>
      <div><span class="eyebrow">STERLING VEHICLE BUYING</span><h2>Sell directly to Sterling Motors.</h2><p>Submit your vehicle, follow the review, and accept or decline Sterling's RP offer here. You never need to enter real banking or title information.</p></div>
      <button class="btn primary" data-action="new-acquisition">${icon("plus")} Submit Vehicle</button>
    </div>`}

    ${staff && !canManage ? `<div class="acquisition-access-note">${icon("lock-keyhole")}<div><strong>View-only acquisition access</strong><span>Your account can see submissions, but needs Vehicle Acquisitions permission to review vehicles or send offers.</span></div></div>` : ""}

    ${items.length ? (staff ? `
      <div class="panel no-pad">
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Vehicle</th><th>Seller</th><th>Requested</th><th>Offer</th><th>Owner</th><th>Status</th><th></th></tr></thead>
          <tbody>${items.map(a=>`<tr>
            <td><strong>${safe(a.year||"")} ${safe(a.make||"")} ${safe(a.model||"")}</strong><small class="block">${Number(a.mileage||0).toLocaleString()} mi • ${safe(a.vin||"VIN pending")}</small></td>
            <td>${safe(a.sellerName||a.sellerEmail||"Customer")}<small class="block">${safe(a.sellerEmail||"")}</small></td>
            <td>${a.requestedPrice?money(a.requestedPrice):"Open"}</td>
            <td><strong>${a.offerAmount?money(a.offerAmount):"—"}</strong><small class="block">${a.offeredByName?safe(a.offeredByName):"No offer sent"}</small></td>
            <td>${a.appraisedByName?safe(a.appraisedByName):a.reviewStartedByName?safe(a.reviewStartedByName):"Unassigned"}</td>
            <td>${statusPill(a.status||"submitted")}</td>
            <td><button class="btn ${["submitted","under_review","review_requested"].includes(a.status||"submitted") && canManage ? "primary" : "secondary"} small" data-acquisition="${a.id}">${icon("clipboard-search")} ${["submitted","under_review","review_requested"].includes(a.status||"submitted") && canManage ? "Work" : "Open"}</button></td>
          </tr>`).join("")}</tbody>
        </table></div>
      </div>
    ` : `
      <div class="customer-offer-grid">
        ${items.map(a=>`<article class="customer-offer-card ${a.status==="offer_made"?"offer-ready":""}">
          <div class="customer-offer-top">
            <span class="record-list-icon">${icon("car-front")}</span>
            <div><span class="eyebrow">${a.status==="offer_made"?"STERLING OFFER READY":"VEHICLE SUBMISSION"}</span><h3>${safe(a.year||"")} ${safe(a.make||"")} ${safe(a.model||"")}</h3><p>${Number(a.mileage||0).toLocaleString()} mi • Submitted ${fmtDate(a.createdAt)}</p></div>
            ${statusPill(a.status||"submitted")}
          </div>
          <div class="customer-offer-values">
            <div><span>You Requested</span><strong>${a.requestedPrice?money(a.requestedPrice):"Open"}</strong></div>
            <div><span>Sterling Offer</span><strong>${a.offerAmount?money(a.offerAmount):"Pending"}</strong></div>
          </div>
          ${a.status==="offer_made" ? `<div class="offer-ready-message">${icon("badge-dollar-sign")} Sterling has completed its review. Open the offer to accept, decline, or ask for another review.</div>` : ""}
          ${a.status==="accepted" ? `<div class="offer-success-message">${icon("circle-check-big")} You accepted Sterling's offer. The vehicle is ready for dealership intake.</div>` : ""}
          ${a.status==="review_requested" ? `<div class="offer-review-message">${icon("message-square-more")} You asked Sterling to review the offer again.</div>` : ""}
          <button class="btn ${a.status==="offer_made"?"primary":"secondary"}" data-acquisition="${a.id}">${icon(a.status==="offer_made"?"badge-dollar-sign":"clipboard-search")} ${a.status==="offer_made"?"View My Offer":"View Submission"}</button>
        </article>`).join("")}
      </div>
    `) : emptyState("car-front",staff?"No acquisition submissions":"No vehicles submitted yet",staff?"Customer vehicle-sale submissions will appear here.":"Submit a vehicle and Sterling's acquisition team can review it.",`<button class="btn primary" data-action="new-acquisition">${icon("plus")} Submit Vehicle</button>`)}

    <div class="rp-disclaimer">${icon("shield-check")} Sterling vehicle purchase values and offers are fictional roleplay data. Do not submit real title numbers, banking information, or sensitive identity data.</div>
  `;
}

function serviceAppointmentModal() {
  const customers=state.data.customers;
  modal("Schedule Service Appointment", `<form id="service-appointment-form" class="form-grid">
    <div class="field full"><label>Customer</label><select class="plain-input" id="svcCustomer" required><option value="">Select customer</option>${customers.map(c=>`<option value="${c.id}" data-name="${safe(c.name||"Customer")}">${safe(c.name||c.email||c.id)}</option>`).join("")}</select></div>
    ${formField("Vehicle","svcVehicle","2026 Ford Mustang GT","text","required")}
    <div class="field"><label>Service Type</label><select class="plain-input" id="svcType"><option>Oil Change</option><option>Maintenance</option><option>Diagnosis</option><option>Brake Service</option><option>Tire Service</option><option>Inspection</option><option>Recall</option><option>General Repair</option></select></div>
    ${formField("Date","svcDate","","date","required")}
    ${formField("Time","svcTime","","time","required")}
    <div class="field full"><label>Customer Concern / Notes</label><textarea class="plain-input textarea" id="svcNotes" placeholder="What is the customer bringing the vehicle in for?"></textarea></div>
  </form>`,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-service-appointment">${icon("calendar-check")} Schedule</button>`);
  document.querySelector("#save-service-appointment")?.addEventListener("click",async()=>{
    const form=document.querySelector("#service-appointment-form");if(!form.reportValidity())return;
    const cs=document.querySelector("#svcCustomer"),data={
      customerId:cs.value,customerName:cs.selectedOptions[0].dataset.name,
      vehicleName:document.querySelector("#svcVehicle").value.trim(),
      serviceType:document.querySelector("#svcType").value,date:document.querySelector("#svcDate").value,time:document.querySelector("#svcTime").value,
      notes:document.querySelector("#svcNotes").value.trim(),status:"scheduled"
    };
    try{const res=await createServiceAppointment(data,state.user);await writeAudit(state.user,"service.appointment_created","serviceAppointment",res.id,data);closeModal();await refreshData();setFlash("Service appointment scheduled.");}
    catch(e){setFlash(e.message||"Unable to schedule appointment.","error");}
  });
}

function repairOrderModal(prefill={}) {
  const customers=state.data.customers;
  const techs=state.data.users.filter(u=>u.isStaff && u.status==="active" && ["Service","Management","Executive"].includes(u.department));
  const roNumber=`RO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  modal("Create Repair Order", `<form id="ro-form" class="form-grid">
    ${formField("RO Number","roNumber",roNumber,"text","required")}
    <div class="field"><label>Customer</label><select class="plain-input" id="roCustomer" required><option value="">Select customer</option>${customers.map(x=>`<option value="${x.id}" data-name="${safe(x.name||"Customer")}" ${prefill.customerId===x.id?"selected":""}>${safe(x.name||x.email||x.id)}</option>`).join("")}</select></div>
    ${formField("Vehicle","roVehicle",prefill.vehicleName||"2026 Ford Mustang GT","text","required")}
    ${formField("VIN","roVin",prefill.vin||"VIN")}
    ${formField("Mileage","roMileage",String(prefill.mileage||0),"number","required min='0'")}
    <div class="field"><label>Assign Technician</label><select class="plain-input" id="roTech"><option value="">Unassigned</option>${techs.map(t=>`<option value="${t.id}" data-name="${safe(t.displayName||t.email)}">${safe(t.displayName||t.email)} • ${safe(String(t.role||"").replaceAll("_"," "))}</option>`).join("")}</select></div>
    <div class="field full"><label>Customer Concern</label><textarea class="plain-input textarea" id="roComplaint" required placeholder="Customer states...">${safe(prefill.complaint||prefill.notes||"")}</textarea></div>
  </form>`,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-ro">${icon("clipboard-plus")} Open Repair Order</button>`);
  const rn=document.querySelector("#roNumber");if(rn && !rn.value)rn.value=roNumber;
  document.querySelector("#save-ro")?.addEventListener("click",async()=>{
    const form=document.querySelector("#ro-form");if(!form.reportValidity())return;
    const cs=document.querySelector("#roCustomer"),ts=document.querySelector("#roTech");
    const data={
      roNumber:document.querySelector("#roNumber").value.trim()||roNumber,
      customerId:cs.value,customerName:cs.selectedOptions[0].dataset.name,
      vehicleName:document.querySelector("#roVehicle").value.trim(),vin:document.querySelector("#roVin").value.trim(),mileage:Number(document.querySelector("#roMileage").value||0),
      complaint:document.querySelector("#roComplaint").value.trim(),
      technicianUid:ts.value||"",technicianName:ts.value?ts.selectedOptions[0].dataset.name:"",advisorUid:state.user.uid,advisorName:state.profile?.displayName||state.user.email,
      status:"checked_in",laborTotal:0,partsTotal:0,estimateTotal:0,diagnosis:"",recommendedWork:""
    };
    try{const res=await createRepairOrder(data,state.user);if(prefill.appointmentId)await updateRecord("serviceAppointments",prefill.appointmentId,{status:"checked_in",repairOrderId:res.id});await writeAudit(state.user,"service.ro_created","repairOrder",res.id,{roNumber:data.roNumber});closeModal();await refreshData();setFlash("Repair Order opened.");}
    catch(e){setFlash(e.message||"Unable to create Repair Order.","error");}
  });
}

function repairOrderDetailModal(ro) {
  if(!ro)return;
  const requests=state.data.partRequests.filter(x=>x.repairOrderId===ro.id);
  modal(`Repair Order ${safe(ro.roNumber||"")}`,`
    <div class="ro-detail-hero"><div class="record-icon">${icon("wrench")}</div><div><span class="eyebrow">SERVICE RECORD</span><h3>${safe(ro.vehicleName||"Vehicle")}</h3><p>${safe(ro.customerName||"Customer")} • ${Number(ro.mileage||0).toLocaleString()} mi</p></div>${statusPill(ro.status||"checked_in")}</div>
    <div class="service-concern"><span>CUSTOMER CONCERN</span><p>${safe(ro.complaint||"No concern entered.")}</p></div>
    <div class="record-grid">
      <div><span>Technician</span><strong>${safe(ro.technicianName||"Unassigned")}</strong></div>
      <div><span>Labor</span><strong>${money(ro.laborTotal)}</strong></div>
      <div><span>Parts</span><strong>${money(ro.partsTotal)}</strong></div>
      <div><span>Estimate</span><strong>${money(ro.estimateTotal)}</strong></div>
      <div><span>VIN</span><strong>${safe(ro.vin||"—")}</strong></div>
      <div><span>Opened</span><strong>${fmtDate(ro.createdAt)}</strong></div>
    </div>
    ${ro.diagnosis?`<div class="manager-note"><span>DIAGNOSIS</span><p>${safe(ro.diagnosis)}</p></div>`:""}
    ${ro.recommendedWork?`<div class="manager-note"><span>RECOMMENDED WORK</span><p>${safe(ro.recommendedWork)}</p></div>`:""}
    ${requests.length?`<div class="ro-parts"><span class="eyebrow">PART REQUESTS</span>${requests.map(r=>`<div><strong>${safe(r.partName||"Part")}</strong><small>Qty ${Number(r.quantity||1)}</small>${statusPill(r.status||"requested")}</div>`).join("")}</div>`:""}
    <div class="workflow-actions">
      ${can("service.manage") && ["checked_in","diagnosis"].includes(ro.status||"checked_in")?`<button class="btn primary" id="diagnose-ro">${icon("stethoscope")} Enter Diagnosis</button>`:""}
      ${can("service.manage") && ro.status==="awaiting_customer_authorization"?`<button class="btn success-btn" id="authorize-ro">${icon("check")} Authorize Repairs</button>`:""}
      ${can("service.manage") && ["awaiting_customer_authorization","parts_required","repair_in_progress"].includes(ro.status||"")?`<button class="btn secondary" id="request-ro-part">${icon("package-plus")} Request Part</button>`:""}
      ${can("service.manage") && ["repair_in_progress","parts_required"].includes(ro.status||"")?`<button class="btn primary" id="quality-ro">${icon("clipboard-check")} Send to Quality</button>`:""}
      ${can("service.manage") && ro.status==="quality_inspection"?`<button class="btn primary" id="ready-ro">${icon("circle-check-big")} Ready for Pickup</button>`:""}
      ${can("service.manage") && ro.status==="ready_for_pickup"?`<button class="btn primary" id="close-ro">${icon("archive")} Close Repair Order</button>`:""}
    </div>
  `);
  document.querySelector("#diagnose-ro")?.addEventListener("click",()=>diagnosisModal(ro));
  document.querySelector("#request-ro-part")?.addEventListener("click",()=>partRequestModal(ro));
  const transition=async(id,status,message)=>{
    try{await updateRecord("repairOrders",ro.id,{status});await writeAudit(state.user,`service.ro_${status}`,"repairOrder",ro.id,{roNumber:ro.roNumber});closeModal();await refreshData();setFlash(message);}
    catch(e){setFlash(e.message||"Unable to update Repair Order.","error");}
  };
  document.querySelector("#authorize-ro")?.addEventListener("click",()=>transition("authorize","repair_in_progress","Repairs authorized. Work may begin."));
  document.querySelector("#quality-ro")?.addEventListener("click",()=>transition("quality","quality_inspection","Repair Order sent to quality inspection."));
  document.querySelector("#ready-ro")?.addEventListener("click",()=>transition("ready","ready_for_pickup","Vehicle marked ready for pickup."));
  document.querySelector("#close-ro")?.addEventListener("click",()=>transition("close","closed","Repair Order closed and retained in service history."));
}

function diagnosisModal(ro) {
  modal("Diagnosis & Estimate",`<form id="diagnosis-form" class="form-grid">
    <div class="field full"><label>Diagnosis</label><textarea class="plain-input textarea" id="roDiagnosis" required placeholder="Technician findings...">${safe(ro.diagnosis||"")}</textarea></div>
    <div class="field full"><label>Recommended Work</label><textarea class="plain-input textarea" id="roRecommended" required placeholder="Repairs recommended to the customer...">${safe(ro.recommendedWork||"")}</textarea></div>
    ${formField("Labor Estimate","roLabor",String(ro.laborTotal||0),"number","required min='0'")}
  </form>`,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-diagnosis">${icon("send")} Send for Authorization</button>`);
  document.querySelector("#save-diagnosis")?.addEventListener("click",async()=>{
    const form=document.querySelector("#diagnosis-form");if(!form.reportValidity())return;
    const labor=Number(document.querySelector("#roLabor").value||0),parts=Number(ro.partsTotal||0);
    try{await updateRecord("repairOrders",ro.id,{diagnosis:document.querySelector("#roDiagnosis").value.trim(),recommendedWork:document.querySelector("#roRecommended").value.trim(),laborTotal:labor,estimateTotal:labor+parts,status:"awaiting_customer_authorization"});await writeAudit(state.user,"service.diagnosis_completed","repairOrder",ro.id,{estimateTotal:labor+parts});closeModal();await refreshData();setFlash("Diagnosis saved. Repair Order is awaiting customer authorization.");}
    catch(e){setFlash(e.message||"Unable to save diagnosis.","error");}
  });
}

function partRequestModal(ro) {
  const parts=state.data.parts;
  if(!parts.length){setFlash("No parts exist in DRIVE Parts yet.","error");return;}
  modal("Request Part",`<form id="part-request-form" class="form-grid">
    <div class="field full"><label>Repair Order</label><input class="plain-input" value="${safe(ro.roNumber||"")}" disabled></div>
    <div class="field full"><label>Part</label><select class="plain-input" id="requestPart" required><option value="">Select part</option>${parts.map(p=>`<option value="${p.id}" data-name="${safe(p.name||"Part")}" data-price="${Number(p.retailPrice||0)}">${safe(p.partNumber||"")} • ${safe(p.name||"Part")} • ${Number(p.quantity||0)} on hand</option>`).join("")}</select></div>
    ${formField("Quantity","requestQty","1","number","required min='1'")}
    <div class="field full"><label>Technician Note</label><textarea class="plain-input textarea" id="requestNote" placeholder="Why is this part needed?"></textarea></div>
  </form>`,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-part-request">${icon("package-plus")} Send to Parts</button>`);
  document.querySelector("#save-part-request")?.addEventListener("click",async()=>{
    const form=document.querySelector("#part-request-form");if(!form.reportValidity())return;
    const ps=document.querySelector("#requestPart"),data={repairOrderId:ro.id,roNumber:ro.roNumber||"",vehicleName:ro.vehicleName||"",partId:ps.value,partName:ps.selectedOptions[0].dataset.name,unitPrice:Number(ps.selectedOptions[0].dataset.price||0),quantity:Number(document.querySelector("#requestQty").value||1),note:document.querySelector("#requestNote").value.trim(),status:"requested"};
    try{const res=await createPartRequest(data,state.user);await updateRecord("repairOrders",ro.id,{status:"parts_required"});await writeAudit(state.user,"parts.requested","partRequest",res.id,{repairOrderId:ro.id,partId:data.partId,quantity:data.quantity});closeModal();await refreshData();setFlash("Part request sent to Parts.");}
    catch(e){setFlash(e.message||"Unable to request part.","error");}
  });
}

function newPartModal() {
  modal("Add Part to Inventory",`<form id="new-part-form" class="form-grid">
    ${formField("Part Number","partNumber","SMG-BRK-001","text","required")}
    ${formField("Part Name","partName","Front Brake Pad Set","text","required")}
    ${formField("Manufacturer","partManufacturer","OEM")}
    ${formField("Bin Location","partBin","B14-3","text","required")}
    ${formField("Quantity","partQty","10","number","required min='0'")}
    ${formField("Reorder Point","partReorder","3","number","required min='0'")}
    ${formField("Unit Cost","partCost","65","number","required min='0'")}
    ${formField("Retail Price","partRetail","129","number","required min='0'")}
    <div class="field full"><label>Compatibility / Notes</label><textarea class="plain-input textarea" id="partNotes" placeholder="Compatible models, years, internal notes..."></textarea></div>
  </form>`,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-new-part">${icon("package-plus")} Add Part</button>`);
  document.querySelector("#save-new-part")?.addEventListener("click",async()=>{
    const form=document.querySelector("#new-part-form");if(!form.reportValidity())return;
    const data={partNumber:document.querySelector("#partNumber").value.trim(),name:document.querySelector("#partName").value.trim(),manufacturer:document.querySelector("#partManufacturer").value.trim(),bin:document.querySelector("#partBin").value.trim(),quantity:Number(document.querySelector("#partQty").value||0),reorderPoint:Number(document.querySelector("#partReorder").value||0),cost:Number(document.querySelector("#partCost").value||0),retailPrice:Number(document.querySelector("#partRetail").value||0),notes:document.querySelector("#partNotes").value.trim()};
    try{const res=await createPart(data,state.user);await writeAudit(state.user,"parts.part_created","part",res.id,{partNumber:data.partNumber});closeModal();await refreshData();setFlash("Part added to inventory.");}
    catch(e){setFlash(e.message||"Unable to add part.","error");}
  });
}

function partDetailModal(part) {
  if(!part)return;
  modal(safe(part.name||"Part"),`
    <div class="record-hero"><div class="record-icon">${icon("package")}</div><div><span class="eyebrow">PARTS INVENTORY</span><h3>${safe(part.name||"Part")}</h3><p>${safe(part.partNumber||"")} • Bin ${safe(part.bin||"—")}</p></div>${Number(part.quantity||0)<=Number(part.reorderPoint||0)?statusPill("low_stock"):statusPill("in_stock")}</div>
    <div class="record-grid"><div><span>On Hand</span><strong>${Number(part.quantity||0)}</strong></div><div><span>Reorder Point</span><strong>${Number(part.reorderPoint||0)}</strong></div><div><span>Retail</span><strong>${money(part.retailPrice)}</strong></div><div><span>Cost</span><strong>${money(part.cost)}</strong></div><div><span>Manufacturer</span><strong>${safe(part.manufacturer||"—")}</strong></div><div><span>Bin</span><strong>${safe(part.bin||"—")}</strong></div></div>
    <div class="field"><label>Receive / Adjust On-Hand Quantity</label><input class="plain-input" id="adjustPartQty" type="number" min="0" value="${Number(part.quantity||0)}"></div>
  `,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-part-adjust">${icon("save")} Update Stock</button>`);
  document.querySelector("#save-part-adjust")?.addEventListener("click",async()=>{
    const qty=Number(document.querySelector("#adjustPartQty").value||0);
    try{await updateRecord("parts",part.id,{quantity:qty});await writeAudit(state.user,"parts.stock_adjusted","part",part.id,{oldQuantity:Number(part.quantity||0),newQuantity:qty});closeModal();await refreshData();setFlash("Parts inventory updated.");}
    catch(e){setFlash(e.message||"Unable to update stock.","error");}
  });
}

async function fulfillPartRequest(request) {
  const part=state.data.parts.find(p=>p.id===request.partId);
  if(!part){setFlash("The requested part no longer exists in inventory.","error");return;}
  const qty=Number(request.quantity||1),onHand=Number(part.quantity||0);
  try{
    if(onHand<qty){await updateRecord("partRequests",request.id,{status:"backordered"});await writeAudit(state.user,"parts.backordered","partRequest",request.id,{onHand,requested:qty});await refreshData();setFlash("Not enough stock. Request marked backordered.","error");return;}
    await updateRecord("parts",part.id,{quantity:onHand-qty});
    await updateRecord("partRequests",request.id,{status:"fulfilled",fulfilledBy:state.user.uid,fulfilledByName:state.profile?.displayName||state.user.email});
    const ro=state.data.repairOrders.find(r=>r.id===request.repairOrderId);
    if(ro){const added=Number(request.unitPrice||part.retailPrice||0)*qty,newParts=Number(ro.partsTotal||0)+added;await updateRecord("repairOrders",ro.id,{partsTotal:newParts,estimateTotal:Number(ro.laborTotal||0)+newParts,status:"repair_in_progress"});}
    await writeAudit(state.user,"parts.fulfilled","partRequest",request.id,{partId:part.id,quantity:qty});
    await refreshData();setFlash("Part request fulfilled and Repair Order updated.");
  }catch(e){setFlash(e.message||"Unable to fulfill request.","error");}
}

function acquisitionSubmissionModal() {
  modal("Sell Your Car to Sterling",`<form id="acquisition-form" class="form-grid">
    ${formField("Seller Name","acqSellerName",state.profile?.displayName||state.user?.displayName||"","text","required")}
    ${formField("Contact Email","acqEmail",state.user?.email||"","email","required")}
    ${formField("Year","acqYear","2022","number","required min='1900'")}
    ${formField("Make","acqMake","Toyota","text","required")}
    ${formField("Model","acqModel","Camry","text","required")}
    ${formField("Trim","acqTrim","XSE")}
    ${formField("VIN","acqVin","17-character VIN","text","required maxlength='17'")}
    ${formField("Mileage","acqMileage","45000","number","required min='0'")}
    ${formField("Color","acqColor","Black")}
    <div class="field"><label>Overall Condition</label><select class="plain-input" id="acqCondition"><option>Excellent</option><option>Good</option><option>Fair</option><option>Needs Work</option></select></div>
    ${formField("Price You Have in Mind","acqRequested","0","number","min='0'")}
    <div class="field full"><label>Vehicle Notes</label><textarea class="plain-input textarea" id="acqNotes" placeholder="Damage, modifications, warning lights, notable features..."></textarea></div>
    <div class="field full check-field"><label><input type="checkbox" id="acqConfirm" required> I understand this is fictional roleplay data and I am not submitting real title, banking, or sensitive identity information.</label></div>
  </form>`,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="submit-acquisition">${icon("send")} Submit Vehicle</button>`);
  document.querySelector("#submit-acquisition")?.addEventListener("click",async()=>{
    const form=document.querySelector("#acquisition-form");if(!form.reportValidity())return;
    const data={sellerUid:state.user.uid,sellerName:document.querySelector("#acqSellerName").value.trim(),sellerEmail:document.querySelector("#acqEmail").value.trim(),year:Number(document.querySelector("#acqYear").value),make:document.querySelector("#acqMake").value.trim(),model:document.querySelector("#acqModel").value.trim(),trim:document.querySelector("#acqTrim").value.trim(),vin:document.querySelector("#acqVin").value.trim(),mileage:Number(document.querySelector("#acqMileage").value||0),color:document.querySelector("#acqColor").value.trim(),condition:document.querySelector("#acqCondition").value,requestedPrice:Number(document.querySelector("#acqRequested").value||0),notes:document.querySelector("#acqNotes").value.trim(),offerAmount:0,status:"submitted"};
    try{const res=await createVehicleAcquisition(data,state.user);if(state.profile?.isStaff)await writeAudit(state.user,"acquisition.submitted","vehicleAcquisition",res.id,{vehicle:`${data.year} ${data.make} ${data.model}`});closeModal();await refreshData();setFlash("Vehicle submitted to Sterling Acquisitions.");}
    catch(e){setFlash(e.message||"Unable to submit vehicle.","error");}
  });
}

function acquisitionDetailModal(a) {
  if(!a)return;
  const staff=!!state.profile?.isStaff;
  const canManage=canManageAcquisitions();

  if(!staff) {
    customerAcquisitionOfferModal(a);
    return;
  }

  const status=a.status||"submitted";
  const offerOpen=status==="offer_made";

  modal("Vehicle Acquisition",`
    <div class="record-hero">
      <div class="record-icon">${icon("car-front")}</div>
      <div><span class="eyebrow">STERLING ACQUISITIONS</span><h3>${safe(a.year||"")} ${safe(a.make||"")} ${safe(a.model||"")}</h3><p>${safe(a.sellerName||"Customer")} • ${Number(a.mileage||0).toLocaleString()} mi</p></div>
      ${statusPill(status)}
    </div>

    <div class="acquisition-progress">
      ${[
        ["submitted","Submitted",["submitted","under_review","offer_made","accepted","declined","review_requested","received"].includes(status)],
        ["under_review","Review",["under_review","offer_made","accepted","declined","review_requested","received"].includes(status)],
        ["offer_made","Offer Sent",["offer_made","accepted","declined","review_requested","received"].includes(status)],
        ["accepted","Accepted",["accepted","received"].includes(status)],
        ["received","Received",status==="received"]
      ].map(([id,label,done])=>`<div class="${done?"complete":""} ${status===id?"current":""}"><span>${done?icon("check"):icon("circle")}</span><small>${label}</small></div>`).join("")}
    </div>

    <div class="record-grid">
      <div><span>VIN</span><strong>${safe(a.vin||"—")}</strong></div>
      <div><span>Seller Condition</span><strong>${safe(a.condition||"—")}</strong></div>
      <div><span>Requested Price</span><strong>${a.requestedPrice?money(a.requestedPrice):"Open"}</strong></div>
      <div><span>Sterling Offer</span><strong>${a.offerAmount?money(a.offerAmount):"Not offered"}</strong></div>
      <div><span>Appraised Condition</span><strong>${safe(a.appraisedCondition||"Not appraised")}</strong></div>
      <div><span>Assigned / Offered By</span><strong>${safe(a.offeredByName||a.reviewStartedByName||"Unassigned")}</strong></div>
    </div>

    ${a.notes?`<div class="manager-note"><span>SELLER NOTES</span><p>${safe(a.notes)}</p></div>`:""}
    ${a.appraisalNotes?`<div class="manager-note"><span>APPRAISAL NOTES</span><p>${safe(a.appraisalNotes)}</p></div>`:""}
    ${a.offerNote?`<div class="manager-note"><span>OFFER NOTE TO SELLER</span><p>${safe(a.offerNote)}</p></div>`:""}
    ${a.customerResponseNote?`<div class="customer-response-note"><span>CUSTOMER RESPONSE</span><p>${safe(a.customerResponseNote)}</p></div>`:""}
    ${a.acceptanceMethod==="staff_assisted"?`<div class="staff-assisted-record">${icon("user-check")}<div><strong>Staff-assisted acceptance</strong><span>${safe(a.acceptedByStaffName||"Sterling Staff")} accepted the offer for the seller${a.customerResponseNote?` • ${safe(a.customerResponseNote)}`:""}.</span></div></div>`:""}

    ${!canManage ? `<div class="acquisition-access-note">${icon("lock-keyhole")}<div><strong>View-only</strong><span>Your account needs Vehicle Acquisitions permission to review or offer on this vehicle.</span></div></div>` : ""}

    <div class="workflow-actions">
      ${canManage && status==="submitted" ? `<button class="btn secondary" id="start-acquisition-review">${icon("clipboard-search")} Start Review</button><button class="btn primary" id="make-acquisition-offer">${icon("badge-dollar-sign")} Review & Make Offer</button>` : ""}
      ${canManage && ["under_review","review_requested"].includes(status) ? `<button class="btn primary" id="make-acquisition-offer">${icon("badge-dollar-sign")} ${status==="review_requested"?"Send Revised Offer":"Approve & Send Offer"}</button>` : ""}
      ${canManage && offerOpen ? `<button class="btn success-btn" id="staff-accept-acquisition">${icon("handshake")} Accept for Seller</button><button class="btn secondary" id="edit-acquisition-offer">${icon("pencil")} Revise Offer</button><button class="btn danger-btn" id="withdraw-acquisition-offer">${icon("ban")} Withdraw Offer</button>` : ""}
      ${status==="accepted" && (can("inventory.manage")||can("acquisitions.manage")||can("admin.full")) ? `<button class="btn primary" id="receive-acquisition">${icon("warehouse")} Receive into Inventory</button>` : ""}
    </div>
  `);

  document.querySelector("#start-acquisition-review")?.addEventListener("click",async()=>{
    const btn=document.querySelector("#start-acquisition-review");btn.disabled=true;
    try{
      await startAcquisitionReview(a.id,state.user);
      await writeAudit(state.user,"acquisition.review_started","vehicleAcquisition",a.id,{});
      closeModal();await refreshData();setFlash("Acquisition review started.");
    }catch(e){btn.disabled=false;setFlash(e.message||"Unable to start review.","error");}
  });
  document.querySelector("#make-acquisition-offer")?.addEventListener("click",()=>acquisitionOfferModal(a));
  document.querySelector("#edit-acquisition-offer")?.addEventListener("click",()=>acquisitionOfferModal(a));
  document.querySelector("#staff-accept-acquisition")?.addEventListener("click",()=>staffAcceptAcquisitionModal(a));
  document.querySelector("#withdraw-acquisition-offer")?.addEventListener("click",async()=>{
    const btn=document.querySelector("#withdraw-acquisition-offer");btn.disabled=true;
    try{
      await updateRecord("vehicleAcquisitions",a.id,{status:"under_review",offerAmount:0,offerNote:"",customerResponse:"",customerResponseNote:""});
      await writeAudit(state.user,"acquisition.offer_withdrawn","vehicleAcquisition",a.id,{previousOffer:a.offerAmount||0});
      closeModal();await refreshData();setFlash("Offer withdrawn and returned to review.");
    }catch(e){btn.disabled=false;setFlash(e.message||"Unable to withdraw offer.","error");}
  });
  document.querySelector("#receive-acquisition")?.addEventListener("click",()=>receiveAcquisitionModal(a));
}

function staffAcceptAcquisitionModal(a) {
  modal("Accept Offer for Seller", `
    <div class="staff-assisted-accept">
      <span class="record-icon">${icon("handshake")}</span>
      <div>
        <span class="eyebrow">SOLO / STAFF-ASSISTED ACCEPTANCE</span>
        <h3>${safe(a.year||"")} ${safe(a.make||"")} ${safe(a.model||"")}</h3>
        <p>You are accepting Sterling\'s ${money(a.offerAmount)} offer on behalf of the seller.</p>
      </div>
    </div>
    <div class="staff-assisted-warning">
      ${icon("shield-check")}
      <div>
        <strong>This will be recorded as staff-assisted acceptance.</strong>
        <span>DRIVE records who accepted the offer for the seller, which is useful when one person is running both sides of the RP.</span>
      </div>
    </div>
    <div class="record-grid">
      <div><span>Seller</span><strong>${safe(a.sellerName||"Customer")}</strong></div>
      <div><span>Sterling Offer</span><strong>${money(a.offerAmount)}</strong></div>
      <div><span>Appraised Condition</span><strong>${safe(a.appraisedCondition||"Reviewed")}</strong></div>
      <div><span>Offer Revision</span><strong>${Number(a.offerRevision||1)}</strong></div>
    </div>
    <div class="field full">
      <label>Acceptance Note <span class="optional-label">Optional</span></label>
      <textarea class="plain-input textarea" id="staff-accept-note" placeholder="Example: Solo RP acceptance / seller authorized Sterling staff to proceed."></textarea>
    </div>
  `, `
    <button class="btn secondary" data-close-modal>Cancel</button>
    <button class="btn success-btn" id="confirm-staff-accept">${icon("handshake")} Accept ${money(a.offerAmount)} for Seller</button>
  `);

  document.querySelector("#confirm-staff-accept")?.addEventListener("click", async () => {
    const btn=document.querySelector("#confirm-staff-accept");
    btn.disabled=true;
    const note=document.querySelector("#staff-accept-note").value.trim();
    try {
      await staffAcceptAcquisitionOffer(a.id,state.user,note);
      await writeAudit(state.user,"acquisition.staff_assisted_acceptance","vehicleAcquisition",a.id,{
        offerAmount:Number(a.offerAmount||0),
        sellerName:a.sellerName||"",
        acceptanceMethod:"staff_assisted"
      });
      closeModal();
      await refreshData();
      setFlash(`Offer accepted for ${a.sellerName||"seller"}. Vehicle is ready for Sterling intake.`);
    } catch(e) {
      btn.disabled=false;
      setFlash(e.message||"Unable to accept the offer for the seller.","error");
    }
  });
}

function customerAcquisitionOfferModal(a) {
  const status=a.status||"submitted";
  modal(status==="offer_made" ? "Your Sterling Purchase Offer" : "Your Vehicle Submission",`
    <div class="customer-offer-modal-hero ${status==="offer_made"?"offer-live":""}">
      <span class="record-icon">${icon(status==="offer_made"?"badge-dollar-sign":"car-front")}</span>
      <div><span class="eyebrow">${status==="offer_made"?"STERLING OFFER":"SELL YOUR CAR"}</span><h3>${safe(a.year||"")} ${safe(a.make||"")} ${safe(a.model||"")}</h3><p>${Number(a.mileage||0).toLocaleString()} mi • ${safe(a.vin||"VIN pending")}</p></div>
      ${statusPill(status)}
    </div>

    ${status==="offer_made" ? `
      <div class="customer-offer-amount"><span>Sterling will purchase this vehicle for</span><strong>${money(a.offerAmount)}</strong><small>Fictional RP purchase offer</small></div>
      <div class="offer-detail-grid">
        <div><span>Your Requested Price</span><strong>${a.requestedPrice?money(a.requestedPrice):"Open"}</strong></div>
        <div><span>Appraised Condition</span><strong>${safe(a.appraisedCondition||"Reviewed")}</strong></div>
        <div><span>Offer Prepared By</span><strong>${safe(a.offeredByName||"Sterling Acquisitions")}</strong></div>
        <div><span>Offer Date</span><strong>${fmtDate(a.offeredAt)}</strong></div>
      </div>
${a.offerNote?`<div class="offer-note"><span>MESSAGE FROM STERLING</span><p>${safe(a.offerNote)}</p></div>`:""}
      <div class="offer-decision-box">
        <span class="eyebrow">YOUR DECISION</span>
        <h4>What would you like to do with Sterling's offer?</h4>
        <p>Accepting moves the vehicle to dealership intake. Declining closes this offer. You can also ask the acquisition team to review the offer again.</p>
      </div>
    ` : status==="accepted" ? `
      <div class="customer-decision-state success">${icon("circle-check-big")}<div><strong>Offer accepted</strong><span>Sterling's acquisition team can now receive your vehicle into dealership inventory.</span></div></div>
    ` : status==="declined" ? `
      <div class="customer-decision-state declined">${icon("x-circle")}<div><strong>Offer declined</strong><span>This Sterling purchase offer has been closed.</span></div></div>
    ` : status==="review_requested" ? `
      <div class="customer-decision-state review">${icon("message-square-more")}<div><strong>Another review requested</strong><span>Sterling Acquisitions can revise the offer and send it back to you.</span></div></div>
      ${a.customerResponseNote?`<div class="manager-note"><span>YOUR NOTE</span><p>${safe(a.customerResponseNote)}</p></div>`:""}
    ` : `
      <div class="customer-decision-state review">${icon("clock-3")}<div><strong>${status==="under_review"?"Sterling is reviewing your vehicle":"Submission received"}</strong><span>${status==="under_review"?"Your vehicle is currently being appraised.":"The acquisition team has not issued an offer yet."}</span></div></div>
    `}

    <div class="record-grid">
      <div><span>Submitted Condition</span><strong>${safe(a.condition||"—")}</strong></div>
      <div><span>Color</span><strong>${safe(a.color||"—")}</strong></div>
      <div><span>Requested Price</span><strong>${a.requestedPrice?money(a.requestedPrice):"Open"}</strong></div>
      <div><span>Submitted</span><strong>${fmtDate(a.createdAt)}</strong></div>
    </div>
  `, status==="offer_made" ? `
    <button class="btn secondary" data-close-modal>Not Yet</button>
    <span class="modal-footer-spacer"></span>
    <button class="btn secondary" id="request-offer-review">${icon("message-square-more")} Ask for Review</button>
    <button class="btn danger-btn" id="decline-acquisition-offer">${icon("x")} Decline</button>
    <button class="btn success-btn" id="accept-acquisition-offer">${icon("check")} Accept ${money(a.offerAmount)}</button>
  ` : `<span class="modal-footer-spacer"></span><button class="btn secondary" data-close-modal>Close</button>`);

  document.querySelector("#accept-acquisition-offer")?.addEventListener("click",()=>customerOfferResponseModal(a,"accept"));
  document.querySelector("#decline-acquisition-offer")?.addEventListener("click",()=>customerOfferResponseModal(a,"decline"));
  document.querySelector("#request-offer-review")?.addEventListener("click",()=>customerOfferResponseModal(a,"review"));
}

function customerOfferResponseModal(a,response) {
  const config={
    accept:{title:"Accept Sterling Offer",icon:"handshake",button:"Accept Offer",tone:"success-btn",help:`You are accepting Sterling's ${money(a.offerAmount)} RP purchase offer.`},
    decline:{title:"Decline Sterling Offer",icon:"x-circle",button:"Decline Offer",tone:"danger-btn",help:"This closes the current purchase offer."},
    review:{title:"Ask Sterling to Review the Offer",icon:"message-square-more",button:"Request Review",tone:"primary",help:"Tell the acquisition team what you would like them to reconsider."}
  }[response];
  modal(config.title,`
    <div class="offer-response-confirm">
      <span class="record-icon">${icon(config.icon)}</span>
      <div><span class="eyebrow">SELL YOUR CAR</span><h3>${safe(a.year||"")} ${safe(a.make||"")} ${safe(a.model||"")}</h3><p>${config.help}</p></div>
    </div>
    <div class="field full"><label>${response==="review"?"What should Sterling reconsider?":"Response Note"} <span class="optional-label">${response==="review"?"Required":"Optional"}</span></label><textarea class="plain-input textarea" id="offer-response-note" ${response==="review"?"required":""} placeholder="${response==="review"?"Explain what you want reviewed...":"Optional note for Sterling Acquisitions..."}"></textarea></div>
  `,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn ${config.tone}" id="confirm-offer-response">${icon(config.icon)} ${config.button}</button>`);

  document.querySelector("#confirm-offer-response")?.addEventListener("click",async()=>{
    const note=document.querySelector("#offer-response-note").value.trim();
    if(response==="review" && !note){setFlash("Tell Sterling what you want reviewed.","error");return;}
    const btn=document.querySelector("#confirm-offer-response");btn.disabled=true;
    try{
      await respondToAcquisitionOffer(a.id,response,note);
      closeModal();await refreshData();
      setFlash(response==="accept"?"Sterling offer accepted.":response==="decline"?"Sterling offer declined.":"Review request sent to Sterling Acquisitions.");
    }catch(e){btn.disabled=false;setFlash(e.message||"Unable to send your response.","error");}
  });
}

function acquisitionOfferModal(a) {
  const revision=(Number(a.offerRevision||0)+1);
  modal(a.offerAmount ? "Revise Sterling Purchase Offer" : "Create Sterling Purchase Offer",`
    <div class="offer-builder-hero">
      <div><span class="eyebrow">ACQUISITION OFFER • REVISION ${revision}</span><h3>${safe(a.year||"")} ${safe(a.make||"")} ${safe(a.model||"")}</h3><p>${safe(a.sellerName||"Seller")} requested ${a.requestedPrice?money(a.requestedPrice):"an open offer"}.</p></div>
      <div><span>Current / Prior Offer</span><strong>${a.offerAmount?money(a.offerAmount):"None"}</strong></div>
    </div>
    <form id="acq-offer-form" class="form-grid">
      ${formField("Sterling Purchase Offer","acqOffer",String(a.offerAmount||a.requestedPrice||0),"number","required min='1'")}
      <div class="field"><label>Appraised Condition</label><select class="plain-input" id="acqAppraisedCondition">
        ${["Excellent","Good","Fair","Needs Reconditioning","Wholesale Only"].map(x=>`<option ${a.appraisedCondition===x?"selected":""}>${x}</option>`).join("")}
      </select></div>
      <div class="field full"><label>Internal Appraisal Notes</label><textarea class="plain-input textarea" id="acqAppraisalNotes" required placeholder="Inspection findings and valuation notes...">${safe(a.appraisalNotes||"")}</textarea></div>
      <div class="field full"><label>Message to Seller <span class="optional-label">Optional</span></label><textarea class="plain-input textarea" id="acqOfferNote" placeholder="Explain the offer or any conditions...">${safe(a.offerNote||"")}</textarea></div>
      ${a.customerResponseNote?`<div class="field full"><div class="customer-response-note"><span>CUSTOMER ASKED FOR REVIEW</span><p>${safe(a.customerResponseNote)}</p></div></div>`:""}
    </form>
  `,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="send-acquisition-offer">${icon("send")} ${a.offerAmount?"Send Revised Offer":"Approve & Send Offer"}</button>`);

  document.querySelector("#send-acquisition-offer")?.addEventListener("click",async()=>{
    const form=document.querySelector("#acq-offer-form");if(!form.reportValidity())return;
    const offer=Number(document.querySelector("#acqOffer").value||0);
    const btn=document.querySelector("#send-acquisition-offer");btn.disabled=true;
    try{
      await sendAcquisitionOffer(a.id,{
        offerAmount:offer,
        appraisedCondition:document.querySelector("#acqAppraisedCondition").value,
        appraisalNotes:document.querySelector("#acqAppraisalNotes").value.trim(),
        offerNote:document.querySelector("#acqOfferNote").value.trim(),
        offerRevision:revision
      },state.user);
      await writeAudit(state.user,"acquisition.offer_made","vehicleAcquisition",a.id,{offerAmount:offer,offerRevision:revision});
      closeModal();await refreshData();setFlash(`Sterling purchase offer of ${money(offer)} sent to ${a.sellerName||"the seller"}.`);
    }catch(e){btn.disabled=false;setFlash(e.message||"Unable to send offer.","error");}
  });
}

function receiveAcquisitionModal(a) {
  const stock=a.stockNumber||`ACQ-${String(a.id).slice(-6).toUpperCase()}`;
  modal("Receive Accepted Vehicle",`
    <div class="record-hero"><div class="record-icon">${icon("warehouse")}</div><div><span class="eyebrow">ACQUISITION INTAKE</span><h3>${safe(a.year||"")} ${safe(a.make||"")} ${safe(a.model||"")}</h3><p>Accepted purchase offer • ${money(a.offerAmount)}</p></div>${statusPill(a.status||"accepted")}</div>
    <form id="receive-acq-form" class="form-grid">
      ${formField("Stock Number","acqStock",stock,"text","required")}
      ${formField("Retail Price","acqRetail",String(Math.round(Number(a.offerAmount||0)*1.15)),"number","required min='0'")}
      <div class="field"><label>Initial Status</label><select class="plain-input" id="acqInitialStatus"><option value="reconditioning">Reconditioning</option><option value="service_review">Service Review</option><option value="hold">Hold</option><option value="available">Available</option></select></div>
      <div class="field"><label>Inventory Location</label><select class="plain-input" id="acqLocation"><option>Used Vehicle Intake</option><option>Used Vehicle Lot</option><option>Detail / Recon</option><option>Holding Area</option></select></div>
    </form>
  `,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="receive-acq-confirm">${icon("warehouse")} Receive Vehicle</button>`);

  const stockInput=document.querySelector("#acqStock");if(stockInput&&!stockInput.value)stockInput.value=stock;
  document.querySelector("#receive-acq-confirm")?.addEventListener("click",async()=>{
    const form=document.querySelector("#receive-acq-form");if(!form.reportValidity())return;
    const btn=document.querySelector("#receive-acq-confirm");btn.disabled=true;
    try{
      const initialStatus=document.querySelector("#acqInitialStatus").value;
      const vehicle=await receiveAcquisitionVehicle(a,{
        stockNumber:document.querySelector("#acqStock").value.trim()||stock,
        price:Number(document.querySelector("#acqRetail").value||0),
        msrp:Number(document.querySelector("#acqRetail").value||0),
        status:initialStatus,
        location:initialStatus==="service_review" ? "Service Intake / Retail Inspection" : document.querySelector("#acqLocation").value
      },state.user);
      if(initialStatus==="service_review"){
        await createNotification({
          type:"service",
          title:"Acquired vehicle needs Service review",
          message:`${a.year} ${a.make} ${a.model} was purchased by Sterling and is waiting for retail inspection.`,
          acquisitionId:a.id,
          vehicleId:vehicle.id
        },state.user);
      }
      await writeAudit(state.user,"acquisition.received","vehicleAcquisition",a.id,{vehicleId:vehicle.id,offerAmount:a.offerAmount,initialStatus});
      closeModal();await refreshData();setFlash(initialStatus==="service_review" ? "Vehicle received and sent to DRIVE Service for retail review." : "Accepted vehicle received into Sterling inventory.");
    }catch(e){btn.disabled=false;setFlash(e.message||"Unable to receive vehicle.","error");}
  });
}

function futureModule(type) {
  const copy = {
    audit:["shield-check","Audit & Security","Immutable management activity, approvals, pricing changes, and sensitive actions will be visible here."]
  }[type];
  return `${pageHeader("STERLING DRIVE", copy[1], copy[2])}<div class="panel">${emptyState(copy[0], copy[1] + " foundation ready", "This module is reserved in the Phase One shell and will plug into the same identity, permissions, and data architecture.")}</div>`;
}

function pageHeader(kicker, title, desc, actions = "") {
  return `<div class="page-head"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${desc}</p></div><div class="hero-actions">${actions}</div></div>`;
}

function currentPage() {
  switch (state.page) {
    case "inventory": return inventory();
    case "sales": return sales();
    case "customers": return customers();
    case "queue": return queuePage();
    case "staff": return staffPage();
    case "financeAppointments": return financeAppointmentsPage();
    case "finance": return financePage();
    case "payments": return paymentsPage();
    case "service": return servicePage();
    case "parts": return partsPage();
    case "acquisitions": return acquisitionsPage();
    case "audit": return futureModule(state.page);
    default: return dashboard();
  }
}


function commandPalette() {
  const commands = [
    ...nav.filter(([id]) => state.profile?.isStaff || ["dashboard","inventory","acquisitions","financeAppointments"].includes(id)).map(([id, ico, label]) => ({
      id:"page-"+id, icon:ico, label, description:pageSubtitleFor(id), type:"Navigate", run:()=>{ state.page=id; closeModal(); render(); }
    })),
    ...(can("sales.manage") ? [
      {id:"new-customer",icon:"user-plus",label:"Create Customer",description:"Add a new customer profile",type:"Action",run:()=>{closeModal();customerModal();}},
      {id:"new-deal",icon:"handshake",label:"Start Deal Jacket",description:"Open a new vehicle deal",type:"Action",run:()=>{closeModal();dealModal();}},
      {id:"new-queue",icon:"concierge-bell",label:"Check In Guest",description:"Add a guest to Reception",type:"Action",run:()=>{closeModal();queueModal();}}
    ] : []),
    ...(can("inventory.manage") ? [
      {id:"new-vehicle",icon:"car-front",label:"Add Vehicle",description:"Add a vehicle to Sterling inventory",type:"Action",run:()=>{closeModal();vehicleModal();}}
    ] : []),
    ...(can("service.manage") ? [
      {id:"new-ro",icon:"clipboard-plus",label:"New Repair Order",description:"Check a vehicle into DRIVE Service",type:"Action",run:()=>{closeModal();repairOrderModal();}},
      {id:"new-appointment",icon:"calendar-plus",label:"Service Appointment",description:"Schedule a customer service visit",type:"Action",run:()=>{closeModal();serviceAppointmentModal();}}
    ] : []),
    ...(can("parts.manage") ? [
      {id:"new-part",icon:"package-plus",label:"Add Part",description:"Create a Parts inventory record",type:"Action",run:()=>{closeModal();newPartModal();}}
    ] : []),
    {id:"sell-car",icon:"car-front",label:"Sell a Car to Sterling",description:"Submit a vehicle to Sterling Acquisitions",type:"Action",run:()=>{closeModal();acquisitionSubmissionModal();}},
    {id:"finance-appointment",icon:"calendar-clock",label:"Finance Appointment",description:"Request or schedule a Finance consultation",type:"Action",run:()=>{closeModal();financeAppointmentModal();}}
  ];

  const renderCommands = term => {
    const q=String(term||"").toLowerCase().trim();
    const filtered=commands.filter(x => !q || (x.label+" "+x.description+" "+x.type).toLowerCase().includes(q));
    const box=document.querySelector("#command-results");
    if(!box) return;
    box.innerHTML=filtered.length ? filtered.map(x=>`<button class="command-result" data-command="${x.id}">
      <span class="command-result-icon">${icon(x.icon)}</span>
      <span><strong>${safe(x.label)}</strong><small>${safe(x.description)}</small></span>
      <em>${x.type}</em>
    </button>`).join("") : `<div class="command-empty">${icon("search-x")}<strong>No results</strong><small>Try a module, customer action, or dealership workflow.</small></div>`;
    hydrateIcons();
    box.querySelectorAll("[data-command]").forEach(btn=>btn.addEventListener("click",()=>commands.find(x=>x.id===btn.dataset.command)?.run()));
  };

  modal("Search Sterling DRIVE", `
    <div class="command-palette">
      <div class="command-input">${icon("search")}<input id="command-input" autocomplete="off" placeholder="Where do you want to go?" /><kbd>ESC</kbd></div>
      <div class="command-hint"><span>Navigate modules or launch common dealership actions.</span><span><kbd>Ctrl</kbd> <kbd>K</kbd></span></div>
      <div id="command-results" class="command-results"></div>
    </div>
  `);
  const input=document.querySelector("#command-input");
  input?.addEventListener("input",()=>renderCommands(input.value));
  input?.focus();
  renderCommands("");
}

function pageSubtitleFor(id) {
  const current=state.page;
  state.page=id;
  const label=pageSubtitle();
  state.page=current;
  return label;
}

function profileOverview() {
  const p=state.profile || {};
  const permissions=p.permissions || [];
  modal("My Sterling Profile", `
    <div class="profile-overview">
      <div class="profile-overview-hero">
        <span class="avatar profile-avatar">${initials(p.displayName || state.user?.email || "Sterling User")}</span>
        <div><span class="eyebrow">STERLING IDENTITY</span><h3>${safe(p.displayName || state.user?.email || "Sterling User")}</h3><p>${safe(state.user?.email || "")}</p></div>
        ${statusPill(p.status || "active")}
      </div>
      <div class="record-grid">
        <div><span>Employee ID</span><strong>${safe(p.employeeId || "Customer account")}</strong></div>
        <div><span>Department</span><strong>${safe(p.department || "—")}</strong></div>
        <div><span>Position</span><strong>${safe(String(p.role || "customer").replaceAll("_"," "))}</strong></div>
        <div><span>Access</span><strong>${permissions.includes("*") ? "Full administrator" : permissions.length + " permissions"}</strong></div>
      </div>
      ${p.isStaff ? `<div class="profile-access-line">${icon("shield-check")} Your Sterling DRIVE access is managed by dealership administration.</div>` : `<div class="profile-access-line">${icon("user")} Customer account</div>`}
    </div>
  `, `<span class="modal-footer-spacer"></span><button class="btn danger-btn" id="profile-signout">${icon("log-out")} Sign Out</button>`);
  document.querySelector("#profile-signout")?.addEventListener("click",()=>signOut(auth));
}

function authScreen() {
  return `
    <div class="auth-layout">
      <section class="auth-brand">
        <div class="auth-overlay"></div>
        <div class="auth-brand-content">
          <div class="brand auth-logo"><div class="brand-mark">S</div><div><strong>STERLING</strong><span>DRIVE</span></div></div>
          <span class="auth-kicker">STERLING MOTOR GROUP</span>
          <h1>Run the dealership.<br><em>Drive the experience.</em></h1>
          <p>The connected operations platform for Sterling Motors: Dealership RP.</p>
          <div class="auth-features">
            <span>${icon("car-front")} Vehicle inventory</span>
            <span>${icon("handshake")} Deal jackets</span>
            <span>${icon("users")} Customer CRM</span>
            <span>${icon("shield-check")} Role-based access</span>
          </div>
        </div>
        <div class="auth-foot">STERLING MOTORS: DEALERSHIP RP <span>•</span> DRIVE v0.1</div>
      </section>
      <section class="auth-panel">
        <div class="auth-card">
          <span class="eyebrow">WELCOME TO STERLING</span>
          <h2 id="auth-title">Sign in to DRIVE</h2>
          <p id="auth-copy">Use your Sterling account to access the dealership.</p>
          <form id="auth-form">
            <div class="field hidden" id="name-field"><label>Full name</label><div class="input-wrap">${icon("user")}<input id="name" autocomplete="name" placeholder="Your name" /></div></div>
            <div class="field"><label>Email address</label><div class="input-wrap">${icon("mail")}<input id="email" type="email" required autocomplete="email" placeholder="you@example.com" /></div></div>
            <div class="field"><label>Password</label><div class="input-wrap">${icon("lock")}<input id="password" type="password" required minlength="6" autocomplete="current-password" placeholder="••••••••" /></div></div>
            <div id="auth-error" class="form-error"></div>
            <button class="btn primary auth-submit" type="submit">Sign in ${icon("arrow-right")}</button>
          </form>
          <div class="auth-switch">New to Sterling? <button id="toggle-auth">Create an account</button></div>
          <div class="auth-note">${icon("shield-check")} Employee access is assigned by Sterling management. New accounts begin as customer accounts.</div>
        </div>
      </section>
    </div>
  `;
}

function modal(title, body, footer = "") {
  document.querySelector("#modal-root")?.remove();
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="modal-root">
    <div class="modal-card">
      <div class="modal-head"><div><span class="eyebrow">STERLING DRIVE</span><h2>${title}</h2></div><button class="icon-btn" data-close-modal>${icon("x")}</button></div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ""}
    </div>
  </div>`);
  hydrateIcons();
  document.querySelectorAll("[data-close-modal]").forEach(b => b.addEventListener("click", closeModal));
}

function closeModal() {
  document.querySelector("#modal-root")?.remove();
}

function formField(label, id, placeholder, type = "text", extra = "") {
  return `<div class="field"><label for="${id}">${label}</label><input class="plain-input" id="${id}" name="${id}" type="${type}" placeholder="${placeholder}" ${extra}></div>`;
}

function vehicleModal() {
  modal("Add Inventory Vehicle", `<form id="vehicle-form" class="form-grid">
    ${formField("Year","year","2026","number","required")}
    ${formField("Make","make","Ford","text","required")}
    ${formField("Model","model","Mustang GT","text","required")}
    ${formField("Trim","trim","Premium")}
    ${formField("Stock Number","stockNumber","SMG-261048","text","required")}
    ${formField("VIN","vin","17-character VIN","text","required maxlength='17'")}
    ${formField("Mileage","mileage","24","number")}
    ${formField("Color","color","Vapor Blue")}
    ${formField("MSRP","msrp","51480","number")}
    ${formField("Selling Price","price","49995","number","required")}
  </form>`, `<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-vehicle">${icon("save")} Add Vehicle</button>`);
  document.querySelector("#save-vehicle").addEventListener("click", async () => {
    const form = document.querySelector("#vehicle-form");
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await createVehicle(data, state.user);
      await writeAudit(state.user, "vehicle.created", "vehicle", data.stockNumber, { make: data.make, model: data.model });
      closeModal(); await refreshData(); setFlash("Vehicle added to Sterling inventory.");
    } catch (e) { setFlash(e.message || "Unable to add vehicle.", "error"); }
  });
}

function customerModal() {
  modal("Create Customer Profile", `<form id="customer-form" class="form-grid">
    ${formField("Full Name","customerName","Jordan Carter","text","required")}
    ${formField("Email","customerEmail","jordan@example.com","email")}
    ${formField("Phone","customerPhone","(918) 555-0100","tel")}
    ${formField("Customer Number","customerNumber","SMC-1001")}
  </form>`, `<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-customer">${icon("user-plus")} Create Customer</button>`);
  document.querySelector("#save-customer").addEventListener("click", async () => {
    const form = document.querySelector("#customer-form"); if (!form.reportValidity()) return;
    const f = Object.fromEntries(new FormData(form).entries());
    const data = { name:f.customerName,email:f.customerEmail,phone:f.customerPhone,customerNumber:f.customerNumber };
    try {
      const result = await createCustomer(data, state.user);
      await writeAudit(state.user, "customer.created", "customer", result.id, { name:data.name });
      closeModal(); await refreshData(); setFlash("Customer profile created.");
    } catch (e) { setFlash(e.message || "Unable to create customer.", "error"); }
  });
}

function dealModal(preselectedCustomerId = "") {
  const customerOpts = state.data.customers.map(c => `<option value="${c.id}" data-name="${safe(c.name)}">${safe(c.name || c.id)}</option>`).join("");
  const vehicleOpts = state.data.vehicles.filter(v => (v.status || "available") === "available").map(v => {
    const name = `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim();
    return `<option value="${v.id}" data-name="${safe(name)}" data-price="${Number(v.price || 0)}">${safe(name)} — ${safe(v.stockNumber || "")}</option>`;
  }).join("");
  modal("Start Deal Jacket", `<form id="deal-form" class="form-grid">
    <div class="field full"><label>Customer</label><select class="plain-input" id="dealCustomer" required><option value="">Select customer</option>${customerOpts}</select></div>
    <div class="field full"><label>Vehicle</label><select class="plain-input" id="dealVehicle" required><option value="">Select available vehicle</option>${vehicleOpts}</select></div>
    ${formField("Deal Number","dealNumber","SM-2026-0001","text","required")}
    ${formField("Opening Price","dealPrice","0","number")}
  </form>`, `<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-deal">${icon("handshake")} Open Deal</button>`);

  const customerSelect = document.querySelector("#dealCustomer");
  if (preselectedCustomerId && customerSelect) customerSelect.value = preselectedCustomerId;
  const vehicle = document.querySelector("#dealVehicle");
  vehicle.addEventListener("change", () => {
    document.querySelector("#dealPrice").value = vehicle.selectedOptions[0]?.dataset.price || "";
  });

  document.querySelector("#save-deal").addEventListener("click", async () => {
    const form = document.querySelector("#deal-form"); if (!form.reportValidity()) return;
    const c = document.querySelector("#dealCustomer"), v = document.querySelector("#dealVehicle");
    const data = {
      customerId:c.value, customerName:c.selectedOptions[0].dataset.name,
      vehicleId:v.value, vehicleName:v.selectedOptions[0].dataset.name,
      dealNumber:document.querySelector("#dealNumber").value,
      price:Number(document.querySelector("#dealPrice").value || 0),
      salespersonUid:state.user.uid, salespersonName:state.profile?.displayName || state.user.email
    };
    try {
      const result = await createDeal(data, state.user);
      await updateRecord("vehicles", data.vehicleId, { status:"deal_pending" });
      const activeQueueEntry = state.data.queue.find(q => q.customerId === data.customerId && (q.status || "waiting") !== "complete");
      if (activeQueueEntry) {
        await updateRecord("queue", activeQueueEntry.id, { status:"with_staff", activeDealId:result.id, assignedUid:state.user.uid, assignedName:state.profile?.displayName || state.user.email });
      }
      await writeAudit(state.user, "deal.created", "deal", result.id, { dealNumber:data.dealNumber, queueEntryId:activeQueueEntry?.id || "" });
      closeModal(); await refreshData(); setFlash("Deal Jacket opened.");
    } catch (e) { setFlash(e.message || "Unable to open deal.", "error"); }
  });
}

function queueModal() {
  const customers = state.data.customers;
  modal("Check In Customer", `<form id="queue-form" class="form-grid">
    <div class="field full"><label>Existing Customer <span class="optional-label">Optional</span></label><select class="plain-input" id="queueCustomer">
      <option value="">Walk-in / not yet in CRM</option>
      ${customers.map(c => `<option value="${c.id}" data-name="${safe(c.name||"Customer")}" data-email="${safe(c.email||"")}" data-phone="${safe(c.phone||"")}">${safe(c.name||c.email||c.id)}${c.customerNumber?" • "+safe(c.customerNumber):""}</option>`).join("")}
    </select></div>
    ${formField("Customer / Guest Name","guestName","Taylor Morgan","text","required")}
    ${formField("Ticket","ticket","A001")}
    <div class="field full"><label>Reason for visit</label><select class="plain-input" id="reason">
      <option>Vehicle Purchase</option><option>Browsing</option><option>Sell My Vehicle</option><option>Trade-In</option><option>Service</option><option>Parts</option><option>Finance</option><option>Appointment</option><option>Vehicle Pickup</option>
    </select></div>
  </form>`, `<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-queue">${icon("concierge-bell")} Check In</button>`);

  const customerSelect=document.querySelector("#queueCustomer");
  customerSelect?.addEventListener("change",()=>{
    const option=customerSelect.selectedOptions[0];
    if(customerSelect.value && option?.dataset.name) document.querySelector("#guestName").value=option.dataset.name;
  });

  document.querySelector("#save-queue").addEventListener("click", async () => {
    const form = document.querySelector("#queue-form"); if (!form.reportValidity()) return;
    const option=customerSelect.selectedOptions[0];
    const data = {
      customerId:customerSelect.value || "",
      customerName:document.querySelector("#guestName").value.trim(),
      customerEmail:customerSelect.value ? (option.dataset.email||"") : "",
      customerPhone:customerSelect.value ? (option.dataset.phone||"") : "",
      ticket:document.querySelector("#ticket").value.trim(),
      reason:document.querySelector("#reason").value
    };
    try {
      const result = await createQueueEntry(data, state.user);
      await writeAudit(state.user, "queue.created", "queue", result.id, {customerId:data.customerId,customerName:data.customerName,reason:data.reason});
      closeModal(); await refreshData(); setFlash(`${data.customerName} checked into reception.`);
    } catch (e) { setFlash(e.message || "Unable to check in customer.", "error"); }
  });
}



function resolveQueueCustomer(q) {
  return state.data.customers.find(c =>
    (q?.customerId && c.id === q.customerId) ||
    (!q?.customerId && c.name && q?.customerName && c.name.trim().toLowerCase() === q.customerName.trim().toLowerCase())
  );
}

function customerDetailModal(customer) {
  if(!customer) return;
  const sameName = value => value && customer.name && String(value).trim().toLowerCase() === customer.name.trim().toLowerCase();
  const deals=state.data.deals.filter(d => d.customerId===customer.id || (!d.customerId && sameName(d.customerName)));
  const vehicles=state.data.vehicles.filter(v => v.ownerCustomerId===customer.id || (!v.ownerCustomerId && sameName(v.ownerCustomerName)));
  const ros=state.data.repairOrders.filter(r => r.customerId===customer.id || (!r.customerId && sameName(r.customerName)));
  const appointments=state.data.serviceAppointments.filter(a => a.customerId===customer.id || (!a.customerId && sameName(a.customerName)));
  const acquisitions=state.data.vehicleAcquisitions.filter(a =>
    (customer.linkedUid && a.sellerUid===customer.linkedUid) ||
    (customer.email && a.sellerEmail && a.sellerEmail.toLowerCase()===customer.email.toLowerCase()) ||
    sameName(a.sellerName)
  );
  const visits=state.data.queue.filter(q => q.customerId===customer.id || (!q.customerId && sameName(q.customerName)));
  const activeVisit=visits.find(q => (q.status||"waiting")!=="complete");
  const completedDeals=deals.filter(d => (d.stage||"").toLowerCase()==="complete");
  const lifetimeSales=completedDeals.reduce((sum,d)=>sum+Number(d.finalPrice||d.price||0),0);

  const timeline=[
    ...deals.map(d=>({type:"deal",date:d.createdAt,title:`Deal ${d.dealNumber||""}`,detail:`${d.vehicleName||"Vehicle"} • ${(d.stage||"shopping").replaceAll("_"," ")}`,ref:d})),
    ...ros.map(r=>({type:"service",date:r.createdAt,title:r.roNumber||"Repair Order",detail:`${r.vehicleName||"Vehicle"} • ${(r.status||"checked_in").replaceAll("_"," ")}`,ref:r})),
    ...visits.map(v=>({type:"visit",date:v.createdAt,title:v.reason||"Dealership Visit",detail:`${v.ticket||"Guest"} • ${(v.status||"waiting").replaceAll("_"," ")}`,ref:v}))
  ].sort((a,b)=>(b.date?.seconds||0)-(a.date?.seconds||0)).slice(0,8);

  modal(`Customer • ${safe(customer.name||"Profile")}`,`
    <div class="customer-profile-hero">
      <span class="avatar customer-profile-avatar">${initials(customer.name||customer.email||"Customer")}</span>
      <div class="customer-profile-title">
        <span class="eyebrow">CUSTOMER RECORD</span>
        <h3>${safe(customer.name||"Customer")}</h3>
        <p>${safe(customer.customerNumber||customer.id.slice(0,8).toUpperCase())} • Customer since ${fmtDate(customer.createdAt)}</p>
      </div>
      ${statusPill(customer.status||"active")}
    </div>

    ${activeVisit ? `<div class="active-customer-visit">
      <span class="active-visit-icon">${icon("map-pin-check")}</span>
      <div><span class="eyebrow">CURRENTLY CHECKED IN</span><strong>${safe(activeVisit.reason||"Dealership Visit")}</strong><small>${safe(activeVisit.ticket||"Guest")} • ${safe((activeVisit.status||"waiting").replaceAll("_"," "))}</small></div>
      ${(can("queue.manage")||can("sales.manage")||can("service.manage")) ? `<button class="btn checkout-btn small" data-checkout="${activeVisit.id}">${icon("log-out")} Check Out</button>` : ""}
    </div>` : ""}

    <div class="customer-profile-contact">
      <div>${icon("mail")}<span><small>Email</small><strong>${safe(customer.email||"Not provided")}</strong></span></div>
      <div>${icon("phone")}<span><small>Phone</small><strong>${safe(customer.phone||"Not provided")}</strong></span></div>
      <div>${icon("badge-check")}<span><small>Customer ID</small><strong>${safe(customer.customerNumber||customer.id.slice(0,8).toUpperCase())}</strong></span></div>
    </div>

    <div class="customer-stat-grid">
      <div><span>Deals</span><strong>${deals.length}</strong><small>${completedDeals.length} completed</small></div>
      <div><span>Vehicles Owned</span><strong>${vehicles.length}</strong><small>Purchased through Sterling</small></div>
      <div><span>Service ROs</span><strong>${ros.length}</strong><small>${appointments.length} appointments</small></div>
      <div><span>Purchase History</span><strong>${money(lifetimeSales)}</strong><small>Completed deal value</small></div>
    </div>

    <div class="customer-record-grid">
      <section class="customer-record-section">
        <div class="record-section-head"><div><span class="eyebrow">GARAGE</span><h4>Vehicles</h4></div><b>${vehicles.length}</b></div>
        <div class="customer-record-list">
          ${vehicles.length ? vehicles.map(v=>`<button class="customer-record-item" data-customer-vehicle="${v.id}"><span class="record-list-icon">${icon("car-front")}</span><span><strong>${safe(`${v.year||""} ${v.make||""} ${v.model||""}`.trim()||"Vehicle")}</strong><small>${safe(v.vin||"VIN pending")} • ${Number(v.mileage||0).toLocaleString()} mi</small></span>${icon("chevron-right")}</button>`).join("") : '<div class="record-list-empty">No owned vehicles recorded.</div>'}
        </div>
      </section>

      <section class="customer-record-section">
        <div class="record-section-head"><div><span class="eyebrow">SALES</span><h4>Deal Jackets</h4></div><b>${deals.length}</b></div>
        <div class="customer-record-list">
          ${deals.length ? deals.slice(0,6).map(d=>`<button class="customer-record-item" data-customer-deal="${d.id}"><span class="record-list-icon">${icon("handshake")}</span><span><strong>${safe(d.dealNumber||"Deal Jacket")}</strong><small>${safe(d.vehicleName||"Vehicle")} • ${safe((d.stage||"shopping").replaceAll("_"," "))}</small></span>${statusPill(d.stage||"shopping")}</button>`).join("") : '<div class="record-list-empty">No sales history yet.</div>'}
        </div>
      </section>

      <section class="customer-record-section">
        <div class="record-section-head"><div><span class="eyebrow">SERVICE</span><h4>Repair History</h4></div><b>${ros.length}</b></div>
        <div class="customer-record-list">
          ${ros.length ? ros.slice(0,6).map(r=>`<button class="customer-record-item" data-customer-ro="${r.id}"><span class="record-list-icon">${icon("wrench")}</span><span><strong>${safe(r.roNumber||"Repair Order")}</strong><small>${safe(r.vehicleName||"Vehicle")} • ${safe((r.status||"checked_in").replaceAll("_"," "))}</small></span>${icon("chevron-right")}</button>`).join("") : '<div class="record-list-empty">No service history yet.</div>'}
        </div>
      </section>

      <section class="customer-record-section">
        <div class="record-section-head"><div><span class="eyebrow">ACQUISITIONS</span><h4>Vehicles Sold to Sterling</h4></div><b>${acquisitions.length}</b></div>
        <div class="customer-record-list">
          ${acquisitions.length ? acquisitions.slice(0,6).map(a=>`<button class="customer-record-item" data-customer-acquisition="${a.id}"><span class="record-list-icon">${icon("badge-dollar-sign")}</span><span><strong>${safe(`${a.year||""} ${a.make||""} ${a.model||""}`.trim())}</strong><small>${a.offerAmount?money(a.offerAmount):"Offer pending"} • ${safe((a.status||"submitted").replaceAll("_"," "))}</small></span>${icon("chevron-right")}</button>`).join("") : '<div class="record-list-empty">No acquisition history.</div>'}
        </div>
      </section>
    </div>

    <section class="customer-timeline">
      <div class="record-section-head"><div><span class="eyebrow">ACTIVITY</span><h4>Recent Sterling Activity</h4></div></div>
      <div class="timeline-list">
        ${timeline.length ? timeline.map(item=>`<div class="timeline-item"><span class="timeline-dot"></span><div><strong>${safe(item.title)}</strong><small>${safe(item.detail)}</small></div><time>${fmtDate(item.date)}</time></div>`).join("") : '<div class="record-list-empty">No activity recorded yet.</div>'}
      </div>
    </section>
  `,`
    ${can("customers.manage")||can("sales.manage") ? `<button class="btn secondary" id="edit-customer-details">${icon("pencil")} Edit Details</button>` : ""}
    <span class="modal-footer-spacer"></span>
    ${can("finance.manage") ? `<button class="btn secondary" id="customer-finance-profile">${icon("landmark")} Finance Profile</button>` : ""}
    ${can("sales.manage") ? `<button class="btn secondary" id="customer-new-deal">${icon("handshake")} Start Deal</button>` : ""}
    ${can("service.manage") ? `<button class="btn primary" id="customer-new-ro">${icon("wrench")} Open Repair Order</button>` : ""}
  `);

  document.querySelector("#edit-customer-details")?.addEventListener("click",()=>editCustomerModal(customer));
  document.querySelector("#customer-finance-profile")?.addEventListener("click",()=>{
    const client=financeClientDirectory().find(x=>x.customerId===customer.id);
    if(client) financeCustomerDetailModal(client);
  });
  document.querySelector("#customer-new-deal")?.addEventListener("click",()=>{closeModal();dealModal(customer.id);});
  document.querySelector("#customer-new-ro")?.addEventListener("click",()=>{closeModal();repairOrderModal({customerId:customer.id});});
  document.querySelector("[data-checkout]")?.addEventListener("click",e=>checkoutCustomerModal(state.data.queue.find(q=>q.id===e.currentTarget.dataset.checkout),customer));
  document.querySelectorAll("[data-customer-vehicle]").forEach(btn=>btn.addEventListener("click",()=>vehicleDetailModal(state.data.vehicles.find(v=>v.id===btn.dataset.customerVehicle))));
  document.querySelectorAll("[data-customer-deal]").forEach(btn=>btn.addEventListener("click",()=>dealDetailModal(state.data.deals.find(d=>d.id===btn.dataset.customerDeal))));
  document.querySelectorAll("[data-customer-ro]").forEach(btn=>btn.addEventListener("click",()=>repairOrderDetailModal(state.data.repairOrders.find(r=>r.id===btn.dataset.customerRo))));
  document.querySelectorAll("[data-customer-acquisition]").forEach(btn=>btn.addEventListener("click",()=>acquisitionDetailModal(state.data.vehicleAcquisitions.find(a=>a.id===btn.dataset.customerAcquisition))));
}

function editCustomerModal(customer) {
  modal("Edit Customer Details",`<form id="edit-customer-form" class="form-grid">
    ${formField("Full Name","editCustomerName",customer.name||"","text","required")}
    ${formField("Customer Number","editCustomerNumber",customer.customerNumber||"")}
    ${formField("Email","editCustomerEmail",customer.email||"","email")}
    ${formField("Phone","editCustomerPhone",customer.phone||"","tel")}
  </form>`,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-customer-details">${icon("save")} Save Details</button>`);
  for (const [id,value] of [["editCustomerName",customer.name||""],["editCustomerNumber",customer.customerNumber||""],["editCustomerEmail",customer.email||""],["editCustomerPhone",customer.phone||""]]) {
    const el=document.querySelector("#"+id); if(el) el.value=value;
  }
  document.querySelector("#save-customer-details")?.addEventListener("click",async()=>{
    const form=document.querySelector("#edit-customer-form");if(!form.reportValidity())return;
    try{
      await updateRecord("customers",customer.id,{
        name:document.querySelector("#editCustomerName").value.trim(),
        customerNumber:document.querySelector("#editCustomerNumber").value.trim(),
        email:document.querySelector("#editCustomerEmail").value.trim(),
        phone:document.querySelector("#editCustomerPhone").value.trim()
      });
      await writeAudit(state.user,"customer.updated","customer",customer.id,{});
      closeModal();await refreshData();setFlash("Customer information updated.");
    }catch(e){setFlash(e.message||"Unable to update customer.","error");}
  });
}

function checkoutCustomerModal(queueEntry, customer=null) {
  if(!queueEntry)return;
  const linkedCustomer=customer||resolveQueueCustomer(queueEntry);
  modal("Check Out Customer",`
    <div class="checkout-customer-head">
      <span class="record-icon">${icon("log-out")}</span>
      <div><span class="eyebrow">END DEALERSHIP VISIT</span><h3>${safe(queueEntry.customerName||"Guest")}</h3><p>${safe(queueEntry.reason||"Dealership visit")} • ${safe(queueEntry.ticket||"Guest")}</p></div>
    </div>
    <form id="checkout-form" class="form-grid">
      <div class="field full"><label>Visit Outcome</label><select class="plain-input" id="checkoutOutcome">
        <option>Visit Complete</option>
        <option>Purchase Completed</option>
        <option>Continuing Follow-Up</option>
        <option>Service Complete</option>
        <option>Appointment Scheduled</option>
        <option>No Purchase / Browsing</option>
        <option>Customer Left</option>
        <option>Other</option>
      </select></div>
      <div class="field full"><label>Checkout Notes <span class="optional-label">Optional</span></label><textarea class="plain-input textarea" id="checkoutNotes" placeholder="Anything the next employee should know about this visit?"></textarea></div>
    </form>
    ${linkedCustomer ? `<div class="linked-customer-note">${icon("user-check")} This visit is linked to <strong>${safe(linkedCustomer.name||"the customer profile")}</strong> and will remain in their dealership history.</div>` : ""}
  `,`<button class="btn secondary" data-close-modal>Cancel</button><button class="btn checkout-btn" id="confirm-checkout">${icon("log-out")} Check Out Customer</button>`);

  document.querySelector("#confirm-checkout")?.addEventListener("click",async()=>{
    const outcome=document.querySelector("#checkoutOutcome").value;
    const notes=document.querySelector("#checkoutNotes").value.trim();
    try{
      await checkoutQueueEntry(queueEntry.id,{checkoutOutcome:outcome,checkoutNotes:notes},state.user);
      await writeAudit(state.user,"queue.customer_checked_out","queue",queueEntry.id,{customerId:queueEntry.customerId||"",customerName:queueEntry.customerName||"",outcome});
      closeModal();await refreshData();setFlash(`${queueEntry.customerName||"Customer"} checked out successfully.`);
    }catch(e){setFlash(e.message||"Unable to check out customer.","error");}
  });
}
function notificationCenter() {
  const items = [...state.data.notifications].sort((a,b) => {
    const av = a.createdAt?.seconds || 0, bv = b.createdAt?.seconds || 0;
    return bv - av;
  });
  modal("DRIVE Notifications", items.length ? `
    <div class="notification-list">
      ${items.map(n => `<button class="notification-item ${n.read ? "" : "unread"}" data-notification="${n.id}">
        <span class="notification-icon">${icon(n.type === "approval" ? "badge-check" : n.type === "test_drive" ? "car-front" : "bell")}</span>
        <span><strong>${safe(n.title || "Sterling DRIVE")}</strong><small>${safe(n.message || "")}</small><em>${fmtDate(n.createdAt)}</em></span>
        ${!n.read ? '<b></b>' : ""}
      </button>`).join("")}
    </div>` : emptyState("bell-off", "You’re all caught up", "New dealership activity will appear here."));
  document.querySelectorAll("[data-notification]").forEach(btn => btn.addEventListener("click", async () => {
    const item = state.data.notifications.find(n => n.id === btn.dataset.notification);
    if (item && !item.read) {
      try { await markNotificationRead(item.id); item.read = true; } catch {}
    }
    closeModal(); render();
    if (item?.dealId) {
      const deal = state.data.deals.find(d => d.id === item.dealId);
      if (deal) dealDetailModal(deal);
    }
  }));
}

function vehicleDetailModal(v) {
  if (!v) return;
  const name = `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim() || "Vehicle";
  const activeDrive = state.data.testDrives.find(t => t.vehicleId === v.id && t.status === "active");
  const scanCode = `sterling://vehicle/${v.id}`;
  modal(name, `
    <div class="record-hero">
      <div class="record-icon">${icon("car-front")}</div>
      <div><span class="eyebrow">VEHICLE RECORD</span><h3>${safe(name)}</h3><p>${safe(v.trim || "Sterling Motors inventory")}</p></div>
      ${statusPill(v.status || "available")}
    </div>
    <div class="record-grid">
      <div><span>Stock Number</span><strong>${safe(v.stockNumber || "—")}</strong></div>
      <div><span>VIN</span><strong>${safe(v.vin || "Pending")}</strong></div>
      <div><span>Mileage</span><strong>${Number(v.mileage || 0).toLocaleString()} mi</strong></div>
      <div><span>Color</span><strong>${safe(v.color || "—")}</strong></div>
      <div><span>Selling Price</span><strong>${money(v.price)}</strong></div>
      <div><span>MSRP</span><strong>${money(v.msrp || v.price)}</strong></div>
    </div>
    <div class="scan-record"><span>${icon("qr-code")}</span><div><small>STERLING SCAN ID</small><code>${safe(scanCode)}</code></div><button class="btn secondary small" id="copy-scan">Copy</button></div>
    ${(v.sourceTradeId||v.sourceAcquisitionId) ? `<div class="trade-origin-note">${icon(v.sourceTradeId?"refresh-cw":"badge-dollar-sign")}<div><strong>${v.sourceTradeId?"Trade-In Vehicle":"Sterling-Purchased Vehicle"}</strong><span>${v.status==="available" ? "Service-approved and on the sales floor." : v.status==="retail_ready" ? "Service approved — waiting to be pushed to the sales floor." : "Retail sale locked until Service completes its review."}</span></div></div>` : ""}
    ${(v.sourceTradeId||v.sourceAcquisitionId) && v.status==="retail_ready" && (can("inventory.manage")||can("sales.manage")||can("admin.full")||can("acquisitions.manage")) ? `<div class="workflow-actions"><button class="btn primary" id="push-sales-floor">${icon("store")} Push to Sales Floor</button></div>` : ""}
    ${activeDrive ? `<div class="alert-card">${icon("navigation")} <div><strong>Vehicle is currently on a test drive</strong><span>${safe(activeDrive.customerName || "Customer")} • ${safe(activeDrive.startedByName || "Sterling Staff")}</span></div>${can("sales.manage") ? `<button class="btn primary small" data-return-drive="${activeDrive.id}">Return Vehicle</button>` : ""}</div>` : ""}
  `);
  document.querySelector("#copy-scan")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(scanCode); setFlash("Vehicle scan ID copied."); } catch { setFlash(scanCode); }
  });
  document.querySelector("#push-sales-floor")?.addEventListener("click",()=>pushTradeToSalesFloorModal(v));
  document.querySelector("[data-return-drive]")?.addEventListener("click", () => completeTestDriveModal(activeDrive));
}

function dealDetailModal(d) {
  if (!d) return;
  const vehicle = state.data.vehicles.find(v => v.id === d.vehicleId);
  const activeDrive = state.data.testDrives.find(t => t.dealId === d.id && t.status === "active");
  const managerReview = (d.stage || "").replaceAll("_"," ").toLowerCase() === "manager review";
  const trade = state.data.tradeIns.find(t => t.dealId === d.id);
  const finance = state.data.financeApplications.find(x => x.dealId === d.id);
  const tradeVariance = trade ? Number(trade.allowance||0) - Number(trade.acv||0) : 0;
  const tradeApproval = trade?.managerApprovalStatus || d.tradeApprovalStatus || "not_submitted";
  modal(`Deal ${safe(d.dealNumber || d.id.slice(0,8).toUpperCase())}`, `
    <div class="deal-summary">
      <div><span class="eyebrow">CUSTOMER</span><h3>${safe(d.customerName || "Unassigned")}</h3><p>${safe(d.salespersonName || "No salesperson assigned")}</p></div>
      <div class="deal-price"><span>Current Deal</span><strong>${money(d.counterPrice || d.finalPrice || d.price || 0)}</strong>${statusPill(d.stage || "shopping")}</div>
    </div>
    <div class="record-grid">
      <div><span>Vehicle</span><strong>${safe(d.vehicleName || "Pending")}</strong></div>
      <div><span>Opening Price</span><strong>${money(d.price)}</strong></div>
      <div><span>Manager Status</span><strong>${safe(d.approvalStatus || "Not submitted")}</strong></div>
      <div><span>Opened</span><strong>${fmtDate(d.createdAt)}</strong></div>
      <div><span>Trade-In</span><strong>${trade ? money(trade.allowance) : "None"}</strong></div>
      <div><span>Finance</span><strong>${finance ? money(finance.monthlyPayment) + "/mo" : "Not started"}</strong></div>
    </div>
    ${trade ? `<div class="trade-desk-card ${managerReview ? "manager-reviewing" : ""}">
      <div class="trade-desk-head">
        <div><span class="eyebrow">TRADE-IN • DESK REVIEW</span><h3>${safe(trade.year||"")} ${safe(trade.make||"")} ${safe(trade.model||"")}</h3><p>${Number(trade.mileage||0).toLocaleString()} mi • ${safe(trade.vin||"VIN pending")}</p></div>
        ${statusPill(tradeApproval)}
      </div>
      <div class="trade-value-grid">
        <div><span>Sales ACV</span><strong>${money(trade.acv)}</strong></div>
        <div><span>Customer Allowance</span><strong>${money(trade.allowance)}</strong></div>
        <div class="${tradeVariance>0?"negative-value":"positive-value"}"><span>${tradeVariance>0?"Over-Allowance":"ACV Cushion"}</span><strong>${money(Math.abs(tradeVariance))}</strong></div>
        <div><span>Manager Approved</span><strong>${trade.managerApprovedAllowance!=null ? money(trade.managerApprovedAllowance) : "Pending"}</strong></div>
      </div>
      ${managerReview ? `<div class="trade-manager-warning">${icon("shield-alert")} Deal approval also approves or counters these trade values.</div>` : ""}
    </div>` : ""}
    ${d.managerNote ? `<div class="manager-note"><span>Manager Note</span><p>${safe(d.managerNote)}</p></div>` : ""}
    ${activeDrive ? `<div class="alert-card">${icon("navigation")}<div><strong>Test drive active</strong><span>${safe(activeDrive.customerName || d.customerName)} • Start mileage ${Number(activeDrive.startMileage || 0).toLocaleString()}</span></div><button class="btn primary small" data-return-drive="${activeDrive.id}">Check In</button></div>` : ""}
    <div class="workflow-actions">
      ${can("sales.manage") && !activeDrive && vehicle && ["shopping","negotiation"].includes((d.stage || "shopping").toLowerCase()) ? `<button class="btn secondary" id="start-test-drive">${icon("key-round")} Start Test Drive</button>` : ""}
      ${can("sales.manage") && ["shopping","test_drive","negotiation"].includes((d.stage || "shopping").toLowerCase()) ? `<button class="btn secondary" id="trade-in">${icon("car")} ${trade ? "Edit Trade" : "Appraise Trade"}</button>` : ""}
      ${can("finance.manage") && (d.stage || "").toLowerCase()==="finance" ? `<button class="btn secondary" id="open-finance">${icon("calculator")} Open Finance</button>` : ""}
      ${(can("finance.manage") || can("sales.manage")) && (d.stage || "").toLowerCase()==="delivery" ? `<button class="btn primary" id="open-delivery">${icon("key-round")} Delivery Checklist</button>` : ""}
      ${can("sales.manage") && !managerReview && !["finance","documents","delivery","complete"].includes((d.stage || "").toLowerCase()) ? `<button class="btn primary" id="send-desk">${icon("send")} Send to Desk</button>` : ""}
      ${managerReview && isManager() ? `<button class="btn success-btn" id="approve-deal">${icon("check")} Approve to Finance</button><button class="btn secondary" id="counter-deal">${icon("message-square-more")} Counter</button><button class="btn danger-btn" id="decline-deal">${icon("x")} Decline</button>` : ""}
    </div>
  `);

  document.querySelector("#start-test-drive")?.addEventListener("click", () => startTestDriveModal(d, vehicle));
  document.querySelector("#trade-in")?.addEventListener("click", () => tradeInModal(d));
  document.querySelector("#open-finance")?.addEventListener("click", () => financeWorksheetModal(d));
  document.querySelector("#open-delivery")?.addEventListener("click", () => deliveryModal(d));
  document.querySelector("[data-return-drive]")?.addEventListener("click", () => completeTestDriveModal(activeDrive));
  document.querySelector("#send-desk")?.addEventListener("click", async () => {
    try {
      if(trade) {
        await updateRecord("tradeIns",trade.id,{
          managerApprovalStatus:"pending",
          submittedAcv:Number(trade.acv||0),
          submittedAllowance:Number(trade.allowance||0),
          submittedBy:state.user.uid,
          submittedByName:state.profile?.displayName||state.user.email
        });
      }
      await updateRecord("deals", d.id, {
        stage:"manager_review",
        approvalStatus:"pending",
        tradeApprovalStatus:trade ? "pending" : "not_applicable",
        submittedTradeAcv:trade ? Number(trade.acv||0) : 0,
        submittedTradeAllowance:trade ? Number(trade.allowance||0) : 0
      });
      await createNotification({ type:"approval", title:"Deal approval required", message:`${d.salespersonName || "Sales"} submitted ${d.dealNumber || "a deal"} for ${d.customerName || "a customer"}${trade ? ` with a ${money(trade.allowance)} trade allowance` : ""}.`, dealId:d.id }, state.user);
      await writeAudit(state.user, "deal.sent_to_desk", "deal", d.id, { dealNumber:d.dealNumber, tradeInId:trade?.id||"", tradeAcv:trade?.acv||0, tradeAllowance:trade?.allowance||0 });
      closeModal(); await refreshData(); setFlash("Deal sent to the desk for manager review.");
    } catch (e) { setFlash(e.message || "Unable to submit deal.", "error"); }
  });
  document.querySelector("#approve-deal")?.addEventListener("click", async () => {
    try {
      if(trade) {
        await updateRecord("tradeIns",trade.id,{
          managerApprovalStatus:"approved",
          managerApprovedAcv:Number(trade.acv||0),
          managerApprovedAllowance:Number(trade.allowance||0),
          managerApprovedBy:state.user.uid,
          managerApprovedByName:state.profile?.displayName||state.user.email
        });
      }
      await updateRecord("deals", d.id, {
        stage:"finance",
        approvalStatus:"approved",
        tradeApprovalStatus:trade ? "approved" : "not_applicable",
        tradeAcv:trade ? Number(trade.acv||0) : 0,
        tradeAllowance:trade ? Number(trade.allowance||0) : 0,
        approvedBy:state.user.uid,
        approvedByName:state.profile?.displayName || state.user.email
      });
      await createNotification({ type:"approval", title:"Deal approved", message:`${d.dealNumber || "Deal"} was approved${trade ? `, including a ${money(trade.allowance)} trade allowance` : ""}, and sent to Finance.`, dealId:d.id }, state.user);
      await writeAudit(state.user, "deal.approved", "deal", d.id, { dealNumber:d.dealNumber,tradeInId:trade?.id||"",tradeAcv:trade?.acv||0,tradeAllowance:trade?.allowance||0 });
      closeModal(); await refreshData(); setFlash("Deal approved and routed to Finance.");
    } catch (e) { setFlash(e.message || "Unable to approve deal.", "error"); }
  });
  document.querySelector("#counter-deal")?.addEventListener("click", () => counterDealModal(d));
  document.querySelector("#decline-deal")?.addEventListener("click", async () => {
    try {
      await updateRecord("deals", d.id, { stage:"negotiation", approvalStatus:"declined", managerNote:"Deal declined by management. Revise and resubmit." });
      await createNotification({ type:"approval", title:"Deal returned to Sales", message:`${d.dealNumber || "Deal"} was declined and returned for negotiation.`, dealId:d.id }, state.user);
      await writeAudit(state.user, "deal.declined", "deal", d.id, {});
      closeModal(); await refreshData(); setFlash("Deal returned to Sales.");
    } catch (e) { setFlash(e.message || "Unable to decline deal.", "error"); }
  });
}

function counterDealModal(d) {
  const trade=state.data.tradeIns.find(t=>t.dealId===d.id);
  modal("Counter Deal", `
    <div class="counter-package-head">
      <div><span class="eyebrow">MANAGER COUNTER</span><h3>${safe(d.dealNumber||"Deal Jacket")}</h3><p>Adjust the vehicle deal and trade values together.</p></div>
      ${trade ? statusPill(trade.managerApprovalStatus||"pending") : ""}
    </div>
    <form id="counter-form" class="form-grid">
      ${formField("Counter Vehicle Price","counterPrice",String(d.counterPrice || d.price || 0),"number","required min='0'")}
      ${trade ? `
        ${formField("Manager Trade ACV","counterTradeAcv",String(trade.acv||0),"number","required min='0'")}
        ${formField("Manager Trade Allowance","counterTradeAllowance",String(trade.allowance||0),"number","required min='0'")}
        <div class="field"><label>Allowance Position</label><div class="calculated-field" id="counterTradeVariance"></div></div>
      ` : ""}
      <div class="field full"><label>Manager Note</label><textarea class="plain-input textarea" id="managerNote" placeholder="Explain the counter or required changes..." required></textarea></div>
    </form>
  `, `<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-counter">${icon("send")} Send Counter</button>`);

  const syncTradeVariance=()=>{
    if(!trade)return;
    const acv=Number(document.querySelector("#counterTradeAcv")?.value||0);
    const allowance=Number(document.querySelector("#counterTradeAllowance")?.value||0);
    const variance=allowance-acv;
    const el=document.querySelector("#counterTradeVariance");
    if(el) el.innerHTML=`<strong class="${variance>0?"negative-value":"positive-value"}">${variance>0?"Over-Allowance ":"ACV Cushion "}${money(Math.abs(variance))}</strong>`;
  };
  document.querySelector("#counterTradeAcv")?.addEventListener("input",syncTradeVariance);
  document.querySelector("#counterTradeAllowance")?.addEventListener("input",syncTradeVariance);
  syncTradeVariance();

  document.querySelector("#save-counter")?.addEventListener("click", async () => {
    const form=document.querySelector("#counter-form"); if(!form.reportValidity()) return;
    const button=document.querySelector("#save-counter");
    button.disabled=true;
    const counterPrice=Number(document.querySelector("#counterPrice").value || 0);
    const managerNote=document.querySelector("#managerNote").value.trim();
    const tradeAcv=trade ? Number(document.querySelector("#counterTradeAcv").value||0) : 0;
    const tradeAllowance=trade ? Number(document.querySelector("#counterTradeAllowance").value||0) : 0;
    try {
      if(trade) {
        await updateRecord("tradeIns",trade.id,{
          acv:tradeAcv,
          allowance:tradeAllowance,
          managerApprovalStatus:"countered",
          managerCounterAcv:tradeAcv,
          managerCounterAllowance:tradeAllowance,
          managerCounteredBy:state.user.uid,
          managerCounteredByName:state.profile?.displayName||state.user.email
        });
      }
      await updateRecord("deals", d.id, {
        stage:"negotiation",
        approvalStatus:"countered",
        counterPrice,
        managerNote,
        tradeApprovalStatus:trade ? "countered" : "not_applicable",
        tradeAcv:tradeAcv,
        tradeAllowance:tradeAllowance,
        counteredBy:state.user.uid
      });
      await createNotification({
        type:"approval",
        title:"Manager counter received",
        message:`${d.dealNumber || "Deal"} was countered at ${money(counterPrice)}${trade ? ` with a ${money(tradeAllowance)} trade allowance` : ""}.`,
        dealId:d.id
      }, state.user);
      await writeAudit(state.user, "deal.countered", "deal", d.id, { counterPrice,tradeInId:trade?.id||"",tradeAcv,tradeAllowance });
      closeModal(); await refreshData(); setFlash("Counter package sent back to Sales.");
    } catch(e) {
      button.disabled=false;
      setFlash(e.message || "Unable to counter deal.", "error");
    }
  });
}

function startTestDriveModal(d, vehicle) {
  const start = Number(vehicle?.mileage || 0);
  modal("Start Test Drive", `<form id="drive-form" class="form-grid">
    <div class="field full"><label>Customer</label><input class="plain-input" value="${safe(d.customerName || "")}" disabled></div>
    <div class="field full"><label>Vehicle</label><input class="plain-input" value="${safe(d.vehicleName || "")}" disabled></div>
    ${formField("Start Mileage","driveMileage",String(start),"number","required")}
    <div class="field"><label>Fuel Level</label><select class="plain-input" id="driveFuel"><option>Full</option><option>3/4</option><option>1/2</option><option>1/4</option></select></div>
    <div class="field full check-field"><label><input type="checkbox" id="licenseVerified" required> Driver's license verified for RP</label></div>
  </form>`, `<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="begin-drive">${icon("key-round")} Check Out Vehicle</button>`);
  document.querySelector("#begin-drive")?.addEventListener("click", async () => {
    const form=document.querySelector("#drive-form"); if(!form.reportValidity()) return;
    try {
      const result=await createTestDrive({
        dealId:d.id, dealNumber:d.dealNumber || "", customerId:d.customerId || "", customerName:d.customerName || "",
        vehicleId:d.vehicleId, vehicleName:d.vehicleName || "", startMileage:Number(document.querySelector("#driveMileage").value || start),
        startFuel:document.querySelector("#driveFuel").value, licenseVerified:true
      }, state.user);
      await updateRecord("vehicles", d.vehicleId, { status:"test_drive" });
      await updateRecord("deals", d.id, { stage:"test_drive", activeTestDriveId:result.id });
      await createNotification({ type:"test_drive", title:"Test drive checked out", message:`${d.vehicleName} left with ${d.customerName}.`, dealId:d.id }, state.user);
      await writeAudit(state.user, "test_drive.started", "testDrive", result.id, { dealId:d.id, vehicleId:d.vehicleId });
      closeModal(); await refreshData(); setFlash("Test drive started. Vehicle marked OUT.");
    } catch(e) { setFlash(e.message || "Unable to start test drive.", "error"); }
  });
}

function completeTestDriveModal(drive) {
  if(!drive) return;
  modal("Return Test Drive", `<form id="return-drive-form" class="form-grid">
    ${formField("Ending Mileage","endMileage",String(drive.startMileage || 0),"number","required")}
    <div class="field"><label>Fuel Level</label><select class="plain-input" id="endFuel"><option>Full</option><option>3/4</option><option>1/2</option><option>1/4</option></select></div>
    <div class="field full"><label>Return Condition</label><select class="plain-input" id="returnCondition"><option>No new damage</option><option>Damage noted — manager review</option></select></div>
    <div class="field full"><label>Customer Interest</label><select class="plain-input" id="customerInterest"><option>Interested</option><option>Needs time</option><option>Not interested</option></select></div>
  </form>`, `<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="finish-drive">${icon("corner-down-left")} Check In Vehicle</button>`);
  document.querySelector("#finish-drive")?.addEventListener("click", async () => {
    const form=document.querySelector("#return-drive-form"); if(!form.reportValidity()) return;
    const endMileage=Number(document.querySelector("#endMileage").value || drive.startMileage || 0);
    try {
      await completeTestDrive(drive.id, {
        endMileage, endFuel:document.querySelector("#endFuel").value,
        returnCondition:document.querySelector("#returnCondition").value,
        customerInterest:document.querySelector("#customerInterest").value
      }, state.user);
      await updateRecord("vehicles", drive.vehicleId, { status:"deal_pending", mileage:endMileage });
      await updateRecord("deals", drive.dealId, { stage:"negotiation", activeTestDriveId:null });
      await writeAudit(state.user, "test_drive.completed", "testDrive", drive.id, { endMileage });
      closeModal(); await refreshData(); setFlash("Vehicle checked in. Deal moved to negotiation.");
    } catch(e) { setFlash(e.message || "Unable to complete test drive.", "error"); }
  });
}

function staffAccessModal(user = null) {
  const allUsers = state.data.users;
  const selected = user || allUsers.find(u => !u.isStaff) || allUsers[0];
  if (!selected) { setFlash("No user accounts are available yet.", "error"); return; }

  const permissionCatalog = [
    {
      group:"Sales & Customers", icon:"handshake",
      items:[
        ["sales.manage","Sales Operations","Create customers, run the sales floor, and manage sales workflows."],
        ["customers.manage","Customer Profiles","Create and update customer CRM records."],
        ["deals.manage","Deal Jackets","Create and update dealership Deal Jackets."],
        ["deals.approve","Manager Deal Approval","Approve, counter, or decline deals sent to the desk."],
        ["queue.manage","Reception Queue","Check in, claim, and route dealership guests."]
      ]
    },
    {
      group:"Vehicle Operations", icon:"car-front",
      items:[
        ["inventory.manage","Vehicle Inventory","Add vehicles and manage stock, pricing, and vehicle status."],
        ["acquisitions.manage","Vehicle Acquisitions","Review vehicles customers want to sell, issue offers, and receive accepted vehicles."],
        ["service.manage","Service Operations","Manage service appointments and repair workflows."],
        ["parts.manage","Parts Operations","Manage parts inventory, requests, and fulfillment."]
      ]
    },
    {
      group:"Finance & Delivery", icon:"landmark",
      items:[
        ["finance.manage","Finance & F&I","Build RP financing packages, F&I products, and delivery records."]
      ]
    },
    {
      group:"Administration", icon:"shield-check",
      items:[
        ["staff.manage","Staff Administration","View and manage non-privileged staff details."],
        ["audit.view","Audit Log Access","View Sterling DRIVE security and activity logs."],
        ["admin.full","Administrator Access","Full administrative capability without using the wildcard permission."]
      ]
    }
  ];

  const presets = {
    sales:["sales.manage","customers.manage","deals.manage","queue.manage"],
    sales_manager:["sales.manage","customers.manage","deals.manage","deals.approve","queue.manage","inventory.manage","acquisitions.manage"],
    acquisitions:["acquisitions.manage"],
    inventory:["inventory.manage","acquisitions.manage"],
    reception:["queue.manage","customers.manage"],
    finance:["finance.manage"],
    service:["service.manage","customers.manage"],
    parts:["parts.manage","inventory.manage"],
    staff_manager:["staff.manage","audit.view"],
    admin:["*"]
  };

  const presetMeta = [
    ["sales","Sales Staff","Sales, customers, deals, and reception"],
    ["sales_manager","Sales Manager","Sales plus desk approval, inventory, and acquisitions"],
    ["acquisitions","Acquisitions","Review customer vehicles and issue Sterling offers"],
    ["inventory","Inventory","Vehicle inventory and acquisitions"],
    ["reception","Reception","Guest queue and customer lookup"],
    ["finance","Finance","Finance, F&I, and delivery"],
    ["service","Service","Service operations and customer lookup"],
    ["parts","Parts","Parts plus inventory visibility"],
    ["staff_manager","Staff Manager","Staff records and audit visibility"],
    ["admin","Full Administrator","Complete Sterling DRIVE access"]
  ];

  const rolesByDepartment = {
    Sales:["sales_trainee","sales_consultant","senior_sales_consultant","sales_floor_manager","sales_manager","general_sales_manager"],
    Finance:["finance_associate","finance_manager","senior_finance_manager","director_of_finance"],
    Service:["service_porter","service_technician","senior_technician","master_technician","service_advisor","senior_service_advisor","shop_foreman","service_manager","director_fixed_operations"],
    Parts:["parts_associate","parts_specialist","senior_parts_specialist","parts_manager"],
    Inventory:["inventory_associate","inventory_specialist","inventory_manager","vehicle_acquisition_manager"],
    Acquisitions:["acquisition_specialist","senior_acquisition_specialist","acquisition_manager"],
    Reception:["receptionist","senior_receptionist","guest_services_supervisor"],
    Management:["department_manager","general_manager"],
    Executive:["regional_manager","director_operations","vice_president_operations","chief_operating_officer","president","dealer_principal"]
  };

  const prettyRole = value => String(value || "").replaceAll("_"," ").replace(/\b\w/g, m => m.toUpperCase());
  const currentPermissions = new Set(selected.permissions || []);
  const hasWildcard = currentPermissions.has("*");
  const selectedDepartment = selected.department || "Sales";
  const currentRole = selected.role || rolesByDepartment[selectedDepartment]?.[0] || "employee";

  modal("Manage Employee Access", `
    <div class="staff-access-shell">
      <div class="staff-access-person">
        <span class="avatar xl">${initials(selected.displayName || selected.email || "Employee")}</span>
        <div>
          <span class="eyebrow">${selected.isStaff ? "CURRENT EMPLOYEE" : "CUSTOMER ACCOUNT"}</span>
          <h3>${safe(selected.displayName || selected.email || "Sterling User")}</h3>
          <p>${safe(selected.email || "No email")} • ${safe(selected.employeeId || "No employee ID assigned")}</p>
        </div>
        ${statusPill(selected.status || (selected.isStaff ? "active" : "customer"))}
      </div>

      <form id="staff-form">
        <section class="access-section">
          <div class="access-section-head"><div><span class="eyebrow">ACCOUNT</span><h4>Employee Assignment</h4></div><p>Select who you are configuring and where they work.</p></div>
          <div class="form-grid">
            <div class="field full"><label>User Account</label><select class="plain-input" id="staffUser">${allUsers.map(u => `<option value="${u.id}" ${u.id===selected.id?"selected":""}>${safe(u.displayName || u.email || u.id)} ${u.isStaff ? "• Employee" : "• Customer"}</option>`).join("")}</select></div>
            ${formField("Employee ID","employeeId",selected.employeeId || "SMG-0002")}
            <div class="field"><label>Employment Status</label><select class="plain-input" id="staffStatus">
              <option value="active" ${selected.status==="active"?"selected":""}>Active</option>
              <option value="leave" ${selected.status==="leave"?"selected":""}>Leave of Absence</option>
              <option value="suspended" ${selected.status==="suspended"?"selected":""}>Suspended</option>
              <option value="terminated" ${selected.status==="terminated"?"selected":""}>Terminated</option>
            </select></div>
            <div class="field"><label>Department</label><select class="plain-input" id="department">${Object.keys(rolesByDepartment).map(x=>`<option ${selectedDepartment===x?"selected":""}>${x}</option>`).join("")}</select></div>
            <div class="field"><label>Position</label><select class="plain-input" id="staffRole"></select></div>
          </div>
        </section>

        <section class="access-section">
          <div class="access-section-head permission-heading">
            <div><span class="eyebrow">ACCESS</span><h4>Permission Preset</h4></div>
            <p>Start with a role preset, then customize individual permissions below.</p>
          </div>
          <div class="preset-grid">
            ${presetMeta.map(([id,label,desc]) => `<button type="button" class="preset-card" data-permission-preset="${id}">
              <span class="preset-check">${icon("check")}</span>
              <strong>${label}</strong><small>${desc}</small>
            </button>`).join("")}
          </div>
        </section>

        <section class="access-section">
          <div class="access-section-head permission-heading">
            <div><span class="eyebrow">PERMISSIONS</span><h4>Fine-Tune Access</h4></div>
            <div class="permission-tools">
              <button type="button" class="text-btn" id="select-all-perms">Select all</button>
              <span>•</span>
              <button type="button" class="text-btn" id="clear-all-perms">Clear</button>
            </div>
          </div>

          <div id="wildcard-alert" class="wildcard-alert ${hasWildcard ? "" : "hidden"}">
            ${icon("crown")} <div><strong>Full Administrator wildcard is active</strong><span>This employee currently has every permission through <code>*</code>. Choose a preset or customize access to replace it.</span></div>
          </div>

          <div class="permission-groups">
            ${permissionCatalog.map(group => `<div class="permission-group">
              <div class="permission-group-title">${icon(group.icon)}<strong>${group.group}</strong></div>
              <div class="permission-options">
                ${group.items.map(([id,label,desc]) => `<label class="permission-option">
                  <input type="checkbox" data-permission="${id}" ${!hasWildcard && currentPermissions.has(id) ? "checked" : ""}>
                  <span class="permission-checkbox">${icon("check")}</span>
                  <span class="permission-copy"><strong>${label}</strong><small>${desc}</small><code>${id}</code></span>
                </label>`).join("")}
              </div>
            </div>`).join("")}
          </div>

          <div class="permission-summary">
            <div><span class="eyebrow">ACCESS SUMMARY</span><strong id="permission-count">${hasWildcard ? "Full administrator" : currentPermissions.size + " permission" + (currentPermissions.size===1?"":"s")}</strong></div>
            <div id="permission-summary-chips"></div>
          </div>
        </section>
      </form>
    </div>
  `, `
    ${selected.isStaff && selected.id !== state.user.uid ? `<button class="btn danger-btn" id="remove-staff-access">${icon("user-minus")} Remove Employee Access</button>` : ""}
    <span class="modal-footer-spacer"></span>
    <button class="btn secondary" data-close-modal>Cancel</button>
    <button class="btn primary" id="save-staff">${icon("shield-check")} Save Employee Access</button>
  `);

  const selector = document.querySelector("#staffUser");
  const department = document.querySelector("#department");
  const roleSelect = document.querySelector("#staffRole");
  const wildcardAlert = document.querySelector("#wildcard-alert");
  let wildcardActive = hasWildcard;

  const renderRoles = () => {
    const roles = rolesByDepartment[department.value] || ["employee"];
    const desired = roles.includes(currentRole) ? currentRole : roles[0];
    roleSelect.innerHTML = roles.map(role => `<option value="${role}" ${role===desired?"selected":""}>${prettyRole(role)}</option>`).join("");
  };

  const permissionInputs = () => [...document.querySelectorAll("[data-permission]")];

  const updatePermissionSummary = () => {
    const checked = permissionInputs().filter(x => x.checked).map(x => x.dataset.permission);
    const count = document.querySelector("#permission-count");
    const chips = document.querySelector("#permission-summary-chips");
    if (wildcardActive) {
      count.textContent = "Full administrator";
      chips.innerHTML = '<span class="access-chip admin-chip">All Sterling DRIVE permissions</span>';
      wildcardAlert.classList.remove("hidden");
    } else {
      count.textContent = checked.length + " permission" + (checked.length===1 ? "" : "s");
      wildcardAlert.classList.add("hidden");
      chips.innerHTML = checked.length
        ? checked.map(p => `<span class="access-chip">${safe(permissionCatalog.flatMap(g=>g.items).find(x=>x[0]===p)?.[1] || p)}</span>`).join("")
        : '<span class="access-chip muted-chip">No operational permissions selected</span>';
    }

    document.querySelectorAll("[data-permission-preset]").forEach(card => {
      const id=card.dataset.permissionPreset;
      const wanted=presets[id] || [];
      const active = id==="admin"
        ? wildcardActive
        : !wildcardActive && wanted.length===checked.length && wanted.every(p=>checked.includes(p));
      card.classList.toggle("selected",active);
    });
  };

  const applyPermissions = perms => {
    wildcardActive = perms.includes("*");
    permissionInputs().forEach(input => input.checked = !wildcardActive && perms.includes(input.dataset.permission));
    updatePermissionSummary();
  };

  renderRoles();
  updatePermissionSummary();

  selector?.addEventListener("change", () => {
    closeModal();
    staffAccessModal(allUsers.find(u => u.id === selector.value));
  });

  department?.addEventListener("change", () => {
    const roles = rolesByDepartment[department.value] || ["employee"];
    roleSelect.innerHTML = roles.map(role => `<option value="${role}">${prettyRole(role)}</option>`).join("");
  });

  document.querySelectorAll("[data-permission-preset]").forEach(card => card.addEventListener("click", () => {
    applyPermissions(presets[card.dataset.permissionPreset] || []);
  }));

  permissionInputs().forEach(input => input.addEventListener("change", () => {
    wildcardActive = false;
    updatePermissionSummary();
  }));

  document.querySelector("#select-all-perms")?.addEventListener("click", () => {
    wildcardActive = false;
    permissionInputs().forEach(x => x.checked = true);
    updatePermissionSummary();
  });

  document.querySelector("#clear-all-perms")?.addEventListener("click", () => {
    wildcardActive = false;
    permissionInputs().forEach(x => x.checked = false);
    updatePermissionSummary();
  });

  document.querySelector("#remove-staff-access")?.addEventListener("click", async () => {
    if (!confirm(`Remove Sterling employee access from ${selected.displayName || selected.email || "this account"}? Their customer account will remain.`)) return;
    try {
      await updateUserAccess(selected.id,{
        isStaff:false, employeeId:"", department:"", role:"customer", status:"active", permissions:[]
      });
      await writeAudit(state.user,"staff.access_removed","user",selected.id,{});
      closeModal(); await refreshData(); setFlash("Employee access removed. The customer account remains active.");
    } catch(e) { setFlash(e.message || "Unable to remove employee access.","error"); }
  });

  document.querySelector("#save-staff")?.addEventListener("click", async () => {
    const uid = document.querySelector("#staffUser").value;
    const target = allUsers.find(u => u.id === uid);
    const employeeId = document.querySelector("#employeeId").value.trim();
    if (!employeeId) {
      setFlash("Please assign an employee ID before saving.", "error");
      return;
    }
    const perms = wildcardActive ? ["*"] : permissionInputs().filter(x => x.checked).map(x => x.dataset.permission);
    try {
      await updateUserAccess(uid,{
        isStaff:true,
        employeeId,
        department:department.value,
        role:roleSelect.value,
        status:document.querySelector("#staffStatus").value,
        permissions:perms
      });
      await writeAudit(state.user,"staff.access_updated","user",uid,{
        employeeId,
        department:department.value,
        role:roleSelect.value,
        permissionCount:wildcardActive ? "all" : perms.length
      });
      closeModal(); await refreshData(); setFlash(`Employee access updated for ${target?.displayName || target?.email || "employee"}.`);
    } catch(e) { setFlash(e.message || "Unable to update staff access.", "error"); }
  });
}

async function refreshData() {
  if (!state.user || !state.profile) return;
  try {
    const base = await listCollection("vehicles").catch(() => []);
    state.data.vehicles = base;
    if (state.profile.isStaff) {
      const [deals, customers, queue, users, testDrives, notifications, tradeIns, financeApplications, deliveries, serviceAppointments, repairOrders, parts, partRequests, vehicleAcquisitions, financeAppointments, financeCustomerProfiles] = await Promise.all([
        listCollection("deals").catch(() => []),
        listCollection("customers").catch(() => []),
        listCollection("queue").catch(() => []),
        listUsers().catch(() => []),
        listCollection("testDrives").catch(() => []),
        listCollection("notifications", 50).catch(() => []),
        listCollection("tradeIns").catch(() => []),
        listCollection("financeApplications").catch(() => []),
        listCollection("deliveries").catch(() => []),
        listCollection("serviceAppointments").catch(() => []),
        listCollection("repairOrders").catch(() => []),
        listCollection("parts").catch(() => []),
        listCollection("partRequests").catch(() => []),
        listCollection("vehicleAcquisitions").catch(() => []),
        listCollection("financeAppointments").catch(() => []),
        listCollection("financeCustomerProfiles").catch(() => [])
      ]);
      const tradeGroups=new Map();
      for(const trade of tradeIns){
        const key=trade.dealId || trade.id;
        if(!tradeGroups.has(key)) tradeGroups.set(key,[]);
        tradeGroups.get(key).push(trade);
      }
      const uniqueTrades=[...tradeGroups.values()].map(group=>group.sort((a,b)=>{
        const score=x =>
          (x.inventoryVehicleId ? 1000000000000 : 0) +
          (x.managerApprovalStatus==="approved" ? 100000000000 : 0) +
          (x.id===x.dealId ? 10000000000 : 0) +
          ((x.updatedAt?.seconds || x.createdAt?.seconds || 0));
        return score(b)-score(a);
      })[0]);
      const preferredTradeVehicles=new Map(uniqueTrades.filter(t=>t.inventoryVehicleId).map(t=>[t.id,t.inventoryVehicleId]));
      const uniqueVehicles=[];
      const seenTradeVehicles=new Set();
      for(const vehicle of state.data.vehicles){
        if(!vehicle.sourceTradeId){ uniqueVehicles.push(vehicle); continue; }
        const preferred=preferredTradeVehicles.get(vehicle.sourceTradeId);
        if(preferred && vehicle.id!==preferred) continue;
        if(seenTradeVehicles.has(vehicle.sourceTradeId)) continue;
        seenTradeVehicles.add(vehicle.sourceTradeId);
        uniqueVehicles.push(vehicle);
      }
      state.data.vehicles=uniqueVehicles;
      Object.assign(state.data, { deals, customers, queue, users, testDrives, notifications, tradeIns:uniqueTrades, financeApplications, deliveries, serviceAppointments, repairOrders, parts, partRequests, vehicleAcquisitions, financeAppointments, financeCustomerProfiles });
    } else {
      const [vehicleAcquisitions, financeAppointments] = await Promise.all([
        listVehicleAcquisitionsForUser(state.user.uid).catch(() => []),
        listFinanceAppointmentsForUser(state.user.uid).catch(() => [])
      ]);
      Object.assign(state.data,{ vehicleAcquisitions,financeAppointments,deals:[],customers:[],queue:[],users:[],testDrives:[],notifications:[],tradeIns:[],financeApplications:[],deliveries:[],serviceAppointments:[],repairOrders:[],parts:[],partRequests:[],financeCustomerProfiles:[] });
    }
  } catch (e) {
    console.warn("Data refresh:", e);
  }
}

function bindApp() {
  document.querySelectorAll("[data-page]").forEach(btn => btn.addEventListener("click", () => {
    state.page = btn.dataset.page; render();
  }));
  document.querySelector("#signout")?.addEventListener("click", () => signOut(auth));
  document.querySelector("#profile-menu")?.addEventListener("click", profileOverview);
  document.querySelector("#command-search")?.addEventListener("click", commandPalette);
  document.querySelector("#mobile-menu")?.addEventListener("click", () => document.querySelector(".sidebar")?.classList.toggle("open"));
  document.querySelector("#notifications-btn")?.addEventListener("click", notificationCenter);
  document.querySelectorAll("[data-vehicle]").forEach(btn => btn.addEventListener("click", (e) => {
    e.stopPropagation();
    vehicleDetailModal(state.data.vehicles.find(v => v.id === btn.dataset.vehicle));
  }));
  document.querySelectorAll("[data-push-floor]").forEach(btn => btn.addEventListener("click", (e) => {
    e.stopPropagation();
    pushTradeToSalesFloorModal(state.data.vehicles.find(v => v.id === btn.dataset.pushFloor));
  }));
  document.querySelectorAll("[data-deal]").forEach(row => row.addEventListener("click", () => dealDetailModal(state.data.deals.find(d => d.id === row.dataset.deal))));
  document.querySelectorAll("[data-staff]").forEach(btn => btn.addEventListener("click", () => staffAccessModal(state.data.users.find(u => u.id === btn.dataset.staff))));
  document.querySelectorAll("[data-customer]").forEach(btn => btn.addEventListener("click", (e) => {
    e.stopPropagation();
    customerDetailModal(state.data.customers.find(c => c.id === btn.dataset.customer));
  }));
  document.querySelectorAll("[data-checkout]").forEach(btn => btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const entry=state.data.queue.find(q=>q.id===btn.dataset.checkout);
    if(entry) checkoutCustomerModal(entry,resolveQueueCustomer(entry));
  }));
  document.querySelectorAll("[data-start-queue-deal]").forEach(btn => btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const entry = state.data.queue.find(q => q.id === btn.dataset.startQueueDeal);
    if (!entry) return;
    try {
      let customer = resolveQueueCustomer(entry);
      if (!customer) {
        const customerNumber = `SMC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
        const created = await createCustomer({
          name: entry.customerName || "Walk-In Customer",
          email: entry.customerEmail || "",
          phone: entry.customerPhone || "",
          customerNumber,
          source: "walk_in_conversion"
        }, state.user);
        await updateRecord("queue", entry.id, {
          customerId: created.id,
          status: "with_staff",
          convertedFromWalkIn: true,
          convertedBy: state.user.uid,
          convertedByName: state.profile?.displayName || state.user.email
        });
        await writeAudit(state.user, "customer.walk_in_converted", "customer", created.id, { queueEntryId:entry.id, customerNumber });
        await refreshData();
        customer = state.data.customers.find(x => x.id === created.id);
        setFlash(`${entry.customerName || "Walk-in"} is now a Sterling customer.`);
      } else if ((entry.status || "waiting") !== "with_staff") {
        await updateRecord("queue", entry.id, { status:"with_staff", assignedUid:state.user.uid, assignedName:state.profile?.displayName || state.user.email });
        await refreshData();
      }
      dealModal(customer?.id || entry.customerId || "");
    } catch (err) {
      setFlash(err.message || "Unable to convert this walk-in and start a deal.", "error");
    }
  }));
  document.querySelectorAll("[data-queue-deal]").forEach(btn => btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const deal = state.data.deals.find(d => d.id === btn.dataset.queueDeal);
    if (deal) dealDetailModal(deal);
  }));
  document.querySelectorAll("[data-finance-customer]").forEach(btn => btn.addEventListener("click", () => financeCustomerDetailModal(financeClientDirectory().find(c=>c.key===btn.dataset.financeCustomer))));
  document.querySelectorAll("[data-finance-customer-from-deal]").forEach(btn => btn.addEventListener("click", () => {
    const deal=state.data.deals.find(d=>d.id===btn.dataset.financeCustomerFromDeal);
    if(!deal)return;
    const client=financeClientDirectory().find(c=>c.customerId===deal.customerId || (!deal.customerId && String(c.name||"").toLowerCase()===String(deal.customerName||"").toLowerCase()));
    if(client) financeCustomerDetailModal(client);
  }));
  document.querySelector("#open-payment-lab")?.addEventListener("click",financePaymentLabPickerModal);
  document.querySelector("#finance-customer-search")?.addEventListener("input",e=>{
    const term=e.currentTarget.value.toLowerCase().trim();
    document.querySelectorAll("#finance-customer-rows tr").forEach(row=>row.style.display=(row.dataset.search||"").includes(term)?"":"none");
  });
  document.querySelectorAll("[data-finance-appointment]").forEach(btn => btn.addEventListener("click", () => manageFinanceAppointmentModal(state.data.financeAppointments.find(a=>a.id===btn.dataset.financeAppointment))));
  document.querySelectorAll("[data-cancel-finance-appointment]").forEach(btn => btn.addEventListener("click", () => cancelFinanceAppointmentModal(state.data.financeAppointments.find(a=>a.id===btn.dataset.cancelFinanceAppointment),false)));
  document.querySelectorAll("[data-finance-deal]").forEach(btn => btn.addEventListener("click", () => {
    const d=state.data.deals.find(x=>x.id===btn.dataset.financeDeal);
    if(!d) return;
    if((d.stage||"").toLowerCase()==="delivery") deliveryModal(d); else financeWorksheetModal(d);
  }));
  document.querySelectorAll("[data-ro]").forEach(btn => btn.addEventListener("click", () => repairOrderDetailModal(state.data.repairOrders.find(r=>r.id===btn.dataset.ro))));
  document.querySelectorAll("[data-trade-service-review]").forEach(btn => btn.addEventListener("click",()=>tradeInServiceReviewModal(state.data.tradeIns.find(t=>t.id===btn.dataset.tradeServiceReview))));
  document.querySelectorAll("[data-acquisition-service-review]").forEach(btn => btn.addEventListener("click",()=>acquisitionVehicleServiceReviewModal(state.data.vehicles.find(v=>v.id===btn.dataset.acquisitionServiceReview))));
  document.querySelectorAll("[data-checkin-appointment]").forEach(btn => btn.addEventListener("click", () => {
    const a=state.data.serviceAppointments.find(x=>x.id===btn.dataset.checkinAppointment);
    if(a) repairOrderModal({appointmentId:a.id,customerId:a.customerId,vehicleName:a.vehicleName,complaint:a.notes});
  }));
  document.querySelectorAll("[data-part]").forEach(btn => btn.addEventListener("click",()=>partDetailModal(state.data.parts.find(p=>p.id===btn.dataset.part))));
  document.querySelectorAll("[data-fulfill-part-request]").forEach(btn => btn.addEventListener("click",()=>fulfillPartRequest(state.data.partRequests.find(r=>r.id===btn.dataset.fulfillPartRequest))));
  document.querySelectorAll("[data-acquisition]").forEach(btn => btn.addEventListener("click",()=>acquisitionDetailModal(state.data.vehicleAcquisitions.find(a=>a.id===btn.dataset.acquisition))));
  document.querySelectorAll("[data-acquisition-accept]").forEach(btn => btn.addEventListener("click",async()=>{
    try{await updateRecord("vehicleAcquisitions",btn.dataset.acquisitionAccept,{status:"accepted"});await refreshData();setFlash("Offer accepted. Sterling will receive the vehicle next.");}
    catch(e){setFlash(e.message||"Unable to accept offer.","error");}
  }));
  document.querySelectorAll("[data-acquisition-decline]").forEach(btn => btn.addEventListener("click",async()=>{
    try{await updateRecord("vehicleAcquisitions",btn.dataset.acquisitionDecline,{status:"declined"});await refreshData();setFlash("Offer declined.");}
    catch(e){setFlash(e.message||"Unable to decline offer.","error");}
  }));
  document.querySelectorAll("[data-action]").forEach(btn => btn.addEventListener("click", () => {
    const a = btn.dataset.action;
    if (a === "new-vehicle") vehicleModal();
    if (a === "new-customer") customerModal();
    if (a === "new-deal") dealModal();
    if (a === "new-queue") queueModal();
    if (a === "manage-staff") staffAccessModal();
    if (a === "claim-bootstrap") bootstrapModal();
    if (a === "new-service-appointment") serviceAppointmentModal();
    if (a === "new-repair-order") repairOrderModal();
    if (a === "new-part") newPartModal();
    if (a === "new-acquisition") acquisitionSubmissionModal();
    if (a === "new-finance-appointment") financeAppointmentModal();
  }));
  document.querySelectorAll("[data-claim]").forEach(btn => btn.addEventListener("click", async () => {
    try {
      await updateRecord("queue", btn.dataset.claim, { status:"claimed", assignedUid:state.user.uid, assignedName:state.profile?.displayName || state.user.email });
      await refreshData(); setFlash("Customer claimed.");
    } catch (e) { setFlash(e.message, "error"); }
  }));
  document.querySelectorAll("[data-filter]").forEach(input => input.addEventListener("input", () => {
    const term = input.value.toLowerCase().trim();
    const scope = input.dataset.filter === "inventory" ? "#inventory-rows tr" : "#customer-grid [data-search]";
    document.querySelectorAll(scope).forEach(row => row.style.display = row.dataset.search?.includes(term) ? "" : "none");
  }));
}

function bindAuth() {
  let signup = false;
  const toggle = document.querySelector("#toggle-auth");
  toggle.addEventListener("click", () => {
    signup = !signup;
    document.querySelector("#name-field").classList.toggle("hidden", !signup);
    document.querySelector("#auth-title").textContent = signup ? "Create your Sterling account" : "Sign in to DRIVE";
    document.querySelector("#auth-copy").textContent = signup ? "Customer accounts can browse inventory and access future ownership features." : "Use your Sterling account to access the dealership.";
    document.querySelector(".auth-submit").innerHTML = signup ? `Create account ${icon("arrow-right")}` : `Sign in ${icon("arrow-right")}`;
    toggle.textContent = signup ? "Back to sign in" : "Create an account";
    hydrateIcons();
  });
  document.querySelector("#auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const error = document.querySelector("#auth-error");
    const email = document.querySelector("#email").value.trim();
    const password = document.querySelector("#password").value;
    const name = document.querySelector("#name").value.trim();
    error.textContent = "";
    try {
      if (signup) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name) await updateProfile(cred.user, { displayName:name });
        await createCustomerProfile(cred.user.uid, email, name);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      error.textContent = (err.message || "Authentication failed.").replace("Firebase: ", "");
    }
  });
}

function hydrateIcons() {
  createIcons({ icons });
}

function render() {
  if (state.loading) {
    app.innerHTML = `<div class="boot"><div class="brand-mark big">S</div><strong>STERLING DRIVE</strong><span class="loader"></span></div>`;
    hydrateIcons(); return;
  }
  if (!state.user) {
    app.innerHTML = authScreen();
    bindAuth(); hydrateIcons(); return;
  }
  app.innerHTML = shell(currentPage());
  bindApp();
  hydrateIcons();
}

onAuthStateChanged(auth, async (user) => {
  state.loading = true; state.user = user; render();
  if (user) {
    try {
      let profile = await getUserProfile(user.uid);
      if (!profile) profile = await createCustomerProfile(user.uid, user.email || "", user.displayName || "");
      state.profile = profile;
      state.bootstrap = await getBootstrapStatus().catch(() => ({ initialized: true }));
      await refreshData();
    } catch (e) {
      console.error(e);
      state.profile = { displayName:user.displayName || user.email, role:"customer", isStaff:false, permissions:[] };
    }
  } else {
    state.profile = null;
    state.bootstrap = null;
    state.data = { vehicles: [], deals: [], customers: [], queue: [], users: [], testDrives: [], notifications: [], tradeIns: [], financeApplications: [], deliveries: [], serviceAppointments: [], repairOrders: [], parts: [], partRequests: [], vehicleAcquisitions: [], financeAppointments: [], financeCustomerProfiles: [] };
  }
  state.loading = false;
  state.page = "dashboard";
  render();
});

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (state.user && !document.querySelector("#command-input")) commandPalette();
  }
  if (e.key === "Escape" && document.querySelector("#modal-root")) closeModal();
});

render();
