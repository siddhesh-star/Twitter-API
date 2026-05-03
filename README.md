# Twitter ESG Leads Finder 🌍

A lightweight, real-time Node.js application that fetches tweets using the Twitter API v2 to discover potential leads for ESG (Environmental, Social, and Governance) and sustainability software. 

The project includes a robust background fetcher and a **premium real-time web dashboard** to monitor activity and view extracted leads.

## ✨ Features

- **Automated Fetching:** Runs continuously, querying the Twitter API every 10 minutes.
- **Smart Filtering:** Isolates high-intent tweets containing keywords like *"looking"*, *"need"*, and *"recommend"*.
- **Pagination & Deduplication:** Handles large volumes of tweets across API pages and ensures leads aren't duplicated across runs.
- **Real-Time Dashboard:** A beautiful, dark-mode glassmorphism UI.
- **Live Server Logs:** Uses Server-Sent Events (SSE) to stream backend activity logs directly to the browser dashboard.

## 🚀 Quick Start

### 1. Prerequisites
- Node.js (v14 or higher recommended)
- A Twitter Developer account with a **Bearer Token** for API v2.

### 2. Installation
Clone the repository (or download the folder) and install the dependencies:
```bash
npm install
```

### 3. Configuration
Rename the `.env.example` file to `.env` (or create a new `.env` file) in the root directory and add your Twitter Bearer Token:
```env
TWITTER_BEARER_TOKEN=your_actual_bearer_token_here
```

### 4. Run the Application
Start the server and background fetcher:
```bash
npm start
```

### 5. View the Dashboard
Open your web browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

---

## 🛠️ Technology Stack
- **Backend:** Node.js, Express.js (v4), Axios
- **Storage:** Local JSON file (`tweets.json`)
- **Frontend:** Vanilla HTML, CSS, JavaScript (No frameworks)

## ☁️ Deployment

If you want to host this online for free, consider the following platforms:

1. **[Render.com](https://render.com/) (Web Service)**: Easiest deployment directly from GitHub. *Note: The free tier spins down after 15 minutes of inactivity, and the local `tweets.json` file resets on restart.*
2. **[Glitch.com](https://glitch.com/)**: Excellent for small Node apps. Unlike Render, Glitch **keeps your file changes**, meaning your `tweets.json` database won't be deleted when the server goes to sleep.

**Pro-tip for free tiers:** To prevent your app from sleeping and pausing the background Twitter fetcher, use a free service like [cron-job.org](https://cron-job.org/) to ping your app's URL every 10 minutes.
