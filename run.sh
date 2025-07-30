#!/bin/sh
# Cloud Run automatically handles Cloud SQL proxy via Unix socket
# No need to start it manually

# Start the Node.js application
exec node dist/index.js