if (!process.env.HEROKU) {
  require('dotenv').config();
}

const express = require('express');
const app = express();

const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const axios = require('axios').default;
const { Client } = require('whatsapp-web.js');
const AuthToken = require('./models/AuthToken');
const Notes = require('./models/Notes');
const List = require('./models/List');
const qrcode = require('qrcode-terminal');

const WEATHER_BASE_URL = `https://api.openweathermap.org/data/2.5/weather?q=`;

const API_KEY = `&appid=${process.env.API_KEY}&units=metric`;

let sessionData;
let client;
const PORT = process.env.PORT || 3000;
let isActive = true;

let user = {
  isComposing: false,
  isWritingSubject: false,
  isWritingBody: false,
  isWritingTarget: false,
  isWritingName: false,
  isWritingFrom: false,
  confirm: false
};

let email = null;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAILUSER,
    pass: process.env.MAILPASS
  }
});

const initServer = async () => {
  console.log('Initializing Server');

  client.initialize();
  client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log(qr);
  });

  client.on('ready', () => {
    console.log('Client is ready!');
    client.sendMessage(process.env.OWNER, 'Notes bot is up and running! ✅🌍');
    client.setStatus(`Uptime: ${formatTime(process.uptime())}`);
  });

  client.on('message', async (message) => {
    console.log('MESSAGE RECEIVED', message);
    if (message.isStatus) return;

    const msg = message.body.trim();

    if (msg === '!start') {
      isActive = true;
      message.reply('Active!');
      return;
    }

    if (!isActive) return;

    if (msg === '!discard') {
      user.isComposing = false;
      user.isWritingSubject = false;
      user.isWritingBody = false;
      user.isWritingTarget = false;
      user.isWritingName = false;
      user.confirm = false;
      user.isWritingFrom = false;
      email = null;
      client.sendMessage(message.from, 'Discarded. 🗑️');
      return;
    }
    if (msg === '!draft') {
      user.isComposing = false;
      user.isWritingSubject = false;
      user.isWritingBody = false;
      user.isWritingTarget = false;
      user.isWritingName = false;
      user.confirm = false;
      user.isWritingFrom = false;
      client.sendMessage(message.from, 'Draft Saved. 💾');
      return;
    }

    if (user.isComposing) {
      if (user.isWritingSubject) {
        if (msg.trim().length === 0) {
          message.reply('Please enter subject 😒');
          return;
        }

        email.subject = msg;
        user.isWritingSubject = false;
        user.isWritingBody = true;
        client.sendMessage(message.from, `Alright, What's the message?`);
        return;
      } else if (user.isWritingBody) {
        if (msg.trim().length === 0) {
          message.reply('Please enter some message 😒');
          return;
        }
        email.body = msg;
        user.isWritingBody = false;
        user.isWritingTarget = true;
        client.sendMessage(
          message.from,
          `Noted, To where should I send this e-mail?`
        );
        return;
      } else if (user.isWritingTarget) {
        if (msg.trim().length === 0) {
          message.reply('Please enter e-mail address of the recipient. 😒');
          return;
        }
        if (!isValidEmail(msg)) {
          message.reply('Please enter a valid e-mail address. 😒');
          return;
        }

        email.target = msg;
        user.isWritingTarget = false;
        user.isWritingFrom = true;
        client.sendMessage(
          message.from,
          'Enter your e-mail address, It will set as reply-to on the mail.'
        );
        return;
      } else if (user.isWritingFrom) {
        if (msg.trim().length === 0) {
          message.reply('Please your e-mail address. 😒');
          return;
        }
        if (!isValidEmail(msg)) {
          message.reply('Please enter a valid e-mail address. 😒');
          return;
        }
        user.isWritingFrom = false;
        user.isWritingName = true;
        email.from = msg;
        client.sendMessage(
          message.from,
          'Okay, What should be the name on the e-mail?'
        );
      } else if (user.isWritingName) {
        if (msg.trim().length === 0) {
          message.reply('Please enter your name 😒');
          return;
        }
        email.name = msg;
        user.isWritingName = false;
        user.confirm = true;
        client.sendMessage(
          message.from,
          'To: ${email.target}\n\nFrom: ${email.name} <${email.from}>\nSubject: ${email.subject}\nMessage: ${email.body}\n\n--- End of the E-mail ---\n\n*Confirm Send? <yes>*'
        );
      } else if (user.confirm) {
        user.isComposing = false;
        user.confirm = false;
        if (msg.toLowerCase() === 'yes' || msg.toLowerCase() === 'yus') {
          sendMail();
          client.sendMessage(message.from, 'Your e-mail was sent. ✅');
          return;
        }

        client.sendMessage(
          message.from,
          `E-mail saved to draft. Type !draft to check it.`
        );
      }

      return;
    }

    if (!msg.startsWith('!')) {
      let weather = await getWeather();
      let welcome_template = `
			*Welcome*
			${weather}
			*Stats*
			Uptime: ${formatTime(process.uptime())}
			Stop talking with the bot with !pause
			
			*Available commands*
			*Notes*
			!note <text> (Add New Note)
			!notes (View all Notes)
			!del <note> (Delete Notes)
			!weather <city || default=bilaspur>
			
			*E-mail*
			!email !discard !send
			
			*List*
			!list
			!li <Add Items separated by space>
			!dlist (Deletes the entire list)
			!dl <index> (Deletes # item from list)
			*Other*
			!ping
			!pause
			
			*Todos:*
			- Fetch Weather status
			- add authorization
			- add admin commands
			- weather forecast
			- Send E-mails`;
      return client.sendMessage(message.from, welcome_template);
    }

    if (msg === '!pause') {
      client.sendMessage(message.from, 'OKAY :(');
      isActive = false;
    }

    if (msg === '!ping') {
      message.reply('pong!');
      return;
    }

    if (msg.startsWith('!weather')) {
      if (msg === '!weather') {
        const weather = await getWeather();
        client.sendMessage(message.from, weather);
        return;
      }
      const cityName = msg.split('!weather')[1].trim();
      if (cityName) {
        const weather = await getWeather(cityName);
        client.sendMessage(message.from, weather);
        return;
      }
      client.sendMessage(
        message.from,
        `!weather <cityName> (Default Bilaspur)`
      );
    }

    if (msg === '!notes') {
      const docs = await Notes.find();
      console.log(docs);
      if (docs.length > 0) {
        let index = 1;
        for (let note of docs) {
          client.sendMessage(message.from, `${index}. ${note.text}`);
          index++;
        }
        return;
      }
      client.sendMessage(
        message.from,
        'No Notes found! Add using !note <text>'
      );
      return;
    }

    if (msg.startsWith('!note')) {
      const text = msg.split('!note')[1].trim();
      const res = await Notes.create({ text });
      console.log(res);
      client.sendMessage(message.from, `${text} ✅`);
      return;
    }

    if (msg.startsWith('!del')) {
      const note = msg.split('!del')[1].trim();
      const res = await Notes.deleteMany({ text: note });
      console.log(res);
      const { deletedCount } = res;
      if (deletedCount === 0) {
        client.sendMessage(message.from, `${note} not found in notes❓`);
        return;
      }
      client.sendMessage(
        message.from,
        `${note} ❌ - ${deletedCount} notes were deleted!`
      );
      return;
    }

    if (msg === '!list') {
      const mylist = await List.findOne();
      if (!mylist) {
        client.sendMessage(message.from, `Your list is empty.`);
        return;
      }
      const { items } = mylist;
      console.log(items);
      if (items.length > 0) {
        let index = 1;
        const temp = items.map((li) => {
          return `${index++}. ${li}`;
        });
        client.sendMessage(message.from, temp.join('\n'));
        return;
      }
      client.sendMessage(message.from, 'Your list is empty!');
      return;
    }

    if (msg.startsWith('!li')) {
      const temp = msg.split('!li ');
      if (!temp[1]) {
        client.sendMessage(
          message.from,
          `*Syntax Error!*\nUsage: !li <items separated by space>`
        );
        return;
      }
      const items = temp[1].split(' ');
      console.log(items);
      List.findOne({}, (err, docs) => {
        if (err) {
          console.log(err);
          return;
        }
        if (docs) {
          const updatedList = [...docs.items, ...items];
          docs.items = updatedList;
          docs.save();
          client.sendMessage(
            message.from,
            `*+* ${items.length} items added to list! 🖊️`
          );
          return;
        }

        List.create({ items: items });
        client.sendMessage(
          message.from,
          `*List created!* ${items.length} items added to list! 🖊️`
        );
        return;
      });
      // List.findOneAndUpdate(
      // 	{},
      // 	{ items },
      // 	{ upsert: true, new: true },
      // 	(err, docs) => {
      // 		console.log(docs);
      // 		if (err) {
      // 			return console.log(err);
      // 		}
      // 		client.sendMessage(
      // 			message.from,
      // 			`${items.length} items added to list! 🖊️`
      // 		);
      // 	}
      // );
      return;
    }

    if (msg === '!dlist') {
      const res = await List.findOneAndDelete({});
      if (res) {
        client.sendMessage(message.from, `List deleted.🤞`);
        return;
      }
      client.sendMessage(message.from, `Your list is empty.`);
      return;
    }

    if (msg.startsWith('!dl')) {
      const indexes = msg.split('!dl ')[1].split(' ');
      if (indexes.length > 1 || isNaN(indexes)) {
        client.sendMessage(
          message.from,
          `Syntax Error! [dl <index>]\nPlease give only one index at a time.)`
        );
        return;
      }

      if (indexes < 1) {
        client.sendMessage(message.from, `!dl <Enter a valid Integer> 😠`);
        return;
      }

      const mylist = await List.findOne();
      if (!mylist) {
        client.sendMessage(message.from, `Your list is empty. 😏`);
        return;
      }
      const { items } = mylist;
      // get existing item
      const eitem = items[indexes - 1];
      if (!eitem) {
        client.sendMessage(message.from, `Item doesn't exists in list. 😏`);
        return;
      }
      const newlist = items.filter((i) => i !== eitem);
      console.log(newlist);

      List.findOneAndUpdate(
        {},
        { items: newlist },
        { new: true, setDefaultsOnInsert: true },
        (err, docs) => {
          if (err) {
            return console.log(err);
          }
          client.sendMessage(
            message.from,
            `*-* ${eitem} removed from your list. 😀`
          );
        }
      );
      return;
    }

    if (msg === '!email') {
      email = {};
      user.isComposing = true;
      user.isWritingSubject = true;

      client.sendMessage(
        message.from,
        `
				*Composing E-mail* 📧
				You're composing an e-mail now!

				Type *!discard* to discard anytime.
				Type *!draft* to save as draft.
				
				So, what's the subject?`
      );
    }

    if (msg === '!send') {
      client.sendMessage(
        message.from,
        `*Composing E-mail* 📧

				You're composing an e-mail now!
				Type !cancel to discard anytime. *!draft* to save as draft.
				
				So, what's the subject?`
      );
    }
  });

  client.on('auth_failure', (msg) => {
    console.error('AUTHENTICATION FAILURE', msg);
  });

  // save session
  client.on('authenticated', (session) => {
    // AuthToken.create(session).then(() => {
    // 	console.log('Saved Token to mongodb');
    // });

    AuthToken.findOneAndUpdate(
      {},
      session,
      { upsert: true, new: true, setDefaultsOnInsert: true },
      (err, docs) => {
        if (err) {
          return console.log(err);
        }
        console.log(docs);
      }
    );
  });
};
mongoose.connect(
  process.env.MONGODB_URI,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true
  },
  () => {
    // Connected to mongoDB
    app.listen(PORT);
    AuthToken.findOne()
      .select('-_id -__v -updatedAt -createdAt')
      .then((doc) => {
        if (doc) {
          console.log('Found previous auth, re-using that!');
          console.log(doc);
          sessionData = doc;
        }
        client = new Client({
          puppeteer: { args: ['--no-sandbox'] },
          session: sessionData // saved session object
        });

        initServer();
      });
  }
);

