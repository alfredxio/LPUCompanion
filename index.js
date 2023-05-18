//latest18.05.23
const TelegramBot = require('node-telegram-bot-api');
const getDetails = require('./getDetails');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const cron = require('node-cron');
const keys = require('./tokens');
const Cryptr = require('cryptr');
const bot = new TelegramBot(keys.telebotkey, { polling: true });
mongoose.set('strictQuery', false);
mongoose.connect(keys.mongouri, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.log('Error with mongoDB'));

const userSchema = new mongoose.Schema({
    chatId: {type: Number,required: true,unique: true},
    id: {type: String,required: true,unique: true},
    pass: {type: String},
    cgpa: {type: String},
    p_name: {type: String},
    regno: {type: String},
    section: {type: String},
    progname: {type: String},
    AttPercent: {type: String},
    pendingAss: {type: Object,default: {}},
    subjects: {type: Object,default: {}},
    schedules: {type: Object,default: {}},
    notify: {type: Boolean,default: false},
    lastSynced:{type:String}
});

const messageSchema = new mongoose.Schema({
    chatId: { type: Number, required: true },
    time: { type: String, required: true },
    msgtosend: { type: String, required: true }
});

const useridSchema = new mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
        unique: true,
      },
});
  
const messageTimeSchema = new mongoose.Schema({
    sunday: [messageSchema],
    monday: [messageSchema],
    tuesday: [messageSchema],
    wednesday: [messageSchema],
    thursday: [messageSchema],
    friday: [messageSchema],
    saturday: [messageSchema],
});

  
const User = mongoose.model('User', userSchema);
const MessageTime = mongoose.model('MessageTime', messageTimeSchema);
const UserIds = mongoose.model('UserIds', useridSchema);

const userMap = new Map();
const user_details = {};


const replyKeyboard = {
    keyboard: [
        ['/timetable', '/assignments'],
        ['/update','/delete'],
        ['/notify','/stop']
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };


  //encryption code
const secretKey = keys.secretKey;
const cryptr = new Cryptr(secretKey);
function encryptText(text) {
  const encryptedData = cryptr.encrypt(text);
  return encryptedData;
}
function decryptText(encryptedData) {
  const decryptedData = cryptr.decrypt(encryptedData);
  return decryptedData;
}

const myid=keys.myid;

//send notices to all users
async function notice(message) {
    try {
        const users = await UserIds.find().lean();
        const userIDs = users.map((user) => user.chatId);
        for (const userID of userIDs) {
            bot.sendMessage(userID, message);
        }
        const size = userIDs.length;
        return size;
    } catch (error) {
        console.error(error);
        return 0;
    }
}

bot.onText(/\/notice([\s\S]+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const message = match[1];
    if (chatId == myid) {
        const size = await notice(message);
        bot.sendMessage(chatId, `Sent to ${size} users successfully.`);
    } else {
        bot.sendMessage(chatId, 'You are not authorized to use this command.');
    }
});


bot.onText(/\/start/,async (msg) => {
    check=true;
    const chatId = msg.chat.id;
    const chatName=msg.chat.username;
    console.log(chatId+" "+chatName);

    try{
        const newUserid = new UserIds({ chatId });
        await newUserid.save();
    }catch (error) {
        // console.error(error);
        if (error.code === 11000) {}
        else console.error(error);
    }

    User.findOne({ chatId: chatId }, (err, user) => {
        if (err) {
          console.log(err);
          bot.sendMessage(chatId, 'An error occurred. Please try again later.');
        }
        else if (user) {
            bot.sendMessage(chatId, `Welcome back, ${user.p_name}!`, {
                reply_markup: JSON.stringify(replyKeyboard)});
        }
        else {
          bot.sendMessage(chatId, 'Welcome to LPUCompanion! To get started, please create a profile using the /create command.');
        }
    });
});

bot.onText(/\/create/, async (msg) => {
    const chatId = msg.chat.id;
    const newu = {
        id: "",
        pass: "",
        expecting: ""
    };
    user_details[chatId]=newu;
    // console.log(chatId+" "+JSON.stringify(user_details));
    bot.sendMessage(chatId, 'Please enter your LPU UMS login credentials.')
    .then(() => {
        return bot.sendMessage(chatId, 'Username:');
    })
    .catch((error) => {
        console.error(error);
        bot.sendMessage(chatId, 'Oops, something went wrong. Please try again later.');
    });
    user_details[chatId].expecting='username';    
});


bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    if(chatId in user_details){
        if (user_details[chatId].expecting === 'username') {
            user_details[chatId].id = messageText;
            user_details[chatId].expecting = 'password';
        bot.sendMessage(chatId, 'Password (Do not worry! It will be confidential):');
        }
        else if (user_details[chatId].expecting === 'password') {
            user_details[chatId].pass = messageText;
            user_details[chatId].expecting = 'tnow';
            
            bot.sendMessage(chatId, `Wait while we are collecting data`);   

            try {
                const userDetails = await getDetails.test(user_details[chatId].id, user_details[chatId].pass, chatId);
                user_details[chatId].pass=encryptText(user_details[chatId].pass);
                userDetails.pass=user_details[chatId].pass;
                const newUser = new User(userDetails);
                await newUser.save();

                bot.sendMessage(chatId, 'Your profile has been created! You can /start again. Enjoy!');
            } catch (error) {
                // console.error(error);
                if (error.toString().includes('#cgpa')) {
                    bot.sendMessage(chatId, 'Login Error!! Wrong Password. Retry /create');
                }
            }
        }
    }
});


