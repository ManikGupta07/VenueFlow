const express = require("express");
const session = require("express-session");

const admin = require("firebase-admin");
const path = require("path");

// 🔹 Load service account
const serviceAccount = require("./serviceAccountKey.json");

// 🔹 Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();
app.use(session({
  secret: "supersecretkey",
  resave: false,
  saveUninitialized: false
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());




app.get("/", async (req, res) => {
  const snapshot = await db.collection("bookings").get();

  let eventsHTML = "";

 snapshot.forEach(doc => {
  const event = doc.data();
  const eventId = doc.id;

  eventsHTML += `
    <div class="event-card">
      <h3>${event.event_name}</h3>
      <p>${event.date}</p>
      <p>${event.start_time} - ${event.end_time}</p>
      <span>${event.venue_name}</span>
      <br><br>
      <a href="/register/${eventId}" style="color:#3b82f6;">Register</a>
    </div>
  `;
});

  res.send(`
  <html>
  <head>
    <title>Campus Events Portal</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: 'Segoe UI', sans-serif;
        background: radial-gradient(circle at 20% 30%, #1e3a8a, #0f172a 60%);
        color: white;
        min-height: 100vh;
      }

      /* Navbar */
      .navbar {
        display: flex;
        justify-content: space-between;
        padding: 20px 60px;
        background: rgba(0,0,0,0.3);
        backdrop-filter: blur(10px);
      }

      .logo {
        font-size: 20px;
        font-weight: bold;
        letter-spacing: 1px;
      }

      .nav-links {
        opacity: 0.8;
      }

      /* Hero */
      .hero {
        padding: 60px;
        text-align: center;
      }

      .hero h1 {
        font-size: 42px;
        margin-bottom: 10px;
      }

      .hero p {
        opacity: 0.8;
        font-size: 18px;
      }

      /* Main Layout */
      .container {
        display: flex;
        padding: 40px 60px;
        gap: 40px;
      }

      .events-section {
        flex: 1.2;
      }

      .events-section h2 {
        margin-bottom: 20px;
      }

      .event-card {
        background: rgba(255,255,255,0.05);
        backdrop-filter: blur(15px);
        padding: 20px;
        border-radius: 14px;
        margin-bottom: 20px;
        transition: 0.3s;
      }

      .event-card:hover {
        transform: translateY(-5px);
        background: rgba(255,255,255,0.08);
      }

      .event-card h3 {
        margin-bottom: 6px;
      }

      .event-card span {
        display: inline-block;
        margin-top: 8px;
        padding: 4px 10px;
        background: #3b82f6;
        border-radius: 20px;
        font-size: 12px;
      }

      /* Form Section */
      .form-section {
        flex: 1;
        background: rgba(255,255,255,0.06);
        backdrop-filter: blur(20px);
        padding: 30px;
        border-radius: 16px;
      }

      .form-section h2 {
        margin-bottom: 20px;
      }

      input, select {
        width: 100%;
        padding: 10px;
        margin-bottom: 15px;
        border-radius: 8px;
        border: none;
        background: rgba(255,255,255,0.1);
        color: white;
      }

      input::placeholder {
        color: #cbd5e1;
      }

      button {
        width: 100%;
        padding: 12px;
        border: none;
        border-radius: 8px;
        background: linear-gradient(90deg, #2563eb, #3b82f6);
        color: white;
        font-weight: bold;
        cursor: pointer;
        transition: 0.3s;
      }

      button:hover {
        transform: scale(1.03);
      }

      @media (max-width: 900px) {
        .container {
          flex-direction: column;
        }
      }
        .navbar a{
        color: white;
        outline:none;
        }
    </style>
  </head>

  <body>

    <div class="navbar">
      <div class="logo">CampusFlow</div>
      <div class="nav-links">Automated Event Scheduling Engine</div>
      <a href="/schedule" >Schedule Event</a>

    </div>

    <div class="hero">
      <h1>Campus Events Portal</h1>
      <p>Automated venue conflict detection & real-time event visibility</p>
    </div>

    <div class="container">

      <div class="events-section">
        <h2>Upcoming Events</h2>
        ${eventsHTML || "<p style='opacity:0.7'>No events scheduled yet.</p>"}
      </div>

      
    </div>

  </body>
  </html>
  `);
});

// 🔹 Booking route
app.post("/book", async (req, res) => {
  try {
    if (!req.session.user) {
  return res.redirect("/login");
}

   const { event_name, date, start_time, end_time, attendance, venue_name } = req.body;


    // Convert times to minutes
    function toMinutes(time) {
      const [hours, minutes] = time.split(":").map(Number);
      return hours * 60 + minutes;
    }

    const newStart = toMinutes(start_time);
    const newEnd = toMinutes(end_time);

    // Get existing bookings for same venue & date
    const snapshot = await db.collection("bookings")
      .where("venue_name", "==", venue_name)
      .where("date", "==", date)
      .get();

    let conflict = false;

    snapshot.forEach(doc => {
      const booking = doc.data();
      const existingStart = toMinutes(booking.start_time);
      const existingEnd = toMinutes(booking.end_time);

      if (newStart < existingEnd && newEnd > existingStart) {
        conflict = true;
      }
    });

    if (conflict) {
      return res.send(`
        <h2>❌ Conflict Detected!</h2>
        <p>This venue is already booked at that time.</p>
        <a href="/">Go Back</a>
      `);
    }

    // If no conflict → Save booking
    await db.collection("bookings").add({
      event_name,
      date,
      start_time,
      end_time,
      attendance,
      venue_name
    });

req.session.destroy(() => {
  res.redirect("/");
});


  } catch (error) {
    console.error(error);
    res.send("Error processing booking");
  }
});



app.get("/login", (req, res) => {
  res.send(`
  <html>
  <head>
    <title>Admin Login</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: 'Segoe UI', sans-serif;
        background: radial-gradient(circle at 20% 30%, #1e3a8a, #0f172a 60%);
        color: white;
        height: 100vh;
        display: flex;
        flex-direction: column;
      }

      .navbar {
        display: flex;
        justify-content: space-between;
        padding: 20px 60px;
        background: rgba(0,0,0,0.3);
        backdrop-filter: blur(10px);
      }

      .logo {
        font-size: 20px;
        font-weight: bold;
      }

      .container {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .login-card {
        width: 380px;
        background: rgba(255,255,255,0.07);
        backdrop-filter: blur(25px);
        padding: 40px;
        border-radius: 18px;
        box-shadow: 0 0 40px rgba(0,0,0,0.5);
      }

      .login-card h2 {
        text-align: center;
        margin-bottom: 25px;
      }

      input {
        width: 100%;
        padding: 12px;
        margin-bottom: 18px;
        border-radius: 8px;
        border: none;
        background: rgba(255,255,255,0.1);
        color: white;
      }

      input::placeholder {
        color: #94a3b8;
      }

      input:focus {
        outline: none;
        box-shadow: 0 0 10px #3b82f6;
      }

      button {
        width: 100%;
        padding: 12px;
        border: none;
        border-radius: 8px;
        background: linear-gradient(90deg, #2563eb, #3b82f6);
        color: white;
        font-weight: bold;
        cursor: pointer;
        transition: 0.3s;
      }

      button:hover {
        transform: scale(1.05);
      }

      .back-link {
        display: block;
        text-align: center;
        margin-top: 20px;
        color: #3b82f6;
        text-decoration: none;
      }

      .subtitle {
        text-align: center;
        font-size: 14px;
        opacity: 0.7;
        margin-bottom: 20px;
      }

    </style>
  </head>

  <body>

    <div class="navbar">
      <div class="logo">CampusFlow</div>
      <div>
        <a href="/" style="color:white;text-decoration:none;">Home</a>
      </div>
    </div>

    <div class="container">
      <div class="login-card">
        <h2>Authorized Access</h2>
        <div class="subtitle">Club / Admin Login Required</div>

        <form action="/login" method="POST">
          <input type="email" name="email" placeholder="Official Email" required>
          <input type="password" name="password" placeholder="Password" required>
          <button type="submit">Login</button>
        </form>

        <a href="/" class="back-link">Back to Homepage</a>
      </div>
    </div>

  </body>
  </html>
  `);
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const snapshot = await db.collection("admins")
    .where("email", "==", email)
    .where("password", "==", password)
    .get();

  if (!snapshot.empty) {
    req.session.user = email;
    return res.redirect("/schedule");
  }

  res.send("Invalid credentials");
});

app.get("/schedule", (req, res) => {

  if (!req.session.user) {
    return res.redirect("/login");
  }

  res.send(`
  <html>
  <head>
    <title>Schedule Event</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: 'Segoe UI', sans-serif;
        background: radial-gradient(circle at 20% 30%, #1e3a8a, #0f172a 60%);
        color: white;
        min-height: 100vh;
      }

      .navbar {
        display: flex;
        justify-content: space-between;
        padding: 20px 60px;
        background: rgba(0,0,0,0.3);
        backdrop-filter: blur(10px);
      }

      .logo {
        font-size: 20px;
        font-weight: bold;
      }

      .container {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 80vh;
      }

      .form-card {
        width: 400px;
        background: rgba(255,255,255,0.07);
        backdrop-filter: blur(20px);
        padding: 30px;
        border-radius: 16px;
      }

      .form-card h2 {
        margin-bottom: 20px;
        text-align: center;
      }

      input, select {
        width: 100%;
        padding: 10px;
        margin-bottom: 15px;
        border-radius: 8px;
        border: none;
        background: rgba(255,255,255,0.1);
        color: white;
      }
select {
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  border: none;
  background: rgba(255,255,255,0.1);
  color: #94a3b8; /* placeholder color */
}

select:valid {
  color: white;
}


      input::placeholder {
        color: #cbd5e1;
      }

      button {
        width: 100%;
        padding: 12px;
        border: none;
        border-radius: 8px;
        background: linear-gradient(90deg, #2563eb, #3b82f6);
        color: white;
        font-weight: bold;
        cursor: pointer;
        transition: 0.3s;
      }

      button:hover {
        transform: scale(1.03);
      }

      .back-link {
        display: block;
        margin-top: 15px;
        text-align: center;
        color: #3b82f6;
        text-decoration: none;
      }

    </style>
  </head>

  <body>

    <div class="navbar">
      <div class="logo">CampusFlow</div>
      <div>
        <a href="/logout" style="color:white;text-decoration:none;">Home</a>
      </div>
    </div>

    <div class="container">
      <div class="form-card">
        <h2>Schedule Event</h2>

        <form action="/book" method="POST">
          <input type="text" name="event_name" placeholder="Event Name" required>
          <input type="date" name="date" required>
          <input type="time" name="start_time" required>
          <input type="time" name="end_time" required>
          <input type="number" name="attendance" placeholder="Expected Attendance" required>

          <select name="venue_name" required>
            <option value="">Select Venue</option>
            <option value="Seminar Hall A">Seminar Hall A</option>
            <option value="Auditorium">Auditorium</option>
            <option value="Classroom 101">Classroom 101</option>
            <option value="Classroom 102">Classroom 102</option>
          </select>

          <button type="submit">Schedule Event</button>
        </form>

     <a href="/logout" class="back-link">Cancel & Logout</a>

      </div>
    </div>

  </body>
  </html>
  `);
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.get("/register/:id", async (req, res) => {
  const eventId = req.params.id;

  res.send(`
    <html>
    <body style="background:#0f172a;color:white;padding:40px;font-family:sans-serif;">
      <h2>Register for Event</h2>

      <form action="/register/${eventId}" method="POST">
        <input name="student_name" placeholder="Your Name" required><br><br>
        <input name="student_email" placeholder="Your Email" required><br><br>
        <button type="submit">Register</button>
      </form>

      <br>
      <a href="/">Back to Home</a>
    </body>
    </html>
  `);
});
app.post("/register/:id", async (req, res) => {
  const eventId = req.params.id;
  const { student_name, student_email } = req.body;

  await db
    .collection("bookings")
    .doc(eventId)
    .collection("registrations")
    .add({
      student_name,
      student_email,
      timestamp: new Date()
    });

  res.send(`
    <h2>Registration Successful ✅</h2>
    <a href="/">Back to Home</a>
  `);
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