const formatTime = (str) => {
  let sec_num = parseInt(str, 10); // don't forget the second param
  let hours = Math.floor(sec_num / 3600);
  let minutes = Math.floor((sec_num - hours * 3600) / 60);
  let seconds = sec_num - hours * 3600 - minutes * 60;

  if (hours < 10) {
    hours = '0' + hours;
  }
  if (minutes < 10) {
    minutes = '0' + minutes;
  }
  if (seconds < 10) {
    seconds = '0' + seconds;
  }
  let time = hours + ':' + minutes + ':' + seconds;
  return time;
};

app.get('/', (req, res, next) => {
  const d = new Date();
  res.status(200).json({ Active: isActive, Timestamp: d.toLocaleString() });
  const hour = d.getHours();
  const min = d.getMinutes();
  if (!client) return;
  client.setStatus(`Available 😃 (Uptime: ${formatTime(process.uptime())})`);

  if (hour === 23 && min >= 45) {
    setTimeout(() => {
      console.log('Sleeping...');
      client.setStatus(`Sleeping 😴😴😴 Will be available again from 12pm`);
      client.sendMessage(
        process.env.OWNER,
        `I'm going to sleep in approx 25 mins,good night sur 😃`
      );
      client.sendMessage(d.toISOString());
    }, 1500000);
  }
});

