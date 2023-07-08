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


/******************************** Routes ********************************/


app.get('/', (req, res) => {
    res.render("call_form")
//   res.send('Hello World!')
})

app.post('/call', (req, res) => {

    res.render("call", {
        phoneNumber: req.body.phoneNumber, 
        purpose: req.body.purpose
    })
})

app.listen(3000, () => {
  console.log('Example app listening on port 3000!')
})