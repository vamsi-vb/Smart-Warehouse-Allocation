# Smart Warehouse Allocation (SWA)

An enterprise supply chain and fulfillment management platform built with the **SAP Cloud Application Programming Model (CAP)** and **SAP Fiori Elements**. SWA automates order routing using geospatial proximity (Haversine formula), coordinates inter-warehouse stock rebalancing, handles threshold-based restocking, and provides an interactive Fiori frontend with real-time metrics.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Backend** | SAP CAP (`@sap/cds` v10, Node.js) |
| **OData Gateway** | `@cap-js-community/odata-v2-adapter` |
| **Database** | SAP HANA Cloud (Production) / SQLite (Local Dev) |
| **Security** | SAP BTP XSUAA (`@sap/xssec`, `passport`) |
| **Frontend** | SAP Fiori Elements (V2), UI5 Tooling (`@ui5/cli`) |
| **Testing** | Playwright (`@playwright/test`) |
| **Deployment** | Cloud MTA Build Tool (`mbt`), Cloud Foundry CLI (`cf`) |

---

## Data Model

Defined in [`db/schema.cds`](db/schema.cds) under namespace `swa`:

| Entity | Description | Key Attributes |
| :--- | :--- | :--- |
| **`SalesOrders`** | Customer sales orders | `OrderNumber`, `CustomerName`, `CustomerEmail`, `CustomerLatitude`, `CustomerLongitude`, Composition of `Items` |
| **`Items`** | Line items per order | `ProductId`, `ProductName`, `quantity`, `UnitPrice`, `AllocatedWarehouse` |
| **`Warehouses`** | Fulfillment hubs | `WarehouseName`, `Latitude`, `Longitude`, `status` (`Active` / `Inactive`), Composition of `Inventory` |
| **`WarehouseInventory`** | Facility stock levels | `ProductId`, `StockQuantity`, `numberOfTimesRestocked`, Association to `warehouse` |
| **`AccountingBooks`** | Inter-facility transfer ledger | `RequestingWarehouse`, `SupplyingWarehouse`, `ProductId`, `quantity`, `SalesOrder` |

---

## Core Business Logic

All fulfillment rules and event handlers reside in [`srv/cat-service.js`](srv/cat-service.js):

- **Geospatial Fulfillment (Haversine Formula)**:
  On order creation, customer coordinates (`CustomerLatitude`, `CustomerLongitude`) are compared against all active warehouses. The system selects the facility that fulfills the maximum number of items while minimizing transport distance.
- **Inter-Warehouse Stock Rebalancing**:
  If the primary warehouse cannot fulfill all line items, the engine queries alternative active warehouses for remaining stock, transfers the needed quantities, and logs an audit record in `AccountingBooks`. Orders are rejected if global stock is insufficient.
- **Automated Replenishment**:
  When stock for a product falls below **5 units** upon fulfillment, the system triggers an automatic restock (+10 units) and increments `numberOfTimesRestocked`.
- **Analytics & Actions**:
  - `getTopPerformingWarehouse`: Scores warehouses by demand velocity ($\text{Revenue} \times [1 + \text{Restocks}]$).
  - `getDistanceForItem`: Calculates line-item distance between customer and assigned warehouse.
  - `getBestWarehouseForOrder`: Re-evaluates and applies the optimal warehouse allocation to an order.

---

## Frontend Application

The UI in [`app/v2wa/`](app/v2wa/) is an SAP Fiori Elements List Report and Object Page application featuring:

- **Quick Variant Tabs**: One-click switching between **Sales Orders**, **All Warehouses**, and **Active Warehouses**.
- **Create Order Dialog**: Custom extension dialog (`CreateSalesOrderDialog.fragment.xml`) with dynamic multi-item entry and product validation.
- **Order Metrics Dashboard**: Custom Object Page section (`CustomSection.fragment.xml`) showing total quantity, item count, average quantity, and a **"Best Warehouse For Items"** allocation button.
- **Semantic Badges**: Color-coded indicators for allocated vs. unallocated item tracking.

---

## Security & Roles

Configured in [`xs-security.json`](xs-security.json) and enforced at the service level:

| Role | Permissions |
| :--- | :--- |
| **`admin`** | Unrestricted read and write access across all entities |
| **`user`** | Scoped access — can only view and manage orders where `createdBy = $user` |

---

## Project Structure

```text
wa/
├── app/
│   └── v2wa/                 # SAP Fiori Elements UI application
│       ├── webapp/
│       │   ├── annotations/  # UI annotations (annotations.xml)
│       │   ├── ext/          # Controller extensions & custom fragments
│       │   └── manifest.json # Fiori application descriptor
│       └── package.json
├── db/
│   ├── data/                 # Seed CSV datasets
│   └── schema.cds            # Domain entities
├── srv/
│   ├── cat-service.cds       # Service definition & UI annotations
│   └── cat-service.js        # Fulfillment logic & handlers
├── mta.yaml                  # MTA deployment descriptor
├── package.json              # CAP configuration & dependencies
├── playwright.config.js      # E2E test configuration
└── xs-security.json          # XSUAA security configuration
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ or v20+)
- [SAP CDS DK](https://cap.cloud.sap/docs/get-started/): `npm install -g @sap/cds-dk`

### Setup & Local Run

1. **Install dependencies**:

   ```bash
   npm install
   cd app/v2wa && npm install && cd ../..
   ```

2. **Start the backend and UI**:

   ```bash
   npm run watch-v2wa
   ```

   The application will be accessible at:
   `http://localhost:4004/smartwaerhouse.v2app.v2wa/index.html?sap-ui-xx-viewCache=false`

### Mock Users (Local Dev)

| Username | Password | Role |
| :--- | :--- | :--- |
| `alice` | `alice` | `admin` |
| `bob` | `bob` | `user` |

---

## Testing

Run end-to-end browser automation tests with Playwright:

```bash
# Run all tests
npx playwright test

# Run dynamic SQLite data-driven test
npx playwright test create-salesorder-dynamic-sqlite.spec.js

# View HTML test report
npx playwright show-report
```

---

## Deployment (SAP BTP)

Build and deploy the Multi-Target Application (MTA) to SAP BTP Cloud Foundry:

```bash
# 1. Build MTA archive
npm run build

# 2. Deploy to Cloud Foundry
cf login -a <CF_API_ENDPOINT> -o <ORG> -s <SPACE>
npm run deploy

# 3. Undeploy (if needed)
npm run undeploy
```

---

## Useful Scripts

| Command | Description |
| :--- | :--- |
| `npm start` | Run backend via `cds-serve` |
| `npm run watch-v2wa` | Run CAP server and launch the Fiori UI |
| `npm run build` | Build production MTA archive (`mta_archives/archive.mtar`) |
| `npm run deploy` | Deploy MTAR to SAP BTP Cloud Foundry |
| `npm run undeploy` | Delete deployed Cloud Foundry services and keys |
| `npx playwright test` | Run Playwright test suite |
