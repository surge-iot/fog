'use strict';
const mqtt = require('mqtt');
const { Docker } = require('node-docker-api');

const dockerHubUsername = process.env.DOCKER_HUB_USERNAME || "";
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const promisifyStream = (stream) => new Promise((resolve, reject) => {
    stream.on('data', (d) => console.log(d.toString()))
    stream.on('end', resolve)
    stream.on('error', reject)
})
const gatewaySerial = process.env.GATEWAY_SERIAL || 'oneboard-gateway-000';
const fogmrMqttClient = mqtt.connect(process.env.REMOTE_BROKER_URL || 'mqtt://localhost', {
    clientId: `GATEWAY/${gatewaySerial}/FOGMR/executor`,
    clean: true,
    will: {
        topic: `STATUS/${gatewaySerial}`,
        payload: "x_x", // dead message
        qos: 2,
        retain: true
    }
});
const executor = function () {
    fogmrMqttClient.on('connect', function () {
        fogmrMqttClient.publish(`STATUS/${gatewaySerial}`, ":D"); //alive message
        fogmrMqttClient.subscribe(`GATEWAY/${gatewaySerial}/FOGMR/#`, function () {
            console.log("Subscribed to receive FOGMR messages");
        }); // subscribe to FOGMR messages
    })
}

fogmrMqttClient.on('message', async function (topic, message) {
    message = JSON.parse(message.toString());
    if (!message.active) {
        return;
    }

    const functionName = topic.split('/')[3]; // GATEWAY/<gateway-serial>/FOGMR/<function-name>/<function-instance-id>/<map or reduce>/<map-target>
    const imageName = `${dockerHubUsername}/${functionName}`;
    console.log("Received FOGMR trigger for "+imageName);
    // List
    let containers = await docker.container.list();
    containers = containers.filter(container => (container.data.Image === imageName));
    if (containers.length == 0) {
        console.log(`Container for ${imageName} is not running. Let's deploy it B)`);
        // No running containers for our FOGMR function. Let's deploy it B)
        docker.image.create({}, { fromImage: imageName, tag: 'latest' })
            .then(stream => promisifyStream(stream))
            .then(() => docker.image.get(imageName).status())
            .then(image => {
                // Image pulled successfully
                docker.container.create({
                    Image: image.id,
                    name: `FOGMR-${functionName}`,
                    HostConfig:{
                        NetworkMode:"container:oneboard-mosquitto"
                    }
                })
                    .then(container => container.start())
                    .then(console.log(`Started container for ${functionName}`))
                    .catch(error => console.log(error));
            })
            .catch(error => console.log("error", error))
    }
    else{
        console.log("Container is already running. Ciao!")
    }
})

module.exports = executor;