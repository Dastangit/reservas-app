const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('[DB] FATAL: MONGODB_URI no está definida. Revisa las variables de entorno en SnapDeploy.');
    process.exit(1);
  }

  try {
    // Timeout corto a propósito: si la conexión tarda, preferimos que falle
    // rápido y quede loggeado, en vez de dejar que la plataforma de hosting
    // mate el contenedor por su cuenta (con su propio healthcheck timeout)
    // antes de que este código alcance a loguear el error real.
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[DB] Error conectando a MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
