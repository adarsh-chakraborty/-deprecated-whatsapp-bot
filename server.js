if (!process.env.HEROKU) {
  require('dotenv').config();
}

const express = require('express');
const app = express();

const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const axios = require('axios').default;
const { Client, MessageMedia } = require('whatsapp-web.js');
const AuthToken = require('./models/AuthToken');
const Notes = require('./models/Notes');
const List = require('./models/List');
const MeetLink = require('./models/MeetLink');
const qrcode = require('qrcode-terminal');
const gTTS = require('gtts');

const WEATHER_BASE_URL = `https://api.openweathermap.org/data/2.5/weather?q=`;

const API_KEY = `&appid=${process.env.API_KEY}&units=metric`;
const whitelist = new Map();
const meetlinks = new Map();
const ttslanguages = new Map([
  ['af', 'Afrikaans'],
  ['sq', 'Albanian'],
  ['ar', 'Arabic'],
  ['hy', 'Armenian'],
  ['ca', 'Catalan'],
  ['zh', 'Chinese'],
  ['zh-cn', 'Chinese (Mandarin/China)'],
  ['zh-tw', 'Chinese (Mandarin/Taiwan)'],
  ['zh-yue', 'Chinese (Cantonese)'],
  ['hr', 'Croatian'],
  ['cs', 'Czech'],
  ['da', 'Danish'],
  ['nl', 'Dutch'],
  ['en', 'English'],
  ['en-au', 'English (Australia)'],
  ['en-uk', 'English (United Kingdom)'],
  ['en-us', 'English (United States)'],
  ['eo', 'Esperanto'],
  ['fi', 'Finnish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['el', 'Greek'],
  ['ht', 'Haitian Creole'],
  ['hi', 'Hindi'],
  ['hu', 'Hungarian'],
  ['is', 'Icelandic'],
  ['id', 'Indonesian'],
  ['it', 'Italian'],
  ['ja', 'Japanese'],
  ['ko', 'Korean'],
  ['la', 'Latin'],
  ['lv', 'Latvian'],
  ['mk', 'Macedonian'],
  ['no', 'Norwegian'],
  ['pl', 'Polish'],
  ['pt', 'Portuguese'],
  ['pt-br', 'Portuguese (Brazil)'],
  ['ro', 'Romanian'],
  ['ru', 'Russian'],
  ['sr', 'Serbian'],
  ['sk', 'Slovak'],
  ['es', 'Spanish'],
  ['es-es', 'Spanish (Spain)'],
  ['es-us', 'Spanish (United States)'],
  ['sw', 'Swahili'],
  ['sv', 'Swedish'],
  ['ta', 'Tamil'],
  ['th', 'Thai'],
  ['tr', 'Turkish'],
  ['vi', 'Vietnamese'],
  ['cy', 'Welsh']
]);

whitelist.set(process.env.OWNER, process.env.OWNER);
whitelist.set(process.env.STICKER_GROUP, process.env.STICKER_GROUP);
whitelist.set(process.env.G10_GROUP, process.env.G10_GROUP);
whitelist.set(process.env.UNOFFICIAL_GROUP, process.env.UNOFFICIAL_GROUP);

if (!process.env.HEROKU)
  whitelist.set(process.env.TEST_GROUP, process.env.TEST_GROUP);

let sessionData;
let client;
const PORT = process.env.PORT || 3000;
let isActive = false;
let INTROVERT_MODE = true;
let ttslang = 'en';

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
    isActive = true;

    if (process.env.HEROKU) {
      client.setStatus(
        `Listening to !help 👨🏻‍💻. Uptime: ${formatTime(process.uptime())}`
      );
      client.sendMessage(process.env.OWNER, 'Doge bot is up and running! ✅🌍');
      return;
    }
  });

  /* @everyone when sending from main account. */
  /*
  client.on('message_create', async (message) => {
    if (message.body === '@everyone' && message.from === process.env.OWNER) {
      const chat = await message.getChat();
      let text = '';
      let mentions = [];

      for (let participant of chat.participants) {
        const contact = await client.getContactById(participant.id._serialized);

        mentions.push(contact);
        text += `@${participant.id.user} `;
      }

      await chat.sendMessage(text, { mentions });
    }
  });
*/
  client.on('message', async (message) => {
    if (!process.env.HEROKU) console.log('MESSAGE RECEIVED', message);
    if (message.isStatus) return;

    if (
      message.type === 'sticker' &&
      message.from != process.env.UNOFFICIAL_GROUP
    ) {
      console.log('Received a sticker!');
      const media = await message.downloadMedia();
      client.sendMessage(process.env.STICKER_GROUP, media, {
        sendMediaAsSticker: true,
        stickerName: 'Doge bot 🐕',
        stickerAuthor: 'Adarsh Chakraborty'
      });

      return;
    }

    if (message.body === '!whitelist' && message.author === process.env.OWNER) {
      if (whitelist.has(message.from)) {
        message.reply('This group already whitelisted. 🤔');
        return;
      }
      message.reply('Group whitelisted 📝✅');
      whitelist.set(message.from, message.from);
      return;
    }

    if (INTROVERT_MODE && !whitelist.has(message.from)) {
      return console.log(
        'Introvert mode is ON, not replying to stranger: ',
        message.from
      );
    }

    const msg = message.body.trim();

    if (msg === '!start') {
      if (isActive) {
        message.reply('Already Active!');
        return;
      }
      isActive = true;
      message.reply('Active ✅');
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
          `To: ${email.target}\n\nFrom: ${email.name} <${email.from}>\nSubject: ${email.subject}\nMessage: ${email.body}\n\n--- End of the E-mail ---\n\n*Confirm Send? <yes>*`
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

    if (msg === '!help') {
      let weather = await getWeather();
      let welcome_template = `
			*Welcome*
			${weather}
			*Stats*
			Uptime: ${formatTime(process.uptime())}
			
			*Available commands*

			*Notes*
			!note <text> (Add New Note)
			!notes (View all Notes)
			!del <note> (Delete Notes)
			!weather <cityname>
			
			*E-mail*
			!email !discard !send

      *Text-To-Speech*
      *!tts* <text>
      *!ttslang* <language>
      _Changes default TTS language_
      *!ttsall*
      _View All supported languages_
			
			*List*
			!list
			!li <Item1, Item2>
			!dlist (Deletes the entire list)
			!dl <index> (Remove # from list)

			*Other*
			!pause 
			!ping (Check if bot is active)
      !ts (Converts Image toSticker)
      !toimg (Converts Sticker toImage)
      
      ${INTROVERT_MODE ? `IntrovertMode is ON 😬` : `IntrovertMode is OFF 😄`}
      
      *Tagging Everyone:*

      Either start your message like
      *@everyone your msg..*

      OR, Reply to a message with
      *@everyone*
      OR, Send a *@everyone* in chat.
      `;
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

    if (msg === '!ttsall') {
      let text = '';
      for (const [key, language] of ttslanguages) {
        text += `*${key}* - ${language}\n`;
      }
      client.sendMessage(message.from, text);
      return;
    }

    if (msg.startsWith('!ttslang')) {
      const lang = msg.split(' ')[1];
      if (lang && ttslanguages.has(lang)) {
        ttslang = lang;
        message.reply(`TTS language set to *${ttslanguages.get(lang)}*. 😀`);
        return;
      }
      message.reply(
        `Language *${lang}* is not supported.\nType *!ttsall* to view all supported languages.`
      );
      return;
    }

    if (msg.startsWith('!tts')) {
      const text = msg.split('!tts')[1].trim();
      console.log(text);
      if (!text)
        return await message.reply('❌ Invalid syntax! Try !tts <text>');

      const gtts = new gTTS(text, ttslang);
      gtts.save('./audio.mp3', async function (err, result) {
        if (err) {
          return;
        }
        const audioMsg = await MessageMedia.fromFilePath('./audio.mp3');

        client.sendMessage(message.from, audioMsg, { sendAudioAsVoice: true });
      });
      return;
    }

    if (msg === '!ts') {
      if (!message.hasQuotedMsg) {
        message.reply(
          'Please using this command while replying to an Image. 😑'
        );
        return;
      }

      const quotedMsg = await message.getQuotedMessage();

      if (quotedMsg.type !== 'image') {
        quotedMsg.reply('This is not an Image. 😑');
        return;
      }

      const media = await quotedMsg.downloadMedia();
      const result = await client.sendMessage(message.from, null, {
        media: media,
        sendMediaAsSticker: true,
        stickerName: 'Doge bot 🐕',
        stickerAuthor: 'Adarsh Chakraborty'
      });
      console.log(result);
      return;
    }

    if (msg === '!toimg') {
      if (!message.hasQuotedMsg) {
        message.reply(
          'Please using this command while replying to a sticker 😑'
        );
        return;
      }

      const quotedMsg = await message.getQuotedMessage();

      if (quotedMsg.type !== 'sticker') {
        quotedMsg.reply('This is not sticker. 😑');
        return;
      }

      const media = await quotedMsg.downloadMedia();
      const result = await client.sendMessage(message.from, null, {
        media: media
      });
      console.log(result);
      return;
    }

    if (msg.startsWith('@everyone')) {
      const chat = await message.getChat();
      let text = '';
      let mentions = [];

      // 3 cases
      // If message === everyone & has quoted Message
      // Send Reply to original message
      if (msg === '@everyone' && message.hasQuotedMsg) {
        const quotedMsg = await message.getQuotedMessage();

        for (let participant of chat.participants) {
          const contact = await client.getContactById(
            participant.id._serialized
          );

          mentions.push(contact);
          text += `@${participant.id.user} `;
        }

        // await chat.sendMessage(text, { mentions });
        await quotedMsg.reply(text, message.from, { mentions });
        return;
      }
      // If message is only @everyone without quote
      // Send a message mentioning everyone
      if (msg === '@everyone') {
        for (let participant of chat.participants) {
          const contact = await client.getContactById(
            participant.id._serialized
          );

          mentions.push(contact);
          text += `@${participant.id.user} `;
        }

        await chat.sendMessage(text, { mentions });

        return;
      }

      // Message starts with @everyone
      // Mention everyone on the message.

      for (let participant of chat.participants) {
        const contact = await client.getContactById(participant.id._serialized);

        mentions.push(contact);
        text += `@${participant.id.user} `;
      }

      await message.reply(text, message.from, { mentions });

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

    if (msg.toLowerCase().endsWith('link')) {
      const subjectlink = msg.split(' ');
      if (subjectlink.length !== 2) {
        return;
      }
      const subject = subjectlink[0].toLowerCase();
      let meetLink;
      if (meetlinks.has(subject)) {
        meetLink = { subject: subject, link: meetlinks.get(subject) };
      } else {
        meetLink = await MeetLink.findOne({ subject });
        if (!meetLink) return;
        meetlinks.set(meetLink.subject, meetLink.link);
      }

      if (message.hasQuotedMsg) {
        const quotedMsg = await message.getQuotedMessage();
        quotedMsg.reply(`Subject: ${subject}\nMeet Link: ${meetLink.link}`);
        return;
      }
      message.reply(`Subject: ${subject}\nMeet Link: ${meetLink.link}`);
      return;
    }

    if (msg.startsWith('!setlink')) {
      const args = msg.split(' ');
      const subject = args[1]?.toLowerCase();
      const link = args[2];
      if (!subject || !link || args[0] !== '!setlink') {
        message.reply('Invalid syntax ❌\nTry !setlink <subject> <link>');
        return;
      }
      if (!isValidURL(link)) {
        message.reply('*Validation Error!*\nInvalid Link 🔗⛔');
        return;
      }
      const existingLink = await MeetLink.findOne({ subject });
      if (existingLink) {
        existingLink.link = link;
        await existingLink.save();
        message.reply(`${subject} link updated. ✅`);
        meetlinks.set(subject, link);
        return;
      }
      const result = await MeetLink.create({ subject, link });
      if (result) {
        message.reply(`${subject} link created ✅`);
        return;
      }
      message.reply('Something went wrong, could not set the link.');
      return;
    }

    // On Message Event Ends Here
  });

  client.on('auth_failure', (msg) => {
    console.error('AUTHENTICATION FAILURE', msg);
    process.exit(1);
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
  res.status(200).json({
    Active: isActive,
    INTROVERT_MODE,
    Timestamp: d.toLocaleString(),
    totalUptime: formatTime(process.uptime())
  });
  if (!client || !sessionData || !isActive) return;
  client.setStatus(
    `Listening to !help 👨🏻‍💻. Uptime: ${formatTime(process.uptime())}`
  );
});

app.get('/sleep', (req, res, next) => {
  const token = req.header('SLEEP_SECRET');
  if (token === process.env.SLEEP_SECRET) {
    if (!client || !sessionData || !isActive)
      return res.status(500).json({ message: ' Doge BOT is not ready' });

    setTimeout(() => {
      console.log('Sleeping...');
      client.setStatus(
        `Sleeping 😴😴😴 Will be available tomorrow from 9am. 👨🏻‍💻`
      );
      client.sendMessage(
        process.env.OWNER,
        `I'm going to sleep in approx 25 mins,good night sur 😃`
      );
    }, 1500000);

    return res.json({ message: 'Command accepted!' });
  }
  res.json({ message: 'Not authorized, Token missing' });
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
      return `
      ${main} in *${city}*.
      ${desc} ${emoji}.
      Feels like *${temp}℃*
      `;
    }
    return `
    Weather is ${main} in *${city}*.
    ${desc} ${emoji}.
    Feels like *${temp}℃*
    `;
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

function isValidURL(url) {
  return /^(?:\w+:)?\/\/([^\s\.]+\.\S{2}|localhost[\:?\d]*)\S*$/.test(url);
}
