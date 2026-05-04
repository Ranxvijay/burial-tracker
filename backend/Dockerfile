FROM node:18-bullseye

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Ensure devDependencies (TypeScript types) are installed so `tsc` can run during image build.
RUN npm install --include=dev

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]