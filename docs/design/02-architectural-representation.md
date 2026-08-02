# 2. Architectural Representation

FreshLens is described using the **4+1 View Model** proposed by Philippe Kruchten. This model presents the system from several perspectives so stakeholders can understand how it is structured, built, executed, deployed, and validated in real scenarios.

The architecture is represented through five complementary views: **Logical View**, **Development View**, **Process View**, **Physical View**, and **Use-Case View**. Together, these views provide a complete description of the FreshLens system architecture.

---

## 2.1 Logical View

The logical view describes the major software components of FreshLens and how they work together to satisfy the system's functional requirements.

FreshLens follows a **client-server architecture** in which the Vendor Mobile Application and the Platform Administrator Web Application communicate with a centralized FastAPI backend through RESTful APIs. The backend coordinates authentication, business logic, machine learning inference, inventory management, and alert generation while enforcing tenant isolation through PostgreSQL Row-Level Security (RLS).

The major logical components are:

- **User Management** – Vendor and administrator authentication through Supabase Auth with JWT-based authorization.
- **Scan Management** – Capture produce images, upload scans, and maintain scan history.
- **Freshness Classification** – Run the FL-2TC machine learning pipeline for produce identification and freshness prediction.
- **Inventory Management** – Maintain inventory records, batches, and stock information.
- **Alert Management** – Generate low-stock, aging, and spoilage alerts from inventory and freshness information.
- **Notification Service** – Deliver push notifications to vendors through the Expo Push Notification Service when scan results or alerts become available.

---

## 2.2 Development View

The development view describes the implementation structure, project modules, technologies, and supporting development tools used to build the FreshLens platform.

### Frontend

- Expo React Native for the vendor mobile application
- Next.js for the platform administrator web application
- Communication with the backend through RESTful APIs over HTTPS

### Backend

- FastAPI in Python
- REST API endpoints
- Authentication middleware
- Request coordination

### Machine Learning

- FL-2TC freshness classification model
- Tier-1 produce identification
- Tier-2 freshness classification

### Database and Storage

- PostgreSQL through Supabase
- Row-Level Security (RLS)
- Cloudflare R2 object storage

### Supporting Technologies

- Redis for the task queue
- Celery

---

## 2.3 Process View

The process view describes the runtime behaviour of the FreshLens system and the interactions between software components during execution.

When a vendor submits a produce scan, the FastAPI backend stores the uploaded image in Cloudflare R2 and records the scan request in PostgreSQL. The backend then creates an asynchronous task in Redis, which is processed by a Celery worker running the FL-2TC machine learning model.

After freshness classification is completed, the worker stores the prediction results in PostgreSQL. The system generates alerts according to configured alert rules and sends a push notification through the Expo Push Notification Service. When the vendor opens the notification or refreshes the application, the latest scan results and alerts are retrieved through the REST API.

This asynchronous workflow allows the API to return an **HTTP 202 Accepted** response immediately without waiting for machine learning inference to complete.

---

## 2.4 Physical View

The physical view describes how the FreshLens software components are deployed across client devices and cloud infrastructure.

The Vendor Mobile Application runs on Android and iOS devices through Expo React Native. The Platform Administrator Web Application runs in a web browser.

The FastAPI backend is deployed on an application server and communicates with:

- Supabase Authentication
- PostgreSQL database
- Cloudflare R2 object storage
- Redis task queue
- Celery worker
- FL-2TC machine learning model
- Expo Push Notification Service (FCM/APNs)

All communication between client applications and backend services occurs over secure HTTPS connections.

---

## 2.5 Scenarios (Use-Case View)

The Use-Case View validates the architecture by showing how the different architectural views support the primary business scenarios defined in the Software Requirements Specification.

Representative scenarios include:

- **Freshness Scan**
  - A vendor captures a produce image, submits the scan, receives freshness classification results, and views the updated dashboard.

- **Inventory Alert**
  - The system evaluates inventory information and generates a low-stock, aging, or spoilage alert, then delivers a push notification to the vendor.

- **Product Catalogue Management**
  - A platform administrator manages produce categories and shelf-life configurations used during inventory monitoring.

- **Vendor Management**
  - A platform administrator manages vendor accounts and tenant information.

These scenarios show how the logical, development, process, and physical views work together to satisfy the functional requirements of the FreshLens system.
