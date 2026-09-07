# 🚦 CivicPulse

### AI-Powered Urban Intelligence & Smart Governance Platform

> **Turning Urban Problems into Smarter City Decisions.**

CivicPulse is an AI-powered urban intelligence and smart governance platform that transforms citizen-reported urban problems into actionable insights for city authorities.

Instead of simply collecting complaints, CivicPulse uses **AI analysis, Urban Impact Scoring, duplicate detection, hotspot intelligence, and automated department routing** to help authorities understand what is happening across the city and prioritize what needs attention first.

---

## 🌆 The Problem

Rapid urbanization creates increasingly complex challenges for cities:

* 🕳️ Potholes and damaged roads
* 🗑️ Garbage accumulation
* 💡 Broken streetlights
* 💧 Water leakage
* 🚧 Infrastructure issues
* 📍 Recurring problem zones
* 🔄 Duplicate citizen complaints
* ⏳ Delayed issue resolution

Traditional complaint-management systems mainly focus on **collecting and tracking complaints**.

They often fail to answer:

> **Where are the most critical urban problems?**  
> **Which problems affect the most people?**  
> **Which department should handle them?**  
> **Which areas are becoming urban hotspots?**

CivicPulse addresses this gap by turning scattered citizen observations into **city-wide urban intelligence**.

---

# 💡 Our Solution

CivicPulse creates a complete pipeline:

**Citizen Report → AI Analysis → Impact Scoring → Duplicate Detection → Hotspot Intelligence → Department Routing → Authority Action → Urban Insights**

The platform connects citizens with municipal authorities through a centralized intelligence layer.

---

# ✨ Key Features

## 👤 Citizen Reporting

Citizens can report urban problems using:

* Issue title
* Description
* Category
* Severity
* Location
* Image

The platform supports location detection through GPS and fallback geolocation methods.

---

## 🤖 AI-Powered Issue Analysis

CivicPulse uses **Google Gemini Vision** to analyze uploaded images and extract:

* Issue category
* Severity
* Issue title
* Summary
* AI confidence

This reduces manual classification and helps authorities process reports faster.

---

## 🔄 Duplicate Complaint Detection

Nearby reports referring to the same type of urban problem can be identified using geospatial and category-based matching.

Instead of creating multiple duplicate complaints, citizens can support an existing complaint using:

### **"I Face This Too"**

This allows the platform to represent community impact more accurately.

---

## 📊 Urban Impact Score

Every complaint can receive an **Urban Impact Score from 0–100**.

The score considers:

* **Severity — 40%**
* **Community Support — 20%**
* **Location Concentration — 20%**
* **Age/Persistence — 20%**

### Impact Levels

| Score  | Impact   |
| ------ | -------- |
| 0–24   | Low      |
| 25–49  | Moderate |
| 50–74  | High     |
| 75–100 | Critical |

This creates an explainable priority system for municipal authorities.

---

## 📍 Urban Hotspot Intelligence

CivicPulse analyzes the geographical distribution of active complaints to identify areas where urban problems are concentrated.

Authorities can identify:

* 🔴 Critical Zones
* 🟠 High Impact Zones
* 🟡 Moderate Zones
* 🟢 Low Impact Zones
* 📈 Emerging Problem Zones

Hotspots are generated from actual complaint locations instead of static or hardcoded data.

---

## 🗺️ Interactive City Map

The authority dashboard includes an interactive **Leaflet-based map**.

It allows authorities to visualize:

* Individual complaints
* Complaint severity
* Complaint status
* Urban hotspots
* Geographical concentration
* Issue categories

This provides a city-wide view of urban problems.

---

## 🏢 Automated Department Routing

CivicPulse automatically recommends the appropriate municipal department based on the issue category.

### Current Routing Logic

| Issue         | Department                              |
| ------------- | --------------------------------------- |
| Pothole       | Public Works Department                 |
| Damaged Road  | Public Works Department                 |
| Garbage       | Waste Management Department             |
| Streetlight   | Electrical / Street Lighting Department |
| Water Leakage | Water & Sewerage Department             |

Unknown categories are marked as:

**Review Required**

The routing engine is deterministic and explainable rather than relying on artificial confidence scores.

---

# 🏛️ Authority Command Center

Municipal authorities get a centralized dashboard containing:

* 📍 Live issue map
* 🚨 Priority queue
* 📊 Category analytics
* 🎯 Urban Impact Score
* 🔥 Urban hotspots
* 🏢 Department routing
* 🔎 Category filters
* 🏢 Department filters
* 🔄 Issue status management
* 📈 Urban intelligence insights

Authorities can manage complaints through:

**Pending → In Progress → Resolved**

---

# 🔄 Complete Workflow

```text
                 CITIZEN
                    │
                    ▼
            Report Urban Issue
                    │
                    ▼
             Upload Image
                    │
                    ▼
          Location Detection
                    │
                    ▼
          ┌─────────────────┐
          │   AI ANALYSIS   │
          │ Gemini Vision   │
          └─────────────────┘
                    │
                    ▼
       Category + Severity + Summary
                    │
                    ▼
        Duplicate Detection
                    │
             ┌──────┴──────┐
             │             │
        Duplicate       New Issue
             │             │
             ▼             ▼
        Community      Impact Score
         Support            │
                           ▼
                  Hotspot Analysis
                           │
                           ▼
                  Department Routing
                           │
                           ▼
              AUTHORITY COMMAND CENTER
                           │
                           ▼
                    Prioritization
                           │
                           ▼
                 Action & Resolution
                           │
                           ▼
                 Urban Intelligence
```

---

# 🧠 Urban Intelligence Layer

The core idea behind CivicPulse is:

