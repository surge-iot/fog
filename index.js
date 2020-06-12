require('dotenv').config()
const mqtt = require('mqtt');
const _ = require('lodash');
const axios = require('axios');

const gatewaySerial = process.env.GATEWAY_SERIAL || 'oneboard-gateway-000';
const arpRoot = process.env.ARP_ROOT || 'http://localhost:3000/api/arp/'

// Connect to local and remote MQTT brokers
const localMqttClient = mqtt.connect(process.env.LOCAL_BROKER_URL || 'mqtt://localhost', {
    clientId: gatewaySerial,
    clean: false
});
const remoteMqttClient = mqtt.connect(process.env.REMOTE_BROKER_URL || 'mqtt://localhost', {
    clientId: gatewaySerial,
    clean: true
});

// Register the gateway with ARP server
axios.post(`${arpRoot}gateway/${gatewaySerial}/update-ip`, {})
    .then(function (response) {
        console.log("Gateway IP registered");
    })
    .catch(function (error) {
        console.log("Could not register gateway IP");
    });

localMqttClient.on('connect', function () {
    console.log('Connected to local broker');
    // Subscribe to local MQTT's log to receive a notification when a subscription happens
    localMqttClient.subscribe('$SYS/broker/log/M/subscribe', { qos: 2 });
    // Subscribe to all device publications
    localMqttClient.subscribe('#', { qos: 0 });
})

remoteMqttClient.on('connect', function () {
    console.log('Connected to remote broker');
})

localMqttClient.on('message', function (topic, message) {
    // message is Buffer
    let deviceSerial;

    switch (topic) {
        case '$SYS/broker/log/M/subscribe':
            // New device subscribed to local MQTT. 
            // Add to consumers list
            const msgStr = message.toString();
            if (msgStr.split(" ")[1] === gatewaySerial) {
                return;
            }
            console.log(msgStr);
            // Extract topic from syslog message
            const t = _.last(msgStr.split(" "));
            deviceSerial = getSerialFromTopic(t);
            registerDevice(deviceSerial, "consumer");
            remoteMqttClient.subscribe(t, { qos: 2 }, function(){
                console.log("Subscribed to remote broker for "+t);
            });
            break;
        default:
            // Any other message means a device published some message
            // Extract the device serial from topic and save as a producer
            deviceSerial = getSerialFromTopic(topic);
            var device = registerDevice(deviceSerial, "producer");
            if(device.type === "consumer"){
                // This happens when a consumer message from remote broker is forwarded by gateway to local broker
                // leading to an infinite loop of messages betweek remote broker and local broker
                break;
            }

            // Forward the message to remote broker
            remoteMqttClient.publish(topic, message);
            break;
    }
});

// Anything received from remote broker must be forwarded as is
remoteMqttClient.on('message', function (topic, message) {
    localMqttClient.publish(topic, message);
})

function getSerialFromTopic(topic) {
    return _.last(_.last(topic.split(" ")).split('/'))
}
function registerDevice(deviceSerial, deviceType, topic) {
    // If this producer has already been registered, ignore it.
    if (devices[deviceSerial]) {
        return devices[deviceSerial];
    }
    devices[deviceSerial] = {
        type: deviceType,
        topic: topic
    }

    // Register the produce with ARP server
    axios.post(`${arpRoot}device/${deviceSerial}/update-gateway/${gatewaySerial}`, {})
        .then(function (response) {
            console.log(`${deviceSerial} registered with gateway`);
        })
        .catch(function (error) {
            console.log(`Could not register ${deviceSerial} with gateway`);
        });
    return devices[deviceSerial];
}

let devices = {};
