const path = require('path');
const fs = require('fs');

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
if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
	console.log("Please set the TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables in your .env file. \nYou can find your Twilio credentials at https://www.twilio.com/console")
	process.exit(1)
}

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID // 'your_account_sid';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN // 'your_auth_token';
const TWILIO_TO_PHONE_NUMBER = process.env.TWILIO_TO_PHONE_NUMBER // '+15005550006';
const TWILIO_FROM_PHONE_NUMBER = process.env.TWILIO_FROM_PHONE_NUMBER // '+15005550006';
const SERVER_URL = process.env.SERVER_URL // 'https://e769-2a00-79e1-abc-1566-e0b3-2fdb-1f6f-366a.ngrok-free.app';

const twilio = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
const VoiceResponse = require('twilio').twiml.VoiceResponse

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

	// How will GPT know when to stop phone call?
	if (req.session.messages == undefined) {
		req.session.messages = [{role:"system", content:"You are an assistant ordering a pizza for your boss. " +
		"You are on the phone with the pizza place. Your boss wants a large pepperoni pizza delivered to 123 Main Street."}]
	}
	req.session.messages.push({role: "user", content: req.body.message})

	const chatCompletion = await openai.createChatCompletion({
		model: "gpt-3.5-turbo",
		messages: req.session.messages,
	})

	var reply = chatCompletion.data.choices[0].message

	req.session.messages.push(reply)
	console.log(req.session.messages)

	res.send(reply.content)
})

async function whatShouldISay(whatTheySaid) {

	var reply = whatTheySaid // TODO: Replace this with something real

	return(reply)
}


async function make_call(toPhoneNumber, fromPhoneNumber){
	var response = new VoiceResponse();

	response.gather({
		input: 'speech',
		action: SERVER_URL + '/speech_input'
	})


	var call = await twilio.calls.create({
		twiml: response.toString(),
		to: TWILIO_TO_PHONE_NUMBER,
		from: TWILIO_FROM_PHONE_NUMBER
	})

	return("Done")
}

app.post('/call', async (req, res) => {

	const toPhoneNumber = req.body.phoneNumber
	const fromPhoneNumber = TWILIO_FROM_PHONE_NUMBER
	const name = req.body.name

	console.log(`Making a test call to ${toPhoneNumber}`)

	var result = await make_call(toPhoneNumber, fromPhoneNumber)
	res.render("call", {
		name: name
	})
})


app.post('/speech_input', async (req, res) => {

	console.log("User said: ", req.body.SpeechResult)

	var reply = await whatShouldISay(req.body.SpeechResult)

	var response = new VoiceResponse()
	
	response.say(reply)

	response.gather({
		input: 'speech',
		action: SERVER_URL + '/speech_input'
	})

	res.type('text/xml')
	res.send(response.toString())
})

// make_call(TWILIO_TO_PHONE_NUMBER, TWILIO_FROM_PHONE_NUMBER)



app.listen(3000, () => {
	console.log('Example app listening on port 3000!')
})