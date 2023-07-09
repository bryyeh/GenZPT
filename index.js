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



/******************************** Routes ********************************/


app.get('/', (req, res) => {
    res.render("call_form")
})

app.post('/call', (req, res) => {

    const toPhoneNumber = req.body.phoneNumber
    const purpose = req.body.purpose
    const fromPhoneNumber = '555 555 5555'

    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

    const twiml = new VoiceResponse()
    twiml.say(`Calling ${toPhoneNumber} with the purpose of ${purpose}`)
  
    const callOptions = {
      to: toPhoneNumber,
      from: fromPhoneNumber,
      twiml: twiml.toString()
    }
  
    client.calls.create(callOptions)
      .then(call => {
        const callSid = call.sid
        const audioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}/Recordings.json`
  
        res.render('call', {
          audioUrl: audioUrl,
          phoneNumber: req.body.phoneNumber,
          purpose: req.body.purpose
        });
      })
      .catch(error => {
        console.log(error);
        res.status(500).send('Error making call');
      });    

    res.render("call", {
        phoneNumber: req.body.phoneNumber, 
        purpose: req.body.purpose
    })
})

app.listen(3000, () => {
  console.log('Example app listening on port 3000!')
})