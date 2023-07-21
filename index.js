// TODO: voice should sound less robotic
// TODO: decrease response latency
// TODO: don't hang up when there's a long pause
// TODO: say each digit of a phone number
// TODO: add a way to pay



const path = require('path');
const fs = require('fs');
const { Buffer } = require('buffer');

// Express: Server
const express = require('express')
const app = express()

// Express: Handlebars view engine
const handlebars = require('express-handlebars')

app.engine('handlebars', handlebars.engine({}));

app.set("view engine", 'handlebars');
app.set('views', path.join(__dirname, '/views'));


// Express: Session middleware
var session = require('express-session')

app.use(session({
	secret: 'GenZ Super Secret Key',
	cookie: { maxAge: 60000 },
	resave: true,
	saveUninitialized: true
}))

// Express: WebSockets
const WebSocket = require('ws');


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
const SERVER_DOMAIN = process.env.SERVER_DOMAIN // 'https://e769-2a00-79e1-abc-1566-e0b3-2fdb-1f6f-366a.ngrok-free.app';

const twilio = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
const VoiceResponse = require('twilio').twiml.VoiceResponse

// OpenAI
const { Configuration, OpenAIApi } = require("openai");

const OPENAI_API_KEY = process.env['OPENAI_API_KEY']
const openaiConfiguration = new Configuration({
	apiKey: OPENAI_API_KEY,
});
const openai = new OpenAIApi(openaiConfiguration);

var transcript = []

/******************************** Routes ********************************/


app.get('/', (req, res) => {
	res.render("call_form", {
		defaultToPhoneNumber: TWILIO_TO_PHONE_NUMBER,
		defaultFromPhoneNumber: TWILIO_FROM_PHONE_NUMBER,
	})
})

app.get('/call_simulator', async (req, res) => {
	res.render("call_simulator", {})
})

app.post('/call_simulator_message', async (req, res) => {

	// How do I store the messages over the phone call?
	// How do I parameterize the system prompt?
	// Address, pizza size, toppings
	if (req.session.messages == undefined) {
		req.session.messages = [{role:"system", content:"You are an executive assistant ordering a pizza for your boss. " +
		"You are on the phone with the pizza place. Your boss wants a large pepperoni pizza delivered to 123 Main Street. "+
		"Keep your responses short and conversational."}]
	}
	req.session.messages.push({role: "user", content: req.body.message})

	const chatCompletion = await openai.createChatCompletion({
		model: "gpt-3.5-turbo",
		messages: req.session.messages,
	})

	var reply = chatCompletion.data.choices[0].message

	req.session.messages.push(reply)
	//console.log(req.session.messages)

	res.send(reply.content)
})

async function whatShouldISay(whatTheySaid) {

	transcript.push({role: "user", content: whatTheySaid})
	const chatCompletion = await openai.createChatCompletion({
		model: "gpt-3.5-turbo",
		messages: transcript,
	})

	var reply = chatCompletion.data.choices[0].message

	transcript.push(reply)
	// console.log(transcript)

	return(reply.content)
}

function gather_speech(response){
	return response.gather({
		input: 'speech',
		action: 'https://' + SERVER_DOMAIN + '/speech_input',
		speechTimeout: 0.5
	})	
}


async function make_call(toPhoneNumber, fromPhoneNumber){
	console.log(`Making a call to ${toPhoneNumber}`)

	var twiml = new VoiceResponse()

	const start = twiml.start()
	start.stream({
		name: 'Twilio Audio Stream', // TODO: Replace this with something unique per phone call
		url: "wss://" + SERVER_DOMAIN + "/audio_stream",
		track: "both_tracks",
		statusCallback: "https://" + SERVER_DOMAIN + "/audiostream_status",
		statusCallbackMethod: "POST"
	})

	gather_speech(twiml)

	await twilio.calls.create({
		twiml: twiml.toString(),
		to: toPhoneNumber,
		from: fromPhoneNumber,
	})

	return("Done")
}

app.post('/call', async (req, res) => {

	const toPhoneNumber = req.body.toPhoneNumber
	const fromPhoneNumber = TWILIO_FROM_PHONE_NUMBER
	const name = req.body.name
	const deliveryAddress = req.body.deliveryAddress
	const pizzaSize = req.body.pizzaSize
	const toppings = req.body.toppings

	// Create system prompt
	transcript = [{role:"system", content:`You are an executive assistant ordering a pizza for your boss. ` +
	`Your boss wants a ${pizzaSize} sized pizza with ${toppings} delivered to ${deliveryAddress}. `+
	`The name for the order is ${name}. The phone number is ${fromPhoneNumber}. ` + 
	`You are on the phone with the pizza place. Keep your responses short and polite.`}]

	await make_call(toPhoneNumber, fromPhoneNumber)

	res.render("call", {
		name: name
	})
})


