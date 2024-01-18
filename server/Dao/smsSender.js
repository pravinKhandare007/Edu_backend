const client = require('twilio');

client.messages
    .create({
        body: 'Hi, this is Twilio sent message.',
        from: '+12565673553',
        to: '+917726022012'
    })
    .then(message => console.log(message.sid))
    .done();