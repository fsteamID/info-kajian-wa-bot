const { 
  WAConnection, 
  MessageType, 
  Presence
} = require('@adiwajshing/baileys');
const dayjs = require('dayjs');
const fs = require('fs-extra');
const {
  getAllSubscribers,
  addNewSubscriber
} = require('./helpers/subscriber-helper');
const {
  getAllSavedEvents,
  addNewEvent,
  validateTodayEvent
} = require('./helpers/event-helper');

// Configuring dayjs locale to use Indonesia
require('dayjs/locale/id');
dayjs.locale('id');

// All event that posted by allowed sender 
// on Info Kajian - Extra group will be saved
const allowedSenders = ['6287864423038@s.whatsapp.net'];

(async() => {
  const whatsapp = new WAConnection();
  
  // Send to all subscribers
  const sendTodayEvents = async function(to, event) {
    let destinations;
    let todayEvents;

    if (event) {
      todayEvents = [event];
    } else {
      const events = getAllSavedEvents();
      const today = dayjs().format('YYYY-MM-DD');
      todayEvents = events.filter(e => e.date == today);
    }

    if (!todayEvents) return;

    if (to) {
      destinations = [{ id: to }];
    } else {
      destinations = getAllSubscribers();
    }

    for (let i = 0; i < destinations.length; i++) {
      const s = destinations[i];
      await whatsapp.chatRead(s.id);
      await whatsapp.updatePresence(s.id, Presence.available);
      await whatsapp.updatePresence(s.id, Presence.composing);
      
      // Sending all today events
      for (let j = 0; j < todayEvents.length; j++) {
        const e = todayEvents[j];
        let content;
        let type;
        let options = {};
        if (e.type === 'image') {
          type = MessageType.image;
          content = fs.readFileSync(e.image);
          options.mimetype = e.mimetype;
          options.caption = e.caption ?? '';
        } else if (e.type === 'text') {
          type = MessageType.text;
          content = e.content;
        }

        await whatsapp.sendMessage(s.id, content, type, options)
          .catch(err => {
            console.log(`Failed to send event to ${s.id}`, err);
          });
      }
    }
  }

  // Try to use saved session
  try {
    whatsapp.loadAuthInfo ('./session.json')
  } catch (err) {
    console.log('No session saved before!');
  }

  whatsapp.on('open', () => {
    const authInfo = whatsapp.base64EncodedAuthInfo();
    fs.writeFileSync('./session.json', JSON.stringify(authInfo, null, '\t'));
  });

  whatsapp.on('chat-update', async chat => {
    // Only do something when a new message is received
    if (!chat.hasNewMessage) return;

    const m = chat.messages.all()[0];
    const messageContent = m.message;

    // If it is not a regular text or media message
    if (!messageContent) return;

    const sender = m.key.remoteJid;
    let group;

    // This is a group message
    if (m.key.remoteJid.endsWith('@g.us')) {
      try {
        group = await whatsapp.fetchGroupMetadataFromWA(m.key.remoteJid);
      } catch (err) {
        console.log('Error getting group info:', err);
      }
    }

    const messageType = Object.keys(messageContent)[0];
    const isAllowedExtra = m.key.participant && allowedSenders.includes(m.key.participant);
    
    if (messageType === MessageType.text) {
      const text = m.message.conversation;

      // Save today islamic event
      if (
        (
          group && 
          group.subject.toUpperCase() == 'SAHABAT UMMAT III' &&
          text.toUpperCase().startsWith('INFO KAJIAN HARI INI')
        ) 
        || 
        (
          group &&
          group.subject.toUpperCase() == 'INFO KAJIAN - EXTRA' && 
          (m.key.fromMe || isAllowedExtra)
        )
      ) {
        // Special check for SAHABAT UMMAT III
        // Validating the date
        if (group.subject.toUpperCase() == 'SAHABAT UMMAT III') {
          if (!validateTodayEvent(text)) return;
        }

        const today = dayjs().format('YYYY-MM-DD');
        const event = {
          type: 'text',
          date: today,
          content: text
        };

        // Store the event to file
        addNewEvent(event);

        console.log('New event added.');

        // Sending to all subscribers
        sendTodayEvents(null, event);
      } else if (text.toUpperCase() == 'REG INFO KAJIAN') {
        const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
        const subscriber = {
          id: sender,
          joined_at: now
        };

        // Save only if not subscribed yet!
        const subscribers = getAllSubscribers();
        const alreadyRegistered = subscribers.find(s => s.id == sender);

        let replyMessage;

        if (!alreadyRegistered) {
          addNewSubscriber(subscriber);
          replyMessage = '*Pendaftaran Berhasil.*\n\nMari ajak keluarga dan teman-teman tercinta untuk tetap menghadiri majelis ilmu. Baarakallahu fiikum.';
        } else {
          replyMessage = 'Anda sudah terdaftar sebelumnya. Baarakallahu fiikum.';
        }

        await whatsapp.chatRead(sender);
        await whatsapp.updatePresence(sender, Presence.available);
        await whatsapp.updatePresence(sender, Presence.composing);

        whatsapp.sendMessage(sender, replyMessage, MessageType.text)
          .then(() => {
            // Send all today events to this new subscriber only
            sendTodayEvents(sender);
          }).catch(err => {
            console.log('Failed to send reply reg message!', err);
          });
      }
    } else if (
      messageType === MessageType.image &&
      group &&
      group.subject.toUpperCase() == 'INFO KAJIAN - EXTRA' && 
      (m.key.fromMe || isAllowedExtra)
    ) {
      try {
        // Problem with downloading own message
        // We need to fetch from WA first
        const messages = await whatsapp.fetchMessagesFromWA(m.key.remoteJid, 1, { id: m.key.id });
        const mTmp = messages[0];
        const imageMessage = m.message[messageType];

        // Create the folder if not exists
        fs.ensureDirSync('./media');

        const savedFile = await whatsapp.downloadAndSaveMediaMessage(mTmp, './media/media_in_' + m.key.id);
        const today = dayjs().format('YYYY-MM-DD');
        const event = {
          type: 'image',
          date: today,
          caption: imageMessage.caption ?? '',
          image: savedFile,
          mimetype: imageMessage.mimetype
        };

        // Store the event to file
        addNewEvent(event);

        // Sending to all subscribers
        sendTodayEvents(null, event);
      } catch (err) {
          console.log('error in decoding message: ' + err)
      }
    } else {
      console.log(`No action defined for message type: ${messageType}`);
    }
    
  });

  await whatsapp.connect();
})();

