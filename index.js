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

// OpenAI
const { Configuration, OpenAIApi } = require("openai");

const OPENAI_API_KEY = process.env['OPENAI_API_KEY']
const openaiConfiguration = new Configuration({
    apiKey: OPENAI_API_KEY,
});
const openai = new OpenAIApi(openaiConfiguration);

/******************************** Routes ********************************/


app.get('/', (req, res) => {
    res.render("call_form", {
        defaultToPhoneNumber: TWILIO_TO_PHONE_NUMBER,
    })
})

app.get('/call_simulator', async (req, res) => {
    res.render("call_simulator", {})
})

app.post('/call_simulator_message', async (req, res) => {

    if(req.session.messages == undefined) {
        req.session.messages = []
    }

    const chatCompletion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{role: "user", content: "Hello world"}],
    })

    var reply = chatCompletion.data.choices[0].message

    req.session.messages.push(reply)

    res.send(reply.content)
})





app.post('/call', (req, res) => {

    const toPhoneNumber = req.body.phoneNumber
    const fromPhoneNumber = TWILIO_FROM_PHONE_NUMBER

    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

    const twiml = new VoiceResponse()
    twiml.say(`Calling ${toPhoneNumber} to order a pizza.`)

    client.calls
    .create({
       url: 'https://genzpt.bkgupta.repl.co/twiml',
       to: toPhoneNumber,
       from: fromPhoneNumber
     })
    .then(call => {
        console.log(call.sid)
    })

    res.render("call", {
        phoneNumber: req.body.phoneNumber,
        name: req.body.name
    })
})

app.post('/twiml', express.static('public', { method: 'POST' }));

// app.get('/listen', (request, response) => {
//     // Get the call SID from the request body
//     const callSid = request.body.CallSid;

//     // Create a TwiML response that will play the call audio
//     const twiml = new twilio.twiml.VoiceResponse();
//     twiml.play(callSid);

//     // Render the response as XML in reply to the webhook request
//     response.type('text/xml');
//     response.send(twiml.toString());
// });





app.listen(3000, () => {
  console.log('Example app listening on port 3000!')
})