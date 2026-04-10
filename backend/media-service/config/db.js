const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ [Media DB] MongoDB Connected: ${conn.connection.host} — DB: ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ [Media DB] MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
