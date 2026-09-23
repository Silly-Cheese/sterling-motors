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
  createDelivery
} from "./services.js";

const app = document.querySelector("#app");

const state = {
  user: null,
  profile: null,
  page: "dashboard",
  data: { vehicles: [], deals: [], customers: [], queue: [], users: [], testDrives: [], notifications: [], tradeIns: [], financeApplications: [], deliveries: [] },
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
      ["finance","landmark","Finance"]
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
              const blocked = !staff && !["dashboard", "inventory"].includes(id);
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
    finance:"F&I, payments, and delivery",
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
    <td><button class="icon-btn" data-vehicle="${v.id}" title="Open vehicle record">${icon("arrow-up-right")}</button></td>
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
        <div class="customer-footer"><small>Customer since ${fmtDate(c.createdAt)}</small><button class="text-btn">Open profile ${icon("arrow-up-right")}</button></div>
      </article>`).join("") : emptyState("users", "No customer profiles yet", "Create a customer profile to begin their Sterling history.", can("sales.manage") ? `<button class="btn primary" data-action="new-customer">Create Customer</button>` : "")}
    </div>
  `;
}

function queuePage() {
  const queue = state.data.queue;
  return `
    ${pageHeader("FRONT OF HOUSE", "Reception Queue", "Check customers in, route visits, and keep the showroom moving.",
      can("queue.manage") || can("sales.manage") ? `<button class="btn primary" data-action="new-queue">${icon("plus")} Check In Guest</button>` : "")}
    <div class="queue-board">
      ${["waiting","claimed","with staff","complete"].map(status => {
        const items = queue.filter(q => (q.status || "waiting").replaceAll("_"," ").toLowerCase() === status);
        return `<section class="queue-column"><div class="queue-column-head"><span>${status}</span><b>${items.length}</b></div>
          <div class="queue-stack">${items.length ? items.map(q => `<article class="queue-ticket-card">
            <div><span class="queue-ticket">${safe(q.ticket || "GUEST")}</span>${statusPill(q.status || "waiting")}</div>
            <h3>${safe(q.customerName || "Guest")}</h3>
            <p>${safe(q.reason || "Dealership visit")}</p>
            <small>${fmtDate(q.createdAt)}</small>
            ${status === "waiting" && can("queue.manage") ? `<button class="btn secondary small" data-claim="${q.id}">Claim Customer</button>` : ""}
          </article>`).join("") : `<div class="column-empty">No customers</div>`}</div>
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

function financePage() {
  const financeDeals = state.data.deals.filter(d => ["finance","documents","delivery"].includes((d.stage || "").toLowerCase()));
  const approved = state.data.financeApplications.filter(x => ["approved","finalized"].includes((x.status || "").toLowerCase())).length;
  const deliveries = state.data.deliveries.filter(x => (x.status || "").toLowerCase() !== "complete").length;
  const financed = state.data.financeApplications.reduce((sum,x) => sum + Number(x.amountFinanced || 0), 0);

  return `
    ${pageHeader("F&I OPERATIONS", "DRIVE Finance", "Build RP financing packages, protection products, contracts, and final vehicle delivery.")}
    <div class="metric-grid">
      ${metric("Finance Queue", financeDeals.length, "landmark", "Deals requiring F&I")}
      ${metric("Approved Packages", approved, "badge-check", "Saved finance packages")}
      ${metric("Amount Financed", money(financed), "circle-dollar-sign", "Fictional RP financing")}
      ${metric("Delivery Queue", deliveries, "key-round", "Vehicles awaiting handoff")}
    </div>
    <div class="panel no-pad">
      ${financeDeals.length ? `<div class="table-wrap"><table class="data-table">
        <thead><tr><th>Deal</th><th>Customer</th><th>Vehicle</th><th>Stage</th><th>Trade</th><th>Finance</th><th>Payment</th><th></th></tr></thead>
        <tbody>${financeDeals.map(d => {
          const trade=state.data.tradeIns.find(t=>t.dealId===d.id);
          const fin=state.data.financeApplications.find(x=>x.dealId===d.id);
          return `<tr>
            <td><strong>${safe(d.dealNumber || d.id.slice(0,8).toUpperCase())}</strong></td>
            <td>${safe(d.customerName || "—")}</td>
            <td>${safe(d.vehicleName || "—")}</td>
            <td>${statusPill(d.stage || "finance")}</td>
            <td>${trade ? money(trade.allowance) : "None"}</td>
            <td>${fin ? statusPill(fin.status || "draft") : '<span class="muted-inline">Not started</span>'}</td>
            <td><strong>${fin ? money(fin.monthlyPayment) + "/mo" : "—"}</strong></td>
            <td>${d.stage==="delivery"
              ? ((can("finance.manage") || can("sales.manage")) ? `<button class="btn secondary small" data-finance-deal="${d.id}">${icon("key-round")} Delivery</button>` : '<span class="muted-inline">View only</span>')
              : (can("finance.manage") ? `<button class="btn secondary small" data-finance-deal="${d.id}">${icon("calculator")} Open F&I</button>` : '<span class="muted-inline">View only</span>')}</td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>` : emptyState("landmark", "Finance queue is clear", "Approved sales deals will arrive here automatically.")}
    </div>
    <div class="rp-disclaimer">${icon("info")} Sterling financing data is fictional and intended only for roleplay. Do not enter real SSNs, credit reports, banking credentials, or other sensitive financial information.</div>
  `;
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
    const data={
      dealId:d.id,dealNumber:d.dealNumber || "",customerId:d.customerId || "",customerName:d.customerName || "",
      year:Number(document.querySelector("#tradeYear").value),make:document.querySelector("#tradeMake").value.trim(),model:document.querySelector("#tradeModel").value.trim(),
      vin:document.querySelector("#tradeVin").value.trim(),mileage:Number(document.querySelector("#tradeMileage").value),
      exterior:document.querySelector("#tradeExterior").value,interior:document.querySelector("#tradeInterior").value,mechanical:document.querySelector("#tradeMechanical").value,
      acv:Number(document.querySelector("#tradeAcv").value),allowance:Number(document.querySelector("#tradeAllowance").value),
      notes:document.querySelector("#tradeNotes").value.trim(),status:"accepted"
    };
    try {
      let id=existing?.id;
      if(existing) await updateRecord("tradeIns",existing.id,data);
      else { const res=await createTradeIn(data,state.user); id=res.id; }
      await updateRecord("deals",d.id,{tradeInId:id,tradeAllowance:data.allowance});
      await writeAudit(state.user,"trade.appraised","tradeIn",id,{dealId:d.id,acv:data.acv,allowance:data.allowance});
      closeModal(); await refreshData(); setFlash("Trade-in appraisal saved.");
    } catch(e){setFlash(e.message || "Unable to save appraisal.","error");}
  });
}

function monthlyPayment(principal, apr, months) {
  const p=Math.max(0,Number(principal)||0), n=Math.max(1,Number(months)||1), annual=Number(apr)||0;
  if(annual<=0) return p/n;
  const r=annual/100/12;
  return p*r/(1-Math.pow(1+r,-n));
}

function financeWorksheetModal(d) {
  const trade=state.data.tradeIns.find(t=>t.dealId===d.id);
  const existing=state.data.financeApplications.find(x=>x.dealId===d.id);
  const sale=Number(d.counterPrice || d.finalPrice || d.price || 0);
  const products=[
    ["extended_warranty","Extended Warranty",2495],
    ["gap","GAP Coverage",995],
    ["maintenance","Maintenance Plan",1495],
    ["tire_wheel","Tire & Wheel Protection",895]
  ];
  const selected=new Set(existing?.products || []);
  modal("Finance Worksheet", `
    <div class="finance-hero"><div><span class="eyebrow">DEAL ${safe(d.dealNumber || "")}</span><h3>${safe(d.customerName || "Customer")}</h3><p>${safe(d.vehicleName || "Vehicle")}</p></div><div><span>Sale Price</span><strong>${money(sale)}</strong></div></div>
    <form id="finance-form" class="form-grid">
      <div class="field"><label>RP Credit Tier</label><select class="plain-input" id="creditTier"><option>Tier 1</option><option>Tier 2</option><option>Tier 3</option><option>Tier 4</option></select></div>
      ${formField("Down Payment","downPayment",String(existing?.downPayment || 0),"number","required min='0'")}
      <div class="field"><label>Trade Allowance</label><input class="plain-input" id="financeTrade" type="number" value="${Number(existing?.tradeAllowance ?? trade?.allowance ?? d.tradeAllowance ?? 0)}" readonly></div>
      ${formField("APR","apr",String(existing?.apr || 6.49),"number","required min='0' step='0.01'")}
      <div class="field"><label>Term</label><select class="plain-input" id="termMonths">${[36,48,60,72,84].map(n=>`<option value="${n}" ${Number(existing?.termMonths||72)===n?"selected":""}>${n} months</option>`).join("")}</select></div>
      <div class="field full"><label>F&I Products</label><div class="product-options">${products.map(([id,label,price])=>`<label><input type="checkbox" data-finance-product="${id}" data-price="${price}" ${selected.has(id)?"checked":""}><span><strong>${label}</strong><small>${money(price)}</small></span></label>`).join("")}</div></div>
    </form>
    <div class="finance-summary">
      <div><span>Products</span><strong id="sumProducts">$0</strong></div>
      <div><span>Amount Financed</span><strong id="sumPrincipal">$0</strong></div>
      <div class="payment-total"><span>Estimated Payment</span><strong id="sumPayment">$0/mo</strong></div>
    </div>
    <div class="rp-disclaimer compact">${icon("shield-check")} RP-only finance calculator. Never enter real credit or banking information.</div>
  `, `<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-finance">${icon("file-check-2")} Finalize Finance Package</button>`);

  const calculate=()=>{
    const productTotal=[...document.querySelectorAll("[data-finance-product]:checked")].reduce((s,x)=>s+Number(x.dataset.price||0),0);
    const down=Number(document.querySelector("#downPayment").value||0), allowance=Number(document.querySelector("#financeTrade").value||0);
    const principal=Math.max(0,sale-down-allowance+productTotal);
    const apr=Number(document.querySelector("#apr").value||0), term=Number(document.querySelector("#termMonths").value||72);
    const payment=monthlyPayment(principal,apr,term);
    document.querySelector("#sumProducts").textContent=money(productTotal);
    document.querySelector("#sumPrincipal").textContent=money(principal);
    document.querySelector("#sumPayment").textContent=money(payment)+"/mo";
    return {productTotal,down,allowance,principal,apr,term,payment};
  };
  document.querySelectorAll("#finance-form input,#finance-form select").forEach(x=>x.addEventListener("input",calculate));
  calculate();

  document.querySelector("#save-finance")?.addEventListener("click",async()=>{
    const form=document.querySelector("#finance-form"); if(!form.reportValidity()) return;
    const x=calculate();
    const productsSelected=[...document.querySelectorAll("[data-finance-product]:checked")].map(el=>el.dataset.financeProduct);
    const data={
      dealId:d.id,dealNumber:d.dealNumber || "",customerId:d.customerId || "",customerName:d.customerName || "",vehicleId:d.vehicleId,vehicleName:d.vehicleName || "",
      salePrice:sale,creditTier:document.querySelector("#creditTier").value,downPayment:x.down,tradeAllowance:x.allowance,products:productsSelected,productTotal:x.productTotal,
      amountFinanced:x.principal,apr:x.apr,termMonths:x.term,monthlyPayment:Number(x.payment.toFixed(2)),status:"approved"
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
    try{
      await updateRecord("deliveries",delivery.id,{status:"complete",completedBy:state.user.uid,completedByName:state.profile?.displayName || state.user.email,checklistComplete:true});
      await updateRecord("deals",d.id,{stage:"complete",deliveryStatus:"complete"});
      await updateRecord("vehicles",d.vehicleId,{status:"sold",ownerCustomerId:d.customerId || "",ownerCustomerName:d.customerName || ""});
      if(trade && trade.status!=="received"){
        await updateRecord("tradeIns",trade.id,{status:"received"});
        await createVehicle({
          year:trade.year,make:trade.make,model:trade.model,vin:trade.vin,mileage:trade.mileage,
          stockNumber:`TRD-${(d.dealNumber || d.id).replace(/[^A-Za-z0-9]/g,"").slice(-8)}`,
          trim:"Trade-In",color:"Pending Inspection",msrp:trade.acv,price:trade.acv,status:"trade_in",sourceTradeId:trade.id
        },state.user);
      }
      await createNotification({type:"delivery",title:"Vehicle delivered",message:`${d.vehicleName || "Vehicle"} was delivered to ${d.customerName || "the customer"}.`,dealId:d.id},state.user);
      await writeAudit(state.user,"delivery.completed","delivery",delivery.id,{dealId:d.id,vehicleId:d.vehicleId});
      closeModal();await refreshData();setFlash("Delivery complete. Vehicle ownership and inventory updated.");
    }catch(e){setFlash(e.message || "Unable to complete delivery.","error");}
  });
}

function futureModule(type) {
  const copy = {
    service:["wrench","DRIVE Service","Repair orders, technician assignment, approvals, inspections, and permanent vehicle service history will live here."],
    parts:["package-search","DRIVE Parts","Parts inventory, technician requests, ordering, bin locations, and backorders will be managed here."],
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
    case "finance": return financePage();
    case "service":
    case "parts":
    case "audit": return futureModule(state.page);
    default: return dashboard();
  }
}


function commandPalette() {
  const commands = [
    ...nav.map(([id, ico, label]) => ({
      id:"page-"+id, icon:ico, label, description:pageSubtitleFor(id), type:"Navigate", run:()=>{ state.page=id; closeModal(); render(); }
    })),
    ...(can("sales.manage") ? [
      {id:"new-customer",icon:"user-plus",label:"Create Customer",description:"Add a new customer profile",type:"Action",run:()=>{closeModal();customerModal();}},
      {id:"new-deal",icon:"handshake",label:"Start Deal Jacket",description:"Open a new vehicle deal",type:"Action",run:()=>{closeModal();dealModal();}},
      {id:"new-queue",icon:"concierge-bell",label:"Check In Guest",description:"Add a guest to Reception",type:"Action",run:()=>{closeModal();queueModal();}}
    ] : []),
    ...(can("inventory.manage") ? [
      {id:"new-vehicle",icon:"car-front",label:"Add Vehicle",description:"Add a vehicle to Sterling inventory",type:"Action",run:()=>{closeModal();vehicleModal();}}
    ] : [])
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

function dealModal() {
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
      await writeAudit(state.user, "deal.created", "deal", result.id, { dealNumber:data.dealNumber });
      closeModal(); await refreshData(); setFlash("Deal Jacket opened.");
    } catch (e) { setFlash(e.message || "Unable to open deal.", "error"); }
  });
}

function queueModal() {
  modal("Check In Guest", `<form id="queue-form" class="form-grid">
    ${formField("Guest Name","guestName","Taylor Morgan","text","required")}
    ${formField("Ticket","ticket","A001")}
    <div class="field full"><label>Reason for visit</label><select class="plain-input" id="reason">
      <option>Vehicle Purchase</option><option>Browsing</option><option>Trade-In</option><option>Service</option><option>Parts</option><option>Finance</option><option>Appointment</option><option>Vehicle Pickup</option>
    </select></div>
  </form>`, `<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-queue">${icon("concierge-bell")} Check In</button>`);
  document.querySelector("#save-queue").addEventListener("click", async () => {
    const form = document.querySelector("#queue-form"); if (!form.reportValidity()) return;
    const data = { customerName:document.querySelector("#guestName").value,ticket:document.querySelector("#ticket").value,reason:document.querySelector("#reason").value };
    try {
      const result = await createQueueEntry(data, state.user);
      await writeAudit(state.user, "queue.created", "queue", result.id, data);
      closeModal(); await refreshData(); setFlash("Guest checked into reception.");
    } catch (e) { setFlash(e.message || "Unable to check in guest.", "error"); }
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
    ${activeDrive ? `<div class="alert-card">${icon("navigation")} <div><strong>Vehicle is currently on a test drive</strong><span>${safe(activeDrive.customerName || "Customer")} • ${safe(activeDrive.startedByName || "Sterling Staff")}</span></div>${can("sales.manage") ? `<button class="btn primary small" data-return-drive="${activeDrive.id}">Return Vehicle</button>` : ""}</div>` : ""}
  `);
  document.querySelector("#copy-scan")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(scanCode); setFlash("Vehicle scan ID copied."); } catch { setFlash(scanCode); }
  });
  document.querySelector("[data-return-drive]")?.addEventListener("click", () => completeTestDriveModal(activeDrive));
}

function dealDetailModal(d) {
  if (!d) return;
  const vehicle = state.data.vehicles.find(v => v.id === d.vehicleId);
  const activeDrive = state.data.testDrives.find(t => t.dealId === d.id && t.status === "active");
  const managerReview = (d.stage || "").replaceAll("_"," ").toLowerCase() === "manager review";
  const trade = state.data.tradeIns.find(t => t.dealId === d.id);
  const finance = state.data.financeApplications.find(x => x.dealId === d.id);
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
    ${d.managerNote ? `<div class="manager-note"><span>Manager Note</span><p>${safe(d.managerNote)}</p></div>` : ""}
    ${activeDrive ? `<div class="alert-card">${icon("navigation")}<div><strong>Test drive active</strong><span>${safe(activeDrive.customerName || d.customerName)} • Start mileage ${Number(activeDrive.startMileage || 0).toLocaleString()}</span></div><button class="btn primary small" data-return-drive="${activeDrive.id}">Check In</button></div>` : ""}
    <div class="workflow-actions">
      ${can("sales.manage") && !activeDrive && vehicle && ["shopping","negotiation"].includes((d.stage || "shopping").toLowerCase()) ? `<button class="btn secondary" id="start-test-drive">${icon("key-round")} Start Test Drive</button>` : ""}
      ${can("sales.manage") && !["delivery","complete"].includes((d.stage || "").toLowerCase()) ? `<button class="btn secondary" id="trade-in">${icon("car")} ${trade ? "Edit Trade" : "Appraise Trade"}</button>` : ""}
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
      await updateRecord("deals", d.id, { stage:"manager_review", approvalStatus:"pending" });
      await createNotification({ type:"approval", title:"Deal approval required", message:`${d.salespersonName || "Sales"} submitted ${d.dealNumber || "a deal"} for ${d.customerName || "a customer"}.`, dealId:d.id }, state.user);
      await writeAudit(state.user, "deal.sent_to_desk", "deal", d.id, { dealNumber:d.dealNumber });
      closeModal(); await refreshData(); setFlash("Deal sent to the desk for manager review.");
    } catch (e) { setFlash(e.message || "Unable to submit deal.", "error"); }
  });
  document.querySelector("#approve-deal")?.addEventListener("click", async () => {
    try {
      await updateRecord("deals", d.id, { stage:"finance", approvalStatus:"approved", approvedBy:state.user.uid, approvedByName:state.profile?.displayName || state.user.email });
      await createNotification({ type:"approval", title:"Deal approved", message:`${d.dealNumber || "Deal"} was approved and sent to Finance.`, dealId:d.id }, state.user);
      await writeAudit(state.user, "deal.approved", "deal", d.id, { dealNumber:d.dealNumber });
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
  modal("Counter Deal", `<form id="counter-form" class="form-grid">
    ${formField("Counter Price","counterPrice",String(d.counterPrice || d.price || 0),"number","required")}
    <div class="field full"><label>Manager Note</label><textarea class="plain-input textarea" id="managerNote" placeholder="Explain the counter or required changes..." required></textarea></div>
  </form>`, `<button class="btn secondary" data-close-modal>Cancel</button><button class="btn primary" id="save-counter">${icon("send")} Send Counter</button>`);
  document.querySelector("#save-counter")?.addEventListener("click", async () => {
    const form=document.querySelector("#counter-form"); if(!form.reportValidity()) return;
    const counterPrice=Number(document.querySelector("#counterPrice").value || 0);
    const managerNote=document.querySelector("#managerNote").value.trim();
    try {
      await updateRecord("deals", d.id, { stage:"negotiation", approvalStatus:"countered", counterPrice, managerNote, counteredBy:state.user.uid });
      await createNotification({ type:"approval", title:"Manager counter received", message:`${d.dealNumber || "Deal"} was countered at ${money(counterPrice)}.`, dealId:d.id }, state.user);
      await writeAudit(state.user, "deal.countered", "deal", d.id, { counterPrice });
      closeModal(); await refreshData(); setFlash("Counter sent back to Sales.");
    } catch(e) { setFlash(e.message || "Unable to counter deal.", "error"); }
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
    sales_manager:["sales.manage","customers.manage","deals.manage","deals.approve","queue.manage","inventory.manage"],
    inventory:["inventory.manage"],
    reception:["queue.manage","customers.manage"],
    finance:["finance.manage"],
    service:["service.manage","customers.manage"],
    parts:["parts.manage","inventory.manage"],
    staff_manager:["staff.manage","audit.view"],
    admin:["*"]
  };

  const presetMeta = [
    ["sales","Sales Staff","Sales, customers, deals, and reception"],
    ["sales_manager","Sales Manager","Sales plus desk approval and inventory"],
    ["inventory","Inventory","Vehicle inventory only"],
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
      const [deals, customers, queue, users, testDrives, notifications, tradeIns, financeApplications, deliveries] = await Promise.all([
        listCollection("deals").catch(() => []),
        listCollection("customers").catch(() => []),
        listCollection("queue").catch(() => []),
        listUsers().catch(() => []),
        listCollection("testDrives").catch(() => []),
        listCollection("notifications", 50).catch(() => []),
        listCollection("tradeIns").catch(() => []),
        listCollection("financeApplications").catch(() => []),
        listCollection("deliveries").catch(() => [])
      ]);
      Object.assign(state.data, { deals, customers, queue, users, testDrives, notifications, tradeIns, financeApplications, deliveries });
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
  document.querySelectorAll("[data-deal]").forEach(row => row.addEventListener("click", () => dealDetailModal(state.data.deals.find(d => d.id === row.dataset.deal))));
  document.querySelectorAll("[data-staff]").forEach(btn => btn.addEventListener("click", () => staffAccessModal(state.data.users.find(u => u.id === btn.dataset.staff))));
  document.querySelectorAll("[data-finance-deal]").forEach(btn => btn.addEventListener("click", () => {
    const d=state.data.deals.find(x=>x.id===btn.dataset.financeDeal);
    if(!d) return;
    if((d.stage||"").toLowerCase()==="delivery") deliveryModal(d); else financeWorksheetModal(d);
  }));
  document.querySelectorAll("[data-action]").forEach(btn => btn.addEventListener("click", () => {
    const a = btn.dataset.action;
    if (a === "new-vehicle") vehicleModal();
    if (a === "new-customer") customerModal();
    if (a === "new-deal") dealModal();
    if (a === "new-queue") queueModal();
    if (a === "manage-staff") staffAccessModal();
    if (a === "claim-bootstrap") bootstrapModal();
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
    state.data = { vehicles: [], deals: [], customers: [], queue: [], users: [], testDrives: [], notifications: [], tradeIns: [], financeApplications: [], deliveries: [] };
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
