# [Deprecated]

Doge bot code base updated to bailey's whatsapp web api, this repository is now only for reference purpose. The new repository is private.


~# WhatsApp Bot~

~This is a simple WhatsApp bot, I've used `Whatsapp web.js` library for the API, and MongoDB in backend to save the credentials.~

### Things you can do with the bot

### Ask Weather

`!weather` - Tells current weather in default city. (Bilaspur).

`!weather <cityName` - Current weather in the mentioned city.

### Add Notes

`!note <text>` - Adds a Note
`!notes` - Lists all the notes

`!del <note>` - Deletes the mentioned note. (All occurances, Even dublicates)

_In future, It will deleted by Index of the note, Instead of typing the full note._

### Make a List

`!list` - Lists all the items in the list.

`!dlist` - Deletes the entire list

`!li <item>` - Add Items in the list.

_You can add multiple items separated by commas, that's what makes it different from notes._

`!dl <index>` - Removes a specific item from the list.

### Send E-mails

`!email` - Start composing an e-mail, follow the instructions.
`!discard` - Discard composing e-mail.

### Controls

`!pause` - Pause the bot, It will still be online but won't respond to command.
`!start` - Start the bot again, It will become active.

---

Send any message to the bot, It will reply back with a template message which consists

- Weather of default city. (bilaspur)
- Bot uptime
- All the commands and todos

### Instructions for the users of this bot.

If you are one of the users who's using my Instance of the bot, here are some information.

The Bot currently have 1 Instance of notes & list, so all the information is shared across users so please don't share any confidential data to the bot.

#### The Bot is hosted on Free tier on heroku

I've set it up such that It will be online from 12 PM to 12 AM everyday IST (I wake up at 11 so..)~
