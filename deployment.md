I need to be able to deploy my application; I am using vercel connected to the main branch; I need to use firestore, storage, and firebase auth with this application once this is deployed. How do I do this? how do I use firebase hosting instead of vercel? I want deployment to watch pushes to the main branch please; first indicate how to do so with my current vercel establishment.

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: react-vite-dev
    ports:
      - "5173:5173"
    volumes:
      - ./:/app:cached
      - /app/node_modules
    env_file:
      - .env.development
    environment:
      - CHOKIDAR_USEPOLLING=true
      - CHOKIDAR_INTERVAL=100
      # Connect to emulator service in docker network
      - FIRESTORE_EMULATOR_HOST=firebase-emulator:8070
      - FIREBASE_AUTH_EMULATOR_HOST=firebase-emulator:9099
      - FIREBASE_STORAGE_EMULATOR_HOST=firebase-emulator:9199  # ✅ Add this
    depends_on:
      - firebase-emulator
    stdin_open: true
    tty: true
    restart: unless-stopped
    command: ["npm", "run", "dev", "--", "--host"]
    networks:
      - neural-nexus-network

  firebase-emulator:
    image: andreysenov/firebase-tools:latest
    container_name: firebase-emulator
    ports:
      - "4000:4000"   # Emulator UI
      - "8070:8070"   # Firestore
      - "9099:9099"   # Auth
      - "9000:9000"   # Realtime DB
      - "9199:9199"   # Storage
      - "5001:5001"   # Functions
    volumes:
      - ./:/firebase:cached
    working_dir: /firebase
    command: >
      sh -c "firebase emulators:start --project neuralnexus-467517 --only firestore,auth,database,storage,functions"
    networks:
      - neural-nexus-network
    restart: unless-stopped

networks:
  neural-nexus-network:
    driver: bridge


-------------------_

# Dockerfile.dev
# Stage 1: Build the app
FROM node:20

WORKDIR /app

# Copy package files first for caching
COPY package.json package-lock.json ./

RUN apt-get update && apt-get install -y netcat-openbsd

# Install dependencies initially
RUN npm ci

# Copy the rest of the project
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start dev script
# CMD ["./dev-boot.sh"]

------

Messaging api vm ip: 34.19.137.196:8090
chromadb api vm ip: 104.197.13.46: 9410
data-loading api vm ip: 136.117.33.65: 8060
--------------
