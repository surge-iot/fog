'use strict';
const mqtt = require('mqtt');
const { Docker } = require('node-docker-api');

const dockerImagePrefix = process.env.DOCKER_IMAGE_PREFIX || "";
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
    const imageName = dockerImagePrefix + functionName;
    // List
    let containers = await docker.container.list();
    console.log(containers);
    containers = containers.filter(container => (container.data.Image === functionName));
    if (containers.length == 0) {
        // No running containers for our FOGMR function. Let's deploy it B)
        // await docker.image.create({}, { fromImage: imageName, tag: 'latest' })
        // const image = await docker.image.get(imageName).status();
        // console.log(image.status());
        // await docker.container.create({
        //     Image: imageName,
        //     name: `FOGMR-${functionName}`
        // })
        docker.image.create({}, { fromImage: imageName, tag: 'latest' })
            .then(stream => promisifyStream(stream))
            .then(() => docker.image.get(imageName).status())
            .then(image => {
                // Image pulled successfully
                docker.container.create({
                    Image: image.id,
                    name: `FOGMR-${functionName}`
                })
                    .then(container => container.start())
                    .then(console.log(`Started container for ${functionName}`))
                    .catch(error => console.log(error));
            })
            .catch(error => console.log("error", error))
    }
})

module.exports = executor;