bot.onText(/\/timetable\s*(\S+)?/, async (msg,match) => {
    const chatId = msg.chat.id;
    try {
        const user = await User.findOne({ chatId });
        if (!user) {
            bot.sendMessage(chatId, "No profile found. Please create a profile using the /create command.");
            return;
        }
        let day = match[1] ? match[1].toLowerCase() : moment.tz('Asia/Kolkata').format('dddd').toLowerCase();
        const day2 = moment.tz('Asia/Kolkata').format('dddd').toLowerCase();
        const data1=user.schedules[day];
        let message = `<strong>${day===day2?"Today":(day.charAt(0).toUpperCase() + day.slice(1))}'s TimeTable:</strong><code>\n\n`;
        for (const timeSlot in data1) {
            message += `</code>[${timeSlot}]<code> \n`;
            data1[timeSlot].forEach((entry) => {
                message += `\t${entry.Sub_Code}:${entry.Sub_Name}\n`;
                message += `\t${entry.Room} | ${entry.Roll_No} | ${entry.Att}%\n`;
            });
            message+='\n';
        }
        message+=`\n</code>Last Synced:${user.lastSynced}`;
        bot.sendMessage(chatId, `${message}`,{parse_mode:'HTML'});
    

    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, "An error occurred while fetching the user's profile.");
    }
  });

  bot.onText(/\/assignments/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const user = await User.findOne({ chatId });
        if (!user) {
            bot.sendMessage(chatId, "No profile found. Please create a profile using the /create command.");
            return;
        }

        const data1=user.pendingAss;
        
        let message = '<strong>Pending Assignments:</strong><code>\n\n';
        for (const ass in data1) {
            // console.log(ass);
            const lines = data1[ass].split('|');
            message += `${lines[0]}[${user.subjects[ass].subjectName}]\n`;
            message += `${lines[1]} ${lines[2]}`;
            message +='\n \n';
        }
        message+=`</code>Last Synced:${user.lastSynced}\nWe suggest you /update.`;
        bot.sendMessage(chatId, `${message}`,{parse_mode:'HTML'});
        

    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, "An error occurred while fetching the user's profile.");
    }
  });


  bot.onText(/\/update/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const user = await User.findOne({ chatId });
      if (!user) {
        bot.sendMessage(chatId, "No profile found. Please create a profile using the /create command.");
        return;
      }
  
      try {
        const tempass = decryptText(user.pass);
        const newUserDetails = await getDetails.test(user.id, tempass, chatId);
        newUserDetails.pass = encryptText(newUserDetails.pass);
  
        await User.findOneAndUpdate(
          { chatId: chatId },
          newUserDetails,
          { upsert: true, new: true }
        ).exec();
  
        bot.sendMessage(chatId, 'Your profile has been updated! You can /start again. Enjoy!');
      } catch (error) {
        // console.error(error);
        if (error.toString().includes('#cgpa')) {
            bot.sendMessage(chatId, 'Login Error!! Your Password may have changed.\nTo update use /changepass <new Password> and then retry');
        }
      }
    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, "An error occurred while fetching the user's profile.");
    }
  });

  bot.onText(/\/changepass(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const newpass = match[1];

    if (!newpass) {
        bot.sendMessage(chatId, 'Please provide a new password in the format \n/changepass <newPassword>.');
        return;
    }

    try {
        const user=await User.findOne({ chatId });
        if (!user) {
            bot.sendMessage(chatId, "No profile found. Please create a profile using the /create command.");
            return;
        }
        try{
            const newEncryptedPass = encryptText(newpass);
            await User.findOneAndUpdate(
                { chatId: chatId },
                { pass: newEncryptedPass },
                { upsert: true, new: true }
            ).exec();
            bot.sendMessage(chatId, 'Password changed successfully!');
        } catch (error) {
            bot.sendMessage(chatId, 'Oops, something went wrong. Please try again later.');
        }
    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, "An error occurred while fetching the user's profile.");
    }
});

  bot.onText(/\/delete/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const user = await User.findOne({ chatId });
        if (!user) {
            bot.sendMessage(chatId, "No profile found. Please create a profile using the /create command.");
            return;
        }
        User.findOneAndDelete({ chatId })
        .then((deletedUser) => {
            if (deletedUser) {
               bot.sendMessage(chatId, `Profile deleted successfully.`);
               if(user.notify){
                bot.sendMessage(chatId, `Notification system still active. /stop`);
                }
            // Do something else if needed
            } else {
                bot.sendMessage(chatId, `No user not found.`);
            }
        })
        .catch((err) => {
            console.error(err);
        });
    } catch (error) {
      console.error(error);
      bot.sendMessage(chatId, "An error occurred while fetching the user's profile.");
    }
});



