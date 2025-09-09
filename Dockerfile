# Use Apify base image
FROM apify/actor-node-playwright-chrome:18

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --no-optional

# Copy source code
COPY . ./

# Set up Apify
CMD npm start