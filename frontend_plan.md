# CampusConnect — Frontend Onboarding & Implementation Plan

Welcome to the frontend team! The backend is already fully built, dockerized, and ready to serve data. This document will guide you through setting up your local environment and building the UI without needing to understand the complex microservices architecture.

---

## 🚀 1. Getting the Backend Running (The Easy Way)

We are using **Docker** so you don't have to install MongoDB or run five different terminals. Docker acts like a virtual machine that runs our entire backend exactly the same way it runs on my machine.

**Step-by-step:**
1. **Install Docker Desktop**: Download and install it from [docker.com](https://www.docker.com/products/docker-desktop/). Start the application and make sure the Docker engine is running (look for the green whale icon in your taskbar/menu bar).
2. **Clone the Repo**: Make sure you have the latest code from our GitHub repository (instructions on how to get this below in the team sync section).
3. **Navigate to the Backend**: Open your terminal (VS Code terminal is perfect) and change directories to the backend folder:
   ```bash
   cd backend
   ```
4. **Start the Magic**: Run this single command:
   ```bash
   docker-compose up
   ```
   *(Note: The first time you run this, it will take 5-10 minutes to download all the images. Let it run. After the first time, it will take less than 10 seconds!)*

**How do you know it's working?**
Open your browser and go to: `http://localhost:3000/health`
If you see a JSON response that says `"success": true` and lists the services as `"ok"`, **you are good to go!** Leave that terminal running in the background.

---

## 🔌 2. The Golden Rule of the API

Our backend consists of three different microservices, but **you do not need to worry about that**.

We have built an **API Gateway**. This acts as the single front door to everything.
**You must route EVERY API call through `http://localhost:3000`.** Never connect to 3001, 3002, or 3003 directly.

**Frontend Setup:**
If you are using Vite (React/Vue), create a `.env` file in your frontend root directory:
```env
VITE_API_BASE_URL=http://localhost:3000/api
```

Whenever you make an Axios or Fetch call, use that base URL.

---

## 🗺️ 3. What You Need to Build (Priority Order)

Here is the exact order you should build the features to maximize our hackathon points:

### Priority 1: Auth & User Flow (The Foundation)
You need two simple pages: Register and Login.

*   **Register API**: `POST /auth/register`
    *   **Body**: `{ "name": "Your Name", "email": "test@test.com", "password": "password123", "role": "student" }`
*   **Login API**: `POST /auth/login`
    *   **Body**: `{ "email": "test@test.com", "password": "password123" }`
*   **Important**: When a user logs in, the API returns a `token` (JWT). You **must** save this token (e.g., in `localStorage`) because you need it for all protected routes.

### Priority 2: Event Discovery (The Core Hackathon Feature)
Students need to be able to see a list of events. Build a beautiful dashboard or list view.

*   **List Events API**: `GET /events`
    *   *No token required.* Returns a list of all events, their details, and their current capacity.

### Priority 3: Registration & Waitlist Flow (The "Wow" Factor)
When a student clicks "Register" on an event, call this API. Our backend handles the complex logic of capacity and waitlisting!

*   **Register for Event API**: `POST /registrations`
    *   **Headers**: `{ "Authorization": "Bearer YOUR_SAVED_TOKEN" }`
    *   **Body**: `{ "eventId": "ID_OF_THE_EVENT", "eventTitle": "TITLE" }`
    *   **Note**: If the event is full, the API will automatically place the user on a waitlist and let you know. You just need to show the user a nice success message or a "You are on the waitlist" message.

### Priority 4: User Dashboard
Show the student the events they are going to.

*   **My Registrations API**: `GET /registrations/my`
    *   **Headers**: `{ "Authorization": "Bearer YOUR_SAVED_TOKEN" }`

---

## 🎨 4. Design Guidelines (Impress the Judges)

*   **Look Premium**: Don't just use standard bootstrap buttons. Use modern styling like TailwindCSS. Think glassmorphism, subtle gradients, and dark mode.
*   **Feedback**: Show loading spinners when fetching data. Show toast notifications for success/error messages.
*   **Waitlist UI**: Since handling high traffic and waitlists is the core problem statement of this hackathon, make the UI around waitlisting look very clear and engaging for the user.

---

## 🛑 Common Errors & How to Fix Them

*   **CORS Error**: You shouldn't see this, but if you do, ensure you are calling `localhost:3000` (the gateway), NOT 3001/3002.
*   **401 Unauthorized**: You forgot to pass the JWT token in the `Authorization` header, or your token expired. Log out and log back in.
*   **Backend isn't responding**: Check the terminal running `docker-compose up`. If it crashed, hit `Ctrl+C` and run it again.

Good luck team! Let's build something awesome.
