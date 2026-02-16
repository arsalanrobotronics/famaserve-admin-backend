// dependencies
const cluster = require("cluster");
const os = require("os");
const express = require("express");
const path = require("path");
const cors = require("cors");
require("dotenv").config({ path: path.resolve(__dirname, "./../.env") });

// database_connection_and_models
require("./config/database")();

// endpoint_definitions
const authRoutes = require("./routes/auth/index");
// const projectRoutes = require("./routes/projects/index");
// const custRoutes = require("./routes/customer/index");
// const tradeRoutes = require("./routes/trades/index");
// const SubtradeRoutes = require("./routes/subtrades/index");
// const reviewsRoutes = require("./routes/reviews/index");
const configurationRoutes = require("./routes/configuration/index");
const subscriptionRoutes = require("./routes/subscriptions/index");
const rolesRoutes = require("./routes/roles/index");
const permissionsRoutes = require("./routes/permissions/index");
// const helpAndSupportRoutes = require("./routes/helpAndSupport/index");
const systemUsersRoutes = require("./routes/systemusers/index");
// const quotesRoutes = require("./routes/quotes/index");
const chatRoutes = require("./routes/chat/index");
const messagesRoutes = require("./routes/messages/index");
const analyticsRoutes = require("./routes/analytics/index");
const providersRoutes = require("./routes/providers/index");
const customersRoutes = require("./routes/customers/index");
const bookingsRoutes = require("./routes/bookings/index");
const reviewsRoutes = require("./routes/reviews/index");
const categoriesRoutes = require("./routes/categories/index");
const servicesRoutes = require("./routes/services/index");
const providerServicesRoutes = require("./routes/providerservices/index");
const notificationsRoutes = require("./routes/notifications/index");
// server_port_config
const port = process.env.PORT;

// environment_validation
const environment = process.env.ENVIRONMENT?.toUpperCase();

// production_clustering_mode
if (environment === "PRODUCTION" && cluster.isMaster) {
  const numWorkers = os.cpus().length;
  console.log("process_count", numWorkers);

  // spawn_worker_processes
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  // process_termination_handler
  cluster.on("exit", (worker, code, signal) => {
    console.log(`process_terminated ${worker.process.pid}`);
  });
} else {
  // development_single_process_mode
  const app = express();

  // request_processing_middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  /** endpoint_registrations **/
  app.use("/auth/", authRoutes);
  // app.use("/trades/", tradeRoutes);
  // app.use("/subTrades/", SubtradeRoutes);
  // app.use("/projects/", projectRoutes);
  // app.use("/reviews/", reviewsRoutes);
  app.use("/subscriptions/", subscriptionRoutes);
  app.use("/roles/", rolesRoutes);
  app.use("/configurations/", configurationRoutes);
  app.use("/permissions/", permissionsRoutes);
  app.use("/systemUsers/", systemUsersRoutes);
  // app.use("/helpAndSupport/", helpAndSupportRoutes);
  // app.use("/quotes/", quotesRoutes);
  app.use("/chats/", chatRoutes);
  app.use("/messages/", messagesRoutes);
  app.use("/analytics/", analyticsRoutes);
  app.use("/providers/", providersRoutes);
  app.use("/customers/", customersRoutes);
  app.use("/bookings/", bookingsRoutes);
  app.use("/reviews/", reviewsRoutes);
  app.use("/categories/", categoriesRoutes);
  app.use("/services/", servicesRoutes);
  app.use("/providerServices/", providerServicesRoutes);
  app.use("/notifications/", notificationsRoutes);

  /** fallback_route_handler **/
  app.use((req, res) => {
    res.status(404).send("Not Found");
  });

  // initialize_server
  app.listen(port, "0.0.0.0", () => {
    console.log(
      `service_started in ${environment || "development"} mode on port ${port}`
    );
  });

  module.exports = app;
}
