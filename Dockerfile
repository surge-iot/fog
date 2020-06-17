FROM node:lts-alpine
LABEL version="1.0.0"
LABEL maintainer="shinjan@cse.iitb.ac.in"

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV NODE_ENV=production \
	LOCAL_BROKER_URL=mqtt://localhost \
	REMOTE_BROKER_URL=mqtt://test.mosquitto.org \
    GATEWAY_SERIAL=oneboard-gateway-000 \
    ARP_ROOT=http://localhost:3000/api/arp/ \
    DOCKER_HUB_USERNAME=zgod \
    EXCLUDED_TOPICS=CAMERA/001,CAMERA/002

CMD ["npm", "run", "start"]
