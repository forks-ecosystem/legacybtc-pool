import app from "./app";
import { logger } from "./lib/logger";
import { startStratumServers, stopStratumServers } from "./lib/stratum";
import { startReconciler, stopReconciler } from "./lib/block-reconciler";
import { validateAddress } from "./lib/rpc";

const rawPort = process.env["PORT"];
const devWallet = process.env["DEV_WALLET"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

if (!devWallet) {
  throw new Error("DEV_WALLET environment variable is required but was not provided.");
}

logger.info({ devWallet }, "Validating DEV_WALLET on node...");

const validated = await validateAddress(devWallet);

if (!validated.isvalid) {
  throw new Error(`DEV_WALLET "${devWallet}" is not a valid address`);
}

if (!validated.ismine) {
  throw new Error(
    `DEV_WALLET "${devWallet}" is not owned by this node. ` +
    `Use getnewaddress to create a wallet address and update DEV_WALLET.`,
  );
}

logger.info({ devWallet }, "DEV_WALLET validated: address is owned by this node");

// Start Stratum mining servers (SOLO + PPLNS)
startStratumServers();
startReconciler();

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

process.on("SIGTERM", () => {
  stopStratumServers();
  stopReconciler();
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  stopStratumServers();
  stopReconciler();
  server.close(() => process.exit(0));
});
