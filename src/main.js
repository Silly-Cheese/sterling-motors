import "./styles.css";
import { createIcons, icons } from "lucide";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "firebase/auth";
import { auth } from "./firebase";
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
  writeAudit
} from "./services";

const app = document.querySelector("#app");

const state = {
  user: null,
  profile: null,
  page: "dashboard",
  data: { vehicles: [], deals: [], customers: [], queue: [], users: [] },
  loading: true,
  flash: null
};

const nav = [
  ["dashboard", "layout-dashboard", "Command Center"],
  ["sales", "badge-dollar-sign", "Sales"],
  ["inventory", "car-front", "Inventory"],
  ["customers", "users", "Customers"],
  ["queue", "list-checks", "Reception Queue"],
  ["finance", "landmark", "Finance"],
  ["service", "wrench", "Service"],
  ["parts", "package-search", "Parts"],
  ["staff", "id-card", "Staff"],
  ["audit", "shield-check", "Audit"]
];

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
  return can("admin.full") || can("staff.manage") || can("deals.manage");
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
        <div class="brand-sub">MOTOR GROUP</div>

        <nav class="nav">
          ${nav.map(([id, ico, label]) => {
            const blocked = !staff && !["dashboard", "inventory"].includes(id);
            return `<button class="nav-item ${state.page === id ? "active" : ""} ${blocked ? "locked" : ""}" data-page="${id}" ${blocked ? "disabled" : ""}>
              ${icon(ico)}<span>${label}</span>${blocked ? icon("lock-keyhole", "nav-lock") : ""}
            </button>`;
          }).join("")}
        </nav>

        <div class="sidebar-footer">
          <div class="system-status"><span class="online-dot"></span><div><strong>Systems Operational</strong><small>Firebase connected</small></div></div>
          <button class="profile-chip" id="profile-menu">
            <span class="avatar">${initials(profileName)}</span>
            <span><strong>${safe(profileName)}</strong><small>${safe(role.replaceAll("_", " "))}</small></span>
            ${icon("chevron-up")}
          </button>
          <button class="signout" id="signout">${icon("log-out")} Sign out</button>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <button id="mobile-menu" class="icon-btn mobile-only">${icon("menu")}</button>
          <div class="breadcrumb"><span>Sterling Motors</span><b>/</b><strong>${safe(pageTitle())}</strong></div>
          <div class="top-actions">
            <div class="global-search">${icon("search")}<input id="global-search" placeholder="Search DRIVE..." /></div>
            <button class="icon-btn notification-btn">${icon("bell")}<span class="notification-dot"></span></button>
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

  return `
    <div class="hero-row">
      <div>
        <span class="eyebrow">STERLING DRIVE / LIVE OPERATIONS</span>
        <h1>Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${safe((state.profile?.displayName || "team").split(" ")[0])}.</h1>
        <p>Here’s what’s happening across Sterling Motors right now.</p>
      </div>
      <div class="hero-actions">
        ${can("sales.manage") ? `<button class="btn secondary" data-action="new-customer">${icon("user-plus")} New Customer</button>` : ""}
        ${can("inventory.manage") ? `<button class="btn primary" data-action="new-vehicle">${icon("plus")} Add Vehicle</button>` : ""}
      </div>
    </div>

    <div class="metric-grid">
      ${metric("Vehicles Available", available, "car-front", "Inventory ready for sale")}
      ${metric("Active Deals", activeDeals, "handshake", "Across the sales floor")}
      ${metric("Waiting Customers", waiting, "clock-3", waiting ? "Needs attention" : "No current wait")}
      ${metric("Closed Revenue", money(revenue), "circle-dollar-sign", "Completed deals")}
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
    <td><button class="icon-btn">${icon("more-horizontal")}</button></td>
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
        <tbody>${deals.map(d => `<tr>
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
    ${pageHeader("STERLING MOTOR GROUP", "Staff Directory", "Employee identity, department, status, and access across Sterling DRIVE.")}
    <div class="staff-grid">
      ${users.length ? users.map(u => `<article class="staff-card">
        <div class="staff-band"></div>
        <span class="avatar xl">${initials(u.displayName)}</span>
        <h3>${safe(u.displayName || u.email)}</h3>
        <p>${safe(u.role || "Employee")}</p>
        <div class="staff-details"><span>${icon("building-2")} ${safe(u.department || "Sterling Motors")}</span><span>${icon("badge-check")} ${safe(u.employeeId || "ID pending")}</span></div>
        ${statusPill(u.status || "active")}
      </article>`).join("") : emptyState("id-card", "No staff profiles found", "Staff accounts will appear here after an administrator provisions them.")}
    </div>
  `;
}

function futureModule(type) {
  const copy = {
    finance:["landmark","DRIVE Finance","Finance queue, simulated lending, F&I products, contract generation, and deal finalization are next in the platform build."],
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
    case "finance":
    case "service":
    case "parts":
    case "audit": return futureModule(state.page);
    default: return dashboard();
  }
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

async function refreshData() {
  if (!state.user || !state.profile) return;
  try {
    const base = await listCollection("vehicles").catch(() => []);
    state.data.vehicles = base;
    if (state.profile.isStaff) {
      const [deals, customers, queue, users] = await Promise.all([
        listCollection("deals").catch(() => []),
        listCollection("customers").catch(() => []),
        listCollection("queue").catch(() => []),
        listUsers().catch(() => [])
      ]);
      Object.assign(state.data, { deals, customers, queue, users });
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
  document.querySelector("#mobile-menu")?.addEventListener("click", () => document.querySelector(".sidebar")?.classList.toggle("open"));
  document.querySelectorAll("[data-action]").forEach(btn => btn.addEventListener("click", () => {
    const a = btn.dataset.action;
    if (a === "new-vehicle") vehicleModal();
    if (a === "new-customer") customerModal();
    if (a === "new-deal") dealModal();
    if (a === "new-queue") queueModal();
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
      await refreshData();
    } catch (e) {
      console.error(e);
      state.profile = { displayName:user.displayName || user.email, role:"customer", isStaff:false, permissions:[] };
    }
  } else {
    state.profile = null;
    state.data = { vehicles: [], deals: [], customers: [], queue: [], users: [] };
  }
  state.loading = false;
  state.page = "dashboard";
  render();
});

render();
