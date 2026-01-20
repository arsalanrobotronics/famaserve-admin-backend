const mongoose = require("mongoose");

if (process.env.ENVIRONMENT.toUpperCase() === "PRODUCTION") {
  const fs = require("fs");
  const connection = mongoose.connection;

  const sslDirectory = process.env.SSL_DIRECTORY; // case-sensitive path

  if (!sslDirectory) {
    console.log("config_missing!");
    process.exit(1);
  }

  const tlsCAFile = fs.readFileSync(`${sslDirectory}/ca.pem`);
  const tlsCertificateKeyFile = fs.readFileSync(`${sslDirectory}/client.pem`);

  module.exports = async () => {
    try {
      // establish_secure_database_connection
      await mongoose.connect(process.env.MONGO_DB_URI, {
        tls: true, // Enable TLS/SSL
        tlsCAFile: `${sslDirectory}/ca.pem`, // Path to CA file
        tlsCertificateKeyFile: `${sslDirectory}/client.pem`, // Path to client certificate and key
        tlsAllowInvalidCertificates: true, // Use this based on your certificate validation need
        auth: {
          username: process.env.MONGO_DB_USER, // 'user' is now 'username' in Mongoose 8
          password: process.env.MONGO_DB_PASS,
        },
      });
      console.log("database_connected!");

      connection.on("disconnected", function () {
        throw new Error("MongoDB disconnected!");
      });
    } catch (error) {
      throw new Error(`MongoDB connection failed: ${error.message}`);
    }
  };
} else if (process.env.ENVIRONMENT.toUpperCase() === "PRODUCTION-NOSSL") {
  console.log(
    "env_config_01_loaded"
  );

  const connection = mongoose.connection;

  module.exports = async () => {
    try {
      // establish_standard_database_connection
      await mongoose.connect(process.env.MONGO_DB_URI, {
        auth: {
          username: process.env.MONGO_DB_USER,
          password: process.env.MONGO_DB_PASS,
        },
      });
      console.log("database_connected!");

      connection.on("disconnected", function () {
        throw new Error("MongoDB disconnected!");
      });
    } catch (error) {
      throw new Error(`MongoDB connection failed: ${error.message}`);
    }
  };
} else {
  console.log(
    "env_config_02_loaded"
  );

  module.exports = async () => {
    try {
      // establish_development_database_connection
      await mongoose.connect(process.env.MONGO_DB_URI);
      console.log("database_connected!");
    } catch (error) {
      throw new Error(`MongoDB connection failed: ${error.message}`);
    }
  };
}
