const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campus_event_db';
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI);
    console.log(`✅ [Event DB] MongoDB Connected: ${conn.connection.host} — DB: ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ [Event DB] MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