async function getWeather(city = 'bilaspur') {
  try {
    const response = await axios.get(WEATHER_BASE_URL + city + API_KEY);
    data = response.data;
    let main = data.weather[0].main;
    let desc = data.weather[0].description;
    const temp = data.main.temp;
    let emoji = `🌤️`;
    if (desc.includes('rain')) {
      emoji = '🌧️';
    } else if (desc.includes('clear')) {
      emoji = '☀️';
    } else if (desc.includes('clouds')) {
      emoji = '🌤';
    } else if (desc.includes('drizzl')) {
      emoji = '🌩️';
    } else if (desc.includes('haze')) {
      emoji = '🌫️';
    }

    if (main === 'Clouds') {
      return `${main} in ${city}. ${desc} ${emoji}
	   	It's currently ${temp}℃ in ${city}`;
    }
    return `Weather is ${main} in ${city}. ${desc} ${emoji}
		It's currently ${temp}℃ in ${city}`;
  } catch (error) {
    console.error(error);
  }
  return `Some error occured.`;
}

function sendMail() {
  console.log('Sending mail', email);
  let mailOptions = {
    from: `${email.name} <${email.from}>`,
    to: email.target,
    replyTo: email.from,
    subject: email.subject,
    text: email.body
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return `Some error occured while trying to send the mail.
			 ${error}`;
    } else {
      console.log('Email sent: ' + info.response);
      return `Email sent ✔️
			${info.response}`;
    }
  });
}

function isValidEmail(str) {
  const pattern =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
  if (str.match(pattern)) {
    return true;
  }
  return false;
}
