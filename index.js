const path = require('path');

// Express (server)
const express = require('express')
const app = express()

// Express Handlebars (view engine)
const handlebars = require('express-handlebars')

// Use the session middleware
var session = require('express-session')

app.use(session({
	secret: 'GenZ Super Secret Key',
	cookie: { maxAge: 60000 },
	resave: true,
	saveUninitialized: true
}))

// View engine setup
app.engine('handlebars', handlebars.engine({}));

app.set("view engine", 'handlebars');
app.set('views', path.join(__dirname, '/views'));

//Static Folder
app.use('/public', express.static(path.join(__dirname, 'public')))

//Body Parser MiddleWars;
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Twilio
const twilio = require('twilio');
const VoiceResponse = twilio.twiml.VoiceResponse;

if(!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log("Please set the TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables in your .env file. \nYou can find your Twilio credentials at https://www.twilio.com/console")
    process.exit(1)
}

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID // 'your_account_sid';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN // 'your_auth_token';
const TWILIO_TO_PHONE_NUMBER = process.env.TWILIO_TO_PHONE_NUMBER // '+15005550006';
const TWILIO_FROM_PHONE_NUMBER = process.env.TWILIO_FROM_PHONE_NUMBER // '+15005550006';


/******************************** Routes ********************************/


app.get('/', (req, res) => {
    res.render("call_form", {
        defaultToPhoneNumber: TWILIO_TO_PHONE_NUMBER,
    })
})

app.post('/call', (req, res) => {

    const toPhoneNumber = req.body.phoneNumber
    const fromPhoneNumber = TWILIO_FROM_PHONE_NUMBER

    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

    const twiml = new VoiceResponse()
    twiml.say(`Calling ${toPhoneNumber} to order a pizza.`)

    client.calls
    .create({
       url: 'http://demo.twilio.com/docs/voice.xml',
       to: toPhoneNumber,
       from: fromPhoneNumber
     })
    .then(call => console.log(call.sid));

    res.render("call", {
        phoneNumber: req.body.phoneNumber,
        name: req.body.name
    })
})

app.listen(3000, () => {
  console.log('Example app listening on port 3000!')
})