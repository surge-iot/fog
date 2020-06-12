# Oneboard Gayeway

Handles device registration with oneboard-api and message forwarding between local and remote brokers.


# Getting started
* Provide the following environment variablesin a .env file like this:
```
LOCAL_BROKER_URL=mqtt://localhost
REMOTE_BROKER_URL=mqtt://test.mosquitto.org
GATEWAY_SERIAL=oneboard-gateway-000
ARP_ROOT=http://localhost:3000/api/arp/
```
By default it will try to connect to localhost

* Install dependencies
```
npm install
```

* Run
```
npm start
```

A `Dockerfile` has been provided to build a Docker image from this repository.
Also provided a `docker-compose.yml` file to quickly deploy an MQTT broker, a node-red server 
and this application by just running
```
docker-compose up -d --build
```
It accepts the same environment variables that you can specify in `.env` as mentioned above