cron.schedule('* * * * *', () => {
    try{
        const timezone = 'Asia/Kolkata'; 
        const now = moment(); 
        const dayOfWeek = now.tz(timezone).format('dddd').toLowerCase();
        const time = now.tz(timezone).format('HH:mm'); 

        MessageTime.findOne({}).exec((err, data) => {
        if (err) {
            console.error(err);
        }
        const messages = data&&data[dayOfWeek];
        if (messages && messages.length > 0) {
            const messagesToSend = messages.filter((m) => m.time === time);
            messagesToSend.forEach((messageToSend) => {
            bot.sendMessage(messageToSend.chatId, messageToSend.msgtosend,{parse_mode:'HTML'})
                .then(() => {
                    // console.log(`Message sent to chat ${messageToSend.chatId}: ${messageToSend.msgtosend}`);
                })
                .catch((error) => {
                    console.error(error);
                });
            });
        }
        });
    }catch (error) {
        console.error(error);
    }
});



const addMessageTime=async(sch,chatId)=>{
    try{
        for(const day in sch){
            const t_table=sch[day];
            for (const time in t_table) {
                const subjects=t_table[time];
                var [startHour, startMin] = time.split('-')[0].split(':').map(Number);
                if(!startMin)startMin=0;
                var notifyHour = startHour;
                var notifyMin = startMin - 15;
                if(notifyMin<0){
                    notifyHour--;
                    if(notifyHour>=0 && notifyHour<=6)notifyHour+=12;
                    notifyMin=45;
                }
                for (const subject of subjects) {
                    if(subject.Sub_Code==="CSES007")continue;                    
                    let message = '<b>Class Reminder:</b>\n';
                    message += `<b>[${time}]:</b>\n`;
                    message += `\t<code>${subject.Sub_Code}:${subject.Sub_Name}\n`;
                    message += `\t${subject.Room} | ${subject.Roll_No} | ${subject.Att}%\n`;
                    message+='</code>\n';
                    const sendTime = notifyHour+":"+notifyMin;
                    const update = { $push: { [day]: { chatId: chatId, time: sendTime.padStart(5, '0'), msgtosend: message } } };
                    const options = { upsert: true };
                    await MessageTime.updateOne({}, update, options)
                    .then(()=>{})
                    .catch(error => {console.error('Error saving dayMessages document:', error);return false;});
                }
            }
        }
        return true;
    }catch (error) {
        console.error(error);
    }
};