app.post('/speech_input', async (req, res) => {

	console.log("User said: ", req.body.SpeechResult)

	var reply = await whatShouldISay(req.body.SpeechResult)

	console.log("Assistant said: ", reply)

	var response = new VoiceResponse()	
	response.say(reply)

	gather_speech(response)

	res.type('text/xml')
	res.send(response.toString())
})

app.post('/audiostream_status', async (req, res) => {
	// console.log("Audio stream status: ", req.body)
	res.send("Done")
})













const ts = require('tailing-stream')
const WaveFile = require('wavefile').WaveFile;


app.get('/eavesdrop', (req, res) => {
	const filePath = 'call_recording.wav';
	// const stat = fs.statSync(filePath);
  
	res.writeHead(200, {
	  'Content-Type': 'audio/wav',
	//   'Content-Length': stat.size
	});
  
	const readStream = ts.createReadStream(filePath, {
		beginAt: 0,
		onMove: 'stay',
		detectTruncate: true,
		onTruncate: 'end',
		endOnError: false		
	});

	console.log("Piping audio stream to browser")
	readStream.pipe(res);
});


// Create a WebSocket server that listens on the /audio_stream path
const wss = new WebSocket.Server({ noServer: true });

// Handle WebSocket connections
wss.on('connection', function connection(socket) {
  console.log('WebSocket connected');

  socket.on('message', (msg) => {
	const { event, ...message } = JSON.parse(msg);

  	switch (event) {
		case 'connected':
			console.log('Connected to Twilio Audio Stream');
			break;
		case 'start':
			console.log('Media stream started');

			let streamSid = message.start.streamSid;
			socket.wstream = fs.createWriteStream('call_recording.wav', { encoding: 'binary' });
			// This is a mu-law header for a WAV-file compatible with twilio format
			let header = Buffer.from([
				0x52,0x49,0x46,0x46,0x62,0xb8,0x00,0x00,0x57,0x41,0x56,0x45,0x66,0x6d,0x74,0x20,
				0x12,0x00,0x00,0x00,0x07,0x00,0x01,0x00,0x40,0x1f,0x00,0x00,0x80,0x3e,0x00,0x00,
				0x02,0x00,0x04,0x00,0x00,0x00,0x66,0x61,0x63,0x74,0x04,0x00,0x00,0x00,0xc5,0x5b,
				0x00,0x00,0x64,0x61,0x74,0x61,0x00,0x00,0x00,0x00, // Those last 4 bytes are the data length
			  ])
			socket.wstream.write(header);

			// wss.clients.forEach(function each(client) {
			// 	if (client !== socket && client.readyState === WebSocket.OPEN) {
			// 		// Send the audio data to the browser
			// 		client.send(header);
			// 	}
			// });

			break;
		case 'media':
			// console.log('Media chunk received');

			var payloadBinary = Buffer.from(message.media.payload, 'base64')
			// console.log(payloadBinary.length)
			// console.log(message.media.payload)

			socket.wstream.write(payloadBinary)



			
			const wav = new WaveFile();
			wav.fromScratch(1, 8000, '8m', payloadBinary);
			wav.fromMuLaw();
			wav.toSampleRate(44100);
			// let dataURI = wav.toDataURI();
			// item.audioPayload = dataURI;
			// this.sendAgentMessage(item, this.connection);			
			var wavDataURI = wav.toDataURI();

			// decode the base64-encoded data and write to stream
			
			// socket.wstream.write(wav.toBuffer());
			

			wss.clients.forEach(function each(client) {
				if (client !== socket && client.readyState === WebSocket.OPEN) {
					// Send the audio data to the browser
					// client.send(payloadBinary);
					client.send(wavDataURI);
				}
			});

			break;
		case 'stop':
			console.log('Media stream ended');

			// Now the only thing missing is to write the number of data bytes in the header
			socket.wstream.write("", () => {
				let fd = fs.openSync(socket.wstream.path, 'r+'); // `r+` mode is needed in order to write to arbitrary position
				let count = socket.wstream.bytesWritten;
				count -= 58; // The header itself is 58 bytes long and we only want the data byte length
				// console.log(count)
				fs.writeSync(
				fd,
				Buffer.from([
					count % 256,
					(count >> 8) % 256,
					(count >> 16) % 256,
					(count >> 24) % 256,
				]),
				0,
				4, // Write 4 bytes
				54, // starts writing at byte 54 in the file
				);
			});

			break;
		default:
			console.log('Unhandled event');
	}

  })
});

// Start the Expressserver
const server = app.listen(3000, () => {
  console.log('Example app listening on port 3000!')
});

// Start the WebSocket server
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/audio_stream') {
    wss.handleUpgrade(request, socket, head, (socket) => {
      wss.emit('connection', socket, request);
    });
  } else {
    socket.destroy();
  }
});


// make_call(TWILIO_TO_PHONE_NUMBER, TWILIO_FROM_PHONE_NUMBER)
// make_call('4156719694', TWILIO_FROM_PHONE_NUMBER)