```text
Citizen Data
     ↓
AI Understanding
     ↓
Geospatial Intelligence
     ↓
Impact & Priority
     ↓
Department Routing
     ↓
Authority Action
     ↓
Urban Planning Insights
```

This transforms CivicPulse from a traditional complaint-management system into an **urban intelligence platform**.

---

# 🛠️ Technology Stack

### Frontend

* React 19
* Vite
* React Router
* Tailwind CSS
* Framer Motion
* Lucide React
* Recharts

### Backend & Database

* Supabase
* PostgreSQL
* PostGIS
* Supabase Auth
* Supabase Storage
* Supabase Realtime

### AI

* Google Gemini Vision
* Gemini API

### Maps & Geospatial

* Leaflet
* React Leaflet
* OpenStreetMap
* Nominatim
* PostGIS Geography

### Development

* JavaScript
* Node.js
* Git & GitHub
* Vercel

---

# 🏗️ System Architecture

```text
┌──────────────────────────────┐
│          CITIZENS            │
│                              │
│  Report Issue + Image + GPS  │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│       REACT FRONTEND         │
│                              │
│ Report │ Track │ Dashboard   │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│        APPLICATION LAYER     │
│                              │
│ Issue Service                │
│ Auth Service                 │
│ AI Service                   │
│ Urban Intelligence           │
│ Department Routing           │
└───────┬───────────┬──────────┘
        │           │
        ▼           ▼
┌─────────────┐  ┌─────────────┐
│   Gemini    │  │  Supabase   │
│     AI      │  │ PostgreSQL  │
└─────────────┘  │ + PostGIS   │
                 └──────┬──────┘
                        │
                        ▼
               ┌─────────────────┐
               │    AUTHORITY    │
               │ COMMAND CENTER  │
               └─────────────────┘
```

---

# 🗄️ Database

CivicPulse uses Supabase PostgreSQL with PostGIS for location-aware complaint management.

### Main Tables

* `profiles`
* `complaints`
* `complaint_images`
* `status_history`
* `notifications`
* `complaint_upvotes`

The `complaints` table stores information such as:

* Issue details
* Category
* Severity
* Status
* Location
* AI analysis
* AI confidence
* Urban Impact Score
* Upvotes
* Recommended department
* Timestamps

PostGIS enables geographical complaint analysis and duplicate/hotspot detection.

---

# 📱 Main Application Modules

### Citizen Side

* Landing Page
* Authentication
* Report Issue
* Location Selection
* AI Analysis
* My Reports
* Complaint Tracking
* Community Support

### Authority Side

* Admin Authentication
* Command Center
* City Map
* Priority Queue
* Hotspot Intelligence
* Category Analytics
* Department Routing
* Complaint Management
* Status Updates

---

# 🚀 Getting Started

## 1. Clone the Repository

```bash
git clone https://github.com/shivamshashwati6/CivicPulse2.0.git
cd CivicPulse2.0
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

> Never commit your `.env` file or API keys to GitHub.

## 4. Start the Development Server

```bash
npm run dev
```

The application will run locally using the Vite development server.

## 5. Build for Production

```bash
npm run build
```

---

# 🌍 Scalability

CivicPulse is designed to scale from a small pilot to city-wide deployment.

```text
One Ward
   ↓
One City
   ↓
Multiple Cities
   ↓
Regional Urban Intelligence Network
```

The architecture can support integration with:

* Municipal systems
* Smart City platforms
* IoT sensors
* Satellite data
* Open government datasets
* Infrastructure monitoring systems

---

# 🔮 Future Scope

## Predictive Urban Intelligence

Move from:

**"Where is the problem?"**

to:

**"Where is the problem likely to emerge next?"**

Potential future capabilities include:

* Predictive hotspot detection
* Urban risk forecasting
* IoT sensor integration
* Satellite imagery analysis
* Traffic and mobility data
* Infrastructure health monitoring
* AI-based resource allocation
* Digital city intelligence dashboards

---

# 💼 Business Model

CivicPulse can operate as a **B2G + B2B SaaS platform**.

### Potential Revenue Streams

* Municipal SaaS subscriptions
* Smart-city deployments
* Enterprise deployments
* Urban analytics services
* API and data integrations

### Target Customers

* Municipal Corporations
* Urban Local Bodies
* Smart City Authorities
* Infrastructure Companies
* Facility Management Organizations

---

# 🎯 Impact

### For Citizens

* Faster and easier reporting
* Better complaint visibility
* Community-driven issue prioritization

### For Authorities

* Prioritized complaints
* Automated department routing
* City-wide problem visibility
* Reduced duplicate complaints
* Data-driven resource allocation

### For Cities

* Urban hotspot identification
* Recurring problem detection
* Better infrastructure planning
* More responsive governance

---

# 🏆 Hackathon Vision

> **The future of urban governance isn't just responding to problems — it is understanding them, prioritizing them, and eventually predicting them.**

CivicPulse aims to become an **urban intelligence layer** connecting citizen observations with smarter municipal decision-making.

---

# 👥 Team

### Perfect Duo

**Shashwati Shivam**  
AI & Full-Stack Developer

**Arnab Kumar Kashyap**  
Full-Stack & Data/Analytics Developer

---

# 📌 Project Status

🚧 **Hackathon Prototype**

The current version demonstrates the core CivicPulse workflow:

* ✅ Citizen reporting
* ✅ AI image analysis
* ✅ Geolocation
* ✅ Duplicate detection
* ✅ Community support
* ✅ Urban Impact Score
* ✅ Urban hotspot intelligence
* ✅ Interactive city map
* ✅ Automated department routing
* ✅ Authority command center
* ✅ Real-time updates

---

## 🌱 CivicPulse

**Turning Urban Problems into Smarter City Decisions.**

**Citizen Reports → AI Intelligence → Better Governance → Smarter Cities**