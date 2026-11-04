FROM denoland/deno:2.0.0

WORKDIR /app

# Cache dependencies
COPY deno.json ./
RUN deno install --entrypoint src/server.ts || true

# Copy source code
COPY . .

# Expose HTTP port
EXPOSE 3000

# Run the production server
CMD ["run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "--allow-ffi", "src/server.ts"]