bot.onText(/\/notify/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const user = await User.findOne({ chatId });
        if (!user) {
            bot.sendMessage(chatId, "No profile found. Please create a profile using the /create command.");
            return;
        }
        if(user.notify==false){
            await addMessageTime(user.schedules,chatId) //adding all times to database
            .then(() => {
                User.updateOne({ chatId }, { notify: true }, function(err, res){});
                bot.sendMessage(chatId, "Great! We will notify you 15 mins before every class..");
            })
            .catch(error => console.error('Error saving dayMessages document:'));
        }
        else{
            bot.sendMessage(chatId, "Notification system already active. /stop and again /notify to update.");
        }
    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, "An error occurred while fetching the user's profile.");
    }
});

bot.onText(/\/stop/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        const user = await User.findOne({ chatId });
        if (user) {
            if(user.notify==false){
                bot.sendMessage(chatId, "Notification service already inactive.");
                return;
            }
        }

        const chatIdToDelete = chatId; 
        const query = { 
        $or: [
            { "sunday.chatId": chatIdToDelete },
            { "monday.chatId": chatIdToDelete },
            { "tuesday.chatId": chatIdToDelete },
            { "wednesday.chatId": chatIdToDelete },
            { "thursday.chatId": chatIdToDelete },
            { "friday.chatId": chatIdToDelete },
            { "saturday.chatId": chatIdToDelete },
        ]
        };

        await MessageTime.updateMany(query, {
            $pull: {
                sunday: { chatId: chatIdToDelete },
                monday: { chatId: chatIdToDelete },
                tuesday: { chatId: chatIdToDelete },
                wednesday: { chatId: chatIdToDelete },
                thursday: { chatId: chatIdToDelete },
                friday: { chatId: chatIdToDelete },
                saturday: { chatId: chatIdToDelete },
            }
        });

        await User.updateOne({ chatId }, { notify: false });
        bot.sendMessage(chatId, "Notifications stopped!!");
        
    } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, "An error occurred while fetching the user's profile.");
    }
});

bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const helpText = `<b>Here are all the commands you can use:</b>\n\n` +
        `\/start: <code>To start interacting with the bot.</code>\n` +
        `\/create: <code>To create your profile.</code>\n` +
        `\/update: <code>To update your profile.</code>\n` +
        `\/timetable: <code>Fetch your timetable. Use it like "/timetable monday" to get the timetable for a specific day.</code>\n` +
        `\/assignments: <code>See all pending assignments. You may need to use \/update before using this command.</code>\n` +
        `\/changepass <code>&lt;newpass&gt;</code>: <code>Reset your password.</code>\n` +
        `\/notify: <code>Start the notification service. You will receive notifications 15 minutes before every class according to your timetable.</code>\n` +
        `\/stop: <code>Stop the notification service.</code>\n` +
        `\/delete: <code>Delete your profile.</code>\n` +
        `\/help: <code>Get help.</code>\n\n` +
        `More features will be added soon. Stay tuned!\n` +
        `Visit alfredx.in for more info.\n\n`+
        `<code>Powered by</code> <b>AlfredX</b><code>. All rights reserved.</code>`;
        
    bot.sendMessage(chatId, helpText, { parse_mode: 'HTML' });
});



process.on("unhandledRejection", (error) => {
    console.error("Unhandled Promise Rejection:", error);
  });
  
